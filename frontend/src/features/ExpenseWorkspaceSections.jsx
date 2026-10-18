import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Archive, CalendarDays, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import api from '../api/axios.config.js';
import { getCategoriesFlat } from '../services/categoriesService';
import formatCurrency from '../utils/format.js';

const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const monthValue = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const dateMonthValue = value => String(value || '').slice(0, 7);
const asLocalDate = (value) => `${value}T12:00:00`;
const dueDateFor = (service, period) => { const [year, month] = period.split('-').map(Number); const day = Math.min(service.dueDay, new Date(year, month, 0).getDate()); return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; };
const inputClass = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
const labelClass = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200';
const cardClass = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800';

function ErrorLine({ children }) {
  return children ? <p role="alert" className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{children}</p> : null;
}

const getErrorMessage = (error, fallback) => {
  const data = error.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data === 'object') {
    if (data.detail || data.message || data.title) return data.detail || data.message || data.title;
    if (data.errors) return Object.values(data.errors).flat().join(' ');
  }
  return error.message || fallback;
};

function ExpenseLinkPicker({ expenses, selectedId, onSelect, period, categoryId, categoryName = '' }) {
  const [query, setQuery] = useState('');
  const [allPeriods, setAllPeriods] = useState(false);
  const normalizedCategory = categoryName.trim().toLocaleLowerCase('es-AR');
  const categoryExpenses = expenses.filter(expense => categoryId
    ? Number(expense.categoryId) === Number(categoryId)
    : normalizedCategory ? String(expense.categoryName || '').toLocaleLowerCase('es-AR') === normalizedCategory : true);
  const visible = categoryExpenses.filter(expense => {
    const matchesPeriod = allPeriods || !period || dateMonthValue(expense.date) === period;
    const text = `${expense.description || ''} ${expense.categoryName || ''} ${expense.amount || ''}`.toLocaleLowerCase('es-AR');
    return matchesPeriod && text.includes(query.trim().toLocaleLowerCase('es-AR'));
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
  const selected = expenses.find(expense => String(expense.id) === String(selectedId));
  return <div className="space-y-2">
    <label className="relative block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input className={`${inputClass} pl-9`} value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por descripción o importe" aria-label="Buscar gasto ya registrado"/></label>
    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300"><input type="checkbox" checked={allPeriods} onChange={event => setAllPeriods(event.target.checked)}/>{period ? `Mostrar también gastos de otros períodos (mes de pago: ${period})` : 'Buscar en todos los períodos'}</label>
    {selected && <p className="text-xs text-blue-700 dark:text-blue-300">Seleccionado: {selected.description} · {new Date(selected.date).toLocaleDateString('es-AR', { timeZone: 'UTC' })} · {formatCurrency(selected.amount)} <button type="button" className="ml-1 underline" onClick={() => onSelect('')}>Quitar selección</button></p>}
    <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600">
      <button type="button" className={`block w-full px-3 py-2 text-left text-sm ${!selectedId ? 'bg-blue-50 dark:bg-gray-700' : ''} dark:text-white`} onClick={() => onSelect('')}>Crear el gasto al registrar el pago</button>
      {visible.length === 0 ? <p className="px-3 py-3 text-xs text-gray-500">No hay gastos que coincidan. Probá con otro período o habilitá otros meses.</p> : visible.map(expense => <button type="button" key={expense.id} className={`block w-full border-t border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-700 ${String(selectedId) === String(expense.id) ? 'bg-blue-50 dark:bg-gray-700' : ''}`} onClick={() => onSelect(String(expense.id))}><span className="block font-medium">{expense.description}</span><span className="text-xs text-gray-500">{new Date(expense.date).toLocaleDateString('es-AR', { timeZone: 'UTC' })} · {expense.categoryName || 'Gasto'} · {formatCurrency(expense.amount)}</span></button>)}
    </div>
  </div>;
}

function ServiceSection() {
  const [services, setServices] = useState([]);
  const [bills, setBills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [existingExpenses, setExistingExpenses] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serviceForm, setServiceForm] = useState(null);
  const [openImporterAfterSave, setOpenImporterAfterSave] = useState(false);
  const [billForm, setBillForm] = useState(null);
  const [billAmountForm, setBillAmountForm] = useState(null);
  const [historyImport, setHistoryImport] = useState(null);
  const [payBillId, setPayBillId] = useState(null);
  const [reimbursementForm, setReimbursementForm] = useState(null);
  const [shareForm, setShareForm] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true); setError('');
    try {
      const [s, b, c, expenses] = await Promise.all([api.get('/expense-workspace/services'), api.get('/expense-workspace/bills'), getCategoriesFlat(), api.get('/Expenses')]);
      const linkedExpenseIds = new Set(b.data.map(bill => Number(bill.expenseId)).filter(Boolean));
      setServices(s.data); setBills(b.data); setCategories(c.filter(x => x.type === 'gasto')); setExistingExpenses(expenses.data.filter(e => !e.tieneCuotas && !e.isDeleted && !linkedExpenseIds.has(Number(e.id))));
      setSelectedId(current => current || String(s.data[0]?.id || ''));
    } catch (e) { setError(e.response?.data || 'No se pudieron cargar los servicios.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const selectedService = services.find(s => String(s.id) === String(selectedId));
  const reimbursementBill = bills.find(bill => Number(bill.id) === Number(reimbursementForm?.billId));
  const outstandingReimbursementShares = (reimbursementBill?.shares || []).filter(share => {
    const received = reimbursementBill.reimbursements.filter(r => r.participantName === share.participantNameSnapshot).reduce((sum, r) => sum + r.amount, 0);
    return received < share.agreedAmount;
  });
  const serviceBills = bills.filter(b => String(b.serviceId) === String(selectedId)).sort((a, b) => new Date(b.period) - new Date(a.period));
  const yearBills = serviceBills.filter(b => new Date(b.period).getFullYear() === Number(year));
  const chartData = monthNames.map((label, i) => {
    const items = yearBills.filter(b => new Date(b.period).getMonth() === i);
    return { month: label, facturado: items.reduce((sum, b) => sum + b.grossAmount, 0), reintegrado: items.reduce((sum, b) => sum + b.reimbursements.reduce((x, r) => x + r.amount, 0), 0), costoNeto: items.reduce((sum, b) => sum + b.grossAmount - b.reimbursements.reduce((x, r) => x + r.amount, 0), 0) };
  });

  const openServiceForm = (service = null) => setServiceForm(service ? {
    id: service.id, name: service.name, provider: service.provider, categoryId: String(service.categoryId), dueDay: service.dueDay,
    participants: service.participants.map(p => ({ name: p.name, sharePercent: p.sharePercent, isOwner: p.isOwner }))
  } : { name: '', provider: '', categoryId: String(categories.find(c => c.name.toLowerCase() === 'servicios')?.id || ''), dueDay: 10, participants: [{ name: 'Yo', sharePercent: 0, isOwner: true }] });
  const patchServiceForm = (key, value) => setServiceForm(f => ({ ...f, [key]: value }));
  const patchParticipant = (index, key, value) => setServiceForm(f => ({ ...f, participants: f.participants.map((p, i) => i === index ? { ...p, [key]: value } : p) }));
  const saveService = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const body = { ...serviceForm, categoryId: Number(serviceForm.categoryId), dueDay: Number(serviceForm.dueDay), participants: serviceForm.participants.map(p => ({ ...p, sharePercent: p.isOwner ? 0 : Number(p.sharePercent) })) };
      if (body.participants.filter(p => !p.isOwner).reduce((sum, p) => sum + p.sharePercent, 0) > 100) throw new Error('Las partes de los demás integrantes no pueden superar el 100%.');
      const response = serviceForm.id ? await api.put(`/expense-workspace/services/${serviceForm.id}`, body) : await api.post('/expense-workspace/services', body);
      setServiceForm(null); await refresh();
      if (!serviceForm.id && openImporterAfterSave) { setOpenImporterAfterSave(false); openHistoryImport([...services, response.data]); }
    } catch (e) { setError(e.message || e.response?.data || 'No se pudo guardar el servicio.'); }
    finally { setBusy(false); }
  };
  const archiveService = async (service) => {
    if (!window.confirm(`¿Dejar de usar ${service.name}? El historial se conserva.`)) return;
    try { await api.delete(`/expense-workspace/services/${service.id}`); await refresh(); }
    catch (e) { setError(e.response?.data || 'No se pudo archivar el servicio.'); }
  };
  const restoreService = async (service) => {
    try { await api.post(`/expense-workspace/services/${service.id}/restore`); await refresh(); }
    catch (e) { setError(e.response?.data || 'No se pudo restaurar el servicio.'); }
  };
  const createBill = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api.post('/expense-workspace/bills', { serviceId: Number(selectedId), period: asLocalDate(`${billForm.period}-01`), grossAmount: Number(billForm.amount), dueDate: asLocalDate(billForm.dueDate), existingExpenseId: billForm.existingExpenseId ? Number(billForm.existingExpenseId) : null });
      setBillForm(null); await refresh();
    } catch (e) { setError(e.response?.data || 'No se pudo registrar la factura.'); }
    finally { setBusy(false); }
  };
  const payBill = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.post(`/expense-workspace/bills/${payBillId}/pay`, { paidAt: asLocalDate(billForm?.paidAt || today()) }); setPayBillId(null); setBillForm(null); await refresh(); }
    catch (e) { setError(e.response?.data || 'No se pudo registrar el pago.'); }
    finally { setBusy(false); }
  };
  const saveBillAmount = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api.put(`/expense-workspace/bills/${billAmountForm.billId}/amount`, { grossAmount: Number(billAmountForm.amount) });
      setBillAmountForm(null); await refresh();
    } catch (e) { setError(getErrorMessage(e, 'No se pudo actualizar el total de la factura.')); }
    finally { setBusy(false); }
  };
  const saveShares = async (event, billId, shares) => {
    event.preventDefault(); setBusy(true);
    try { await api.put(`/expense-workspace/bills/${billId}/shares`, { shares }); setShareForm(null); await refresh(); }
    catch (e) { setError(e.response?.data || 'No se pudieron actualizar las partes.'); }
    finally { setBusy(false); }
  };
  const saveReimbursement = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.post(`/expense-workspace/bills/${reimbursementForm.billId}/reimbursements`, { participantName: reimbursementForm.name, amount: Number(reimbursementForm.amount), date: asLocalDate(reimbursementForm.date), note: reimbursementForm.note }); setReimbursementForm(null); await refresh(); }
    catch (e) { setError(e.response?.data || 'No se pudo registrar el reintegro.'); }
    finally { setBusy(false); }
  };
  const openHistoryImport = (serviceList = services) => {
    const activeServices = serviceList.filter(service => !service.isArchived);
    const linkedIds = new Set(bills.filter(b => b.expenseId).map(b => Number(b.expenseId)));
    const serviceCategoryIds = new Set(activeServices.map(s => Number(s.categoryId)));
    const candidates = existingExpenses.filter(e => serviceCategoryIds.has(Number(e.categoryId)) && !linkedIds.has(Number(e.id)));
    const initialAssignments = Object.fromEntries(candidates.map(expense => {
      const text = `${expense.description || ''} ${expense.categoryName || ''}`.toLocaleLowerCase('es-AR');
      const matching = activeServices.find(service => Number(service.categoryId) === Number(expense.categoryId) && [service.name, service.provider].some(value => value && text.includes(value.toLocaleLowerCase('es-AR'))));
      return [expense.id, { selected: false, serviceId: String(matching?.id || activeServices.find(s => Number(s.categoryId) === Number(expense.categoryId))?.id || ''), period: dateMonthValue(expense.date) }];
    }));
    const months = candidates.map(e => dateMonthValue(e.date)).filter(Boolean).sort();
    setHistoryImport({ from: months[0] || monthValue(), to: months.at(-1) || monthValue(), query: '', expenseAmountsAreOwnerShare: false, rows: initialAssignments });
  };
  const beginHistoryImport = () => {
    if (services.some(service => !service.isArchived)) { openHistoryImport(); return; }
    setOpenImporterAfterSave(true);
    openServiceForm();
  };
  const importHistory = async event => {
    event.preventDefault();
    const items = existingExpenses.filter(expense => historyImport.rows[expense.id]?.selected).map(expense => ({ expenseId: Number(expense.id), serviceId: Number(historyImport.rows[expense.id].serviceId), period: asLocalDate(`${historyImport.rows[expense.id].period}-01`) }));
    if (!items.length) { setError('Seleccioná al menos un gasto para importar.'); return; }
    setBusy(true); setError('');
    try { await api.post('/expense-workspace/bills/import-history', { items, expenseAmountsAreOwnerShare: historyImport.expenseAmountsAreOwnerShare }); setHistoryImport(null); await refresh(); }
    catch (e) { setError(getErrorMessage(e, 'No se pudo importar el historial.')); }
    finally { setBusy(false); }
  };
  const correctHistoricalBill = async bill => {
    if (!window.confirm(`El gasto vinculado (${formatCurrency(bill.grossAmount)}) se había cargado como tu parte. La app reconstruirá el total de la factura y escalará las partes respetando las proporciones que ya figuran en esta factura. El gasto original no se modifica. ¿Continuar?`)) return;
    setBusy(true); setError('');
    try { await api.post(`/expense-workspace/bills/${bill.id}/correct-historical-owner-share`); await refresh(); }
    catch (e) { setError(getErrorMessage(e, 'No se pudo corregir el importe histórico.')); }
    finally { setBusy(false); }
  };
  const historyCandidates = historyImport ? existingExpenses.filter(expense => {
    const row = historyImport.rows[expense.id];
    const text = `${expense.description || ''} ${expense.categoryName || ''} ${expense.amount || ''}`.toLocaleLowerCase('es-AR');
    return row && dateMonthValue(expense.date) >= historyImport.from && dateMonthValue(expense.date) <= historyImport.to && text.includes(historyImport.query.trim().toLocaleLowerCase('es-AR'));
  }).sort((a, b) => new Date(b.date) - new Date(a.date)) : [];
  const selectedHistoryRows = historyImport ? Object.values(historyImport.rows).filter(row => row.selected) : [];
  const historyHasDuplicatePeriods = selectedHistoryRows.some((row, index) => selectedHistoryRows.some((other, otherIndex) => index !== otherIndex && row.serviceId && row.serviceId === other.serviceId && row.period === other.period));

  return <section className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-bold dark:text-white">Servicios compartidos</h2><p className="text-sm text-gray-500 dark:text-gray-300">Registrás la factura completa; las partes y transferencias se llevan por separado.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={beginHistoryImport} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-semibold dark:border-gray-600 dark:text-white"><CalendarDays size={17}/> Importar historial</button><button onClick={() => openServiceForm()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"><Plus size={18}/> Agregar servicio</button></div>
    </div>
    <ErrorLine>{error}</ErrorLine>
    {services.length > 0 && <div className="flex flex-wrap gap-2">{services.map(s => <button key={s.id} onClick={() => setSelectedId(String(s.id))} className={`rounded-full px-4 py-2 text-sm font-semibold ${String(s.id) === String(selectedId) ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100'}`}>{s.name}{s.isArchived ? ' · Archivado' : ''}</button>)}</div>}
    {loading ? <div className={cardClass}>Cargando servicios…</div> : services.length === 0 ? <div className={`${cardClass} py-12 text-center`}><Users className="mx-auto mb-3 text-blue-500"/><h3 className="font-semibold dark:text-white">Todavía no cargaste servicios compartidos</h3><p className="mt-1 text-sm text-gray-500 dark:text-gray-300">Agregá luz, gas, agua o internet y definí las partes de cada integrante.</p></div> : selectedService && <>
      <div className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}><div><h3 className="text-xl font-bold dark:text-white">{selectedService.name}{selectedService.isArchived && <span className="ml-2 text-sm font-normal text-gray-500">Archivado</span>}</h3><p className="text-sm text-gray-500 dark:text-gray-300">{selectedService.provider} · Vence el día {selectedService.dueDay} · {selectedService.participants.filter(p => !p.isOwner).map(p => `${p.name} ${p.sharePercent}%`).join(' · ') || 'Sin partes asignadas'}</p></div><div className="flex gap-2">{selectedService.isArchived ? <button onClick={() => restoreService(selectedService)} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Restaurar servicio</button> : <><button onClick={() => openServiceForm(selectedService)} className="rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:text-white"><Pencil size={15} className="mr-1 inline"/>Editar</button><button onClick={() => archiveService(selectedService)} aria-label="Archivar servicio" className="rounded-lg border px-3 py-2 text-gray-500 dark:border-gray-600"><Archive size={16}/></button></>}</div></div>
      <div className={`${cardClass} space-y-4`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold dark:text-white">Evolución de {selectedService.name}</h3><p className="text-xs text-gray-500">Importes de facturas del servicio y reintegros recibidos</p></div><select value={year} onChange={e => setYear(e.target.value)} className={`${inputClass} max-w-36`}>{Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y}>{y}</option>)}</select></div>
        <div className="h-72 w-full"><ResponsiveContainer><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month"/><YAxis tickFormatter={v => formatCurrency(v)}/><Tooltip formatter={v => formatCurrency(v)}/><Legend/><Bar dataKey="facturado" name="Factura" fill="#f97316"/><Bar dataKey="reintegrado" name="Reintegrado" fill="#22c55e"/></BarChart></ResponsiveContainer></div>
      </div>
      <div className={`${cardClass} space-y-4`}><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold dark:text-white">Facturas y partes · {year}</h3>{!selectedService.isArchived && <button onClick={() => { const period = monthValue(); setBillForm({ period, amount: '', dueDate: dueDateFor(selectedService, period), existingExpenseId: '' }); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"><Plus size={16}/> Registrar factura</button>}</div>
        {yearBills.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Todavía no hay facturas en este año.</p> : yearBills.map(bill => {
          const owed = bill.shares.reduce((sum, s) => sum + s.agreedAmount, 0); const received = bill.reimbursements.reduce((sum, r) => sum + r.amount, 0);
          return <article key={bill.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-bold dark:text-white">{bill.serviceNameSnapshot} · {new Date(bill.period).toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h4><p className="text-sm text-gray-500">Vence {new Date(bill.dueDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })} · {bill.paidAt ? `Pagada el ${new Date(bill.paidAt).toLocaleDateString('es-AR', { timeZone: 'UTC' })}` : 'Pendiente de pago'}</p></div><div className="text-right"><p className="text-lg font-bold dark:text-white">{formatCurrency(bill.grossAmount)}</p>{bill.paidAt ? <span className="text-xs font-semibold text-green-600">Pagada por vos</span> : <button onClick={() => { setBillForm({ paidAt: today() }); setPayBillId(bill.id); }} className="mt-1 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white">Registrar pago</button>}</div></div>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-sm"><thead className="text-left text-gray-500"><tr><th className="py-2">Integrante</th><th>Parte acordada</th><th>Estado del reintegro</th><th className="text-right">Recibido</th></tr></thead><tbody>{bill.shares.map(share => { const paid = bill.reimbursements.filter(r => r.participantName === share.participantNameSnapshot).reduce((sum, r) => sum + r.amount, 0); return <tr key={share.id} className="border-t border-gray-200 dark:border-gray-700"><td className="py-2 font-medium dark:text-white">{share.participantNameSnapshot}</td><td>{formatCurrency(share.agreedAmount)}</td><td className={paid >= share.agreedAmount ? 'font-semibold text-green-600' : 'text-amber-600'}>{paid >= share.agreedAmount ? 'Recibido' : paid ? `Parcial · resta ${formatCurrency(share.agreedAmount - paid)}` : bill.paidAt ? 'Pendiente' : 'A cobrar al pagar'}</td><td className="text-right">{formatCurrency(paid)}</td></tr>})}</tbody></table></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 dark:border-gray-700"><p className="text-sm dark:text-gray-200">{bill.ownerShareWasHistoricalAmount ? "Tu parte histórica:" : "Tu costo actual:"} <strong className="text-green-600">{formatCurrency(bill.ownerShareWasHistoricalAmount ? bill.grossAmount - owed : bill.grossAmount - received)}</strong><span className="ml-2 text-xs text-gray-500">· {formatCurrency(owed - received)} por cobrar</span>{bill.ownerShareWasHistoricalAmount && <span className="ml-2 text-xs text-blue-600">· Total reconstruido desde tu parte</span>}</p><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => { setError(''); setBillAmountForm({ billId: bill.id, amount: String(bill.grossAmount) }); }} className="rounded-md border px-3 py-1.5 text-sm text-blue-700 dark:border-gray-600 dark:text-blue-300">Editar importe</button>{bill.expenseId && !bill.ownerShareWasHistoricalAmount && <button disabled={busy} onClick={() => correctHistoricalBill(bill)} className="rounded-md border px-3 py-1.5 text-sm text-blue-700 dark:border-gray-600 dark:text-blue-300">El gasto era solo mi parte</button>}{!bill.paidAt && <button onClick={() => setShareForm({ billId: bill.id, shares: bill.shares.map(s => ({ name: s.participantNameSnapshot, amount: s.agreedAmount })) })} className="rounded-md border px-3 py-1.5 text-sm dark:border-gray-600 dark:text-white">Editar partes</button>}{bill.paidAt && bill.shares.some(s => bill.reimbursements.filter(r => r.participantName === s.participantNameSnapshot).reduce((a, r) => a + r.amount, 0) < s.agreedAmount) && <button onClick={() => { const next = bill.shares.find(s => bill.reimbursements.filter(r => r.participantName === s.participantNameSnapshot).reduce((a, r) => a + r.amount, 0) < s.agreedAmount); const paid = bill.reimbursements.filter(r => r.participantName === next.participantNameSnapshot).reduce((a, r) => a + r.amount, 0); setReimbursementForm({ billId: bill.id, name: next.participantNameSnapshot, amount: String(next.agreedAmount - paid), date: today(), note: '' }); }} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">+ Registrar transferencia</button>}</div></div>
            {bill.reimbursements.length > 0 && <div className="mt-3 space-y-1 text-xs text-gray-500">{bill.reimbursements.map(r => <div key={r.id} className="flex justify-between"><span>Reintegro de {r.participantName} · {new Date(r.date).toLocaleDateString('es-AR', { timeZone: 'UTC' })}{r.note ? ` · ${r.note}` : ''}</span><span className="font-semibold text-green-600">+{formatCurrency(r.amount)}</span></div>)}</div>}
          </article>;
        })}
      </div>
    </>}

    {serviceForm && <Modal title={openImporterAfterSave ? 'Primero agregá un servicio para importar' : serviceForm.id ? 'Editar servicio' : 'Agregar servicio'} onClose={() => { setServiceForm(null); setOpenImporterAfterSave(false); }}><form onSubmit={saveService} className="space-y-3">{openImporterAfterSave && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">Para asignar cada gasto histórico, primero necesitamos tener el servicio creado. Al guardarlo se abrirá la importación automáticamente.</p>}<Field label="Nombre del servicio"><input required maxLength="100" className={inputClass} value={serviceForm.name} onChange={e => patchServiceForm('name', e.target.value)}/></Field><Field label="Proveedor"><input required className={inputClass} value={serviceForm.provider} onChange={e => patchServiceForm('provider', e.target.value)}/></Field><div className="grid grid-cols-2 gap-3"><Field label="Categoría del gasto"><select required className={inputClass} value={serviceForm.categoryId} onChange={e => patchServiceForm('categoryId', e.target.value)}><option value="">Seleccionar</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Día de vencimiento"><input required type="number" min="1" max="31" className={inputClass} value={serviceForm.dueDay} onChange={e => patchServiceForm('dueDay', e.target.value)}/></Field></div><div><div className="mb-2 flex items-center justify-between"><span className={labelClass}>Partes habituales</span><button type="button" onClick={() => patchServiceForm('participants', [...serviceForm.participants, { name: '', sharePercent: 0, isOwner: false }])} className="text-sm font-semibold text-blue-600">+ Integrante</button></div><p className="mb-2 text-xs text-gray-500">Definí qué porcentaje de la factura debe reintegrar cada integrante. Tu parte es el resto.</p>{serviceForm.participants.map((p, i) => <div key={i} className="mb-2 grid grid-cols-[1fr_120px_auto] items-center gap-2"><input required className={inputClass} value={p.name} disabled={p.isOwner} onChange={e => patchParticipant(i, 'name', e.target.value)} placeholder={p.isOwner ? 'Vos' : 'Nombre'}/>{p.isOwner ? <span className="text-sm text-gray-500">Resto</span> : <div className="relative"><input type="number" min="0" max="100" step="0.01" className={inputClass} value={p.sharePercent} onChange={e => patchParticipant(i, 'sharePercent', e.target.value)}/><span className="absolute right-3 top-2 text-gray-500">%</span></div>}{!p.isOwner && <button type="button" onClick={() => patchServiceForm('participants', serviceForm.participants.filter((_, j) => j !== i))} className="text-red-500"><X size={18}/></button>}</div>)}</div><ErrorLine>{error}</ErrorLine><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => { setServiceForm(null); setOpenImporterAfterSave(false); }} className="rounded-lg border px-4 py-2 dark:border-gray-600 dark:text-white">Cancelar</button><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">Guardar</button></div></form></Modal>}
    {billForm && !payBillId && <Modal title="Registrar factura" onClose={() => setBillForm(null)}><form onSubmit={createBill} className="space-y-3"><Field label="Período"><input required type="month" className={inputClass} value={billForm.period} onChange={e => setBillForm({ ...billForm, period: e.target.value, dueDate: dueDateFor(selectedService, e.target.value) })}/></Field><Field label="Total de la factura"><input required type="number" min="0.01" step="0.01" className={inputClass} value={billForm.amount} onChange={e => setBillForm({ ...billForm, amount: e.target.value })}/></Field><Field label="Vencimiento"><input required type="date" className={inputClass} value={billForm.dueDate} onChange={e => setBillForm({ ...billForm, dueDate: e.target.value })}/></Field><Field label="Gasto ya registrado (opcional)"><ExpenseLinkPicker expenses={existingExpenses} selectedId={billForm.existingExpenseId} period={billForm.period} categoryId={selectedService?.categoryId} onSelect={id => { const expense = existingExpenses.find(x => String(x.id) === id); setBillForm({ ...billForm, existingExpenseId: id, amount: expense ? String(expense.amount) : billForm.amount }); }}/></Field><p className="text-xs text-gray-500">Se priorizan gastos de la categoría del servicio y del mes elegido. Podés habilitar otros meses si pagaste en otra fecha. Vincular evita duplicar el movimiento.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setBillForm(null)} className="rounded-lg border px-4 py-2 dark:border-gray-600 dark:text-white">Cancelar</button><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Guardar factura</button></div></form></Modal>}
    {billAmountForm && <Modal title="Editar importe de la factura" onClose={() => setBillAmountForm(null)}><form onSubmit={saveBillAmount} className="space-y-3"><Field label="Nuevo total de la factura"><input required autoFocus type="number" min="0.01" step="0.01" className={inputClass} value={billAmountForm.amount} onChange={e => setBillAmountForm({ ...billAmountForm, amount: e.target.value })}/></Field><p className="text-sm text-gray-600 dark:text-gray-300">El gasto vinculado se actualizará junto con la factura. Las partes acordadas se recalcularán en la misma proporción; los reintegros ya registrados se conservarán.</p><ErrorLine>{error}</ErrorLine><div className="flex justify-end gap-2"><button type="button" onClick={() => setBillAmountForm(null)} className="rounded-lg border px-4 py-2 dark:border-gray-600 dark:text-white">Cancelar</button><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">{busy ? 'Guardando…' : 'Guardar importe'}</button></div></form></Modal>}
    {historyImport && <Modal title="Importar gastos históricos de servicios" wide onClose={() => setHistoryImport(null)}><form onSubmit={importHistory} className="space-y-4"><p className="text-sm text-gray-500 dark:text-gray-300">Elegí los gastos ya cargados y asignales un servicio y período. Se vincularán como facturas pagadas, sin crear movimientos nuevos.</p><div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/40"><label className="flex items-start gap-2 text-sm font-medium dark:text-white"><input type="checkbox" className="mt-1" checked={historyImport.expenseAmountsAreOwnerShare} onChange={e => setHistoryImport({ ...historyImport, expenseAmountsAreOwnerShare: e.target.checked })}/><span>Los importes seleccionados son solo mi parte, no el total de la factura</span></label><p className="ml-6 mt-1 text-xs text-gray-600 dark:text-gray-300">Se reconstruirá el total con la división del servicio. El gasto original no se modifica.</p></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Desde el mes"><input type="month" className={inputClass} value={historyImport.from} onChange={e => setHistoryImport({ ...historyImport, from: e.target.value })}/></Field><Field label="Hasta el mes"><input type="month" className={inputClass} value={historyImport.to} onChange={e => setHistoryImport({ ...historyImport, to: e.target.value })}/></Field></div><label className="relative block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input className={`${inputClass} pl-9`} value={historyImport.query} onChange={e => setHistoryImport({ ...historyImport, query: e.target.value })} placeholder="Buscar descripción o importe"/></label><div className="flex items-center justify-between gap-2 text-sm"><span className="text-gray-500">{historyCandidates.length} gastos disponibles · {selectedHistoryRows.length} seleccionados</span><button type="button" className="font-semibold text-blue-600" onClick={() => { const visibleIds = new Set(historyCandidates.map(e => e.id)); const select = historyCandidates.some(e => !historyImport.rows[e.id].selected); setHistoryImport({ ...historyImport, rows: Object.fromEntries(Object.entries(historyImport.rows).map(([id, row]) => [id, visibleIds.has(Number(id)) ? { ...row, selected: select } : row])) }); }}>{historyCandidates.some(e => !historyImport.rows[e.id].selected) ? 'Seleccionar visibles' : 'Deseleccionar visibles'}</button></div><div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">{historyCandidates.map(expense => { const row = historyImport.rows[expense.id]; const options = services.filter(service => Number(service.categoryId) === Number(expense.categoryId) && !service.isArchived); return <div key={expense.id} className={`grid gap-2 rounded-lg border p-3 dark:border-gray-700 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(160px,1fr)_150px] sm:items-center ${row.selected ? 'border-blue-400 bg-blue-50 dark:bg-gray-700/60' : ''}`}><input aria-label={`Seleccionar ${expense.description}`} type="checkbox" checked={row.selected} onChange={e => setHistoryImport({ ...historyImport, rows: { ...historyImport.rows, [expense.id]: { ...row, selected: e.target.checked } } })}/><div className="min-w-0"><p className="truncate text-sm font-semibold dark:text-white">{expense.description}</p><p className="text-xs text-gray-500">{new Date(expense.date).toLocaleDateString('es-AR', { timeZone: 'UTC' })} · {expense.categoryName} · {formatCurrency(expense.amount)}</p></div><select aria-label={`Servicio para ${expense.description}`} className={inputClass} value={row.serviceId} onChange={e => setHistoryImport({ ...historyImport, rows: { ...historyImport.rows, [expense.id]: { ...row, serviceId: e.target.value } } })}><option value="">Elegir servicio</option>{options.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select><input aria-label={`Período para ${expense.description}`} type="month" required className={inputClass} value={row.period} onChange={e => setHistoryImport({ ...historyImport, rows: { ...historyImport.rows, [expense.id]: { ...row, period: e.target.value } } })}/></div>; })}{historyCandidates.length === 0 && <p className="py-8 text-center text-sm text-gray-500">No hay gastos de servicios disponibles para ese rango. Revisá el período o registrá los gastos con categoría de servicios primero.</p>}</div>{historyHasDuplicatePeriods && <p role="alert" className="text-sm text-red-600">Hay más de un gasto asignado al mismo servicio y mes. Cambiá un período o quitá una selección.</p>}<ErrorLine>{error}</ErrorLine><div className="flex justify-end gap-2"><button type="button" onClick={() => setHistoryImport(null)} className="rounded-lg border px-4 py-2 dark:border-gray-600 dark:text-white">Cancelar</button><button disabled={busy || !selectedHistoryRows.length || selectedHistoryRows.some(row => !row.serviceId || !row.period) || historyHasDuplicatePeriods} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">{busy ? 'Importando…' : 'Importar seleccionados'}</button></div></form></Modal>}
    {payBillId && <Modal title="Registrar pago de factura" onClose={() => { setPayBillId(null); setBillForm(null); }}><form onSubmit={payBill} className="space-y-3"><Field label="Fecha en que pagaste el total"><input type="date" required max={today()} className={inputClass} value={billForm?.paidAt || today()} onChange={e => setBillForm({ ...billForm, paidAt: e.target.value })}/></Field><p className="text-sm text-gray-500">Se creará un gasto por el total de la factura en la categoría del servicio.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => { setPayBillId(null); setBillForm(null); }} className="rounded-lg border px-4 py-2 dark:border-gray-600 dark:text-white">Cancelar</button><button disabled={busy} className="rounded-lg bg-green-600 px-4 py-2 text-white">Confirmar pago</button></div></form></Modal>}
    {reimbursementForm && <Modal title="Registrar transferencia recibida" onClose={() => setReimbursementForm(null)}><form onSubmit={saveReimbursement} className="space-y-3">{reimbursementBill && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100">Servicio: <strong>{reimbursementBill.serviceNameSnapshot}</strong> · Período: {new Date(reimbursementBill.period).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })}</p>}<Field label="Integrante"><select required className={inputClass} value={reimbursementForm.name} onChange={e => { const name = e.target.value; const share = outstandingReimbursementShares.find(item => item.participantNameSnapshot === name); const received = reimbursementBill.reimbursements.filter(r => r.participantName === name).reduce((sum, r) => sum + r.amount, 0); setReimbursementForm({ ...reimbursementForm, name, amount: String(share.agreedAmount - received) }); }}><option value="" disabled>Seleccioná un integrante</option>{outstandingReimbursementShares.map(share => <option key={share.id} value={share.participantNameSnapshot}>{share.participantNameSnapshot}</option>)}</select></Field><Field label="Monto recibido"><input type="number" min="0.01" step="0.01" required className={inputClass} value={reimbursementForm.amount} onChange={e => setReimbursementForm({ ...reimbursementForm, amount: e.target.value })}/></Field><Field label="Fecha de recepción"><input type="date" max={today()} required className={inputClass} value={reimbursementForm.date} onChange={e => setReimbursementForm({ ...reimbursementForm, date: e.target.value })}/></Field><Field label="Nota (opcional)"><input className={inputClass} value={reimbursementForm.note} onChange={e => setReimbursementForm({ ...reimbursementForm, note: e.target.value })}/></Field><ErrorLine>{error}</ErrorLine><div className="flex justify-end gap-2"><button type="button" onClick={() => setReimbursementForm(null)} className="rounded-lg border px-4 py-2 dark:border-gray-600 dark:text-white">Cancelar</button><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Guardar transferencia</button></div></form></Modal>}
    {shareForm && <Modal title="Editar partes de la factura" onClose={() => setShareForm(null)}><form onSubmit={e => saveShares(e, shareForm.billId, shareForm.shares)} className="space-y-3">{shareForm.shares.map((s, i) => <div key={i} className="grid grid-cols-[1fr_150px] gap-2"><input readOnly className={inputClass} value={s.name}/><input type="number" min="0" step="0.01" className={inputClass} value={s.amount} onChange={e => setShareForm({ ...shareForm, shares: shareForm.shares.map((x, j) => i === j ? { ...x, amount: Number(e.target.value) } : x) })}/></div>)}<p className="text-xs text-gray-500">La suma de las partes no puede superar el total. Tu parte es el saldo restante.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setShareForm(null)} className="rounded-lg border px-4 py-2 dark:border-gray-600 dark:text-white">Cancelar</button><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Guardar partes</button></div></form></Modal>}
  </section>;
}

function TaxSection() {
  const [taxes, setTaxes] = useState([]); const [categories, setCategories] = useState([]); const [existingExpenses, setExistingExpenses] = useState([]); const [error, setError] = useState(''); const [form, setForm] = useState(null); const [pay, setPay] = useState(null); const [busy, setBusy] = useState(false); const [filter, setFilter] = useState('Todos');
  const refresh = async () => { try { const [t, c, expenses, bills] = await Promise.all([api.get('/expense-workspace/taxes'), getCategoriesFlat(), api.get('/Expenses'), api.get('/expense-workspace/bills')]); setTaxes(t.data); setCategories(c.filter(x => x.type === 'gasto')); const linkedIds = new Set([...t.data.map(x => Number(x.expenseId)).filter(Boolean), ...bills.data.map(x => Number(x.expenseId)).filter(Boolean)]); setExistingExpenses(expenses.data.filter(e => !e.tieneCuotas && !linkedIds.has(Number(e.id)))); } catch (e) { setError(e.response?.data || 'No se pudieron cargar los impuestos.'); } };
  useEffect(() => { refresh(); }, []);
  const chartData = useMemo(() => { const years = [...new Set(taxes.map(t => new Date(t.period).getUTCFullYear()))].sort((a,b) => a-b); if (!years.length) years.push(new Date().getFullYear()); const start = Math.min(...years); const end = Math.max(...years); return Array.from({ length: Math.min(end - start + 1, 8) * 12 }, (_, index) => { const d = new Date(start, index, 1); const matching = taxes.filter(t => new Date(t.period).getUTCFullYear() === d.getFullYear() && new Date(t.period).getUTCMonth() === d.getMonth() && (!t.paidAt || filter === 'Todos' || t.type === filter)); return { period: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`, Monotributo: matching.filter(t => t.type === 'Monotributo' && t.paidAt).reduce((a,t) => a+t.amount,0), VEP: matching.filter(t => t.type === 'VEP' && t.paidAt).reduce((a,t) => a+t.amount,0) }; }); }, [taxes, filter]);
  const saveTax = async (e) => { e.preventDefault(); setBusy(true); setError(''); try { const body = { type: form.type, description: form.description, period: asLocalDate(`${form.period}-01`), dueDate: asLocalDate(form.dueDate), amount: Number(form.amount), existingExpenseId: form.existingExpenseId ? Number(form.existingExpenseId) : null }; if (form.id) await api.put(`/expense-workspace/taxes/${form.id}`, body); else await api.post('/expense-workspace/taxes', body); setForm(null); await refresh(); } catch (e) { setError(e.response?.data || 'No se pudo guardar el impuesto.'); } finally { setBusy(false); } };
  const payTax = async (e) => { e.preventDefault(); setBusy(true); setError(''); try { await api.post(`/expense-workspace/taxes/${pay.id}/pay`, { paidAt: asLocalDate(pay.paidAt), categoryId: Number(pay.categoryId) }); setPay(null); await refresh(); } catch (e) { setError(e.response?.data || 'No se pudo registrar el pago.'); } finally { setBusy(false); } };
  const deleteTax = async (tax) => { if (!window.confirm(`¿Eliminar la obligación ${tax.description}?`)) return; try { await api.delete(`/expense-workspace/taxes/${tax.id}`); await refresh(); } catch (e) { setError(e.response?.data || 'No se pudo eliminar el impuesto.'); } };
  const openTax = tax => setForm(tax ? { id: tax.id, type: tax.type, description: tax.description, period: monthValue(new Date(tax.period)), dueDate: String(tax.dueDate).slice(0,10), amount: tax.amount, existingExpenseId: '' } : { type: 'Monotributo', description: 'Monotributo', period: monthValue(), dueDate: today(), amount: '', existingExpenseId: '' });
  const taxExpenseCategory = categories.find(c => c.name.trim().toLocaleLowerCase('es-AR') === 'impuestos');
  const list = [...taxes].sort((a,b) => new Date(b.period)-new Date(a.period));
  return <section className="space-y-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold dark:text-white">Impuestos ARCA</h2><p className="text-sm text-gray-500 dark:text-gray-300">Monotributo y VEP son obligaciones tuyas. El gasto aparece al registrar el pago.</p></div><button onClick={() => openTax()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"><Plus size={18}/> Agregar impuesto</button></div><ErrorLine>{error}</ErrorLine>
    <div className={cardClass}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold dark:text-white">Evolución histórica de pagos</h3><p className="text-xs text-gray-500">Compará lo pagado por período</p></div><select value={filter} onChange={e => setFilter(e.target.value)} className={`${inputClass} max-w-52`}><option>Todos</option><option>Monotributo</option><option>VEP</option></select></div><div className="h-72"><ResponsiveContainer><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="period"/><YAxis tickFormatter={v => formatCurrency(v)}/><Tooltip formatter={v => formatCurrency(v)}/><Legend/><Line type="monotone" dataKey="Monotributo" stroke="#8b5cf6" strokeWidth={2}/><Line type="monotone" dataKey="VEP" stroke="#0ea5e9" strokeWidth={2}/></LineChart></ResponsiveContainer></div></div>
    <div className={`${cardClass} overflow-x-auto`}><h3 className="mb-3 font-semibold dark:text-white">Obligaciones</h3>{list.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Todavía no registraste impuestos.</p> : <table className="w-full min-w-[650px] text-sm"><thead className="text-left text-gray-500"><tr><th className="py-2">Impuesto</th><th>Período</th><th>Vencimiento</th><th>Importe</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead><tbody>{list.map(t => <tr key={t.id} className="border-t border-gray-200 dark:border-gray-700"><td className="py-3 font-semibold dark:text-white">{t.description}<span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">{t.type}</span></td><td>{new Date(t.period).toLocaleDateString('es-AR',{month:'long',year:'numeric',timeZone:'UTC'})}</td><td>{new Date(t.dueDate).toLocaleDateString('es-AR',{timeZone:'UTC'})}</td><td>{formatCurrency(t.amount)}</td><td className={t.paidAt ? 'text-green-600' : 'text-amber-600'}>{t.paidAt ? `Pagado ${new Date(t.paidAt).toLocaleDateString('es-AR',{timeZone:'UTC'})}` : 'Pendiente'}</td><td><div className="flex justify-end gap-2">{!t.paidAt && <><button onClick={() => openTax(t)} aria-label="Editar impuesto" className="text-blue-600"><Pencil size={16}/></button><button onClick={() => deleteTax(t)} aria-label="Eliminar impuesto" className="text-red-500"><Trash2 size={16}/></button><button onClick={() => setPay({ id: t.id, paidAt: today(), categoryId: String(categories.find(c => c.name.toLowerCase() === 'otros')?.id || categories[0]?.id || '') })} className="rounded-md bg-green-600 px-3 py-1 text-white">Registrar pago</button></>}</div></td></tr>)}</tbody></table>}</div>
    {form && <Modal title={form.id ? 'Editar impuesto pendiente' : 'Agregar obligación de ARCA'} onClose={() => setForm(null)}><form onSubmit={saveTax} className="space-y-3"><Field label="Tipo"><select className={inputClass} value={form.type} onChange={e => setForm({...form,type:e.target.value,description:e.target.value==='Monotributo'?'Monotributo':'VEP'})}><option>Monotributo</option><option>VEP</option></select></Field><Field label="Descripción"><input required className={inputClass} value={form.description} onChange={e => setForm({...form,description:e.target.value})}/></Field><Field label="Período"><input required type="month" className={inputClass} value={form.period} onChange={e => setForm({...form,period:e.target.value})}/></Field><Field label="Vencimiento"><input required type="date" className={inputClass} value={form.dueDate} onChange={e => setForm({...form,dueDate:e.target.value})}/></Field><Field label="Importe"><input required type="number" min="0.01" step="0.01" className={inputClass} value={form.amount} onChange={e => setForm({...form,amount:e.target.value})}/></Field>{!form.id && <Field label="Gasto ya registrado (opcional)"><ExpenseLinkPicker expenses={existingExpenses} selectedId={form.existingExpenseId} period={form.period} categoryId={taxExpenseCategory?.id} categoryName="Impuestos" onSelect={id => { const expense = existingExpenses.find(x => String(x.id) === id); setForm({ ...form, existingExpenseId: id, amount: expense ? String(expense.amount) : form.amount }); }}/></Field>}<p className="text-xs text-gray-500">La búsqueda muestra primero gastos de categoría Impuestos pagados en el período elegido. Podés habilitar otros meses si el pago fue en otra fecha. Vincular un gasto histórico evita duplicarlo.</p><ErrorLine>{error}</ErrorLine><div className="flex justify-end gap-2"><button type="button" onClick={() => setForm(null)} className="rounded-lg border px-4 py-2 dark:border-gray-600 dark:text-white">Cancelar</button><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white">Guardar</button></div></form></Modal>}
    {pay && <Modal title="Registrar pago de ARCA" onClose={() => setPay(null)}><form onSubmit={payTax} className="space-y-3"><Field label="Categoría del gasto"><select required className={inputClass} value={pay.categoryId} onChange={e => setPay({...pay,categoryId:e.target.value})}><option value="">Seleccionar categoría</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Fecha de pago"><input type="date" max={today()} required className={inputClass} value={pay.paidAt} onChange={e => setPay({...pay,paidAt:e.target.value})}/></Field><p className="text-xs text-gray-500">Se creará un gasto en esa categoría, vinculado a esta obligación.</p><div className="flex justify-end gap-2"><button type="button" onClick={() => setPay(null)} className="rounded-lg border px-4 py-2 dark:border-gray-600 dark:text-white">Cancelar</button><button disabled={busy} className="rounded-lg bg-green-600 px-4 py-2 text-white">Confirmar pago</button></div></form></Modal>}
  </section>;
}

function Field({ label, children }) { return <label className="block"><span className={labelClass}>{label}</span>{children}</label>; }
function Modal({ title, onClose, children, wide = false }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className={`max-h-[92vh] w-full ${wide ? 'max-w-5xl' : 'max-w-xl'} overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-800`}><div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-bold dark:text-white">{title}</h3><button aria-label="Cerrar" onClick={onClose} className="text-gray-500"><X/></button></div>{children}</div></div>; }

export default function ExpenseWorkspaceSections({ section }) {
  if (section === 'servicios') return <ServiceSection/>;
  if (section === 'impuestos') return <TaxSection/>;
  return null;
}
