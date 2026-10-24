import { useState } from "react";
import { useBudget } from "../context/BudgetContext";
import {
  blankItem,
  blankProject,
  money,
  type BudgetItem,
  type Project,
  type BudgetGroup,
  type Subproject,
} from "../types";
import { calculatedAmount, cap, itemSpent, projectSpent } from "../domain/core";
import { Amount, Rules } from "./fields";
export default function ProjectManager({
  projectId,
  onSelect,
}: {
  projectId: string;
  onSelect: (id: string) => void;
}) {
  const { state, dispatch, status, role } = useBudget(),
    [editId, setEditId] = useState(""),
    [groupId, setGroupId] = useState(""),
    [showProject, setShowProject] = useState(false),
    [showInactive, setShowInactive] = useState(false);
  const project = state.projects.find((p) => p.id === projectId),
    canEdit = role === "editor" || role === "admin",
    busy = status !== "ready";
  const items = state.items
    .filter((i) => i.projectId === projectId)
    .sort((a, b) => a.order - b.order);
  async function add() {
    const id = crypto.randomUUID();
    if (
      await dispatch({
        type: "saveItem",
        value: {
          ...blankItem(id, projectId),
          name: "新預算項目",
          originalName: "新預算項目",
          order: items.length,
        },
        reason: "新增預算項目",
      })
    )
      setEditId(id);
  }
  return (
    <>
      <div className="actions">
        <button
          disabled={!canEdit || busy}
          onClick={() => {
            onSelect("");
            setShowProject(true);
          }}
        >
          ＋新增計畫
        </button>
        {project && (
          <button
            className="secondary"
            disabled={!canEdit || busy}
            onClick={() => setShowProject(!showProject)}
          >
            編輯計畫基本資料
          </button>
        )}
      </div>
      {showProject && (
        <ProjectEditor
          key={projectId || "new"}
          project={project || blankProject("new")}
          onDone={(id) => {
            onSelect(id);
            setShowProject(false);
          }}
        />
      )}
      {!project && !showProject && (
        <div className="panel empty">
          請建立計畫，或從「九案草稿」預覽來源範本。
        </div>
      )}
      {project && (
        <>
          <section className="panel">
            <div className="section-title">
              <div>
                <p className="eyebrow">DYNAMIC BUDGET</p>
                <h2>{project.name}</h2>
              </div>
              <span className="badge">
                {project.approvedAmount === null
                  ? "待核定"
                  : project.status === "draft"
                    ? "草稿"
                    : "已設定核定額"}
              </span>
            </div>
            <p>{project.summary}</p>
            <div className="report-summary">
              <span>申請／概算 {money(project.sourceAmount)}</span>
              <span>
                核定{" "}
                {project.approvedAmount === null
                  ? "待核定"
                  : money(project.approvedAmount)}
              </span>
              <span>
                調整後 {cap(project) === null ? "待核定" : money(cap(project))}
              </span>
              <span>已支用 {money(projectSpent(state, project.id))}</span>
              <span>
                可用{" "}
                {cap(project) === null
                  ? "待核定"
                  : money(cap(project)! - projectSpent(state, project.id))}
              </span>
            </div>
            <p className="hint">
              年度：{project.year ?? "待補"}{" "}
              {project.yearType === "academic" ? "學年度" : "年度"}　執行：
              {project.startDate ?? "待補"} ～ {project.endDate ?? "待補"}
              　結報：{project.reportDeadline ?? "待補"}
            </p>
            {project.issues.length > 0 && (
              <details>
                <summary>
                  來源疑義 {project.issues.length} 項（保留待確認）
                </summary>
                <ul>
                  {project.issues.map((x, n) => (
                    <li key={n}>{x}</li>
                  ))}
                </ul>
              </details>
            )}
            <p className="hint">
              {project.source.document} · {project.source.location} ·{" "}
              {project.source.note}
            </p>
          </section>
          <section className="panel">
            <div className="section-title">
              <h2>預算明細</h2>
              <button disabled={!canEdit || busy} onClick={() => void add()}>
                ＋新增一列
              </button>
            </div>
            <p className="hint">
              每列以固定ID關聯支出；同名項目可獨立控管。空白核定額代表待核定，0代表明確零元。金額以「元」輸入。
            </p>
            <label className="check">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              顯示停用／零額項目
            </label>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>項目／原表列號</th>
                    <th>子計畫／群組</th>
                    <th>申請／計算值</th>
                    <th>核定／調整額</th>
                    <th>已支用／餘額</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i, index) =>
                    !showInactive && i.inactive ? null : (
                      <tr key={i.id}>
                        <td>
                          {i.name}
                          {i.inactive && <span className="badge">停用</span>}
                          <small>
                            來源列 {i.sourceRow || "人工新增"} · {i.unit} ·{" "}
                            {
                              {
                                direct: "直接金額",
                                quantity: "單價×數量",
                                teaching: "授課鐘點",
                                percent: "百分比估算",
                              }[i.calculation]
                            }
                          </small>
                        </td>
                        <td>
                          {state.subprojects.find(
                            (s) => s.id === i.subprojectId,
                          )?.name || "—"}
                          <small>
                            {state.groups.find((g) => g.id === i.groupId)
                              ?.name || "—"}
                          </small>
                        </td>
                        <td>
                          {money(i.sourceAmount)}
                          <small>
                            計算：{money(calculatedAmount(i, state.items))}
                          </small>
                        </td>
                        <td>
                          {i.approvedAmount === null
                            ? "待核定"
                            : money(i.approvedAmount)}
                          <small>
                            調整後：{cap(i) === null ? "待核定" : money(cap(i))}
                          </small>
                        </td>
                        <td>
                          {money(itemSpent(state, i.id))}
                          <small>
                            {cap(i) === null
                              ? "待核定"
                              : money(cap(i)! - itemSpent(state, i.id))}
                          </small>
                        </td>
                        <td>
                          <div className="compact-actions">
                            <button
                              className="text"
                              disabled={!canEdit || busy}
                              onClick={() => setEditId(i.id)}
                            >
                              編輯
                            </button>
                            <button
                              className="text"
                              disabled={!canEdit || busy}
                              onClick={() =>
                                void dispatch({
                                  type: "saveItem",
                                  value: {
                                    ...i,
                                    id: crypto.randomUUID(),
                                    name: i.name + "（複本）",
                                    approvedAmount: null,
                                    adjustedAmount: null,
                                    order: items.length,
                                    inactive: false,
                                  },
                                  reason: "複製項目為待核定草稿",
                                })
                              }
                            >
                              複製
                            </button>
                            <button
                              className="text"
                              disabled={!canEdit || busy || index === 0}
                              onClick={() => {
                                const ids = items.map((x) => x.id);
                                [ids[index - 1], ids[index]] = [
                                  ids[index],
                                  ids[index - 1],
                                ];
                                void dispatch({
                                  type: "reorderItems",
                                  projectId,
                                  ids,
                                });
                              }}
                            >
                              上移
                            </button>
                            <button
                              className="text"
                              disabled={
                                !canEdit || busy || index === items.length - 1
                              }
                              onClick={() => {
                                const ids = items.map((x) => x.id);
                                [ids[index + 1], ids[index]] = [
                                  ids[index],
                                  ids[index + 1],
                                ];
                                void dispatch({
                                  type: "reorderItems",
                                  projectId,
                                  ids,
                                });
                              }}
                            >
                              下移
                            </button>
                            <button
                              className="text"
                              disabled={!canEdit || busy}
                              onClick={() =>
                                void dispatch({
                                  type: "saveItem",
                                  value: { ...i, inactive: !i.inactive },
                                  reason: i.inactive
                                    ? "啟用項目"
                                    : "停用項目，保留歷史",
                                })
                              }
                            >
                              {i.inactive ? "啟用" : "停用"}
                            </button>
                            <button
                              className="text danger-text"
                              disabled={
                                !canEdit ||
                                busy ||
                                state.expenses.some((e) =>
                                  e.allocations.some(
                                    (a) => a.budgetItemId === i.id,
                                  ),
                                )
                              }
                              onClick={() =>
                                void dispatch({ type: "removeItem", id: i.id })
                              }
                            >
                              刪除空項目
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </section>
          {state.items.find((i) => i.id === editId) && (
            <ItemEditor
              key={editId + "-" + state.revisions.length}
              item={state.items.find((i) => i.id === editId)!}
              onDone={() => setEditId("")}
            />
          )}
          <div className="split">
            <section className="panel">
              <h2>子計畫／班別</h2>
              {state.subprojects
                .filter((s) => s.projectId === projectId)
                .map((s) => (
                  <SubEditor key={s.id} value={s} />
                ))}
              <SubEditor
                key={"new-" + projectId}
                value={{
                  id: "new",
                  projectId,
                  name: "",
                  className: "",
                  order: state.subprojects.length,
                  sourceAmount: null,
                }}
              />
            </section>
            <section className="panel">
              <h2>預算群組控制</h2>
              {state.groups
                .filter((g) => g.projectId === projectId)
                .map((g) => (
                  <div className="report-summary" key={g.id}>
                    {g.name} · 核定 {money(g.approvedAmount)}
                    <button className="text" onClick={() => setGroupId(g.id)}>
                      編輯
                    </button>
                  </div>
                ))}
              <button
                className="secondary"
                disabled={!canEdit || busy}
                onClick={() => setGroupId("new")}
              >
                新增群組
              </button>
              {groupId && (
                <GroupEditor
                  key={groupId + "-" + projectId}
                  group={
                    state.groups.find((g) => g.id === groupId) || {
                      id: "new",
                      projectId,
                      subprojectId: null,
                      name: "",
                      sourceAmount: null,
                      approvedAmount: null,
                      adjustedAmount: null,
                      rules: [],
                    }
                  }
                  onDone={() => setGroupId("")}
                />
              )}
            </section>
          </div>
          <Transfer projectId={projectId} />
          <section className="panel">
            <h2>調整與版本紀錄</h2>
            {state.revisions
              .filter((r) => r.projectId === projectId)
              .slice()
              .reverse()
              .map((r) => (
                <details key={r.id}>
                  <summary>
                    {r.at} · {r.reason} · {r.actor}
                  </summary>
                  <pre>
                    {JSON.stringify(
                      { before: r.before, after: r.after },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              ))}
            {!state.revisions.some((r) => r.projectId === projectId) && (
              <p className="hint">目前沒有調整紀錄。</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
function ProjectEditor({
  project,
  onDone,
}: {
  project: Project;
  onDone: (id: string) => void;
}) {
  const { dispatch, status, role } = useBudget(),
    [p, set] = useState(project),
    [reason, setReason] = useState("建立／核對計畫基本資料");
  return (
    <section className="panel">
      <h2>{p.id === "new" ? "新增計畫" : "計畫基本資料"}</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const value = {
            ...p,
            id: p.id === "new" ? crypto.randomUUID() : p.id,
          };
          if (await dispatch({ type: "saveProject", value, reason }))
            onDone(value.id);
        }}
      >
        <fieldset disabled={status !== "ready"}>
          <div className="two">
            <label>
              計畫名稱
              <input
                required
                maxLength={160}
                value={p.name}
                onChange={(e) => set({ ...p, name: e.target.value })}
              />
            </label>
            <label>
              年度類型
              <select
                value={p.yearType}
                onChange={(e) =>
                  set({ ...p, yearType: e.target.value as Project["yearType"] })
                }
              >
                <option value="academic">學年度</option>
                <option value="calendar">年度</option>
              </select>
            </label>
            <label>
              民國年度（未知留空）
              <input
                type="number"
                min="1"
                max="999"
                value={p.year ?? ""}
                onChange={(e) =>
                  set({
                    ...p,
                    year: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
            <label>
              狀態
              <select
                value={p.status}
                onChange={(e) =>
                  set({ ...p, status: e.target.value as Project["status"] })
                }
              >
                {[
                  ["draft", "申請／草稿"],
                  ["approved", "已核定"],
                  ["active", "執行中"],
                  ["closing", "結報中"],
                  ["closed", "已結案"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            摘要／補助單位
            <textarea
              value={p.summary}
              onChange={(e) => set({ ...p, summary: e.target.value })}
            />
          </label>
          <div className="three">
            <label>
              執行開始
              <input
                type="date"
                value={p.startDate ?? ""}
                onChange={(e) =>
                  set({ ...p, startDate: e.target.value || null })
                }
              />
            </label>
            <label>
              執行結束
              <input
                type="date"
                value={p.endDate ?? ""}
                onChange={(e) => set({ ...p, endDate: e.target.value || null })}
              />
            </label>
            <label>
              結報期限
              <input
                type="date"
                value={p.reportDeadline ?? ""}
                onChange={(e) =>
                  set({ ...p, reportDeadline: e.target.value || null })
                }
              />
            </label>
          </div>
          <div className="three">
            <Amount
              label="計畫申請／概算額"
              value={p.sourceAmount}
              onChange={(v) => set({ ...p, sourceAmount: v })}
            />
            <Amount
              label="計畫核定額（未知留空）"
              value={p.approvedAmount}
              disabled={role !== "admin"}
              onChange={(v) => set({ ...p, approvedAmount: v })}
            />
            <Amount
              label="計畫調整後額（無調整留空）"
              value={p.adjustedAmount}
              disabled={role !== "admin"}
              onChange={(v) => set({ ...p, adjustedAmount: v })}
            />
            <Amount
              label="補助款"
              value={p.subsidy}
              onChange={(v) => set({ ...p, subsidy: v })}
            />
            <Amount
              label="自籌款"
              value={p.selfFunding}
              onChange={(v) => set({ ...p, selfFunding: v })}
            />
          </div>
          <label>
            來源文件
            <input
              value={p.source.document}
              onChange={(e) =>
                set({ ...p, source: { ...p.source, document: e.target.value } })
              }
            />
          </label>
          <label>
            來源位置
            <input
              value={p.source.location}
              onChange={(e) =>
                set({ ...p, source: { ...p.source, location: e.target.value } })
              }
            />
          </label>
          <label>
            待確認事項（每行一項）
            <textarea
              value={p.issues.join("\n")}
              onChange={(e) =>
                set({
                  ...p,
                  issues: e.target.value.split("\n").filter(Boolean),
                })
              }
            />
          </label>
          <label>
            儲存／調整原因
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button>儲存計畫</button>
        </fieldset>
      </form>
    </section>
  );
}
function ItemEditor({
  item,
  onDone,
}: {
  item: BudgetItem;
  onDone: () => void;
}) {
  const { state, dispatch, status, role } = useBudget(),
    [i, set] = useState(item),
    [reason, setReason] = useState("核對預算項目");
  const admin = role === "admin";
  let calculationDisplay = "待確認";
  try {
    calculationDisplay = money(
      calculatedAmount(
        i,
        state.items.map((x) => (x.id === i.id ? i : x)),
      ),
    );
  } catch (e) {
    calculationDisplay = e instanceof Error ? e.message : "計算設定有誤";
  }
  return (
    <section className="panel">
      <h2>編輯預算明細</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await dispatch({ type: "saveItem", value: i, reason })) onDone();
        }}
      >
        <fieldset disabled={status !== "ready"}>
          <div className="two">
            <label>
              項目名稱
              <input
                required
                value={i.name}
                onChange={(e) => set({ ...i, name: e.target.value })}
              />
            </label>
            <label>
              原表名稱
              <input
                value={i.originalName}
                onChange={(e) => set({ ...i, originalName: e.target.value })}
              />
            </label>
            <label>
              統計分類
              <input
                value={i.category}
                onChange={(e) => set({ ...i, category: e.target.value })}
              />
            </label>
            <label>
              子計畫
              <select
                value={i.subprojectId ?? ""}
                onChange={(e) =>
                  set({ ...i, subprojectId: e.target.value || null })
                }
              >
                <option value="">無</option>
                {state.subprojects
                  .filter((s) => s.projectId === i.projectId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.className}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              預算群組
              <select
                value={i.groupId ?? ""}
                onChange={(e) => set({ ...i, groupId: e.target.value || null })}
              >
                <option value="">無</option>
                {state.groups
                  .filter((g) => g.projectId === i.projectId)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              計算模式
              <select
                value={i.calculation}
                onChange={(e) =>
                  set({
                    ...i,
                    calculation: e.target.value as BudgetItem["calculation"],
                  })
                }
              >
                <option value="direct">直接金額</option>
                <option value="quantity">單價 × 數量</option>
                <option value="teaching">授課節數／時數</option>
                <option value="percent">指定項目基礎百分比（估算）</option>
              </select>
            </label>
            <label>
              計費單位
              <input
                required
                list="units"
                value={i.unit}
                onChange={(e) => set({ ...i, unit: e.target.value })}
              />
              <datalist id="units">
                {[
                  "節",
                  "小時",
                  "節×人次",
                  "人次",
                  "份",
                  "輛",
                  "趟",
                  "天",
                  "式",
                  "本",
                  "個",
                  "組",
                  "批",
                ].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </datalist>
            </label>
            <label>
              申請數量
              <input
                type="number"
                min="0"
                step="0.25"
                value={i.quantity ?? ""}
                onChange={(e) =>
                  set({
                    ...i,
                    quantity: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </label>
            <Amount
              label="項目申請單價"
              value={i.unitPrice}
              onChange={(v) => set({ ...i, unitPrice: v })}
            />
            <Amount
              label="最高單價（未知留空）"
              disabled={!admin}
              value={i.maxUnitPrice}
              onChange={(v) => set({ ...i, maxUnitPrice: v })}
            />
            <Amount
              label="項目原表申請額"
              value={i.sourceAmount}
              onChange={(v) => set({ ...i, sourceAmount: v })}
            />
            <Amount
              label="項目核定額（未知留空）"
              disabled={!admin}
              value={i.approvedAmount}
              onChange={(v) => set({ ...i, approvedAmount: v })}
            />
            <Amount
              label="項目調整後額（無調整留空）"
              disabled={!admin}
              value={i.adjustedAmount}
              onChange={(v) => set({ ...i, adjustedAmount: v })}
            />
            <label>
              流用設定
              <select
                disabled={!admin}
                value={i.transferPolicy}
                onChange={(e) =>
                  set({
                    ...i,
                    transferPolicy: e.target
                      .value as BudgetItem["transferPolicy"],
                  })
                }
              >
                <option value="review">待確認，禁止流用</option>
                <option value="locked">不可流用</option>
                <option value="allowed">已確認可在同計畫內流用</option>
              </select>
            </label>
          </div>
          {i.calculation === "percent" && (
            <>
              <label>
                估算百分比（%）
                <input
                  type="number"
                  step=".01"
                  min="0"
                  max="100"
                  value={i.percent ?? ""}
                  onChange={(e) =>
                    set({
                      ...i,
                      percent: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </label>
              <label>
                取整
                <select
                  value={i.rounding}
                  onChange={(e) =>
                    set({
                      ...i,
                      rounding: e.target.value as BudgetItem["rounding"],
                    })
                  }
                >
                  <option value="round">四捨五入至分</option>
                  <option value="ceil">無條件進位至分</option>
                  <option value="floor">無條件捨去至分</option>
                </select>
              </label>
              {state.items
                .filter((x) => x.projectId === i.projectId && x.id !== i.id)
                .map((x) => (
                  <label className="check" key={x.id}>
                    <input
                      type="checkbox"
                      checked={i.baseItemIds.includes(x.id)}
                      onChange={(e) =>
                        set({
                          ...i,
                          baseItemIds: e.target.checked
                            ? [...i.baseItemIds, x.id]
                            : i.baseItemIds.filter((id) => id !== x.id),
                        })
                      }
                    />
                    {x.name}（{x.sourceRow}）
                  </label>
                ))}
            </>
          )}
          <p className="formula">
            計算值 {calculationDisplay}
            ；原表金額仍保留，不自動覆寫。
          </p>
          <details>
            <summary>
              採購子明細 {i.details.length} 筆（不額外計入預算）
            </summary>
            {i.details.map((d, n) => (
              <div className="two" key={d.id}>
                <label>
                  品名
                  <input
                    value={d.name}
                    onChange={(e) =>
                      set({
                        ...i,
                        details: i.details.map((x, k) =>
                          k === n ? { ...x, name: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  單位
                  <input
                    value={d.unit}
                    onChange={(e) =>
                      set({
                        ...i,
                        details: i.details.map((x, k) =>
                          k === n ? { ...x, unit: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <Amount
                  label={"採購單價 " + (n + 1)}
                  value={d.unitPrice}
                  onChange={(v) =>
                    set({
                      ...i,
                      details: i.details.map((x, k) =>
                        k === n ? { ...x, unitPrice: v ?? 0 } : x,
                      ),
                    })
                  }
                />
                <label>
                  數量
                  <input
                    type="number"
                    min="0"
                    step=".25"
                    value={d.quantity}
                    onChange={(e) =>
                      set({
                        ...i,
                        details: i.details.map((x, k) =>
                          k === n
                            ? { ...x, quantity: Number(e.target.value) }
                            : x,
                        ),
                      })
                    }
                  />
                </label>
                <Amount
                  label={"原表小計 " + (n + 1)}
                  value={d.sourceAmount}
                  onChange={(v) =>
                    set({
                      ...i,
                      details: i.details.map((x, k) =>
                        k === n ? { ...x, sourceAmount: v ?? 0 } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="text"
                  onClick={() =>
                    set({ ...i, details: i.details.filter((_, k) => k !== n) })
                  }
                >
                  移除此採購列
                </button>
              </div>
            ))}
            <button
              className="secondary"
              type="button"
              onClick={() =>
                set({
                  ...i,
                  details: [
                    ...i.details,
                    {
                      id: crypto.randomUUID(),
                      name: "新採購品項",
                      unit: "份",
                      unitPrice: 0,
                      quantity: 1,
                      sourceAmount: 0,
                    },
                  ],
                })
              }
            >
              新增採購明細
            </button>
          </details>
          <Rules
            value={i.rules}
            onChange={(rules) => set({ ...i, rules })}
            disabled={!admin}
          />
          <label>
            調整原因
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="actions">
            <button>儲存明細</button>
            <button type="button" className="secondary" onClick={onDone}>
              關閉
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
function SubEditor({ value }: { value: Subproject }) {
  const { dispatch, status, role } = useBudget(),
    [v, set] = useState(value);
  return (
    <form
      className="sub-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          (await dispatch({
            type: "saveSubproject",
            value: { ...v, id: v.id === "new" ? crypto.randomUUID() : v.id },
          })) &&
          v.id === "new"
        )
          set({ ...value, name: "", className: "" });
      }}
    >
      <fieldset
        disabled={status !== "ready" || !["editor", "admin"].includes(role)}
      >
        <div className="two">
          <label>
            子計畫名稱
            <input
              required
              value={v.name}
              onChange={(e) => set({ ...v, name: e.target.value })}
            />
          </label>
          <label>
            班別
            <input
              value={v.className}
              onChange={(e) => set({ ...v, className: e.target.value })}
            />
          </label>
        </div>
        <Amount
          label="子計畫來源小計（不再加進主計畫）"
          value={v.sourceAmount}
          onChange={(amount) => set({ ...v, sourceAmount: amount })}
        />
        <button className="secondary">
          {v.id === "new" ? "新增子計畫" : "儲存子計畫"}
        </button>
      </fieldset>
    </form>
  );
}
function GroupEditor({
  group,
  onDone,
}: {
  group: BudgetGroup;
  onDone: () => void;
}) {
  const { state, dispatch, role, status } = useBudget(),
    [g, set] = useState(group),
    [reason, setReason] = useState("核對群組控制額");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await dispatch({
            type: "saveGroup",
            value: { ...g, id: g.id === "new" ? crypto.randomUUID() : g.id },
            reason,
          })
        )
          onDone();
      }}
    >
      <fieldset
        disabled={status !== "ready" || !["editor", "admin"].includes(role)}
      >
        <label>
          群組名稱
          <input
            required
            value={g.name}
            onChange={(e) => set({ ...g, name: e.target.value })}
          />
        </label>
        <label>
          所屬子計畫
          <select
            value={g.subprojectId ?? ""}
            onChange={(e) =>
              set({ ...g, subprojectId: e.target.value || null })
            }
          >
            <option value="">無</option>
            {state.subprojects
              .filter((s) => s.projectId === g.projectId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <Amount
          label="群組來源總額"
          value={g.sourceAmount}
          onChange={(v) => set({ ...g, sourceAmount: v })}
        />
        <Amount
          label="群組核定控制額"
          disabled={role !== "admin"}
          value={g.approvedAmount}
          onChange={(v) => set({ ...g, approvedAmount: v })}
        />
        <Amount
          label="群組調整後額"
          disabled={role !== "admin"}
          value={g.adjustedAmount}
          onChange={(v) => set({ ...g, adjustedAmount: v })}
        />
        <Rules
          value={g.rules}
          disabled={role !== "admin"}
          onChange={(rules) => set({ ...g, rules })}
        />
        <label>
          調整原因
          <input
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button>儲存群組</button>
      </fieldset>
    </form>
  );
}
function Transfer({ projectId }: { projectId: string }) {
  const { state, dispatch, role, status } = useBudget(),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [amount, setAmount] = useState<number | null>(null),
    [reason, setReason] = useState("");
  const rows = state.items.filter((i) => i.projectId === projectId);
  return (
    <section className="panel">
      <h2>預算流用</h2>
      <p className="hint">
        僅管理者可操作，兩項都需已確認可流用；同一計畫內流用總額不變，保留完整版本紀錄。
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (
            amount !== null &&
            (await dispatch({
              type: "transferBudget",
              fromId: from,
              toId: to,
              amount,
              reason,
            }))
          ) {
            setAmount(null);
            setReason("");
          }
        }}
      >
        <fieldset disabled={role !== "admin" || status !== "ready"}>
          <div className="two">
            <label>
              流出項目
              <select
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              >
                <option value="">請選擇</option>
                {rows.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}（{i.sourceRow}）
                  </option>
                ))}
              </select>
            </label>
            <label>
              流入項目
              <select
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
              >
                <option value="">請選擇</option>
                {rows.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}（{i.sourceRow}）
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Amount label="流用金額" value={amount} onChange={setAmount} />
          <label>
            核准依據／原因
            <input
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button>執行流用並留存紀錄</button>
        </fieldset>
      </form>
    </section>
  );
}
