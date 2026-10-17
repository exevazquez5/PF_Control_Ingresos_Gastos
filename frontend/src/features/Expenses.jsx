import React, { useState, useEffect } from "react";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { parseJwt } from "../utils/jwt";
import { X, Edit2, Trash2, ChevronLeft, ChevronRight, DollarSign, TrendingUp, List, CheckCircle, Users, ReceiptText } from 'lucide-react';
import { useTransactionDelete } from '../hooks/useTransactionDelete';
import { useTransactionEdit } from '../hooks/useTransactionEdit';
import TransactionModal from "./TransactionModal";
import ConfirmDeleteModal from "../dashboard/ConfirmDeleteModal";
import SuccessModal from "../dashboard/SucessModal";
import PayAllModal from "../dashboard/PayAllModal";
import formatCurrency from "../utils/format.js"
import { parseApiDate, todayInputDate } from "../utils/date";
import { incomeFields } from "../utils/transactionService";

import ExpensesChart from "../components/expenses/ExpensesChart";
import ExpensesList from "../components/expenses/ExpensesList";

import { getCategoriesFlat } from "../services/categoriesService";
import { getIncomeSources } from "../services/incomeSourcesService";
import { getExpenses } from "../services/expensesService";
import { fetchCuotasPendientes } from "../services/expensesService";
import { pagarTodasCuotas } from "../services/expensesService";
import api from '../api/axios.config.js';
import ExpenseWorkspaceSections from './ExpenseWorkspaceSections';

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

// Lista de meses en español
const meses = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

// Función para obtener colores únicos y secuenciales
function getDistinctColor(index) {
  return IMPROVED_PALETTE[index % IMPROVED_PALETTE.length];
}

