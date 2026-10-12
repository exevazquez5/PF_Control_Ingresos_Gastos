import api from '../api/axios.config.js';

export const getIncomeSources = async () => {
  const res = await api.get('/IncomeSources');
  return res.data;
};
