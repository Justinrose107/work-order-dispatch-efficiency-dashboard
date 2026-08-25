'use client';

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  MapPinCheck,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
  UsersRound,
  X,
} from 'lucide-react';
import type { DistributionPoint, TrendPoint } from '@/components/dashboard-charts';
import { MultiFilter } from '@/components/multi-filter';
import { WorkOrderTable } from '@/components/work-order-table';
import { importWorkOrderFile, type ImportResult } from '@/lib/import-data';
import {
  average,
  distinctCount,
  defaultWorkOrderTypeSelection,
  filterOptionValues,
  filterWorkOrderRecords,
  formatDuration,
  isBackfilledWorkOrder,
  localDateKey,
  workOrderMetricEntries,
  type DurationKey,
  type FieldName,
  type WorkOrderRecord,
} from '@/lib/work-order';

const DashboardCharts = dynamic(
  () => import('@/components/dashboard-charts').then((module) => module.DashboardCharts),
  {
    ssr: false,
    loading: () => <div className="h-[380px] animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />,
  },
);

const FILTER_FIELDS = [
  'Service Region',
  'Country',
  'Modality',
  'Priority',
  'Main Engineer',
  'Service Crew Dispatcher',
  'Work Order Type',
  'Work Order Subtype',
] as const satisfies readonly FieldName[];

type FilterField = (typeof FILTER_FIELDS)[number];
type Filters = Record<FilterField, string[]>;
type DashboardView = 'standard' | 'backfill';

const FILTER_LABELS: Record<FilterField, string> = {
  'Service Region': 'Service Region',
  Country: 'Country',
  Modality: 'Modality',
  Priority: 'Priority',
  'Main Engineer': 'Main Engineer',
  'Service Crew Dispatcher': 'Service Crew Dispatcher',
  'Work Order Type': 'Work Order Type',
  'Work Order Subtype': 'WO Subtype',
};

const emptyFilters = (): Filters => Object.fromEntries(
  FILTER_FIELDS.map((field) => [field, []]),
) as unknown as Filters;

function fileDateBounds(records: WorkOrderRecord[]) {
  const keys = records
    .map((record) => record.dates['Created On'])
    .filter((date): date is Date => Boolean(date))
    .map(localDateKey)
    .sort();
  return { min: keys[0] ?? '', max: keys.at(-1) ?? '' };
}

function metricSummary(records: WorkOrderRecord[], key: Parameters<typeof workOrderMetricEntries>[1]) {
  const entries = workOrderMetricEntries(records, key);
  return { value: average(entries.map((entry) => entry.value)), count: entries.length };
}

function dailyAverageTrend(records: WorkOrderRecord[], key: DurationKey): TrendPoint[] {
  const byDate = new Map<string, number[]>();
  for (const entry of workOrderMetricEntries(records, key)) {
    const created = entry.record.dates['Created On'];
    if (!created) continue;
    const date = localDateKey(created);
    byDate.set(date, [...(byDate.get(date) ?? []), entry.value]);
  }
  return Array.from(byDate.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, values]) => ({ date, average: average(values)!, count: values.length }));
}

