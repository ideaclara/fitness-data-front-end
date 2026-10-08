import React, { useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Activity } from 'lucide-react';
import { MeasurementSession } from '../types/telemetry';

const columnHelper = createColumnHelper<MeasurementSession>();

interface TelemetryTableProps {
  data: MeasurementSession[];
  isLoading: boolean;
}

export const TelemetryTable: React.FC<TelemetryTableProps> = ({ data, isLoading }) => {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'timestamp', desc: true },
  ]);

  // Filter out ghost rows (no weight) and merge records sharing the same timestamp
  const sanitizedData = useMemo(() => {
    const validRows = data.filter((row) => row.weight_kg != null && row.weight_kg > 0);

    // Group by timestamp to collapse multi-packet Withings sessions
    const sessionMap = new Map<number, MeasurementSession>();

    for (const row of validRows) {
      const existing = sessionMap.get(row.timestamp);
      if (!existing) {
        sessionMap.set(row.timestamp, { ...row });
      } else {
        // Merge missing metrics into existing record
        sessionMap.set(row.timestamp, {
          ...existing,
          weight_kg: existing.weight_kg ?? row.weight_kg,
          fat_ratio_pct: existing.fat_ratio_pct ?? row.fat_ratio_pct,
          fat_mass_weight_kg: existing.fat_mass_weight_kg ?? row.fat_mass_weight_kg,
          fat_free_mass_kg: existing.fat_free_mass_kg ?? row.fat_free_mass_kg,
          muscle_mass_kg: existing.muscle_mass_kg ?? row.muscle_mass_kg,
          hydration_kg: existing.hydration_kg ?? row.hydration_kg,
          bone_mass_kg: existing.bone_mass_kg ?? row.bone_mass_kg,
          heart_pulse_bpm: existing.heart_pulse_bpm ?? row.heart_pulse_bpm,
          pulse_wave_velocity_raw_ms: existing.pulse_wave_velocity_raw_ms ?? row.pulse_wave_velocity_raw_ms,
          pulse_wave_velocity_normalized_ms: existing.pulse_wave_velocity_normalized_ms ?? row.pulse_wave_velocity_normalized_ms,
          vascular_age_yrs: existing.vascular_age_yrs ?? row.vascular_age_yrs,
          device_model: existing.device_model || row.device_model,
        });
      }
    }

    return Array.from(sessionMap.values());
  }, [data]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('timestamp', {
        header: 'Measurement Time',
        cell: (info) => {
          const epoch = info.getValue();
          if (!epoch) return '-';
          const date = new Date(epoch * 1000);

          // UK Local Time formatted cleanly as: "08 Oct 2026 07:44:38"
          const dateStr = date.toLocaleDateString('en-GB', {
            timeZone: 'Europe/London',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          const timeStr = date.toLocaleTimeString('en-GB', {
            timeZone: 'Europe/London',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          });

          return (
            <span className="font-mono text-xs font-semibold text-slate-900">
              {dateStr} {timeStr}
            </span>
          );
        },
      }),
      columnHelper.accessor('weight_kg', {
        header: 'Weight',
        cell: (info) => (
          <span className="font-mono font-medium text-slate-900">
            {info.getValue() != null ? `${info.getValue()!.toFixed(2)} kg` : '-'}
          </span>
        ),
      }),
      columnHelper.accessor('fat_ratio_pct', {
        header: 'Body Fat',
        cell: (info) => (
          <span className="font-mono text-slate-700">
            {info.getValue() != null ? `${info.getValue()!.toFixed(1)}%` : '-'}
          </span>
        ),
      }),
      columnHelper.accessor('muscle_mass_kg', {
        header: 'Muscle Mass',
        cell: (info) => (
          <span className="font-mono text-slate-700">
            {info.getValue() != null ? `${info.getValue()!.toFixed(2)} kg` : '-'}
          </span>
        ),
      }),
      columnHelper.accessor('hydration_kg', {
        header: 'Hydration',
        cell: (info) => (
          <span className="font-mono text-slate-700">
            {info.getValue() != null ? `${info.getValue()!.toFixed(2)} kg` : '-'}
          </span>
        ),
      }),
      columnHelper.accessor('bone_mass_kg', {
        header: 'Bone Mass',
        cell: (info) => (
          <span className="font-mono text-slate-700">
            {info.getValue() != null ? `${info.getValue()!.toFixed(2)} kg` : '-'}
          </span>
        ),
      }),
      columnHelper.accessor('heart_pulse_bpm', {
        header: 'Resting HR',
        cell: (info) => (
          <span className="font-mono font-medium text-rose-700">
            {info.getValue() != null ? `${Math.round(info.getValue()!)} bpm` : '-'}
          </span>
        ),
      }),
      columnHelper.accessor('pulse_wave_velocity_raw_ms', {
        header: 'Raw PWV',
        cell: (info) => (
          <span className="font-mono text-slate-600">
            {info.getValue() != null ? `${info.getValue()!.toFixed(2)} m/s` : '-'}
          </span>
        ),
      }),
      columnHelper.accessor('pulse_wave_velocity_normalized_ms', {
        header: 'Norm PWV',
        cell: (info) => (
          <span className="font-mono font-medium text-emerald-700">
            {info.getValue() != null ? `${info.getValue()!.toFixed(2)} m/s` : '-'}
          </span>
        ),
      }),
      columnHelper.accessor('vascular_age_yrs', {
        header: 'Vascular Age',
        cell: (info) => (
          <span className="font-mono text-slate-800">
            {info.getValue() != null ? `${info.getValue()!.toFixed(1)} yrs` : '-'}
          </span>
        ),
      }),
      columnHelper.accessor('device_model', {
        header: 'Device',
        cell: (info) => (
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
            {info.getValue() || 'Body Scan'}
          </span>
        ),
      }),
    ],
    []
  );

  const table = useReactTable({
    data: sanitizedData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className="px-4 py-3.5 cursor-pointer select-none hover:bg-slate-100/80 transition-colors"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="text-slate-400">
                            {sorted === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5 text-slate-900" />
                            ) : sorted === 'desc' ? (
                              <ArrowDown className="h-3.5 w-3.5 text-slate-900" />
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <Activity className="h-4 w-4 animate-spin text-slate-500" />
                    <span>Loading telemetry sessions from DynamoDB...</span>
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                  No telemetry sessions found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};