import api from "../api/axios.config.js";

export const getCreditCards = async () => {
  const response = await api.get("/CreditCards");
  return response.data;
};

export const createCreditCard = async (payload) => {
  const response = await api.post("/CreditCards", payload);
  return response.data;
};

export const updateCreditCard = async (id, payload) => {
  const response = await api.put(`/CreditCards/${id}`, payload);
  return response.data;
};

export const deleteCreditCard = async (id) => {
  const response = await api.delete(`/CreditCards/${id}`);
  return response.data;
};

export const archiveCreditCard = async (id) => {
  const response = await api.post(`/CreditCards/${id}/archive`);
  return response.data;
};

export const restoreCreditCard = async (id) => {
  const response = await api.post(`/CreditCards/${id}/restore`);
  return response.data;
};

export const getDeletedCreditCards = async () => {
  const response = await api.get("/CreditCards/deleted");
  return response.data;
};
