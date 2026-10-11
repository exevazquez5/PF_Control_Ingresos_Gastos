import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Banknote, Plus, Edit2, Trash2, X, Copy, ArrowLeft } from 'lucide-react';
import {
  getSalaries,
  createSalary,
  updateSalary,
  deleteSalary,
} from '../services/salariesService';
import api from '../api/axios.config.js';
import formatCurrency from '../utils/format';
import ConfirmDeleteModal from '../dashboard/ConfirmDeleteModal';
import SuccessModal from '../dashboard/SucessModal';

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDate = (value) => new Date(value).toLocaleDateString('es-AR');

function SalaryForm({ initial, latest, expenses, onSave, onClose, saving, error }) {
  const [date, setDate] = useState(initial ? initial.date.substring(0, 10) : todayISO());
  const [gross, setGross] = useState(initial ? String(initial.grossAmount) : '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [deds, setDeds] = useState(
    initial
      ? initial.deductions.map((d) => ({
          expenseId: d.expenseId,
          amount: d.amount,
          description: d.expenseDescription,
          categoryName: d.expenseCategoryName,
        }))
      : []
  );
  const [selExp, setSelExp] = useState('');
  const [selAmt, setSelAmt] = useState('');
  const [err, setErr] = useState('');

  const grossNum = parseFloat(gross) || 0;
  const totalDed = deds.reduce((acc, d) => acc + Number(d.amount), 0);
  const net = grossNum - totalDed;

  const availableExpenses = expenses
    .filter((e) => !deds.some((d) => d.expenseId === e.id))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const addDeduction = () => {
    setErr('');
    if (!selExp) return setErr('Elegí un gasto de la lista.');
    const amount = parseFloat(selAmt);
    if (!amount || amount <= 0) return setErr('Ingresá un monto válido para la deducción.');
    const exp = expenses.find((e) => e.id === Number(selExp));
    setDeds([
      ...deds,
      {
        expenseId: Number(selExp),
        amount,
        description: exp?.description,
        categoryName: exp?.categoryName,
      },
    ]);
    setSelExp('');
    setSelAmt('');
  };

  const removeDeduction = (expenseId) => {
    setDeds(deds.filter((d) => d.expenseId !== expenseId));
  };

  const duplicateLatest = () => {
    if (!latest) return;
    setErr('');
    setGross(String(latest.grossAmount));
    setNotes(latest.notes ?? '');
    setDeds(
      latest.deductions.map((d) => ({
        expenseId: d.expenseId,
        amount: d.amount,
        description: d.expenseDescription,
        categoryName: d.expenseCategoryName,
      }))
    );
  };

  const submit = (e) => {
    e.preventDefault();
    setErr('');
    if (!date) return setErr('Elegí la fecha de pago.');
    const g = parseFloat(gross);
    if (!g || g <= 0) return setErr('El bruto debe ser mayor a cero.');
    if (totalDed > g) return setErr('Las deducciones no pueden superar el bruto.');

    onSave({
      date: `${date}T00:00:00`,
      grossAmount: g,
      notes: notes?.trim() ? notes.trim() : null,
      deductions: deds.map((d) => ({ expenseId: d.expenseId, amount: Number(d.amount) })),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
            {initial ? 'Editar sueldo' : 'Nuevo sueldo'}
          </h3>
          <div className="flex items-center gap-2">
            {!initial && latest && (
              <button
                type="button"
                onClick={duplicateLatest}
                className="flex items-center gap-1 text-sm bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-lg font-medium"
              >
                <Copy className="w-4 h-4" /> Duplicar último
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-300" />
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Fecha de pago
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
                Monto bruto
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={gross}
                onChange={(e) => setGross(e.target.value)}
                placeholder="Ej: 500000"
                className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-gray-300">
              Notas (opcional)
            </label>
            <input
              type="text"
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Ajuste por antigüedad, aguinaldo, etc."
              className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div className="border dark:border-gray-700 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
              Deducciones (gastos existentes, solo informativos)
            </p>

            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <select
                value={selExp}
                onChange={(e) => {
                  setSelExp(e.target.value);
                  const ex = expenses.find((x) => x.id === Number(e.target.value));
                  setSelAmt(ex ? String(ex.amount) : '');
                }}
                className="flex-1 border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Elegí un gasto…</option>
                {availableExpenses.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.description} ({e.categoryName}) — {formatCurrency(e.amount)} —{' '}
                    {formatDate(e.date)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={selAmt}
                onChange={(e) => setSelAmt(e.target.value)}
                placeholder="Monto"
                className="w-full sm:w-32 border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <button
                type="button"
                onClick={addDeduction}
                className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1"
              >
                <Plus className="w-4 h-4" /> Agregar
              </button>
            </div>

            {deds.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">Sin deducciones cargadas.</p>
            ) : (
              <ul className="space-y-2">
                {deds.map((d) => (
                  <li
                    key={d.expenseId}
                    className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="text-gray-700 dark:text-gray-200 truncate">
                      {d.description || `Gasto #${d.expenseId}`}
                      {d.categoryName ? (
                        <span className="text-gray-400"> ({d.categoryName})</span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                        -{formatCurrency(d.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDeduction(d.expenseId)}
                        className="text-gray-400 hover:text-red-500"
                        title="Quitar deducción"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Vista previa */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>Bruto</span>
              <span>{formatCurrency(grossNum)}</span>
            </div>
            <div className="flex justify-between text-red-600 dark:text-red-400">
              <span>Deducciones ({deds.length})</span>
              <span>-{formatCurrency(totalDed)}</span>
            </div>
            <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400 text-base border-t dark:border-gray-700 pt-2">
              <span>Neto (estimado)</span>
              <span>{formatCurrency(net)}</span>
            </div>
          </div>

          {(err || error) && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
              {err || error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 font-medium"
            >
              {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Registrar sueldo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Sueldos() {
  const navigate = useNavigate();
  const [salaries, setSalaries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [salariesRes, expensesRes] = await Promise.all([
        getSalaries(),
        api.get('/Expenses'),
      ]);
      setSalaries(salariesRes);
      setExpenses(expensesRes.data);
    } catch (error) {
      console.error('Error al cargar sueldos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const latest = salaries.length > 0 ? salaries[0] : null;

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (salary) => {
    setEditing(salary);
    setFormError('');
    setShowForm(true);
  };

  const handleSave = async (payload) => {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await updateSalary(editing.id, payload);
        setSuccessMsg('Sueldo actualizado correctamente.');
      } else {
        await createSalary(payload);
        setSuccessMsg('Sueldo registrado correctamente.');
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (error) {
      setFormError(
        error.response?.data?.message ||
          error.response?.data?.title ||
          'No se pudo guardar el sueldo.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteSalary(toDelete.id);
      setSuccessMsg('Sueldo eliminado.');
      setToDelete(null);
      await load();
    } catch (error) {
      console.error('Error al eliminar sueldo:', error);
      setToDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow hover:bg-gray-50 dark:hover:bg-gray-700"
              title="Volver al dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Banknote className="w-7 h-7 text-emerald-600" />
                Sueldos
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Bruto vs. neto: deducciones de prepaga, monotributo, VEP IIBB y más.
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-5 py-3 rounded-xl font-semibold hover:from-emerald-600 hover:to-emerald-700 shadow-lg"
          >
            <Plus className="w-5 h-5" /> Nuevo sueldo
          </button>
        </div>

        {/* KPIs del último sueldo */}
        {latest && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-gray-800 border-l-4 border-blue-500 rounded-lg p-5">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Último sueldo — Bruto
              </p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(latest.grossAmount)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Fecha: {formatDate(latest.date)}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-gray-800 border-l-4 border-red-500 rounded-lg p-5">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Deducciones ({latest.deductions.length})
              </p>
              <p className="text-2xl font-bold text-red-600">
                -{formatCurrency(latest.totalDeductions)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Solo informativas, no afectan tus gastos.
              </p>
            </div>
            <div className="bg-emerald-50 dark:bg-gray-800 border-l-4 border-emerald-500 rounded-lg p-5">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Último sueldo — Neto (estimado)
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(latest.netAmount)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                El ingreso registrado es el bruto.
              </p>
            </div>
          </div>
        )}

        {/* Contenido */}
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Cargando sueldos…</p>
        ) : salaries.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-10 text-center">
            <Banknote className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
            <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">
              Todavía no registraste sueldos.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
              Cargá el bruto y las deducciones para conocer tu neto.
            </p>
            <button
              onClick={openCreate}
              className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-emerald-700"
            >
              Registrar primer sueldo
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                    <th className="px-4 py-3 text-right font-semibold">Bruto</th>
                    <th className="px-4 py-3 text-right font-semibold">Deducciones</th>
                    <th className="px-4 py-3 text-right font-semibold">Neto</th>
                    <th className="px-4 py-3 text-left font-semibold">Notas</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {salaries.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100 whitespace-nowrap">
                        {formatDate(s.date)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200 whitespace-nowrap">
                        {formatCurrency(s.grossAmount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {s.totalDeductions > 0 ? (
                          <div>
                            <span className="text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
                              -{formatCurrency(s.totalDeductions)}
                            </span>
                            <ul className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-0.5 text-left">
                              {s.deductions.map((d) => (
                                <li key={d.id}>
                                  • {d.expenseDescription}
                                  {d.expenseCategoryName
                                    ? ` (${d.expenseCategoryName})`
                                    : ''}{' '}
                                  -{formatCurrency(d.amount)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatCurrency(s.netAmount)}
                      </td>
                      <td
                        className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate"
                        title={s.notes || ''}
                      >
                        {s.notes || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEdit(s)}
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-600"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setToDelete(s)}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-gray-600"
                            title="Eliminar"
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
        )}
      </div>

      {showForm && (
        <SalaryForm
          initial={editing}
          latest={latest}
          expenses={expenses}
          onSave={handleSave}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          saving={saving}
          error={formError}
        />
      )}

      {toDelete && (
        <ConfirmDeleteModal
          message={`¿Eliminar el sueldo de ${formatDate(toDelete.date)}? El ingreso asociado también se quitará.`}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}

      {successMsg && <SuccessModal message={successMsg} onClose={() => setSuccessMsg('')} />}
    </div>
  );
}
