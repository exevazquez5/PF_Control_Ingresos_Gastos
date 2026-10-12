const LABOR_NAMES = [
  'salario',
  'sueldo',
  'freelance',
  'honorario',
  'honorarios',
  'bono',
  'bonos',
  'bonificacion',
  'bonificaciones',
  'comision',
  'comisiones',
  'propina',
  'propinas'
];

export function normalizeCategoryName(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Determina si una categoría es laboral (para mostrar el campo "Bruto del recibo", D4).
export function isLaborCategory(name) {
  const normalized = normalizeCategoryName(name);
  if (!normalized) return false;
  return LABOR_NAMES.some(l => normalized === l || normalized.startsWith(`${l} `));
}
