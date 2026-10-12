// La condición "laboral" de una categoría viene exclusivamente del flag isLabor
// que administra el backend y que se edita en Ajustes → Categorías.
// Fase 3.5a: se eliminó la heurística por nombre (LABOR_NAMES).
export function isLaborCategory(category) {
  return !!(category && typeof category === 'object' && category.isLabor === true);
}
