#!/usr/bin/env node
// KPI snapshot (Fase 3.5a): captura los agregados del Dashboard por mes
// (Total Ingresos, Total Gastos y Balance) para compararlos antes/despues del deploy.
// Node 20+, sin dependencias (fetch nativo).
//
// Reproduce exactamente los KPIs del Dashboard:
//   - Total Ingresos (mes) = suma de ingreso.Amount del mes (endpoint /Incomes/overview -> Months[].Total)
//   - Total Gastos   (mes) = suma de gastos directos (tieneCuotas=false) + suma de cuotas pagadas del mes
//   - Balance        (mes) = Total Ingresos - Total Gastos
//
// Orden estable: cada endpoint se ordena por id antes de sumar, de modo que la suma
// sea determinista y la comparacion sea EXACTA (sin redondeo) entre ejecuciones.
//
// Uso:
//   $env:API_BASE_URL="https://<host>/api"; $env:API_TOKEN="<jwt>"
//   node scripts/kpi-snapshot.mjs [--label=main|branch] [YYYY-MM ...]
//
//   - Sin meses: usa todos los meses del overview (rango continuo desde el primer
//     ingreso) y garantiza, como minimo, jul-oct 2026.
//   - El token se toma de las credenciales del usuario que lo corre (no se hardcodea).
//   - El JSON se guarda en backups/kpi-snapshot[-<label>]-<stamp>.json y solo contiene
//     agregados (sin descripciones ni datos personales; el userId se guarda hasheado).

import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const baseUrl = (process.env.API_BASE_URL || '').replace(/\/+$/, '');
const token = process.env.API_TOKEN || '';
if (!baseUrl) die('Falta la variable de entorno API_BASE_URL');
if (!token) die('Falta la variable de entorno API_TOKEN');

function die(msg) {
  console.error('Error: ' + msg);
  process.exit(1);
}

function decodeUserId(jwt) {
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  let payload;
  try { payload = JSON.parse(json); } catch { return null; }
  const claim = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
    ?? payload.nameid ?? payload.sub;
  const id = Number(claim);
  return Number.isFinite(id) ? id : null;
}

const userId = decodeUserId(token);
if (!userId) die('No se pudo decodificar el userId del token (claim nameidentifier)');

// --- CLI: --label=NAME y meses YYYY-MM ---
let label = null;
const monthArgs = [];
for (const arg of process.argv.slice(2)) {
  const labelMatch = /^--label=(.+)$/.exec(arg);
  if (labelMatch) { label = labelMatch[1].trim(); continue; }
  const monthMatch = /^(\d{4})-(\d{1,2})$/.exec(arg);
  if (monthMatch) {
    const y = Number(monthMatch[1]);
    const m = Number(monthMatch[2]);
    if (m < 1 || m > 12) die(`Mes invalido en "${arg}"`);
    monthArgs.push({ year: y, month: m });
    continue;
  }
  die(`Argumento no reconocido: ${arg}`);
}

// Minimo garantizado (requerido por el PR): jul-oct 2026.
const REQUIRED_MONTHS = [
  { year: 2026, month: 7 },
  { year: 2026, month: 8 },
  { year: 2026, month: 9 },
  { year: 2026, month: 10 }
];

