import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateHourly,
  reducer,
  validateState,
  initialState,
} from "../src/legacy/state";
import { parseSheet, serializeSheet, saveToSheet } from "../src/legacy/api";
import {
  emptyLimits,
  type AppState,
  type Expense,
  type Project,
} from "../src/legacy/types";
const project: Project = {
  id: "p1",
  name: "測試計畫",
  summary: "",
  totalBudget: 1000,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  limits: { ...emptyLimits(), hourly: 800, meal: 200 },
  used: emptyLimits(),
};
const base: AppState = { projects: [project], expenses: [] };
const expense: Expense = {
  id: "e1",
  projectId: "p1",
  type: "meal",
  amount: 100,
  date: "2026-06-01",
  description: "餐費",
  isAdvance: false,
  photos: [],
};
const table = (s: AppState) => [
  ["key", "value"],
  ["projects", JSON.stringify(s.projects)],
  ["expenses", JSON.stringify(s.expenses)],
];
test("leave is deducted in full, including fractional hours", () => {
  assert.equal(calculateHourly(3, 1, 400), 800);
  assert.equal(calculateHourly(1.5, 0.25, 400), 500);
  assert.equal(calculateHourly(1, 1, 400), 0);
  assert.throws(() => calculateHourly(1, 2, 400));
  assert.throws(() => calculateHourly(NaN, 0, 400));
});
test("used totals are recalculated rather than trusted", () => {
  assert.equal(
    validateState({
      projects: [{ ...project, used: { ...emptyLimits(), meal: 999 } }],
      expenses: [expense],
    }).projects[0].used.meal,
    100,
  );
});
test("expense create/delete adjusts budgets and project deletion cascades", () => {
  const s = reducer(base, { type: "ADD_EXPENSE", payload: expense });
  assert.equal(s.projects[0].used.meal, 100);
  assert.equal(
    reducer(s, { type: "DELETE_EXPENSE", payload: "e1" }).projects[0].used.meal,
    0,
  );
  assert.deepEqual(
    reducer(s, { type: "DELETE_PROJECT", payload: "p1" }),
    initialState,
  );
});
test("reject category overspending, invalid dates, orphans and duplicate IDs", () => {
  assert.throws(() =>
    reducer(base, {
      type: "ADD_EXPENSE",
      payload: { ...expense, amount: 201 },
    }),
  );
  assert.throws(() =>
    reducer(base, {
      type: "ADD_EXPENSE",
      payload: { ...expense, date: "2027-01-01" },
    }),
  );
  assert.throws(() =>
    reducer(base, {
      type: "ADD_EXPENSE",
      payload: { ...expense, projectId: "missing" },
    }),
  );
  assert.throws(() => validateState({ ...base, expenses: [expense, expense] }));
});
test("total budget cannot be exceeded across categories", () => {
  const small = { projects: [{ ...project, totalBudget: 50 }], expenses: [] };
  assert.throws(() =>
    reducer(small, { type: "ADD_EXPENSE", payload: expense }),
  );
});
test("project budget cannot be reduced below spend", () => {
  const s = reducer(base, { type: "ADD_EXPENSE", payload: expense });
  assert.throws(() =>
    reducer(s, {
      type: "UPDATE_PROJECT",
      payload: { ...project, totalBudget: 50 },
    }),
  );
});
test("hourly calculation cannot be bypassed by form payload", () => {
  assert.throws(() =>
    reducer(base, {
      type: "ADD_EXPENSE",
      payload: {
        ...expense,
        type: "hourly",
        amount: 400,
        hours: 2,
        leaveHours: 1,
        actualHours: 2,
        hourlyRate: 400,
        teacherName: "教師",
      },
    }),
  );
});
test("advance status update preserves totals", () => {
  const s = reducer(base, {
    type: "ADD_EXPENSE",
    payload: {
      ...expense,
      isAdvance: true,
      advancePerson: "測試人",
      advanceStatus: "pending",
    },
  });
  const next = reducer(s, {
    type: "UPDATE_EXPENSE",
    payload: { ...s.expenses[0], advanceStatus: "reimbursed" },
  });
  assert.equal(next.projects[0].used.meal, 100);
  assert.equal(next.expenses[0].advanceStatus, "reimbursed");
});
test("malformed sheet data never becomes empty successful state", () => {
  assert.throws(() => parseSheet([]));
  assert.throws(() =>
    parseSheet([
      ["key", "value"],
      ["projects", "bad"],
      ["expenses", "[]"],
    ]),
  );
  assert.throws(() =>
    parseSheet([
      ["key", "value"],
      ["projects", "[]"],
    ]),
  );
  assert.throws(() => parseSheet([...table(base), ["projects", "[]"]]));
  assert.deepEqual(parseSheet(table(base)), base);
});
test("sheet cell size is checked before sending photos", () => {
  assert.throws(() =>
    serializeSheet({
      ...base,
      expenses: [{ ...expense, photos: ["x".repeat(46000)] }],
    }),
  );
});
test("GET network error never sends POST", async () => {
  const original = globalThis.fetch;
  let posts = 0;
  globalThis.fetch = async (_input, options) => {
    if (options?.method === "POST") posts++;
    throw new Error("offline");
  };
  try {
    await assert.rejects(saveToSheet(base, base), /offline/);
    assert.equal(posts, 0);
  } finally {
    globalThis.fetch = original;
  }
});
test("remote concurrent edit blocks POST", async () => {
  const original = globalThis.fetch;
  let posts = 0;
  globalThis.fetch = async (_input, options) => {
    if (options?.method === "POST") posts++;
    return Response.json(table(initialState));
  };
  try {
    await assert.rejects(saveToSheet(base, base), /其他電腦/);
    assert.equal(posts, 0);
  } finally {
    globalThis.fetch = original;
  }
});
test("POST application failure, HTML, and HTTP errors are surfaced", async () => {
  const original = globalThis.fetch;
  try {
    for (const response of [
      Response.json({ error: "failed" }),
      new Response("<html>login</html>"),
      new Response("denied", { status: 403 }),
    ]) {
      globalThis.fetch = async (_input, options) =>
        options?.method === "POST" ? response : Response.json(table(base));
      await assert.rejects(saveToSheet(base, base));
    }
  } finally {
    globalThis.fetch = original;
  }
});
test("success requires matching read-after-write verification", async () => {
  const original = globalThis.fetch;
  const next = reducer(base, { type: "ADD_EXPENSE", payload: expense });
  let written = false;
  globalThis.fetch = async (_input, options) => {
    if (options?.method === "POST") {
      written = true;
      return Response.json({ success: true });
    }
    return Response.json(table(written ? next : base));
  };
  try {
    assert.deepEqual(await saveToSheet(next, base), next);
  } finally {
    globalThis.fetch = original;
  }
});
test("a successful POST with mismatched readback remains an error", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_input, options) =>
    options?.method === "POST"
      ? Response.json({ success: true })
      : Response.json(table(base));
  try {
    await assert.rejects(
      saveToSheet(
        reducer(base, { type: "ADD_EXPENSE", payload: expense }),
        base,
      ),
      /驗證不一致/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
