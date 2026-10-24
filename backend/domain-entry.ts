export * from "../src/domain/core";
export * from "../src/domain/migration";
export * from "../src/types";
import { validateState } from "../src/legacy/state";
export function parseLegacyTable(rows: unknown[][]) {
  if (rows[0]?.[0] !== "key" || rows[0]?.[1] !== "value")
    throw new Error("舊帳本表頭錯誤");
  const found: Record<string, unknown> = {};
  for (const row of rows.slice(1)) {
    if (row[0] === "projects" || row[0] === "expenses") {
      if (String(row[0]) in found) throw new Error("重複舊資料鍵");
      found[String(row[0])] = JSON.parse(String(row[1]));
    }
  }
  return validateState(found);
}

export { canonicalJSON } from "../src/domain/serialization";
