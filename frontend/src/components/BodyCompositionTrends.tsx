import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { MeasurementSession } from '../types/telemetry';
import { Sliders, Calendar } from 'lucide-react';

interface BodyCompositionTrendsProps {
  data: MeasurementSession[];
  isLoading: boolean;
}

interface ChartDataPoint {
  timestamp: number;
  dateStr: string;
  weight_kg?: number;
  fat_kg?: number;
  muscle_kg?: number;
  weight_ma?: number;
  fat_ma?: number;
  muscle_ma?: number;
}

/**
 * Computes integer tick intervals (e.g. 1kg, 2kg, 5kg) for a metric range.
 * Does not force 0 onto the axis.
 */
function computeAxisBounds(values: number[]): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) {
    return { domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100] };
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = rawMax - rawMin;

  // Determine an integer step size (1, 2, or 5)
  let step = 1;
  if (range > 25) {
    step = 5;
  } else if (range > 12) {
    step = 2;
  } else {
    step = 1;
  }

  // Add 1 step padding on bottom and top
  const minBound = Math.floor(rawMin / step) * step - step;
  const maxBound = Math.ceil(rawMax / step) * step + step;

  const ticks: number[] = [];
  for (let t = minBound; t <= maxBound; t += step) {
    ticks.push(t);
  }

  return { domain: [minBound, maxBound], ticks };
}

