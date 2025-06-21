import React, { useState, useEffect } from "react";
import axios from 'axios';
import {
  PieChart as RechartsPieChart,
  Cell, Pie, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

const CREAM_PALETTE = [
  '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b',
  '#eab308', '#fff7ed', '#fef9c3', '#fde047', '#facc15',
  '#eab308', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c',
  '#f97316', '#ea580c', '#e2e8f0', '#f1f5f9', '#e0f2fe'
];
function getRandomCreamColor() {
  return CREAM_PALETTE[Math.floor(Math.random() * CREAM_PALETTE.length)];
}

function parseJwt(token) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export default function ExpensesDashboard() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories]     = useState([]);
  const [userId, setUserId]             = useState(null);
  const [loading, setLoading]           = useState(false);

  // para el modal
  const [showModal, setShowModal]       = useState(false);
  const [monthOffset, setMonthOffset]   = useState(0);

  // -- fetch inicial --
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const payload = parseJwt(token);
    if (!payload) return;
    const id = payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    setUserId(id);
    fetchCategories(token);
    fetchExpenses(token);
  }, []);

  const fetchCategories = async (token) => {
    try {
      const cfg = { headers: { Authorization: `Bearer ${token}` }};
      const res = await axios.get(`${BASE_URL}/api/Categories`, cfg);
      setCategories(res.data);
    } catch (e) {
      console.error(e);
    }
  };
  const fetchExpenses = async (token) => {
    setLoading(true);
    try {
      const cfg = { headers: { Authorization: `Bearer ${token}` }};
      const res = await axios.get(`${BASE_URL}/api/Expenses`, cfg);
      setTransactions(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // formateo moneda
  const formatCurrency = (amt) =>
    new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(amt);

  // datos para la torta
  const chartData = categories
    .map(cat => {
      const sum = transactions
        .filter(t => t.categoryId === cat.id)
        .reduce((a,b) => a + b.amount, 0);
      return { name: cat.name, value: sum, color: getRandomCreamColor() };
    })
    .filter(d => d.value > 0);

  const totalExpenses = chartData
    .reduce((a,b) => a + b.value, 0);

  // últimos 5 movimientos
  const lastFive = [...transactions]
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .slice(0,5);

  // para el modal: filtrar gastos del mes
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

  const modalList = transactions
    .filter(t => {
      const d = new Date(t.date);
      return d >= selMonth && d < nextMonth;
    })
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-800">Dashboard de Gastos</h1>
            <p className="text-gray-600">Visualizá tus gastos por categoría</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg hover:bg-blue-700 flex items-center"
          >
            Volver al Inicio
          </button>
        </div>

        {/* gráfico + totales */}
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          <h3 className="text-xl font-semibold text-gray-800 text-center">
            Gastos por Categoría
          </h3>
      
          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* total */}
            <div className="lg:w-64">
              <div className="bg-green-50 p-6 rounded-lg border-l-4 border-green-500">
                <p className="text-gray-600 text-sm font-medium">Total Gastos</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(totalExpenses)}
                </p>
              </div>
            </div>

            {/* torta */}
            <div className="flex-1 w-full" style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    dataKey="value"
                    labelLine={false}
                  >
                    {chartData.map((e,i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>

            
          </div>

          {/* abajo: últimos 5 | totales por categoría */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">

            {/* izquierda: últimos 5 */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-700">Últimos movimientos</h4>
              {lastFive.map(tx => (
                <div key={tx.id} className="flex justify-between">
                  <div>
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-gray-500 text-sm">
                      {new Date(tx.date).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="font-medium text-red-600">
                    -{formatCurrency(tx.amount)}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setShowModal(true)}
                className="mt-2 text-blue-600 hover:underline text-sm"
              >
                Ver todos los movimientos
              </button>
            </div>

            {/* derecha: tabla de totales */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-700">Gastos por categoría</h4>
              {chartData.sort((a,b) => b.value - a.value).map((c,i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b">
                  <span className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full block"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-gray-700">{c.name}</span>
                  </span>
                  <span className="font-medium">{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl p-6 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
            >
              <X />
            </button>

            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMonthOffset(m => m - 1)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <ChevronLeft />
                </button>
                <h5 className="text-lg font-semibold">
                  {selMonth.toLocaleDateString('es-AR',{ year:'numeric', month:'long' })}
                </h5>
                <button
                  onClick={() => setMonthOffset(m => m + 1)}
                  className="p-1 hover:bg-gray-100 rounded"
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
                <p className="text-gray-500">No hay gastos este mes.</p>
              )}
              {modalList.map(tx => (
                <div key={tx.id} className="flex justify-between py-2 border-b">
                  <div>
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-gray-500 text-sm">
                      {new Date(tx.date).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="text-red-600 font-medium">
                    -{formatCurrency(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
