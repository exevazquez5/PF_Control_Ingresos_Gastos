import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import api from '../api/axios.config.js';

const formatCurrency = (amount) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);

const TimeSeriesChart = () => {
  const [data, setData] = useState([]);
  const [chartMonths, setChartMonths] = useState(12);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const [res, reimbursementsRes] = await Promise.all([
          api.get(`/Reports/monthly-summary`, config),
          api.get('/expense-workspace/reimbursements', config).catch(() => ({ data: [] })),
        ]);

        const reimbursementTotals = new Map();
        for (const reimbursement of reimbursementsRes.data) {
          const date = new Date(reimbursement.date);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          reimbursementTotals.set(key, (reimbursementTotals.get(key) || 0) + reimbursement.amount);
        }

        const monthlyTotals = new Map(res.data.map((item) => [
          `${item.year}-${String(item.month).padStart(2, "0")}`,
          { ingresos: item.ingresos || 0, gastos: item.gastos || 0 },
        ]));

        const earliest = res.data.reduce((min, item) => {
          const key = item.year * 12 + item.month - 1;
          return Math.min(min, key);
        }, Number.POSITIVE_INFINITY);
        const now = new Date();
        const latest = now.getFullYear() * 12 + now.getMonth();
        const processed = [];

        if (Number.isFinite(earliest)) {
          for (let monthKey = earliest; monthKey <= latest; monthKey += 1) {
            const year = Math.floor(monthKey / 12);
            const month = (monthKey % 12) + 1;
            const date = `${year}-${String(month).padStart(2, "0")}`;
            const totals = monthlyTotals.get(date) || { ingresos: 0, gastos: 0 };
            const reintegros = reimbursementTotals.get(date) || 0;
            const balance = totals.ingresos + reintegros - totals.gastos;
            processed.push({
              date,
              ...totals,
              reintegros,
              balance,
              ahorroPorcentaje:
                totals.ingresos > 0 ? Math.round((balance / totals.ingresos) * 100) : 0,
            });
          }
        }

        setData(processed);
      } catch (error) {
        console.error("Error al obtener la serie temporal:", error);
      }
    };

    fetchData();
  }, []);

  const filteredChartData = chartMonths === "all" ? data : data.slice(-chartMonths);
  const totalSaved = filteredChartData.reduce((sum, item) => sum + item.balance, 0);
  const periodLabel = chartMonths === "all"
    ? "Todo el historial"
    : `Últimos ${filteredChartData.length} períodos`;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white text-center md:text-left">
          Evolución Temporal de Ingresos y Gastos
        </h3>
        <div className="flex gap-2">
          {[3, 6, 9, 12, "all"].map((m) => (
            <button
                key={m}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                chartMonths === m
                    ? "bg-blue-600 text-white"
                    : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                }`}
                onClick={() => setChartMonths(m)}
            >
                {m === "all" ? "MAX" : m === 12 ? "1A" : `${m}M`}
            </button>
            ))}

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 w-full items-start">
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" aspect={2}>
            <LineChart data={filteredChartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                tick={{ fill: "currentColor", fontSize: 12 }}
                axisLine={{ stroke: "currentColor" }}
                tickLine={{ stroke: "currentColor" }}
                className="dark:text-white"
              />
              <YAxis
                tick={{ fill: "currentColor", fontSize: 12 }}
                axisLine={{ stroke: "currentColor" }}
                tickLine={{ stroke: "currentColor" }}
                className="dark:text-white"
                tickFormatter={(value) => {
                  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
                  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
                  return `$${value}`;
                }}
              />
              <YAxis
                yAxisId={1}
                orientation="right"
                tickFormatter={(value) => `${value}%`}
                domain={[0, 15]}
                axisLine={{ stroke: "currentColor" }}
                tickLine={{ stroke: "currentColor" }}
                className="dark:text-white"
              />
              <Tooltip
                formatter={(value, name) => {
                  if (name === "% Ahorro") return [`${value}%`, name];
                  return [formatCurrency(value), name];
                }}
                labelFormatter={(label) => `Mes: ${label}`}
                contentStyle={{
                  backgroundColor: "var(--tooltip-bg, #ffffff)",
                  border: "1px solid var(--tooltip-border, #e5e7eb)",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="ingresos" stroke="#10B981" strokeWidth={3} name="Ingresos" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="gastos" stroke="#EF4444" strokeWidth={3} name="Gastos" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="reintegros" stroke="#F59E0B" strokeWidth={2} name="Reintegros" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="balance" stroke="#3B82F6" strokeWidth={2} name="Balance" strokeDasharray="5 5" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="ahorroPorcentaje" stroke="#A855F7" name="% Ahorro" strokeWidth={2} dot={{ r: 3 }} yAxisId={1} strokeDasharray="2 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-4 lg:w-80">
          <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-gray-600 dark:to-gray-700 p-4 rounded-lg border-l-4 border-green-500">
            <p className="text-gray-600 text-sm font-medium dark:text-white">Ingresos Promedio</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(
            filteredChartData.reduce((sum, item) => sum + item.ingresos, 0) / (filteredChartData.length || 1)
            )}</p>
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-300">
            {periodLabel}
            </p>
          </div>

          <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-gray-600 dark:to-gray-700 p-4 rounded-lg border-l-4 border-red-500 dark:bg-gray-700">
            <p className="text-gray-600 text-sm font-medium dark:text-white">Gastos Promedio</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(
                filteredChartData.reduce((sum, item) => sum + item.gastos, 0) / (filteredChartData.length || 1)
                )}
            </p>
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-300">
              {periodLabel}
            </p>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-gray-600 dark:to-gray-700 p-4 rounded-lg border-l-4 border-blue-500 dark:bg-gray-700">
            <p className="text-gray-600 text-sm font-medium dark:text-white">Tendencia</p>
            <p
              className={`text-xl font-bold ${
                filteredChartData.length > 1 && filteredChartData[filteredChartData.length - 1].balance >= filteredChartData[0].balance
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {filteredChartData.length > 1 &&
                filteredChartData.at(-1).balance >= filteredChartData[0].balance
                ? "↗️ Mejorando"
                : "↘️ Empeorando"}

            </p>
            <p className="text-xs text-gray-500 mt-1 dark:text-gray-300">
              Comparación período inicial vs final
            </p>
          </div>

            <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-gray-600 dark:to-gray-700 p-4 rounded-lg border-l-4 border-purple-500 dark:bg-gray-700">
                <p className="text-gray-600 text-sm font-medium dark:text-white">Ahorro Acumulado</p>
                <p className="text-xl font-bold text-purple-700 dark:text-purple-400">
                    {formatCurrency(totalSaved)}
                </p>
                <p className="text-xs text-gray-500 mt-1 dark:text-gray-300">
                    {periodLabel}
                </p>
            </div>

        </div>
      </div>
    </div>
  );
};

export default TimeSeriesChart;