async function get(path) {
  const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) die(`GET ${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

const pick = (obj, ...keys) => {
  for (const k of keys) if (obj != null && obj[k] != null) return obj[k];
  return undefined;
};
const num = (v) => Number(v) || 0;
// Orden estable por id antes de sumar: la suma es determinista aunque el endpoint
// no garantice un orden. Evita ruido de coma flotante sin redondear (comparacion exacta).
const byIdAsc = (a, b) => num(pick(a, 'id', 'Id')) - num(pick(b, 'id', 'Id'));
const sumBy = (list, field) => [...list].sort(byIdAsc).reduce((acc, x) => acc + num(pick(x, field)), 0);
const monthKey = (y, m) => `${y}-${String(m).padStart(2, '0')}`;

const now = new Date();

const overview = await get('/Incomes/overview');
const incomeMonths = Array.isArray(pick(overview, 'months', 'Months')) ? pick(overview, 'months', 'Months') : [];
const incomeByKey = new Map();
for (const m of incomeMonths) {
  const y = Number(pick(m, 'year', 'Year'));
  const mo = Number(pick(m, 'month', 'Month'));
  incomeByKey.set(monthKey(y, mo), {
    totalIngresos: num(pick(m, 'total', 'Total')),
    grossTotal: num(pick(m, 'grossTotal', 'GrossTotal'))
  });
}

// Set de meses a evaluar: meses explicitos, o (overview ∪ requeridos).
let months;
if (monthArgs.length > 0) {
  months = dedupeMonths(monthArgs);
} else {
  const fromOverview = incomeMonths.map((m) => ({
    year: Number(pick(m, 'year', 'Year')),
    month: Number(pick(m, 'month', 'Month'))
  }));
  months = dedupeMonths([...fromOverview, ...REQUIRED_MONTHS]);
}

const requiredKeys = new Set(REQUIRED_MONTHS.map((m) => monthKey(m.year, m.month)));

const rows = [];
for (const { year, month } of months) {
  const key = monthKey(year, month);
  const [expenses, cuotas] = await Promise.all([
    get(`/Expenses/month/${month}/${year}`),
    get(`/Expenses/cuotas/pagadas/${userId}/${year}/${month}`)
  ]);

  // Gastos directos: el Dashboard excluye los gastos con cuotas (tieneCuotas === false)
  // y suma aparte las cuotas pagadas del mes.
  const directExpenses = (Array.isArray(expenses) ? expenses : [])
    .filter((e) => pick(e, 'tieneCuotas', 'TieneCuotas') === false);
  const directTotal = sumBy(directExpenses, 'amount');

  const cuotasList = Array.isArray(cuotas) ? cuotas : [];
  const cuotasTotal = sumBy(cuotasList, 'montoCuota');

  const totalIngresos = incomeByKey.get(key)?.totalIngresos ?? 0;
  const totalGastos = directTotal + cuotasTotal;
  const balance = totalIngresos - totalGastos;

  rows.push({
    year,
    month,
    totalIngresos,
    totalGastos,
    gastosDirectos: directTotal,
    cuotasPagadas: cuotasTotal,
    balance,
    hasData: totalIngresos !== 0 || totalGastos !== 0
  });
}

// "Todos los meses con datos" + garantia de incluir los meses requeridos.
const monthsOut = rows
  .filter((r) => r.hasData || requiredKeys.has(monthKey(r.year, r.month)))
  .sort((a, b) => (a.year - b.year) || (a.month - b.month))
  .map(({ hasData, ...r }) => r);

const totals = monthsOut.reduce(
  (acc, r) => ({
    totalIngresos: acc.totalIngresos + r.totalIngresos,
    totalGastos: acc.totalGastos + r.totalGastos,
    cuotasPagadas: acc.cuotasPagadas + r.cuotasPagadas,
    balance: acc.balance + r.balance
  }),
  { totalIngresos: 0, totalGastos: 0, cuotasPagadas: 0, balance: 0 }
);

const snapshot = {
  generatedAt: new Date().toISOString(),
  revision: label || null,
  userHash: createHash('sha256').update(String(userId)).digest('hex').slice(0, 16),
  months: monthsOut,
  totals
};

function dedupeMonths(list) {
  const seen = new Map();
  for (const { year, month } of list) {
    if (!Number.isFinite(year) || !Number.isFinite(month)) continue;
    seen.set(monthKey(year, month), { year, month });
  }
  return [...seen.values()];
}

const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const dir = resolve(root, 'backups');
mkdirSync(dir, { recursive: true });
const name = `kpi-snapshot${label ? '-' + label : ''}-${stamp}.json`;
const file = resolve(dir, name);
writeFileSync(file, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

console.log('Snapshot KPI guardado en:', file);
if (label) console.log('Revision:', label);
console.log('Meses:');
for (const r of snapshot.months) {
  console.log(
    `  ${monthKey(r.year, r.month)}  Ingresos=${r.totalIngresos}  Gastos=${r.totalGastos}` +
    `  (directos=${r.gastosDirectos} + cuotas=${r.cuotasPagadas})  Balance=${r.balance}`
  );
}
console.log('TOTALES:', JSON.stringify(snapshot.totals));