function KpiCard({ label, value, note, icon, accent = false }: { label: string; value: string; note: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <article className={`group rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${accent ? 'border-cyan-300 ring-1 ring-cyan-100' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-h-9 text-[11px] font-semibold uppercase leading-4 tracking-[0.06em] text-slate-500">{label}</p>
        <span className={`rounded-lg p-2 ${accent ? 'bg-cyan-50 text-cyan-700' : 'bg-slate-50 text-slate-400'}`}>{icon}</span>
      </div>
      <p className="mt-3 text-[28px] font-semibold tracking-tight text-slate-950 tabular-nums">{value}</p>
      <p className="mt-1 truncate text-xs text-slate-400" title={note}>{note}</p>
    </article>
  );
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [dashboardView, setDashboardView] = useState<DashboardView>('standard');
  const [detailDate, setDetailDate] = useState('');

  const records = useMemo(() => imported?.records ?? [], [imported]);
  const dateBounds = useMemo(() => fileDateBounds(records), [records]);

  const options = useMemo(() => {
    const activeFilters = { dateFrom, dateTo, selections: filters };
    return Object.fromEntries(
      FILTER_FIELDS.map((field) => [
        field,
        filterOptionValues(records, activeFilters, field),
      ]),
    ) as Record<FilterField, string[]>;
  }, [dateFrom, dateTo, filters, records]);

  const filteredByUser = useMemo(() => filterWorkOrderRecords(records, {
    dateFrom,
    dateTo,
    selections: filters,
  }), [dateFrom, dateTo, filters, records]);

  const backfilledRecords = useMemo(
    () => filteredByUser.filter(isBackfilledWorkOrder),
    [filteredByUser],
  );
  const standardRecords = useMemo(
    () => filteredByUser.filter((record) => !isBackfilledWorkOrder(record)),
    [filteredByUser],
  );
  const filteredRecords = dashboardView === 'backfill' ? backfilledRecords : standardRecords;
  const detailRecords = useMemo(() => (
    detailDate
      ? filterWorkOrderRecords(filteredRecords, { dateFrom: detailDate, dateTo: detailDate })
      : filteredRecords
  ), [detailDate, filteredRecords]);

  const metrics = useMemo(() => ({
    woToDispatch: metricSummary(filteredRecords, 'woToDispatch'),
    dispatchToDeparture: metricSummary(filteredRecords, 'dispatchToDeparture'),
    travelTime: metricSummary(filteredRecords, 'travelTime'),
    dispatchToArrival: metricSummary(filteredRecords, 'dispatchToArrival'),
  }), [filteredRecords]);

  const woToDispatchTrend = useMemo<TrendPoint[]>(
    () => dailyAverageTrend(filteredRecords, 'woToDispatch'),
    [filteredRecords],
  );
  const dispatchToArrivalTrend = useMemo<TrendPoint[]>(
    () => dailyAverageTrend(filteredRecords, 'dispatchToArrival'),
    [filteredRecords],
  );

  const distribution = useMemo<DistributionPoint[]>(() => {
    const bins = [
      { band: '≤10 min', test: (value: number) => value <= 10 },
      { band: '10–30 min', test: (value: number) => value > 10 && value <= 30 },
      { band: '30–60 min', test: (value: number) => value > 30 && value <= 60 },
      { band: '1–2 h', test: (value: number) => value > 60 && value <= 120 },
      { band: '>2 h', test: (value: number) => value > 120 },
    ];
    const values = workOrderMetricEntries(filteredRecords, 'woToDispatch').map((entry) => entry.value);
    return bins.map((bin) => {
      const count = values.filter(bin.test).length;
      return { band: bin.band, count, percentage: values.length ? count / values.length * 100 : 0 };
    });
  }, [filteredRecords]);

  const timeDataErrors = filteredRecords.filter((record) => record.qualityFlag === 'Time Data Error').length;
  const dispatcherDataErrors = filteredRecords.filter((record) => record.qualityFlag === 'Dispatcher Data Error').length;
  const selectedFilterCount = FILTER_FIELDS.reduce((sum, field) => sum + filters[field].length, 0);
  const requiredFields = ['Case Number', 'Work Order Number', 'Created On', 'Dispatch Time'] as const;
  const missingRequired = imported
    ? requiredFields.filter((field) => !imported.recognizedFields.includes(field))
    : [];
  const missingDispatcherFields = imported
    ? !imported.recognizedFields.includes('Service Crew Dispatcher')
      && !imported.recognizedFields.includes('Order Dispatcher')
    : false;

  const defaultFiltersFor = (nextRecords: WorkOrderRecord[]) => {
    const next = emptyFilters();
    next['Work Order Type'] = defaultWorkOrderTypeSelection(nextRecords);
    return next;
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setIsImporting(true);
    setError('');
    try {
      const result = await importWorkOrderFile(file);
      const bounds = fileDateBounds(result.records);
      setImported(result);
      setFileName(file.name);
      setFilters(defaultFiltersFor(result.records));
      setDateFrom(bounds.min);
      setDateTo(bounds.max);
      setDashboardView('standard');
      setDetailDate('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The file could not be imported.');
    } finally {
      setIsImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const resetFilters = () => {
    setFilters(defaultFiltersFor(records));
    setDateFrom(dateBounds.min);
    setDateTo(dateBounds.max);
    setDetailDate('');
  };

  const clearFile = () => {
    setImported(null);
    setFileName('');
    setFilters(emptyFilters());
    setDateFrom('');
    setDateTo('');
    setError('');
    setDashboardView('standard');
    setDetailDate('');
  };

  const drillIntoDate = (date: string) => {
    setDetailDate(date);
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const subtitle = records.length
    ? `${dateFrom || 'Earliest'} → ${dateTo || 'Latest'} · ${filteredRecords.length.toLocaleString()} ${dashboardView === 'backfill' ? 'backfilled' : 'standard'} rows`
    : 'Import Excel or CSV data to calculate dispatch efficiency locally';

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-slate-950">
      <header className="border-b border-white/10 bg-[#0b1f3a] text-white">
        <div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-4 px-5 py-5 sm:flex-row sm:items-center lg:px-8">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Service Operations</p>
            <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">Work Order Dispatch Efficiency Dashboard</h1>
            <p className="mt-1 text-sm text-slate-300">{subtitle}</p>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Data stays in this browser
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] space-y-5 px-5 py-5 lg:px-8 lg:py-6">
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />

        {!records.length ? (
          <section
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { event.preventDefault(); if (event.currentTarget === event.target) setIsDragging(false); }}
            onDrop={(event) => { event.preventDefault(); setIsDragging(false); handleFile(event.dataTransfer.files?.[0]); }}
            className={`flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-6 py-8 text-center shadow-sm transition ${isDragging ? 'border-cyan-500 bg-cyan-50/60' : 'border-slate-300 hover:border-cyan-400'}`}
          >
            <span className="rounded-2xl bg-cyan-50 p-3 text-cyan-700"><UploadCloud className="h-7 w-7" /></span>
            <h2 className="mt-4 text-lg font-semibold">Import work order data</h2>
            <p className="mt-1 max-w-lg text-sm text-slate-500">Drop an Excel or CSV file here. Supported fields and common date formats are detected automatically—no manual mapping needed.</p>
            <button type="button" disabled={isImporting} onClick={() => inputRef.current?.click()} className="mt-5 rounded-lg bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800 disabled:opacity-60">
              {isImporting ? 'Importing…' : 'Choose Excel or CSV'}
            </button>
            <p className="mt-3 text-xs text-slate-400">.xlsx · .xls · .csv</p>
          </section>
        ) : (
          <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><FileSpreadsheet className="h-5 w-5" /></span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-semibold text-slate-900" title={fileName}>{fileName}</h2>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{imported?.rawRowCount.toLocaleString()} rows · {imported?.recognizedFields.length} fields recognized · sheet “{imported?.sheetName}”</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Replace file</button>
              <button type="button" onClick={clearFile} aria-label="Remove imported file" className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
          </section>
        )}

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {records.length > 0 && missingRequired.length > 0 && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Missing core field{missingRequired.length > 1 ? 's' : ''}: {missingRequired.join(', ')}. Available metrics remain usable; affected values show N/A.</span>
          </div>
        )}
        {records.length > 0 && missingDispatcherFields && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Neither Service Crew Dispatcher nor Order Dispatcher was found. These rows are marked as Dispatcher Data Error and excluded from KPIs and charts.</span>
          </div>
        )}

        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="px-1">
            <h2 className="text-sm font-semibold text-slate-900">Dashboard view</h2>
            <p className="mt-0.5 text-xs text-slate-500">Separate standard dispatch flow from cases recorded after field activity</p>
          </div>
          <div role="tablist" aria-label="Dashboard view" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              role="tab"
              aria-selected={dashboardView === 'standard'}
              onClick={() => { setDashboardView('standard'); setDetailDate(''); }}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${dashboardView === 'standard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Standard cases
              <span className="rounded-full bg-slate-200/80 px-2 py-0.5 tabular-nums">{standardRecords.length.toLocaleString()}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dashboardView === 'backfill'}
              onClick={() => { setDashboardView('backfill'); setDetailDate(''); }}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${dashboardView === 'backfill' ? 'bg-amber-50 text-amber-800 shadow-sm ring-1 ring-amber-200' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <History className="h-4 w-4" />
              Backfilled cases
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 tabular-nums">{backfilledRecords.length.toLocaleString()}</span>
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
              <p className="mt-0.5 text-xs text-slate-500">All metrics, charts, and detail rows update together</p>
            </div>
            <button type="button" disabled={!records.length} onClick={resetFilters} className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
              <RotateCcw className="h-3.5 w-3.5" /> Reset filters {selectedFilterCount > 0 && `(${selectedFilterCount})`}
            </button>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-10">
            <label className="grid h-[58px] grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 xl:col-span-2">
              <span className="col-span-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Created On range</span>
              <input type="date" value={dateFrom} min={dateBounds.min} max={dateTo || dateBounds.max} disabled={!dateBounds.min} onChange={(event) => { setDateFrom(event.target.value); setDetailDate(''); }} aria-label="Created On start date" className="min-w-0 bg-transparent text-xs font-medium text-slate-700 outline-none disabled:text-slate-300" />
              <input type="date" value={dateTo} min={dateFrom || dateBounds.min} max={dateBounds.max} disabled={!dateBounds.max} onChange={(event) => { setDateTo(event.target.value); setDetailDate(''); }} aria-label="Created On end date" className="min-w-0 border-l border-slate-200 bg-transparent pl-2 text-xs font-medium text-slate-700 outline-none disabled:text-slate-300" />
            </label>
            {FILTER_FIELDS.map((field) => (
              <MultiFilter key={field} label={FILTER_LABELS[field]} options={options[field]} selected={filters[field]} onChange={(values) => { setFilters((current) => ({ ...current, [field]: values })); setDetailDate(''); }} />
            ))}
          </div>
        </section>

        <section className={`grid gap-3 sm:grid-cols-2 ${dashboardView === 'backfill' ? 'xl:grid-cols-4' : 'lg:grid-cols-3 xl:grid-cols-6'}`}>
          <KpiCard label="Total Cases" value={distinctCount(filteredRecords, 'Case Number').toLocaleString()} note="Distinct Case Number" icon={<UsersRound className="h-4 w-4" />} />
          <KpiCard label="Total Work Orders" value={distinctCount(filteredRecords, 'Work Order Number').toLocaleString()} note="Distinct Work Order Number" icon={<BriefcaseBusiness className="h-4 w-4" />} />
          <KpiCard accent label="Average WO → Dispatch" value={formatDuration(metrics.woToDispatch.value)} note={`${metrics.woToDispatch.count} valid work orders`} icon={<Clock3 className="h-4 w-4" />} />
          {dashboardView === 'standard' && <KpiCard label="Average Dispatch → Departure" value={formatDuration(metrics.dispatchToDeparture.value)} note={`${metrics.dispatchToDeparture.count} valid work orders`} icon={<Clock3 className="h-4 w-4" />} />}
          <KpiCard label="Average Travel Time" value={formatDuration(metrics.travelTime.value)} note={`${metrics.travelTime.count} valid work orders`} icon={<MapPinCheck className="h-4 w-4" />} />
          {dashboardView === 'standard' && <KpiCard label="Average Dispatch → Arrival" value={formatDuration(metrics.dispatchToArrival.value)} note={`${metrics.dispatchToArrival.count} valid work orders`} icon={<MapPinCheck className="h-4 w-4" />} />}
        </section>

        {records.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-500 shadow-sm">
            <span className="font-semibold text-slate-700">{dashboardView === 'backfill' ? 'Backfill scope' : 'Data quality'}</span>
            <span>{filteredRecords.length.toLocaleString()} visible source rows</span>
            <span className="h-3 w-px bg-slate-200" />
            {dashboardView === 'backfill' ? (
              <>
                <span className="font-medium text-amber-700">Includes field activity before Dispatch and Arrival earlier than Departure</span>
                <span className="text-slate-400">WO-to-Dispatch and valid Travel Time are calculated independently.</span>
              </>
            ) : (
              <>
                <span className={timeDataErrors ? 'font-medium text-rose-700' : 'text-emerald-700'}>{timeDataErrors.toLocaleString()} rows with Time Data Error</span>
                <span className="text-slate-400">{backfilledRecords.length.toLocaleString()} backfilled rows are separated into the Backfilled cases view.</span>
              </>
            )}
            <span className={dispatcherDataErrors ? 'font-medium text-rose-700' : 'text-emerald-700'}>{dispatcherDataErrors.toLocaleString()} rows with Dispatcher Data Error</span>
            <span className="text-slate-400">Dispatcher errors remain visible in detail but are excluded from all calculations.</span>
          </div>
        )}

        <DashboardCharts
          woToDispatchTrend={woToDispatchTrend}
          dispatchToArrivalTrend={dashboardView === 'standard' ? dispatchToArrivalTrend : undefined}
          distribution={distribution}
          selectedWoToDispatchDate={detailDate}
          onWoToDispatchDateClick={drillIntoDate}
        />
        <div ref={detailRef} className="scroll-mt-4">
          <WorkOrderTable
            key={`${dashboardView}-${detailDate || 'all'}`}
            records={detailRecords}
            drilldownDate={detailDate}
            onClearDrilldown={() => setDetailDate('')}
          />
        </div>
      </div>
    </main>
  );
}
