import { parseApiDate } from './date';

export function isIncome(t) {
  return t.type === 'ingreso';
}

export function isExpense(t) {
  return t.type === 'gasto' || t.type === 'cuota';
}

export function sumIncomes(list) {
  return list.filter(isIncome).reduce((sum, t) => sum + t.amount, 0);
}

export function sumExpenses(list) {
  return list.filter(isExpense).reduce((sum, t) => sum + t.amount, 0);
}

export function sumExpensesByFundingSource(list, fundingSource) {
  return list
    .filter(t => isExpense(t) && t.fundingSource === fundingSource)
    .reduce((sum, t) => sum + t.amount, 0);
}

export function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function filterByMonth(transactions, start) {
  const next = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return transactions.filter(t => {
    const d = parseApiDate(t.date);
    return d >= start && d < next;
  });
}
