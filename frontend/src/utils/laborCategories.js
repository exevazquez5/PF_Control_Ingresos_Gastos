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
// Acepta la categoría completa (usa el join isLabor del backend) o solo el nombre (legado/tests).
export function isLaborCategory(categoryOrName) {
  if (categoryOrName && typeof categoryOrName === 'object') {
    if (typeof categoryOrName.isLabor === 'boolean') return categoryOrName.isLabor;
    return isLaborName(categoryOrName.name);
  }
  return isLaborName(categoryOrName);
}

function isLaborName(name) {
  const normalized = normalizeCategoryName(name);
  if (!normalized) return false;
  return LABOR_NAMES.some(l => normalized === l || normalized.startsWith(`${l} `));
}
