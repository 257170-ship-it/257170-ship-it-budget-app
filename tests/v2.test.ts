import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCommand,
  validateState,
  cap,
  projectSpent,
  itemSpent,
  groupSpent,
  calculateTeaching,
  calculatedAmount,
  warnings,
} from "../src/domain/core";
import {
  emptyState,
  blankProject,
  blankItem,
  parseMoney,
  type AppState,
  type Expense,
  type Command,
} from "../src/types";
import { getTemplates, instantiateTemplate } from "../src/domain/templates";
import { migrateLegacy, reconciliation } from "../src/domain/migration";
import { createWorkbook } from "../src/components/Reports";
const admin = { email: "admin@example.test", role: "admin" as const },
  entry = { email: "entry@example.test", role: "entry" as const },
  editor = { email: "editor@example.test", role: "editor" as const },
  at = "2026-10-24T12:00:00Z";
function base() {
  const s = emptyState();
  s.projects.push({
    ...blankProject("p"),
    name: "測試帳本",
    status: "active",
    approvedAmount: 1000000,
  });
  s.items.push({
    ...blankItem("i", "p"),
    name: "同名項目",
    originalName: "原始科目",
    approvedAmount: 500000,
  });
  return s;
}
const expense = (amount = 10000): Expense => ({
  id: "e",
  projectId: "p",
  activityId: null,
  occurrenceDate: "2026-10-24",
  paymentDate: null,
  createdAt: at,
  description: "測試支出",
  payee: "測試對象",
  amount,
  allocations: [{ budgetItemId: "i", amount, fundingSource: "" }],
  paymentStatus: "unpaid",
  claimStatus: "draft",
  isAdvance: true,
  advancePerson: "測試代墊人",
  advanceStatus: "pending",
  attachmentIds: [],
  teacherName: "",
  unit: "式",
  quantity: null,
  leaveQuantity: null,
  unitPrice: null,
  teachingRecordId: null,
  voucherNumber: "",
});
const apply = (s: AppState, c: Command, actor = admin) =>
  applyCommand(s, c, actor, at);
