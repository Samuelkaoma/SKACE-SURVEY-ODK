/**
 * @fileoverview Top header bar with title, data status, and CSV upload.
 */
import React, { useRef, useState, useEffect } from 'react';
import { useDataStore } from '../../store/useDataStore.jsx';

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
      {time.toLocaleTimeString()}
    </span>
  );
}

export default function Header({ currentPage }) {
  const { state, uploadCsv } = useDataStore();
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadCsv(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) uploadCsv(file);
  };

  const PAGE_SUBTITLES = {
    Overview:  'Pipeline execution summary & anomaly breakdown',
    Anomalies: 'Flagged interview records with rule triggers',
    Features:  'Paradata feature distributions & statistics',
    Notebook:  'Audit report, plots & evaluation results',
  };

  return (
    <header
      style={{
        height: 'var(--header-height)',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-lg)',
        gap: 'var(--space-md)',
        flexShrink: 0,
      }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {dragging && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,212,255,0.05)',
          border: '2px dashed var(--accent-cyan)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>📂</div>
            <div style={{ fontSize: '1.25rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>Drop CSV file to load</div>
          </div>
        </div>
      )}

      {/* Left: Page title */}
      <div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
          {currentPage || 'Overview'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1 }}>
          {PAGE_SUBTITLES[currentPage] || ''}
        </div>
      </div>

      {/* Right: status + clock + upload */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <LiveClock />

        {state.status === 'success' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00c896' }} className="animate-pulse" />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <span style={{ color: '#00c896', fontWeight: 600 }}>{state.masterData.length}</span> records
            </span>
          </div>
        )}
        {state.status === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="spinner" />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Loading…</span>
          </div>
        )}
        {state.status === 'error' && (
          <span className="badge badge-danger">⚠ {state.error}</span>
        )}

        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
        <button
          className="btn btn-primary"
          style={{ fontSize: '0.8rem', padding: '7px 14px' }}
          onClick={() => fileRef.current?.click()}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Upload CSV
        </button>
      </div>
    </header>
  );
}
