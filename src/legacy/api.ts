import { type AppState } from "./types";
import { validateState } from "./state";
export const API_URL =
  import.meta.env?.VITE_GOOGLE_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbyeWXuTjEy2SSPPdeIL2V8q4k-v3PeLizmoEjU7CD4VAkQ8QwaOPtjQC0DHqvkzpVDt/exec";
export function parseSheet(data: unknown): AppState {
  if (
    !Array.isArray(data) ||
    data[0]?.[0] !== "key" ||
    data[0]?.[1] !== "value"
  )
    throw new Error(
      "API 未回傳預期的試算表資料；請檢查 Apps Script 部署權限。",
    );
  const result: Record<string, unknown> = {};
  for (const row of data.slice(1)) {
    if (!Array.isArray(row)) throw new Error("試算表資料列格式錯誤。");
    if (row[0] === "projects" || row[0] === "expenses") {
      if (row[0] in result) throw new Error("試算表有重複的資料鍵。");
      result[row[0]] = JSON.parse(row[1]);
    }
  }
  return validateState(result);
}
export async function loadFromSheet(): Promise<AppState> {
  const res = await fetch(API_URL + "?sheet=budget", {
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) throw new Error("讀取失敗（HTTP " + res.status + "）");
  return parseSheet(await res.json());
}
export const fingerprint = (state: AppState) => JSON.stringify(state);
export function serializeSheet(state: AppState) {
  const payload = [
    ["key", "value"],
    ["projects", JSON.stringify(state.projects)],
    ["expenses", JSON.stringify(state.expenses)],
  ];
  if (payload.some((row) => row[1].length > 45000))
    throw new Error(
      "資料超過試算表單格安全容量（45,000 字元），請減少憑證照片或改用 Google Drive 儲存照片。",
    );
  return payload;
}
export async function saveToSheet(
  state: AppState,
  baseline: AppState,
): Promise<AppState> {
  const payload = serializeSheet(state);
  const latest = await loadFromSheet();
  if (fingerprint(latest) !== fingerprint(baseline))
    throw new Error(
      "雲端資料已被其他電腦修改。請先下載未儲存備份，再重新載入雲端資料。",
    );
  const res = await fetch(API_URL + "?sheet=budget", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error("儲存失敗（HTTP " + res.status + "）");
  let reply: unknown;
  try {
    reply = await res.json();
  } catch {
    throw new Error("API 回應不是 JSON，請確認 Apps Script 已允許網頁存取。");
  }
  if (
    !reply ||
    (typeof reply === "object" &&
      ("error" in reply || ("success" in reply && !reply.success)))
  )
    throw new Error("Apps Script 回報儲存失敗。");
  const saved = await loadFromSheet();
  if (fingerprint(saved) !== fingerprint(state))
    throw new Error(
      "寫入後驗證不一致，請下載備份並重新載入確認；尚未標記為已同步。",
    );
  return saved;
}
