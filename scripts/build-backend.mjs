import { createBundleMarkup } from "./gas-html.mjs";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
const out = "backend/generated";
await mkdir(out, { recursive: true });
await build({
  entryPoints: ["backend/domain-entry.ts"],
  bundle: true,
  format: "iife",
  globalName: "Domain",
  target: "es2020",
  outfile: out + "/Domain.gs",
});
await copyFile("backend/Code.js", out + "/Code.gs");
await copyFile("backend/appsscript.json", out + "/appsscript.json");
await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
  outfile: out + "/app.js",
});
const js = await readFile(out + "/app.js", "utf8"),
  css = await readFile(out + "/app.css", "utf8");
// Show startup errors even when React cannot render.
const startup = `<aside id="startup-status" role="status" style="padding:20px;font:16px sans-serif">正在載入安全帳本…</aside>
<script>
(function () {
  var status = document.getElementById('startup-status');
  function show(message) {
    status.hidden = false;
    status.textContent = '安全帳本載入失敗：' + String(message) + '。請將此訊息提供給維護者；尚未確認雲端寫入。';
  }
  window.addEventListener('error', function (event) { show(event.message || '瀏覽器無法執行頁面程式'); });
  window.addEventListener('unhandledrejection', function (event) {
    show(event.reason && event.reason.message || event.reason || '非同步載入失敗');
  });
  var observer = new MutationObserver(function () {
    if (document.getElementById('root').childElementCount) {
      status.hidden = true;
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('root'), {childList: true});
  setTimeout(function () {
    if (!document.getElementById('root').childElementCount && status.textContent === '正在載入安全帳本…') {
      show('15秒內未完成啟動，請確認已完整貼上新版 Index.html 並更新部署版本');
    }
  }, 15000);
})();
</script>`;
await writeFile(
  out + "/Index.html",
  '<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><style>' +
    css.replaceAll("</style", "<\\/style") +
    '</style></head><body><div id="root"></div>' + startup +
    createBundleMarkup(js) +
    "</body></html>",
);
console.log(
  "Apps Script package: " +
    resolve(out) +
    " (Domain.gs, Code.gs, Index.html, appsscript.json)",
);
