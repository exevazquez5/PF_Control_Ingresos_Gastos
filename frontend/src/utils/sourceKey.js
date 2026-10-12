const MONTH_NAMES = 'ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic';

export function normalizeText(value) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Clave de fuente derivada al vuelo desde la descripción del ingreso.
// Se usa para agrupar pagos del mismo origen ("Sueldo enero" + "Sueldo febrero" → "sueldo").
export function deriveSourceKey(description) {
  const normalized = normalizeText(description);
  if (!normalized) return '';

  const cleaned = normalized
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(new RegExp(`\\b(${MONTH_NAMES})[a-z]*\\b`, 'g'), ' ')
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || normalized.trim();
}

export function formatSourceLabel(key) {
  if (!key) return '';
  return key.charAt(0).toUpperCase() + key.slice(1);
}

// Etiqueta de fuente de un ingreso: usa el nombre persistido (Fase 3) o deriva de la descripción (legado).
export function sourceLabel(income) {
  if (income?.sourceName) return income.sourceName;
  return formatSourceLabel(deriveSourceKey(income?.description)) || '';
}
