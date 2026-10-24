import { canonicalJSON } from "./domain/serialization";
import type { AppState, Command, Envelope } from "./types";
import { validateState } from "./domain/core";
export { loadFromSheet as loadLegacy } from "./legacy/api";
interface Runner {
  withSuccessHandler(fn: (result: unknown) => void): Runner;
  withFailureHandler(fn: (error: { message: string }) => void): Runner;
  budgetRpc(request: unknown): void;
}
declare global {
  interface Window {
    google?: { script?: { run?: Runner } };
  }
}
export const hasSecureBridge = () =>
  typeof window !== "undefined" && !!window.google?.script?.run;
export function rpc<T>(request: unknown, timeout = 45000): Promise<T> {
  return new Promise((resolve, reject) => {
    const runner = window.google?.script?.run;
    if (!runner) {
      reject(
        new Error(
          "請在已登入的 Apps Script 安全帳本內操作；公開網站僅提供草稿預覽。",
        ),
      );
      return;
    }
    let finished = false;
    const timer = setTimeout(() => {
      finished = true;
      reject(new Error("連線逾時。請保留相同請求重試，避免重複入帳。"));
    }, timeout);
    runner
      .withSuccessHandler((result) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(result as T);
        }
      })
      .withFailureHandler((error) => {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          reject(new Error(error.message));
        }
      })
      .budgetRpc(request);
  });
}
function validateEnvelope(e: Envelope): Envelope {
  if (
    !e ||
    e.schemaVersion !== 2 ||
    !Number.isSafeInteger(e.revision) ||
    e.revision < 0 ||
    !e.user?.email ||
    !["viewer", "entry", "editor", "admin"].includes(e.user.role)
  )
    throw new Error("安全帳本回應格式錯誤");
  validateState(e.state);
  return e;
}
export async function loadSecure(revision?: number): Promise<Envelope> {
  return validateEnvelope(await rpc<Envelope>({ action: "load", revision }));
}
export async function saveSecure(
  command: Command,
  revision: number,
  requestId: string,
): Promise<Envelope> {
  const result = validateEnvelope(
    await rpc<Envelope>({
      action: "command",
      command,
      expectedRevision: revision,
      requestId,
    }),
  );
  // Verify the exact committed revision, even if another user has since committed.
  const verified = await loadSecure(result.revision);
  if (canonicalJSON(verified.state) !== canonicalJSON(result.state))
    throw new Error("寫入後驗證不一致；請下載未確認變更備份");
  return verified;
}
export async function uploadAttachment(
  projectId: string,
  file: File,
  kind: string,
): Promise<Envelope> {
  if (file.size > 8 * 1024 * 1024) throw new Error("附件上限8MB");
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("檔案讀取失敗"));
    reader.readAsDataURL(file);
  });
  return validateEnvelope(
    await rpc<Envelope>({
      action: "upload",
      projectId,
      name: file.name,
      mimeType: file.type,
      kind,
      content,
      requestId: crypto.randomUUID(),
    }),
  );
}
export async function downloadAttachment(id: string) {
  return rpc<{ name: string; mimeType: string; content: string }>({
    action: "download",
    id,
  });
}
export const fingerprint = (state: AppState) => canonicalJSON(state);
