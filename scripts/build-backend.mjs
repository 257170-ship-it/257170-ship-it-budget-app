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
await writeFile(
  out + "/Index.html",
  '<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><style>' +
    css.replaceAll("</style", "<\\/style") +
    '</style></head><body><div id="root"></div><script>' +
    js.replaceAll("</script", "<\\/script") +
    "</script></body></html>",
);
console.log(
  "Apps Script package: " +
    resolve(out) +
    " (Domain.gs, Code.gs, Index.html, appsscript.json)",
);
