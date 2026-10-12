import { useState } from 'react';
import formatCurrency from "../utils/format.js"
import CurrencyInput from "../components/CurrencyInput.jsx";
import CategoryCombobox from "../components/CategoryCombobox.jsx";
import RecurringToggle from "../components/RecurringToggle.jsx";
import { MAX_TRANSACTION_AMOUNT, MAX_AMOUNT_MESSAGE } from "../utils/limits.js";
import { isLaborCategory } from "../utils/laborCategories.js";

export default function TransactionModal({
  showModal,
  onClose,
  editingTransaction,
  formData,
  setFormData,
  categories,
  enCuotas,
  setEnCuotas,
  cantidadCuotas,
  setCantidadCuotas,
  creditCards = [],
  selectedCreditCardId = "",
  setSelectedCreditCardId = () => {},
  firstInstallmentPreview = "",
  formError,
  resetForm,
  handleSubmit,
  totalIncome = 0
}) {
  const [showFundingSuggestion, setShowFundingSuggestion] = useState(false);
  const [showGross, setShowGross] = useState(false);

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-2">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
              {editingTransaction ? "Editar Transacción" : "Nueva Transacción"}
            </h3>
            <button 
              onClick={onClose} 
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                Tipo
              </label>
              <select
                value={formData.type}
                onChange={(e) => {
                  const newType = e.target.value;
                  setFormData({ ...formData, type: newType, categoryId: "", grossAmount: "", isRecurring: false });
                  setShowGross(false);

                  if (e.target.value === "ingreso") {
                    setEnCuotas(false);
                    setCantidadCuotas("");
                    setSelectedCreditCardId("");
                  }
                }}
              >
                <option value="ingreso">Ingreso</option>
                <option value="gasto">Gasto</option>
              </select>
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                Categoría
              </label>
              <CategoryCombobox
                categories={categories}
                type={formData.type}
                value={formData.categoryId}
                onChange={(id) => {
                  const cat = categories.find(c => c.id === id);
                  const laboral = isLaborCategory(cat?.name);
                  const next = { ...formData, categoryId: id };
                  if (!laboral) {
                    next.grossAmount = "";
                    setShowGross(false);
                  }
                  setFormData(next);
                }}
              />
            </div>

            {/* Monto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                Monto
              </label>
              <CurrencyInput
                value={formData.amount}
                onValueChange={(raw) => {
                  const value = parseFloat(raw) || 0;
                  setFormData({ ...formData, amount: raw });
                  if (totalIncome > 0 && value > totalIncome * 0.5 && formData.type === 'gasto' && formData.fundingSource === 'Income') {
                    setShowFundingSuggestion(true);
                  } else {
                    setShowFundingSuggestion(false);
                  }
                }}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                placeholder="0,00"
                required
              />
              {Number(formData.amount) > MAX_TRANSACTION_AMOUNT && (
                <p className="text-red-500 text-sm mt-1">
                  {MAX_AMOUNT_MESSAGE}
                </p>
              )}
            </div>

            {/* Bruto del recibo (D4): solo ingresos con categoría laboral */}
            {formData.type === "ingreso" && isLaborCategory(categories.find(c => c.id === formData.categoryId)?.name) && (
              <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3">
                {!showGross ? (
                  <button
                    type="button"
                    onClick={() => setShowGross(true)}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    + Bruto del recibo (opcional)
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-white">
                        Bruto del recibo
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowGross(false)}
                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Ocultar
                      </button>
                    </div>
                    <CurrencyInput
                      value={formData.grossAmount || ''}
                      onValueChange={(raw) => setFormData({ ...formData, grossAmount: raw })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                      placeholder="0,00"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Monto bruto antes de descuentos (jubilación, prepaga, etc.).
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Sugerencia de funding source */}
            {showFundingSuggestion && formData.fundingSource === 'Income' && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  Este gasto parece grande. ¿Estás usando ahorros?
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => { setFormData({...formData, fundingSource: 'Savings'}); setShowFundingSuggestion(false); }}
                    className="px-3 py-1 text-sm bg-amber-200 dark:bg-amber-800 rounded hover:bg-amber-300 dark:hover:bg-amber-700 transition-colors"
                  >
                    Sí, usar ahorros
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFundingSuggestion(false)}
                    className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    No, es de ingresos
                  </button>
                </div>
              </div>
            )}

            {/* Origen del dinero - Solo para gastos */}
            {formData.type === "gasto" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-white">
                  Origen del dinero
                </label>
                <div className="flex gap-2">
                  {[
                    { value: 'Income', label: 'Ingresos', icon: '💰' },
                    { value: 'Savings', label: 'Ahorros', icon: '🏦' },
                    { value: 'Credit', label: 'Tarjeta', icon: '💳' }
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({...formData, fundingSource: opt.value})}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        formData.fundingSource === opt.value
                          ? 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-600'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* En cuotas */}
            {formData.type === "gasto" && (!editingTransaction || editingTransaction.type !== "cuota") && (
              <div>
                <label className="inline-flex items-center text-sm font-medium text-gray-700 dark:text-white">
                  <input
                    type="checkbox"
                    checked={enCuotas}
                    onChange={(e) => {
                      setEnCuotas(e.target.checked);
                      if (!e.target.checked) {
                        setCantidadCuotas("");
                        setSelectedCreditCardId("");
                      }
                    }}
                    className="form-checkbox h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2">¿Este gasto es en cuotas?</span>
                </label>
              </div>
            )}

            {/* Campos de cuotas */}
            {formData.type === "gasto" && enCuotas && editingTransaction?.type === "cuota" && (
              <div className="bg-blue-50 dark:bg-gray-700 rounded-lg p-3 border border-blue-200 dark:border-gray-600">
                <p className="text-sm font-medium text-gray-700 dark:text-white">
                  Gasto en cuotas — {cantidadCuotas} cuotas de {formatCurrency(formData.amount)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  La descripción y categoría se pueden editar. Las cuotas no se pueden modificar.
                </p>
              </div>
            )}

            {formData.type === "gasto" && enCuotas && !editingTransaction && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                    Cantidad de cuotas
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={cantidadCuotas}
                    onChange={(e) => setCantidadCuotas(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                    Tarjeta de credito
                  </label>
                  <select
                    value={selectedCreditCardId}
                    onChange={(e) => setSelectedCreditCardId(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Seleccionar tarjeta</option>
                    {creditCards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {(card.name || `Tarjeta ${card.id}`) + ` (cierre ${card.closingDay}, vence ${card.dueDay})`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                    El vencimiento de cuotas se calcula automaticamente segun cierre y vencimiento.
                  </p>
                  {firstInstallmentPreview && (
                    <p className="text-xs text-blue-600 mt-1">
                      Primera cuota vence el {firstInstallmentPreview}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Fecha normal */}
            {!(formData.type === "gasto" && enCuotas) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                  Fecha
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({ ...formData, date: e.target.value })
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            )}

            {/* Recurrencia (D10): solo se muestra para ingresos */}
            {formData.type === "ingreso" && (
              <RecurringToggle
                checked={!!formData.isRecurring}
                onChange={(v) => setFormData({ ...formData, isRecurring: v })}
              />
            )}

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-white">
                Descripción <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Ej.: Sueldo, alquiler, freelance..."
              />
            </div>

            {/* Error */}
            {formError && (
              <div className="text-red-600 text-sm font-medium text-center mb-2">
                {formError}
              </div>
            )}

            {/* Botones */}
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
                disabled={Number(formData.amount) > MAX_TRANSACTION_AMOUNT}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingTransaction ? "Actualizar" : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
