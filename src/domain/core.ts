import {
  emptyState,
  type AppState,
  type BudgetItem,
  type Command,
  type Expense,
  type Project,
  type Role,
  type Rule,
} from "../types";
export function ensure(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const finite = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
export const isMoney = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const optionalMoney = (v: unknown) => v === null || isMoney(v);
const date = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !isNaN(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v;
export const cap = (x: {
  approvedAmount: number | null;
  adjustedAmount: number | null;
}) => x.adjustedAmount ?? x.approvedAmount;
export const projectSpent = (s: AppState, id: string) =>
  s.expenses
    .filter((e) => e.projectId === id)
    .reduce((n, e) => n + e.amount, 0);
export const itemSpent = (s: AppState, id: string) =>
  s.expenses.reduce(
    (n, e) =>
      n +
      e.allocations
        .filter((a) => a.budgetItemId === id)
        .reduce((v, a) => v + a.amount, 0),
    0,
  );
export const groupSpent = (s: AppState, id: string) =>
  s.items
    .filter((i) => i.groupId === id)
    .reduce((n, i) => n + itemSpent(s, i.id), 0);
export const advanceTotal = (s: AppState, id?: string) =>
  s.expenses
    .filter(
      (e) =>
        (!id || e.projectId === id) &&
        e.isAdvance &&
        e.advanceStatus !== "reimbursed",
    )
    .reduce((n, e) => n + e.amount, 0);
export function calculateTeaching(
  quantity: number,
  leave: number,
  unitPrice: number,
  unit: string,
  expectedUnit: string,
) {
  ensure(
    finite(quantity) &&
      finite(leave) &&
      leave <= quantity &&
      isMoney(unitPrice),
    "時數／節數或單價不正確",
  );
  ensure(unit === expectedUnit, "計費單位不一致：節與小時不可互換");
  const amount = Math.round((quantity - leave) * unitPrice);
  ensure(Number.isSafeInteger(amount), "計算超出安全範圍");
  return amount;
}
export function calculatedAmount(
  item: BudgetItem,
  items: BudgetItem[],
  trail: string[] = [],
): number | null {
  ensure(!trail.includes(item.id), "百分比基礎不可循環");
  if (item.calculation === "direct") return item.sourceAmount;
  if (item.calculation === "percent") {
    if (item.percent === null || !item.baseItemIds.length) return null;
    let total = 0;
    for (const id of item.baseItemIds) {
      const base = items.find((x) => x.id === id);
      ensure(
        base && base.projectId === item.projectId,
        "百分比基礎必須是同計畫項目",
      );
      const amount = calculatedAmount(base, items, [...trail, item.id]);
      if (amount === null) return null;
      total += amount;
    }
    return Math[item.rounding]((total * item.percent) / 100);
  }
  return item.unitPrice === null || item.quantity === null
    ? null
    : Math.round(item.unitPrice * item.quantity);
}
export function validateState(input: unknown): AppState {
  const s = input as AppState;
  ensure(s && s.schemaVersion === 2, "帳本版本不相容");
  const keys = [
    "projects",
    "subprojects",
    "groups",
    "items",
    "expenses",
    "attachments",
    "activities",
    "teachingRecords",
    "revisions",
  ] as const;
  for (const key of keys) {
    ensure(Array.isArray(s[key]), "缺少資料表：" + key);
    const ids = new Set<string>();
    for (const row of s[key]) {
      ensure(
        row &&
          typeof row.id === "string" &&
          row.id.length > 0 &&
          row.id.length <= 160 &&
          !ids.has(row.id),
        "資料ID缺漏或重複：" + key,
      );
      ids.add(row.id);
    }
  }
  const project = (id: string) => s.projects.find((p) => p.id === id);
  const owned = (projectId: string, subId: string | null) =>
    !subId ||
    s.subprojects.some((p) => p.id === subId && p.projectId === projectId);
  const rules = (rows: Rule[]) => {
    ensure(Array.isArray(rows), "規則格式錯誤");
    for (const r of rows)
      ensure(
        r &&
          typeof r.id === "string" &&
          typeof r.name === "string" &&
          typeof r.confirmed === "boolean" &&
          ["warning", "block"].includes(r.effect) &&
          ["ratio", "noTransfer", "unitPrice"].includes(r.kind) &&
          finite(r.value) &&
          r.source &&
          typeof r.source.document === "string" &&
          typeof r.source.location === "string" &&
          typeof r.source.note === "string",
        "規則格式錯誤",
      );
  };
  for (const p of s.projects) {
    ensure(
      typeof p.name === "string" &&
        p.name.trim() &&
        p.name.length <= 160 &&
        typeof p.summary === "string",
      "計畫名稱／摘要無效",
    );
    ensure(
      ["calendar", "academic"].includes(p.yearType) &&
        (p.year === null ||
          (Number.isInteger(p.year) && p.year! >= 1 && p.year! <= 999)),
      "年度無效",
    );
    for (const v of [p.startDate, p.endDate, p.reportDeadline])
      ensure(v === null || date(v), "計畫日期無效");
    ensure(
      !p.startDate || !p.endDate || p.startDate <= p.endDate,
      "執行起訖日期顛倒",
    );
    for (const v of [
      p.sourceAmount,
      p.approvedAmount,
      p.adjustedAmount,
      p.subsidy,
      p.selfFunding,
    ])
      ensure(optionalMoney(v), "計畫金額無效");
    ensure(
      p.legacyRecordedBudget === undefined || isMoney(p.legacyRecordedBudget),
      "舊額度無效",
    );
    ensure(
      p.adjustedAmount === null || p.approvedAmount !== null,
      "未核定不可設定調整額",
    );
    ensure(
      ["draft", "approved", "active", "closing", "closed"].includes(p.status),
      "計畫狀態無效",
    );
    ensure(
      p.status === "draft" || p.approvedAmount !== null,
      "核定金額未知，不能設為已核定狀態",
    );
    ensure(
      Array.isArray(p.issues) &&
        p.issues.every((x) => typeof x === "string") &&
        p.source &&
        typeof p.source.document === "string",
      "來源格式無效",
    );
  }
  for (const p of s.subprojects)
    ensure(
      project(p.projectId) &&
        typeof p.name === "string" &&
        p.name.trim() &&
        typeof p.className === "string" &&
        optionalMoney(p.sourceAmount) &&
        finite(p.order),
      "子計畫無效",
    );
  for (const g of s.groups) {
    ensure(
      project(g.projectId) &&
        owned(g.projectId, g.subprojectId) &&
        typeof g.name === "string" &&
        g.name.trim(),
      "預算群組無效",
    );
    for (const v of [g.sourceAmount, g.approvedAmount, g.adjustedAmount])
      ensure(optionalMoney(v), "群組金額無效");
    ensure(
      g.adjustedAmount === null || g.approvedAmount !== null,
      "群組尚未核定",
    );
    rules(g.rules);
  }
  for (const i of s.items) {
    ensure(
      project(i.projectId) &&
        owned(i.projectId, i.subprojectId) &&
        (!i.groupId ||
          s.groups.some(
            (g) =>
              g.id === i.groupId &&
              g.projectId === i.projectId &&
              (!g.subprojectId || g.subprojectId === i.subprojectId),
          )),
      "預算項目所屬計畫／群組無效",
    );
    ensure(
      typeof i.name === "string" &&
        i.name.trim() &&
        i.name.length <= 160 &&
        typeof i.originalName === "string" &&
        typeof i.category === "string" &&
        typeof i.sourceRow === "string" &&
        typeof i.unit === "string" &&
        i.unit.trim() &&
        typeof i.inactive === "boolean" &&
        finite(i.order),
      "預算項目名稱或單位無效",
    );
    for (const v of [
      i.unitPrice,
      i.sourceAmount,
      i.approvedAmount,
      i.adjustedAmount,
      i.maxUnitPrice,
    ])
      ensure(optionalMoney(v), "項目金額無效");
    ensure(
      i.adjustedAmount === null || i.approvedAmount !== null,
      "項目尚未核定",
    );
    ensure(i.quantity === null || finite(i.quantity), "數量無效");
    ensure(
      ["direct", "quantity", "teaching", "percent"].includes(i.calculation) &&
        ["round", "ceil", "floor"].includes(i.rounding) &&
        ["review", "locked", "allowed"].includes(i.transferPolicy),
      "計算設定無效",
    );
    ensure(
      i.percent === null || (finite(i.percent) && i.percent <= 100),
      "百分比無效",
    );
    ensure(
      Array.isArray(i.baseItemIds) &&
        new Set(i.baseItemIds).size === i.baseItemIds.length &&
        Array.isArray(i.details),
      "項目明細無效",
    );
    for (const d of i.details)
      ensure(
        d &&
          typeof d.id === "string" &&
          typeof d.name === "string" &&
          typeof d.unit === "string" &&
          isMoney(d.unitPrice) &&
          finite(d.quantity) &&
          isMoney(d.sourceAmount),
        "採購明細無效",
      );
    rules(i.rules);
    calculatedAmount(i, s.items);
  }
  for (const a of s.activities)
    ensure(
      project(a.projectId) &&
        typeof a.name === "string" &&
        date(a.date) &&
        /^\d{2}:\d{2}$/.test(a.startTime) &&
        /^\d{2}:\d{2}$/.test(a.endTime) &&
        a.startTime < a.endTime,
      "活動資料無效",
    );
  for (const a of s.attachments)
    ensure(
      project(a.projectId) &&
        typeof a.name === "string" &&
        typeof a.mimeType === "string" &&
        ["receipt", "source", "activity"].includes(a.kind) &&
        (a.fileId === null || typeof a.fileId === "string") &&
        typeof a.createdAt === "string" &&
        typeof a.uploadedBy === "string" &&
        (a.legacyDataUrl === undefined ||
          /^data:image\//.test(a.legacyDataUrl)),
      "附件資料無效",
    );
  for (const e of s.expenses) {
    ensure(
      project(e.projectId) &&
        date(e.occurrenceDate) &&
        (e.paymentDate === null || date(e.paymentDate)) &&
        typeof e.createdAt === "string" &&
        typeof e.description === "string" &&
        e.description.trim() &&
        typeof e.payee === "string" &&
        isMoney(e.amount) &&
        e.amount > 0,
      "支出格式無效",
    );
    ensure(
      e.activityId === null ||
        s.activities.some(
          (a) => a.id === e.activityId && a.projectId === e.projectId,
        ),
      "活動不屬於此計畫",
    );
    ensure(
      Array.isArray(e.allocations) &&
        e.allocations.length > 0 &&
        new Set(e.allocations.map((a) => a.budgetItemId)).size ===
          e.allocations.length,
      "支出分攤缺漏或重複",
    );
    let total = 0;
    for (const a of e.allocations) {
      ensure(
        isMoney(a.amount) &&
          a.amount > 0 &&
          typeof a.fundingSource === "string" &&
          s.items.some(
            (i) => i.id === a.budgetItemId && i.projectId === e.projectId,
          ),
        "分攤項目不屬於此計畫或金額無效",
      );
      total += a.amount;
    }
    ensure(total === e.amount, "分攤合計必須等於支出總額");
    ensure(
      typeof e.teacherName === "string" &&
        typeof e.unit === "string" &&
        typeof e.voucherNumber === "string" &&
        (e.quantity === null || finite(e.quantity)) &&
        (e.leaveQuantity === null || finite(e.leaveQuantity)) &&
        optionalMoney(e.unitPrice),
      "支出計算欄位無效",
    );
    ensure(
      ["unknown", "unpaid", "paid"].includes(e.paymentStatus) &&
        ["unknown", "draft", "submitted", "approved", "closed"].includes(
          e.claimStatus,
        ) &&
        ["pending", "reimbursed"].includes(e.advanceStatus) &&
        typeof e.isAdvance === "boolean" &&
        typeof e.advancePerson === "string" &&
        (!e.isAdvance || e.advancePerson.trim()),
      "付款／核銷／代墊資訊無效",
    );
    ensure(
      e.paymentStatus !== "paid" || e.paymentDate !== null,
      "已付款需填寫付款日期",
    );
    ensure(
      Array.isArray(e.attachmentIds) &&
        e.attachmentIds.every((id) =>
          s.attachments.some((a) => a.id === id && a.projectId === e.projectId),
        ),
      "附件不屬於此計畫",
    );
  }
  for (const t of s.teachingRecords) {
    const i = s.items.find(
      (i) => i.id === t.budgetItemId && i.projectId === t.projectId,
    );
    ensure(
      (t.activityId === null ||
        s.activities.some(
          (a) => a.id === t.activityId && a.projectId === t.projectId,
        )) &&
        i &&
        i.calculation === "teaching" &&
        date(t.date) &&
        typeof t.teacherName === "string" &&
        t.teacherName.trim(),
      "課程資料無效",
    );
    calculateTeaching(t.quantity, t.leaveQuantity, t.unitPrice, t.unit, i.unit);
    ensure(
      ["planned", "taught", "cancelled", "settled"].includes(t.status),
      "課程狀態無效",
    );
    ensure(
      t.expenseId === null ||
        s.expenses.some(
          (e) => e.id === t.expenseId && e.teachingRecordId === t.id,
        ),
      "課程結算關聯無效",
    );
  }
  return s;
}
export function warnings(s: AppState): string[] {
  const messages: string[] = [];
  for (const p of s.projects)
    for (const issue of p.issues) messages.push(p.name + "：" + issue);
  for (const i of s.items) {
    const computed = calculatedAmount(i, s.items);
    if (
      computed !== null &&
      i.sourceAmount !== null &&
      computed !== i.sourceAmount
    )
      messages.push(i.name + "：文件金額與計算值不一致，請確認");
    for (const r of i.rules)
      if (!r.confirmed)
        messages.push(i.name + "：待確認規則「" + r.name + "」");
  }
  for (const g of s.groups)
    for (const r of g.rules)
      if (!r.confirmed)
        messages.push(g.name + "：待確認規則「" + r.name + "」");
  const seen = new Map<string, string>();
  for (const e of s.expenses) {
    const k = e.voucherNumber
      ? "v:" + e.voucherNumber
      : e.teacherName
        ? "t:" + e.teacherName + ":" + e.occurrenceDate + ":" + e.amount
        : "";
    if (k && seen.has(k))
      messages.push("可能重複報支：" + e.description + "（請人工核對）");
    if (k) seen.set(k, e.id);
  }
  return [...new Set(messages)];
}
function checkSpending(s: AppState, e: Expense) {
  const p = s.projects.find((p) => p.id === e.projectId)!;
  ensure(
    p.status !== "draft" && p.status !== "closed" && cap(p) !== null,
    "計畫尚未核定或已結案，不可新增支出",
  );
  ensure(!p.startDate || e.occurrenceDate >= p.startDate, "支出早於執行期間");
  ensure(!p.endDate || e.occurrenceDate <= p.endDate, "支出晚於執行期間");
  ensure(projectSpent(s, p.id) <= cap(p)!, "超出計畫可用額度");
  for (const a of e.allocations) {
    const item = s.items.find((i) => i.id === a.budgetItemId)!;
    ensure(!item.inactive && cap(item) !== null, "項目已停用或尚未核定");
    ensure(
      itemSpent(s, item.id) <= cap(item)!,
      "超出項目可用額度：" + item.name,
    );
    const limit = item.maxUnitPrice;
    const hasUnitLimit =
      limit !== null ||
      item.rules.some(
        (r) => r.confirmed && r.effect === "block" && r.kind === "unitPrice",
      );
    if (hasUnitLimit) {
      ensure(
        e.unitPrice !== null &&
          e.quantity !== null &&
          e.unit === item.unit &&
          e.allocations.length === 1,
        "設定單價上限的項目須提供同單位數量與單價，不能以直接金額略過",
      );
      const expected = Math.round(
        (e.quantity! -
          (item.calculation === "teaching" ? (e.leaveQuantity ?? 0) : 0)) *
          e.unitPrice!,
      );
      ensure(expected === e.amount, "單價限制項目的金額計算不一致");
    }
    if (limit !== null && e.unitPrice !== null)
      ensure(e.unitPrice <= limit, "超出最高單價");
    if (item.calculation === "quantity" || item.calculation === "teaching") {
      ensure(e.unit === item.unit, "計費單位不一致");
      ensure(e.quantity !== null && e.unitPrice !== null, "請填數量與單價");
      const expected =
        item.calculation === "teaching"
          ? calculateTeaching(
              e.quantity,
              e.leaveQuantity ?? 0,
              e.unitPrice,
              e.unit,
              item.unit,
            )
          : Math.round(e.quantity * e.unitPrice);
      ensure(
        e.allocations.length === 1 && expected === e.amount,
        "計算金額不一致；數量／授課費用請逐項登錄",
      );
      if (item.calculation === "teaching")
        ensure(e.teacherName.trim(), "請填教師姓名");
    }
    const group = s.groups.find((g) => g.id === item.groupId);
    if (group) {
      ensure(cap(group) !== null, "群組控制額尚未核定");
      ensure(groupSpent(s, group.id) <= cap(group)!, "超出群組控制額度");
      for (const r of group.rules)
        if (r.confirmed && r.effect === "block" && r.kind === "ratio")
          ensure(
            groupSpent(s, group.id) <=
              Math.floor((p.approvedAmount! * r.value) / 100),
            "超出群組比例限制",
          );
    }
    for (const r of item.rules)
      if (r.confirmed && r.effect === "block") {
        if (r.kind === "ratio")
          ensure(
            itemSpent(s, item.id) <=
              Math.floor((p.approvedAmount! * r.value) / 100),
            "超出比例限制",
          );
        if (r.kind === "unitPrice" && e.unitPrice !== null)
          ensure(e.unitPrice <= r.value, "超出規則單價");
      }
  }
}
const rank: Record<Role, number> = { viewer: 0, entry: 1, editor: 2, admin: 3 };
export function authorize(role: Role, min: Role) {
  ensure(role in rank && rank[role] >= rank[min], "權限不足");
}
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function applyCommand(
  source: AppState,
  command: Command,
  actor: { email: string; role: Role },
  at: string,
): AppState {
  validateState(source);
  authorize(actor.role, "entry");
  let s: AppState = JSON.parse(JSON.stringify(source));
  const edit = () => authorize(actor.role, "editor");
  const revision = (
    projectId: string,
    before: unknown,
    after: unknown,
    reason: string,
  ) => {
    ensure(reason.trim(), "修改預算需填調整原因");
    s.revisions.push({
      id: "revision-" + s.revisions.length + "-" + at,
      projectId,
      at,
      actor: actor.email,
      reason,
      before,
      after,
    });
  };
  const upsert = <T extends { id: string }>(rows: T[], value: T) => {
    const index = rows.findIndex((x) => x.id === value.id);
    if (index < 0) rows.push(value);
    else rows[index] = value;
  };
  const approved = (
    old:
      | { approvedAmount: number | null; adjustedAmount: number | null }
      | undefined,
    value: { approvedAmount: number | null; adjustedAmount: number | null },
  ) => {
    if (
      !same(
        [old?.approvedAmount ?? null, old?.adjustedAmount ?? null],
        [value.approvedAmount, value.adjustedAmount],
      )
    )
      authorize(actor.role, "admin");
  };
  switch (command.type) {
    case "saveProject": {
      edit();
      const old = s.projects.find((p) => p.id === command.value.id);
      approved(old, command.value);
      if (old) {
        ensure(
          cap(command.value) === null ||
            cap(command.value)! >= projectSpent(s, old.id),
          "額度不可低於已支用",
        );
        ensure(
          !old.startDate ||
            !command.value.startDate ||
            !s.expenses.some(
              (e) =>
                e.projectId === old.id &&
                e.occurrenceDate < command.value.startDate!,
            ),
          "期間未涵蓋既有支出",
        );
        ensure(
          !command.value.endDate ||
            !s.expenses.some(
              (e) =>
                e.projectId === old.id &&
                e.occurrenceDate > command.value.endDate!,
            ),
          "期間未涵蓋既有支出",
        );
      }
      revision(command.value.id, old ?? null, command.value, command.reason);
      upsert(s.projects, command.value);
      break;
    }
    case "saveSubproject":
      edit();
      upsert(s.subprojects, command.value);
      break;
    case "saveGroup": {
      edit();
      const old = s.groups.find((g) => g.id === command.value.id);
      approved(old, command.value);
      if (!same(old?.rules ?? [], command.value.rules))
        authorize(actor.role, "admin");
      if (old)
        ensure(
          command.value.projectId === old.projectId &&
            (cap(command.value) === null ||
              cap(command.value)! >= groupSpent(s, old.id)),
          "群組不可移動或低於已支用",
        );
      revision(
        command.value.projectId,
        old ?? null,
        command.value,
        command.reason,
      );
      upsert(s.groups, command.value);
      break;
    }
    case "saveItem": {
      edit();
      const old = s.items.find((i) => i.id === command.value.id);
      approved(old, command.value);
      if (
        (old?.maxUnitPrice ?? null) !== command.value.maxUnitPrice ||
        !same(old?.rules ?? [], command.value.rules) ||
        (old && old.transferPolicy !== command.value.transferPolicy)
      )
        authorize(actor.role, "admin");
      if (old) {
        ensure(
          old.projectId === command.value.projectId,
          "項目不可搬移至其他計畫",
        );
        ensure(
          cap(command.value) === null ||
            cap(command.value)! >= itemSpent(s, old.id),
          "額度不可低於已支用",
        );
        if (itemSpent(s, old.id) > 0)
          ensure(
            old.groupId === command.value.groupId &&
              old.subprojectId === command.value.subprojectId &&
              old.unit === command.value.unit &&
              old.calculation === command.value.calculation,
            "已有支出的項目不可搬移群組或改計算單位",
          );
        if (old.transferPolicy === "locked" && old.approvedAmount !== null)
          ensure(
            cap(old) === cap(command.value),
            "不可流用項目不得直接改額度，需建立新的核定版本流程",
          );
      }
      revision(
        command.value.projectId,
        old ?? null,
        command.value,
        command.reason,
      );
      upsert(s.items, command.value);
      break;
    }
    case "removeItem": {
      edit();
      ensure(
        !s.expenses.some((e) =>
          e.allocations.some((a) => a.budgetItemId === command.id),
        ) && !s.teachingRecords.some((t) => t.budgetItemId === command.id),
        "已有支出或課表，只能停用",
      );
      s.items = s.items.filter((i) => i.id !== command.id);
      break;
    }
    case "reorderItems": {
      edit();
      const rows = s.items.filter((i) => i.projectId === command.projectId);
      ensure(
        command.ids.length === rows.length &&
          new Set(command.ids).size === rows.length &&
          rows.every((i) => command.ids.includes(i.id)),
        "排序清單不完整",
      );
      s.items = s.items.map((i) =>
        i.projectId === command.projectId
          ? { ...i, order: command.ids.indexOf(i.id) }
          : i,
      );
      break;
    }
    case "saveExpense": {
      if (
        command.value.claimStatus === "approved" ||
        command.value.claimStatus === "closed"
      )
        edit();
      ensure(
        !s.expenses.some((e) => e.id === command.value.id),
        "已入帳支出不可覆寫；請使用狀態更新",
      );
      s.expenses.push(command.value);
      validateState(s);
      checkSpending(s, command.value);
      break;
    }
    case "updateExpenseStatus": {
      const e = s.expenses.find((e) => e.id === command.id);
      ensure(e, "找不到支出");
      if (
        command.claimStatus === "approved" ||
        command.claimStatus === "closed"
      )
        edit();
      Object.assign(e, {
        paymentStatus: command.paymentStatus,
        claimStatus: command.claimStatus,
        advanceStatus: command.advanceStatus,
        paymentDate: command.paymentDate,
      });
      break;
    }
    case "addAttachment":
      ensure(
        !command.value.legacyDataUrl && command.value.fileId,
        "新附件需先上傳檔案儲存",
      );
      ensure(
        !s.attachments.some((a) => a.id === command.value.id),
        "附件ID已存在",
      );
      s.attachments.push(command.value);
      break;
    case "saveActivity":
      edit();
      upsert(s.activities, command.value);
      break;
    case "saveTeaching": {
      const old = s.teachingRecords.find((t) => t.id === command.value.id);
      ensure(!old || old.status !== "settled", "已結算課程不可覆寫");
      ensure(
        command.value.status !== "settled" && command.value.expenseId === null,
        "請使用結算操作",
      );
      upsert(s.teachingRecords, command.value);
      break;
    }
    case "saveTeachingBatch": {
      ensure(
        Array.isArray(command.values) &&
          command.values.length > 0 &&
          command.values.length <= 100,
        "課表批次上限100筆",
      );
      for (const t of command.values) {
        ensure(
          !s.teachingRecords.some((x) => x.id === t.id) &&
            t.status === "planned" &&
            t.expenseId === null,
          "批次僅允許新增預定課程",
        );
        s.teachingRecords.push(t);
      }
      break;
    }
    case "settleTeaching": {
      const t = s.teachingRecords.find((t) => t.id === command.id);
      ensure(t, "找不到課程");
      if (t.status === "settled") return source;
      ensure(t.status === "taught", "僅實上課程可結算");
      ensure(
        !s.expenses.some(
          (e) => e.id === command.expenseId || e.teachingRecordId === t.id,
        ),
        "課程已產生支出",
      );
      const amount = calculateTeaching(
        t.quantity,
        t.leaveQuantity,
        t.unitPrice,
        t.unit,
        s.items.find((i) => i.id === t.budgetItemId)!.unit,
      );
      ensure(amount > 0, "全數請假或停課不產生支出");
      const e: Expense = {
        id: command.expenseId,
        projectId: t.projectId,
        activityId: t.activityId,
        occurrenceDate: t.date,
        paymentDate: null,
        createdAt: at,
        description: "課程結算：" + t.teacherName,
        payee: t.teacherName,
        amount,
        allocations: [
          { budgetItemId: t.budgetItemId, fundingSource: "", amount },
        ],
        paymentStatus: "unpaid",
        claimStatus: "draft",
        isAdvance: false,
        advancePerson: "",
        advanceStatus: "pending",
        attachmentIds: [],
        teacherName: t.teacherName,
        unit: t.unit,
        quantity: t.quantity,
        leaveQuantity: t.leaveQuantity,
        unitPrice: t.unitPrice,
        teachingRecordId: t.id,
        voucherNumber: "",
      };
      s.expenses.push(e);
      t.status = "settled";
      t.expenseId = e.id;
      validateState(s);
      checkSpending(s, e);
      break;
    }
    case "transferBudget": {
      authorize(actor.role, "admin");
      const from = s.items.find((i) => i.id === command.fromId),
        to = s.items.find((i) => i.id === command.toId);
      ensure(
        from && to && from.id !== to.id && from.projectId === to.projectId,
        "不得跨計畫流用",
      );
      ensure(
        from.transferPolicy === "allowed" && to.transferPolicy === "allowed",
        "流用規則尚未確認或禁止流用",
      );
      const groupRules = s.groups
        .filter((g) => g.id === from.groupId || g.id === to.groupId)
        .flatMap((g) => g.rules);
      ensure(
        ![...from.rules, ...to.rules, ...groupRules].some(
          (r) => r.confirmed && r.kind === "noTransfer" && r.effect === "block",
        ),
        "此預算禁止流用",
      );
      ensure(
        isMoney(command.amount) &&
          command.amount > 0 &&
          cap(from) !== null &&
          cap(to) !== null,
        "流用金額或核定額無效",
      );
      ensure(
        cap(from)! - itemSpent(s, from.id) >= command.amount,
        "流出餘額不足",
      );
      const before = JSON.parse(JSON.stringify([from, to]));
      from.adjustedAmount = cap(from)! - command.amount;
      to.adjustedAmount = cap(to)! + command.amount;
      revision(from.projectId, before, [from, to], command.reason);
      break;
    }
    case "importDraft": {
      edit();
      validateState(command.value);
      ensure(
        command.value.expenses.length === 0 &&
          command.value.attachments.length === 0 &&
          command.value.teachingRecords.length === 0 &&
          command.value.revisions.length === 0,
        "範本不能夾帶支出或附件",
      );
      ensure(
        command.value.projects.every(
          (p) =>
            p.status === "draft" &&
            p.approvedAmount === null &&
            p.adjustedAmount === null,
        ) &&
          [...command.value.items, ...command.value.groups].every(
            (i) => i.approvedAmount === null && i.adjustedAmount === null,
          ),
        "只能匯入待確認草稿",
      );
      for (const key of [
        "projects",
        "subprojects",
        "groups",
        "items",
        "activities",
      ] as const) {
        const incoming = command.value[key] as { id: string }[];
        ensure(
          incoming.every(
            (row) => !(s[key] as { id: string }[]).some((x) => x.id === row.id),
          ),
          "草稿ID已存在",
        );
        (s[key] as { id: string }[]).push(...incoming);
      }
      break;
    }
    default:
      throw new Error("不支援的操作");
  }
  validateState(s);
  // Budget control is independent of names, categories and display order.
  for (const p of s.projects)
    if (cap(p) !== null) {
      ensure(projectSpent(s, p.id) <= cap(p)!, "計畫額度不足");
      ensure(
        s.items
          .filter((i) => i.projectId === p.id)
          .reduce((n, i) => n + (cap(i) ?? 0), 0) <= cap(p)!,
        "預算明細核定額合計超出計畫額度",
      );
    }
  for (const i of s.items)
    if (cap(i) !== null) {
      ensure(itemSpent(s, i.id) <= cap(i)!, "項目額度不足");
      const p = s.projects.find((p) => p.id === i.projectId)!;
      if (p.approvedAmount !== null)
        for (const r of i.rules)
          if (r.confirmed && r.effect === "block" && r.kind === "ratio")
            ensure(
              cap(i)! <= Math.floor((p.approvedAmount * r.value) / 100),
              "項目編列超出比例限制",
            );
    }
  for (const g of s.groups) {
    ensure(
      cap(g) === null ||
        s.items
          .filter((i) => i.groupId === g.id)
          .reduce((n, i) => n + (cap(i) ?? 0), 0) <= cap(g)!,
      "明細核定額合計超出群組控制額",
    );
    ensure(cap(g) === null || groupSpent(s, g.id) <= cap(g)!, "群組額度不足");
    const p = s.projects.find((p) => p.id === g.projectId)!;
    if (p.approvedAmount !== null)
      for (const r of g.rules)
        if (r.confirmed && r.effect === "block" && r.kind === "ratio")
          ensure(
            (cap(g) ?? groupSpent(s, g.id)) <=
              Math.floor((p.approvedAmount * r.value) / 100),
            "群組比例限制",
          );
  }
  return s;
}
export { emptyState };
