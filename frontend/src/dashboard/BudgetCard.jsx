import React from "react";
import { Wallet } from "lucide-react";

const BudgetCard = ({ progress, onConfigure, savingsTotal = 0, creditTotal = 0 }) => {
  if (!progress) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border-l-4 border-purple-500">
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-full">
            <Wallet className="w-6 h-6 text-purple-600 dark:text-purple-300" />
          </div>
          <div className="text-center">
            <p className="text-gray-600 dark:text-white text-sm font-medium">Presupuesto</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Sin presupuesto configurado</p>
          </div>
          <button
            onClick={onConfigure}
            className="text-purple-600 dark:text-purple-400 text-sm font-medium hover:underline"
          >
            Configurar
          </button>
        </div>
      </div>
    );
  }

  const { global, categories, isInherited } = progress;
  const remaining = global.totalBudget - global.spent - global.committed;
  const overBudget = global.percentage > 100;
  const aheadOfPace = global.percentage > global.timePercentage;

  const getTrafficLight = (pct) => {
    if (pct >= 100) return "bg-red-500";
    if (pct >= 90) return "bg-orange-500";
    if (pct >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getBarColor = (pct) => {
    if (pct >= 100) return "bg-red-500";
    if (pct >= 90) return "bg-orange-500";
    if (pct >= 70) return "bg-yellow-500";
    return "bg-purple-500";
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(250px,0.9fr)_minmax(0,1.5fr)] lg:gap-8">
      <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-full">
            <Wallet className="w-5 h-5 text-purple-600 dark:text-purple-300" />
          </div>
          <p className="text-gray-600 dark:text-white text-sm font-medium">Presupuesto</p>
          {isInherited && (
            <span className="text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-medium">
              Heredado
            </span>
          )}
        </div>
        <button
          onClick={onConfigure}
          className="text-purple-600 dark:text-purple-400 text-xs font-medium hover:underline"
        >
          Editar
        </button>
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-baseline">
          <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
            {formatCurrency(global.spent)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            de {formatCurrency(global.totalBudget)}
          </p>
        </div>

        <div className="mt-2 relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBarColor(global.percentage)}`}
            style={{ width: `${Math.min(global.percentage, 100)}%` }}
          />
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-400 dark:bg-gray-500 opacity-60"
            style={{ left: `${global.timePercentage}%` }}
          />
        </div>

        <div className="flex justify-between items-center mt-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {global.percentage.toFixed(0)}% usado
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {global.timePercentage.toFixed(0)}% tiempo
          </p>
        </div>

        {global.committed > 0 && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {formatCurrency(global.committed)} comprometido en cuotas
          </p>
        )}

        {aheadOfPace && global.percentage < 100 && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
            Vas por encima del ritmo esperado
          </p>
        )}
        {overBudget && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            Te pasaste {formatCurrency(Math.abs(remaining))}
          </p>
        )}
        {!aheadOfPace && !overBudget && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
            Dentro del presupuesto
          </p>
        )}
      </div>
      </div>

      {categories.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-4 lg:mt-0 lg:border-t-0 lg:border-l lg:pl-8">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Por categoría</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 max-h-40 overflow-y-auto">
            {categories.map((cat) => (
              <div key={cat.categoryId} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getTrafficLight(cat.percentage)}`} />
                <span className="text-xs text-gray-600 dark:text-gray-300 flex-1 truncate">
                  {cat.categoryName}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {formatCurrency(cat.spent)} / {formatCurrency(cat.budgetLimit)}
                </span>
                <span className={`text-xs font-medium w-10 text-right ${
                  cat.percentage >= 100 ? "text-red-500" :
                  cat.percentage >= 90 ? "text-orange-500" :
                  cat.percentage >= 70 ? "text-yellow-500" : "text-green-500"
                }`}>
                  {cat.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>

      {(savingsTotal > 0 || creditTotal > 0) && (
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Fuera del presupuesto</p>
          {savingsTotal > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              🏦 Ahorros: {formatCurrency(savingsTotal)}
            </p>
          )}
          {creditTotal > 0 && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400">
              💳 Tarjeta: {formatCurrency(creditTotal)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BudgetCard;
