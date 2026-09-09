import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Persistent Performance Log Store
 * Keeps run history across simulation resets and page reloads.
 * Separate from high-frequency live telemetry.
 */
export const usePerfLogStore = create(
  persist(
    (set, get) => ({
      runs: [],

      addRun: (run) => set(state => {
        // Avoid duplicate run_id
        if (state.runs.some(r => r.run_id === run.run_id)) return state;
        return { runs: [...state.runs, run] };
      }),

      clearLog: () => set({ runs: [] }),

      getRuns: () => get().runs,

      exportJSON: () => {
        const data = JSON.stringify(get().runs, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `virtupat_perflog_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },

      exportCSV: () => {
        const runs = get().runs;
        if (runs.length === 0) return;
        const cols = [
          'run_id', 'timestamp', 'scenario', 'detector_mode',
          'acquisition_time', 'tracking_RMSE', 'false_positive_rate',
          'lock_probability', 'reacquire_count', 'mean_reacquire_time',
          'disturbance_events',
        ];
        const header = cols.join(',');
        const rows = runs.map(r =>
          cols.map(c => {
            const v = r[c] ?? '';
            return String(v).includes(',') ? `"${v}"` : v;
          }).join(',')
        );
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `virtupat_perflog_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      },
    }),
    {
      name: 'virtupat-perf-log',
      version: 1,
    }
  )
);
