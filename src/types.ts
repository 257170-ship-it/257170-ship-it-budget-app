export type Money = number; // integer cents, TWD
export type Role = "viewer" | "entry" | "editor" | "admin";
export interface Source {
  document: string;
  location: string;
  note: string;
}
export interface Project {
  id: string;
  name: string;
  summary: string;
  year: number | null;
  yearType: "calendar" | "academic";
  startDate: string | null;
  endDate: string | null;
  reportDeadline: string | null;
  sourceAmount: Money | null;
  approvedAmount: Money | null;
  adjustedAmount: Money | null;
  legacyRecordedBudget?: Money;
  subsidy: Money | null;
  selfFunding: Money | null;
  status: "draft" | "approved" | "active" | "closing" | "closed";
  source: Source;
  issues: string[];
  templateId?: string;
}
export interface Subproject {
  id: string;
  projectId: string;
  name: string;
  className: string;
  order: number;
  sourceAmount: Money | null;
}
export interface Rule {
  id: string;
  name: string;
  confirmed: boolean;
  effect: "warning" | "block";
  kind: "ratio" | "noTransfer" | "unitPrice";
  value: number;
  source: Source;
}
export interface BudgetGroup {
  id: string;
  projectId: string;
  subprojectId: string | null;
  name: string;
  sourceAmount: Money | null;
  approvedAmount: Money | null;
  adjustedAmount: Money | null;
  rules: Rule[];
}
export type Calculation = "direct" | "quantity" | "teaching" | "percent";
export interface PurchaseDetail {
  id: string;
  name: string;
  unit: string;
  unitPrice: Money;
  quantity: number;
  sourceAmount: Money;
}
export interface BudgetItem {
  id: string;
  projectId: string;
  groupId: string | null;
  subprojectId: string | null;
  name: string;
  originalName: string;
  sourceRow: string;
  category: string;
  order: number;
  inactive: boolean;
  unit: string;
  unitPrice: Money | null;
  quantity: number | null;
  sourceAmount: Money | null;
  approvedAmount: Money | null;
  adjustedAmount: Money | null;
  maxUnitPrice: Money | null;
  calculation: Calculation;
  percent: number | null;
  baseItemIds: string[];
  rounding: "round" | "ceil" | "floor";
  transferPolicy: "review" | "locked" | "allowed";
  source: Source;
  rules: Rule[];
  details: PurchaseDetail[];
}
export interface Allocation {
  budgetItemId: string;
  fundingSource: string;
  amount: Money;
}
export interface Expense {
  id: string;
  projectId: string;
  activityId: string | null;
  occurrenceDate: string;
  paymentDate: string | null;
  createdAt: string;
  description: string;
  payee: string;
  amount: Money;
  allocations: Allocation[];
  paymentStatus: "unknown" | "unpaid" | "paid";
  claimStatus: "unknown" | "draft" | "submitted" | "approved" | "closed";
  isAdvance: boolean;
  advancePerson: string;
  advanceStatus: "pending" | "reimbursed";
  attachmentIds: string[];
  teacherName: string;
  unit: string;
  quantity: number | null;
  leaveQuantity: number | null;
  unitPrice: Money | null;
  teachingRecordId: string | null;
  voucherNumber: string;
  legacy?: unknown;
}
export interface Attachment {
  id: string;
  projectId: string;
  fileId: string | null;
  name: string;
  mimeType: string;
  kind: "receipt" | "source" | "activity";
  createdAt: string;
  uploadedBy: string;
  legacyDataUrl?: string;
}
export interface Activity {
  id: string;
  projectId: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
}
export interface TeachingRecord {
  id: string;
  projectId: string;
  budgetItemId: string;
  activityId: string | null;
  date: string;
  teacherName: string;
  unit: string;
  quantity: number;
  leaveQuantity: number;
  unitPrice: Money;
  status: "planned" | "taught" | "cancelled" | "settled";
  expenseId: string | null;
}
export interface Revision {
  id: string;
  projectId: string;
  at: string;
  actor: string;
  reason: string;
  before: unknown;
  after: unknown;
}
export interface AppState {
  schemaVersion: 2;
  projects: Project[];
  subprojects: Subproject[];
  groups: BudgetGroup[];
  items: BudgetItem[];
  expenses: Expense[];
  attachments: Attachment[];
  activities: Activity[];
  teachingRecords: TeachingRecord[];
  revisions: Revision[];
}
export interface Envelope {
  schemaVersion: 2;
  revision: number;
  state: AppState;
  user: { email: string; role: Role };
  environment: "test" | "production";
}
export type Command =
  | { type: "saveProject"; value: Project; reason: string }
  | { type: "saveSubproject"; value: Subproject }
  | { type: "saveGroup"; value: BudgetGroup; reason: string }
  | { type: "saveItem"; value: BudgetItem; reason: string }
  | { type: "removeItem"; id: string }
  | { type: "reorderItems"; projectId: string; ids: string[] }
  | { type: "saveExpense"; value: Expense }
  | {
      type: "updateExpenseStatus";
      id: string;
      paymentStatus: Expense["paymentStatus"];
      claimStatus: Expense["claimStatus"];
      advanceStatus: Expense["advanceStatus"];
      paymentDate: string | null;
    }
  | { type: "addAttachment"; value: Attachment }
  | { type: "saveActivity"; value: Activity }
  | { type: "saveTeaching"; value: TeachingRecord }
  | { type: "saveTeachingBatch"; values: TeachingRecord[] }
  | { type: "settleTeaching"; id: string; expenseId: string }
  | {
      type: "transferBudget";
      fromId: string;
      toId: string;
      amount: Money;
      reason: string;
    }
  | { type: "importDraft"; value: AppState };
export const emptyState = (): AppState => ({
  schemaVersion: 2,
  projects: [],
  subprojects: [],
  groups: [],
  items: [],
  expenses: [],
  attachments: [],
  activities: [],
  teachingRecords: [],
  revisions: [],
});
export const blankSource = (): Source => ({
  document: "",
  location: "",
  note: "",
});
export const blankProject = (id: string): Project => ({
  id,
  name: "",
  summary: "",
  year: null,
  yearType: "academic",
  startDate: null,
  endDate: null,
  reportDeadline: null,
  sourceAmount: null,
  approvedAmount: null,
  adjustedAmount: null,
  subsidy: null,
  selfFunding: null,
  status: "draft",
  source: blankSource(),
  issues: [],
});
export const blankItem = (id: string, projectId: string): BudgetItem => ({
  id,
  projectId,
  groupId: null,
  subprojectId: null,
  name: "",
  originalName: "",
  sourceRow: "",
  category: "其他",
  order: 0,
  inactive: false,
  unit: "式",
  unitPrice: null,
  quantity: null,
  sourceAmount: null,
  approvedAmount: null,
  adjustedAmount: null,
  maxUnitPrice: null,
  calculation: "direct",
  percent: null,
  baseItemIds: [],
  rounding: "round",
  transferPolicy: "review",
  source: blankSource(),
  rules: [],
  details: [],
});
export function parseMoney(value: string): Money | null {
  if (!value.trim()) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error("金額須為非負數且最多兩位小數");
  const [whole, frac = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(result)) throw new Error("金額超出安全範圍");
  return result;
}
export const money = (value: Money | null) =>
  value === null
    ? "待確認"
    : new Intl.NumberFormat("zh-TW", {
        style: "currency",
        currency: "TWD",
        maximumFractionDigits: 2,
      }).format(value / 100);
export const moneyInput = (value: Money | null) =>
  value === null ? "" : String(value / 100);
export const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};
