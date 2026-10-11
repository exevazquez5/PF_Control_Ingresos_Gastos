import api from '../api/axios.config.js';

const getPeriod = (offset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const getBudgetProgress = async (offset = 0) => {
  const period = getPeriod(offset);
  const res = await api.get(`/Budgets/${period}/progress`);
  return res.data;
};

export const getCurrentBudget = async () => {
  const res = await api.get('/Budgets/current');
  return res.data;
};

export const getBudgetByPeriod = async (offset = 0) => {
  const period = getPeriod(offset);
  const res = await api.get(`/Budgets/by-period/${period}`);
  return {
    data: res.data,
    isInherited: res.headers['x-budget-inherited'] === 'true',
  };
};

export const getAllBudgets = async () => {
  const res = await api.get('/Budgets');
  return res.data;
};

export const getBudgetById = async (id) => {
  const res = await api.get(`/Budgets/${id}`);
  return res.data;
};

export const createBudget = async (payload) => {
  const res = await api.post('/Budgets', payload);
  return res.data;
};

export const updateBudget = async (id, payload) => {
  const res = await api.put(`/Budgets/${id}`, payload);
  return res.data;
};

export const deleteBudget = async (id) => {
  const res = await api.delete(`/Budgets/${id}`);
  return res.data;
};

export const archiveBudget = async (id) => {
  const res = await api.post(`/Budgets/${id}/archive`);
  return res.data;
};

export const restoreBudget = async (id) => {
  const res = await api.post(`/Budgets/${id}/restore`);
  return res.data;
};

export const getDeletedBudgets = async () => {
  const res = await api.get('/Budgets/deleted');
  return res.data;
};

export const canSpend = async (period, amount, categoryId = null) => {
  const res = await api.post('/Budgets/can-spend', {
    period,
    amount,
    categoryId,
  });
  return res.data;
};
