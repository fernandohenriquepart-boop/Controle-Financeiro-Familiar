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

/** Agenda de uma compra parcelada: 1ª parcela na próxima data de vencimento do cartão após a compra. */
export function buildInstallmentSchedule({ purchaseDate, dueDay, count, totalAmount }) {
  const firstDate = nextDueDate(purchaseDate, dueDay);
  const dates = monthlyDates(firstDate, count);
  const amounts = splitAmount(totalAmount, count);
  return dates.map((date, i) => ({ date, amount: amounts[i] }));
}

/** Agenda de uma despesa/receita recorrente: 1ª ocorrência é a própria data informada. */
export function buildRecurringSchedule({ startDate, count, amount }) {
  const dates = monthlyDates(startDate, count);
  return dates.map((date) => ({ date, amount }));
}
