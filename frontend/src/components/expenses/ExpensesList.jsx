// ExpensesList.jsx
import { X, ChevronLeft, ChevronRight, Edit2, Trash2 } from "lucide-react";
import formatCurrency from "../../utils/format.js"
import { parseApiDate } from "../../utils/date";

export default function ExpensesList({
  showMonthlyModal,
  setShowMonthlyModal,
  selectedCategory,
  setSelectedCategory,
  categories,
  orderByMethod,
  ordenarTransacciones,
  selMonth,
  setMonthOffset,
  modalList,
  categoryColorMap,
  handleEdit,
  handleDelete,
}) {
  if (!showMonthlyModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
                  className="w-full p-3 rounded-lg bg-gray-50/50 border-0 text-gray-900
                    ring-1 ring-gray-200/60 focus:ring-2 focus:ring-blue-500 focus:bg-white
                    hover:ring-gray-300/80 transition-all duration-150
                    dark:bg-gray-800/50 dark:text-gray-100
                    dark:ring-gray-700/60 dark:focus:bg-gray-800 dark:hover:ring-gray-600/80"
                >
                  <option value="Todos">Todas las categorías</option>
                  {categories
                    .filter((cat) => cat.type === "gasto")
                    .map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  <option value="Servicios compartidos">Reintegros de servicios</option>
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
                  className="w-full p-3 rounded-lg bg-gray-50/50 border-0 text-gray-900
                    ring-1 ring-gray-200/60 focus:ring-2 focus:ring-blue-500 focus:bg-white
                    hover:ring-gray-300/80 transition-all duration-150
                    dark:bg-gray-800/50 dark:text-gray-100
                    dark:ring-gray-700/60 dark:focus:bg-gray-800 dark:hover:ring-gray-600/80"
                >
                  <option value="fecha-reciente">Fecha: Más reciente</option>
                  <option value="fecha-antiguo">Fecha: Más antiguo</option>
                  <option value="precio-mayor">Precio: Mayor a menor</option>
                  <option value="precio-menor">Precio: Menor a mayor</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowMonthlyModal(false)}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header del modal */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pr-12">
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-full px-3 py-2">
              <button
                onClick={() => setMonthOffset((m) => m - 1)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <h5 className="text-sm sm:text-lg font-semibold dark:text-white px-2">
                <span className="hidden sm:inline">
                  {selMonth.toLocaleDateString("es-AR", {
                    year: "numeric",
                    month: "long",
                  })}
                </span>
                <span className="sm:hidden">
                  {selMonth.toLocaleDateString("es-AR", {
                    year: "2-digit",
                    month: "short",
                  })}
                </span>
              </h5>
              <button
                onClick={() => setMonthOffset((m) => m + 1)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
              >
                <ChevronRight className="w-4 h-4" />
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

        {/* Lista de transacciones */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="space-y-2">
            {modalList.length === 0 && (
              <p className="text-gray-500 dark:text-white text-center py-8">
                No hay gastos este mes.
              </p>
            )}
            {modalList.map((tx) => (
              <div
                key={tx.id}
                className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-600"
              >
                <div className="flex-1 min-w-0 pr-3">
                  <p className="font-medium dark:text-white truncate">
                    {tx.description}
                    {tx.fundingSource && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                        {tx.fundingSource === 'Savings' ? '🏦 Ahorro' : tx.fundingSource === 'Credit' ? '💳 Tarjeta' : '💰 Ingreso'}
                      </span>
                    )}
                  </p>
                  <p className="text-gray-500 dark:text-gray-300 text-sm">
                    {parseApiDate(tx.date).toLocaleDateString("es-AR")}
                  </p>
                  <p className="flex items-center gap-2 text-black text-sm dark:text-gray-300 text-sm">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          categoryColorMap[tx.categoryId] || "#6b7280",
                      }}
                    ></span>
                    {tx.categoryName}
                  </p>
                </div>

                {tx.type !== 'reintegro' && <div className="flex gap-2">
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
                </div>}

                <div className={`font-medium flex-shrink-0 text-sm sm:text-base ${tx.type === 'reintegro' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'reintegro' ? '+' : '-'}{formatCurrency(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
