import { useMemo, useState } from "react";
import { getTemplates, instantiateTemplate } from "../domain/templates";
import { useBudget } from "../context/BudgetContext";
import { money } from "../types";
import { calculatedAmount } from "../domain/core";
export default function Templates({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const templates = useMemo(getTemplates, []),
    [id, setId] = useState(templates[0].projects[0].id),
    [notice, setNotice] = useState(""),
    { dispatch, status, role } = useBudget();
  const t = templates.find((t) => t.projects[0].id === id)!,
    p = t.projects[0];
  return (
    <section className="panel">
      <p className="eyebrow">SOURCE DRAFTS</p>
      <h2>九案草稿範本與匯入預覽</h2>
      <p className="notice">
        以下均為文件申請／概算，核定額保持空白。確認加入只建立草稿，沒有任何支出；正式核定需另外填寫。
      </p>
      <label>
        選擇來源範本
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {templates.map((t) => (
            <option value={t.projects[0].id} key={t.projects[0].id}>
              {t.projects[0].name}
            </option>
          ))}
        </select>
      </label>
      <div className="report-summary">
        <span>
          {p.year}
          {p.yearType === "academic" ? "學年度" : "年度"}
        </span>
        <span>來源金額 {money(p.sourceAmount)}</span>
        <span>核定：待核定</span>
        <span>{t.items.length}筆預算項目</span>
      </div>
      <p>
        {p.source.document} · {p.source.location}
      </p>
      {p.issues.length > 0 && (
        <div className="notice warning">
          <strong>來源待確認事項</strong>
          <ul>
            {p.issues.map((x, n) => (
              <li key={n}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {t.subprojects.length > 0 && (
        <p>
          子計畫：
          {t.subprojects
            .map(
              (s) => s.name + " " + s.className + " " + money(s.sourceAmount),
            )
            .join("／")}
          （小計不重複加入主計畫）
        </p>
      )}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>原始項目／列</th>
              <th>單價</th>
              <th>數量／單位</th>
              <th>原表申請金額</th>
              <th>計算值</th>
              <th>核定</th>
            </tr>
          </thead>
          <tbody>
            {t.items.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.originalName}
                  <small>第{i.sourceRow}列</small>
                  {i.details.length > 0 && (
                    <details>
                      <summary>採購明細{i.details.length}筆</summary>
                      {i.details.map((d) => (
                        <p key={d.id}>
                          {d.name} · {money(d.unitPrice)}×{d.quantity}
                          {d.unit}＝{money(d.sourceAmount)}
                        </p>
                      ))}
                    </details>
                  )}
                </td>
                <td>{money(i.unitPrice)}</td>
                <td>
                  {i.quantity ?? "—"} {i.unit}
                </td>
                <td>{money(i.sourceAmount)}</td>
                <td>{money(calculatedAmount(i, t.items))}</td>
                <td>待核定</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <button
          disabled={status !== "ready" || !["editor", "admin"].includes(role)}
          onClick={async () => {
            const draft = instantiateTemplate(t, crypto.randomUUID());
            if (await dispatch({ type: "importDraft", value: draft })) {
              onSelect(draft.projects[0].id);
              setNotice("已加入待確認草稿；核定與支出均未自動建立。");
            }
          }}
        >
          確認加入此草稿（不入帳）
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
