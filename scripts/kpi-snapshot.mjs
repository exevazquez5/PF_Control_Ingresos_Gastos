#!/usr/bin/env node
// KPI snapshot (Fase 3.5a): captura los agregados del Dashboard (Total Ingresos / Total Gastos)
// para compararlos antes y despues del deploy. Node 20+, sin dependencias (fetch nativo).
//
// Uso:
//   $env:API_BASE_URL="https://<host>/api"; $env:API_TOKEN="<jwt>"; node scripts/kpi-snapshot.mjs [YYYY MM]
//
// El token se toma de las credenciales del usuario que lo corre (no se hardcodean).
// El JSON versionado se guarda en backups/kpi-snapshot-<stamp>.json y solo contiene
// agregados (sin descripciones ni datos personales; el userId se guarda hasheado).

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

const now = new Date();
const year = Number(process.argv[2]) || now.getFullYear();
const month = Number(process.argv[3]) || (now.getMonth() + 1);
if (month < 1 || month > 12) die('El mes debe estar entre 1 y 12');

async function get(path) {
  const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) die(`GET ${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

const num = (v) => Number(v) || 0;
// Redondeo a 2 decimales para evitar ruido de coma flotante (el orden de los
// endpoints no es determinista y no debe generar diffs falsos antes/despues).
const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const pick = (obj, ...keys) => {
  for (const k of keys) if (obj != null && obj[k] != null) return obj[k];
  return undefined;
};

const overview = await get('/Incomes/overview');
const monthExpenses = await get(`/Expenses/month/${month}/${year}`);
const cuotasPagadas = await get(`/Expenses/cuotas/pagadas/${userId}/${year}/${month}`);

const incomeMonths = Array.isArray(pick(overview, 'months', 'Months'))
  ? pick(overview, 'months', 'Months')
  : [];
const target = incomeMonths.find(
  (m) => Number(pick(m, 'year', 'Year')) === year && Number(pick(m, 'month', 'Month')) === month
);

const totals = {
  incomesMonthTotal: round2(num(pick(target, 'total', 'Total'))),
  incomesMonthGrossTotal: round2(num(pick(target, 'grossTotal', 'GrossTotal'))),
  incomesAllMonthsTotal: round2(incomeMonths.reduce((a, m) => a + num(pick(m, 'total', 'Total')), 0)),
  expensesMonthTotal: round2(monthExpenses.reduce((a, e) => a + num(pick(e, 'amount', 'Amount')), 0)),
  expensesMonthCount: monthExpenses.length,
  cuotasPagadasMonthTotal: round2(cuotasPagadas.reduce((a, c) => a + num(pick(c, 'montoCuota', 'MontoCuota')), 0)),
  cuotasPagadasMonthCount: cuotasPagadas.length
};

const snapshot = {
  generatedAt: new Date().toISOString(),
  period: { year, month },
  userHash: createHash('sha256').update(String(userId)).digest('hex').slice(0, 16),
  totals
};

const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const dir = resolve(root, 'backups');
mkdirSync(dir, { recursive: true });
const file = resolve(dir, `kpi-snapshot-${stamp}.json`);
writeFileSync(file, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

console.log('Snapshot KPI guardado en:', file);
console.log(JSON.stringify(snapshot.totals, null, 2));
