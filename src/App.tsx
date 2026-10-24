import { lazy, Suspense, useMemo, useState } from "react";
import { BudgetProvider, useBudget } from "./context/BudgetContext";
import ProjectManager from "./components/ProjectManager";
import ExpenseForm from "./components/ExpenseForm";
import Reports, { downloadJSON } from "./components/Reports";
import Activities from "./components/Activities";
import Templates from "./components/Templates";
import Migration from "./components/Migration";
import { cap, projectSpent, advanceTotal, warnings } from "./domain/core";
import { hasSecureBridge } from "./api";
import { money } from "./types";
const Legacy = lazy(async () => {
  const [{ default: View }, { BudgetProvider: Provider }] = await Promise.all([
    import("./legacy/App"),
    import("./legacy/context/BudgetContext"),
  ]);
  return {
    default: () => (
      <Provider>
        <View />
      </Provider>
    ),
  };
});
const tabs = [
  "計畫與動態預算",
  "支出與憑證",
  "課程與場次",
  "報表與核銷",
  "九案草稿",
  "備份與遷移",
];
export default function App() {
  return (
    <BudgetProvider>
      <Workspace />
    </BudgetProvider>
  );
}
function Workspace() {
  const {
    state,
    mode,
    status,
    error,
    pending,
    role,
    email,
    revision,
    reload,
    retry,
  } = useBudget();
  const [tab, setTab] = useState(0),
    [selected, setSelected] = useState(""),
    [year, setYear] = useState(""),
    [legacy, setLegacy] = useState(false),
    [secureUrl, setSecureUrl] = useState(
      import.meta.env?.VITE_SECURE_WEBAPP_URL || "",
    );
  const projects = state.projects.filter(
      (p) => !year || p.yearType + ":" + p.year === year,
    ),
    projectId =
      selected === "__new__"
        ? ""
        : projects.some((p) => p.id === selected)
          ? selected
          : projects[0]?.id || "";
  const notices = useMemo(() => warnings(state), [state]);
  const requestConflict = /REQUEST_ID_CONFLICT|同一requestId不可用於不同內容或使用者/.test(error);
  const budget = projects
      .filter((p) => cap(p) !== null)
      .reduce((n, p) => n + cap(p)!, 0),
    used = projects.reduce((n, p) => n + projectSpent(state, p.id), 0);
  function select(id: string) {
    setSelected(id || "__new__");
    if (id) setYear("");
  }
  if (legacy)
    return (
      <>
        <div className="compatibility">
          <button onClick={() => setLegacy(false)}>
            返回新版草稿與安全帳本入口
          </button>
          <span>
            舊版相容帳本：仍使用原API。此入口不代表新版後端已部署；不要在此輸入新增的敏感資料。
          </span>
        </div>
        <Suspense fallback={<p>載入舊版…</p>}>
          <Legacy />
        </Suspense>
      </>
    );
  return (
    <>
      <header>
        <div className="brand">
          <span className="brand-icon">▥</span>
          <div>
            <strong>計畫經費控帳系統</strong>
            <small>DYNAMIC BUDGET · V2</small>
          </div>
        </div>
        <div className="sync">
          <span
            className={
              "dot " +
              (status === "error"
                ? "error"
                : status === "ready"
                  ? "ready"
                  : "saving")
            }
          />
          <span role="status">
            {mode === "preview"
              ? "工作階段草稿 · 不寫入雲端"
              : status === "ready"
                ? "安全帳本已同步 · 版本" + revision
                : status === "saving"
                  ? "儲存並驗證中…"
                  : status === "error"
                    ? "同步需要處理"
                    : "正在驗證登入…"}
          </span>
          {hasSecureBridge() && (
            <button
              className="header-button"
              disabled={status === "loading" || status === "saving"}
              onClick={() => {
                if (
                  !pending ||
                  window.confirm("請先下載未確認變更備份。仍要重新載入？")
                ) {
                  setTab(5);
                  void reload();
                }
              }}
            >
              重新同步
            </button>
          )}
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">FINANCIAL WORKSPACE</p>
            <h1>每份計畫，都有自己的預算明細。</h1>
            <p>動態增列、子計畫、不同費率與來源核對，保留每一筆經費的脈絡。</p>
          </div>
          <span className="cloud-label">
            {mode === "preview"
              ? "草稿預覽"
              : mode === "test"
                ? "獨立測試帳本"
                : "正式安全帳本"}
          </span>
        </div>
        {mode === "preview" && !hasSecureBridge() && (
          <section className="connection">
            <strong>
              新版預覽可操作，資料只保留在本次工作階段；離開前請下載備份。
            </strong>
            <p>
              公開網站不讀取新版私有帳本。登入安全帳本後，才會以Google
              Sheets保存資料與Drive憑證。
            </p>
            <div className="connection-actions">
              <label>
                已部署的安全帳本網址
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/…/exec"
                  value={secureUrl}
                  onChange={(e) => setSecureUrl(e.target.value)}
                />
              </label>
              <a
                className={
                  "button-link " +
                  (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
                    secureUrl,
                  )
                    ? "disabled"
                    : "")
                }
                href={
                  /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(
                    secureUrl,
                  )
                    ? secureUrl
                    : undefined
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                開啟安全帳本
              </a>
              <button className="secondary" onClick={() => setLegacy(true)}>
                開啟舊版相容帳本
              </button>
            </div>
            <small>
              後端套件及設定說明已隨程式提供；正式資料尚未遷移，既有帳本保持原狀。
            </small>
          </section>
        )}
        <p className="hint">
          {mode === "preview"
            ? "預覽模擬管理者；不代表取得正式帳本權限"
            : email + " · 角色 " + role + " · " + mode}
        </p>
        {error && (
          <div role="alert" className="error-banner">
            <strong>操作／同步提示</strong>
            <p>{error}</p>
            {pending && (
              <div className="actions">
                <button
                  onClick={() =>
                    downloadJSON(pending, "經費控帳-未確認變更.json")
                  }
                >
                  下載未確認變更備份
                </button>
                <button
                  className="secondary"
                  disabled={status === "saving" || requestConflict}
                  onClick={() => void retry()}
                >
                  以相同請求ID重試
                </button>
              </div>
            )}
            {requestConflict && (
              <p className="hint">此請求可能已有資料成功提交。請先下載未確認變更備份，再按上方「重新同步」核對計畫與支出；不要重新新增同一筆資料。舊版請求校驗不符時不會自動重送。</p>
            )}
            <p className="hint">失敗不會回寫空資料；畫面保留最後確認的狀態。</p>
          </div>
        )}
        <div className="stats">
          {[
            ["已核定可用總額", budget, "僅加總主計畫，未知核定額排除"],
            [
              "來源草稿總額",
              projects
                .filter((p) => p.approvedAmount === null)
                .reduce((n, p) => n + (p.sourceAmount ?? 0), 0),
              "申請／概算，尚非可動支額",
            ],
            ["已發生支出", used, "狀態更新與分攤不重複計入"],
            [
              "尚未歸墊",
              projects.reduce((n, p) => n + advanceTotal(state, p.id), 0),
              "與付款／核銷分開追蹤",
            ],
          ].map(([label, value, caption]) => (
            <section className="stat" key={label}>
              <small>{label}</small>
              <strong>{money(Number(value))}</strong>
              <span>{caption}</span>
            </section>
          ))}
        </div>
        <div className="workspace-filters">
          <label>
            年度篩選
            <select
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setSelected("");
              }}
            >
              <option value="">全部年度</option>
              {[
                ...new Set(
                  state.projects.map((p) => p.yearType + ":" + p.year),
                ),
              ].map((y) => (
                <option key={y} value={y}>
                  {y.split(":")[1] === "null" ? "待補年度" : y.split(":")[1]}{" "}
                  {y.startsWith("academic") ? "學年度" : "年度"}
                </option>
              ))}
            </select>
          </label>
          <label>
            目前計畫
            <select
              value={projectId}
              onChange={(e) => setSelected(e.target.value)}
            >
              {(!projects.length || selected === "__new__") && (
                <option value="">
                  {selected === "__new__" ? "新增計畫中" : "尚無計畫"}
                </option>
              )}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ·{" "}
                  {p.approvedAmount === null ? "待核定" : "已設定核定額"}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary"
            onClick={() => downloadJSON(state, "經費控帳-v2-工作階段備份.json")}
          >
            下載完整備份
          </button>
        </div>
        <nav aria-label="主要功能">
          {tabs.map((t, n) => (
            <button
              key={t}
              className={tab === n ? "active" : ""}
              aria-current={tab === n ? "page" : undefined}
              onClick={() => setTab(n)}
            >
              {t}
            </button>
          ))}
        </nav>
        {tab === 0 ? (
          <ProjectManager projectId={projectId} onSelect={select} />
        ) : tab === 1 ? (
          <ExpenseForm key={projectId} projectId={projectId} />
        ) : tab === 2 ? (
          <Activities key={projectId} projectId={projectId} />
        ) : tab === 3 ? (
          <Reports key={projectId} projectId={projectId} />
        ) : tab === 4 ? (
          <Templates
            onSelect={(id) => {
              select(id);
              setTab(0);
            }}
          />
        ) : (
          <Migration />
        )}
        {notices.length > 0 && (
          <section className="panel">
            <details>
              <summary>來源與資料核對提示 {notices.length} 項</summary>
              <ul>
                {notices.map((m, n) => (
                  <li key={n}>{m}</li>
                ))}
              </ul>
            </details>
          </section>
        )}
        <footer>
          <span>計畫經費控帳系統 V2</span>
          <span>
            {mode === "preview"
              ? "預覽不會寫入正式雲端資料"
              : "Google Sheets逐筆資料 · 後端授權與版本檢查"}
          </span>
        </footer>
      </main>
    </>
  );
}
