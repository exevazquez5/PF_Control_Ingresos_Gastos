import React, { useState, useEffect } from "react";
import axios from 'axios';
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3, PieChart, Grid3X3 } from 'lucide-react';
import { PieChart as RechartsPieChart, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Pie } from 'recharts';

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

const Dashboard = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [filterParams, setFilterParams] = useState({
    userId: '',
    categoryId: '',
    from: '',
    to: ''
  });
  const [filteredData, setFilteredData] = useState(null);
  const [chartView, setChartView] = useState('default');
  const [showModal, setShowModal] = useState(false);


  // Inicializar: leer token y cargar transacciones
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("No hay token guardado");
      return;
    }
    const payload = parseJwt(token);
    if (!payload) return;

    const userId = payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];
    const role = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"];
    const isAdmin = role === "Admin";

    setIsAdmin(isAdmin);
    setUserId(userId);

    fetchTransactions(token, userId, isAdmin);
  }, []);

  const fetchTransactions = async (token, userId, isAdmin) => {
    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };

      if (isAdmin) {
        const [incomesRes, expensesRes] = await Promise.all([
          axios.get(`${BASE_URL}/api/Incomes`, config),
          axios.get(`${BASE_URL}/api/Expenses`, config)
        ]);

        const incomes = incomesRes.data.map(i => ({ ...i, type: "ingreso" }));
        const expenses = expensesRes.data.map(e => ({ ...e, type: "gasto" }));
        setTransactions([...incomes, ...expenses]);
      } else {
        // Usuarios normales: solo sus ingresos y gastos
        const [incomesRes, expensesRes] = await Promise.all([
          axios.get(`${BASE_URL}/api/Incomes/filter?userId=${userId}`, config),
          axios.get(`${BASE_URL}/api/Expenses/filter?userId=${userId}`, config)
        ]);

        const incomes = incomesRes.data.map(i => ({ ...i, type: "ingreso" }));
        const expenses = expensesRes.data.map(e => ({ ...e, type: "gasto" }));
        setTransactions([...incomes, ...expenses]);
      }
    } catch (error) {
      console.error("Error al cargar transacciones:", error);
      if (error.response) {
        console.error("Error response data:", error.response.data);
        console.error("Error response status:", error.response.status);
      }
      alert("No se pudieron cargar las transacciones");
    }
  };

  const createTransaction = async (formData) => {
    const token = localStorage.getItem("token");
    if (!token || !userId) return;

    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const body = {
        amount: parseFloat(formData.amount),
        description: formData.description,
        date: formData.date,
        categoryId: formData.categoryId,
        userId: parseInt(userId)
      };

      let url = "", type = "";
      if (formData.type === "ingreso") {
        url = `${BASE_URL}/api/Incomes`;
        type = "ingreso";
      } else {
        url = `${BASE_URL}/api/Expenses`;
        type = "gasto";
      }

      const response = await axios.post(url, body, config);
      setTransactions(prev => [...prev, { ...response.data, type }]);
    } catch (err) {
      console.error("Error creando transacción:", err);
      alert("Error creando transacción");
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

  const fetchSummary = async (summaryUserId) => {
  const token = localStorage.getItem("token");
  if (!token) return;

  if (!summaryUserId) {
    alert("Por favor ingresa un User ID");
    return;
  }

  setLoading(true);
  try {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const response = await axios.get(`${BASE_URL}/api/Incomes/summary/${summaryUserId}`, config);
    setSummaryData(response.data);
  } catch (error) {
    console.error("Error al obtener el resumen:", error);
    alert("No se pudo obtener el resumen del usuario.");
  } finally {
    setLoading(false);
  }
  };

  const fetchFilteredData = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const { userId, categoryId, from, to } = filterParams;
    if (!userId) {
      alert("Por favor ingresa un User ID");
      return;
    }

    setLoading(true);
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const query = new URLSearchParams({
        userId,
        categoryId,
        from,
        to
      });

      const response = await axios.get(`${BASE_URL}/api/Incomes/filter?${query}`, config);
      setFilteredData(response.data);
    } catch (error) {
      console.error("Error al obtener datos filtrados:", error);
      alert("No se pudieron obtener los datos filtrados.");
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = transactions
  .filter((t) => t.type === "ingreso")
  .reduce((sum, t) => sum + t.amount, 0);

const totalExpenses = transactions
  .filter((t) => t.type === "gasto")
  .reduce((sum, t) => sum + t.amount, 0);

const balance = totalIncome - totalExpenses;

const chartData = [
  { name: "Ingresos", value: totalIncome },
  { name: "Gastos", value: totalExpenses }
];

const barChartData = [
  { name: "Ingresos", amount: totalIncome },
  { name: "Gastos", amount: totalExpenses },
  { name: "Balance", amount: balance }
];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Control Personal de Finanzas</h1>
            <p className="text-gray-600">Gestiona tus ingresos y gastos de manera inteligente</p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Chart View Selector */}
            <div className="flex bg-white rounded-lg shadow-lg p-1">
              <button
                onClick={() => setChartView('default')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                  chartView === 'default'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
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
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <PieChart className="w-4 h-4" />
                Torta
              </button>
              <button
                onClick={() => setChartView('bar')}
                className={`flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-all ${
                  chartView === 'bar'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Barras
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards / Charts */}
        <div className="mb-8">
          {chartView === 'default' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Total Ingresos</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-full">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Total Gastos</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
                  </div>
                  <div className="bg-red-100 p-3 rounded-full">
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">Balance</p>
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
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Distribución de Ingresos vs Gastos</h3>
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <div className="flex-1 w-full" style={{ minHeight: '400px' }}>
                  <ResponsiveContainer width="100%" height={400}>
                    <RechartsPieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) => `${name}: ${formatCurrency(value)} (${(percent * 100).toFixed(1)}%)`}
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
                  <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                    <p className="text-gray-600 text-sm font-medium">Total Ingresos</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                    <p className="text-gray-600 text-sm font-medium">Total Gastos</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-gray-600 text-sm font-medium">Balance</p>
                    <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatCurrency(balance)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {chartView === 'bar' && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-6 text-center">Comparación de Ingresos, Gastos y Balance</h3>
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <div className="flex-1 w-full" style={{ minHeight: '400px' }}>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => formatCurrency(value)} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="amount" name="Monto" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="flex flex-col gap-4 lg:w-80">
                  <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                    <p className="text-gray-600 text-sm font-medium">Total Ingresos</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
                    <p className="text-xs text-gray-500 mt-1">Dinero que entra</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                    <p className="text-gray-600 text-sm font-medium">Total Gastos</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
                    <p className="text-xs text-gray-500 mt-1">Dinero que sale</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                    <p className="text-gray-600 text-sm font-medium">Balance</p>
                    <p className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatCurrency(balance)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {balance >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Transacciones Recientes</h2>
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Nueva Transacción
          </button>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descripción</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.type === 'ingreso' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {transaction.type === 'ingreso' ? 'Ingreso' : 'Gasto'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {transaction.category}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                      <span className={transaction.type === 'ingreso' ? 'text-green-600' : 'text-red-600'}>
                        {transaction.type === 'ingreso' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(transaction.date).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="text-blue-600 hover:text-blue-900 transition-colors p-1 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(transaction.id)}
                          className="text-red-600 hover:text-red-900 transition-colors p-1 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  {editingTransaction ? 'Editar Transacción' : 'Nueva Transacción'}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value, category: ''})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="ingreso">Ingreso</option>
                      <option value="gasto">Gasto</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Seleccionar categoría</option>
                      {(formData.type === 'ingreso' ? incomeCategories : expenseCategories).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monto</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows="3"
                      placeholder="Descripción opcional..."
                    />
                  </div>

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

        {/* Admin Panel Modal */}
        {isAdmin && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-semibold text-gray-800">Panel de Administración</h3>
                </div>
                
                {/* Admin Navigation */}
                <div className="flex gap-4 mt-4">
                  <button
                    onClick={() => setAdminView('summary')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      adminView === 'summary'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Resumen por Usuario
                  </button>
                  <button
                    onClick={() => setAdminView('filter')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      adminView === 'filter'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Filtrar Ingresos
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh]">
                {adminView === 'summary' && (
                  <div className="space-y-6">
                    <h4 className="text-lg font-semibold text-gray-800">Resumen de Usuario</h4>
                    <p className="text-sm text-gray-600">Endpoint: GET /api/Incomes/summary/:userId</p>
                    
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                        <input
                          type="number"
                          value={summaryUserId}
                          onChange={(e) => setSummaryUserId(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Ej: 7"
                        />
                      </div>
                      <button
                        onClick={fetchSummary}
                        disabled={loading}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {loading ? 'Cargando...' : 'Obtener Resumen'}
                      </button>
                    </div>

                    {summaryData && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h5 className="font-semibold text-gray-800 mb-3">Resultados:</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white p-4 rounded-lg border-l-4 border-green-500">
                            <p className="text-sm text-gray-600">Total Ingresos</p>
                            <p className="text-xl font-bold text-green-600">{formatCurrency(summaryData.totalIncome)}</p>
                          </div>
                          <div className="bg-white p-4 rounded-lg border-l-4 border-red-500">
                            <p className="text-sm text-gray-600">Total Gastos</p>
                            <p className="text-xl font-bold text-red-600">{formatCurrency(summaryData.totalExpenses)}</p>
                          </div>
                          <div className="bg-white p-4 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm text-gray-600">Balance</p>
                            <p className={`text-xl font-bold ${summaryData.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {formatCurrency(summaryData.balance)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 bg-gray-800 text-white p-3 rounded text-sm font-mono">
                          <pre>{JSON.stringify(summaryData, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {adminView === 'filter' && (
                  <div className="space-y-6">
                    <h4 className="text-lg font-semibold text-gray-800">Filtrar Ingresos</h4>
                    <p className="text-sm text-gray-600">Endpoint: GET /api/Incomes/filter?userId=&categoryId=&from=&to=</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">User ID *</label>
                        <input
                          type="number"
                          value={filterParams.userId}
                          onChange={(e) => setFilterParams({...filterParams, userId: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Ej: 7"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category ID</label>
                        <input
                          type="number"
                          value={filterParams.categoryId}
                          onChange={(e) => setFilterParams({...filterParams, categoryId: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Ej: 4"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Desde</label>
                        <input
                          type="datetime-local"
                          value={filterParams.from}
                          onChange={(e) => setFilterParams({...filterParams, from: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Hasta</label>
                        <input
                          type="datetime-local"
                          value={filterParams.to}
                          onChange={(e) => setFilterParams({...filterParams, to: e.target.value})}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
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
                                  <td className="px-3 py-2">{new Date(item.date).toLocaleDateString('es-AR')}</td>
                                  <td className="px-3 py-2">{item.categoryName}</td>
                                  <td className="px-3 py-2">{item.username} (ID: {item.userId})</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="mt-4 bg-gray-800 text-white p-3 rounded text-xs font-mono overflow-x-auto">
                          <pre>{JSON.stringify(filteredData, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;