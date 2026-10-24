import { useEffect, useState } from "react";
import { useBudget } from "../context/BudgetContext";
import { money, today, type Expense } from "../types";
import {
  cap,
  calculateTeaching,
  itemSpent,
  projectSpent,
} from "../domain/core";
import { Amount } from "./fields";
export default function ExpenseForm({ projectId }: { projectId: string }) {
  const { state, dispatch, status, role, mode, upload } = useBudget();
  const items = state.items.filter(
      (i) => i.projectId === projectId && !i.inactive,
    ),
    project = state.projects.find((p) => p.id === projectId);
  const [itemId, setItemId] = useState(""),
    [date, setDate] = useState(today()),
    [paymentDate, setPaymentDate] = useState(""),
    [amount, setAmount] = useState<number | null>(null),
    [price, setPrice] = useState<number | null>(null),
    [quantity, setQuantity] = useState(1),
    [leave, setLeave] = useState(0),
    [unit, setUnit] = useState(""),
    [description, setDescription] = useState(""),
    [payee, setPayee] = useState(""),
    [teacher, setTeacher] = useState(""),
    [advance, setAdvance] = useState(false),
    [person, setPerson] = useState(""),
    [paid, setPaid] = useState(false),
    [voucher, setVoucher] = useState(""),
    [activity, setActivity] = useState(""),
    [attachmentIds, setAttachmentIds] = useState<string[]>([]),
    [allocations, setAllocations] = useState<
      { id: string; amount: number | null }[]
    >([]),
    [notice, setNotice] = useState("");
  const item = items.find((i) => i.id === itemId) || items[0];
  useEffect(() => {
    setItemId("");
    setAllocations([]);
    setAttachmentIds([]);
    setActivity("");
  }, [projectId]);
  useEffect(() => {
    if (item) {
      setPrice(item.unitPrice);
      setUnit(item.unit);
      setQuantity(1);
      setLeave(0);
      setAmount(null);
    }
  }, [item?.id]);
  let computed = amount ?? 0,
    calculationError = "";
  try {
    if (item?.calculation === "teaching")
      computed = calculateTeaching(
        quantity,
        leave,
        price ?? 0,
        unit,
        item.unit,
      );
    else if (item?.calculation === "quantity")
      computed = Math.round(quantity * (price ?? 0));
  } catch (e) {
    calculationError = e instanceof Error ? e.message : "計算錯誤";
  }
  const unknown =
    !project ||
    cap(project) === null ||
    project.status === "draft" ||
    !item ||
    cap(item) === null;
  const busy = status !== "ready" || role === "viewer";
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !item) return;
    setNotice("");
    const extra = allocations.map((a) => ({
        budgetItemId: a.id,
        fundingSource: "",
        amount: a.amount ?? 0,
      })),
      mainAmount = computed - extra.reduce((n, a) => n + a.amount, 0);
    const value: Expense = {
      id: crypto.randomUUID(),
      projectId,
      activityId: activity || null,
      occurrenceDate: date,
      paymentDate: paid ? paymentDate || today() : null,
      createdAt: new Date().toISOString(),
      description,
      payee,
      amount: computed,
      allocations: [
        { budgetItemId: item.id, fundingSource: "", amount: mainAmount },
        ...extra,
      ],
      paymentStatus: paid ? "paid" : "unpaid",
      claimStatus: "draft",
      isAdvance: advance,
      advancePerson: advance ? person : "",
      advanceStatus: "pending",
      attachmentIds,
      teacherName: teacher,
      unit,
      quantity:
        item.calculation === "direct" || item.calculation === "percent"
          ? null
          : quantity,
      leaveQuantity: item.calculation === "teaching" ? leave : null,
      unitPrice:
        item.calculation === "direct" || item.calculation === "percent"
          ? null
          : price,
      teachingRecordId: null,
      voucherNumber: voucher,
    };
    if (await dispatch({ type: "saveExpense", value })) {
      setDescription("");
      setAttachmentIds([]);
      setAllocations([]);
      setNotice(
        mode === "preview"
          ? "已加入工作階段草稿，尚未寫入雲端。"
          : "支出已儲存並驗證。",
      );
    }
  }
  return (
    <div className="split">
      <section className="panel">
        <p className="eyebrow">EXPENSE ENTRY</p>
        <h2>支出登錄</h2>
        {!project && <p className="notice">請先選擇或建立計畫。</p>}
        {unknown && (
          <p className="notice warning">
            計畫或項目尚未核定，請先核對核定資料；目前不可入帳。
          </p>
        )}
        <form onSubmit={submit}>
          <fieldset disabled={busy || !project}>
            <label>
              預算明細
              <select
                value={item?.id ?? ""}
                onChange={(e) => setItemId(e.target.value)}
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}（列{i.sourceRow || i.order + 1} · {i.unit}）
                    {cap(i) === null ? " — 待核定" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="two">
              <label>
                支出發生日期
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                活動／場次
                <select
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                >
                  <option value="">不指定</option>
                  {state.activities
                    .filter((a) => a.projectId === projectId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.date} {a.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {item && ["teaching", "quantity"].includes(item.calculation) ? (
              <>
                <div className="three">
                  <label>
                    計費單位
                    <input
                      required
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    />
                  </label>
                  <label>
                    實際原定數量
                    <input
                      type="number"
                      required
                      min=".01"
                      step=".01"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                    />
                  </label>
                  <Amount label="本筆單價" value={price} onChange={setPrice} />
                </div>
                {item.calculation === "teaching" && (
                  <div className="two">
                    <label>
                      教師姓名
                      <input
                        required
                        value={teacher}
                        onChange={(e) => setTeacher(e.target.value)}
                      />
                    </label>
                    <label>
                      請假數量（同計費單位）
                      <input
                        type="number"
                        min="0"
                        max={quantity}
                        step=".01"
                        required
                        value={leave}
                        onChange={(e) => setLeave(Number(e.target.value))}
                      />
                    </label>
                  </div>
                )}
                <p className="formula">
                  {quantity} {unit}
                  {item.calculation === "teaching"
                    ? " − 請假 " + leave + " " + unit
                    : ""}{" "}
                  × {money(price)} = <strong>{money(computed)}</strong>
                </p>
              </>
            ) : (
              <Amount
                label="本筆支出總額"
                value={amount}
                onChange={setAmount}
              />
            )}
            {calculationError && <p role="alert">{calculationError}</p>}
            <label>
              用途說明
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
              />
            </label>
            <div className="two">
              <label>
                受款人／廠商
                <input
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                />
              </label>
              <label>
                憑證號碼
                <input
                  value={voucher}
                  onChange={(e) => setVoucher(e.target.value)}
                />
              </label>
            </div>
            {item?.calculation === "direct" && (
              <details>
                <summary>同一憑證分攤其他預算項目（總額只計一次）</summary>
                {allocations.map((a, n) => (
                  <div className="two" key={n}>
                    <label>
                      分攤項目
                      <select
                        required
                        value={a.id}
                        onChange={(e) =>
                          setAllocations(
                            allocations.map((x, k) =>
                              k === n ? { ...x, id: e.target.value } : x,
                            ),
                          )
                        }
                      >
                        <option value="">選擇</option>
                        {items
                          .filter((i) => i.id !== item.id)
                          .map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}（{i.sourceRow}）
                            </option>
                          ))}
                      </select>
                    </label>
                    <Amount
                      label={"分攤金額 " + (n + 1)}
                      value={a.amount}
                      onChange={(v) =>
                        setAllocations(
                          allocations.map((x, k) =>
                            k === n ? { ...x, amount: v } : x,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="text"
                      onClick={() =>
                        setAllocations(allocations.filter((_, k) => k !== n))
                      }
                    >
                      移除
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setAllocations([...allocations, { id: "", amount: null }])
                  }
                >
                  新增分攤列
                </button>
                <p>
                  主要項目分攤額：
                  {money(
                    computed -
                      allocations.reduce((n, a) => n + (a.amount ?? 0), 0),
                  )}
                </p>
              </details>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={advance}
                onChange={(e) => setAdvance(e.target.checked)}
              />
              個人代墊
            </label>
            {advance && (
              <label>
                代墊人
                <input
                  required
                  value={person}
                  onChange={(e) => setPerson(e.target.value)}
                />
              </label>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={paid}
                onChange={(e) => setPaid(e.target.checked)}
              />
              已付款（與代墊、核銷狀態分開）
            </label>
            {paid && (
              <label>
                付款日期
                <input
                  required
                  type="date"
                  value={paymentDate || today()}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </label>
            )}
            <details>
              <summary>關聯已上傳憑證</summary>
              {state.attachments
                .filter((a) => a.projectId === projectId)
                .map((a) => (
                  <label className="check" key={a.id}>
                    <input
                      type="checkbox"
                      checked={attachmentIds.includes(a.id)}
                      onChange={(e) =>
                        setAttachmentIds(
                          e.target.checked
                            ? [...attachmentIds, a.id]
                            : attachmentIds.filter((id) => id !== a.id),
                        )
                      }
                    />
                    {a.name}
                  </label>
                ))}
            </details>
            <button disabled={unknown || !!calculationError || computed <= 0}>
              儲存支出 {money(computed)}
            </button>
          </fieldset>
        </form>
        {notice && <p role="status">{notice}</p>}
      </section>
      <aside>
        <section className="panel">
          <h2>即時預算檢查</h2>
          <p>{project?.name}</p>
          <div className="metric">
            <small>計畫可用</small>
            <strong>
              {project && cap(project) !== null
                ? money(cap(project)! - projectSpent(state, projectId))
                : "待核定"}
            </strong>
          </div>
          <div className="metric">
            <small>{item?.name || "項目"}可用</small>
            <strong>
              {item && cap(item) !== null
                ? money(cap(item)! - itemSpent(state, item.id))
                : "待核定"}
            </strong>
          </div>
          <p className="hint">
            只檢查本計畫的項目／群組。請假全額扣除，節與小時不互換。未確認規則提供提示，已確認阻擋規則由後端再驗證。
          </p>
        </section>
        <section className="panel">
          <h2>上傳憑證原件</h2>
          <p className="hint">
            安全帳本將原件存至私有Drive資料夾，試算表只存檔案ID。預覽模式不會上傳。
          </p>
          <input
            aria-label="上傳憑證原件"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={mode === "preview" || busy || !project}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f)
                try {
                  await upload(projectId, f, "receipt");
                  setNotice("附件已上傳，請勾選關聯憑證。");
                } catch (err) {
                  setNotice(err instanceof Error ? err.message : "上傳失敗");
                }
            }}
          />
        </section>
      </aside>
    </div>
  );
}
