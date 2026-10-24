import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createHash, randomUUID } from "node:crypto";
import { buildSync } from "esbuild";
import { blankProject, blankItem } from "../src/types";
const domain = buildSync({
  entryPoints: ["backend/domain-entry.ts"],
  bundle: true,
  format: "iife",
  globalName: "Domain",
  write: false,
  target: "es2020",
}).outputFiles[0].text;
function harness() {
  let email = "admin@example.test",
    locked = false,
    failTable = "",
    failCommit = false;
  const roles = {
      "admin@example.test": "admin",
      "entry@example.test": "entry",
      "viewer@example.test": "viewer",
      "editor@example.test": "editor",
    },
    props: Record<string, string> = {
      ROLES_JSON: JSON.stringify(roles),
      LEDGER_SPREADSHEET_ID: "testbook",
      ATTACHMENT_FOLDER_ID: "private",
      WRITE_ENABLED: "true",
      ENVIRONMENT: "test",
    };
  const sheets = new Map<string, any>();
  function sheet(name: string) {
    const sh: any = {
      name,
      rows: [
        name === "Journal"
          ? [
              "operationId",
              "revision",
              "status",
              "requestId",
              "payloadHash",
              "actor",
              "at",
            ]
          : ["id", "operationId", "deleted", "json"],
      ],
      getDataRange() {
        return { getValues: () => structuredClone(sh.rows) };
      },
      getLastRow() {
        return sh.rows.length;
      },
      appendRow(row: unknown[]) {
        sh.rows.push(structuredClone(row));
      },
      getRange(row: number, col: number, count = 1, width = 1) {
        return {
          setValues(values: unknown[][]) {
            if (failTable === name) {
              failTable = "";
              throw new Error("simulated interrupted write");
            }
            values.forEach((v, n) => {
              while (sh.rows.length < row + n) sh.rows.push([]);
              for (let k = 0; k < width; k++)
                sh.rows[row - 1 + n][col - 1 + k] = v[k];
            });
          },
          setValue(value: unknown) {
            while (sh.rows.length < row) sh.rows.push([]);
            sh.rows[row - 1][col - 1] = value;
          },
          getValue() {
            return sh.rows[row - 1]?.[col - 1];
          },
        };
      },
    };
    sheets.set(name, sh);
    return sh;
  }
  [
    "projects",
    "subprojects",
    "groups",
    "items",
    "expenses",
    "attachments",
    "activities",
    "teachingRecords",
    "revisions",
    "Journal",
  ].forEach(sheet);
  const book = {
      getSheetByName: (name: string) => sheets.get(name),
      getId: () => "testbook",
    },
    files = new Map<string, any>();
  const folder = {
    getId: () => "private",
    getSharingAccess: () => "PRIVATE",
    createFile(blob: any) {
      const id = randomUUID(),
        file = {
          getId: () => id,
          getBlob: () => blob,
          getParents: () => {
            let remaining = true;
            return {
              hasNext: () => remaining,
              next: () => {
                remaining = false;
                return folder;
              },
            };
          },
        };
      files.set(id, file);
      return file;
    },
  };
  const context = vm.createContext({
    console,
    Date,
    JSON,
    Math,
    Map,
    Set,
    Error,
    RegExp,
    Intl,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => props[key] ?? null,
        setProperties: (value: Record<string, string>) =>
          Object.assign(props, value),
      }),
    },
    Session: { getActiveUser: () => ({ getEmail: () => email }) },
    LockService: {
      getScriptLock: () => ({
        tryLock() {
          if (locked) return false;
          locked = true;
          return true;
        },
        releaseLock() {
          locked = false;
        },
      }),
    },
    SpreadsheetApp: {
      openById: (id: string) => {
        if (id === "legacy") {
          return {
            getSheetByName: () => ({
              getDataRange: () => ({
                getValues: () => [
                  ["key", "value"],
                  ["projects", "[]"],
                  ["expenses", "[]"],
                ],
              }),
            }),
          };
        }
        return book;
      },
      flush() {
        if (
          failCommit &&
          sheets.get("Journal").rows.some((r: any[]) => r[2] === "COMMITTED")
        ) {
          failCommit = false;
          throw new Error("acknowledgement lost after commit");
        }
      },
    },
    DriveApp: {
      Access: { PRIVATE: "PRIVATE" },
      getFolderById: () => folder,
      getFileById: (id: string) => files.get(id),
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: "sha256" },
      Charset: { UTF_8: "utf8" },
      computeDigest: (_alg: string, value: string) =>
        Array.from(createHash("sha256").update(value).digest()),
      getUuid: randomUUID,
      base64Decode: (s: string) => Array.from(Buffer.from(s, "base64")),
      base64Encode: (s: number[]) => Buffer.from(s).toString("base64"),
      newBlob: (data: any, mime: string, name: string) => ({
        getBytes: () =>
          typeof data === "string" ? Array.from(Buffer.from(data)) : data,
        mime,
        name,
      }),
    },
  });
  vm.runInContext(
    domain + "\n" + readFileSync("backend/Code.js", "utf8"),
    context,
  );
  const rpc = (request: unknown) =>
    context.budgetRpc(JSON.parse(JSON.stringify(request)));
  const send = (
    command: unknown,
    expectedRevision: number,
    requestId = randomUUID(),
  ) => rpc({ action: "command", command, expectedRevision, requestId });
  return {
    rpc,
    send,
    props,
    sheets,
    files,
    setEmail: (value: string) => (email = value),
    lock: () => (locked = true),
    unlock: () => (locked = false),
    fail: (table: string) => (failTable = table),
    loseAck: () => (failCommit = true),
  };
}
const project = {
  ...blankProject("p"),
  name: "安全測試",
  approvedAmount: 100000,
  status: "active" as const,
};
test("server rejects anonymous and unknown account before reading data", () => {
  const h = harness();
  h.setEmail("");
  assert.throws(() => h.rpc({ action: "load" }), /禁止匿名/);
  h.setEmail("outside@example.test");
  assert.throws(() => h.rpc({ action: "load" }), /未獲授權/);
});
test("server ignores forged client role and blocks viewer/entry budget writes", () => {
  const h = harness();
  h.setEmail("viewer@example.test");
  assert.equal(h.rpc({ action: "load" }).user.role, "viewer");
  assert.throws(
    () =>
      h.rpc({
        action: "command",
        command: { type: "saveProject", value: project, reason: "越權" },
        expectedRevision: 0,
        requestId: randomUUID(),
        role: "admin",
        email: "admin@example.test",
      }),
    /權限/,
  );
  assert.equal(h.rpc({ action: "load" }).revision, 0);
});
test("server revision check and requestId dedup prevent double commit", () => {
  const h = harness(),
    cmd = { type: "saveProject", value: project, reason: "新增" },
    id = randomUUID();
  assert.equal(h.send(cmd, 0, id).revision, 1);
  assert.equal(h.send(cmd, 0, id).revision, 1);
  assert.equal(h.rpc({ action: "load" }).state.projects.length, 1);
  assert.throws(
    () => h.send({ ...cmd, reason: "不同內容" }, 0, id),
    /不同內容/,
  );
  assert.throws(
    () =>
      h.send(
        {
          type: "saveProject",
          value: { ...project, name: "舊版覆寫" },
          reason: "覆寫",
        },
        0,
      ),
    /REVISION_CONFLICT/,
  );
});
test("concurrent lock owner rejects another writer without mutation", () => {
  const h = harness();
  h.lock();
  assert.throws(
    () => h.send({ type: "saveProject", value: project, reason: "新增" }, 0),
    /忙碌/,
  );
  h.unlock();
  assert.equal(h.rpc({ action: "load" }).revision, 0);
});
test("partial staged multi-table write is invisible and retry can recover", () => {
  const h = harness(),
    state = {
      schemaVersion: 2,
      projects: [{ ...blankProject("draft"), name: "草稿" }],
      subprojects: [],
      groups: [],
      items: [
        { ...blankItem("line", "draft"), name: "明細", originalName: "明細" },
      ],
      expenses: [],
      attachments: [],
      activities: [],
      teachingRecords: [],
      revisions: [],
    },
    cmd = { type: "importDraft", value: state },
    id = randomUUID();
  h.fail("items");
  assert.throws(() => h.send(cmd, 0, id), /interrupted/);
  assert.equal(h.rpc({ action: "load" }).state.projects.length, 0);
  assert.equal(h.rpc({ action: "load" }).revision, 0);
  const result = h.send(cmd, 0, id);
  assert.equal(result.revision, 1);
  assert.equal(result.state.projects.length, 1);
  assert.equal(result.state.items.length, 1);
  assert.ok(
    h.sheets.get("Journal").rows.some((r: any[]) => r[2] === "ABORTED"),
  );
});
test("lost response after commit is recoverable with same requestId", () => {
  const h = harness(),
    cmd = { type: "saveProject", value: project, reason: "新增" },
    id = randomUUID();
  h.loseAck();
  assert.throws(() => h.send(cmd, 0, id), /acknowledgement/);
  assert.equal(h.rpc({ action: "load" }).revision, 1);
  assert.equal(h.send(cmd, 0, id).revision, 1);
  assert.equal(h.rpc({ action: "load" }).state.projects.length, 1);
});
test("historical exact revision remains verifiable after a later writer", () => {
  const h = harness();
  h.send({ type: "saveProject", value: project, reason: "第一版" }, 0);
  h.send(
    {
      type: "saveProject",
      value: { ...project, name: "第二版" },
      reason: "第二版",
    },
    1,
  );
  assert.equal(
    h.rpc({ action: "load", revision: 1 }).state.projects[0].name,
    "安全測試",
  );
  assert.equal(h.rpc({ action: "load" }).state.projects[0].name, "第二版");
});
test("attachments require permission, private location, trusted project and idempotent upload", () => {
  const h = harness();
  h.send({ type: "saveProject", value: project, reason: "新增" }, 0);
  h.setEmail("viewer@example.test");
  assert.throws(
    () => h.rpc({ action: "upload", requestId: randomUUID() }),
    /權限/,
  );
  h.setEmail("entry@example.test");
  const req = {
    action: "upload",
    projectId: "p",
    name: "receipt.pdf",
    mimeType: "application/pdf",
    kind: "receipt",
    content: Buffer.from("%PDF-1.7 test").toString("base64"),
    requestId: randomUUID(),
  };
  const result = h.rpc(req);
  assert.equal(result.state.attachments.length, 1);
  assert.equal(h.rpc(req).state.attachments.length, 1);
  assert.equal(h.files.size, 1);
  assert.equal(
    h.rpc({ action: "download", id: req.requestId }).name,
    "receipt.pdf",
  );
  assert.throws(
    () => h.rpc({ action: "download", id: "unrelated-file" }),
    /找不到/,
  );
  assert.throws(
    () =>
      h.send({ type: "addAttachment", value: result.state.attachments[0] }, 2),
    /伺服器上傳/,
  );
});
test("writes can be disabled and production migration requires explicit approval hash", () => {
  const h = harness();
  h.props.WRITE_ENABLED = "false";
  assert.throws(
    () => h.send({ type: "saveProject", value: project, reason: "新增" }, 0),
    /唯讀/,
  );
  h.props.WRITE_ENABLED = "true";
  h.props.LEGACY_SPREADSHEET_ID = "legacy";
  h.props.LEGACY_WRITE_DISABLED = "true";
  const p = h.rpc({ action: "migrationPreview" });
  assert.equal(p.requiresConfirmation, true);
  assert.throws(
    () =>
      h.rpc({
        action: "migrate",
        requestId: randomUUID(),
        hash: p.hash,
        confirmation: "確認已備份並核對遷移",
      }),
    /尚未核准/,
  );
  assert.equal(h.rpc({ action: "load" }).revision, 0);
});
test("unrecognized legacy whole-table requests cannot write v2 tables", () => {
  const h = harness();
  assert.throws(
    () => h.rpc({ action: "save", state: { projects: [], expenses: [] } }),
    /不支援/,
  );
  assert.equal(h.rpc({ action: "load" }).revision, 0);
});

