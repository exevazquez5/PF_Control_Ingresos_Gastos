import { useEffect, useMemo, useState } from 'react';
import { Archive, Plus, RotateCcw, X } from 'lucide-react';
import api from '../api/axios.config.js';

const firstDayOfMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

const emptyRule = (sourceId = '') => ({
  id: null,
  incomeSourceId: sourceId,
  name: '',
  kind: 'percentage',
  percentage: '',
  fixedAmount: '',
  linkedCategoryId: '',
  linkedDescription: '',
  isExpected: false,
  validFrom: firstDayOfMonth(),
  validTo: ''
});

const errorMessage = (error) => {
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  return data?.message || data?.title || 'No se pudo guardar la regla. Revisá los datos e intentá de nuevo.';
};

export default function DiscountRuleManager({ sources, expenseCategories, onClose, onChanged, onSourcesChanged }) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ? String(sources[0].id) : '');
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(() => emptyRule(sources[0]?.id || ''));
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedSource = useMemo(
    () => sources.find(source => String(source.id) === String(sourceId)),
    [sources, sourceId]
  );

  const loadRules = async () => {
    if (!sourceId) {
      setRules([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/DiscountRules', { params: { sourceId, includeArchived: true } });
      setRules(response.data || []);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setForm(emptyRule(sourceId));
    setEditing(false);
    loadRules();
  // loadRules intentionally follows the selected source.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  const startEdit = (rule) => {
    setEditing(true);
    setError('');
    setForm({
      id: rule.id,
      incomeSourceId: String(rule.incomeSourceId),
      name: rule.name || '',
      kind: rule.linkedCategoryId || rule.linkedDescription ? 'linked' : rule.fixedAmount != null ? 'fixed' : 'percentage',
      percentage: rule.percentage ?? '',
      fixedAmount: rule.fixedAmount ?? '',
      linkedCategoryId: rule.linkedCategoryId ?? '',
      linkedDescription: rule.linkedDescription || '',
      isExpected: !!rule.isExpected,
      validFrom: rule.validFrom?.slice(0, 10) || firstDayOfMonth(),
      validTo: rule.validTo?.slice(0, 10) || ''
    });
  };

  const startNew = () => {
    setEditing(false);
    setError('');
    setForm(emptyRule(sourceId));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Ingresá un nombre para el descuento.');
      return;
    }
    if (form.kind === 'linked' && !form.linkedCategoryId && !form.linkedDescription.trim()) {
      setError('Elegí una categoría de gasto o indicá un texto de descripción.');
      return;
    }
    if (form.validTo && form.validTo < form.validFrom) {
      setError('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return;
    }

    const body = {
      ...(editing ? { id: form.id } : {}),
      incomeSourceId: Number(sourceId),
      name: form.name.trim(),
      percentage: form.kind === 'percentage' ? Number(form.percentage) : null,
      fixedAmount: form.kind === 'fixed' ? Number(form.fixedAmount) : null,
      linkedCategoryId: form.kind === 'linked' && form.linkedCategoryId ? Number(form.linkedCategoryId) : null,
      linkedDescription: form.kind === 'linked' ? form.linkedDescription.trim() || null : null,
      isExpected: form.kind === 'linked' && form.isExpected,
      validFrom: form.validFrom,
      validTo: form.validTo || null
    };

    setSaving(true);
    try {
      if (editing) await api.put(`/DiscountRules/${form.id}`, body);
      else await api.post('/DiscountRules', body);
      await loadRules();
      startNew();
      onChanged?.();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const changeArchiveState = async (rule) => {
    setError('');
    try {
      await api.post(`/DiscountRules/${rule.id}/${rule.isArchived ? 'restore' : 'archive'}`);
      await loadRules();
      onChanged?.();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const changeSourceMode = async (mode) => {
    if (!selectedSource || selectedSource.mode === mode) return;
    setError('');
    setSaving(true);
    try {
      await api.put(`/IncomeSources/${selectedSource.id}`, { name: selectedSource.name, mode });
      await onSourcesChanged?.();
      onChanged?.();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="discount-manager-title">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-gray-700">
          <div>
            <h2 id="discount-manager-title" className="text-xl font-bold text-gray-900 dark:text-white">Descuentos y reglas</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">Configurá descuentos por fuente y cuándo se aplican.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto p-5">
          {sources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-blue-300 p-6 text-center dark:border-gray-600">
              <p className="font-semibold text-gray-800 dark:text-white">Todavía no hay fuentes de ingreso.</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">Guardá un ingreso y asignale una fuente para empezar a configurar sus descuentos.</p>
            </div>
          ) : (
            <>
              <label className="mb-4 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Fuente de ingreso
                <select className={`${fieldClass} mt-1`} value={sourceId} onChange={event => setSourceId(event.target.value)}>
                  {sources.map(source => <option key={source.id} value={source.id}>{source.name} · modo {source.mode}</option>)}
                </select>
              </label>

              <label className="mb-4 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Modo predeterminado para próximos ingresos
                <select className={`${fieldClass} mt-1`} value={selectedSource?.mode || 'neto'} disabled={saving} onChange={event => changeSourceMode(event.target.value)}>
                  <option value="neto">Neto depositado</option>
                  <option value="bruto">Bruto del recibo</option>
                </select>
              </label>

              {selectedSource?.mode !== 'bruto' && (
                <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  Esta fuente está en modo Neto. Las reglas se pueden preparar como referencia, pero los descuentos solo se restan cuando el ingreso del mes está registrado en modo Bruto.
                </p>
              )}

              <div className="mb-5 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Reglas de esta fuente</h3>
                  <button type="button" onClick={startNew} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Nueva regla</button>
                </div>
                {loading ? <p className="py-3 text-sm text-gray-500">Cargando reglas…</p> : rules.length === 0 ? <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-700/50 dark:text-gray-300">No hay reglas configuradas para esta fuente.</p> : (
                  <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                    {rules.map(rule => (
                      <div key={rule.id} className={`flex flex-wrap items-center justify-between gap-3 p-3 ${rule.isArchived ? 'opacity-60' : ''}`}>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{rule.name}{rule.isArchived && <span className="ml-2 text-xs">(archivada)</span>}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-300">
                            {rule.percentage != null ? `${rule.percentage}%` : rule.fixedAmount != null ? `Fijo: $${rule.fixedAmount}` : `Vinculada a ${rule.linkedCategoryName || rule.linkedDescription}`}
                            {rule.isExpected && ' · esperada'} · desde {new Date(`${rule.validFrom?.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR')}
                            {rule.validTo && ` hasta ${new Date(`${rule.validTo.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR')}`}
                          </p>
                        </div>
                        {!rule.isArchived && <button type="button" onClick={() => startEdit(rule)} className="rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-gray-700">Editar</button>}
                        <button type="button" onClick={() => changeArchiveState(rule)} aria-label={rule.isArchived ? `Restaurar ${rule.name}` : `Archivar ${rule.name}`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                          {rule.isArchived ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={submit} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
                <h3 className="font-semibold text-gray-900 dark:text-white">{editing ? 'Editar regla' : 'Nueva regla'}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Nombre<input className={`${fieldClass} mt-1`} maxLength={60} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Jubilación, monotributo…" required /></label>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Tipo de descuento<select className={`${fieldClass} mt-1`} value={form.kind} onChange={event => setForm({ ...form, kind: event.target.value, isExpected: false })}><option value="percentage">Porcentaje del bruto</option><option value="fixed">Monto fijo</option><option value="linked" disabled={selectedSource?.mode !== 'bruto'}>Gastos vinculados (solo modo Bruto)</option></select></label>
                </div>
                {form.kind === 'percentage' && <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Porcentaje<input className={`${fieldClass} mt-1`} type="number" min="0.01" max="99.99" step="0.01" value={form.percentage} onChange={event => setForm({ ...form, percentage: event.target.value })} required /></label>}
                {form.kind === 'fixed' && <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Monto mensual<input className={`${fieldClass} mt-1`} type="number" min="0.01" step="0.01" value={form.fixedAmount} onChange={event => setForm({ ...form, fixedAmount: event.target.value })} required /></label>}
                {form.kind === 'linked' && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Categoría de gasto<select className={`${fieldClass} mt-1`} value={form.linkedCategoryId} onChange={event => setForm({ ...form, linkedCategoryId: event.target.value })}><option value="">Cualquier categoría</option>{expenseCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Texto de descripción<input className={`${fieldClass} mt-1`} maxLength={100} value={form.linkedDescription} onChange={event => setForm({ ...form, linkedDescription: event.target.value })} placeholder="Obra social, prepaga…" /></label>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200"><input type="checkbox" checked={form.isExpected} onChange={event => setForm({ ...form, isExpected: event.target.checked })} />Marcar como descuento esperado para el cierre del mes</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Los gastos pagados que coincidan se vinculan automáticamente una sola vez. Las cuotas cuentan en el mes en que se pagan.</p>
                  </>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Válida desde<input className={`${fieldClass} mt-1`} type="date" value={form.validFrom} onChange={event => setForm({ ...form, validFrom: event.target.value })} required /></label>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Válida hasta (opcional)<input className={`${fieldClass} mt-1`} type="date" value={form.validTo} onChange={event => setForm({ ...form, validTo: event.target.value })} /></label>
                </div>
                {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  {editing && <button type="button" onClick={startNew} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700">Cancelar edición</button>}
                  <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear regla'}</button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
