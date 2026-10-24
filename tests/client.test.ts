import test from "node:test";
import assert from "node:assert/strict";
import { saveSecure } from "../src/api";
import { blankProject, emptyState, type Envelope } from "../src/types";
function bridge(handler: (req: any) => unknown) {
  (globalThis as any).window = {
    google: {
      script: {
        get run() {
          let success: (value: unknown) => void = () => {},
            failure: (error: { message: string }) => void = () => {};
          const runner = {
            withSuccessHandler(fn: typeof success) {
              success = fn;
              return runner;
            },
            withFailureHandler(fn: typeof failure) {
              failure = fn;
              return runner;
            },
            budgetRpc(req: unknown) {
              queueMicrotask(() => {
                try {
                  success(handler(req));
                } catch (e) {
                  failure({
                    message: e instanceof Error ? e.message : "failed",
                  });
                }
              });
            },
          };
          return runner;
        },
      },
    },
  };
}
test("secure client verifies exact revision before accepting latest state", async () => {
  const state = emptyState(),
    saved: Envelope = {
      schemaVersion: 2,
      revision: 1,
      state,
      user: { email: "test@example.test", role: "admin" },
      environment: "test",
    },
    requests: any[] = [];
  bridge((req) => {
    requests.push(req);
    return saved;
  });
  await saveSecure(
    {
      type: "saveProject",
      value: { ...blankProject("p"), name: "x" },
      reason: "test",
    },
    0,
    "request-12345",
  );
  assert.deepEqual(
    requests.map((r) => r.action),
    ["command", "load"],
  );
  assert.equal(requests[1].revision, 1);
});
test("secure client rejects readback mismatch and missing bridge rather than falling back to public POST", async () => {
  const state = emptyState(),
    base: Envelope = {
      schemaVersion: 2,
      revision: 1,
      state,
      user: { email: "test@example.test", role: "admin" },
      environment: "test",
    };
  bridge((req) =>
    req.action === "command"
      ? base
      : {
          ...base,
          state: {
            ...state,
            projects: [{ ...blankProject("unexpected"), name: "unexpected" }],
          },
        },
  );
  await assert.rejects(
    saveSecure(
      {
        type: "saveProject",
        value: { ...blankProject("p"), name: "x" },
        reason: "test",
      },
      0,
      "request-12345",
    ),
    /驗證不一致/,
  );
  delete (globalThis as any).window.google;
  await assert.rejects(
    saveSecure(
      {
        type: "saveProject",
        value: { ...blankProject("p"), name: "x" },
        reason: "test",
      },
      0,
      "request-12345",
    ),
    /登入/,
  );
});
test("network/RPC failures retain same id for explicit retries", async () => {
  const seen: string[] = [],
    state = emptyState(),
    base: Envelope = {
      schemaVersion: 2,
      revision: 1,
      state,
      user: { email: "test@example.test", role: "admin" },
      environment: "test",
    };
  let first = true;
  bridge((req) => {
    if (req.action === "command") {
      seen.push(req.requestId);
      if (first) {
        first = false;
        throw new Error("response lost");
      }
    }
    return base;
  });
  const cmd = {
    type: "saveProject" as const,
    value: { ...blankProject("p"), name: "x" },
    reason: "test",
  };
  await assert.rejects(saveSecure(cmd, 0, "same-request-id"), /response lost/);
  await saveSecure(cmd, 0, "same-request-id");
  assert.deepEqual(seen, ["same-request-id", "same-request-id"]);
});

test("read-after-write verification ignores object key order from RPC serialization", async () => {
  const state = { ...emptyState(), projects: [{ ...blankProject("p"), name: "RPC order" }] };
  const base: Envelope = { schemaVersion: 2, revision: 1, state, user: { email: "test@example.test", role: "admin" }, environment: "test" };
  function reverseKeys(value: any): any {
    if (Array.isArray(value)) return value.map(reverseKeys);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([key, v]) => [key, reverseKeys(v)]));
    return value;
  }
  bridge((req) => req.action === "load" ? reverseKeys(base) : base);
  const result = await saveSecure({ type: "saveProject", value: state.projects[0], reason: "test" }, 0, "request-order-test");
  assert.equal(result.revision, 1);
  assert.equal(result.state.projects[0].name, "RPC order");
});
