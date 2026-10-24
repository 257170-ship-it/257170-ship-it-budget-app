import { blankItem, blankProject, emptyState, type AppState } from "../types";
import { validateState, projectSpent, advanceTotal } from "./core";
import { validateState as validateLegacy } from "../legacy/state";
import type { AppState as LegacyState } from "../legacy/types";
const toCents = (v: number) => Math.round(v * 100);
export function migrateLegacy(input: unknown): AppState {
  if ((input as AppState)?.schemaVersion === 2) return validateState(input);
  const old = validateLegacy(input),
    next = emptyState();
  const labels = {
    hourly: "鐘點費",
    meal: "膳費",
    tea: "茶水費",
    material: "教材教具費",
    other: "其他",
  };
  for (const p of old.projects) {
    const project = {
      ...blankProject(p.id),
      name: p.name,
      summary: p.summary,
      startDate: p.startDate,
      endDate: p.endDate,
      sourceAmount: toCents(p.totalBudget),
      legacyRecordedBudget: toCents(p.totalBudget),
      source: {
        document: "舊版雲端帳本",
        location: "projects/" + p.id,
        note: "原額度保留，不推定核定",
      },
      issues: ["舊額度與年度尚待核定資料確認"],
    };
    next.projects.push(project);
    Object.entries(labels).forEach(([key, label], n) =>
      next.items.push({
        ...blankItem(p.id + "--legacy-" + key, p.id),
        name: label,
        originalName: label,
        order: n,
        sourceAmount: toCents(p.limits[key as keyof typeof labels]),
        source: {
          document: "舊版雲端帳本",
          location: key,
          note: "舊五類穩定ID映射",
        },
      }),
    );
  }
  for (const e of old.expenses) {
    const attachmentIds: string[] = [];
    e.photos.forEach((photo, index) => {
      const id = e.id + "--photo-" + index;
      attachmentIds.push(id);
      next.attachments.push({
        id,
        projectId: e.projectId,
        fileId: null,
        name: "舊憑證-" + (index + 1) + ".jpg",
        mimeType: photo.slice(5, photo.indexOf(";")),
        kind: "receipt",
        createdAt: "legacy",
        uploadedBy: "legacy",
        legacyDataUrl: photo,
      });
    });
    const amount = toCents(e.amount);
    next.expenses.push({
      id: e.id,
      projectId: e.projectId,
      activityId: null,
      occurrenceDate: e.date,
      paymentDate: null,
      createdAt: "legacy",
      description: e.description || "舊支出（用途未填）",
      payee: e.teacherName || e.advancePerson || "",
      amount,
      allocations: [
        {
          budgetItemId: e.projectId + "--legacy-" + e.type,
          fundingSource: "",
          amount,
        },
      ],
      paymentStatus: "unknown",
      claimStatus: "unknown",
      isAdvance: e.isAdvance,
      advancePerson: e.advancePerson || "",
      advanceStatus:
        e.advanceStatus === "reimbursed" ? "reimbursed" : "pending",
      attachmentIds,
      teacherName: e.teacherName || "",
      unit: "小時",
      quantity: e.hours ?? null,
      leaveQuantity: e.leaveHours ?? null,
      unitPrice: e.hourlyRate === undefined ? null : toCents(e.hourlyRate),
      teachingRecordId: null,
      voucherNumber: "",
      legacy: e,
    });
  }
  return validateState(next);
}
export function reconciliation(old: LegacyState, next: AppState) {
  const before = {
    projects: old.projects.length,
    expenses: old.expenses.length,
    total: toCents(old.expenses.reduce((n, e) => n + e.amount, 0)),
    advance: toCents(
      old.expenses
        .filter((e) => e.isAdvance && e.advanceStatus !== "reimbursed")
        .reduce((n, e) => n + e.amount, 0),
    ),
    attachments: old.expenses.reduce((n, e) => n + e.photos.length, 0),
  };
  const after = {
    projects: next.projects.length,
    expenses: next.expenses.length,
    total: next.expenses.reduce((n, e) => n + e.amount, 0),
    advance: advanceTotal(next),
    attachments: next.attachments.length,
  };
  const byProject = old.projects.map((p) => ({
    id: p.id,
    name: p.name,
    before: toCents(
      old.expenses
        .filter((e) => e.projectId === p.id)
        .reduce((n, e) => n + e.amount, 0),
    ),
    after: projectSpent(next, p.id),
  }));
  return {
    before,
    after,
    byProject,
    consistent:
      JSON.stringify(before) === JSON.stringify(after) &&
      byProject.every((p) => p.before === p.after),
  };
}
