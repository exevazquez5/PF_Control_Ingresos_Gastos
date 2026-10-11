import api from '../api/axios.config.js';

export const getCategories = async () => {
  const res = await api.get('/Categories');
  return res.data;
};

export const getCategoriesFlat = async () => {
  const res = await api.get('/Categories/flat');
  return res.data;
};

export const getCategoriesByType = async (type) => {
  const res = await api.get(`/Categories/by-type/${type}`);
  return res.data;
};

export const getCategoryById = async (id) => {
  const res = await api.get(`/Categories/${id}`);
  return res.data;
};

export const createCategory = async (data) => {
  const res = await api.post('/Categories', data);
  return res.data;
};

export const updateCategory = async (id, data) => {
  const res = await api.put(`/Categories/${id}`, data);
  return res.data;
};

export const archiveCategory = async (id) => {
  const res = await api.post(`/Categories/${id}/archive`);
  return res.data;
};

export const restoreCategory = async (id) => {
  const res = await api.post(`/Categories/${id}/restore`);
  return res.data;
};

export const deleteCategory = async (id) => {
  const res = await api.delete(`/Categories/${id}`);
  return res.data;
};

export const getArchivedCategories = async () => {
  const res = await api.get('/Categories/archived');
  return res.data;
};
