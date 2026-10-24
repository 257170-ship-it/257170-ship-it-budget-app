import { useState, type FormEvent } from "react";
import { useBudget } from "../context/BudgetContext";
import {
  emptyLimits,
  expenseTypes,
  money,
  today,
  typeLabels,
  type Project,
} from "../types";
const blank = (): Project => ({
  id: crypto.randomUUID(),
  name: "",
  summary: "",
  totalBudget: 0,
  limits: emptyLimits(),
  used: emptyLimits(),
  startDate: today(),
  endDate: today(),
});
export default function ProjectManager() {
  const { state, status, dispatch } = useBudget();
  const [draft, setDraft] = useState<Project>(blank);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState("");
  const busy = status !== "ready";
  async function submit(e: FormEvent) {
    e.preventDefault();
    setNotice("");
    if (draft.startDate > draft.endDate) {
      setNotice("結束日期必須晚於或等於開始日期。");
      return;
    }
    if (
      await dispatch({
        type: editing ? "UPDATE_PROJECT" : "ADD_PROJECT",
        payload: { ...draft, name: draft.name.trim() },
      })
    ) {
      setDraft(blank());
      setEditing(false);
      setNotice("計畫已儲存至 Google 試算表。");
    }
  }
  return (
    <div className="split">
      <section className="panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">PROJECTS</p>
            <h2>計畫清單</h2>
          </div>
          <span className="badge">{state.projects.length} 個計畫</span>
        </div>
        {state.projects.length === 0 && (
          <div className="empty">
            尚未建立計畫
            <br />
            <small>從右側設定經費與執行期間，開始控管支出。</small>
          </div>
        )}
        {state.projects.map((p) => {
          const used = Object.values(p.used).reduce((a, b) => a + b, 0);
          return (
            <article className="project-card" key={p.id}>
              <div className="section-title">
                <h3>{p.name}</h3>
                <span
                  className={used > p.totalBudget ? "badge danger" : "badge"}
                >
                  {used > p.totalBudget ? "已超支" : "執行中"}
                </span>
              </div>
              <p>{p.summary || "未填寫計畫摘要"}</p>
              <small>
                {p.startDate} — {p.endDate}
              </small>
              <div className="budget-line">
                <strong>{money(p.totalBudget - used)}</strong>
                <span>剩餘 / {money(p.totalBudget)}</span>
              </div>
              <progress
                value={Math.min(used, p.totalBudget)}
                max={p.totalBudget || 1}
              />
              <div className="limit-grid">
                {expenseTypes.map((t) => (
                  <div key={t}>
                    <small>{typeLabels[t]}</small>
                    <span className={p.used[t] > p.limits[t] ? "negative" : ""}>
                      {money(p.used[t])} / {money(p.limits[t])}
                    </span>
                  </div>
                ))}
              </div>
              <div className="actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setDraft({ ...p, limits: { ...p.limits } });
                    setEditing(true);
                    setNotice("");
                  }}
                >
                  編輯計畫
                </button>
                <button
                  className="text danger-text"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      window.confirm(
                        "刪除此計畫及其全部支出？此操作會同步至雲端。",
                      )
                    ) {
                      if (
                        (await dispatch({
                          type: "DELETE_PROJECT",
                          payload: p.id,
                        })) &&
                        draft.id === p.id
                      ) {
                        setDraft(blank());
                        setEditing(false);
                      }
                    }
                  }}
                >
                  刪除
                </button>
              </div>
            </article>
          );
        })}
      </section>
      <section className="panel sticky">
        <p className="eyebrow">PLAN YOUR BUDGET</p>
        <h2>{editing ? "編輯計畫" : "新增計畫"}</h2>
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <label>
              計畫名稱
              <input
                required
                maxLength={120}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label>
              計畫摘要
              <textarea
                maxLength={1000}
                rows={3}
                value={draft.summary}
                onChange={(e) =>
                  setDraft({ ...draft, summary: e.target.value })
                }
              />
            </label>
            <label>
              總經費（元）
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={draft.totalBudget}
                onChange={(e) =>
                  setDraft({ ...draft, totalBudget: Number(e.target.value) })
                }
              />
            </label>
            <div className="two">
              <label>
                開始日期
                <input
                  type="date"
                  required
                  value={draft.startDate}
                  onChange={(e) =>
                    setDraft({ ...draft, startDate: e.target.value })
                  }
                />
              </label>
              <label>
                結束日期
                <input
                  type="date"
                  required
                  min={draft.startDate}
                  value={draft.endDate}
                  onChange={(e) =>
                    setDraft({ ...draft, endDate: e.target.value })
                  }
                />
              </label>
            </div>
            <h3>各細項上限</h3>
            <p className="hint">
              上限為 0 表示該類別不可支用。細項上限可獨立設定。
            </p>
            <div className="two">
              {expenseTypes.map((t) => (
                <label key={t}>
                  {typeLabels[t]}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={draft.limits[t]}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        limits: {
                          ...draft.limits,
                          [t]: Number(e.target.value),
                        },
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="actions">
              <button type="submit">{editing ? "儲存變更" : "建立計畫"}</button>
              {editing && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setDraft(blank());
                    setEditing(false);
                  }}
                >
                  取消編輯
                </button>
              )}
            </div>
          </fieldset>
        </form>
        {notice && <p role="status">{notice}</p>}
      </section>
    </div>
  );
}
