import axios from 'axios';
import api from '../api/axios.config.js';

/** POST a new transaction in the given base ('Incomes'|'Expenses') */
export async function postTransactionOnServer({ base, body, token }) {
  const config = { headers: { Authorization: `Bearer ${token}` } };
  const res = await api.post(
    `/${base}`,
    body,
    config
  );
  return res.data;
}

/** PUT to update an existing transaction */
export async function putTransactionOnServer({ base, id, body, token }) {
  const config = { headers: { Authorization: `Bearer ${token}` } };
  await api.put(
    `/${base}/${id}`,
    body,
    config
  );
}

/** DELETE a transaction by id */
export async function deleteTransactionOnServer({ base, id, token }) {
  const config = { headers: { Authorization: `Bearer ${token}` } };
  await api.delete(
    `/${base}/${id}`,
    config
  );
}

/** Campos exclusivos de ingresos: bruto (D4) y recurrencia (D10) */
export function incomeFields(formData) {
  if ((formData.type || '').toLowerCase() !== 'ingreso') return {};
  return {
    grossAmount: formData.grossAmount ? parseFloat(formData.grossAmount) : null,
    isRecurring: !!formData.isRecurring
  };
}

/** Build transaction body from formData */
export function buildBody(formData, userId) {
  return {
    amount:      parseFloat(formData.amount),
    ...incomeFields(formData),
    description: formData.description,
    date:        new Date(formData.date).toISOString(),
    categoryId:  Number(formData.categoryId),
    userId:      Number(userId),
    fundingSource: formData.fundingSource || "Income"
  };
}

/** Replace an existing transaction in array */
export function replaceTransaction(transactions, updated) {
  return transactions.map(t =>
    t.id === updated.id ? { ...t, ...updated } : t
  );
}

/** Add a new transaction to array */
export function addTransaction(transactions, newTx) {
  return [...transactions, newTx];
}
