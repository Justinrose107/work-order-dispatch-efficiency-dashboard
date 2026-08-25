'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartNoAxesCombined } from 'lucide-react';
import { formatDuration } from '@/lib/work-order';

export interface TrendPoint {
  date: string;
  average: number;
  count: number;
}

export interface DistributionPoint {
  band: string;
  count: number;
  percentage: number;
}

const axisStyle = { fontSize: 11, fill: '#64748b' };

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[285px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
      <span className="mb-3 rounded-xl bg-white p-3 text-slate-400 shadow-sm"><ChartNoAxesCombined className="h-5 w-5" /></span>
      <p className="text-sm font-medium text-slate-500">{message}</p>
      <p className="mt-1 text-xs text-slate-400">Missing and invalid durations are excluded</p>
    </div>
  );
}

function DistributionTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DistributionPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-800">{point.band}</p>
      <p className="mt-1 text-slate-600">{point.count.toLocaleString()} work orders</p>
      <p className="text-slate-500">{point.percentage.toFixed(1)}% of valid WOs</p>
    </div>
  );
}

function TrendCard({ title, trend, color }: { title: string; trend: TrendPoint[]; color: string }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex min-h-[76px] items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-semibold leading-5 text-slate-900">{title}</h2>
          <p className="mt-1 text-xs text-slate-500">Daily average · valid work orders only</p>
        </div>
        <span className="shrink-0 rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-700">Created On</span>
      </div>
      <div className="p-4 pt-5">
        {!trend.length ? <EmptyChart message="No valid trend data for the current filters" /> : (
          <div className="h-[285px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 14, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#e8eef5" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#dbe3ec' }} minTickGap={28} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={56} tickFormatter={(value) => formatDuration(Number(value))} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, borderColor: '#dbe3ec', boxShadow: '0 8px 24px rgb(15 23 42 / 8%)', fontSize: 12 }}
                  formatter={(value, _name, item) => [formatDuration(Number(value)), `Average (${item.payload.count} WO${item.payload.count === 1 ? '' : 's'})`]}
                  labelStyle={{ color: '#334155', fontWeight: 600, marginBottom: 4 }}
                />
                <Line type="monotone" dataKey="average" stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </article>
  );
}

export function DashboardCharts({ woToDispatchTrend, dispatchToArrivalTrend, distribution }: { woToDispatchTrend: TrendPoint[]; dispatchToArrivalTrend?: TrendPoint[]; distribution: DistributionPoint[] }) {
  const totalValid = distribution.reduce((sum, point) => sum + point.count, 0);
  const showDispatchToArrival = dispatchToArrivalTrend !== undefined;
  return (
    <section className={`grid gap-5 ${showDispatchToArrival ? 'xl:grid-cols-3' : 'lg:grid-cols-2'}`}>
      <TrendCard title="Average WO-to-Dispatch Time Trend" trend={woToDispatchTrend} color="#0891b2" />
      {showDispatchToArrival && (
        <TrendCard title="Average Dispatch-to-Arrival Time Trend" trend={dispatchToArrivalTrend} color="#4f46e5" />
      )}

      <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex min-h-[76px] items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">WO-to-Dispatch Time Distribution</h2>
            <p className="mt-1 text-xs text-slate-500">Work order count by duration band</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{totalValid} valid</span>
        </div>
        <div className="p-4 pt-5">
          {!totalValid ? <EmptyChart message="No valid durations for the current filters" /> : (
            <div className="h-[285px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid stroke="#e8eef5" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="band" tick={axisStyle} tickLine={false} axisLine={{ stroke: '#dbe3ec' }} />
                  <YAxis allowDecimals={false} tick={axisStyle} tickLine={false} axisLine={false} />
                  <Tooltip content={<DistributionTooltip />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="count" fill="#0e7490" radius={[5, 5, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