export const BodyCompositionTrends: React.FC<BodyCompositionTrendsProps> = ({
  data,
  isLoading,
}) => {
  const [rollingDays, setRollingDays] = useState<number>(7);

  // 1. Filter, deduplicate, compute rolling averages, and window to 6 months
  const { chartData, timeBounds, weightBounds, fatBounds, muscleBounds } = useMemo(() => {
    // Drop records without valid positive weight
    const valid = data.filter((row) => row.weight_kg != null && row.weight_kg > 0);

    // Deduplicate by timestamp
    const sessionMap = new Map<number, MeasurementSession>();
    for (const row of valid) {
      const existing = sessionMap.get(row.timestamp);
      const rawFat =
        row.fat_mass_weight_kg ??
        (row.weight_kg != null && row.fat_ratio_pct != null
          ? Number(((row.weight_kg * row.fat_ratio_pct) / 100).toFixed(2))
          : undefined);

      // Invalidate zeros
      const resolvedFat = rawFat != null && rawFat > 0 ? rawFat : undefined;
      const resolvedMuscle =
        row.muscle_mass_kg != null && row.muscle_mass_kg > 0
          ? row.muscle_mass_kg
          : undefined;

      if (!existing) {
        sessionMap.set(row.timestamp, {
          ...row,
          fat_mass_weight_kg: resolvedFat,
          muscle_mass_kg: resolvedMuscle,
        });
      } else {
        sessionMap.set(row.timestamp, {
          ...existing,
          weight_kg: existing.weight_kg ?? row.weight_kg,
          fat_mass_weight_kg: existing.fat_mass_weight_kg ?? resolvedFat,
          muscle_mass_kg: existing.muscle_mass_kg ?? resolvedMuscle,
        });
      }
    }

    const chronological = Array.from(sessionMap.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );

    const windowSeconds = rollingDays * 86400;

    // Build raw points with rolling averages across the entire series
    const allProcessed = chronological.map((current, _, arr) => {
      const windowStart = current.timestamp - windowSeconds;

      const windowRecords = arr.filter(
        (r) => r.timestamp >= windowStart && r.timestamp <= current.timestamp
      );

      const calcAverage = (accessor: (r: MeasurementSession) => number | undefined) => {
        const vals = windowRecords
          .map(accessor)
          .filter((v): v is number => v != null && v > 0);
        if (vals.length === 0) return undefined;
        return Number((vals.reduce((sum, v) => sum + v, 0) / vals.length).toFixed(2));
      };

      const date = new Date(current.timestamp * 1000);
      const dateStr = date.toLocaleDateString('en-GB', {
        timeZone: 'Europe/London',
        day: '2-digit',
        month: 'short',
      });

      return {
        timestamp: current.timestamp,
        dateStr,
        weight_kg: current.weight_kg != null && current.weight_kg > 0 ? Number(current.weight_kg.toFixed(2)) : undefined,
        fat_kg: current.fat_mass_weight_kg != null && current.fat_mass_weight_kg > 0 ? Number(current.fat_mass_weight_kg.toFixed(2)) : undefined,
        muscle_kg: current.muscle_mass_kg != null && current.muscle_mass_kg > 0 ? Number(current.muscle_mass_kg.toFixed(2)) : undefined,
        weight_ma: calcAverage((r) => r.weight_kg),
        fat_ma: calcAverage((r) => r.fat_mass_weight_kg),
        muscle_ma: calcAverage((r) => r.muscle_mass_kg),
      };
    });

    // Constrain to last 6 months (183 days)
    const latestTimestamp = allProcessed.length > 0
      ? allProcessed[allProcessed.length - 1].timestamp
      : Math.floor(Date.now() / 1000);
    const sixMonthsAgo = latestTimestamp - 183 * 86400;

    const filtered = allProcessed.filter((p) => p.timestamp >= sixMonthsAgo);

    // Collect all valid values within window to compute custom integer bounds
    const weightVals: number[] = [];
    const fatVals: number[] = [];
    const muscleVals: number[] = [];

    for (const p of filtered) {
      if (p.weight_kg != null) weightVals.push(p.weight_kg);
      if (p.weight_ma != null) weightVals.push(p.weight_ma);
      if (p.fat_kg != null) fatVals.push(p.fat_kg);
      if (p.fat_ma != null) fatVals.push(p.fat_ma);
      if (p.muscle_kg != null) muscleVals.push(p.muscle_kg);
      if (p.muscle_ma != null) muscleVals.push(p.muscle_ma);
    }

    return {
      chartData: filtered,
      timeBounds: [sixMonthsAgo, latestTimestamp] as [number, number],
      weightBounds: computeAxisBounds(weightVals),
      fatBounds: computeAxisBounds(fatVals),
      muscleBounds: computeAxisBounds(muscleVals),
    };
  }, [data, rollingDays]);

  // Format epoch timestamps for the synchronized X-Axis
  const formatXAxis = (epoch: number) => {
    return new Date(epoch * 1000).toLocaleDateString('en-GB', {
      timeZone: 'Europe/London',
      day: '2-digit',
      month: 'short',
    });
  };

  if (isLoading) {
    return (
      <div className="w-full h-96 rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-center text-slate-400">
        Loading 6-month telemetry timeline...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Control Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-slate-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Rolling Average Window:
          </span>
          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-xs font-bold border border-blue-200">
            {rollingDays} Days
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-72">
          <span className="text-[11px] font-mono text-slate-400">3d</span>
          <input
            type="range"
            min="3"
            max="60"
            step="1"
            value={rollingDays}
            onChange={(e) => setRollingDays(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <span className="text-[11px] font-mono text-slate-400">60d</span>
        </div>
      </div>

      {/* Graph 1: Total Body Mass (Blue) */}
      <div className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block" />
              Total Body Mass (kg)
            </h3>
            <p className="text-[11px] text-slate-500">
              6-Month Horizon | Solid: recorded weigh-in | Dotted: {rollingDays}-day average
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Unit: 1 kg / div</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              syncId="body-comp-sync"
              data={chartData}
              margin={{ top: 10, right: 25, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={timeBounds}
                tickFormatter={formatXAxis}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                domain={weightBounds.domain}
                ticks={weightBounds.ticks}
                unit=" kg"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                }}
                formatter={(value: any, name: any) => [`${value} kg`, name]}
                labelFormatter={(label) => `Date: ${formatXAxis(Number(label))}`}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} iconType="plainline" />
              <Line
                type="monotone"
                dataKey="weight_kg"
                name="Mass (Actual)"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 2, fill: '#2563eb' }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="weight_ma"
                name={`Mass (${rollingDays}d Avg)`}
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                connectNulls={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Graph 2: Fat Mass (Red) */}
      <div className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600 inline-block" />
              Fat Mass (kg)
            </h3>
            <p className="text-[11px] text-slate-500">
              6-Month Horizon | Solid: recorded impedance | Dotted: {rollingDays}-day average
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Whole kg intervals</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              syncId="body-comp-sync"
              data={chartData}
              margin={{ top: 10, right: 25, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={timeBounds}
                tickFormatter={formatXAxis}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                domain={fatBounds.domain}
                ticks={fatBounds.ticks}
                unit=" kg"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                }}
                formatter={(value: any, name: any) => [`${value} kg`, name]}
                labelFormatter={(label) => `Date: ${formatXAxis(Number(label))}`}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} iconType="plainline" />
              <Line
                type="monotone"
                dataKey="fat_kg"
                name="Fat Mass (Actual)"
                stroke="#dc2626"
                strokeWidth={2}
                dot={{ r: 2, fill: '#dc2626' }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="fat_ma"
                name={`Fat Mass (${rollingDays}d Avg)`}
                stroke="#dc2626"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                connectNulls={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Graph 3: Muscle Mass (Green) */}
      <div className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 inline-block" />
              Muscle Mass (kg)
            </h3>
            <p className="text-[11px] text-slate-500">
              6-Month Horizon | Solid: recorded skeletal muscle | Dotted: {rollingDays}-day average
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Whole kg intervals</span>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              syncId="body-comp-sync"
              data={chartData}
              margin={{ top: 10, right: 25, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={timeBounds}
                tickFormatter={formatXAxis}
                tick={{ fontSize: 10, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                domain={muscleBounds.domain}
                ticks={muscleBounds.ticks}
                unit=" kg"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                }}
                formatter={(value: any, name: any) => [`${value} kg`, name]}
                labelFormatter={(label) => `Date: ${formatXAxis