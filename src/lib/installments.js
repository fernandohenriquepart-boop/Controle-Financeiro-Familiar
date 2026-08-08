// Matemática pura de agendamento: parcelas de cartão e ocorrências de
// despesas/receitas recorrentes. Sem I/O — quem lê/grava no Supabase é
// src/services/recurringSeries.js.

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function dateAt(year, monthIndex, day) {
  const clampedDay = Math.min(day, daysInMonth(year, monthIndex));
  return new Date(year, monthIndex, clampedDay);
}

/** Próxima ocorrência do dia `dueDay` estritamente depois de `fromDate`. */
export function nextDueDate(fromDate, dueDay) {
  const from = new Date(fromDate);
  const day = dueDay ?? from.getDate();
  let candidate = dateAt(from.getFullYear(), from.getMonth(), day);
  if (candidate <= from) {
    candidate = dateAt(from.getFullYear(), from.getMonth() + 1, day);
  }
  return candidate;
}

/** `count` datas, uma por mês, começando em `firstDate` (mesmo dia do mês, com clamp em meses curtos). */
export function monthlyDates(firstDate, count) {
  const first = new Date(firstDate);
  const day = first.getDate();
  const dates = [];
  for (let i = 0; i < count; i++) {
    dates.push(dateAt(first.getFullYear(), first.getMonth() + i, day));
  }
  return dates;
}

/** Divide `total` em `count` parcelas de 2 casas decimais que somam exatamente `total`. */
export function splitAmount(total, count) {
  const cents = Math.round(total * 100);
  const baseCents = Math.floor(cents / count);
  const remainder = cents - baseCents * count;
  const amounts = Array.from({ length: count }, (_, i) => baseCents + (i === count - 1 ? remainder : 0));
  return amounts.map((c) => c / 100);
}

/**
 * Data efetiva de cobrança de uma compra no cartão: quem decide em qual
 * fatura ela cai é o dia de FECHAMENTO, não o de vencimento — uma compra
 * feita logo depois do fechamento deste mês já pula pra fatura seguinte,
 * mesmo estando bem antes do próximo vencimento. Dois passos, reaproveitando
 * nextDueDate: acha o fechamento que essa compra pega, depois o próximo
 * vencimento depois desse fechamento.
 *
 * Limitação aceita: assume o dia de fechamento fixo todo mês (bancos às
 * vezes deslocam 1-2 dias por fim de semana/feriado) — compras bem no dia
 * exato do fechamento podem cair na fatura "errada" por um mês. Cobre bem o
 * caso comum (compra no meio do ciclo).
 */
export function billingDueDate(purchaseDate, closingDay, dueDay) {
  const closingDate = nextDueDate(purchaseDate, closingDay);
  return nextDueDate(closingDate, dueDay);
}

/** Agenda de uma compra parcelada: 1ª parcela na fatura efetiva da compra (ver billingDueDate). */
export function buildInstallmentSchedule({ purchaseDate, closingDay, dueDay, count, totalAmount }) {
  const firstDate = billingDueDate(purchaseDate, closingDay, dueDay);
  const dates = monthlyDates(firstDate, count);
  const amounts = splitAmount(totalAmount, count);
  return dates.map((date, i) => ({ date, amount: amounts[i] }));
}

/** Agenda de uma despesa/receita recorrente: 1ª ocorrência é a própria data informada. */
export function buildRecurringSchedule({ startDate, count, amount }) {
  const dates = monthlyDates(startDate, count);
  return dates.map((date) => ({ date, amount }));
}
