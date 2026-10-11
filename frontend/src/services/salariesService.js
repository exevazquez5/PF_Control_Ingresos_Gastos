import api from '../api/axios.config.js';

export const getSalaries = async () => {
  const res = await api.get('/Salaries');
  return res.data;
};

export const getSalaryById = async (id) => {
  const res = await api.get(`/Salaries/${id}`);
  return res.data;
};

export const createSalary = async (data) => {
  const res = await api.post('/Salaries', data);
  return res.data;
};

export const updateSalary = async (id, data) => {
  const res = await api.put(`/Salaries/${id}`, data);
  return res.data;
};

export const deleteSalary = async (id) => {
  const res = await api.delete(`/Salaries/${id}`);
  return res.data;
};
