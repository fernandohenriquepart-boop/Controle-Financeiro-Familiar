import { test } from "node:test";
import assert from "node:assert/strict";
import { nextDueDate, monthlyDates, splitAmount, billingDueDate, buildInstallmentSchedule, buildRecurringSchedule } from "./installments.js";

function iso(date) {
  return date.toISOString().slice(0, 10);
}

test("nextDueDate: pula pro próximo mês quando o dia já passou", () => {
  assert.equal(iso(nextDueDate(new Date(2026, 2, 20), 10)), "2026-04-10");
});
test("nextDueDate: usa o mesmo mês quando o dia ainda não chegou", () => {
  assert.equal(iso(nextDueDate(new Date(2026, 2, 5), 10)), "2026-03-10");
});
test("nextDueDate: no dia exato, considera já vencido e pula pro próximo mês", () => {
  assert.equal(iso(nextDueDate(new Date(2026, 2, 10), 10)), "2026-04-10");
});
test("nextDueDate: clampa em mês curto (dia 31 em fevereiro)", () => {
  assert.equal(iso(nextDueDate(new Date(2026, 0, 20), 31)), "2026-01-31");
  assert.equal(iso(nextDueDate(new Date(2026, 0, 31), 31)), "2026-02-28");
});

test("monthlyDates: gera uma data por mês, mesmo dia, virando o ano", () => {
  const dates = monthlyDates(new Date(2026, 10, 15), 4).map(iso); // nov/2026
  assert.deepEqual(dates, ["2026-11-15", "2026-12-15", "2027-01-15", "2027-02-15"]);
});
test("monthlyDates: clampa em mês curto durante a série (dia 31)", () => {
  const dates = monthlyDates(new Date(2026, 0, 31), 3).map(iso); // jan/2026
  assert.deepEqual(dates, ["2026-01-31", "2026-02-28", "2026-03-31"]);
});

test("splitAmount: divide igualmente quando é exato", () => {
  assert.deepEqual(splitAmount(300, 3), [100, 100, 100]);
});
test("splitAmount: última parcela absorve o resto do arredondamento e a soma bate", () => {
  const parts = splitAmount(100, 3);
  assert.deepEqual(parts, [33.33, 33.33, 33.34]);
  assert.equal(Math.round(parts.reduce((a, b) => a + b, 0) * 100), 10000);
});

test("billingDueDate: compra no meio do ciclo (antes do fechamento) cai no vencimento seguinte", () => {
  // fecha dia 25, vence dia 10; compra em 15/mar, ainda antes do fechamento de março
  assert.equal(iso(billingDueDate(new Date(2026, 2, 15), 25, 10)), "2026-04-10");
});
test("billingDueDate: compra logo depois do fechamento pula uma fatura inteira", () => {
  // fecha dia 25, vence dia 10; compra em 27/mar, já depois do fechamento de março
  // uma lógica que olhasse só o vencimento diria 10/abr — mas essa compra só entra
  // na fatura seguinte, vencendo 10/mai.
  assert.equal(iso(billingDueDate(new Date(2026, 2, 27), 25, 10)), "2026-05-10");
});

test("buildInstallmentSchedule: compra parcelada agenda a partir da fatura efetiva da compra", () => {
  const schedule = buildInstallmentSchedule({
    purchaseDate: new Date(2026, 2, 15), // 15/mar — fecha dia 25, vence dia 10
    closingDay: 25,
    dueDay: 10,
    count: 3,
    totalAmount: 300,
  });
  assert.deepEqual(
    schedule.map((s) => iso(s.date)),
    ["2026-04-10", "2026-05-10", "2026-06-10"]
  );
  assert.deepEqual(schedule.map((s) => s.amount), [100, 100, 100]);
});

test("buildRecurringSchedule: primeira ocorrência é a própria data informada", () => {
  const schedule = buildRecurringSchedule({ startDate: new Date(2026, 2, 5), count: 3, amount: 1500 });
  assert.deepEqual(
    schedule.map((s) => iso(s.date)),
    ["2026-03-05", "2026-04-05", "2026-05-05"]
  );
  assert.ok(schedule.every((s) => s.amount === 1500));
});
