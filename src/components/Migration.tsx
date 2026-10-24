import { useState } from "react";
import { useBudget } from "../context/BudgetContext";
import { loadLegacy, hasSecureBridge, rpc } from "../api";
import { migrateLegacy, reconciliation } from "../domain/migration";
import { validateState } from "../domain/core";
import { downloadJSON } from "./Reports";
import type { AppState } from "../types";
export default function Migration() {
  const { mode, role, replacePreview, state } = useBudget(),
    [preview, setPreview] = useState<AppState | null>(null),
    [raw, setRaw] = useState<unknown>(null),
    [report, setReport] = useState<unknown>(null),
    [hash, setHash] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setNotice("");
    try {
      if (hasSecureBridge()) {
        const result = await rpc<{
          original: unknown;
          state: AppState;
          report: unknown;
          hash: string;
        }>({ action: "migrationPreview" });
        setRaw(result.original);
        setPreview(validateState(result.state));
        setReport(result.report);
        setHash(result.hash);
      } else {
        const original = await loadLegacy(),
          next = migrateLegacy(original);
        setRaw(original);
        setPreview(next);
        setReport(reconciliation(original, next));
      }
      setNotice("唯讀預覽完成；尚未寫入新舊帳本。");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "讀取失敗");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>備份、遷移預覽與回復</h2>
      <p className="notice">
        正式資料遷移須先備份、核對並確認。本頁不提供一鍵正式切換；預覽不會清空、覆寫或更新舊帳本。
      </p>
      <div className="actions">
        <button
          disabled={busy || (mode !== "preview" && role !== "admin")}
          onClick={() => void load()}
        >
          {busy ? "讀取中…" : "讀取舊帳本並產生遷移預覽"}
        </button>
        <button
          className="secondary"
          onClick={() => downloadJSON(state, "經費控帳-v2-目前工作階段.json")}
        >
          下載目前工作階段備份
        </button>
      </div>
      <label>
        從JSON備份建立預覽（不寫雲端）
        <input
          type="file"
          accept=".json,application/json"
          disabled={mode !== "preview"}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const data = JSON.parse(await file.text());
              const next = migrateLegacy(data);
              setRaw(data);
              setPreview(next);
              setReport(
                (data as AppState).schemaVersion === 2
                  ? {
                      schemaVersion: 2,
                      projects: next.projects.length,
                      expenses: next.expenses.length,
                    }
                  : reconciliation(data, next),
              );
              setNotice("備份已讀取為預覽，尚未替換目前工作階段。");
            } catch (err) {
              setNotice(err instanceof Error ? err.message : "備份無效");
            }
          }}
        />
      </label>
      {notice && <p role="status">{notice}</p>}
      {preview && (
        <>
          <h3>遷移前後核對</h3>
          <pre>{JSON.stringify(report, null, 2)}</pre>
          {hash && <p className="mono">待核准來源雜湊：{hash}</p>}
          <div className="actions">
            <button
              onClick={() => downloadJSON(raw, "經費控帳-遷移前原始備份.json")}
            >
              下載原始備份
            </button>
            <button
              className="secondary"
              onClick={() =>
                downloadJSON(
                  { state: preview, report, hash },
                  "經費控帳-遷移核對與預覽.json",
                )
              }
            >
              下載遷移核對結果
            </button>
            {mode === "preview" && (
              <button
                className="secondary"
                onClick={() => {
                  if (
                    window.confirm(
                      "將替換本工作階段草稿；請先下載目前備份。此操作不寫雲端。",
                    )
                  ) {
                    replacePreview(preview);
                    setNotice(
                      "已載入工作階段預覽。原額度保留，核定欄仍待確認。",
                    );
                  }
                }}
              >
                載入工作階段預覽（不寫雲端）
              </button>
            )}
          </div>
        </>
      )}
      <h3>正式切換前的必要條件</h3>
      <ol>
        <li>管理者部署新版Apps Script，先在獨立測試試算表驗證。</li>
        <li>下載原始備份與核對結果，確認筆數、逐案支出、代墊及附件一致。</li>
        <li>
          由帳本擁有者確認本次來源雜湊、回復方式與停用舊版寫入，再核准遷移。
        </li>
        <li>
          原帳本保留；若需回復，使用新後端的歷史版本及備份復原至另一帳本，不能盲目清空正式資料。
        </li>
      </ol>
      <p className="hint">
        詳細設定見儲存庫
        docs/BACKEND_DEPLOYMENT.md。未取得明確確認前，不執行正式切換。
      </p>
    </section>
  );
}
