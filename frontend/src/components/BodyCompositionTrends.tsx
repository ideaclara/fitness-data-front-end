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
  weight_kg: number;
  fat_kg: number;
  muscle_kg: number;
  weight_ma?: number;
  fat_ma?: number;
  muscle_ma?: number;
}

export const BodyCompositionTrends: React.FC<BodyCompositionTrendsProps> = ({
  data,
  isLoading,
}) => {
  const [rollingDays, setRollingDays] = useState<number>(7);

  // 1. Sanitize, deduplicate, compute kg values, and order chronologically (oldest to newest)
  const chartData = useMemo(() => {
    const valid = data.filter((row) => row.weight_kg != null && row.weight_kg > 0);

    const sessionMap = new Map<number, MeasurementSession>();
    for (const row of valid) {
      const existing = sessionMap.get(row.timestamp);
      const resolvedFat =
        row.fat_mass_weight_kg ??
        (row.weight_kg != null && row.fat_ratio_pct != null
          ? Number(((row.weight_kg * row.fat_ratio_pct) / 100).toFixed(2))
          : undefined);

      if (!existing) {
        sessionMap.set(row.timestamp, { ...row, fat_mass_weight_kg: resolvedFat });
      } else {
        sessionMap.set(row.timestamp, {
          ...existing,
          weight_kg: existing.weight_kg ?? row.weight_kg,
          fat_mass_weight_kg: existing.fat_mass_weight_kg ?? resolvedFat,
          muscle_mass_kg: existing.muscle_mass_kg ?? row.muscle_mass_kg,
        });
      }
    }

    const chronological = Array.from(sessionMap.values()).sort(
      (a, b) => a.timestamp - b.timestamp
    );

    // 2. Compute calendar-day time-window rolling averages
    const windowSeconds = rollingDays * 86400;

    return chronological.map((current, idx, arr): ChartDataPoint => {
      const windowStart = current.timestamp - windowSeconds;

      // Find all sessions falling inside [t - X days, t]
      const windowRecords = arr.filter(
        (r) => r.timestamp >= windowStart && r.timestamp <= current.timestamp
      );

      const avg = (extractor: (item: MeasurementSession) => number | undefined) => {
        const vals = windowRecords
          .map(extractor)
          .filter((v): v is number => v != null && !isNaN(v));
        if (vals.length === 0) return undefined;
        return Number((vals.reduce((sum, v) => sum + v, 0) / vals.length).toFixed(2));
      };

      const fat =
        current.fat_mass_weight_kg ??
        (current.weight_kg && current.fat_ratio_pct
          ? (current.weight_kg * current.fat_ratio_pct) / 100
          : 0);

      const date = new Date(current.timestamp * 1000);
      const dateStr = date.toLocaleDateString('en-GB', {
        timeZone: 'Europe/London',
        day: '2-digit',
        month: 'short',
      });

      return {
        timestamp: current.timestamp,
        dateStr,
        weight_kg: Number(current.weight_kg!.toFixed(2)),
        fat_kg: Number(fat.toFixed(2)),
        muscle_kg: Number((current.muscle_mass_kg ?? 0).toFixed(2)),
        weight_ma: avg((r) => r.weight_kg),
        fat_ma: avg((r) =>
          r.fat_mass_weight_kg ??
          (r.weight_kg && r.fat_ratio_pct ? (r.weight_kg * r.fat_ratio_pct) / 100 : undefined)
        ),
        muscle_ma: avg((r) => r.muscle_mass_kg),
      };
    });
  }, [data, rollingDays]);

  if (isLoading) {
    return (
      <div className="w-full h-96 rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-center text-slate-400">
        Loading telemetry timeline...
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {/* Main Chart Canvas */}
      <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Mass & Body Composition Trends
            </h2>
            <p className="text-xs text-slate-500">
              Solid lines: recorded sessions (kg) | Dotted lines: {rollingDays}-day moving average (kg)
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
            <Calendar className="h-3.5 w-3.5" />
            <span>{chartData.length} Data Points</span>
          </div>
        </div>

        <div className="h-[460px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="dateStr"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#cbd5e1' }}
                tickLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                domain={['auto', 'auto']}
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
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
                formatter={(value: any, name: any) => [`${value} kg`, name]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend
                wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }}
                iconType="plainline"
              />

              {/* Mass (Blue: #2563eb) */}
              <Line
                type="monotone"
                dataKey="weight_kg"
                name="Mass (Actual)"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 2.5, fill: '#2563eb' }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="weight_ma"
                name={`Mass (${rollingDays}d Avg)`}
                stroke="#2563eb"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />

              {/* Fat Mass (Red: #dc2626) */}
              <Line
                type="monotone"
                dataKey="fat_kg"
                name="Fat Mass (Actual)"
                stroke="#dc2626"
                strokeWidth={2}
                dot={{ r: 2.5, fill: '#dc2626' }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="fat_ma"
                name={`Fat Mass (${rollingDays}d Avg)`}
                stroke="#dc2626"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />

              {/* Muscle Mass (Green: #16a34a) */}
              <Line
                type="monotone"
                dataKey="muscle_kg"
                name="Muscle Mass (Actual)"
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ r: 2.5, fill: '#16a34a' }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="muscle_ma"
                name={`Muscle Mass (${rollingDays}d Avg)`}
                stroke="#16a34a"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};