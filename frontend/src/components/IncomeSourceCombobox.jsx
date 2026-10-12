import { useEffect, useMemo, useRef, useState } from 'react';

// Autocompletado de fuentes de ingreso (Fase 3): filtra por nombre y aliases.
// Seleccionar una fuente conocida emite { id, name, mode }; tipear un nombre nuevo emite onCustomName.
export default function IncomeSourceCombobox({ sources = [], value, sourceName, onChange, onCustomName }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  const selected = sources.find(s => String(s.id) === String(value));

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sources;
    return sources.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.aliases || []).some(a => a.toLowerCase().includes(q))
    );
  }, [sources, query]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const select = (s) => {
    onChange({ id: s.id, name: s.name, mode: s.mode || 'neto' });
    setOpen(false);
    setQuery('');
  };

  const label = selected ? selected.name : (sourceName || '');

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Fuente de ingreso"
        onClick={() => setOpen(o => !o)}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between gap-2 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
      >
        <span className={`truncate ${label ? '' : 'text-gray-400'}`}>
          {label || 'Buscar o crear fuente (opcional)'}
        </span>
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Mientras se tipea, se comporta como nombre libre (se crea o resuelve al guardar)
              onCustomName(e.target.value);
            }}
            placeholder="Buscar fuente..."
            className="w-full p-2.5 border-b border-gray-200 dark:border-gray-600 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
          <div className="max-h-56 overflow-y-auto">
            {matches.length === 0 && (
              <p className="p-3 text-sm text-gray-500 dark:text-gray-400">
                Sin fuentes — se creará al guardar
              </p>
            )}
            {matches.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => select(s)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-gray-700 dark:text-white ${
                  String(s.id) === String(value) ? 'bg-blue-100 dark:bg-gray-700 font-medium' : ''
                }`}
              >
                {s.name}
                {(s.aliases || []).length > 0 && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
                    ({s.aliases.join(', ')})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
