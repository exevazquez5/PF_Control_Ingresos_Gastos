import React, { useState, useEffect } from "react";
import axios from 'axios';
import { PieChart as RechartsPieChart, Cell, Pie, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { PieChart, TrendingUp } from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

function parseJwt(token) {
  if (!token) return null;
  try {
    const base64Payload = token.split('.')[1];
    const jsonPayload = decodeURIComponent(atob(base64Payload).split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

const CREAM_PALETTE = [
  '#fef3c7', '#fde68a', '#fcd34d', '#fbbf24', '#f59e0b',
  '#eab308', '#fff7ed', '#fef9c3', '#fde047', '#facc15',
  '#eab308', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c',
  '#f97316', '#ea580c', '#e2e8f0', '#f1f5f9', '#e0f2fe'
];

function getRandomCreamColor() {
  const index = Math.floor(Math.random() * CREAM_PALETTE.length);
  return CREAM_PALETTE[index];
}

export default function ExpensesDashboard() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [chartView, setChartView] = useState('pie');

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const payload = parseJwt(token);
    if (!payload) return;

    const userId = payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    setUserId(userId);

    fetchCategories(token);
    fetchExpenses(token, userId);
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

  const fetchExpenses = async (token, userId) => {
    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await axios.get(`${BASE_URL}/api/Expenses`, config);
      console.log("responses: ", response)
      const expenses = response.data.map(i => ({ ...i, type: "gasto" }));
      setTransactions(expenses);
    } catch (error) {
      console.error("Error al obtener gastos:", error);
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

  const totalIncome = transactions.reduce((sum, t) => sum + t.amount, 0);

  const chartData = categories.map((cat) => {
    const categorySum = transactions
      .filter((t) => t.categoryId === cat.id)
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      name: cat.name,
      value: categorySum,
      color: getRandomCreamColor()
    };
  }).filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Dashboard de Gastos</h1>
            <p className="text-gray-600">Visualizá tus gastos por categoría</p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-lg"
          >
            Volver al Inicio
          </button>
        </div>

        <div className="flex bg-white rounded-lg shadow-lg p-1 w-fit mb-6">
          <button
            onClick={() => setChartView('pie')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
              chartView === 'pie' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <PieChart className="w-4 h-4" /> Torta
          </button>
        </div>

        {chartView === 'pie' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">
              Ingresos por Categoría
            </h3>
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="flex-1 w-full" style={{ minHeight: '400px' }}>
                <ResponsiveContainer width="100%" height={400}>
                  <RechartsPieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={120}
                        dataKey="value"
                        >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-4 lg:w-80">
                <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                  <p className="text-gray-600 text-sm font-medium">Total Gastos</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