test("money uses integer cents, rejects extra decimals and unsafe integers", () => {
  assert.equal(parseMoney("405.25"), 40525);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney("0"), 0);
  assert.throws(() => parseMoney("0.001"));
  assert.throws(() => parseMoney("1e3"));
  assert.throws(() => parseMoney("9999999999999999999"));
});
test("nine drafts preserve totals, no approvals, no expenses, and year114", () => {
  const totals = [
    100000, 250000, 248520, 300000, 100000, 410000, 110000, 250000, 33000,
  ];
  for (const [index, s] of getTemplates().entries()) {
    validateState(s);
    assert.equal(s.projects[0].sourceAmount, totals[index] * 100);
    assert.equal(
      s.items.reduce((n, i) => n + (i.sourceAmount ?? 0), 0),
      totals[index] * 100,
    );
    assert.equal(s.projects[0].approvedAmount, null);
    assert.ok(s.items.every((i) => i.approvedAmount === null));
    assert.equal(s.expenses.length, 0);
  }
  assert.equal(getTemplates()[8].projects[0].year, 114);
  assert.equal(
    getTemplates()[0].projects[0].issues[0].includes("10,000"),
    true,
  );
});
test("all purchase sublists match their source parent totals", () => {
  for (const s of getTemplates())
    for (const i of s.items)
      if (i.details.length)
        assert.equal(
          i.details.reduce((n, d) => n + d.sourceAmount, 0),
          i.sourceAmount,
          i.name,
        );
});
test("plan4 mixed405/400 units totals161600 without parent duplication", () => {
  const s = getTemplates()[2],
    i = s.items.filter((i) => i.groupId);
  assert.equal(
    i.reduce((n, i) => n + (calculatedAmount(i, s.items) ?? 0), 0),
    16160000,
  );
  assert.equal(
    s.items.reduce((n, i) => n + (i.sourceAmount ?? 0), 0),
    24852000,
  );
});
test("foundation has three subprojects adding250000 exactly once", () => {
  const s = getTemplates()[7];
  assert.equal(s.subprojects.length, 3);
  assert.deepEqual(
    s.subprojects.map((p) => p.sourceAmount),
    [600000, 400000, 24000000],
  );
  assert.equal(
    s.items.reduce((n, i) => n + (i.sourceAmount ?? 0), 0),
    25000000,
  );
});
test("same-name bus rows preserve distinct IDs and source row numbers", () => {
  const s = getTemplates()[5];
  assert.equal(s.items[0].name, s.items[1].name);
  assert.notEqual(s.items[0].id, s.items[1].id);
  assert.notEqual(s.items[0].sourceRow, s.items[1].sourceRow);
  assert.ok(s.items.every((i) => i.transferPolicy === "locked"));
});
test("draft import is remapped, rejects expenses and approvals", () => {
  let s = base();
  const d = instantiateTemplate(getTemplates()[0], "copy");
  s = apply(s, { type: "importDraft", value: d });
  assert.equal(s.projects.length, 2);
  assert.equal(s.expenses.length, 0);
  assert.throws(() => apply(s, { type: "importDraft", value: d }), /ID/);
  d.projects[0].approvedAmount = 100;
  assert.throws(
    () => apply(base(), { type: "importDraft", value: d }),
    /待確認/,
  );
});
test("sixth seventh dynamic lines survive serialize reload and sorting", () => {
  let s = base();
  for (let n = 2; n <= 7; n++)
    s = apply(s, {
      type: "saveItem",
      value: {
        ...blankItem("i" + n, "p"),
        name: "項目" + n,
        originalName: "項目" + n,
        order: n,
      },
      reason: "新增",
    });
  s = apply(s, {
    type: "reorderItems",
    projectId: "p",
    ids: s.items.map((i) => i.id).reverse(),
  });
  const reloaded = validateState(JSON.parse(JSON.stringify(s)));
  assert.equal(reloaded.items.length, 7);
  assert.equal(reloaded.items.find((i) => i.id === "i7")!.order, 0);
});
test("same-name spending separated by ID and renamed original is preserved", () => {
  let s = base();
  s.items.push({
    ...blankItem("other", "p"),
    name: "同名項目",
    originalName: "原科目二",
    approvedAmount: 200000,
  });
  s = apply(s, { type: "saveExpense", value: expense() });
  assert.equal(itemSpent(s, "i"), 10000);
  assert.equal(itemSpent(s, "other"), 0);
  s = apply(s, {
    type: "saveItem",
    value: { ...s.items[0], name: "重新命名", inactive: true },
    reason: "保留歷史",
  });
  assert.equal(itemSpent(s, "i"), 10000);
  assert.throws(() => apply(s, { type: "removeItem", id: "i" }), /只能停用/);
  assert.throws(
    () => apply(s, { type: "saveExpense", value: { ...expense(), id: "e2" } }),
    /停用/,
  );
});
test("unknown approval cannot be spent; zero is explicit zero", () => {
  const s = base();
  s.projects[0].approvedAmount = null;
  s.projects[0].status = "draft";
  assert.equal(cap(s.projects[0]), null);
  assert.throws(
    () => apply(s, { type: "saveExpense", value: expense() }),
    /尚未核定/,
  );
  s.projects[0].approvedAmount = 0;
  s.projects[0].status = "active";
  assert.throws(() => apply(s, { type: "saveExpense", value: expense() }));
});
test("cannot spend across project or over item/project/group budget", () => {
  let s = base();
  assert.throws(
    () => apply(s, { type: "saveExpense", value: expense(600000) }),
    /項目/,
  );
  s.projects[0].approvedAmount = 5000;
  assert.throws(
    () => apply(s, { type: "saveExpense", value: expense() }),
    /計畫/,
  );
  s = base();
  s.groups.push({
    id: "g",
    projectId: "p",
    subprojectId: null,
    name: "群組",
    sourceAmount: null,
    approvedAmount: 5000,
    adjustedAmount: null,
    rules: [],
  });
  s.items[0].groupId = "g";
  assert.throws(
    () => apply(s, { type: "saveExpense", value: expense() }),
    /群組/,
  );
  s = base();
  s.projects.push({ ...blankProject("p2"), name: "另一案" });
  s.items[0].projectId = "p2";
  assert.throws(
    () => apply(s, { type: "saveExpense", value: expense() }),
    /不屬於/,
  );
});
test("allocation must equal voucher total and counting is once", () => {
  let s = base();
  s.items.push({
    ...blankItem("j", "p"),
    name: "分攤",
    originalName: "分攤",
    approvedAmount: 200000,
  });
  const e = expense();
  e.allocations = [
    { budgetItemId: "i", fundingSource: "", amount: 4000 },
    { budgetItemId: "j", fundingSource: "", amount: 6000 },
  ];
  s = apply(s, { type: "saveExpense", value: e });
  assert.equal(projectSpent(s, "p"), 10000);
  assert.equal(itemSpent(s, "i"), 4000);
  assert.equal(itemSpent(s, "j"), 6000);
  assert.throws(
    () =>
      apply(base(), {
        type: "saveExpense",
        value: {
          ...expense(),
          allocations: [{ budgetItemId: "i", fundingSource: "", amount: 9999 }],
        },
      }),
    /分攤合計/,
  );
});
test("teaching deducts leave fully and rejects time-unit substitution", () => {
  assert.equal(calculateTeaching(3, 1, 40000, "節", "節"), 80000);
  assert.equal(calculateTeaching(1.5, 0.25, 40000, "小時", "小時"), 50000);
  assert.equal(calculateTeaching(1, 1, 40000, "節", "節"), 0);
  assert.throws(() => calculateTeaching(1, 0, 80000, "小時", "節"), /單位/);
  assert.throws(() => calculateTeaching(1, 2, 40000, "節", "節"));
});
test("percentage estimates use selected bases, detect cycles and do not overwrite source", () => {
  const s = base();
  s.items[0].sourceAmount = 100000;
  s.items.push({
    ...blankItem("percent", "p"),
    name: "保費估算",
    originalName: "保費",
    calculation: "percent",
    percent: 2.11,
    baseItemIds: ["i"],
    sourceAmount: 50700,
  });
  assert.equal(calculatedAmount(s.items[1], s.items), 2110);
  assert.equal(s.items[1].sourceAmount, 50700);
  s.items[0].calculation = "percent";
  s.items[0].percent = 1;
  s.items[0].baseItemIds = ["percent"];
  assert.throws(() => validateState(s), /循環/);
});
test("unconfirmed ratio warns only; confirmed blocking rule enforces", () => {
  let s = base();
  const r = {
    id: "r",
    name: "比例",
    kind: "ratio" as const,
    value: 1,
    confirmed: false,
    effect: "block" as const,
    source: { document: "來源", location: "表", note: "待確認" },
  };
  s.items[0].rules = [r];
  assert.ok(warnings(s).length);
  assert.doesNotThrow(() =>
    apply(s, { type: "saveExpense", value: expense(20000) }),
  );
  s.items[0].rules[0].confirmed = true;
  assert.throws(
    () => apply(s, { type: "saveExpense", value: expense(20000) }),
    /比例/,
  );
  s.items[0].approvedAmount = 10000;
  assert.doesNotThrow(() =>
    apply(s, { type: "saveExpense", value: expense(10000) }),
  );
});
test("transfer preserves total, revisions, blocks locked or cross-project", () => {
  let s = base();
  s.items[0].transferPolicy = "allowed";
  s.items.push({
    ...blankItem("j", "p"),
    name: "流入",
    originalName: "流入",
    approvedAmount: 100000,
    transferPolicy: "allowed",
  });
  const next = apply(s, {
    type: "transferBudget",
    fromId: "i",
    toId: "j",
    amount: 10000,
    reason: "已確認同案流用",
  });
  assert.equal(cap(next.items[0])! + cap(next.items[1])!, 600000);
  assert.equal(next.revisions.length, 1);
  s.items[0].transferPolicy = "locked";
  assert.throws(
    () =>
      apply(s, {
        type: "transferBudget",
        fromId: "i",
        toId: "j",
        amount: 10000,
        reason: "嘗試",
      }),
    /禁止流用/,
  );
  assert.throws(
    () =>
      apply(s, {
        type: "saveItem",
        value: { ...s.items[0], approvedAmount: 400000 },
        reason: "改名繞過",
      }),
    /不可流用/,
  );
  s.items[1].projectId = "other";
  assert.throws(() =>
    apply(s, {
      type: "transferBudget",
      fromId: "i",
      toId: "j",
      amount: 10000,
      reason: "跨案",
    }),
  );
});
test("budget line allocations cannot exceed project cap by adding another name", () => {
  const s = base();
  assert.throws(
    () =>
      apply(s, {
        type: "saveItem",
        value: {
          ...blankItem("j", "p"),
          name: "繞過限制",
          approvedAmount: 600000,
        },
        reason: "測試",
      }),
    /合計超出計畫/,
  );
});
test("entry/viewer/editor cannot grant themselves approval or financial rules", () => {
  const s = base();
  assert.throws(
    () =>
      apply(
        s,
        { type: "saveExpense", value: expense() },
        { email: "view@example.test", role: "viewer" },
      ),
    /權限/,
  );
  assert.throws(
    () =>
      apply(
        s,
        { type: "saveProject", value: s.projects[0], reason: "越權" },
        entry,
      ),
    /權限/,
  );
  assert.throws(
    () =>
      apply(
        s,
        {
          type: "saveItem",
          value: { ...s.items[0], approvedAmount: 600000 },
          reason: "越權",
        },
        editor,
      ),
    /權限/,
  );
  assert.throws(
    () =>
      apply(
        s,
        {
          type: "saveItem",
          value: { ...s.items[0], maxUnitPrice: 1 },
          reason: "越權",
        },
        editor,
      ),
    /權限/,
  );
});
test("payment/claim/advance statuses do not change expense totals", () => {
  let s = apply(base(), { type: "saveExpense", value: expense() });
  s = apply(s, {
    type: "updateExpenseStatus",
    id: "e",
    paymentStatus: "paid",
    claimStatus: "closed",
    advanceStatus: "reimbursed",
    paymentDate: "2026-10-24",
  });
  assert.equal(projectSpent(s, "p"), 10000);
  assert.equal(s.expenses.length, 1);
});
test("planned weekly batch has no spend; settle taught once even on repeat", () => {
  let s = base();
  s.items[0] = {
    ...s.items[0],
    calculation: "teaching",
    unit: "節",
    unitPrice: 40000,
  };
  const record = {
    id: "t",
    projectId: "p",
    budgetItemId: "i",
    activityId: null,
    date: "2026-10-24",
    teacherName: "測試教師",
    unit: "節",
    quantity: 3,
    leaveQuantity: 1,
    unitPrice: 40000,
    status: "planned" as const,
    expenseId: null,
  };
  s = apply(s, { type: "saveTeachingBatch", values: [record] });
  assert.equal(s.expenses.length, 0);
  assert.throws(
    () => apply(s, { type: "settleTeaching", id: "t", expenseId: "te" }),
    /實上/,
  );
  s = apply(s, {
    type: "saveTeaching",
    value: { ...record, status: "taught" },
  });
  s = apply(s, { type: "settleTeaching", id: "t", expenseId: "te" });
  s = apply(s, { type: "settleTeaching", id: "t", expenseId: "again" });
  assert.equal(s.expenses.length, 1);
  assert.equal(projectSpent(s, "p"), 80000);
});
test("legacy migration is idempotent with stable mappings and preserves spend/photos", () => {
  const old = {
    projects: [
      {
        id: "old",
        name: "舊計畫",
        summary: "",
        totalBudget: 1000,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        limits: { hourly: 0, meal: 1000, tea: 0, material: 0, other: 0 },
        used: { hourly: 0, meal: 0, tea: 0, material: 0, other: 0 },
      },
    ],
    expenses: [
      {
        id: "old-e",
        projectId: "old",
        type: "meal" as const,
        amount: 100,
        date: "2026-10-24",
        description: "舊餐費",
        isAdvance: true,
        advancePerson: "舊代墊",
        advanceStatus: "paid" as const,
        photos: ["data:image/jpeg;base64,AA=="],
      },
    ],
  };
  const next = migrateLegacy(old);
  assert.deepEqual(migrateLegacy(next), next);
  assert.deepEqual(migrateLegacy(old), next);
  assert.equal(next.projects[0].approvedAmount, null);
  assert.equal(next.projects[0].legacyRecordedBudget, 100000);
  assert.equal(next.items.length, 5);
  assert.equal(next.attachments.length, 1);
  assert.equal(next.attachments[0].legacyDataUrl, old.expenses[0].photos[0]);
  assert.equal(reconciliation(old, next).consistent, true);
});
test("Excel retains dynamic rows, unknown approval, original names, and allocations", async () => {
  const s = apply(base(), { type: "saveExpense", value: expense() });
  s.items.push({
    ...blankItem("unknown", "p"),
    name: "待核定項目",
    originalName: "原表待定",
    sourceAmount: 11000000,
  });
  const w = await createWorkbook(s, s.expenses);
  const bytes = await w.xlsx.writeBuffer();
  assert.ok(bytes.byteLength > 1000);
  assert.equal(w.getWorksheet("預算明細")!.rowCount, 3);
  assert.equal(w.getWorksheet("預算明細")!.getCell("F3").value, "待核定項目");
  assert.equal(w.getWorksheet("預算明細")!.getCell("J3").value, "待核定");
  assert.equal(w.getWorksheet("支出明細")!.getCell("E2").value, 100);
  assert.equal(w.getWorksheet("支出分攤")!.getCell("C2").value, "原始科目");
});

