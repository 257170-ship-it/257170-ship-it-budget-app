import { useState } from "react";
import { useBudget } from "../context/BudgetContext";
import { money, today, type AppState, type Expense } from "../types";
import { cap, itemSpent, projectSpent } from "../domain/core";
import { downloadAttachment } from "../api";
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadJSON(value: unknown, name: string) {
  downloadBlob(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    name,
  );
}
export async function createWorkbook(
  state: AppState,
  rows: Expense[],
  projectId = "",
  subprojectId = "",
  itemId = "",
) {
  const excel = await import("exceljs"),
    Workbook = excel.Workbook ?? excel.default.Workbook,
    w = new Workbook();
  const add = (name: string, headers: string[], data: unknown[][]) => {
    const s = w.addWorksheet(name);
    s.addRow(headers);
    data.forEach((r) => s.addRow(r));
    s.getRow(1).font = { bold: true };
    s.columns.forEach((c) => (c.width = 22));
    s.views = [{ state: "frozen", ySplit: 1 }];
    return s;
  };
  const project = (id: string) =>
      state.projects.find((p) => p.id === id)?.name || id,
    item = (id: string) => state.items.find((i) => i.id === id);
  add(
    "計畫經費",
    [
      "計畫",
      "年度類型",
      "年度",
      "申請元",
      "核定元",
      "調整後元",
      "已支用元",
      "可用元",
      "狀態",
    ],
    state.projects
      .filter((p) => !projectId || p.id === projectId)
      .map((p) => [
        p.name,
        p.yearType,
        p.year,
        p.sourceAmount === null ? "待確認" : p.sourceAmount / 100,
        p.approvedAmount === null ? "待核定" : p.approvedAmount / 100,
        cap(p) === null ? "待核定" : cap(p)! / 100,
        projectSpent(state, p.id) / 100,
        cap(p) === null
          ? "待核定"
          : (cap(p)! - projectSpent(state, p.id)) / 100,
        p.status,
      ]),
  );
  add(
    "預算明細",
    [
      "計畫",
      "子計畫",
      "群組",
      "項目ID",
      "原表名稱",
      "顯示名稱",
      "原表列號",
      "單位",
      "申請元",
      "核定元",
      "調整後元",
      "已支用元",
      "可用元",
      "停用",
    ],
    state.items
      .filter(
        (i) =>
          (!projectId || i.projectId === projectId) &&
          (!subprojectId || i.subprojectId === subprojectId) &&
          (!itemId || i.id === itemId),
      )
      .map((i) => [
        project(i.projectId),
        state.subprojects.find((s) => s.id === i.subprojectId)?.name || "",
        state.groups.find((g) => g.id === i.groupId)?.name || "",
        i.id,
        i.originalName,
        i.name,
        i.sourceRow,
        i.unit,
        i.sourceAmount === null ? "待確認" : i.sourceAmount / 100,
        i.approvedAmount === null ? "待核定" : i.approvedAmount / 100,
        cap(i) === null ? "待核定" : cap(i)! / 100,
        itemSpent(state, i.id) / 100,
        cap(i) === null ? "待核定" : (cap(i)! - itemSpent(state, i.id)) / 100,
        i.inactive ? "是" : "否",
      ]),
  );
  add(
    "支出明細",
    [
      "日期",
      "付款日期",
      "計畫",
      "用途",
      "金額元",
      "受款人",
      "付款",
      "核銷",
      "代墊人",
      "歸墊",
      "憑證號碼",
      "支出ID",
    ],
    rows.map((e) => [
      e.occurrenceDate,
      e.paymentDate,
      project(e.projectId),
      e.description,
      e.amount / 100,
      e.payee,
      e.paymentStatus,
      e.claimStatus,
      e.isAdvance ? e.advancePerson : "",
      e.advanceStatus,
      e.voucherNumber,
      e.id,
    ]),
  );
  add(
    "支出分攤",
    ["支出ID", "預算項目ID", "原表名稱", "顯示名稱", "金額元", "來源"],
    rows.flatMap((e) =>
      e.allocations.map((a) => [
        e.id,
        a.budgetItemId,
        item(a.budgetItemId)?.originalName,
        item(a.budgetItemId)?.name,
        a.amount / 100,
        a.fundingSource,
      ]),
    ),
  );
  add(
    "子計畫",
    ["計畫", "子計畫", "班別", "來源小計元", "已支用元"],
    state.subprojects
      .filter(
        (s) =>
          (!projectId || s.projectId === projectId) &&
          (!subprojectId || s.id === subprojectId),
      )
      .map((s) => [
        project(s.projectId),
        s.name,
        s.className,
        s.sourceAmount === null ? "待確認" : s.sourceAmount / 100,
        state.items
          .filter((i) => i.subprojectId === s.id)
          .reduce((n, i) => n + itemSpent(state, i.id), 0) / 100,
      ]),
  );
  add(
    "鐘點費",
    [
      "日期",
      "教師",
      "單位",
      "原定數量",
      "請假數量",
      "實付數量",
      "單價元",
      "金額元",
      "支出ID",
    ],
    rows
      .filter((e) => e.teacherName)
      .map((e) => [
        e.occurrenceDate,
        e.teacherName,
        e.unit,
        e.quantity,
        e.leaveQuantity,
        (e.quantity ?? 0) - (e.leaveQuantity ?? 0),
        e.unitPrice === null ? "" : e.unitPrice / 100,
        e.amount / 100,
        e.id,
      ]),
  );
  add(
    "憑證索引",
    ["附件ID", "所屬計畫", "原始檔名", "種類", "檔案ID", "上傳者", "時間"],
    state.attachments
      .filter(
        (a) =>
          (!projectId || a.projectId === projectId) &&
          rows.some((e) => e.attachmentIds.includes(a.id)),
      )
      .map((a) => [
        a.id,
        project(a.projectId),
        a.name,
        a.kind,
        a.fileId || "舊附件待搬移",
        a.uploadedBy,
        a.createdAt,
      ]),
  );
  add(
    "採購明細",
    ["預算項目ID", "原表科目", "品名", "單位", "單價元", "數量", "原表小計元"],
    state.items
      .filter(
        (i) =>
          (!projectId || i.projectId === projectId) &&
          (!subprojectId || i.subprojectId === subprojectId) &&
          (!itemId || i.id === itemId),
      )
      .flatMap((i) =>
        i.details.map((d) => [
          i.id,
          i.originalName,
          d.name,
          d.unit,
          d.unitPrice / 100,
          d.quantity,
          d.sourceAmount / 100,
        ]),
      ),
  );
  return w;
}
export default function Reports({ projectId }: { projectId: string }) {
  const { state, status, role, dispatch, mode } = useBudget(),
    [sub, setSub] = useState(""),
    [item, setItem] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [filter, setFilter] = useState(""),
    [notice, setNotice] = useState(""),
    [exporting, setExporting] = useState(false);
  const rows = state.expenses
    .filter(
      (e) =>
        (!projectId || e.projectId === projectId) &&
        (!from || e.occurrenceDate >= from) &&
        (!to || e.occurrenceDate <= to) &&
        (!item || e.allocations.some((a) => a.budgetItemId === item)) &&
        (!sub ||
          e.allocations.some((a) =>
            state.items.some(
              (i) => i.id === a.budgetItemId && i.subprojectId === sub,
            ),
          )) &&
        (!filter ||
          (filter === "advance" &&
            e.isAdvance &&
            e.advanceStatus !== "reimbursed") ||
          (filter === "unknown" &&
            (e.paymentStatus === "unknown" || e.claimStatus === "unknown")) ||
          (filter === "unpaid" && e.paymentStatus === "unpaid") ||
          (filter === "claim" && e.claimStatus !== "closed") ||
          (filter === "teaching" && !!e.teacherName)),
    )
    .sort((a, b) => b.occurrenceDate.localeCompare(a.occurrenceDate));
  async function exportExcel() {
    setExporting(true);
    try {
      const w = await createWorkbook(state, rows, projectId, sub, item);
      const b = await w.xlsx.writeBuffer();
      downloadBlob(
        new Blob([b], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        "經費控帳-v2.xlsx",
      );
      setNotice("Excel已產生；待核定欄位保留文字，不以0代替。");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "匯出失敗");
    } finally {
      setExporting(false);
    }
  }
  async function attachment(id: string) {
    try {
      const a = state.attachments.find((a) => a.id === id)!;
      if (a.legacyDataUrl) {
        const response = await fetch(a.legacyDataUrl);
        downloadBlob(await response.blob(), a.name);
        return;
      }
      const f = await downloadAttachment(id),
        bytes = Uint8Array.from(atob(f.content), (c) => c.charCodeAt(0));
      downloadBlob(new Blob([bytes], { type: f.mimeType }), f.name);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "無法讀取附件");
    }
  }
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">REPORTS</p>
          <h2>經費、代墊與核銷報表</h2>
        </div>
        <button disabled={exporting} onClick={() => void exportExcel()}>
          {exporting ? "匯出中…" : "匯出 Excel"}
        </button>
      </div>
      <div className="filters">
        <label>
          子計畫
          <select
            value={sub}
            onChange={(e) => {
              setSub(e.target.value);
              setItem("");
            }}
          >
            <option value="">全部</option>
            {state.subprojects
              .filter((s) => !projectId || s.projectId === projectId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          預算項目
          <select value={item} onChange={(e) => setItem(e.target.value)}>
            <option value="">全部</option>
            {state.items
              .filter(
                (i) =>
                  (!projectId || i.projectId === projectId) &&
                  (!sub || i.subprojectId === sub),
              )
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}（{i.sourceRow}）
                </option>
              ))}
          </select>
        </label>
        <label>
          起始日期
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          結束日期
          <input
            type="date"
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <label>
          狀態
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">全部支出</option>
            <option value="advance">尚未歸墊</option>
            <option value="unknown">待確認</option>
            <option value="unpaid">未付款</option>
            <option value="claim">未完成核銷</option>
            <option value="teaching">鐘點費</option>
          </select>
        </label>
      </div>
      <div className="report-summary">
        <span>共{rows.length}筆（分攤不重複計數）</span>
        <span>合計 {money(rows.reduce((n, e) => n + e.amount, 0))}</span>
      </div>
      {notice && <p role="status">{notice}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日期／用途</th>
              <th>分攤項目</th>
              <th>金額</th>
              <th>代墊／付款／核銷</th>
              <th>憑證</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.occurrenceDate}
                  <p>{e.description}</p>
                  <small>
                    {e.teacherName &&
                      e.teacherName +
                        " · " +
                        ((e.quantity ?? 0) - (e.leaveQuantity ?? 0)) +
                        " " +
                        e.unit}
                  </small>
                </td>
                <td>
                  {e.allocations.map((a) => (
                    <p key={a.budgetItemId}>
                      {state.items.find((i) => i.id === a.budgetItemId)?.name}{" "}
                      <small>{money(a.amount)}</small>
                    </p>
                  ))}
                </td>
                <td>{money(e.amount)}</td>
                <td>
                  <StatusEditor
                    key={
                      e.id + e.paymentStatus + e.claimStatus + e.advanceStatus
                    }
                    value={e}
                    disabled={status !== "ready" || role === "viewer"}
                    save={(value) =>
                      dispatch({
                        type: "updateExpenseStatus",
                        id: e.id,
                        ...value,
                      })
                    }
                  />
                </td>
                <td>
                  {e.attachmentIds.map((id) => (
                    <button
                      key={id}
                      className="text"
                      disabled={
                        mode === "preview" &&
                        !state.attachments.find((a) => a.id === id)
                          ?.legacyDataUrl
                      }
                      onClick={() => void attachment(id)}
                    >
                      {state.attachments.find((a) => a.id === id)?.name}
                    </button>
                  ))}
                  {!e.attachmentIds.length && "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="empty">目前沒有符合條件的支出。</p>}
    </section>
  );
}
function StatusEditor({
  value,
  disabled,
  save,
}: {
  value: Expense;
  disabled: boolean;
  save: (
    v: Pick<
      Expense,
      "paymentStatus" | "claimStatus" | "advanceStatus" | "paymentDate"
    >,
  ) => Promise<boolean>;
}) {
  const [v, set] = useState({
    paymentStatus: value.paymentStatus,
    claimStatus: value.claimStatus,
    advanceStatus: value.advanceStatus,
    paymentDate: value.paymentDate,
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save(v);
      }}
    >
      <fieldset disabled={disabled}>
        {value.isAdvance && (
          <label>
            代墊：{value.advancePerson}
            <select
              aria-label={"歸墊狀態 " + value.description}
              value={v.advanceStatus}
              onChange={(e) =>
                set({
                  ...v,
                  advanceStatus: e.target.value as Expense["advanceStatus"],
                })
              }
            >
              <option value="pending">尚未歸墊</option>
              <option value="reimbursed">已歸墊</option>
            </select>
          </label>
        )}
        <label>
          付款
          <select
            value={v.paymentStatus}
            onChange={(e) =>
              set({
                ...v,
                paymentStatus: e.target.value as Expense["paymentStatus"],
                paymentDate:
                  e.target.value === "paid" ? v.paymentDate || today() : null,
              })
            }
          >
            <option value="unknown">待確認</option>
            <option value="unpaid">未付款</option>
            <option value="paid">已付款</option>
          </select>
        </label>
        {v.paymentStatus === "paid" && (
          <label>
            付款日期
            <input
              type="date"
              required
              value={v.paymentDate || ""}
              onChange={(e) =>
                set({ ...v, paymentDate: e.target.value || null })
              }
            />
          </label>
        )}
        <label>
          核銷
          <select
            value={v.claimStatus}
            onChange={(e) =>
              set({
                ...v,
                claimStatus: e.target.value as Expense["claimStatus"],
              })
            }
          >
            <option value="unknown">待確認</option>
            <option value="draft">待整理</option>
            <option value="submitted">已送核</option>
            <option value="approved">已核准</option>
            <option value="closed">已完成</option>
          </select>
        </label>
        <button className="secondary">儲存狀態</button>
      </fieldset>
    </form>
  );
}
