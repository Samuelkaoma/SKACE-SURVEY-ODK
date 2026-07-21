/**
 * @fileoverview React Context for sharing raw and processed application data globally.
 * Centralized data, flag normalization, and CSV upload support.
 */
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { normalizeDataset } from '../utils/dataTransforms.js';

const DataContext = createContext(null);

/** Base URL for the FastAPI backend (override via VITE_API_BASE). */
export const API = import.meta.env?.VITE_API_BASE || 'http://localhost:8000';

const initialState = {
  status:     'idle', // 'idle' | 'loading' | 'success' | 'error'
  masterData: [],
  datasets:   [],
  metrics:    null,
  fileName:   null,
  error:      null,
};

function dataReducer(state, action) {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, status: 'loading', error: null };
    case 'LOAD_SUCCESS':
      return {
        ...state,
        status:     'success',
        masterData: normalizeDataset(action.payload.data),
        fileName:   action.payload.fileName,
      };
    case 'LOAD_ERROR':
      return { ...state, status: 'error', error: action.payload };
    case 'SETS_LOADED':
      return { ...state, datasets: action.payload };
    case 'METRICS_LOADED':
      return { ...state, metrics: action.payload };
    default:
      return state;
  }
}

async function parseCsv(csvText) {
  const Papa = await import('papaparse');
  return new Promise((resolve, reject) => {
    Papa.default.parse(csvText, {
      header:       true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data),
      error:    err    => reject(new Error(err.message)),
    });
  });
}

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(dataReducer, initialState);

  const fetchDatasets = async () => {
    try {
      const res = await fetch(`${API}/api/datasets`);
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: 'SETS_LOADED', payload: data });
      }
    } catch (err) {
      console.error('Failed to fetch datasets:', err);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API}/api/metrics`);
      if (res.ok) {
        const data = await res.json();
        dispatch({ type: 'METRICS_LOADED', payload: data });
      }
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
    }
  };

  // Auto-load API data on mount
  useEffect(() => {
    const load = async () => {
      dispatch({ type: 'LOAD_START' });
      try {
        await fetchDatasets();
        await fetchMetrics();
        const [resRes, resGt] = await Promise.all([
            fetch(`${API}/api/results`),
            fetch(`${API}/api/ground-truth`)
        ]);

        const dataList = resRes.ok ? await resRes.json() : [];
        const gtList   = resGt.ok  ? await resGt.json()  : [];
        const combined = [...dataList, ...gtList];
        
        if (combined.length > 0) {
            dispatch({ type: 'LOAD_SUCCESS', payload: { data: combined, fileName: 'live API (merged)' } });
        } else {
            // Fallback to sample data if API returns empty
            const fallbackRes = await fetch('/sample_data/features_output.csv');
            if (fallbackRes.ok) {
                const csvText = await fallbackRes.text();
                const data = await parseCsv(csvText);
                dispatch({ type: 'LOAD_SUCCESS', payload: { data, fileName: 'features_output.csv (fallback)' } });
            } else {
                throw new Error("No data found from API or fallback");
            }
        }
      } catch (err) {
        dispatch({ type: 'LOAD_ERROR', payload: err.message });
      }
    };
    load();
  }, []);

  const generateSynthetic = async (mode = 'adversarial') => {
    dispatch({ type: 'LOAD_START' });
    try {
      const res = await fetch(`${API}/api/generate-synthetic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      if (!res.ok) throw new Error('Failed to generate synthetic data.');
      
      alert(`Synthetic ${mode} data generated successfully!`);
      await fetchDatasets();
      dispatch({ type: 'LOAD_ERROR', payload: `Success: ${mode} data ready. Select it below and Run Pipeline.` });
    } catch (err) {
      alert(err.message);
      dispatch({ type: 'LOAD_ERROR', payload: err.message });
    }
  };

  const runPipeline = async (folderName = null) => {
    dispatch({ type: 'LOAD_START' });
    try {
      const res = await fetch(`${API}/api/run-pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_name: folderName })
      });
      if (!res.ok) {
          const detail = await res.json();
          throw new Error(detail.detail || 'Failed to run pipeline.');
      }
      
      // Auto-refresh the results (features, ground truth, and computed metrics)
      await fetchMetrics();
      const [resRes, resGt] = await Promise.all([
          fetch(`${API}/api/results`),
          fetch(`${API}/api/ground-truth`)
      ]);

      const dataList = resRes.ok ? await resRes.json() : [];
      const gtList   = resGt.ok  ? await resGt.json()  : [];
      const combined = [...dataList, ...gtList];

      dispatch({ type: 'LOAD_SUCCESS', payload: { data: combined, fileName: `Processed: ${folderName || 'Latest'}` } });
      alert('Pipeline finished and data refreshed!');
    } catch (err) {
      alert(err.message);
      dispatch({ type: 'LOAD_ERROR', payload: err.message });
    }
  };

  /**
   * Upload + parse a new CSV file from the user
   */
  const uploadCsv = async (file) => {
    dispatch({ type: 'LOAD_START' });
    try {
      const csvText = await file.text();
      const data = await parseCsv(csvText);
      if (!data || data.length === 0) throw new Error('CSV is empty or could not be parsed.');
      dispatch({ type: 'LOAD_SUCCESS', payload: { data, fileName: file.name } });
    } catch (err) {
      dispatch({ type: 'LOAD_ERROR', payload: err.message });
    }
  };

  return (
    <DataContext.Provider value={{ state, dispatch, uploadCsv, generateSynthetic, runPipeline }}>
      {children}
    </DataContext.Provider>
  );
}

export function useDataStore() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useDataStore must be used within a DataProvider');
  return context;
}