test("entry cannot approve or close a newly created claim", () => {
  assert.throws(
    () =>
      apply(
        base(),
        { type: "saveExpense", value: { ...expense(), claimStatus: "closed" } },
        entry,
      ),
    /權限/,
  );
});
test("configured unit ceiling cannot be bypassed with null price or forged total", () => {
  const s = base();
  s.items[0].maxUnitPrice = 12000;
  assert.throws(
    () => apply(s, { type: "saveExpense", value: expense() }),
    /單價/,
  );
  assert.throws(
    () =>
      apply(s, {
        type: "saveExpense",
        value: { ...expense(30000), unit: "式", quantity: 1, unitPrice: 10000 },
      }),
    /金額計算不一致/,
  );
});
test("legacy unspecified payment and claim states remain unknown", () => {
  const next = migrateLegacy({ projects: [], expenses: [] });
  assert.equal(next.schemaVersion, 2);
  const old = {
    projects: [
      {
        id: "p",
        name: "舊計畫",
        summary: "",
        totalBudget: 1000,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        limits: { hourly: 0, meal: 1000, tea: 0, material: 0, other: 0 },
        used: { hourly: 0, meal: 0, tea: 0, material: 0, other: 0 },
      },
    ],
    expenses: [
      {
        id: "e",
        projectId: "p",
        type: "meal",
        amount: 100,
        date: "2026-10-24",
        description: "舊支出",
        isAdvance: false,
        photos: [],
      },
    ],
  };
  const result = migrateLegacy(old);
  assert.equal(result.expenses[0].paymentStatus, "unknown");
  assert.equal(result.expenses[0].claimStatus, "unknown");
});
