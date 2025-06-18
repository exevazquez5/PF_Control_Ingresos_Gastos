import React from 'react';

function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500">Resumen general</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-semibold text-gray-700">Usuarios</h2>
          <p className="text-3xl font-bold text-blue-600">124</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-semibold text-gray-700">Ingresos</h2>
          <p className="text-3xl font-bold text-green-600">$5,230</p>
        </div>
        <div className="bg-white rounded-2xl shadow p-5">
          <h2 className="text-xl font-semibold text-gray-700">Gastos</h2>
          <p className="text-3xl font-bold text-red-500">$3,100</p>
        </div>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Actividad reciente</h3>
        <ul className="space-y-2">
          <li className="text-gray-600">✅ Usuario Juan registró un gasto de $120</li>
          <li className="text-gray-600">✅ María añadió un ingreso de $300</li>
          <li className="text-gray-600">✅ Nuevo usuario registrado: Pedro</li>
        </ul>
      </div>
    </div>
  );
}

export default Dashboard;
