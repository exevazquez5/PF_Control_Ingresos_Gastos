import React, { useState, useEffect } from "react";
import axios from 'axios';
import { PieChart as RechartsPieChart, Cell, Pie, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { parseJwt } from "../../utils/jwt";
import { X, ChevronLeft, ChevronRight } from 'lucide-react';


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

  
  // datos para la torta
  const chartData = categories
  .map((cat, index) => { 
    const sum = transactions
    .filter(t => t.categoryId === cat.id)
    .reduce((a,b) => a + b.amount, 0);
    return  {
      name: cat.name,
      value: sum,
      color: getDistinctColor(index) // Color único basado en el índice
    };
  }).filter(d => d.value > 0);

  const totalIncomes = chartData
  .reduce((a,b) => a + b.value, 0);
  
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
  
  const modalList = transactions
  .filter(t => {
    const d = new Date(t.date);
    return d >= selMonth && d < nextMonth;
  })
  .sort((a,b) => new Date(b.date) - new Date(a.date));
  
  const totalIncome = modalList.reduce((sum, t) => sum + t.amount, 0);
  
  return (
    //<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="
      min-h-screen 
      bg-gradient-to-br from-blue-50 to-indigo-100 
      dark:bg-gradient-to-br dark:from-gray-900 dark:to-black
      p-4
   ">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2 dark:text-white">Detalle de Ingresos</h1>
            {/* <p className="text-gray-600">Visualizá tus ingresos por categoría</p> */}
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-lg"
          >
            Volver al Inicio
          </button>
        </div>

        {chartView === 'pie' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-6 text-center">
              Ingresos por Categoría
            </h3>
            <div className="flex flex-col lg:flex-row items-start gap-8">
                           {/* Total de ingresos */}
              <div className="lg:w-64">
                <div className="bg-green-50 dark:bg-gray-700 p-6 rounded-lg border-l-4 border-green-500">
                  <p className="text-gray-600 dark:text-white text-sm font-medium">Total Ingresos</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
                </div>
              </div>
              <div className="flex-1 w-full" style={{ minHeight: '400px' }}>
                {/* Gráfico de torta - MEJORADO: con bordes para mayor separación visual */}
                <div className="w-full" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height={400}>
                  <RechartsPieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={120}
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

              {/* Feature para cambiar de Period */}
              <div className="flex items-center gap-2 mb-4 mt-4 mr-4">
                <button
                  onClick={() => setMonthOffset(m => m - 1)}
                  className="p-1 hover:bg-gray-100 dark:bg-white dark:hover:bg-gray-300 rounded"
                >
                  <ChevronLeft />
                </button>
                <h5 className="text-lg font-semibold dark:text-white">
                  {selMonth.toLocaleDateString('es-AR',{ year:'numeric', month:'long' })}
                </h5>
                <button
                  onClick={() => setMonthOffset(m => m + 1)}
                  className="p-1 hover:bg-gray-100 dark:bg-white dark:hover:bg-gray-300 rounded"
                >
                  <ChevronRight />
                </button>
              </div>
            </div>

            

              

           {/* abajo: últimos 5 | totales por categoría */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
 
             {/* izquierda: últimos 5 */}
             <div className="space-y-4">
               <h4 className="font-semibold text-gray-700 dark:text-white">Últimos movimientos</h4>
               {lastFive.map(tx => (
                 <div key={tx.id} className="flex justify-between dark:text-white">
                   <div>
                     <p className="font-medium">{tx.description}</p>
                     <p className="text-gray-500 dark:text-white text-sm">
                       {new Date(tx.date).toLocaleDateString('es-AR')}
                     </p>
                   </div>
                   <div className="font-medium text-green-600">
                      +{formatCurrency(tx.amount)}
                    </div>
                 </div>
               ))}
               <button
                 onClick={() => setShowModal(true)}
                 className="mt-2 text-blue-600 hover:underline dark:bg-gray-600 dark:text-white dark:hover:bg-gray-500 text-sm"
               >
                 Ver todos los movimientos
               </button>
             </div>
 
                {/* derecha: tabla de totales */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-700 dark:text-white">Ingresos por categoría</h4>
                  {chartData.sort((a,b) => b.value - a.value).map((c,i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full block"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="text-gray-700 dark:text-white">{c.name}</span>
                      </span>
                      <span className="font-medium dark:text-white">{formatCurrency(c.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
        )}
        
       {/* Modal */}
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
                   {selMonth.toLocaleDateString('es-AR',{ year:'numeric', month:'long' })}
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
                     <p className="font-medium">{tx.description}</p>
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