'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  formatDateTime,
  formatDuration,
  type DateField,
  type DurationKey,
  type FieldName,
  type WorkOrderRecord,
} from '@/lib/work-order';

type Column =
  | { key: FieldName; label: string; type: 'value' }
  | { key: DateField; label: string; type: 'date' }
  | { key: DurationKey; label: string; type: 'duration' }
  | { key: 'qualityFlag'; label: string; type: 'quality' };

const columns: Column[] = [
  { key: 'Case Number', label: 'Case Number', type: 'value' },
  { key: 'Work Order Number', label: 'Work Order Number', type: 'value' },
  { key: 'Asset', label: 'Asset', type: 'value' },
  { key: 'Service Region', label: 'Service Region', type: 'value' },
  { key: 'Country', label: 'Country', type: 'value' },
  { key: 'Modality', label: 'Modality', type: 'value' },
  { key: 'Priority', label: 'Priority', type: 'value' },
  { key: 'Main Engineer', label: 'Main Engineer', type: 'value' },
  { key: 'Service Crew Dispatcher', label: 'Service Crew Dispatcher', type: 'value' },
  { key: 'Order Dispatcher', label: 'Order Dispatcher', type: 'value' },
  { key: 'Work Order Type', label: 'WO Type', type: 'value' },
  { key: 'Work Order Subtype', label: 'WO Subtype', type: 'value' },
  { key: 'Created On', label: 'Created On', type: 'date' },
  { key: 'Dispatch Time', label: 'Dispatch Time', type: 'date' },
  { key: 'Departure Time', label: 'Departure Time', type: 'date' },
  { key: 'Arrival Time', label: 'Arrival Time', type: 'date' },
  { key: 'Work Order Closed Time', label: 'WO Closed Time', type: 'date' },
  { key: 'woToDispatch', label: 'WO → Dispatch', type: 'duration' },
  { key: 'dispatchToDeparture', label: 'Dispatch → Departure', type: 'duration' },
  { key: 'travelTime', label: 'Travel Time', type: 'duration' },
  { key: 'dispatchToArrival', label: 'Dispatch → Arrival', type: 'duration' },
  { key: 'Work Order Status', label: 'WO Status', type: 'value' },
  { key: 'qualityFlag', label: 'Data Quality Flag', type: 'quality' },
];

function rawSortValue(record: WorkOrderRecord, column: Column) {
  if (column.type === 'date') return record.dates[column.key]?.getTime() ?? null;
  if (column.type === 'duration') return record.durations[column.key];
  if (column.type === 'quality') return record.qualityFlag;
  return record.values[column.key] || null;
}

function cellContent(record: WorkOrderRecord, column: Column) {
  if (column.type === 'date') return formatDateTime(record.dates[column.key]);
  if (column.type === 'duration') return formatDuration(record.durations[column.key]);
  if (column.type === 'quality') {
    const qualityStyle = record.qualityFlag === 'OK'
      ? 'bg-emerald-50 text-emerald-700'
      : record.qualityFlag === 'Backfilled Dispatch'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-rose-50 text-rose-700';
    return (
      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${qualityStyle}`}>
        {record.qualityFlag}
      </span>
    );
  }
  return record.values[column.key] || '—';
}

export function WorkOrderTable({
  records,
  drilldownDate,
  onClearDrilldown,
}: {
  records: WorkOrderRecord[];
  drilldownDate?: string;
  onClearDrilldown?: () => void;
}) {
  const [sortKey, setSortKey] = useState<string>('woToDispatch');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const sorted = useMemo(() => {
    const column = columns.find((item) => item.key === sortKey) ?? columns[0];
    return [...records].sort((a, b) => {
      const left = rawSortValue(a, column);
      const right = rawSortValue(b, column);
      if (left == null && right == null) return a.id - b.id;
      if (left == null) return 1;
      if (right == null) return -1;
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? result : -result;
    });
  }, [records, sortDirection, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const sort = (key: string) => {
    if (key === sortKey) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Work Order Detail</h2>
          <p className="mt-1 text-xs text-slate-500">
            {drilldownDate ? `Created On ${drilldownDate} · ` : ''}Raw rows are retained · click any column title to sort
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {drilldownDate && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 px-2.5 py-1 font-semibold text-cyan-700">
              <CalendarDays className="h-3.5 w-3.5" />
              {drilldownDate}
              <button type="button" onClick={onClearDrilldown} aria-label="Clear chart date filter" className="ml-0.5 rounded-full p-0.5 hover:bg-cyan-100">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{records.length.toLocaleString()} rows</span>
          <span>Sorted by {columns.find((column) => column.key === sortKey)?.label}</span>
        </div>
      </div>
      <div className="max-h-[610px] overflow-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-xs">
          <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm">
            <tr>
              {columns.map((column) => (
                <th key={`${column.type}-${column.key}`} className="whitespace-nowrap border-b border-slate-200 px-3 py-3 font-semibold text-slate-600">
                  <button type="button" onClick={() => sort(column.key)} className="flex items-center gap-1.5 hover:text-slate-950">
                    {column.label}
                    {sortKey === column.key
                      ? sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      : <ArrowUpDown className="h-3 w-3 text-slate-300" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length ? pageRows.map((record) => (
              <tr key={record.id} className="odd:bg-white even:bg-slate-50/40 hover:bg-cyan-50/50">
                {columns.map((column) => (
                  <td key={`${record.id}-${column.type}-${column.key}`} className={`max-w-56 whitespace-nowrap border-b border-slate-100 px-3 py-2.5 text-slate-700 ${column.type === 'duration' ? 'font-medium tabular-nums' : ''}`} title={typeof cellContent(record, column) === 'string' ? String(cellContent(record, column)) : undefined}>
                    {cellContent(record, column)}
                  </td>
                ))}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-20 text-center text-sm text-slate-400">No work order rows match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        <span>{sorted.length ? `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, sorted.length)} of ${sorted.length}` : '0 rows'}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={safePage <= 1} onClick={() => setPage(Math.max(1, safePage - 1))} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-35"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-20 text-center">Page {safePage} of {pageCount}</span>
          <button type="button" disabled={safePage >= pageCount} onClick={() => setPage(Math.min(pageCount, safePage + 1))} className="rounded-lg border border-slate-200 p-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-35"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </section>
  );
}
