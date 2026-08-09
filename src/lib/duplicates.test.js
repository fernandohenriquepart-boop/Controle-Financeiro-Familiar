import { test } from "node:test";
import assert from "node:assert/strict";
import { findDuplicateGroups } from "./duplicates.js";

function tx(overrides) {
  return { id: "id", type: "expense", accountId: "acc-1", date: "2026-08-05", amount: 100, ...overrides };
}

test("findDuplicateGroups: agrupa duas transações com mesmo tipo, conta, data e valor", () => {
  const a = tx({ id: "a" });
  const b = tx({ id: "b" });
  const groups = findDuplicateGroups([a, b]);
  assert.equal(groups.length, 1);
  assert.deepEqual(
    groups[0].map((t) => t.id),
    ["a", "b"]
  );
});

test("findDuplicateGroups: não agrupa quando o valor difere", () => {
  const groups = findDuplicateGroups([tx({ id: "a", amount: 100 }), tx({ id: "b", amount: 100.01 })]);
  assert.equal(groups.length, 0);
});

test("findDuplicateGroups: não agrupa quando a conta difere", () => {
  const groups = findDuplicateGroups([tx({ id: "a", accountId: "acc-1" }), tx({ id: "b", accountId: "acc-2" })]);
  assert.equal(groups.length, 0);
});

test("findDuplicateGroups: não agrupa quando o tipo difere (receita vs despesa)", () => {
  const groups = findDuplicateGroups([tx({ id: "a", type: "expense" }), tx({ id: "b", type: "income" })]);
  assert.equal(groups.length, 0);
});

test("findDuplicateGroups: trata accountId ausente como um único grupo 'sem conta'", () => {
  const groups = findDuplicateGroups([tx({ id: "a", accountId: undefined }), tx({ id: "b", accountId: undefined })]);
  assert.equal(groups.length, 1);
});

test("findDuplicateGroups: grupo com três lançamentos iguais vem junto", () => {
  const groups = findDuplicateGroups([tx({ id: "a" }), tx({ id: "b" }), tx({ id: "c" })]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].length, 3);
});

test("findDuplicateGroups: transação sozinha (sem duplicata) não aparece", () => {
  const groups = findDuplicateGroups([tx({ id: "a" }), tx({ id: "b", date: "2026-08-06" })]);
  assert.equal(groups.length, 0);
});

test("findDuplicateGroups: ordena grupos por data mais recente primeiro", () => {
  const older = [tx({ id: "a", date: "2026-01-10" }), tx({ id: "b", date: "2026-01-10" })];
  const newer = [tx({ id: "c", date: "2026-06-01" }), tx({ id: "d", date: "2026-06-01" })];
  const groups = findDuplicateGroups([...older, ...newer]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0][0].date, "2026-06-01");
  assert.equal(groups[1][0].date, "2026-01-10");
});
