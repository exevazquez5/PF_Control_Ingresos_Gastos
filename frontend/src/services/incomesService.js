import api from '../api/axios.config.js';

export const getIncomes = async () => {
  const res = await api.get('/Incomes');
  return res.data;
};

export const getIncomeById = async (id) => {
  const res = await api.get(`/Incomes/${id}`);
  return res.data;
};

export const createIncome = async (data) => {
  const res = await api.post('/Incomes', data);
  return res.data;
};

export const updateIncome = async (id, data) => {
  const res = await api.put(`/Incomes/${id}`, data);
  return res.data;
};

export const deleteIncome = async (id) => {
  const res = await api.delete(`/Incomes/${id}`);
  return res.data;
};

export const archiveIncome = async (id) => {
  const res = await api.post(`/Incomes/${id}/archive`);
  return res.data;
};

export const restoreIncome = async (id) => {
  const res = await api.post(`/Incomes/${id}/restore`);
  return res.data;
};

export const getDeletedIncomes = async () => {
  const res = await api.get('/Incomes/deleted');
  return res.data;
};

export const getIncomesSummary = async (userId) => {
  const res = await api.get(`/Incomes/summary/${userId}`);
  return res.data;
};

export const filterIncomes = async (params) => {
  const res = await api.get('/Incomes/filter', { params });
  return res.data;
};
