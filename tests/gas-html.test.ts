import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createBundleMarkup } from "../scripts/gas-html.mjs";
function run(source: string, corrupt?: (value: string) => string) {
  const markup = createBundleMarkup(source);
  const content = markup.match(/<div[^>]*>([\s\S]*?)<\/div>/)![1];
  const status = { hidden: true, textContent: "" };
  const payload = { textContent: corrupt ? corrupt(content) : content, remove() {} };
  let injected = "";
  const loader = markup.match(/<script>([\s\S]*?)<\/script>/)![1];
  vm.runInNewContext(loader, {
    document: {
      getElementById: (id: string) => id === "app-payload" ? payload : status,
      createElement: () => ({textContent: ""}),
      body: { appendChild: (script: {textContent: string}) => {
        new vm.Script(script.textContent);
        injected = script.textContent;
      } },
    }, atob, TextDecoder, Uint8Array,
  });
  return { injected, status, markup };
}
test("GAS bundle roundtrips Unicode and HTML-sensitive JavaScript without rewriting", () => {
  const source = `var value = "繁體中文 </script> <!-- <script>"; var compare = 1 < 2;`;
  const result = run(source);
  assert.equal(result.injected, source);
  assert.equal((result.markup.match(/<script>/g) || []).length, 1);
  assert.equal(result.status.hidden, true);
});
test("GAS loader rejects truncated or altered payload before execution", () => {
  const source = `var value = "繁體中文";`;
  const truncated = run(source, (s) => s.slice(4));
  assert.equal(truncated.injected, "");
  assert.match(truncated.status.textContent, /內容不完整/);
  const altered = run(source, (s) => (s[0] === "A" ? "B" : "A") + s.slice(1));
  assert.equal(altered.injected, "");
  assert.match(altered.status.textContent, /校驗不符/);
});
test("GAS packaging rejects a syntax error before writing HTML", () => {
  assert.throws(() => createBundleMarkup("var a = };"), SyntaxError);
});
test("actual production bundle survives the same GAS encoding and decoding", () => {
  execFileSync(process.execPath, ["scripts/build-backend.mjs"], { stdio: "pipe" });
  const source = readFileSync("backend/generated/app.js", "utf8");
  assert.equal(run(source).injected, source);
});
