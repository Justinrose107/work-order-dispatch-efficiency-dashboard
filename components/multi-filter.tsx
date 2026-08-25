'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

interface MultiFilterProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

export function MultiFilter({ label, options, selected, onChange }: MultiFilterProps) {
  const [query, setQuery] = useState('');
  const displayValue = !selected.length
    ? 'All'
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selected`;
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return normalizedQuery
      ? options.filter((option) => option.toLocaleLowerCase().includes(normalizedQuery))
      : options;
  }, [options, query]);

  const toggle = (option: string) => {
    onChange(
      selected.includes(option)
        ? selected.filter((value) => value !== option)
        : [...selected, option],
    );
  };

  return (
    <details className="filter-details relative min-w-0">
      <summary className="flex h-[58px] list-none items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 text-left transition hover:border-slate-300 hover:shadow-sm">
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400" title={label}>{label}</span>
          <span className="mt-1 block truncate text-sm font-medium text-slate-700">{displayValue}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform" />
      </summary>
      <div className="absolute left-0 z-40 mt-2 w-64 overflow-clip rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <span className="text-xs font-semibold text-slate-500">{options.length} options</span>
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="text-xs font-semibold text-cyan-700 hover:text-cyan-800">Clear</button>
          )}
        </div>
        <div className="border-b border-slate-100 p-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-cyan-100">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type to search"
              aria-label={`Search ${label}`}
              className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label={`Clear ${label} search`} className="text-slate-400 hover:text-slate-700">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
        </div>
        <div className="max-h-64 overscroll-contain overflow-y-auto p-1.5">
          {visibleOptions.length ? visibleOptions.map((option) => {
            const checked = selected.includes(option);
            return (
              <label key={option} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <input type="checkbox" checked={checked} onChange={() => toggle(option)} className="sr-only" />
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-cyan-600 bg-cyan-600 text-white' : 'border-slate-300 bg-white'}`}>
                  {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span className="truncate" title={option}>{option}</span>
              </label>
            );
          }) : (
            <p className="px-3 py-4 text-center text-xs text-slate-400">{options.length ? 'No matching values' : 'No values in this file'}</p>
          )}
        </div>
      </div>
    </details>
  );
}
