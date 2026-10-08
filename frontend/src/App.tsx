import React, { useEffect, useState } from 'react';
import { TelemetryTable } from './components/TelemetryTable';
import { MeasurementSession, TelemetryApiResponse } from './types/telemetry';
import { Activity, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [data, setData] = useState<MeasurementSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const fetchTelemetry = async (nextCursor?: string) => {
    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const url = new URL('/telemetry/measures', baseUrl || window.location.origin);
      url.searchParams.set('limit', '50');
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-slate-900 text-white">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Withings Health Telemetry
              </h1>
              <p className="text-xs text-slate-500">
                Direct DynamoDB Session Feed (eu-west-2)
              </p>
            </div>
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
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            Showing {data.length} telemetry records
          </span>
          {cursor && (
            <button
              onClick={() => fetchTelemetry(cursor)}
              disabled={isLoading}
              className="text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              Load Older Records &rarr;
            </button>
          )}
        </div>
        <TelemetryTable data={data} isLoading={isLoading} />
      </main>
    </div>
  );
};

export default App;