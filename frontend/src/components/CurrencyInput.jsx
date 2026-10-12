import { useState } from 'react';

function sanitize(raw) {
  const v = String(raw ?? '').replace(/[^\d.,]/g, '');
  if (!v) return '';

  const lastComma = v.lastIndexOf(',');
  const lastDot = v.lastIndexOf('.');
  const sepIndex = Math.max(lastComma, lastDot);

  if (sepIndex < 0) return v.replace(/[.,]/g, '');

  const intPart = v.slice(0, sepIndex).replace(/[.,]/g, '');
  const decPart = v.slice(sepIndex + 1).replace(/[.,]/g, '').slice(0, 2);
  return decPart ? `${intPart}.${decPart}` : `${intPart}.`;
}

function formatEsAr(raw) {
  if (raw === '' || raw == null) return '';
  const [intPart, decPart] = String(raw).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart !== undefined ? `${grouped},${decPart}` : grouped;
}

// Input de monto en formato ARS. Mientras tiene el foco muestra el valor
// crudo (sin separadores de miles) para que la tipeada sea lineal; al perder
// el foco muestra "1.234,56". onValueChange siempre reporta numérico puro
// con punto decimal ("1234.56"), listo para parseFloat() en los payloads.
export default function CurrencyInput({ value, onValueChange, className = '', onFocus, onBlur, ...rest }) {
  const [focused, setFocused] = useState(false);
  const raw = value === '' || value == null ? '' : String(value);
  const display = focused ? raw : formatEsAr(raw);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(e) => onValueChange(sanitize(e.target.value))}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      className={className}
    />
  );
}
