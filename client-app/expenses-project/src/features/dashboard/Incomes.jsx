import React, { useState, useEffect } from "react";
import axios from 'axios';
import { PieChart as RechartsPieChart, Cell, Pie, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { PieChart, TrendingUp } from 'lucide-react';

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

  // Datos para la torta - MEJORADO: colores secuenciales y únicos
  const chartData = categories.map((cat, index) => {
    const categorySum = transactions
      .filter((t) => t.categoryId === cat.id)
      .reduce((sum, t) => sum + t.amount, 0);
    return {
      name: cat.name,
      value: categorySum,
      color: getDistinctColor(index) // Color único basado en el índice
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

        {chartView === 'pie' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">
              Ingresos por Categoría
            </h3>
            <div className="flex flex-col lg:flex-row items-start gap-8">
              {/* Total de ingresos */}
              <div className="lg:w-64">
                <div className="bg-green-50 p-6 rounded-lg border-l-4 border-green-500">
                  <p className="text-gray-600 text-sm font-medium">Total Ingresos</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
                </div>
              </div>

              {/* Contenedor del gráfico y leyenda */}
              <div className="flex-1 w-full">
                {/* Gráfico de torta - MEJORADO: con bordes para mayor separación visual */}
                <div className="w-full" style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        dataKey="value"
                        stroke="#ffffff" // Borde blanco para separar segmentos
                        strokeWidth={2}  // Grosor del borde
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Leyenda personalizada con más espacio */}
                <div className="flex flex-wrap justify-center gap-4 mt-6 mb-4">
                  {chartData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-gray-700 text-sm font-medium">
                        {entry.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabla de ingresos por categoría - NUEVA SECCIÓN */}
            <div className="mt-8 space-y-4">
              <h4 className="font-semibold text-gray-700">Ingresos por categoría</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chartData.sort((a,b) => b.value - a.value).map((c,i) => (
                  <div key={i} className="flex justify-between items-center py-3 px-4 bg-gray-50 rounded-lg">
                    <span className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full block border-2 border-white shadow-sm"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="text-gray-700 font-medium">{c.name}</span>
                    </span>
                    <span className="font-semibold text-green-600">{formatCurrency(c.value)}</span>
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