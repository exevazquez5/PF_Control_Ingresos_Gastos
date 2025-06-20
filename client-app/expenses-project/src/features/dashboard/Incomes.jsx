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

function generateRandomColor() {
  let color;
  do {
    color = '#' + Math.floor(Math.random()*16777215).toString(16);
  } while (/^(#?(?:[0]{6}|[fF]{6}|[cC]{6}|[eE]{6}|[dD]{6}|[aA]{6}))$/.test(color));
  return color;
}

export default function IncomesDashboard() {
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

  const totalIncome = transactions.reduce((sum, t) => sum + t.amount, 0);

  const chartData = categories.map((cat) => {
    const categorySum = transactions
      .filter((t) => t.categoryId === cat.id)
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      name: cat.name,
      value: categorySum,
      color: generateRandomColor()
    };
  }).filter(d => d.value > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Dashboard de Ingresos</h1>
            <p className="text-gray-600">Visualizá tus ingresos por categoría</p>
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
                  <p className="text-gray-600 text-sm font-medium">Total Ingresos</p>
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
