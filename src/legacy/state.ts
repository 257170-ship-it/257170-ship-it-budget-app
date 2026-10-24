import {
  type AppState,
  type Project,
  type Expense,
  emptyLimits,
  expenseTypes,
} from "./types";
export type Action =
  | { type: "ADD_PROJECT" | "UPDATE_PROJECT"; payload: Project }
  | { type: "DELETE_PROJECT" | "DELETE_EXPENSE"; payload: string }
  | { type: "ADD_EXPENSE" | "UPDATE_EXPENSE"; payload: Expense };
export const initialState: AppState = { projects: [], expenses: [] };
export function recalculate(state: AppState): AppState {
  return {
    ...state,
    projects: state.projects.map((p) => {
      const used = emptyLimits();
      state.expenses
        .filter((e) => e.projectId === p.id)
        .forEach((e) => {
          used[e.type] = Math.round((used[e.type] + e.amount) * 100) / 100;
        });
      return { ...p, used };
    }),
  };
}
const finite = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= 0;
const date = (x: unknown): x is string =>
  typeof x === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  !isNaN(Date.parse(x)) &&
  new Date(x).toISOString().slice(0, 10) === x;
export function validateState(value: unknown): AppState {
  const s = value as AppState;
  if (!s || !Array.isArray(s.projects) || !Array.isArray(s.expenses))
    throw new Error("雲端資料格式錯誤，已停止寫入。");
  const ids = new Set<string>();
  for (const p of s.projects) {
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      ids.has(p.id) ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      typeof p.summary !== "string" ||
      !finite(p.totalBudget) ||
      !date(p.startDate) ||
      !date(p.endDate) ||
      p.startDate > p.endDate ||
      !p.limits ||
      !expenseTypes.every((t) => finite(p.limits[t]))
    )
      throw new Error("計畫資料不完整，已停止寫入。");
    ids.add(p.id);
  }
  const expenseIds = new Set<string>();
  for (const e of s.expenses) {
    if (
      !e ||
      typeof e.id !== "string" ||
      !e.id ||
      expenseIds.has(e.id) ||
      !ids.has(e.projectId) ||
      !expenseTypes.includes(e.type) ||
      !finite(e.amount) ||
      !date(e.date) ||
      typeof e.description !== "string" ||
      typeof e.isAdvance !== "boolean" ||
      (e.isAdvance &&
        (!e.advancePerson?.trim() ||
          !["pending", "paid", "reimbursed"].includes(
            e.advanceStatus ?? "pending",
          ))) ||
      !Array.isArray(e.photos) ||
      !e.photos.every(
        (p) =>
          typeof p === "string" &&
          /^data:image\/(jpeg|png|webp);base64,/.test(p),
      )
    )
      throw new Error("支出資料不完整，已停止寫入。");
    expenseIds.add(e.id);
  }
  return recalculate(s);
}
export function reducer(state: AppState, action: Action): AppState {
  let next: AppState;
  switch (action.type) {
    case "ADD_PROJECT":
      next = { ...state, projects: [...state.projects, action.payload] };
      break;
    case "UPDATE_PROJECT":
      next = {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.payload.id ? action.payload : p,
        ),
      };
      break;
    case "DELETE_PROJECT":
      next = {
        projects: state.projects.filter((p) => p.id !== action.payload),
        expenses: state.expenses.filter((e) => e.projectId !== action.payload),
      };
      break;
    case "ADD_EXPENSE":
      next = { ...state, expenses: [...state.expenses, action.payload] };
      break;
    case "UPDATE_EXPENSE":
      next = {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === action.payload.id ? action.payload : e,
        ),
      };
      break;
    case "DELETE_EXPENSE":
      next = {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== action.payload),
      };
      break;
  }
  const valid = validateState(next);
  if (action.type === "ADD_EXPENSE" || action.type === "UPDATE_EXPENSE") {
    const e = action.payload;
    const p = valid.projects.find((p) => p.id === e.projectId)!;
    if (e.date < p.startDate || e.date > p.endDate)
      throw new Error("支出日期必須在計畫期間內。");
    if (!e.description.trim() || e.amount <= 0)
      throw new Error("請填寫用途及有效金額。");
    if (
      Object.values(p.used).reduce((a, b) => a + b, 0) > p.totalBudget ||
      p.used[e.type] > p.limits[e.type]
    )
      throw new Error("支出超出計畫總經費或細項上限。");
    if (
      e.type === "hourly" &&
      (!e.teacherName?.trim() ||
        e.amount !== calculateHourly(e.hours!, e.leaveHours!, e.hourlyRate!) ||
        e.actualHours !== e.hours! - e.leaveHours!)
    )
      throw new Error("鐘點費資料或計算不正確。");
  }
  if (action.type === "UPDATE_PROJECT") {
    const p = valid.projects.find((p) => p.id === action.payload.id)!;
    if (
      Object.values(p.used).reduce((a, b) => a + b, 0) > p.totalBudget ||
      expenseTypes.some((t) => p.used[t] > p.limits[t])
    )
      throw new Error("新預算不可低於已支用金額。");
    if (
      valid.expenses.some(
        (e) =>
          e.projectId === p.id && (e.date < p.startDate || e.date > p.endDate),
      )
    )
      throw new Error("計畫期間必須涵蓋已登錄支出。");
  }
  return valid;
}
export function calculateHourly(hours: number, leave: number, rate: number) {
  if (![hours, leave, rate].every(finite) || leave > hours)
    throw new Error("請假時數不可超過原定時數，金額與時數必須為非負數。");
  return Math.round((hours - leave) * rate * 100) / 100;
}
