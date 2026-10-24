import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Exercise the actual inline bootstrap produced by the GAS packaging script.
const source = readFileSync("scripts/build-backend.mjs", "utf8");
const bootstrap = source.split("const startup = `")[1].split("`;\nawait writeFile")[0];
const script = bootstrap.match(/<script>([\s\S]*?)<\/script>/)![1];
function harness() {
  const status = { hidden: false, textContent: "正在載入安全帳本…" };
  const root = { childElementCount: 0 };
  const handlers: Record<string, (event: any) => void> = {};
  let mutation = () => {}, timeout = () => {};
  vm.runInNewContext(script, {
    document: { getElementById: (id: string) => id === "root" ? root : status },
    window: { addEventListener: (name: string, fn: typeof mutation) => { handlers[name] = fn; } },
    MutationObserver: class { constructor(fn: typeof mutation) { mutation = fn; } observe() {} disconnect() {} },
    setTimeout: (fn: typeof mutation) => { timeout = fn; },
  });
  return { status, root, handlers, mutate: () => mutation(), timeout: () => timeout() };
}
test("GAS startup displays runtime errors as text", () => {
  const h = harness();
  h.handlers.error({ message: "<script>sample</script>" });
  assert.match(h.status.textContent, /載入失敗/);
  assert.match(h.status.textContent, /<script>sample<\/script>/);
  assert.equal(h.status.hidden, false);
});
test("GAS startup hides after React mounts but shows later failures", () => {
  const h = harness();
  h.root.childElementCount = 1;
  h.mutate();
  assert.equal(h.status.hidden, true);
  h.handlers.unhandledrejection({ reason: new Error("RPC failure") });
  assert.equal(h.status.hidden, false);
  assert.match(h.status.textContent, /RPC failure/);
});
test("GAS startup diagnoses a bundle that never mounts", () => {
  const h = harness();
  h.timeout();
  assert.match(h.status.textContent, /15秒/);
  assert.match(h.status.textContent, /更新部署版本/);
});
