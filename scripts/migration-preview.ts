import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { API_URL, parseSheet } from "../src/legacy/api";
import { migrateLegacy, reconciliation } from "../src/domain/migration";
const args = process.argv.slice(2),
  out = resolve(
    args[args.indexOf("--out") + 1] && args.includes("--out")
      ? args[args.indexOf("--out") + 1]
      : "outputs/migration-preview",
  );
await mkdir(out, { recursive: true });
const input = args.includes("--input")
  ? args[args.indexOf("--input") + 1]
  : null;
let original: unknown, raw: string;
if (input) {
  raw = await readFile(resolve(input), "utf8");
  const data = JSON.parse(raw);
  original = Array.isArray(data) ? parseSheet(data) : data;
} else {
  const res = await fetch(API_URL + "?sheet=budget", {
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("讀取失敗 HTTP " + res.status);
  raw = await res.text();
  original = parseSheet(JSON.parse(raw));
}
const state = migrateLegacy(original),
  report = reconciliation(
    original as Parameters<typeof reconciliation>[0],
    state,
  );
if (!report.consistent) throw new Error("遷移核對不一致，禁止切換");
const hash = createHash("sha256")
    .update(JSON.stringify(original))
    .digest("hex"),
  stamp = new Date().toISOString().replace(/[:.]/g, "-");
await writeFile(resolve(out, "legacy-response-" + stamp + ".json"), raw);
await writeFile(
  resolve(out, "legacy-state-" + stamp + ".json"),
  JSON.stringify(original, null, 2),
);
await writeFile(
  resolve(out, "v2-preview-" + stamp + ".json"),
  JSON.stringify(state, null, 2),
);
await writeFile(
  resolve(out, "reconciliation-" + stamp + ".json"),
  JSON.stringify(
    { hash, report, requiresConfirmation: true, productionMigrated: false },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    { output: out, hash, report, productionMigrated: false },
    null,
    2,
  ),
);
