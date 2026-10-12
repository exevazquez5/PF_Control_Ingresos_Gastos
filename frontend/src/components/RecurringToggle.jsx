// Toggle "Se repite todos los meses" (D10). El componente es genérico:
// la condición de render (solo ingresos) vive en TransactionModal.
export default function RecurringToggle({ checked, onChange }) {
  return (
    <label className="inline-flex items-start text-sm font-medium text-gray-700 dark:text-white cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="form-checkbox h-4 w-4 text-blue-600 mt-0.5"
      />
      <span className="ml-2">
        Se repite todos los meses
        <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">
          Se proyecta como ingreso futuro hasta que lo confirmes.
        </span>
      </span>
    </label>
  );
}
