import React, { useState, useEffect } from "react";
import axios from 'axios';
import { PieChart as RechartsPieChart, Cell, Pie, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { parseJwt } from "../../utils/jwt";
import { X, ChevronLeft, ChevronRight, DollarSign, TrendingUp, List } from 'lucide-react';


const BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [chartView, setChartView] = useState('pie');
  // para el modal
  const [showModal, setShowModal]       = useState(false);
  const [monthOffset, setMonthOffset]   = useState(0);


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
      const response = await axios.get(`${BASE_URL}/api/Categories`, config);
      setCategories(response.data);
    } catch (error) {
      console.error("Error al obtener categorías:", error);
    }
  };

  const fetchIncomes = async (token, userId) => {
    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(`${BASE_URL}/api/Incomes/filter?userId=${userId}`, config);
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
  .sort((a,b) => new Date(b.date) - new Date(a.date))
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
    const d = new Date(t.date);
    return d >= selMonth && d < nextMonth;
  });

  const categoryColorMap = categories.reduce((acc, cat, index) => {
    acc[cat.id] = getDistinctColor(index);
    return acc;
  }, {});

  // datos para la torta
  const chartData = categories.map((cat) => {
  const sum = monthTransactions
    .filter(t => t.categoryId === cat.id)
    .reduce((a, b) => a + b.amount, 0);
  return {
    name: cat.name,
    value: sum,
    color: categoryColorMap[cat.id],
    categoryId: cat.id // ← Mantener referencia al ID original
  };
}).filter(d => d.value > 0);


  const modalList = [...monthTransactions].sort((a,b) => new Date(b.date) - new Date(a.date));

  const totalIncome = modalList.reduce((sum, t) => sum + t.amount, 0);

  const totalIncomes = chartData
  .reduce((a,b) => a + b.value, 0);

  const sortedChartData = [...chartData].sort((a, b) => b.value - a.value);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:bg-gradient-to-br dark:from-gray-900 dark:to-black p-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header con navegación */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2 dark:text-white">Detalle de Ingresos</h1>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-lg"
          >
            Volver al Inicio
          </button>
        </div>

        {/* Layout principal en grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">    

          {/* Bloque 1: Resumen de Ingresos con Gráfico - Ocupa toda la fila superior en desktop */}
          {chartView === 'pie' && (
            <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                    <DollarSign className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                    Ingresos por Categoría
                  </h3>
                </div>
                
                {/* Selector de Mes */}
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-full px-6 py-3">
                  <button
                    onClick={() => setMonthOffset(m => m - 1)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-white" />
                  </button>
                  <h5 className="text-lg font-semibold dark:text-white min-w-[140px] text-center">
                    {selMonth.toLocaleDateString('es-AR', { year:'numeric', month:'long' })}
                  </h5>
                  <button
                    onClick={() => setMonthOffset(m => m + 1)}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-700 dark:text-white" />
                  </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-8 items-center">
                {/* Total de Ingresos */}
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-700 dark:to-gray-600 rounded-xl p-4 border-l-4 border-green-500">
                    <p className="text-green-700 dark:text-green-400 font-medium mb-2">Total Ingresos</p>
                    <p className="text-3xl font-bold text-green-800 dark:text-green-300">
                      {formatCurrency(totalIncome)}
                    </p>
                  </div>
                  
                  {/* Leyenda del gráfico */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {chartData.map((entry, index) => (
                      <div key={index} className="flex items-center justify-start p-2 bg-gray-50 dark:bg-gray-700 rounded-lg space-x-2 dark:text-white">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: entry.color }}></div>
                        <span>{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Gráfico de Torta */}
                <div className="flex justify-center">
                  <div className="w-full" style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height={280}>
                      <RechartsPieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={120}
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 w-full max-w-full">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-lg">
                <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="text-xl font-bold text-gray-800 dark:text-white">Últimos Movimientos</h4>
            </div>
            
            <div className="space-y-3">
              {lastFive.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 dark:text-white">{tx.description}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-300">
                      {new Date(tx.date).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600 dark:text-green-400">
                      +{formatCurrency(tx.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowModal(true)}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium hover:underline"
              >
                Ver todos los movimientos
              </button>
            </div>
          </div>

          {/* Bloque 3: Ingresos Agrupados por Categorías - Parte inferior derecha */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 flex flex-col">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-lg">
                <List className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
              <h4 className="text-xl font-bold text-gray-800 dark:text-white">Ingresos por Categoría</h4>
            </div>
            
            <div className="grid grid-cols-1 gap-4 flex-1 overflow-y-auto">
              {sortedChartData.map((c,i) => (

                <div key={i} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-xl px-4 py-3 border-l-4 border-gray-300 dark:border-gray-500">
                  <div className="flex items-center space-x-3 mb-2">
                    <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-white">{c.name}</h3>
                  </div>
                  <p className="text-lg font-bold text-gray-800 dark:text-white">
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

        {/* Modal - Manteniendo tu funcionalidad existente */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl p-6 relative">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 dark:hover:text-white"
              >
                <X />
              </button>

              <div className="flex justify-between items-center mb-4 pr-12">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMonthOffset(m => m - 1)}
                    className="p-1 hover:bg-gray-100 dark:bg-white dark:hover:bg-gray-300 rounded"
                  >
                    <ChevronLeft />
                  </button>
                  <h5 className="text-lg font-semibold dark:text-white">
                    {selMonth.toLocaleDateString('es-AR', { year:'numeric', month:'long' })}
                  </h5>
                  <button
                    onClick={() => setMonthOffset(m => m + 1)}
                    className="p-1 hover:bg-gray-100 dark:bg-white dark:hover:bg-gray-300 rounded"
                  >
                    <ChevronRight />
                  </button>
                </div>
                <button
                  onClick={() => setMonthOffset(0)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Hoy
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-auto">
                {modalList.length === 0 && (
                  <p className="text-gray-500 dark:text-white">No hay ingresos este mes.</p>
                )}
                {modalList.map(tx => (
                  <div key={tx.id} className="flex justify-between py-2 border-b">
                    <div>
                      <p className="font-medium dark:text-white">{tx.description}</p>
                      <p className="text-gray-500 dark:text-white text-sm">
                        {new Date(tx.date).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    <div className="font-medium text-green-600">
                      +{formatCurrency(tx.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}