export default function ExpensesDashboard() {

  const token = localStorage.getItem("token");

  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [incomeSources, setIncomeSources] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartView, setChartView] = useState('pie');
  // para los modales
  const [showModal, setShowModal] = useState(false);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);
  const [monthOffset, setMonthOffset]   = useState(0);
  const [cuotasPendientes, setCuotasPendientes] = useState([]);
  const [resumenCuotas, setResumenCuotas] = useState(null);
  const [enCuotas, setEnCuotas] = useState(false);
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [fechaInicioCuotas, setFechaInicioCuotas] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Cambios guardados");
  const [selectedCategory, setSelectedCategory] = useState("Todos"); 
  const [confirmDelete, setConfirmDelete] = useState({ show: false, target: null, type: "" });
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showPayAllModal, setShowPayAllModal] = useState(false);
  const [orderByMethod, setOrderByMethod] = useState("fecha-reciente");
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('movimientos');

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
    categoryId: '',
    fundingSource: 'Income'
  });

  const handleDelete = useTransactionDelete(setConfirmDelete);
  const handleEdit = useTransactionEdit(setEditingTransaction, setFormData, setShowModal, setEnCuotas, setCantidadCuotas);

  useEffect(() => {
    if (!cuotasPendientes) return;

    const total = cuotasPendientes.length;
    const monto = cuotasPendientes.reduce((sum, c) => sum + c.montoCuota, 0);

    setResumenCuotas({
      cuotasPendientes: total,
      montoPendiente: monto,
    });
  }, [cuotasPendientes]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const payload = parseJwt(token);
        if (!payload) return;

        const uid = payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
        setUserId(uid);

        const cats = await getCategoriesFlat();
        setCategories(cats);
        setAllCategories(cats);

        try {
          const fuentes = await getIncomeSources();
          setIncomeSources(fuentes);
        } catch {
          // La página de gastos no necesita fuentes para funcionar
        }

        const txs = await getExpenses(uid, monthOffset); // <--- uid en vez de userId
        setTransactions(txs);

        const selectedMonth = new Date(new Date().getFullYear(), new Date().getMonth() + monthOffset, 1);
        const reimbursementsResponse = await api.get('/expense-workspace/reimbursements', { params: { year: selectedMonth.getFullYear(), month: selectedMonth.getMonth() + 1 } });
        setReimbursements(reimbursementsResponse.data.map(r => ({
          id: `reintegro-${r.id}`, originalId: r.id, type: 'reintegro', amount: r.amount,
          description: `Reintegro de ${r.participantName} · ${r.bill?.serviceNameSnapshot || 'Servicio'}${r.bill?.period ? ` (${new Date(r.bill.period).toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })})` : ''}`, date: r.date,
          categoryName: 'Servicios compartidos', categoryId: null,
          fundingSource: null,
        })));

        const cuotas = await fetchCuotasPendientes(uid, monthOffset);
        setCuotasPendientes(cuotas);

      } catch (error) {
        // Si es un error de sesión expirada, no hacer nada - el interceptor ya maneja la redirección
        if (error.message === 'SESSION_EXPIRED') {
          console.log('Sesión expirada, redirigiendo...');
          return; // Salir sin hacer nada más
        }
        
        // Solo manejar otros errores que no sean de autenticación
        if (error.response?.status !== 401) {
          console.error('Error al cargar datos:', error);
          setError('Error al cargar los datos');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [monthOffset]);

  // para el modal: filtrar ingresos del mes
  const zeroDate = new Date();
  zeroDate.setDate(1);
  zeroDate.setHours(0,0,0,0);
  const baseMonth = new Date(zeroDate.getFullYear(), zeroDate.getMonth(), 1);
  const selMonth = new Date(
    baseMonth.getFullYear(),
    baseMonth.getMonth() + monthOffset,
    1
  );

  // últimos 5 movimientos
  const movementRows = [...transactions, ...reimbursements];
  const lastFive = [...movementRows].sort((a,b) => parseApiDate(b.date) - parseApiDate(a.date)).slice(0,5);
  
  const nextMonth = new Date(selMonth.getFullYear(), selMonth.getMonth()+1, 1);
  
  const monthTransactions = transactions.filter(t => {
    const d = parseApiDate(t.date);
    return d >= selMonth && d < nextMonth;
  });

  const categoryColorMap = categories.reduce((acc, cat, index) => {
    acc[cat.id] = getDistinctColor(index);
    return acc;
  }, {});

  // datos para la torta
  const chartData = categories.map((cat) => {
  const sum = monthTransactions.filter(t => t.categoryId === cat.id).reduce((a, b) => a + b.amount, 0);
    return {
      name: cat.name,
      value: sum,
      color: categoryColorMap[cat.id],
      categoryId: cat.id // ← Mantener referencia al ID original
    };}).filter(d => d.value > 0);

  const getFilteredAndSortedTransactions = () => {
    // Primero filtramos por categoría
    let filteredTransactions = selectedCategory === "Todos"
      ? [...monthTransactions, ...reimbursements]
      : [...monthTransactions, ...reimbursements].filter(tx => tx.categoryName === selectedCategory);

    // Luego aplicamos el ordenamiento según orderByMethod
    const orderByDateLast = (a, b) => parseApiDate(b.date) - parseApiDate(a.date);
    const orderByDateFirst = (a, b) => parseApiDate(a.date) - parseApiDate(b.date);
    const orderByPriceMax = (a, b) => b.amount - a.amount;
    const orderByPriceMin = (a, b) => a.amount - b.amount;

    switch (orderByMethod) {
      case 'fecha-reciente':
        return filteredTransactions.sort(orderByDateLast);
      case 'fecha-antiguo':
        return filteredTransactions.sort(orderByDateFirst);
      case 'precio-mayor':
        return filteredTransactions.sort(orderByPriceMax);
      case 'precio-menor':
        return filteredTransactions.sort(orderByPriceMin);
      default:
        return filteredTransactions.sort(orderByDateLast);
    }
  };

  const modalList = getFilteredAndSortedTransactions();

  const ordenarTransacciones = (order) => {
    setOrderByMethod(order);
  };

  const totalExpense = modalList.filter(t => t.type !== 'reintegro').reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = transactions.filter(t => t.type === "ingreso").reduce((sum, t) => sum + t.amount, 0);

  const sortedChartData = [...chartData].sort((a, b) => b.value - a.value);
  
  const obtenerMesAnioDeCuotas = () => {
    if (cuotasPendientes.length === 0) return { mesNombre: '', anio: '' };

    const fecha = new Date(cuotasPendientes[0].dueDate); // <-- MES REAL de la cuota
    const mesNombre = meses[fecha.getMonth()];
    const anio = fecha.getFullYear();

    return { mesNombre, anio };
  };

  const { mesNombre, anio } = obtenerMesAnioDeCuotas();

  const handlePagarTodo = async () => {
    try {
      const base = new Date();
      base.setDate(1);
      const target = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
      const anio = target.getFullYear();
      const mes = target.getMonth() + 1;

      const result = await pagarTodasCuotas(userId, anio, mes);

      const cuotas = await fetchCuotasPendientes(userId, monthOffset);
      setCuotasPendientes(cuotas);
      const txs = await getExpenses(userId, monthOffset);
      setTransactions(txs);

      setShowPayAllModal(false);
      setSuccessMessage(`${result.cuotasPagadas} cuota${result.cuotasPagadas > 1 ? 's' : ''} pagada${result.cuotasPagadas > 1 ? 's' : ''} — ${formatCurrency(result.totalPagado)}`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Error al pagar todas las cuotas:", err);
    }
  };

  // Definición de formError y funciones faltantes
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
      categoryId: '',
      fundingSource: 'Income'
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
      if (editingTransaction?.type === "cuota" && !formData.accountingDate) {
        setFormError("Seleccioná el mes en que querés contabilizar la cuota.");
        return;
      }
    
    const token = localStorage.getItem("token");
    if (!token || !userId) return;

    if (editingTransaction?.type === "cuota") {
      try {
        await api.put(`/Expenses/cuotas/${editingTransaction.id}/periodo`, {
          paidAt: new Date(formData.date).toISOString(),
          accountingDate: new Date(formData.accountingDate).toISOString()
        }, { headers: { Authorization: `Bearer ${token}` } });
        setTransactions(await getExpenses(userId, monthOffset));
        setSuccessMessage("Fecha y período de la cuota actualizados");
        setShowSuccess(true);
        resetForm();
      } catch (error) {
        console.error("Error al corregir el período de la cuota:", error);
        const responseData = error.response?.data;
        setFormError(typeof responseData === 'string' ? responseData : responseData?.message || "No se pudo actualizar el período de la cuota.");
      }
      return;
    }
    
    try {
      const isEditing = !!editingTransaction;

      //Si es una cuota, normalizar el tipo y usar el expenseId real
      const transactionToEdit = isEditing ? {
        ...editingTransaction,
        type: editingTransaction.type === "cuota" ? "gasto" : editingTransaction.type,
        id: editingTransaction.type === "cuota" ? editingTransaction.expenseId : editingTransaction.id
      } : null;

      const tipoNuevo = formData.type.toLowerCase();
      const tipoViejo = editingTransaction?.type === "cuota" ? "gasto" : editingTransaction?.type.toLowerCase();
      
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
        userId: Number(userId),
        fundingSource: formData.fundingSource || "Income"
      };
      
      const config = { headers: { Authorization: `Bearer ${token}` } };

      if (isEditing) {
        if (tipoNuevo !== tipoViejo) {
          // Si cambió el tipo, eliminar el anterior y crear uno nuevo
          const response = await api.post(`/${baseNuevo}`, body, config);
          await api.delete(`/${baseViejo}/${transactionToEdit.id}`, config);


          
          // Actualizar la lista de transacciones
          setTransactions(prev => [
            ...prev.filter(t => t.id !== transactionToEdit.id),
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
            `/${baseNuevo}/${transactionToEdit.id}`,
            { ...body, id: transactionToEdit.id },
            config
          );
          
          // Actualizar la lista de transacciones
          setTransactions(prev => 
            prev.map(t => t.id === transactionToEdit.id ? {
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
      
    } catch (error) {
      console.error("Error al guardar la transacción:", error);
      setFormError(error.response?.data?.message || "Error al guardar la transacción");
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:bg-gradient-to-br dark:from-gray-900 dark:to-black p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header con navegación */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2 dark:text-white">Detalle de gastos</h1>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-lg w-full sm:w-auto"
          >
            Volver al Inicio
          </button>
        </div>

        <nav aria-label="Secciones de gastos" className="mb-6 flex w-full flex-wrap gap-2 rounded-xl bg-gray-200 p-2 dark:bg-gray-800">
          {[
            { id: 'movimientos', label: 'Movimientos', Icon: List },
            { id: 'servicios', label: 'Servicios compartidos', Icon: Users },
            { id: 'impuestos', label: 'Impuestos ARCA', Icon: ReceiptText },
          ].map(({ id, label, Icon }) => <button key={id} onClick={() => setActiveSection(id)} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold transition-colors ${activeSection === id ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-white dark:text-gray-200 dark:hover:bg-gray-700'}`}>{React.createElement(Icon, { size: 18 })}{label}</button>)}
        </nav>

        {activeSection === 'movimientos' ? <>

        {/* Layout principal en grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">    

          {/* Bloque 1: Resumen de gastos con Gráfico */}
          {chartView === 'pie' && (
            <ExpensesChart
              chartData={chartData}
              totalExpense={totalExpense}
              monthLabel={selMonth.toLocaleDateString('es-AR', { year:'numeric', month:'long' })}
              onPrevMonth={() => setMonthOffset(m => m - 1)}
              onNextMonth={() => setMonthOffset(m => m + 1)}
            />
          )}

          {/* NUEVO BLOQUE REDISEÑADO DE CUOTAS */}
          <div className="xl:col-span-2 w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6">
            {/* Top: resumen cuotas y monto */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 bg-orange-50 dark:bg-gray-700 border-l-4 border-orange-500 p-4 rounded">
                <h4 className="text-sm text-gray-600 dark:text-gray-300">Cuotas pendientes este mes</h4>
                <p className="text-2xl font-bold text-orange-600">
                  {resumenCuotas ? resumenCuotas.cuotasPendientes : 0}
                </p>
              </div>

              <div className="flex-1 bg-yellow-50 dark:bg-gray-700 border-l-4 border-yellow-500 p-4 rounded">
                <h4 className="text-sm text-gray-600 dark:text-gray-300">Monto pendiente total</h4>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(resumenCuotas ? resumenCuotas.montoPendiente : 0)}
                </p>
              </div>

              <div className="flex-1 bg-green-50 dark:bg-gray-700 border-l-4 border-green-500 p-4 rounded">
                <h4 className="text-sm text-gray-600 dark:text-gray-300 mb-2">Pagar resumen</h4>
                <button
                  onClick={() => setShowPayAllModal(true)}
                  disabled={cuotasPendientes.length === 0}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>
                    {cuotasPendientes.length > 0 ? `Pagar ${cuotasPendientes.length} cuota${cuotasPendientes.length > 1 ? 's' : ''}` : 'Sin cuotas pendientes'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Bloque 2: Últimos Movimientos */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 w-full max-w-full">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">Últimos Movimientos</h4>
            </div>
            
            <div className="space-y-3">
              {lastFive.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="font-medium text-gray-800 dark:text-white truncate">
                      {tx.description}
                      {tx.fundingSource && tx.fundingSource !== 'Income' && (
                        <span className="ml-1 text-xs">
                          {tx.fundingSource === 'Savings' ? '🏦' : '💳'}
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-300">
                      {parseApiDate(tx.date).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm sm:text-base ${tx.type === 'reintegro' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {tx.type === 'reintegro' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 text-center">
              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setShowMonthlyModal(true);
                }}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium hover:underline"
              >
                Ver todos los movimientos
              </button>
            </div>
          </div>

          {/* Bloque 3: gastos Agrupados por Categorías */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 flex flex-col">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-lg">
                <List className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">Gastos por Categoría</h4>
            </div>
            
            <div className="grid grid-cols-1 gap-4 flex-1 overflow-y-auto">
              {sortedChartData.map((c,i) => (
                <div key={i} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-xl px-4 py-3 border-l-4 border-gray-300 dark:border-gray-500">
                  <div className="flex items-center space-x-3 mb-2">
                    <div
                        className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-white truncate">{c.name}</h3>
                  </div>
                  <p className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
                    {formatCurrency(c.value)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                    {((c.value / chartData.reduce((acc, item) => acc + item.value, 0)) * 100).toFixed(1)}% del total
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        </> : <ExpenseWorkspaceSections section={activeSection} />}

        {/* Modal de Transacciones Mensuales */}
        <ExpensesList
          showMonthlyModal={showMonthlyModal}
          setShowMonthlyModal={setShowMonthlyModal}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
          orderByMethod={orderByMethod}
          ordenarTransacciones={ordenarTransacciones}
          selMonth={selMonth}
          setMonthOffset={setMonthOffset}
          modalList={modalList}
          categoryColorMap={categoryColorMap}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
        />

        {/* Modal de Edición de Transacción */}
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
          formError={formError}
          resetForm={resetForm}
          handleSubmit={handleSubmit}
          totalIncome={totalIncome}
        />

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
                const deleteId = item.type === "cuota" ? item.expenseId : item.id;
                
                await api.delete(`/${base}/${deleteId}`, config);
                
                // Actualizar la lista de transacciones
                setTransactions(prev => prev.filter(t => t.id !== item.id));
                
                // Cerrar el modal de confirmación
                setConfirmDelete({ show: false, target: null });
                
                // Mostrar mensaje de éxito con mensaje específico para eliminación
                setSuccessMessage("Transacción eliminada correctamente");
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 3000); // Cerrar automáticamente después de 3 segundos
                
                // Recargar datos
                getExpenses(userId);
              } catch (error) {
                console.error("Error al eliminar la transacción:", error);
              }
            }}
            onCancel={() => setConfirmDelete({ show: false, target: null, type: "" })}
          />
        )}
      </div>
      
      {/* Modal de pago de todas las cuotas */}
      {showPayAllModal && (
        <PayAllModal
          cuotas={cuotasPendientes}
          selMonth={selMonth}
          onClose={() => setShowPayAllModal(false)}
          onConfirm={handlePagarTodo}
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
