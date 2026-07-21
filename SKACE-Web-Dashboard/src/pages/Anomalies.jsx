/**
 * @fileoverview Anomalies Page — filterable table with score bars and detail drawer.
 * Works with normalized 0/1 integer flags from the pipeline.
 */
import React, { useState, useMemo } from 'react';
import { useDataStore } from '../store/useDataStore.jsx';
import { getTriggeredFlags, getScoreColor, getCategoryColor } from '../utils/dataTransforms.js';

/* ── Inline score bar ── */
function ScoreBar({ score, max = 10 }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = getScoreColor(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="score-bar-track" style={{ width: 80 }}>
        <div className="score-bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color, fontWeight: 600 }}>
        {score}/10
      </span>
    </div>
  );
}

/* ── Score gauge arc (SVG) ── */
function ScoreGauge({ score, max = 10 }) {
  const pct = Math.min(score / max, 1);
  const r = 46;
  const cx = 56, cy = 56;
  const startAngle = -210;
  const sweepAngle = 240;
  const endAngle = startAngle + sweepAngle * pct;
  const toRad = a => (a * Math.PI) / 180;
  const arcX = (a) => cx + r * Math.cos(toRad(a));
  const arcY = (a) => cy + r * Math.sin(toRad(a));
  const color = getScoreColor(score);
  const sx = arcX(startAngle), sy = arcY(startAngle);
  const ex = arcX(endAngle), ey = arcY(endAngle);
  const la = sweepAngle * pct > 180 ? 1 : 0;
  return (
    <svg width={112} height={88} style={{ overflow: 'visible' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} strokeDasharray="none" />
      {pct > 0 && (
        <path
          d={`M ${sx} ${sy} A ${r} ${r} 0 ${la} 1 ${ex} ${ey}`}
          fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
      )}
      <text x={cx} y={cy + 6} textAnchor="middle" fill={color} fontSize={18} fontWeight={800} fontFamily="var(--font-mono)">{score}</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="var(--text-secondary)" fontSize={9} fontFamily="var(--font-sans)">/ 10</text>
    </svg>
  );
}

/* ── Detail Drawer ── */
function DetailDrawer({ row, onClose }) {
  const flags = getTriggeredFlags(row);
  const duration = row['V-01_total_interview_duration_ms'];
  const features = [
    { label: 'Duration',     val: duration ? `${(duration/1000).toFixed(2)}s` : '—' },
    { label: 'RT Variance',  val: row['T-01_rt_variance']?.toFixed ? row['T-01_rt_variance']?.toFixed(2) : '—' },
    { label: 'RT Entropy',   val: row['T-03_rt_entropy']?.toFixed(3) ?? '—' },
    { label: 'RT Mean',      val: row['T-06_rt_mean']?.toFixed ? `${row['T-06_rt_mean']?.toFixed(0)}ms` : '—' },
    { label: 'Back-Nav Rate',val: row['V-05_back_navigation_rate']?.toFixed(3) ?? '—' },
    { label: 'Section Pace', val: row['S-01_mean_section_pace']?.toFixed ? `${row['S-01_mean_section_pace']?.toFixed(0)}ms` : '—' },
    { label: 'Hour of Day',  val: row['V-07_time_of_day_hour'] ?? '—' },
    { label: 'Completion',   val: row['S-10_section_completion_rate']?.toFixed(2) ?? '—' },
  ];
  const catColor = getCategoryColor(row._category);
  const platformClass = row._platform === 'ODK' ? 'badge-odk' : row._platform === 'SurveyCTO' ? 'badge-surveycto' : 'badge-ground-truth';

  return (
    <div className="card drawer" style={{ width: 340, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: 0, maxHeight: 'calc(100vh - 128px)', overflowY: 'auto', borderColor: `${catColor}30` }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
        <div>
          <div className="text-mono" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{row.interview_id}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <span className={`badge ${platformClass}`}>{row._platform}</span>
            <span className={`badge badge-${row._category || 'normal'}`}>{row._category || 'normal'}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem', padding: 4 }}>×</button>
      </div>

      {/* Score Gauge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <ScoreGauge score={row._score} />
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Anomaly Score</div>
      </div>

      {/* Triggered Flags */}
      <div style={{ marginTop: 'var(--space-md)' }}>
        <div className="section-label">Triggered Rules ({flags.length})</div>
        {flags.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {flags.map(f => (
              <span key={f.key} style={{
                background: `${f.color}18`,
                color: f.color,
                border: `1px solid ${f.color}40`,
                padding: '4px 10px',
                borderRadius: 100,
                fontSize: '0.68rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                ⚑ {f.label}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No flags triggered.</div>
        )}
      </div>

      {/* Key Feature Stats */}
      <div style={{ marginTop: 'var(--space-md)' }}>
        <div className="section-label">Key Feature Values</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {features.map(f => (
            <div key={f.label} className="stat-row">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{f.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-primary)' }}>{f.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function Anomalies() {
  const { state } = useDataStore();
  const [search,    setSearch]    = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [filterPlat,setFilterPlat]= useState('All');
  const [selected,  setSelected]  = useState(null);

  const filteredData = useMemo(() => {
    if (!state.masterData) return [];
    return state.masterData
      .filter(r => r._isAnomalous)
      .filter(r => {
        const matchSearch = !search || r.interview_id?.toLowerCase().includes(search.toLowerCase());
        const matchCat    = filterCat === 'All' || r._category === filterCat.toLowerCase().replace(' ', '_');
        const matchPlat   = filterPlat === 'All' || r._platform === filterPlat;
        return matchSearch && matchCat && matchPlat;
      })
      .sort((a, b) => b._score - a._score);
  }, [state.masterData, search, filterCat, filterPlat]);

  const platforms = useMemo(() => {
    const s = new Set((state.masterData || []).map(r => r._platform));
    return ['All', ...Array.from(s)];
  }, [state.masterData]);

  if (state.status !== 'success') {
    return (
      <div style={{ color: 'var(--text-muted)', padding: '60px', textAlign: 'center' }}>
        {state.status === 'loading' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div className="spinner" /> Loading data…
          </div>
        ) : 'Waiting for data…'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-start' }}>
      {/* Left panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', minWidth: 0 }}>

        {/* Filter bar */}
        <div className="card" style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Search ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: 32 }}
            />
          </div>

          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option>All</option>
            <option>Suspicious</option>
            <option>dq_issue</option>
          </select>

          <select value={filterPlat} onChange={e => setFilterPlat(e.target.value)}>
            {platforms.map(p => <option key={p}>{p}</option>)}
          </select>

          <span className="badge badge-danger" style={{ marginLeft: 'auto' }}>
            {filteredData.length} records
          </span>
        </div>

        {/* Table */}
        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Interview ID</th>
                <th>Platform</th>
                <th>Duration</th>
                <th>Entropy</th>
                <th style={{ minWidth: 160 }}>Anomaly Score</th>
                <th>Category</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(row => {
                const isSelected = selected?.interview_id === row.interview_id && selected?._platform === row._platform;
                const duration   = row['V-01_total_interview_duration_ms'];
                const entropy    = row['T-03_rt_entropy'];
                const flags      = ['flag_too_fast','flag_too_slow','flag_zero_back_nav','flag_low_entropy','flag_uniform_timing','flag_high_back_nav','flag_invalid_ratio','flag_missing_data'].filter(f => row[f] === 1);
                const platClass  = row._platform === 'ODK' ? 'badge-odk' : row._platform === 'SurveyCTO' ? 'badge-surveycto' : 'badge-ground-truth';
                return (
                  <tr
                    key={`${row.interview_id}-${row._platform}`}
                    onClick={() => setSelected(isSelected ? null : row)}
                    style={{ background: isSelected ? 'rgba(0,212,255,0.05)' : 'transparent' }}
                  >
                    <td className="text-mono text-cyber" style={{ fontWeight: 600 }}>{row.interview_id}</td>
                    <td><span className={`badge ${platClass}`}>{row._platform}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {duration ? `${(duration / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                      {typeof entropy === 'number' && !isNaN(entropy) ? entropy.toFixed(3) : '—'}
                    </td>
                    <td><ScoreBar score={row._score} /></td>
                    <td>
                      <span className={`badge badge-${row._category || 'normal'}`}>{row._category || 'normal'}</span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: flags.length >= 5 ? 'var(--color-danger)' : flags.length >= 3 ? 'var(--color-warning)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {flags.length}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    No records match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && <DetailDrawer row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
