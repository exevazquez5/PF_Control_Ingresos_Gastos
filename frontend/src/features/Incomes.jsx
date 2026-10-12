import React, { useState, useEffect } from "react";
import { PieChart as RechartsPieChart, Cell, Pie, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { parseJwt } from "../utils/jwt";
import { parseApiDate, todayInputDate } from "../utils/date";
import { incomeFields } from "../utils/transactionService";
import { sumIncomes, filterByMonth, monthStart } from "../utils/transactionTotals";
import { deriveSourceKey, formatSourceLabel, sourceLabel } from "../utils/sourceKey";
import { Edit2, Trash2, ChevronLeft, ChevronRight, ChevronDown, DollarSign, TrendingUp, List, CalendarDays } from 'lucide-react';

import { useTransactionDelete } from '../hooks/useTransactionDelete';
import { useTransactionEdit } from '../hooks/useTransactionEdit';
import TransactionModal from "./TransactionModal";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import SuccessModal from "../dashboard/SucessModal";
import api from '../api/axios.config.js';

  // Paleta de colores más contrastante y distintiva
  const IMPROVED_PALETTE = [
    '#FF6B6B', // Rojo coral
    '#4ECDC4', // Turquesa
    '#45B7D1', // Azul cielo
    '#96CEB4', // Verde menta
    '#FFEAA7', // Amarillo suave
    '#DDA0DD', // Violeta suave
    '#FFB347', // Naranja durazno
    '#98D8C8', // Verde agua
    '#F7DC6F', // Amarillo dorado
    '#BB8FCE', // Púrpura suave
    '#85C1E9', // Azul claro
    '#F8C471', // Naranja claro
    '#82E0AA', // Verde claro
    '#F1948A', // Rosa salmón
    '#AED6F1', // Azul pastel
    '#D7BDE2', // Lavanda
    '#A9DFBF', // Verde pastel
    '#F9E79F', // Amarillo pastel
    '#FAD7A0', // Beige
    '#D5A6BD'  // Rosa grisáceo
  ];

  // Función para obtener colores únicos y secuenciales
  function getDistinctColor(index) {
    return IMPROVED_PALETTE[index % IMPROVED_PALETTE.length];
  }

  const monthLabelKey = (date) => `${date.getFullYear()}-${date.getMonth()}`;

export default function IncomesDashboard() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [incomeSources, setIncomeSources] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [monthDiscounts, setMonthDiscounts] = useState(null);

  const [monthOffset, setMonthOffset]   = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("Todos"); 
  const [orderByMethod, setOrderByMethod] = useState("fecha-reciente");
  const [expandedMonthKey, setExpandedMonthKey] = useState(() => monthLabelKey(new Date()));
  const [showModal, setShowModal]       = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const payload = parseJwt(token);
    if (!payload) return;

    const userId = payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    setUserId(userId);

    fetchCategories(token);
    fetchIncomes(token, userId);
    fetchIncomeSources(token);
  }, []);

  const fetchIncomeSources = async (token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await api.get(`/IncomeSources`, config);
      setIncomeSources(response.data);
    } catch (error) {
      console.error("Error al obtener fuentes de ingreso:", error);
    }
  };

  // Desglose de descuentos del mes (Fase 3.5a): Total (bruto) − descuentos = Neto.
  const fetchMonthDiscounts = async (token, year, month) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await api.get(`/DiscountRules/totals?year=${year}&month=${month}`, config);
      setMonthDiscounts(response.data);
    } catch (error) {
      console.error("Error al obtener los descuentos del mes:", error);
      setMonthDiscounts(null);
    }
  };

  const fetchCategories = async (token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await api.get(`/Categories`, config);
      setCategories(response.data);
      setAllCategories(response.data);
    } catch (error) {
      console.error("Error al obtener categorías:", error);
    }
  };

  const fetchIncomes = async (token, userId) => {
    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await api.get(`/Incomes/filter?userId=${userId}`, config);
      const incomes = response.data.map(i => ({ ...i, type: "ingreso" }));
      setTransactions(incomes);
    } catch (error) {
      console.error("Error al obtener ingresos:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  };

  // Mes seleccionado por el selector global
  const today = new Date();
  const baseMonth = monthStart(today);
  const selMonth = new Date(baseMonth.getFullYear(), baseMonth.getMonth() + monthOffset, 1);
  const selMonthLabel = selMonth.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
  const monthTransactions = filterByMonth(transactions, selMonth);

  // Al cambiar el selector de mes, expandir ese mes en el historial
  useEffect(() => {
    setExpandedMonthKey(monthLabelKey(selMonth));
  }, [monthOffset]);

  // Cargar descuentos del mes seleccionado (Fase 3.5a)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !userId) return;
    fetchMonthDiscounts(token, selMonth.getFullYear(), selMonth.getMonth() + 1);
  }, [monthOffset, userId]);

  // KPIs del mes seleccionado
  const monthTotal = sumIncomes(monthTransactions);
  const monthCount = monthTransactions.length;
  const monthDescuentos = monthDiscounts?.descuentos ?? 0;
  // Neto puede ser null en meses sin ingreso (se omite). Puede ser negativo si
  // los descuentos superan el ingreso del mes.
  const monthNeto = monthDiscounts ? monthDiscounts.neto : undefined;
  // Fuentes con reglas o descuentos para el desglose por fuente
  const fuentesConDesglose = (monthDiscounts?.fuentes || []).filter(
    f => (f.reglas?.length > 0) || f.descuentos > 0 || f.otrosSinDetallar != null
  );

  const categoryColorMap = categories.reduce((acc, cat, index) => {
      acc[cat.id] = getDistinctColor(index);
      return acc;
    }, {});

  // datos para la torta (mes seleccionado)
  const chartData = categories.map((cat) => {
  const sum = monthTransactions.filter(t => t.categoryId === cat.id).reduce((a, b) => a + b.amount, 0);
  return {
    name: cat.name,
    value: sum,
    color: categoryColorMap[cat.id],
    categoryId: cat.id // ← Mantener referencia al ID original
  };
  }).filter(d => d.value > 0);

  // Historial (D7): del primer ingreso al mes actual (o al último con ingreso), sin meses anteriores al primero
  const historyMonths = (() => {
    if (transactions.length === 0) return [];
    const times = transactions.map(t => parseApiDate(t.date).getTime());
    const first = monthStart(new Date(Math.min(...times)));
    const last = monthStart(new Date(Math.max(...times)));
    const end = last > baseMonth ? last : baseMonth;
    const months = [];
    for (let cur = first; cur <= end; cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)) {
      months.push(cur);
    }
    return months.reverse(); // más reciente primero
  })();

  const sortTransactions = (list) => {
    const sorted = [...list];
    switch (orderByMethod) {
      case 'fecha-antiguo':
        return sorted.sort((a, b) => parseApiDate(a.date) - parseApiDate(b.date));
      case 'precio-mayor':
        return sorted.sort((a, b) => b.amount - a.amount);
      case 'precio-menor':
        return sorted.sort((a, b) => a.amount - b.amount);
      default:
        return sorted.sort((a, b) => parseApiDate(b.date) - parseApiDate(a.date));
    }
  };

  // Filtra y ordena los ingresos de un mes del historial (el total del mes siempre es sin filtro)
  const getMonthRows = (monthDate) => {
    const monthAll = filterByMonth(transactions, monthDate);
    const visible = selectedCategory === "Todos"
      ? monthAll
      : monthAll.filter(tx => tx.categoryName === selectedCategory);
    return { monthAll, rows: sortTransactions(visible) };
  };

  const [formData, setFormData] = useState({
    type: 'ingreso',
    category: '',
    amount: '',
    grossAmount: '',
    isRecurring: false,
    sourceId: null,
    sourceName: '',
    mode: 'neto',
    date: todayInputDate(),
    description: '',
    categoryId: ''
  });

  const fetchCategoriesByType = async (type) => {
    // Función para filtrar categorías por tipo
    setCategories(allCategories.filter(cat => cat.type === type));
    return allCategories.filter(cat => cat.type === type);
  };

  const [confirmDelete, setConfirmDelete] = useState({ show: false, target: null, type: "" });
  const [editingTransaction, setEditingTransaction] = useState(null);

  const handleDelete = useTransactionDelete(setConfirmDelete);
  const handleEdit = useTransactionEdit(setEditingTransaction, setFormData, setShowModal, setEnCuotas, setCantidadCuotas);

  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Cambios guardados");
  const [enCuotas, setEnCuotas] = useState(false);
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [fechaInicioCuotas, setFechaInicioCuotas] = useState('');
  const [formError, setFormError] = useState('');



  const resetForm = () => {
    setFormData({
      type: 'ingreso',
      category: '',
      amount: '',
      grossAmount: '',
      isRecurring: false,
      sourceId: null,
      sourceName: '',
      mode: 'neto',
      date: todayInputDate(),
      description: '',
      categoryId: ''
    });
    setEnCuotas(false);
    setCantidadCuotas(1);
    setFechaInicioCuotas('');
    setFormError('');
    setEditingTransaction(null);
    setShowModal(false); // Cerrar el modal al resetear el formulario
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    
    if (!formData.amount || !formData.categoryId || !formData.date || !formData.description) {
      setFormError("Completa todos los campos obligatorios");
      return;
    }
    
    const token = localStorage.getItem("token");
    if (!token || !userId) return;
    
    try {
      const isEditing = !!editingTransaction;
      const tipoNuevo = formData.type.toLowerCase();
      const tipoViejo = editingTransaction?.type.toLowerCase();
      
      // Determinar las bases para las API
      const baseNuevo = tipoNuevo === 'ingreso' ? 'Incomes' : 'Expenses';
      const baseViejo = tipoViejo === 'ingreso' ? 'Incomes' : 'Expenses';
      
      // Construir el cuerpo de la solicitud
      const body = {
        amount: parseFloat(formData.amount),
        ...incomeFields(formData),
        description: formData.description,
        date: new Date(formData.date).toISOString(),
        categoryId: Number(formData.categoryId),
        userId: Number(userId)
      };
      
      const config = { headers: { Authorization: `Bearer ${token}` } };
      
      if (isEditing) {
        if (tipoNuevo !== tipoViejo) {
          // Si cambió el tipo, eliminar el anterior y crear uno nuevo
          const response = await api.post(`/${baseNuevo}`, body, config);
          await api.delete(`/${baseViejo}/${editingTransaction.id}`, config);
          
          // Actualizar la lista de transacciones
          setTransactions(prev => [
            ...prev.filter(t => t.id !== editingTransaction.id),
            {
              id: response.data.id,
              ...body,
              type: formData.type,
              category: categories.find(c => c.id === body.categoryId)?.name || '',
            }
          ]);
        } else {
          // Actualizar la transacción existente
          await api.put(
            `/${baseNuevo}/${editingTransaction.id}`,
            { ...body, id: editingTransaction.id },
            config
          );
          
          // Actualizar la lista de transacciones
          setTransactions(prev => 
            prev.map(t => t.id === editingTransaction.id ? {
              ...t,
              ...body,
              type: formData.type,
              category: categories.find(c => c.id === body.categoryId)?.name || '',
            } : t)
          );
        }
      } else {
        // Crear una nueva transacción
        const response = await api.post(`/${baseNuevo}`, body, config);
        
        // Añadir la nueva transacción a la lista
        setTransactions(prev => [
          ...prev,
          {
            id: response.data.id,
            ...body,
            type: formData.type,
            category: categories.find(c => c.id === body.categoryId)?.name || '',
          }
        ]);
      }
      
      // Mostrar mensaje de éxito y cerrar el modal
      setSuccessMessage(editingTransaction ? "Cambios guardados" : "Transacción agregada correctamente");
      setShowSuccess(true);
      resetForm();
      setShowModal(false);
      
      // Recargar los datos para asegurar que todo está actualizado
      fetchIncomes(token, userId);
      
    } catch (error) {
      console.error("Error al guardar la transacción:", error);
      setFormError(error.response?.data?.message || "Error al guardar la transacción");
    }
  };

  const selectClass = `
        w-full p-3 rounded-lg
        bg-gray-50/50 border-0 text-gray-900
        ring-1 ring-gray-200/60
        focus:ring-2 focus:ring-blue-500 focus:bg-white
        hover:ring-gray-300/80 transition-all duration-150
        dark:bg-gray-800/50 dark:text-gray-100
        dark:ring-gray-700/60 dark:focus:bg-gray-800
        dark:hover:ring-gray-600/80
      `;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:bg-gradient-to-br dark:from-gray-900 dark:to-black p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header con navegación */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2 dark:text-white">Detalle de Ingresos</h1>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-lg w-full sm:w-auto"
          >
            Volver al Inicio
          </button>
        </div>

        {/* Selector de mes global */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex items-center gap-1 sm:gap-2 bg-gray-100 dark:bg-gray-700 rounded-full px-3 sm:px-6 py-2 sm:py-3">
            <button
              onClick={() => setMonthOffset(m => m - 1)}
              className="p-1 sm:p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-white" />
            </button>
            <h5 className="text-sm sm:text-lg font-semibold dark:text-white min-w-[100px] sm:min-w-[140px] text-center px-1">
              {selMonth.toLocaleDateString('es-AR', { 
                year:'numeric', 
                month: window.innerWidth < 640 ? 'short' : 'long' 
              })}
            </h5>
            <button
              onClick={() => setMonthOffset(m => m + 1)}
              className="p-1 sm:p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-white" />
            </button>
          </div>
          {monthOffset !== 0 && (
            <button
              onClick={() => setMonthOffset(0)}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Hoy
            </button>
          )}
        </div>

        {/* KPIs del mes seleccionado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-5 border-l-4 border-green-500 flex items-center gap-4">
            <div className="bg-green-100 dark:bg-green-900 p-3 rounded-lg flex-shrink-0">
              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">Total del mes (bruto)</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 truncate">
                {formatCurrency(monthTotal)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-5 border-l-4 border-rose-500 flex items-center gap-4">
            <div className="bg-rose-100 dark:bg-rose-900 p-3 rounded-lg flex-shrink-0">
              <TrendingUp className="w-6 h-6 text-rose-600 dark:text-rose-400 rotate-180" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">Descuentos del mes</p>
              <p className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 truncate">
                {formatCurrency(monthDescuentos)}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-5 border-l-4 border-emerald-500 flex items-center gap-4">
            <div className="bg-emerald-100 dark:bg-emerald-900 p-3 rounded-lg flex-shrink-0">
              <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">Neto del mes</p>
              <p className={`text-xl sm:text-2xl font-bold truncate ${monthNeto != null && monthNeto < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {monthNeto != null ? formatCurrency(monthNeto) : '—'}
              </p>
              {monthNeto == null ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">Sin ingresos este mes</p>
              ) : monthNeto < 0 ? (
                <p className="text-xs text-rose-600 dark:text-rose-400">Los descuentos superan el ingreso del mes</p>
              ) : null}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-5 border-l-4 border-blue-500 flex items-center gap-4">
            <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg flex-shrink-0">
              <List className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">Ingresos del mes</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 truncate">
                {monthCount}
              </p>
            </div>
          </div>
        </div>

        {/* Estado vacío: sin fuentes de ingreso (Fase 3.5a) */}
        {!loading && incomeSources.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6 text-center border border-dashed border-blue-300 dark:border-blue-800">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
              Todavía no tenés fuentes de ingreso
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Creá la primera fuente para empezar a registrar ingresos, descuentos y reglas.
            </p>
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Crear la primera fuente
            </button>
          </div>
        )}

        {/* Desglose de descuentos por fuente (Fase 3.5a) */}
        {fuentesConDesglose.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 mb-6">
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white mb-1">
              Descuentos por fuente
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-300 mb-4 capitalize">{selMonthLabel}</p>
            <div className="space-y-3">
              {fuentesConDesglose.map(fuente => (
                <div key={fuente.sourceId} className="border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 dark:text-white">{fuente.sourceName}</span>
                      <span className="text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                        {fuente.mode}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                      -{formatCurrency(fuente.descuentos)}
                    </span>
                  </div>
                  {!fuente.tieneIngresos ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Sin ingreso este mes: las reglas se muestran a modo informativo y no entran en el neto.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1">
                      {(fuente.reglas || []).map(regla => (
                        <div key={regla.id} className="flex items-center justify-between gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <span className="truncate">
                            {regla.name}
                            {!regla.deduce && <span className="text-gray-400 dark:text-gray-500"> (informativa)</span>}
                          </span>
                          <span className="whitespace-nowrap">
                            {regla.requiereBruto
                              ? 'requiere el bruto del recibo'
                              : formatCurrency(regla.monto || 0)}
                          </span>
                        </div>
                      ))}
                      {fuente.otrosSinDetallar != null && (
                        <div className="flex items-center justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <span className="truncate">
                            Otros / sin detallar{fuente.avisoOtros ? ' (revisar)' : ''}
                          </span>
                          <span className="whitespace-nowrap">{formatCurrency(fuente.otrosSinDetallar)}</span>
                        </div>
                      )}
                      {fuente.ingresosBruto === 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Sin ingresos en modo Bruto este mes: los descuentos no se aplican.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Neto de la fuente</span>
                    <span className={`font-bold ${fuente.neto != null && fuente.neto < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {fuente.neto != null ? formatCurrency(fuente.neto) : '—'}
                    </span>
                  </div>
                  {fuente.avisoNeto && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      Los descuentos superan el ingreso del mes
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Distribución por categoría del mes seleccionado */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 mb-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
              <DollarSign className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                Ingresos por Categoría
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-300 capitalize">{selMonthLabel}</p>
            </div>
          </div>

          {chartData.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Sin ingresos este mes.</p>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 items-center">
              {/* Leyenda del gráfico - Mejorada para móviles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 order-2 lg:order-1">
                {chartData.map((entry, index) => (
                  <div key={index} className="flex items-center justify-start p-2 bg-gray-50 dark:bg-gray-700 rounded-lg space-x-2 dark:text-white">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }}></div>
                    <span className="text-sm sm:text-base truncate">{entry.name}</span>
                  </div>
                ))}
              </div>

              {/* Gráfico de Torta - Responsivo */}
              <div className="flex justify-center order-1 lg:order-2">
                <div className="w-full" style={{ height: window.innerWidth < 640 ? 200 : 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={window.innerWidth < 640 ? 80 : 120}
                        dataKey="value"
                        stroke="#ffffff"
                        strokeWidth={2}
                      >
                        {chartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${entry.categoryId}`} 
                            fill={entry.color}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Historial agrupado por mes */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div className="flex items-center space-x-3">
              <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-lg">
                <CalendarDays className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">Historial de Ingresos</h4>
            </div>

            {/* Filtro de categoría + orden (se aplican a los meses expandidos) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 sm:gap-4">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-white">
                  Filtrar por categoría
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={selectClass}
                >
                  <option value="Todos">Todas las categorías</option>
                  {allCategories.filter((cat) => cat.type === "ingreso").map((cat) => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-shrink-0 min-w-[180px]">
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-white">
                  Ordenar por
                </label>
                <select
                  value={orderByMethod}
                  onChange={(e) => setOrderByMethod(e.target.value)}
                  className={selectClass}
                >
                  <option value="fecha-reciente">Fecha: Más reciente</option>
                  <option value="fecha-antiguo">Fecha: Más antiguo</option>
                  <option value="precio-mayor">Precio: Mayor a menor</option>
                  <option value="precio-menor">Precio: Menor a mayor</option>
                </select>
              </div>
            </div>
          </div>

          {transactions.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              {loading ? "Cargando ingresos..." : "Todavía no hay ingresos registrados."}
            </p>
          ) : (
            <div>
              {historyMonths.map(monthDate => {
                const key = monthLabelKey(monthDate);
                const expanded = expandedMonthKey === key;
                const { monthAll, rows } = getMonthRows(monthDate);
                const label = monthDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
                const labelCapitalized = label.charAt(0).toUpperCase() + label.slice(1);

                return (
                  <div key={key} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-2">
                    <button
                      type="button"
                      onClick={() => setExpandedMonthKey(prev => (prev === key ? null : key))}
                      className="w-full flex items-center justify-between gap-3 px-3 sm:px-4 py-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <ChevronDown className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        <span className="font-semibold text-gray-800 dark:text-white truncate">{labelCapitalized}</span>
                        {monthAll.length === 0 && (
                          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">Sin ingresos</span>
                        )}
                      </span>
                      <span className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-gray-500 dark:text-gray-300 whitespace-nowrap">
                          {monthAll.length} {monthAll.length === 1 ? 'ingreso' : 'ingresos'}
                        </span>
                        <span className="font-bold text-green-600 dark:text-green-400 text-sm sm:text-base whitespace-nowrap">
                          {formatCurrency(sumIncomes(monthAll))}
                        </span>
                      </span>
                    </button>

                    {expanded && (
                      <div className="px-2 sm:px-4 py-1">
                        {monthAll.length === 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                            Sin ingresos este mes.
                          </p>
                        )}
                        {monthAll.length > 0 && rows.length === 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                            Sin ingresos en esta categoría.
                          </p>
                        )}
                        {rows.map(tx => (
                          <div key={tx.id} className="flex items-center justify-between gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="text-[11px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full"
                                  title="Fuente derivada de la descripción"
                                >
                                  {sourceLabel(tx) || 'Sin fuente'}
                                </span>
                                <p className="font-medium text-gray-800 dark:text-white text-sm sm:text-base truncate">
                                  {tx.description}
                                </p>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                                <span>{parseApiDate(tx.date).toLocaleDateString('es-AR')}</span>
                                <span className="flex items-center gap-1.5">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: categoryColorMap[tx.categoryId] || '#6b7280' }}
                                  ></span>
                                  {tx.categoryName}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <div className="font-bold text-green-600 dark:text-green-400 text-sm sm:text-base whitespace-nowrap mr-1">
                                +{formatCurrency(tx.amount)}
                              </div>
                              <button
                                onClick={() => handleEdit(tx)}
                                className="text-blue-600 hover:text-blue-900 transition-colors p-1 hover:bg-blue-50 dark:hover:bg-gray-400 rounded"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(tx)}
                                className="text-red-600 hover:text-red-900 transition-colors p-1 hover:bg-red-50 dark:hover:bg-gray-400 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Modal de Edición de Transacción */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col relative">
              <TransactionModal
                showModal={showModal}
                onClose={() => setShowModal(false)}
                editingTransaction={editingTransaction}
                formData={formData}
                setFormData={setFormData}
                categories={categories}
                incomeSources={incomeSources}
                enCuotas={enCuotas}
                setEnCuotas={setEnCuotas}
                cantidadCuotas={cantidadCuotas}
                setCantidadCuotas={setCantidadCuotas}
                fechaInicioCuotas={fechaInicioCuotas}
                setFechaInicioCuotas={setFechaInicioCuotas}
                fetchCategoriesByType={fetchCategoriesByType}
                formError={formError}
                resetForm={resetForm}
                handleSubmit={handleSubmit}
              />
            </div>
          </div>
        )}

        {/* Modal de confirmación de eliminación */}
        {confirmDelete.show && (
          <ConfirmDeleteModal
            message={`¿Estás seguro de que deseas eliminar esta transacción?`}
            onConfirm={async () => {
              const token = localStorage.getItem("token");
              const item = confirmDelete.target;
              
              if (!token || !item) return;
              
              try {
                const config = { headers: { Authorization: `Bearer ${token}` } };
                const base = item.type === "ingreso" ? "Incomes" : "Expenses";
                
                await api.delete(`/${base}/${item.id}`, config);
                
                // Actualizar la lista de transacciones
                setTransactions(prev => prev.filter(t => t.id !== item.id));
                
                // Cerrar el modal de confirmación
                setConfirmDelete({ show: false, target: null });
                
                // Mostrar mensaje de éxito con mensaje específico para eliminación
                setSuccessMessage("Transacción eliminada correctamente");
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 3000); // Cerrar automáticamente después de 3 segundos
                
                // Recargar datos
                fetchIncomes(token, userId);
              } catch (error) {
                console.error("Error al eliminar la transacción:", error);
              }
            }}
            onCancel={() => setConfirmDelete({ show: false, target: null, type: "" })}
          />
        )}
      
      {/* Modal de éxito */}
      {showSuccess && (
        <SuccessModal 
          message={successMessage} 
          onClose={() => setShowSuccess(false)} 
        />
      )}

      
    </div>

    
  );
}
