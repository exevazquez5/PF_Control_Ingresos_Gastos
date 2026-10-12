import { useEffect, useMemo, useRef, useState } from 'react';

// Select de categorías con búsqueda (reemplaza el <select> nativo del formulario).
export default function CategoryCombobox({ categories = [], type, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  const available = useMemo(
    () => categories.filter(c => c.type === type && !c.isArchived),
    [categories, type]
  );

  const selected = available.find(c => String(c.id) === String(value));

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.parentCategoryName || '').toLowerCase().includes(q)
    );
  }, [available, query]);

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

  const select = (c) => {
    onChange(c.id);
    setOpen(false);
    setQuery('');
  };

  const label = (c) =>
    `${c.icon ? `${c.icon} ` : ''}${c.name}${c.parentCategoryName ? ` (${c.parentCategoryName})` : ''}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left flex items-center justify-between gap-2 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
      >
        <span className={`truncate ${selected ? '' : 'text-gray-400'}`}>
          {selected ? label(selected) : 'Seleccionar categoría'}
        </span>
        <span className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar categoría..."
            className="w-full p-2.5 border-b border-gray-200 dark:border-gray-600 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
          <div className="max-h-56 overflow-y-auto">
            {matches.length === 0 && (
              <p className="p-3 text-sm text-gray-500 dark:text-gray-400">Sin categorías</p>
            )}
            {matches.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-gray-700 dark:text-white ${
                  String(c.id) === String(value) ? 'bg-blue-100 dark:bg-gray-700 font-medium' : ''
                }`}
              >
                {label(c)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
