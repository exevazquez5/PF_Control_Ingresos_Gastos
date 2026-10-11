import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3, PieChart, Grid3X3,ChevronLeft, ChevronRight, Wallet, Settings, Banknote } from 'lucide-react';
import { PieChart as RechartsPieChart, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Pie } from 'recharts';
import { useNavigate } from 'react-router-dom';
import SuccessModal from './SucessModal';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import ErrorModal from "./ErrorModal";
import BudgetCard from './BudgetCard';
import CategoriesSettings from '../settings/CategoriesSettings';
import { parseJwt } from '../utils/jwt';
import TimeSeriesChart from './TimeSeriesChart';
import {
  postTransactionOnServer,
  putTransactionOnServer,
  deleteTransactionOnServer,
  buildBody,
  replaceTransaction,
  addTransaction
} from '../utils/transactionService';
import api from '../api/axios.config.js';
import { createCreditCard, getCreditCards } from "../services/creditCardsService";
import { getBudgetProgress, getCurrentBudget, getBudgetByPeriod, createBudget, updateBudget, deleteBudget } from "../services/budgetsService";
import { getCategoriesFlat } from "../services/categoriesService";
import { parseApiDate } from "../utils/date";

  const COLORS = ['#4ade80', '#f87171', '#60a5fa']; // verde, rojo, azul

  const Dashboard = () => {
  const navigate = useNavigate();

  // Estado general
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [enCuotas, setEnCuotas] = useState(false);
  const [cantidadCuotas, setCantidadCuotas] = useState('');
  const [creditCards, setCreditCards] = useState([]);
  const [selectedCreditCardId, setSelectedCreditCardId] = useState("");
  const [showCreditCardModal, setShowCreditCardModal] = useState(false);
  const [creditCardForm, setCreditCardForm] = useState({ name: "", closingDay: "", dueDay: "" });

  // Estado de transacciones
  const [allTransactions, setAllTransactions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [formData, setFormData] = useState({
    type: 'ingreso',
    category: '',
    amount: '',
    date: '',
    description: '',
    categoryId: '',
    fundingSource: 'Income'
    });
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formError, setFormError] = useState('');
  const [chartView, setChartView] = useState('default');
  const [showFundingSuggestion, setShowFundingSuggestion] = useState(false);

  const [filteredData, setFilteredData] = useState('');

  // Estado de modales
  const [showModal, setShowModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState({ show: false, target: null, type: null });

  // Panel admin
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminView, setAdminView] = useState('summary');
  const [summaryData, setSummaryData] = useState(null);
  const [summaryUserId, setSummaryUserId] = useState('');
  const [filterParams, setFilterParams] = useState({
    userId: '',
    categoryId: '',
    from: '',
    to: ''
  });

  const [notFoundMessage, setNotFoundMessage] = useState("");

  // Budget
  const [budgetProgress, setBudgetProgress] = useState(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetMode, setBudgetMode] = useState('create');
  const [currentBudgetId, setCurrentBudgetId] = useState(null);
  const [budgetGlobalAmount, setBudgetGlobalAmount] = useState('');
  const [budgetCategoryRows, setBudgetCategoryRows] = useState([]);
  const [budgetFormLoading, setBudgetFormLoading] = useState(false);
  const [budgetIsInherited, setBudgetIsInherited] = useState(false);

  // Categorías
  const [categories, setCategories] = useState([]);
  const [showCategoriesSettings, setShowCategoriesSettings] = useState(false);
  const [currentType, setCurrentType] = useState('gasto');

  // Calculamos el primer día del mes seleccionado y el siguiente
  const today       = new Date();
  const startOfThis = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const startOfNext = new Date(startOfThis.getFullYear(), startOfThis.getMonth() + 1, 1);

  // Filtramos solo las transacciones de ese mes
  const periodTransactions = transactions.filter(t => {
    const d = parseApiDate(t.date);
    return d >= startOfThis && d < startOfNext;
  });

  const totalIncome = periodTransactions.filter((t) => t.type === "ingreso").reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = periodTransactions.filter((t) => t.type === "gasto" || t.type === "cuota").reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome - totalExpenses;

  const savingsExpenses = periodTransactions
    .filter(t => (t.type === "gasto" || t.type === "cuota") && t.fundingSource === "Savings")
    .reduce((sum, t) => sum + t.amount, 0);

  const creditExpenses = periodTransactions
    .filter(t => (t.type === "gasto" || t.type === "cuota") && t.fundingSource === "Credit")
    .reduce((sum, t) => sum + t.amount, 0);

  const calculateFirstDueDatePreview = (purchaseDate, card) => {
    if (!purchaseDate || !card) return "";

    const purchase = new Date(purchaseDate);
    if (Number.isNaN(purchase.getTime())) return "";

    const [y, m, d] = purchaseDate.split('-').map(Number);
    const localPurchase = new Date(y, m - 1, d);

    const baseMonthDate =
      localPurchase.getDate() <= card.closingDay
        ? new Date(localPurchase.getFullYear(), localPurchase.getMonth(), 1)
        : new Date(localPurchase.getFullYear(), localPurchase.getMonth() + 1, 1);

    const dueMonth = new Date(baseMonthDate.getFullYear(), baseMonthDate.getMonth() + 1, 1);
    const daysInMonth = new Date(dueMonth.getFullYear(), dueMonth.getMonth() + 1, 0).getDate();
    const safeDay = Math.max(1, Math.min(card.dueDay, daysInMonth));
    const dueDate = new Date(dueMonth.getFullYear(), dueMonth.getMonth(), safeDay);

    return dueDate.toLocaleDateString("es-AR");
  };

  const fetchCategories = async () => {
  try {
    const data = await getCategoriesFlat();
    setCategories(data);
  } catch (error) {
    console.error("Error al cargar categorías:", error);
  }
  };

  const handleSubmit = async () => {
  if (
    !formData.amount ||
    !formData.categoryId ||
    isNaN(Number(formData.categoryId)) ||
    !formData.description
  ) {
    setFormError("Completa todos los campos obligatorios");
    return;
  }

  // Validación condicional de fecha
  if (formData.type === "gasto" && enCuotas) {
    // Para gastos en cuotas, validar campos específicos
    if (!cantidadCuotas || !formData.date || !selectedCreditCardId) {
      setFormError("Completá los datos de cuotas y tarjeta");
      return;
    }
    if (parseInt(cantidadCuotas) <= 0) {
      setFormError("La cantidad de cuotas debe ser mayor a cero");
      return;
    }
  } else {
    // Para transacciones normales (ingresos o gastos simples), validar fecha normal
    if (!formData.date) {
      setFormError("Selecciona una fecha");
      return;
    }
  }

  const token = localStorage.getItem("token");

  try {
    if (formData.type === "gasto" && enCuotas) {
      // Crear gasto con cuotas
      const body = {
        amount: parseFloat(formData.amount),
        description: formData.description,
        purchaseDate: formData.date,
        isInstallments: true,
        categoryId: parseInt(formData.categoryId),
        cuotas: parseInt(cantidadCuotas),
        creditCardId: parseInt(selectedCreditCardId),
        fundingSource: "Credit"
      };

      await api.post(`/Expenses/with-installments`, body, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Mensaje específico para cuotas
      console.log(`Gasto en ${cantidadCuotas} cuotas creado exitosamente`);
    } else {
      // Transacción normal (ingreso o gasto simple)
      await createTransaction(formData);
    }

    resetForm();
    setFormError("");
    await fetchBudgetProgress();
    
  } catch (error) {
    console.error(error);
    console.log('Error 500:', error.response?.data || error.message);

    
    // Manejo más específico de errores
    if (error.response?.data?.message) {
      setFormError(error.response.data.message);
    } else if (error.response?.data) {
      setFormError("Error del servidor: " + JSON.stringify(error.response.data));
    } else {
      setFormError("Ocurrió un error al guardar la transacción.");
    }
  }
  };

  const createTransaction = async (formData) => {
    const token = localStorage.getItem("token");
    if (!token || !userId) return;

    setLoading(true);
    try {
      const isEditing = !!editingTransaction;
      const tipoNuevo = formData.type.toLowerCase();
      const tipoViejo = editingTransaction?.type.toLowerCase();

      // determine base strings
      const baseNuevo = tipoNuevo === 'ingreso' ? 'Incomes' : 'Expenses';
      const baseViejo = tipoViejo === 'ingreso' ? 'Incomes' : 'Expenses';

      let newList = transactions;
      const body = buildBody(formData, userId);

      if (isEditing && tipoNuevo !== tipoViejo) {
        // change type: create new + delete old
        const created = await postTransactionOnServer({ base: baseNuevo, body, token });
        await deleteTransactionOnServer({ base: baseViejo, id: editingTransaction.id, token });
        // remove old and add new
        newList = transactions
          .filter(t => t.id !== editingTransaction.id)
          .concat({
            id:          created.id,
            ...body,
            date:        formData.date,
            type:        formData.type,
            category:    categories.find(c => c.id === body.categoryId)?.name || '',
            description: formData.description
          });

      } else if (isEditing) {
        // simple edit: update server then local
        await putTransactionOnServer({ base: baseNuevo, id: editingTransaction.id, body: { ...body, id: editingTransaction.id }, token });
        newList = replaceTransaction(transactions, {
          id:          editingTransaction.id,
          ...body,
          date:        formData.date,
          category:    categories.find(c => c.id === body.categoryId)?.name || '',
          description: formData.description
        });

      } else {
        // new transaction
        const created = await postTransactionOnServer({ base: baseNuevo, body, token });
        newList = addTransaction(transactions, {
          id:          created.id,
          ...body,
          date:        formData.date,
          type:        formData.type,
          category:    categories.find(c => c.id === body.categoryId)?.name || '',
          description: formData.description
        });
      }

      setTransactions(newList);
      setShowSuccess(true);
      setEditingTransaction(null);
      await fetchBudgetProgress();

    } catch (error) {

      // 1) Extraemos lo que venga de la API:
      const apiData = error.response?.data;

      const msg =
        (apiData && typeof apiData === "object" && apiData.message) ||
        (typeof apiData === "string" && apiData) ||
        error.message ||
        "Ocurrió un error inesperado";

      // 3) Guardamos y mostramos
      setErrorMessage(msg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };


  const fetchCuotasPagadasDelMes = async (token, userId, offset = 0) => {
  const base = new Date();
  base.setDate(1);
  base.setHours(0, 0, 0, 0);
  const targetDate = new Date(base.getFullYear(), base.getMonth() + offset, 1);

  const anio = targetDate.getFullYear();
  const mes = targetDate.getMonth() + 1;

  try {
    const response = await api.get(`/Expenses/cuotas/pagadas/${userId}/${anio}/${mes}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = response.data;

    return data.map((cuota) => ({
      id: cuota.id,
      expenseId: cuota.expenseId,
      description: cuota.expenseDescription,
      categoryId: cuota.expenseCategoryId,
      categoryName: cuota.expenseCategoryNombre,
      amount: cuota.montoCuota,
      date: cuota.fechaPago,
      type: "cuota"
    }));
  } catch (err) {
    console.error("Error al obtener cuotas pagadas:", err);
    return [];
  }
  };

  const fetchTransactionsByMonth = async (token, userId, isAdmin) => {
    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      let incomesRes, expensesRes;
      
      const today = new Date();
      const startOfThis = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
      
      const isCurrentMonth = monthOffset === 0;
      
      const expensesUrl = isCurrentMonth 
        ? `/Expenses/current-month`
        : `/Expenses/month/${startOfThis.getMonth() + 1}/${startOfThis.getFullYear()}`;
      
      [incomesRes, expensesRes] = await Promise.all([
        api.get(`/Incomes`, config).catch(err => {
          console.error("Error al cargar ingresos:", err);
          return { data: [] };
        }),
        api.get(expensesUrl, config).catch(err => {
          console.error("Error al cargar gastos:", err);
          return { data: [] };
        })
      ]);
      
      const incomes = incomesRes.data.map(i => ({ ...i, type: "ingreso" }));
      const expenses = expensesRes.data
        .filter(e => e.tieneCuotas === false)
        .map(e => ({ ...e, type: "gasto" }));
      
      const cuotasPagadas = await fetchCuotasPagadasDelMes(token, userId, monthOffset);
      const cuotasConvertidas = cuotasPagadas.map(c => ({
        ...c,
        type: "cuota"
      }));
      
      const allTransactions = [...incomes, ...expenses, ...cuotasConvertidas];
      const withCategoryNames = allTransactions.map(t => ({
        ...t,
        category: categories.find(c => c.id === t.categoryId)?.name || 'Sin categoría'
      }));
      
      setAllTransactions(withCategoryNames);
      setTransactions(withCategoryNames);
    } catch (error) {
      console.error("Error al cargar transacciones:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBudgetProgress = async () => {
    try {
      const progress = await getBudgetProgress(monthOffset);
      setBudgetProgress(progress);
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error("Error al cargar presupuesto:", error);
      }
      setBudgetProgress(null);
    }
  };

  const handleOpenBudgetModal = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const { data: budget, isInherited } = await getBudgetByPeriod(monthOffset);
      setBudgetIsInherited(isInherited);
      setBudgetMode(isInherited ? 'create' : 'edit');
      setCurrentBudgetId(isInherited ? null : budget.id);
      setBudgetGlobalAmount(budget.totalAmount.toString());
      const rows = budget.categories.map(cat => ({
        categoryId: cat.categoryId,
        amount: cat.amount.toString()
      }));
      setBudgetCategoryRows(rows);
    } catch (error) {
      if (error.response?.status === 404) {
        setBudgetIsInherited(false);
        setBudgetMode('create');
        setCurrentBudgetId(null);
        setBudgetGlobalAmount('');
        setBudgetCategoryRows([]);
      } else {
        console.error("Error al cargar presupuesto:", error);
        setBudgetIsInherited(false);
        setBudgetMode('create');
        setCurrentBudgetId(null);
        setBudgetGlobalAmount('');
        setBudgetCategoryRows([]);
      }
    }

    const expenseCategories = categories.filter(c => c.type === 'gasto');
    if (expenseCategories.length > 0 && budgetCategoryRows.length === 0) {
      setBudgetCategoryRows([{ categoryId: expenseCategories[0].id, amount: '' }]);
    }

    setShowBudgetModal(true);
  };

  const handleSaveBudget = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    if (!budgetGlobalAmount || parseFloat(budgetGlobalAmount) <= 0) {
      setErrorMessage("El presupuesto global debe ser mayor a 0");
      setShowError(true);
      return;
    }

    const validRows = budgetCategoryRows.filter(row => row.categoryId && parseFloat(row.amount) > 0);
    const categoriesPayload = validRows.map(row => ({
      categoryId: parseInt(row.categoryId),
      amount: parseFloat(row.amount),
      alertThreshold: 0.7
    }));

    const today = new Date();
    const periodDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const period = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, '0')}`;
    const periodStart = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
    const periodEnd = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0, 23, 59, 59);

    const payload = {
      period: period,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalAmount: parseFloat(budgetGlobalAmount),
      categories: categoriesPayload
    };

    setBudgetFormLoading(true);
    try {
      if (budgetMode === 'edit' && currentBudgetId) {
        await updateBudget(currentBudgetId, {
          totalAmount: parseFloat(budgetGlobalAmount),
          categories: categoriesPayload
        });
      } else {
        await createBudget(payload);
      }

      await fetchBudgetProgress();
      setShowBudgetModal(false);
      setShowSuccess(true);
    } catch (error) {
      console.error("Error al guardar presupuesto:", error);
      const msg = error.response?.data?.message || error.response?.data || "Error al guardar el presupuesto";
      setErrorMessage(msg);
      setShowError(true);
    } finally {
      setBudgetFormLoading(false);
    }
  };

  const handleDeleteBudget = async () => {
    const token = localStorage.getItem("token");
    if (!token || !currentBudgetId) return;

    setBudgetFormLoading(true);
    try {
      await deleteBudget(currentBudgetId);
      setBudgetProgress(null);
      setShowBudgetModal(false);
      setShowSuccess(true);
    } catch (error) {
      console.error("Error al eliminar presupuesto:", error);
      const msg = error.response?.data?.message || error.response?.data || "Error al eliminar el presupuesto";
      setErrorMessage(msg);
      setShowError(true);
    } finally {
      setBudgetFormLoading(false);
    }
  };

  const addBudgetCategoryRow = () => {
    const expenseCategories = categories.filter(c => c.type === 'gasto');
    const usedIds = budgetCategoryRows.map(r => parseInt(r.categoryId));
    const available = expenseCategories.find(c => !usedIds.includes(c.id));
    if (available) {
      setBudgetCategoryRows([...budgetCategoryRows, { categoryId: available.id, amount: '' }]);
    }
  };

  const removeBudgetCategoryRow = (index) => {
    setBudgetCategoryRows(budgetCategoryRows.filter((_, i) => i !== index));
  };

  const updateBudgetCategoryRow = (index, field, value) => {
    const updated = [...budgetCategoryRows];
    updated[index] = { ...updated[index], [field]: value };
    setBudgetCategoryRows(updated);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  const fetchSummary = async (summaryUserId) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    if (!summaryUserId) {
      setErrorMessage("Por favor ingresa un User ID");
      setShowError(true);
      return;
    }

    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await api.get(`/Incomes/summary/${summaryUserId}`, config);

      if (response.data.totalIncome === 0 && response.data.totalExpenses === 0) {
        setNotFoundMessage(`No se encontraron datos para el usuario ${summaryUserId}`);
      } else {
        setNotFoundMessage("");
      }

      setSummaryData(response.data);
    } catch (error) {
      //console.error("Error al obtener el resumen:", error);

      const msg =
        error.response?.data?.title ||  // Si usás ProblemDetails
        error.response?.data ||        // Si es texto plano
        "No se pudo obtener el resumen del usuario.";

      setErrorMessage(msg);
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilteredData = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const { userId, categoryId, from, to } = filterParams;

    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const query = new URLSearchParams({
        userId,
        categoryId,
        from,
        to
      });

      const response = await api.get(`/Incomes/filter?${query}`, config);

      if (response.data.length === 0) {
      setNotFoundMessage(`No se encontraron datos para el usuario ${userId}`);
      } else {
        setNotFoundMessage(""); // limpiar si hay datos
      }

      setFilteredData(response.data);
    } catch (error) {
      //console.error("Error al obtener datos filtrados:", error);
      alert("No se pudieron obtener los datos filtrados.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'ingreso',
      category: '',
      amount: '',
      date: '',
      description: '',
      categoryId: '',
      fundingSource: 'Income'
    });
    setEnCuotas(false);
    setCantidadCuotas('');
    setSelectedCreditCardId("");
    setEditingTransaction(null);
    setShowModal(false);
  };

  const handleCreateCreditCard = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const payload = {
        name: creditCardForm.name?.trim() || null,
        closingDay: Number(creditCardForm.closingDay),
        dueDay: Number(creditCardForm.dueDay),
      };

      const created = await createCreditCard(token, payload);
      setCreditCards((prev) => [...prev, created]);
      setCreditCardForm({ name: "", closingDay: "", dueDay: "" });
      setShowCreditCardModal(false);
    } catch (error) {
      setFormError("No se pudo crear la tarjeta");
    }
  };

  // Pie chart data
  const chartData = [
  { name: "Ingresos", value: totalIncome },
  { name: "Gastos", value: totalExpenses }
  ];
      
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const payload = parseJwt(token);
    if (!payload) return;

    const userId = payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    const role = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
    const isAdmin = role === "Admin";

    setUserId(userId);
    setIsAdmin(isAdmin);

    const init = async () => {
      try {
        await fetchCategories();
        const cards = await getCreditCards(token);
        setCreditCards(cards);

        await fetchTransactionsByMonth(token, userId, isAdmin);
    await fetchBudgetProgress();
      } catch (error) {
        if (error.message === 'SESSION_EXPIRED') {
          console.log('Sesión expirada, redirigiendo...');
          return;
        }
        
        if (error.response?.status !== 401) {
          console.error('Error al cargar datos:', error);
          setErrorMessage('Error al cargar los datos');
          setShowError(true);
        }}
    };

    init();
  }, [monthOffset]); 

  return (
    //<div className="min-h-screen dark:bg-gray-700 bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="
      min-h-screen 
      bg-gradient-to-br from-blue-50 to-indigo-100 
      dark:bg-gradient-to-br dark:from-gray-900 dark:to-black
      p-6
   ">
      <div className="max-w-7xl mx-auto dark:bg-gray-700 p-4 rounded-xl">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          
          <div className="flex flex-col md:flex-row items-center gap-4">

            {/* Chart View Selector */}
            <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow-lg p-1">
              <button
                onClick={() => setChartView('default')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                  chartView === 'default'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-500 dark:text-white'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                Tarjetas
              </button>
              <button
                onClick={() => setChartView('pie')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                  chartView === 'pie'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-500 dark:text-white'
                }`}
              >
                <PieChart className="w-4 h-4" />
                Torta
              </button>
              <button
                onClick={() => setChartView('temporal')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                  chartView === 'temporal'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-500 dark:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Temporal
              </button>
            </div>

            {/* Botón para abrir el Panel de Administración */}
            {isAdmin && !showAdminPanel && (
              <button
                onClick={() => setShowAdminPanel(true)}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-600 transition-all duration-200 shadow-lg"
              >
                Panel Admin
              </button>
            )}

          </div>

          {/* Feature para cambiar de Period */}
          <div className="flex items-center gap-2 mb-4 mt-4 mr-4">
            <button
              onClick={() => setMonthOffset(m => m - 1)}
              className="p-1 hover:bg-gray-100 dark:bg-white dark:hover:bg-gray-300 rounded"
            >
              <ChevronLeft />
            </button>
            <h5 className="text-lg font-semibold dark:text-white">
              {startOfThis.toLocaleDateString('es-AR',{ year:'numeric', month:'long' })}
            </h5>
            <button
              onClick={() => setMonthOffset(m => m + 1)}
              className="p-1 hover:bg-gray-100 dark:bg-white dark:hover:bg-gray-300 rounded"
            >
              <ChevronRight />
            </button>
          </div>

        </div>

        {/* Summary Cards / Charts */}
        <div className="mb-8">
          {chartView === 'default' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              
              <BudgetCard
                progress={budgetProgress}
                onConfigure={handleOpenBudgetModal}
                savingsTotal={savingsExpenses}
                creditTotal={creditExpenses}
              />

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-white text-sm font-medium">Total Ingresos</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-full">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-white text-sm font-medium">Total Gastos</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
                  </div>
                  <div className="bg-red-100 p-3 rounded-full">
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 dark:text-white text-sm font-medium">Balance</p>
                    <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatCurrency(balance)}
                    </p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-full">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              
            </div>
          )}

          {chartView === 'pie' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Distribución de Ingresos vs Gastos</h3>
              <div className="flex flex-col lg:flex-row items-center gap-8 w-full">

                <div className="flex-1 w-full" style={{ minHeight: '400px' }}>
                  <ResponsiveContainer width="100%" height={400}>
                    <RechartsPieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent, x, y }) => (
                          <text
                            x={x}
                            y={y}
                            fill="#ffffff"
                            fontSize={14}
                            textAnchor="middle"
                            dominantBaseline="central"
                            style={{
                              textShadow: `
                                -1px -1px 2px #000, 
                                1px -1px 2px #000, 
                                -1px  1px 2px #000, 
                                1px  1px 2px #000`
                            }}
                          >
                            {`${name}: ${formatCurrency(value)} (${(percent * 100).toFixed(1)}%)`}
                          </text>
                        )}

                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="flex flex-col gap-4 lg:w-80">
                  <div className="bg-green-50 p-6 rounded-lg border-l-4 border-green-500 dark:bg-gray-700">
                    <p className="text-gray-600 text-sm font-medium dark:text-white">Total Ingresos</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
                  </div>
                  <div className="bg-red-50 p-6 rounded-lg border-l-4 border-red-500 dark:bg-gray-700">
                    <p className="text-gray-600 text-sm font-medium dark:text-white">Total Gastos</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
                  </div>
                  <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-500 dark:bg-gray-700">
                    <p className="text-gray-600 text-sm font-medium dark:text-white">Balance</p>
                    <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatCurrency(balance)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {chartView === 'temporal' && (
            <TimeSeriesChart />
          )}

        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 w-full  mx-auto">
  
              {/* Nueva Transacción ocupa 3 columnas */}
            <button
              onClick={() => setShowModal(true)}
              className="sm:col-span-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 sm:px-12 py-5 sm:py-6 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center justify-center gap-3 sm:gap-4 shadow-lg text-base sm:text-xl min-h-[64px] sm:min-h-[72px]"
            >
              <Plus className="w-5 h-5 sm:w-7 sm:h-7" />
              <span>Nueva Transacción</span>
            </button>

            {/* Ingresos ocupa 2 columnas */}
            <button
              onClick={() => navigate('/incomes')}
              className="sm:col-span-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-5 sm:py-6 rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center justify-center gap-2 sm:gap-3 shadow-lg text-sm sm:text-base min-h-[64px] sm:min-h-[72px]"
            >
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Ingresos</span>
            </button>

            {/* Gastos ocupa 2 columnas */}
            <button
              onClick={() => navigate('/expenses')}
              className="sm:col-span-2 bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-5 sm:py-6 rounded-xl font-medium hover:from-red-600 hover:to-red-700 transition-all duration-200 flex items-center justify-center gap-2 sm:gap-3 shadow-lg text-sm sm:text-base min-h-[64px] sm:min-h-[72px]"
            >
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Gastos</span>
            </button>

            {/* Sueldos ocupa 2 columnas */}
            <button
              onClick={() => navigate('/sueldos')}
              className="sm:col-span-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-5 sm:py-6 rounded-xl font-medium hover:from-amber-600 hover:to-orange-600 transition-all duration-200 flex items-center justify-center gap-2 sm:gap-3 shadow-lg text-sm sm:text-base min-h-[64px] sm:min-h-[72px]"
            >
              <Banknote className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Sueldos</span>
            </button>
            
            <button
              onClick={() => setShowCreditCardModal(true)}
              className="sm:col-span-3 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white px-6 py-5 sm:py-6 rounded-xl font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center gap-2 sm:gap-3 shadow-lg text-sm sm:text-base min-h-[64px] sm:min-h-[72px]"
            >
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Agregar tarjeta</span>
            </button>

          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-2">

              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4 dark:text-white">
                  {editingTransaction ? 'Editar Transacción' : 'Nueva Transacción'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">Tipo</label>
                    <select
                      className="dark:bg-gray-600 dark:text-white dark:rounded-lg border"
                      value={formData.type}
                      onChange={(e) => {
                        const newType = e.target.value;
                        setFormData({ ...formData, type: newType, categoryId: '' });
                        // Resetear opciones de cuotas cuando cambia el tipo
                        if (e.target.value === 'ingreso') {
                          setEnCuotas(false);
                          setCantidadCuotas('');
                          setSelectedCreditCardId("");
                        }
                      }}
                      
                    >
                      <option value="ingreso">Ingreso</option>
                      <option value="gasto">Gasto</option>
                    </select>

                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">Categoría</label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({...formData, categoryId: parseInt(e.target.value)})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      required
                    >
                      <option value="">Seleccionar categoría</option>
                      {categories
                        .filter(cat => cat.type === formData.type && !cat.isArchived)
                        .map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.icon ? `${cat.icon} ` : ''}{cat.name}{cat.isSystem ? '' : ''}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/*Monto maximo 10M */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                      Monto (máximo $10,000,000)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="10000000"
                      value={formData.amount}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (value <= 10000000 || e.target.value === '') {
                          setFormData({...formData, amount: e.target.value});
                          if (value > totalIncome * 0.5 && formData.type === 'gasto' && formData.fundingSource === 'Income') {
                            setShowFundingSuggestion(true);
                          } else {
                            setShowFundingSuggestion(false);
                          }
                        }
                      }}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="0.00"
                      required
                    />
                    {formData.amount > 10000000 && (
                      <p className="text-red-500 text-sm mt-1">
                        El monto no puede exceder $10,000,000
                      </p>
                    )}
                  </div>

                  {/* Sugerencia de funding source */}
                  {showFundingSuggestion && formData.fundingSource === 'Income' && (
                    <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        Este gasto parece grande. ¿Estás usando ahorros?
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => { setFormData({...formData, fundingSource: 'Savings'}); setShowFundingSuggestion(false); }}
                          className="px-3 py-1 text-sm bg-amber-200 dark:bg-amber-800 rounded hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors"
                        >
                          Sí, usar ahorros
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowFundingSuggestion(false)}
                          className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          No, es de ingresos
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Origen del dinero - Solo para gastos */}
                  {formData.type === 'gasto' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-white">
                        Origen del dinero
                      </label>
                      <div className="flex gap-2">
                        {[
                          { value: 'Income', label: 'Ingresos', icon: '💰' },
                          { value: 'Savings', label: 'Ahorros', icon: '🏦' },
                          { value: 'Credit', label: 'Tarjeta', icon: '💳' }
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFormData({...formData, fundingSource: opt.value})}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              formData.fundingSource === opt.value
                                ? 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-600'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
                            }`}
                          >
                            {opt.icon} {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Opción en cuotas - Solo para gastos */}
                  {formData.type === 'gasto' && (
                    <div>
                      <label className="inline-flex items-center text-sm font-medium text-gray-700 dark:text-white">
                        <input
                          type="checkbox"
                          checked={enCuotas}
                          onChange={(e) => {
                            setEnCuotas(e.target.checked);
                            // Si se desactivan las cuotas, limpiar los campos relacionados
                            if (!e.target.checked) {
                              setCantidadCuotas('');
                              setSelectedCreditCardId("");
                            }
                          }}
                          className="form-checkbox h-4 w-4 text-blue-600 dark:bg-gray-600 dark:text-white"
                        />
                        <span className="ml-2">¿Este gasto es en cuotas?</span>
                      </label>
                    </div>
                  )}

                  {/* Campos de cuotas - Solo si es gasto y está activado */}
                  {formData.type === 'gasto' && enCuotas && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                          Cantidad de cuotas
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={cantidadCuotas}
                          onChange={(e) => setCantidadCuotas(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                          Tarjeta de credito
                        </label>
                        <select
                          value={selectedCreditCardId}
                          onChange={(e) => setSelectedCreditCardId(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                          required
                        >
                          <option value="">Seleccionar tarjeta</option>
                          {creditCards.map((card) => (
                            <option key={card.id} value={card.id}>
                              {(card.name || `Tarjeta ${card.id}`) + ` (cierre ${card.closingDay}, vence ${card.dueDay})`}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                          Las cuotas se calculan automaticamente segun tu tarjeta
                        </p>
                        {formData.date && selectedCreditCardId && (
                          <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                            Primera cuota vence el {calculateFirstDueDatePreview(formData.date, creditCards.find((c) => c.id === parseInt(selectedCreditCardId)))}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white ">
                      Fecha de compra
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                      Descripción
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      rows="3"
                      placeholder="Descripción opcional..."
                    />
                  </div>

                  {formError && (
                    <div className="text-red-600 text-sm font-medium text-center mb-2">
                      {formError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 px-4 py-3 text-gray-700 bg-gray-200 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200"
                    >
                      {editingTransaction ? 'Actualizar' : 'Agregar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
          
        {showCreditCardModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-2 p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4 dark:text-white">Agregar tarjeta</h3>
              <form onSubmit={handleCreateCreditCard} className="space-y-4">
                <input
                  type="text"
                  value={creditCardForm.name}
                  onChange={(e) => setCreditCardForm({ ...creditCardForm, name: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Nombre (opcional)"
                />
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={creditCardForm.closingDay}
                  onChange={(e) => setCreditCardForm({ ...creditCardForm, closingDay: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Día de cierre (1-31)"
                  required
                />
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={creditCardForm.dueDay}
                  onChange={(e) => setCreditCardForm({ ...creditCardForm, dueDay: e.target.value })}
                  className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:text-white"
                  placeholder="Día de vencimiento (1-31)"
                  required
                />
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreditCardModal(false)}
                    className="flex-1 px-4 py-3 text-gray-700 bg-gray-200 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showBudgetModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-2 p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                    {budgetMode === 'edit' ? 'Editar Presupuesto' : 'Configurar Presupuesto'}
                  </h3>
                  {budgetIsInherited && (
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      Presupuesto heredado del mes anterior. Guardar para crear uno nuevo para este período.
                    </p>
                  )}
                </div>
                <button onClick={() => setShowBudgetModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  ✕
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">
                    Presupuesto Global Mensual
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={budgetGlobalAmount}
                    onChange={(e) => setBudgetGlobalAmount(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-white">
                      Presupuesto por Categoría
                    </label>
                    <button
                      onClick={addBudgetCategoryRow}
                      className="text-sm text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar categoría
                    </button>
                  </div>

                  <div className="space-y-3">
                    {budgetCategoryRows.map((row, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <select
                          value={row.categoryId}
                          onChange={(e) => updateBudgetCategoryRow(index, 'categoryId', parseInt(e.target.value))}
                          className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                        >
                          <option value="">Seleccionar categoría</option>
                          {categories.filter(c => c.type === 'gasto' && !c.isArchived).map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.amount}
                          onChange={(e) => updateBudgetCategoryRow(index, 'amount', e.target.value)}
                          className="w-32 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                          placeholder="Monto"
                        />
                        <button
                          onClick={() => removeBudgetCategoryRow(index)}
                          className="p-2 text-red-500 hover:text-red-700 transition-colors"
                          disabled={budgetCategoryRows.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-5 mt-5 border-t border-gray-200 dark:border-gray-700">
                {budgetMode === 'edit' && (
                  <button
                    onClick={handleDeleteBudget}
                    disabled={budgetFormLoading}
                    className="px-4 py-3 text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-lg font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                )}
                <button
                  onClick={() => setShowBudgetModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveBudget}
                  disabled={budgetFormLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium hover:from-purple-700 hover:to-purple-800 transition-all duration-200 disabled:opacity-50"
                >
                  {budgetFormLoading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal del Panel de Administración */}
        {isAdmin && showAdminPanel && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-6xl mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-hidden">

              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-semibold text-gray-800 dark:text-white">Panel de Administración</h3>
                  <button onClick={() => setShowAdminPanel(false)} className="text-red-600 hover:text-red-800 text-lg font-bold px-3 py-1">
                      ✕
                    </button>
                  </div>

                {/* navegación admin */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-4 px-3 sm:px-6">
                  <button
                    onClick={() => {
                      setAdminView('summary');
                      setNotFoundMessage("");
                    }}
                    className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base ${
                      adminView === 'summary' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Resumen por Usuario
                  </button>

                  <button
                    onClick={() => {
                      setAdminView('filter');
                      setNotFoundMessage("");
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      adminView === 'filter' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Filtrar Ingresos
                  </button>
                </div>

              </div>

                <div className="p-3 sm:p-6 overflow-y-auto max-h-[60vh] sm:max-h-[70vh]">
                  
                  {/* Contenido del Panel */}
                  {adminView === 'summary' && (
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">User ID</label>
                          <input
                            type="number"
                            value={summaryUserId}
                            onChange={(e) => setSummaryUserId(e.target.value)}
                            className="w-full p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                            placeholder="Ej: 7"
                          />
                        </div>
                        <button
                          onClick={() => fetchSummary(summaryUserId)}
                          disabled={loading}
                          className="bg-blue-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm sm:text-base w-full sm:w-auto"
                        >
                          {loading ? 'Cargando...' : 'Obtener Resumen'}
                        </button>
                      </div>

                      {notFoundMessage && (
                        <p className="text-red-600 text-sm font-medium mt-2 ml-1">
                          {notFoundMessage}
                        </p>
                      )}


                      {summaryData && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h5 className="font-semibold text-gray-800 mb-3">Resultados:</h5>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 border-green-500">
                              <p className="text-sm text-gray-600 dark:text-white">Total Ingresos</p>
                              <p className="text-xl font-bold text-green-600">{formatCurrency(summaryData.totalIncome)}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 border-red-500">
                              <p className="text-sm text-gray-600 dark:text-white">Total Gastos</p>
                              <p className="text-xl font-bold text-red-600">{formatCurrency(summaryData.totalExpenses)}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 border-blue-500">
                              <p className="text-sm text-gray-600 dark:text-white">Balance</p>
                              <p className={`text-xl font-bold ${summaryData.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                {formatCurrency(summaryData.balance)}
                              </p>
                            </div>
                          </div>
                      
                        </div>
                      )}
                    </div>
                  )}

                  {adminView === 'filter' && (
                    <div className="space-y-6">
                      <h4 className="text-lg font-semibold text-gray-800 dark:text-white">Filtrar Ingresos</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">User ID *</label>
                        <input
                          type="number"
                          value={filterParams.userId}
                          onChange={(e) => setFilterParams({...filterParams, userId: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Ej: 7"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">
                          Categoría
                        </label>
                        <select
                          value={filterParams.categoryId ?? ""}
                          onChange={e =>
                            setFilterParams({
                              ...filterParams,
                              // si el valor es cadena vacía, lo dejamos sin valor; 
                              // si no, lo parseamos a entero
                              categoryId: e.target.value
                                ? parseInt(e.target.value, 10)
                                : undefined
                            })
                          }
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Seleccionar categoría</option>
                          {categories
                            .filter(cat => !cat.isArchived)
                            .map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Fecha Desde</label>
                        <input
                          type="datetime-local"
                          value={filterParams.from}
                          onChange={(e) => setFilterParams({...filterParams, from: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Fecha Hasta</label>
                        <input
                          type="datetime-local"
                          value={filterParams.to}
                          onChange={(e) => setFilterParams({...filterParams, to: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      {notFoundMessage && adminView === 'filter' && (
                        <p className="text-red-600 text-sm font-medium mt-2 ml-4">{notFoundMessage}</p>
                      )}

                    </div>

                    <button
                      onClick={fetchFilteredData}
                      disabled={loading}
                      className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Cargando...' : 'Aplicar Filtros'}
                    </button>

                    {filteredData && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h5 className="font-semibold text-gray-800 mb-3">Resultados ({filteredData.length} registros):</h5>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-200">
                              <tr>
                                <th className="px-3 py-2 text-left">ID</th>
                                <th className="px-3 py-2 text-left">Monto</th>
                                <th className="px-3 py-2 text-left">Descripción</th>
                                <th className="px-3 py-2 text-left">Fecha</th>
                                <th className="px-3 py-2 text-left">Categoría</th>
                                <th className="px-3 py-2 text-left">Usuario</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {filteredData.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-100">
                                  <td className="px-3 py-2">{item.id}</td>
                                  <td className="px-3 py-2 font-semibold text-green-600">{formatCurrency(item.amount)}</td>
                                  <td className="px-3 py-2">{item.description}</td>
                                  <td className="px-3 py-2">{parseApiDate(item.date).toLocaleDateString('es-AR')}</td>
                                  <td className="px-3 py-2">{item.categoryName}</td>
                                  <td className="px-3 py-2">{item.username} (ID: {item.userId})</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                    
                      </div>
                    )}
                    </div>
                  )}

                  {adminView === 'categories' && (
                    <div className="space-y-6">
                      <p className="text-gray-600 dark:text-gray-400">
                        La administración de categorías se movió a una página dedicada.
                      </p>
                      <button
                        onClick={() => setShowCategoriesSettings(true)}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        <Settings className="w-4 h-4" /> Abrir gestión de categorías
                      </button>
                    </div>
                  )}

              </div>
            </div>
          </div>
        )}

      </div>

        {/* Modal de SucessModal */}
        {showSuccess && (
          <SuccessModal message="Cambios guardados correctamente." onClose={() => setShowSuccess(false)} />
        )}

        {/* Modal de ConfirmDeleteModal */}
        {confirmDelete.show && confirmDelete.target && (
          <ConfirmDeleteModal
            message={
              confirmDelete.type === "transaction"
                ? confirmDelete.target
                  ? `¿Estás seguro de eliminar esta transacción de ${formatCurrency(confirmDelete.target.amount)}?`
                  : "¿Estás seguro de eliminar esta transacción?"
                : confirmDelete.target
                  ? `¿Estás seguro de eliminar la categoría "${confirmDelete.target.name}"?`
                  : "¿Estás seguro de eliminar esta categoría?"
            }

            onCancel={() =>
              setConfirmDelete({ show: false, target: null, type: null })
            }

            onConfirm={async () => {
              const token = localStorage.getItem("token");
              const item = confirmDelete.target;
              console.log("Deleting item:", item);

              if (!token || !item) return;

              try {
                const config = { headers: { Authorization: `Bearer ${token}` } };

                if (confirmDelete.type === "transaction") {
                  let idToDelete;

                  // Si es una cuota, usamos expenseId para eliminar el gasto completo
                  if (item.type === "cuota" && item.expenseId) {
                    idToDelete = item.expenseId;
                  } else {
                    idToDelete = item.id;
                  }

                  const base = item.type === "ingreso" ? "Incomes" : "Expenses";

                  await api.delete(`/${base}/${idToDelete}`, config);

                  // Filtrar transacciones del estado
                  setTransactions(prev => {
                    if (item.type === "cuota" && item.expenseId) {
                      // Eliminamos todas las cuotas asociadas al mismo gasto
                      return prev.filter(t => t.expenseId !== item.expenseId);
                    } else {
                      return prev.filter(t => t.id !== item.id);
                    }
                  });

                }

                const tokenForRefresh = localStorage.getItem("token");
                if (tokenForRefresh) {
                  await fetchBudgetProgress();
                }

                setShowSuccess(true);

              } catch (err) {
                setShowError(true);
              } finally {
                setConfirmDelete({ show: false, target: null, type: null });
              }
            }}
          />
        )}

        {/* Modal de ErrorModal */}
        {showError && (
          <ErrorModal message={errorMessage} onClose={() => setShowError(false)} />
        )}

        {/* Categories Settings Modal */}
        <CategoriesSettings
          isOpen={showCategoriesSettings}
          onClose={() => {
            setShowCategoriesSettings(false);
            fetchCategories();
          }}
        />
    </div>
  );
};

export default Dashboard;