export type ExpenseType = "hourly" | "meal" | "tea" | "material" | "other";
export interface ProjectLimits {
  hourly: number;
  meal: number;
  tea: number;
  material: number;
  other: number;
}
export interface Project {
  id: string;
  name: string;
  summary: string;
  totalBudget: number;
  limits: ProjectLimits;
  startDate: string;
  endDate: string;
  used: ProjectLimits;
}
export interface Expense {
  id: string;
  projectId: string;
  type: ExpenseType;
  amount: number;
  date: string;
  description: string;
  isAdvance: boolean;
  advancePerson?: string;
  advanceStatus?: "paid" | "pending" | "reimbursed";
  photos: string[];
  teacherName?: string;
  classDate?: string;
  hours?: number;
  leaveHours?: number;
  actualHours?: number;
  hourlyRate?: number;
}
export interface AppState {
  projects: Project[];
  expenses: Expense[];
}
export const emptyLimits = (): ProjectLimits => ({
  hourly: 0,
  meal: 0,
  tea: 0,
  material: 0,
  other: 0,
});
export const typeLabels: Record<ExpenseType, string> = {
  hourly: "鐘點費",
  meal: "膳費",
  tea: "茶水費",
  material: "教材教具費",
  other: "其他",
};
export const expenseTypes = Object.keys(typeLabels) as ExpenseType[];
export const money = (value: number) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 2,
  }).format(value);
export const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};
