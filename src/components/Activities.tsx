import { useState } from "react";
import { useBudget } from "../context/BudgetContext";
import { today, money, type TeachingRecord } from "../types";
import { Amount } from "./fields";
export default function Activities({ projectId }: { projectId: string }) {
  const { state, dispatch, status, role } = useBudget(),
    [name, setName] = useState(""),
    [date, setDate] = useState(today()),
    [start, setStart] = useState("09:00"),
    [end, setEnd] = useState("12:00"),
    [itemId, setItemId] = useState(""),
    [teacher, setTeacher] = useState(""),
    [quantity, setQuantity] = useState(1),
    [leave, setLeave] = useState(0),
    [price, setPrice] = useState<number | null>(null),
    [unit, setUnit] = useState(""),
    [activity, setActivity] = useState(""),
    [weeks, setWeeks] = useState(1),
    [excluded, setExcluded] = useState(""),
    [preview, setPreview] = useState<TeachingRecord[]>([]),
    [notice, setNotice] = useState("");
  const items = state.items.filter(
      (i) =>
        i.projectId === projectId &&
        i.calculation === "teaching" &&
        !i.inactive,
    ),
    item = items.find((i) => i.id === itemId) || items[0],
    busy = status !== "ready" || role === "viewer";
  function make() {
    if (!item || !teacher.trim() || (!price && item.unitPrice === null)) {
      setNotice("請填寫教師與單價");
      return;
    }
    const skip = new Set(excluded.split(/[\s,，]+/).filter(Boolean)),
      rows: TeachingRecord[] = [];
    for (let n = 0; n < Math.min(weeks, 52); n++) {
      const d = new Date(date + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() + 7 * n);
      const when = d.toISOString().slice(0, 10);
      if (!skip.has(when))
        rows.push({
          id: crypto.randomUUID(),
          projectId,
          budgetItemId: item.id,
          activityId: n === 0 ? activity || null : null,
          date: when,
          teacherName: teacher,
          unit: unit || item.unit,
          quantity,
          leaveQuantity: leave,
          unitPrice: price ?? item.unitPrice ?? 0,
          status: "planned",
          expenseId: null,
        });
    }
    setPreview(rows);
    setNotice("課表預覽不產生支出；建立後標記實上，再逐筆結算。");
  }
  return (
    <>
      <section className="panel">
        <h2>活動／場次</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await dispatch({
                type: "saveActivity",
                value: {
                  id: crypto.randomUUID(),
                  projectId,
                  name,
                  date,
                  startTime: start,
                  endTime: end,
                },
              })
            )
              setName("");
          }}
        >
          <fieldset
            disabled={busy || !projectId || !["editor", "admin"].includes(role)}
          >
            <div className="two">
              <label>
                活動名稱
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                活動日期
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                開始時刻
                <input
                  type="time"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                結束時刻
                <input
                  type="time"
                  required
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            <button>新增活動</button>
          </fieldset>
        </form>
        {state.activities
          .filter((a) => a.projectId === projectId)
          .map((a) => (
            <p key={a.id}>
              {a.date} {a.startTime}–{a.endTime} {a.name}
            </p>
          ))}
      </section>
      <section className="panel">
        <h2>每週課表預覽與結算</h2>
        <p className="hint">
          計費節數與起訖時刻分開，請假全額扣除；排定課表不列入已支用。一次最多52週。
        </p>
        <fieldset disabled={busy || !projectId}>
          <div className="two">
            <label>
              鐘點預算項目
              <select
                value={item?.id ?? ""}
                onChange={(e) => {
                  setItemId(e.target.value);
                  setUnit("");
                  setPrice(null);
                  setPreview([]);
                }}
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}（{i.unit}）
                  </option>
                ))}
              </select>
            </label>
            <label>
              教師
              <input
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
              />
            </label>
            <label>
              首堂日期
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              每週一次，週數
              <input
                type="number"
                min="1"
                max="52"
                value={weeks}
                onChange={(e) => setWeeks(Number(e.target.value))}
              />
            </label>
            <label>
              計費單位
              <input
                value={unit || item?.unit || ""}
                onChange={(e) => setUnit(e.target.value)}
              />
            </label>
            <label>
              每堂原定數量
              <input
                type="number"
                min=".01"
                step=".01"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <label>
              每堂請假數量
              <input
                type="number"
                min="0"
                step=".01"
                value={leave}
                onChange={(e) => setLeave(Number(e.target.value))}
              />
            </label>
            <Amount
              label="課表單價"
              value={price ?? item?.unitPrice ?? null}
              onChange={setPrice}
            />
            <label>
              首堂關聯活動
              <select
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
              >
                <option value="">無</option>
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
          <label>
            排除日期（逗號或換行分隔）
            <textarea
              value={excluded}
              onChange={(e) => setExcluded(e.target.value)}
              placeholder="2026-12-30"
            />
          </label>
          <button className="secondary" onClick={make}>
            產生課表預覽
          </button>
          {preview.length > 0 && (
            <>
              <p>
                {preview.length}堂：{preview.map((t) => t.date).join("、")}
              </p>
              <button
                onClick={async () => {
                  if (
                    await dispatch({
                      type: "saveTeachingBatch",
                      values: preview,
                    })
                  ) {
                    setPreview([]);
                    setNotice("課表已建立，尚未產生支出。");
                  }
                }}
              >
                確認建立課表（不入帳）
              </button>
            </>
          )}
        </fieldset>
        {notice && <p role="status">{notice}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日期／教師</th>
                <th>數量／單位</th>
                <th>費率／請假</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {state.teachingRecords
                .filter((t) => t.projectId === projectId)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.date}
                      <small>{t.teacherName}</small>
                    </td>
                    <td>
                      {t.quantity} {t.unit}
                    </td>
                    <td>
                      {money(t.unitPrice)}
                      <TeachingEdit
                        key={t.id + ":" + t.leaveQuantity + ":" + t.status}
                        record={t}
                        disabled={busy || t.status === "settled"}
                      />
                      <small>
                        請假{t.leaveQuantity} {t.unit}
                      </small>
                    </td>
                    <td>
                      {
                        {
                          planned: "預定",
                          taught: "實上",
                          cancelled: "停課",
                          settled: "已結算",
                        }[t.status]
                      }
                    </td>
                    <td>
                      <div className="compact-actions">
                        <button
                          className="text"
                          disabled={busy || t.status === "settled"}
                          onClick={() =>
                            void dispatch({
                              type: "saveTeaching",
                              value: { ...t, status: "taught" },
                            })
                          }
                        >
                          標記實上
                        </button>
                        <button
                          className="text"
                          disabled={busy || t.status === "settled"}
                          onClick={() =>
                            void dispatch({
                              type: "saveTeaching",
                              value: { ...t, status: "cancelled" },
                            })
                          }
                        >
                          停課
                        </button>
                        <button
                          disabled={busy || t.status !== "taught"}
                          onClick={() =>
                            void dispatch({
                              type: "settleTeaching",
                              id: t.id,
                              expenseId: "teaching-" + t.id,
                            })
                          }
                        >
                          結算入帳
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function TeachingEdit({
  record,
  disabled,
}: {
  record: TeachingRecord;
  disabled: boolean;
}) {
  const { dispatch } = useBudget(),
    [t, set] = useState(record);
  return (
    <details>
      <summary>修改請假／補課資料</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await dispatch({ type: "saveTeaching", value: t });
        }}
      >
        <fieldset disabled={disabled}>
          <label>
            課程日期
            <input
              type="date"
              required
              value={t.date}
              onChange={(e) => set({ ...t, date: e.target.value })}
            />
          </label>
          <label>
            原定數量
            <input
              type="number"
              min=".01"
              step=".01"
              required
              value={t.quantity}
              onChange={(e) => set({ ...t, quantity: Number(e.target.value) })}
            />
          </label>
          <label>
            請假數量
            <input
              type="number"
              min="0"
              max={t.quantity}
              step=".01"
              required
              value={t.leaveQuantity}
              onChange={(e) =>
                set({ ...t, leaveQuantity: Number(e.target.value) })
              }
            />
          </label>
          <button className="secondary">儲存課程變更</button>
        </fieldset>
      </form>
    </details>
  );
}
