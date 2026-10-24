/* Apps Script V8. Domain.gs is generated from the same validated domain as the frontend. */
const TABLES_ = [
  "projects",
  "subprojects",
  "groups",
  "items",
  "expenses",
  "attachments",
  "activities",
  "teachingRecords",
  "revisions",
];
function properties_() {
  return PropertiesService.getScriptProperties();
}
function actor_() {
  const email = String(Session.getActiveUser().getEmail() || "")
    .trim()
    .toLowerCase();
  if (!email) throw new Error("需要可識別的Google登入帳號；禁止匿名存取");
  const roles = JSON.parse(properties_().getProperty("ROLES_JSON") || "{}");
  const role = roles[email];
  if (!["viewer", "entry", "editor", "admin"].includes(role))
    throw new Error("此帳號尚未獲授權");
  return { email, role };
}
function book_() {
  const id = properties_().getProperty("LEDGER_SPREADSHEET_ID");
  if (!id) throw new Error("尚未設定新版帳本");
  return SpreadsheetApp.openById(id);
}
function sheet_(book, name) {
  const sheet = book.getSheetByName(name);
  if (!sheet)
    throw new Error("缺少工作表：" + name + "，請先執行setupTestBook");
  return sheet;
}
function values_(sheet) {
  const values = sheet.getDataRange().getValues();
  return values.slice(1).filter((row) => row[0]);
}
function hash_(value) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(value),
    Utilities.Charset.UTF_8,
  )
    .map((b) => ("0" + ((b + 256) % 256).toString(16)).slice(-2))
    .join("");
}
function read_(book, target) {
  const journals = values_(sheet_(book, "Journal"));
  const committed = journals.filter((r) => r[2] === "COMMITTED");
  const latest = committed.reduce((n, r) => Math.max(n, Number(r[1])), 0);
  if (
    target !== undefined &&
    (!Number.isInteger(target) || target < 0 || target > latest)
  )
    throw new Error("版本不存在");
  const revision = target === undefined ? latest : target;
  const accepted = Object.create(null);
  committed
    .filter((r) => Number(r[1]) <= revision)
    .forEach((r) => (accepted[r[0]] = Number(r[1])));
  const state = Domain.emptyState();
  TABLES_.forEach((name) => {
    const records = Object.create(null);
    values_(sheet_(book, name)).forEach((r) => {
      const rev = accepted[r[1]];
      if (rev !== undefined && (!records[r[0]] || records[r[0]].rev < rev))
        records[r[0]] = {
          rev,
          deleted: r[2] === true || r[2] === "true",
          json: r[3],
        };
    });
    // Stable ID order makes read-after-write snapshots deterministic.
    state[name] = Object.keys(records)
      .sort()
      .filter((id) => !records[id].deleted)
      .map((id) => JSON.parse(records[id].json));
  });
  Domain.validateState(state);
  return { state, revision, journals };
}
function envelope_(book, actor, target) {
  const current = read_(book, target);
  return {
    schemaVersion: 2,
    revision: current.revision,
    state: current.state,
    user: actor,
    environment:
      properties_().getProperty("ENVIRONMENT") === "production"
        ? "production"
        : "test",
  };
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error("帳本忙碌，請保留請求稍後重試");
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
function writable_() {
  if (properties_().getProperty("WRITE_ENABLED") !== "true")
    throw new Error("帳本目前唯讀，尚未開放寫入");
}
function commit_(book, before, next, revision, requestId, payloadHash, actor) {
  const opId = Utilities.getUuid(),
    journal = sheet_(book, "Journal"),
    rowNumber = journal.getLastRow() + 1;
  // Single COMMITTED marker is the visibility boundary. PREPARED/ABORTED rows never appear in reads.
  journal.appendRow([
    opId,
    revision,
    "PREPARED",
    requestId,
    payloadHash,
    actor.email,
    new Date().toISOString(),
  ]);
  try {
    TABLES_.forEach((name) => {
      const oldMap = Object.create(null);
      before[name].forEach((x) => (oldMap[x.id] = x));
      const nextMap = Object.create(null);
      next[name].forEach((x) => (nextMap[x.id] = x));
      const rows = [];
      Object.keys(nextMap)
        .sort()
        .forEach((id) => {
          const json = JSON.stringify(nextMap[id]);
          if (!oldMap[id] || JSON.stringify(oldMap[id]) !== json) {
            if (json.length > 45000)
              throw new Error("單筆資料超過安全容量，請拆分明細");
            rows.push([id, opId, false, json]);
          }
        });
      Object.keys(oldMap).forEach((id) => {
        if (!nextMap[id]) rows.push([id, opId, true, "{}"]);
      });
      if (rows.length) {
        const sh = sheet_(book, name);
        sh.getRange(sh.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
      }
    });
    SpreadsheetApp.flush();
    journal.getRange(rowNumber, 3).setValue("COMMITTED");
    SpreadsheetApp.flush();
  } catch (error) {
    // A flush may throw after the commit marker persisted. Never turn an already visible commit into ABORTED.
    if (journal.getRange(rowNumber, 3).getValue() !== "COMMITTED") {
      journal.getRange(rowNumber, 3).setValue("ABORTED");
      SpreadsheetApp.flush();
    }
    throw error;
  }
  return envelope_(book, actor, revision);
}
function request_(r) {
  if (!r || typeof r !== "object" || JSON.stringify(r).length > 12000000)
    throw new Error("請求格式／大小無效");
  if (!/^[a-zA-Z0-9-]{8,160}$/.test(r.requestId || ""))
    throw new Error("requestId無效");
}
function requestHash_(payload) {
  return "c1:" + hash_(Domain.canonicalJSON(payload));
}
function duplicate_(book, r, payload, actor) {
  const found = values_(sheet_(book, "Journal")).find(
    (row) => row[2] === "COMMITTED" && row[3] === r.requestId,
  );
  if (!found) return null;
  // Old journal rows remain valid only when their original hash still matches.
  // Never accept an old mismatch by guessing that the operation was equivalent.
  const expected = String(found[4]).startsWith("c1:")
    ? requestHash_(payload)
    : hash_(payload);
  if (found[4] !== expected || found[5] !== actor.email)
    throw new Error("REQUEST_ID_CONFLICT：同一requestId不可用於不同內容或使用者；請先下載未確認變更備份，再重新同步核對已入帳資料，勿另建請求重送");
  return envelope_(book, actor, Number(found[1]));
}
function folder_() {
  const id = properties_().getProperty("ATTACHMENT_FOLDER_ID");
  if (!id) throw new Error("尚未設定私有附件資料夾");
  const folder = DriveApp.getFolderById(id);
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE)
    throw new Error("附件資料夾必須停用公開／網域連結分享");
  return folder;
}
function upload_(r, actor) {
  Domain.authorize(actor.role, "entry");
  request_(r);
  if (
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      r.mimeType,
    ) ||
    !["receipt", "source", "activity"].includes(r.kind)
  )
    throw new Error("僅接受JPG、PNG、WebP與PDF");
  if (
    typeof r.name !== "string" ||
    !r.name.trim() ||
    r.name.length > 180 ||
    typeof r.content !== "string" ||
    r.content.length > 11200000
  )
    throw new Error("附件格式／容量無效");
  return withLock_(() => {
    writable_();
    const book = book_(),
      payload = {
        action: "upload",
        projectId: r.projectId,
        name: r.name,
        mimeType: r.mimeType,
        kind: r.kind,
        contentHash: hash_(r.content),
      };
    const prior = duplicate_(book, r, payload, actor);
    if (prior) return prior;
    const before = read_(book);
    if (!before.state.projects.some((p) => p.id === r.projectId))
      throw new Error("找不到所屬計畫");
    const bytes = Utilities.base64Decode(r.content);
    if (bytes.length > 8 * 1024 * 1024) throw new Error("附件超過8MB");
    const file = folder_().createFile(
      Utilities.newBlob(bytes, r.mimeType, r.name),
    );
    try {
      const next = JSON.parse(JSON.stringify(before.state));
      next.attachments.push({
        id: r.requestId,
        projectId: r.projectId,
        fileId: file.getId(),
        name: r.name,
        mimeType: r.mimeType,
        kind: r.kind,
        createdAt: new Date().toISOString(),
        uploadedBy: actor.email,
      });
      Domain.validateState(next);
      return commit_(
        book,
        before.state,
        next,
        before.revision + 1,
        r.requestId,
        requestHash_(payload),
        actor,
      );
    } catch (error) {
      // Keep possible committed files intact; orphan IDs are logged for administrator review.
      console.error("附件需核對：" + file.getId());
      throw error;
    }
  });
}
function legacy_() {
  const id = properties_().getProperty("LEGACY_SPREADSHEET_ID");
  if (!id) throw new Error("尚未指定舊帳本");
  if (id === properties_().getProperty("LEDGER_SPREADSHEET_ID"))
    throw new Error("新舊帳本必須分開");
  const sheet = SpreadsheetApp.openById(id).getSheetByName("budget");
  if (!sheet) throw new Error("找不到舊budget工作表");
  return Domain.parseLegacyTable(sheet.getDataRange().getValues());
}
function migrationPreview_(actor) {
  Domain.authorize(actor.role, "admin");
  const original = legacy_(),
    state = Domain.migrateLegacy(original),
    report = Domain.reconciliation(original, state);
  return {
    hash: hash_(original),
    original,
    state,
    report,
    requiresConfirmation: true,
  };
}
function migrate_(r, actor) {
  Domain.authorize(actor.role, "admin");
  request_(r);
  return withLock_(() => {
    writable_();
    const book = book_(),
      payload = { action: "migrate", hash: r.hash };
    const prior = duplicate_(book, r, payload, actor);
    if (prior) return prior;
    if (properties_().getProperty("LEGACY_WRITE_DISABLED") !== "true")
      throw new Error("必須先停用舊版寫入並確認LEGACY_WRITE_DISABLED");
    if (
      properties_().getProperty("APPROVED_MIGRATION_HASH") !== r.hash ||
      r.confirmation !== "確認已備份並核對遷移"
    )
      throw new Error(
        "尚未核准此遷移版本；請先下載預覽、核對及備份，由管理者設定核准雜湊",
      );
    const preview = migrationPreview_(actor);
    if (preview.hash !== r.hash || !preview.report.consistent)
      throw new Error("舊資料已變動或核對失敗，需重新確認");
    const current = read_(book);
    if (TABLES_.some((k) => current.state[k].length))
      throw new Error("目標帳本非空，禁止覆寫");
    const backup = folder_().createFile(
      Utilities.newBlob(
        JSON.stringify(preview.original, null, 2),
        "application/json",
        "legacy-backup-" + r.hash + ".json",
      ),
    );
    // Preserve original photos in private Drive, then remove inline data before committing.
    preview.state.attachments.forEach((a) => {
      if (a.legacyDataUrl) {
        const parts = a.legacyDataUrl.split(","),
          f = folder_().createFile(
            Utilities.newBlob(
              Utilities.base64Decode(parts[1]),
              a.mimeType,
              a.name,
            ),
          );
        a.fileId = f.getId();
        delete a.legacyDataUrl;
      }
    });
    // Raw legacy expense photographs remain in the private backup, not the new table.
    preview.state.expenses.forEach((e) => {
      if (e.legacy && typeof e.legacy === "object")
        e.legacy = { ...e.legacy, photos: undefined };
    });
    const afterReport = Domain.reconciliation(preview.original, preview.state);
    if (!afterReport.consistent) throw new Error("遷移核對失敗");
    if (hash_(legacy_()) !== r.hash)
      throw new Error("備份期間舊資料又有變動，停止遷移，請重新核對");
    preview.state.revisions.push({
      id: "migration-" + r.hash,
      projectId: "migration",
      at: new Date().toISOString(),
      actor: actor.email,
      reason: "已確認遷移；原件備份 " + backup.getId(),
      before: preview.report.before,
      after: afterReport.after,
    });
    return commit_(
      book,
      current.state,
      preview.state,
      current.revision + 1,
      r.requestId,
      requestHash_(payload),
      actor,
    );
  });
}
function budgetRpc(r) {
  const actor = actor_();
  if (!r || typeof r.action !== "string") throw new Error("請求格式無效");
  const book = book_();
  if (r.action === "load")
    return withLock_(() => envelope_(book, actor, r.revision));
  if (r.action === "migrationPreview") return migrationPreview_(actor);
  if (r.action === "migrate") return migrate_(r, actor);
  if (r.action === "upload") return upload_(r, actor);
  if (r.action === "download") {
    const current = read_(book);
    const a = current.state.attachments.find((a) => a.id === r.id);
    if (!a || !a.fileId) throw new Error("找不到附件");
    const file = DriveApp.getFileById(a.fileId);
    const parents = file.getParents();
    let owned = false;
    const target = folder_().getId();
    while (parents.hasNext())
      if (parents.next().getId() === target) owned = true;
    if (!owned) throw new Error("附件位置不符");
    const blob = file.getBlob();
    return {
      name: a.name,
      mimeType: a.mimeType,
      content: Utilities.base64Encode(blob.getBytes()),
    };
  }
  if (r.action === "command") {
    request_(r);
    if (r.command && r.command.type === "addAttachment")
      throw new Error("附件必須使用伺服器上傳流程");
    return withLock_(() => {
      writable_();
      const prior = duplicate_(book, r, r.command, actor);
      if (prior) return prior;
      const current = read_(book);
      if (r.expectedRevision !== current.revision)
        throw new Error(
          "REVISION_CONFLICT：其他使用者已更新，請下載未確認變更後重新載入",
        );
      const next = Domain.applyCommand(
        current.state,
        r.command,
        actor,
        new Date().toISOString(),
      );
      return commit_(
        book,
        current.state,
        next,
        current.revision + 1,
        r.requestId,
        requestHash_(r.command),
        actor,
      );
    });
  }
  throw new Error("不支援的API；舊版整表POST已停用");
}
function doGet(e) {
  actor_();
  if (e && e.parameter && e.parameter.sheet)
    throw new Error("舊版API已停用，不能存取新版帳本");
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("計畫經費控帳系統 安全帳本")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}
function doPost() {
  throw new Error("舊版整表POST已停用；請登入安全帳本");
}
function setupTestBook() {
  const actor = actor_();
  Domain.authorize(actor.role, "admin");
  const props = properties_();
  if (props.getProperty("LEDGER_SPREADSHEET_ID"))
    throw new Error("已設定帳本，禁止覆蓋");
  const book = SpreadsheetApp.create("計畫經費控帳 v2 測試帳本"),
    folder = DriveApp.createFolder("計畫經費控帳 v2 私有測試附件");
  TABLES_.forEach((name) =>
    book.insertSheet(name).appendRow(["id", "operationId", "deleted", "json"]),
  );
  book
    .insertSheet("Journal")
    .appendRow([
      "operationId",
      "revision",
      "status",
      "requestId",
      "payloadHash",
      "actor",
      "at",
    ]);
  props.setProperties({
    LEDGER_SPREADSHEET_ID: book.getId(),
    ATTACHMENT_FOLDER_ID: folder.getId(),
    ENVIRONMENT: "test",
    WRITE_ENABLED: "true",
  });
  return {
    spreadsheetId: book.getId(),
    folderId: folder.getId(),
    environment: "test",
  };
}

function runApprovedMigration() {
  const actor = actor_();
  Domain.authorize(actor.role, "admin");
  const hash = properties_().getProperty("APPROVED_MIGRATION_HASH");
  if (!hash) throw new Error("尚未核准遷移");
  return migrate_(
    {
      requestId: "migration-" + hash,
      hash,
      confirmation: "確認已備份並核對遷移",
    },
    actor,
  );
}
