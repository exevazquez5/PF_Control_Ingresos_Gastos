import api from '../api/axios.config.js';

export const getExpenses = async (userId, monthOffset = 0) => {
  if (!userId) throw new Error("userId inválido");

  monthOffset = Number(monthOffset) || 0;

  const today = new Date();
  const startOfThis = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);

  const isCurrentMonth = monthOffset === 0;

  const expensesUrl = isCurrentMonth
    ? `/Expenses/current-month`
    : `/Expenses/month/${startOfThis.getMonth() + 1}/${startOfThis.getFullYear()}`;

  const [resDirectos, cuotasPagadas] = await Promise.all([
    api.get(expensesUrl),
    fetchCuotasPagadasDelMes(userId, monthOffset),
  ]);

  const directos = resDirectos.data
    .filter((e) => e.tieneCuotas === false)
    .map((e) => ({
      id: e.id,
      description: e.description,
      amount: e.amount,
      date: e.date,
      categoryId: e.categoryId,
      categoryName: e.categoryName,
      type: "directo",
      fundingSource: e.fundingSource,
      isDeleted: e.isDeleted,
      deletedAt: e.deletedAt,
    }));

  return [...directos, ...cuotasPagadas];
};

export const fetchCuotasPagadasDelMes = async (userId, offset = 0) => {
    const base = new Date();
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    const targetDate = new Date(base.getFullYear(), base.getMonth() + offset, 1);

    const anio = targetDate.getFullYear();
    const mes = targetDate.getMonth() + 1;

    try {
      const response = await api.get(`/Expenses/cuotas/pagadas/${userId}/${anio}/${mes}`);

      const data = response.data;

      return data.map((cuota) => ({
        id: cuota.id,
        expenseId: cuota.expenseId,
        expenseDate: cuota.expenseDate,
        description: cuota.expenseDescription,
        categoryId: cuota.expenseCategoryId,
        categoryName: cuota.expenseCategoryNombre,
        amount: cuota.montoCuota,
        date: cuota.paidAt || cuota.fechaPago || cuota.dueDate,
        type: "cuota",
        totalCuotas: cuota.totalCuotas ?? 0,
        pagadas: cuota.pagadas ?? 0,
        restantes: cuota.restantes ?? 0,
        fundingSource: cuota.fundingSource || 'Income',
      }));

    } catch (err) {
      console.error("Error al obtener cuotas pagadas:", err);
      return [];
    }
};

export const fetchCuotasPendientes = async (userId, offset = 0) => {
  const base = new Date();
  base.setDate(1);
  base.setHours(0, 0, 0, 0);
  const targetDate = new Date(base.getFullYear(), base.getMonth() + offset, 1);

  const anio = targetDate.getFullYear();
  const mes = targetDate.getMonth() + 1;

  try {
    const response = await api.get(`/Expenses/cuotas/${userId}/${anio}/${mes}`);
    const data = response.data;
    
    return data
      .filter((cuota) => (cuota.status || cuota.estado || "").toLowerCase() !== "paid")
      .map((cuota) => ({
        id: cuota.id,
        expenseId: cuota.expenseId,
        expenseDate: cuota.expenseDate,
        descripcionGasto: cuota.expenseDescription || "Sin descripción",
        categoria: cuota.expenseCategoryNombre || "Sin categoría",
        nroCuota: cuota.nroCuota,
        dueDate: cuota.dueDate || cuota.fechaPago,
        montoCuota: cuota.montoCuota,
        pagadas: cuota.pagadas ?? null,
        restantes: cuota.restantes ?? null,
        totalCuotas: cuota.totalCuotas ?? null,
      }));
  } catch (err) {
    console.error("Error al obtener cuotas pendientes:", err);
    return [];
  }
};

export const pagarCuota = async (idCuota) => {
    const response = await api.put(`/Expenses/cuotas/${idCuota}/pagar`, null);
    return response.data;
};

export const pagarTodasCuotas = async (userId, anio, mes) => {
    const response = await api.put(`/Expenses/cuotas/pagar-todas/${userId}/${anio}/${mes}`);
    return response.data;
};

export const archiveExpense = async (id) => {
  const res = await api.post(`/Expenses/${id}/archive`);
  return res.data;
};

export const restoreExpense = async (id) => {
  const res = await api.post(`/Expenses/${id}/restore`);
  return res.data;
};

export const getDeletedExpenses = async () => {
  const res = await api.get('/Expenses/deleted');
  return res.data;
};
