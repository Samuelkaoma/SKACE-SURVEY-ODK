import React, { useState, useMemo } from 'react';
import { useDataStore } from '../store/useDataStore.jsx';

export default function DataView() {
  const { state } = useDataStore();
  const [search, setSearch] = useState('');

  const filteredData = useMemo(() => {
    if (!state.masterData) return [];
    if (!search) return state.masterData;
    const lowerSearch = search.toLowerCase();
    return state.masterData.filter(row => 
      Object.values(row).some(val => 
        String(val).toLowerCase().includes(lowerSearch)
      )
    );
  }, [state.masterData, search]);

  const headers = useMemo(() => {
    if (!state.masterData || state.masterData.length === 0) return [];
    return Object.keys(state.masterData[0]);
  }, [state.masterData]);

  if (state.status !== 'success') {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
        {state.status === 'loading' ? <div className="spinner" style={{ margin: '0 auto' }} /> : 'No data loaded to explore.'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', height: '100%' }}>
      <div className="card" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Data Explorer</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Audit the raw engineered features for each interview.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
            <input 
              type="text" 
              placeholder="Search records..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '8px 12px', width: 250 }}
            />
            <button className="btn btn-secondary" onClick={() => {
                const csvContent = "data:text/csv;charset=utf-8," 
                    + [headers.join(","), ...state.masterData.map(r => headers.map(h => r[h]).join(","))].join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "skace_features_export.csv");
                document.body.appendChild(link);
                link.click();
            }}>
                Download CSV
            </button>
        </div>
      </div>

      <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-surface)', zIndex: 10, boxShadow: '0 1px 0 var(--border-subtle)' }}>
              <tr>
                {headers.map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-subtle)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: row._isAnomalous ? 'rgba(255,71,87,0.03)' : 'transparent' }}>
                  {headers.map(h => (
                    <td key={h} style={{ padding: '10px 16px', whiteSpace: 'nowrap', color: h.startsWith('_') ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                      {row[h] === null || row[h] === undefined ? <span style={{ opacity: 0.3 }}>null</span> : String(row[h])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredData.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No matching records found.</div>
        )}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'rgba(0,0,0,0.1)' }}>
          Showing {filteredData.length} of {state.masterData.length} engineered vectors
        </div>
      </div>
    </div>
  );
}
