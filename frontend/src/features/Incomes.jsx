import React, { useState, useEffect } from "react";
import axios from 'axios';
import { PieChart as RechartsPieChart, Cell, Pie, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { parseJwt } from "../utils/jwt";
import { parseApiDate } from "../utils/date";
import { X, Edit2, Trash2, ChevronLeft, ChevronRight, DollarSign, TrendingUp, List } from 'lucide-react';

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

export default function IncomesDashboard() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [chartView, setChartView] = useState('pie');
  // para el modal
  const [showModal, setShowModal]       = useState(false);
  const [showMonthlyModal, setShowMonthlyModal] = useState(false);
  const [monthOffset, setMonthOffset]   = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("Todos"); 
  const [orderByMethod, setOrderByMethod] = useState("fecha-reciente");



  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const payload = parseJwt(token);
    if (!payload) return;

    const userId = payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    setUserId(userId);

    fetchCategories(token);
    fetchIncomes(token, userId);
  }, []);

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
  
  // últimos 5 movimientos
  const lastFive = [...transactions]
  .sort((a,b) => parseApiDate(b.date) - parseApiDate(a.date))
  .slice(0,5);
  
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
  
  const nextMonth = new Date(selMonth.getFullYear(), selMonth.getMonth()+1, 1);

  const monthTransactions = transactions.filter(t => {
  const d = parseApiDate(t.date);
  return d >= selMonth && d < nextMonth;
  });

  // Función para obtener las transacciones filtradas y ordenadas
  const getFilteredAndSortedTransactions = () => {
    // Primero filtramos por categoría
    let filteredTransactions = selectedCategory === "Todos"
      ? [...monthTransactions]
      : [...monthTransactions].filter(tx => tx.categoryName === selectedCategory);

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

  // Reemplaza tu modalList actual con esto:
  const modalList = getFilteredAndSortedTransactions();

  // Simplifica la función ordenarTransacciones:
  const ordenarTransacciones = (order) => {
    setOrderByMethod(order);
  };

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
  };
  }).filter(d => d.value > 0);

  const totalIncome = modalList.reduce((sum, t) => sum + t.amount, 0);

  const totalIncomes = chartData
  .reduce((a,b) => a + b.value, 0);

  const sortedChartData = [...chartData].sort((a, b) => b.value - a.value);

  const [formData, setFormData] = useState({
    type: 'ingreso',
    category: '',
    amount: '',
    date: '',
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
  const handleEdit = useTransactionEdit(setEditingTransaction, setFormData, setShowModal, fetchCategoriesByType);

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
      date: '',
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

        {/* Layout principal en grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">    

          {/* Bloque 1: Resumen de Ingresos con Gráfico - Ocupa toda la fila superior en desktop */}
          {chartView === 'pie' && (
            <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6">
              {/* Header mejorado para móviles */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                    <DollarSign className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                    Ingresos por Categoría
                  </h3>
                </div>
                
                {/* Selector de Mes - Mejorado para móviles */}
                <div className="flex items-center justify-center lg:justify-end">
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
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 items-center">
                {/* Total de Ingresos */}
                <div className="space-y-4 order-2 lg:order-1">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-700 dark:to-gray-600 rounded-xl p-4 border-l-4 border-green-500">
                    <p className="text-green-700 dark:text-green-400 font-medium mb-2">Total Ingresos</p>
                    <p className="text-2xl sm:text-3xl font-bold text-green-800 dark:text-green-300">
                      {formatCurrency(totalIncome)}
                    </p>
                  </div>
                  
                  {/* Leyenda del gráfico - Mejorada para móviles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {chartData.map((entry, index) => (
                      <div key={index} className="flex items-center justify-start p-2 bg-gray-50 dark:bg-gray-700 rounded-lg space-x-2 dark:text-white">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }}></div>
                        <span className="text-sm sm:text-base truncate">{entry.name}</span>
                      </div>
                    ))}
                  </div>
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
            </div>
          )}

          {/* Bloque 2: Últimos Movimientos - Parte inferior izquierda */}
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
                    <p className="font-medium text-gray-800 dark:text-white truncate">{tx.description}</p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-300">
                      {parseApiDate(tx.date).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-green-600 dark:text-green-400 text-sm sm:text-base">
                      +{formatCurrency(tx.amount)}
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

          {/* Bloque 3: Ingresos Agrupados por Categorías - Parte inferior derecha */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6 flex flex-col">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-lg">
                <List className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h4 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">Ingresos por Categoría</h4>
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

        {/* Modal de Transacciones Mensuales */}
        {showMonthlyModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col relative">
              <div className="p-4 sm:p-6 pb-0">

              {/* Filtros */}
              <div>
                <div className="flex items-end gap-4 mb-4">
                  {/* Filtro de categoría */}
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-white">
                      Filtrar por categoría
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="
                        w-full p-3 rounded-lg
                        bg-gray-50/50 border-0 text-gray-900
                        ring-1 ring-gray-200/60
                        focus:ring-2 focus:ring-blue-500 focus:bg-white
                        hover:ring-gray-300/80 transition-all duration-150
                        dark:bg-gray-800/50 dark:text-gray-100
                        dark:ring-gray-700/60 dark:focus:bg-gray-800
                        dark:hover:ring-gray-600/80
                      "
                    >
                      <option value="Todos">Todas las categorías</option>
                      {categories.filter((cat) => cat.type === "ingreso").map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select para ordenamiento */}
                  <div className="flex-shrink-0 min-w-[200px]">
                    <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-white">
                      Ordenar por
                    </label>
                    <select
                      value={orderByMethod}
                      onChange={(e) => ordenarTransacciones(e.target.value)}
                      className="
                        w-full p-3 rounded-lg
                        bg-gray-50/50 border-0 text-gray-900
                        ring-1 ring-gray-200/60
                        focus:ring-2 focus:ring-blue-500 focus:bg-white
                        hover:ring-gray-300/80 transition-all duration-150
                        dark:bg-gray-800/50 dark:text-gray-100
                        dark:ring-gray-700/60 dark:focus:bg-gray-800
                        dark:hover:ring-gray-600/80
                      "
                    >
                      <option value="fecha-reciente">Fecha: Más reciente</option>
                      <option value="fecha-antiguo">Fecha: Más antiguo</option>
                      <option value="precio-mayor">Precio: Mayor a menor</option>
                      <option value="precio-menor">Precio: Menor a mayor</option>
                    </select>
                  </div>

                  </div>
              
                <button
                  onClick={() => setShowMonthlyModal(false)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 dark:hover:text-white z-10"
                  >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              {/* Header del modal - Responsive */}
              <div className="p-4 sm:p-6 border-b">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pr-8 sm:pr-12">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setMonthOffset(m => m - 1)}
                      className="p-1 hover:bg-gray-100 dark:bg-white dark:hover:bg-gray-300 rounded"
                    >
                      <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <h5 className="text-base sm:text-lg font-semibold dark:text-white">
                      {selMonth.toLocaleDateString('es-AR', { year:'numeric', month:'long' })}
                    </h5>
                    <button
                      onClick={() => setMonthOffset(m => m + 1)}
                      className="p-1 hover:bg-gray-100 dark:bg-white dark:hover:bg-gray-300 rounded"
                    >
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                  <button
                    onClick={() => setMonthOffset(0)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Hoy
                  </button>
                </div>
              </div>

              {/* Lista de transacciones - Scrollable */}
              <div className="p-4 sm:p-6 flex-1 overflow-auto">
                <div className="space-y-2">
                  {modalList.length === 0 && (
                    <p className="text-gray-500 dark:text-white text-center py-8">No hay ingresos este mes.</p>
                  )}
                  {modalList.map(tx => (
                    <div key={tx.id} className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-600">
                      <div className="flex-1 min-w-0 pr-3">
                        <p className="font-medium dark:text-white text-sm sm:text-base truncate">{tx.description}</p>

                        <p className="text-gray-500 dark:text-white text-xs sm:text-sm">
                          {parseApiDate(tx.date).toLocaleDateString('es-AR')}
                        </p>

                        <p className="flex items-center gap-2 text-black text-sm dark:text-gray-300 text-sm">
                          <span 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: categoryColorMap[tx.categoryId] || '#6b7280' }}
                          ></span>
                          {tx.categoryName}
                        </p>

                        

                      </div>

                      <div className="flex gap-2">
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

                      <div className="font-medium text-green-600 text-sm sm:text-base flex-shrink-0">
                        +{formatCurrency(tx.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              </div>
            </div>
          </div>
        )}
        
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