test("request retry tolerates recursively reordered object keys but rejects changed values and actors", () => {
  const h = harness(), id = randomUUID();
  const cmd = { type: "saveProject", value: project, reason: "新增" };
  h.send(cmd, 0, id);
  function reverseKeys(value: any): any {
    if (Array.isArray(value)) return value.map(reverseKeys);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([key, v]) => [key, reverseKeys(v)]));
    return value;
  }
  assert.equal(h.send(reverseKeys(cmd), 0, id).revision, 1);
  assert.equal(h.sheets.get("Journal").rows.length, 2);
  assert.throws(() => h.send({ ...cmd, value: { ...project, name: "changed" } }, 0, id), /REQUEST_ID_CONFLICT/);
  h.setEmail("editor@example.test");
  assert.throws(() => h.send(cmd, 0, id), /REQUEST_ID_CONFLICT/);
});

test("legacy journal hashes remain readable and never bypass a mismatch", () => {
  const h = harness(), id = randomUUID();
  const cmd = { type: "saveProject", value: project, reason: "新增" };
  h.send(cmd, 0, id);
  h.sheets.get("Journal").rows[1][4] = createHash("sha256").update(JSON.stringify(cmd)).digest("hex");
  assert.equal(h.send(cmd, 0, id).revision, 1);
  assert.throws(() => h.send({ reason: cmd.reason, value: project, type: cmd.type }, 0, id), /REQUEST_ID_CONFLICT/);
  assert.equal(h.sheets.get("Journal").rows.length, 2);
});
