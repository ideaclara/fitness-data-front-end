import React, { useEffect, useState, useMemo } from 'react';
import { TelemetryTable } from './components/TelemetryTable';
import { BodyCompositionTrends } from './components/BodyCompositionTrends';
import { MeasurementSession, TelemetryApiResponse } from './types/telemetry';
import { Activity, RefreshCw, Table as TableIcon, LineChart as ChartIcon } from 'lucide-react';

export const App: React.FC = () => {
  const [data, setData] = useState<MeasurementSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'trends' | 'table'>('trends');

  const fetchTelemetry = async (nextCursor?: string) => {
    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const url = new URL('/telemetry/measures', baseUrl || window.location.origin);
      // Fetch 750 items to span > 6 months across multiple packets per weigh-in
      url.searchParams.set('limit', '750');
      if (nextCursor) {
        url.searchParams.set('cursor', nextCursor);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      const json: TelemetryApiResponse = await response.json();
      setData(json.data);
      setCursor(json.next_cursor);
    } catch (err) {
      console.error('Failed to load telemetry:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  const validSessionCount = useMemo(() => {
    const valid = data.filter((row) => row.weight_kg != null && row.weight_kg > 0);
    return new Set(valid.map((r) => r.timestamp)).size;
  }, [data]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-900 text-white">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">
                Withings Health Telemetry
              </h1>
              <p className="text-[11px] text-slate-500 font-mono">
                DynamoDB Telemetry Pipeline (eu-west-2)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                onClick={() => setActiveTab('trends')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                  activeTab === 'trends'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ChartIcon className="h-3.5 w-3.5 text-blue-600" />
                Trends & Rolling Averages
              </button>
              <button
                onClick={() => setActiveTab('table')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition ${
                  activeTab === 'table'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5 text-slate-600" />
                Table Log
              </button>
            </div>

            <button
              onClick={() => fetchTelemetry()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 font-mono">
            {validSessionCount} valid measurement sessions in memory
          </span>
          {cursor && activeTab === 'table' && (
            <button
              onClick={() => fetchTelemetry(cursor)}
              disabled={isLoading}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              Load Older Records &rarr;
            </button>
          )}
        </div>

        {activeTab === 'trends' ? (
          <BodyCompositionTrends data={data} isLoading={isLoading} />
        ) : (
          <TelemetryTable data={data} isLoading={isLoading} />
        )}
      </main>
    </div>
  );
};

export default App;