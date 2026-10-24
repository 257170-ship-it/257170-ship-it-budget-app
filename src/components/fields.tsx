import type { Dispatch, SetStateAction } from "react";
import { moneyInput, parseMoney, type Rule } from "../types";
export function Amount({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        inputMode="decimal"
        type="number"
        step="0.01"
        min="0"
        value={moneyInput(value)}
        disabled={disabled}
        onChange={(e) => {
          try {
            onChange(parseMoney(e.target.value));
            e.target.setCustomValidity("");
          } catch (err) {
            e.target.setCustomValidity(String(err));
            e.target.reportValidity();
          }
        }}
      />
    </label>
  );
}
export function Rules({
  value,
  onChange,
  disabled,
}: {
  value: Rule[];
  onChange: (rules: Rule[]) => void;
  disabled: boolean;
}) {
  return (
    <div className="rule-editor">
      <h3>項目規則與確認</h3>
      {value.map((r, index) => (
        <div className="rule" key={r.id}>
          <input
            aria-label={"規則名稱 " + (index + 1)}
            value={r.name}
            disabled={disabled}
            onChange={(e) =>
              onChange(
                value.map((x, n) =>
                  n === index ? { ...x, name: e.target.value } : x,
                ),
              )
            }
          />
          <div className="two">
            <label>
              規則類型
              <select
                value={r.kind}
                disabled={disabled}
                onChange={(e) =>
                  onChange(
                    value.map((x, n) =>
                      n === index
                        ? { ...x, kind: e.target.value as Rule["kind"] }
                        : x,
                    ),
                  )
                }
              >
                <option value="ratio">占計畫核定額百分比</option>
                <option value="noTransfer">禁止流用</option>
                <option value="unitPrice">單價上限</option>
              </select>
            </label>
            {r.kind === "unitPrice" ? (
              <Amount
                label="規則單價上限（元）"
                value={r.value}
                disabled={disabled}
                onChange={(amount) =>
                  onChange(
                    value.map((x, n) =>
                      n === index ? { ...x, value: amount ?? 0 } : x,
                    ),
                  )
                }
              />
            ) : r.kind === "ratio" ? (
              <label>
                比例（%）
                <input
                  type="number"
                  min="0"
                  max="100"
                  step=".01"
                  value={r.value}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange(
                      value.map((x, n) =>
                        n === index
                          ? { ...x, value: Number(e.target.value) }
                          : x,
                      ),
                    )
                  }
                />
              </label>
            ) : (
              <p className="hint">已確認的禁止流用規則會阻擋流用。</p>
            )}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={r.confirmed}
              disabled={disabled}
              onChange={(e) =>
                onChange(
                  value.map((x, n) =>
                    n === index ? { ...x, confirmed: e.target.checked } : x,
                  ),
                )
              }
            />
            管理者已核對適用版本與計算基礎
          </label>
          <label>
            確認後處理
            <select
              disabled={disabled}
              value={r.effect}
              onChange={(e) =>
                onChange(
                  value.map((x, n) =>
                    n === index
                      ? { ...x, effect: e.target.value as Rule["effect"] }
                      : x,
                  ),
                )
              }
            >
              <option value="warning">提示</option>
              <option value="block">阻擋</option>
            </select>
          </label>
          <small>
            {r.source.document} · {r.source.location} · {r.source.note}
          </small>
          <button
            type="button"
            className="text"
            disabled={disabled}
            onClick={() => onChange(value.filter((_, n) => n !== index))}
          >
            移除此規則
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...value,
            {
              id: crypto.randomUUID(),
              name: "新規則",
              kind: "ratio",
              value: 0,
              confirmed: false,
              effect: "warning",
              source: {
                document: "人工設定",
                location: "",
                note: "需管理者核對",
              },
            },
          ])
        }
      >
        ＋新增規則
      </button>
    </div>
  );
}
export function setField<T>(
  set: Dispatch<SetStateAction<T>>,
  key: keyof T,
  value: T[keyof T],
) {
  set((old) => ({ ...old, [key]: value }));
}
