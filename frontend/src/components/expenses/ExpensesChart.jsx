import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ChevronLeft, ChevronRight, DollarSign } from "lucide-react";
import formatCurrency from "../../utils/format.js"

export default function ExpensesChart({ 
  chartData, 
  totalExpense, 
  monthLabel, 
  onPrevMonth, 
  onNextMonth 
}) {
  return (
    <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
            <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            Gastos por Categoría
          </h3>
        </div>

        {/* Selector de mes */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 bg-gray-100 dark:bg-gray-700 rounded-full px-3 sm:px-6 py-2 sm:py-3 w-full sm:w-auto">
          <button onClick={onPrevMonth} className="p-1 sm:p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors">
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-white" />
          </button>
          <h5 className="text-sm sm:text-lg font-semibold dark:text-white text-center flex-1 min-w-0 px-2">
            {monthLabel}
          </h5>
          <button onClick={onNextMonth} className="p-1 sm:p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors">
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 dark:text-white" />
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 items-center">
        {/* Total */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-gray-700 dark:to-gray-600 rounded-xl p-4 border-l-4 border-red-500">
            <p className="text-red-700 dark:text-red-400 font-medium mb-2">Total gastos</p>
            <p className="text-2xl sm:text-3xl font-bold text-red-800 dark:text-red-300">
              {formatCurrency(totalExpense)}
            </p>
          </div>

          {/* Leyenda */}
          <div className="grid grid-cols-1 gap-2 sm:gap-3">
            {chartData.map((entry, index) => (
              <div key={index} className="flex items-center justify-start p-2 bg-gray-50 dark:bg-gray-700 rounded-lg space-x-2 dark:text-white">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }}></div>
                <span className="text-sm sm:text-base truncate">{entry.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PieChart */}
        <div className="flex justify-center">
          <div className="w-full" style={{ height: '250px' }}>
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
                    <Cell key={`cell-${entry.categoryId}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
