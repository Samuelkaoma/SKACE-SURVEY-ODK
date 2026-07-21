/**
 * @fileoverview Overview Dashboard — KPIs, donut chart, source comparison, top anomalies.
 */
import React, { useMemo } from 'react';
import { useDataStore } from '../store/useDataStore.jsx';
import { getKpis, getAnomalyRatioStats, getSourceBreakdown } from '../utils/dataTransforms.js';
import KpiCard from '../components/kpi/KpiCard.jsx';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { CHART_COLORS, CHART_STYLE, CHART_TOOLTIP_STYLE } from '../utils/chartTheme.js';

/* ── Score bar ── */
function ScoreBar({ score, max = 10 }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = score >= 7 ? '#ff4757' : score >= 4 ? '#ff6b2b' : score >= 1 ? '#f5a623' : '#00c896';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div className="score-bar-track" style={{ flex: 1 }}>
        <div className="score-bar-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color, width: 18, textAlign: 'right', fontWeight: 600 }}>{score}</span>
    </div>
  );
}

/* ── Custom donut centre label ── */
function DonutCenter({ viewBox, total, label }) {
  const { cx, cy } = viewBox;
  return (
    <g>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--text-primary)" fontSize={26} fontWeight={700} fontFamily="var(--font-mono)">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--text-secondary)" fontSize={11} fontFamily="var(--font-sans)">{label}</text>
    </g>
  );
}

export default function Overview() {
  const { state, generateSynthetic, runPipeline } = useDataStore();
  const [selectedFolder, setSelectedFolder] = React.useState(null);

  const kpis        = useMemo(() => getKpis(state.masterData), [state.masterData]);

  // Prefer backend-computed metrics (fractions 0-1) over client-side derivation.
  const m = state.metrics;
  const serverMetrics = m && m.available ? {
    recall:    (m.recall * 100).toFixed(1),
    precision: (m.precision * 100).toFixed(1),
    f1Score:   (m.f1_score * 100).toFixed(1),
    truePositives:   m.true_positive,
    actualPositives: m.anomalies_true,
  } : null;
  const evalMetrics = serverMetrics || kpis;
  const ratioStats  = useMemo(() => getAnomalyRatioStats(state.masterData), [state.masterData]);
  const sourceBreak = useMemo(() => getSourceBreakdown(state.masterData), [state.masterData]);

  const topAnomalies = useMemo(() => {
    return [...(state.masterData || [])]
      .filter(d => d._isAnomalous)
      .sort((a, b) => b._score - a._score)
      .slice(0, 12);
  }, [state.masterData]);

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <div className="grid grid-cols-5 gap-md">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 110 }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: 16, color: 'var(--text-muted)' }}>
          <div className="spinner" />
          <span>Analysing dataset...</span>
        </div>
      </div>
    );
  }

  if (state.status === 'error' && !state.datasets.length) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 60, borderColor: 'rgba(255,71,87,0.2)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⚠</div>
        <div style={{ color: 'var(--color-danger)', fontSize: '1.1rem', fontWeight: 600 }}>Connection Error</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: '0.875rem' }}>{state.error}</div>
      </div>
    );
  }

  const KPI_CARDS = [
    { title: 'Total Records',     value: kpis?.totalInterviews || 0,   variant: 'cyan',    subtitle: `${kpis?.realInterviews || 0} real interviews`, delay: 1,
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    },
    { title: 'Anomalies Caught',  value: kpis?.anomaliesCaught || 0,  variant: 'danger',  subtitle: 'is_anomalous = 1', delay: 2,
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    },
    { title: 'DQ Issues',         value: kpis?.dqCount || 0,           variant: 'purple',  subtitle: 'Data quality failures', delay: 3,
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    },
    { title: 'Recall vs GT',      value: `${evalMetrics?.recall || 0}`,       unit: '%', variant: 'success', subtitle: `${evalMetrics?.truePositives ?? 0}/${evalMetrics?.actualPositives ?? 0} GT positives`, delay: 4,
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
    },
    { title: 'F1 Score',          value: `${evalMetrics?.f1Score || 0}`,      unit: '%', variant: 'warning', subtitle: `Precision ${evalMetrics?.precision ?? 0}%`, delay: 5,
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* ── Dynamic Pipeline Controller ── */}
      <div className="grid grid-cols-3 gap-lg">
        <div className="card col-span-1 animate-fade-in" style={{ padding: '20px', borderLeft: '4px solid var(--color-cyan)' }}>
            <h3 style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>1. Generate Data</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '8px 0 16px' }}>Create new synthetic audit logs.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button className="btn" style={{ backgroundColor: 'var(--color-primary)', color: '#fff', fontSize: '0.85rem' }} onClick={() => generateSynthetic('random')}>
                    🎲 Surprise Random (15-40)
                </button>
                <button className="btn" style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }} onClick={() => generateSynthetic('adversarial')}>
                    🎯 Academic Suite (12)
                </button>
            </div>
        </div>

        <div className="card col-span-2 animate-fade-in" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>2. Available Datasets</h3>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, flex: 1 }}>
                <div style={{ flex: 1, maxHeight: 120, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    {state.datasets.length === 0 ? (
                        <div style={{ padding: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>No datasets found.</div>
                    ) : (
                        state.datasets.map(set => (
                            <button 
                                key={set.id} 
                                onClick={() => setSelectedFolder(set.id)}
                                style={{ 
                                    width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none',
                                    backgroundColor: selectedFolder === set.id ? 'var(--color-cyan-faint)' : 'transparent',
                                    borderLeft: selectedFolder === set.id ? '3px solid var(--color-cyan)' : '3px solid transparent',
                                    color: selectedFolder === set.id ? 'var(--color-cyan)' : 'var(--text-primary)',
                                    cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', transition: 'all 0.2s'
                                }}
                            >
                                {set.name} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>({set.file_count} CSVs)</span>
                            </button>
                        ))
                    )}
                </div>
                <div style={{ width: 160, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <button 
                        className="btn" 
                        disabled={!selectedFolder && state.status !== 'error'}
                        style={{ backgroundColor: 'var(--color-purple)', color: '#fff', width: '100%' }} 
                        onClick={() => runPipeline(selectedFolder)}
                    >
                        Process Chosen
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-5 gap-md">
        {KPI_CARDS.map(c => <KpiCard key={c.title} {...c} />)}
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-2 gap-lg">

        {/* Donut — Anomaly Ratio */}
        <div className="card animate-fade-up delay-4">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Anomaly Category Ratio
          </h3>
          <div style={{ width: '100%', height: 280, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ratioStats}
                  cx="50%" cy="50%"
                  innerRadius={72} outerRadius={108}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                  labelLine={false}
                >
                  {ratioStats.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} opacity={0.9} />
                  ))}
                  <DonutCenter viewBox={{ cx: 0, cy: 0 }} total={state.masterData.length} label="Total Records" />
                </Pie>
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(v, n) => [`${v} (${((v/state.masterData.length)*100).toFixed(1)}%)`, n]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ ...CHART_STYLE, fontSize: 12, paddingTop: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar — Source Platform Breakdown */}
        <div className="card animate-fade-up delay-5">
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Records by Platform
          </h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceBreak} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="platform" tick={CHART_STYLE} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_STYLE} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="normal"    fill={CHART_COLORS.normal}    name="Normal"    radius={[3,3,0,0]} />
                <Bar dataKey="suspicious" fill={CHART_COLORS.suspicious} name="Suspicious" radius={[3,3,0,0]} />
                <Bar dataKey="dq_issue"  fill={CHART_COLORS.dq_issue}  name="DQ Issue"  radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Top Anomalous Interviews Table ── */}
      <div className="card animate-fade-up delay-6">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            Top Anomalous Interviews
          </h3>
          <span className="badge badge-danger">{topAnomalies.length} flagged</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Interview ID</th>
                <th>Platform</th>
                <th>Duration</th>
                <th style={{ minWidth: 160 }}>Anomaly Score</th>
                <th>Category</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {topAnomalies.map((row, idx) => {
                const duration = row['V-01_total_interview_duration_ms'];
                const flagCount = ['flag_too_fast','flag_too_slow','flag_zero_back_nav','flag_low_entropy','flag_uniform_timing','flag_high_back_nav','flag_invalid_ratio','flag_missing_data']
                  .filter(f => row[f] === 1).length;
                const platformClass = row._platform === 'ODK' ? 'badge-odk' : row._platform === 'SurveyCTO' ? 'badge-surveycto' : 'badge-ground-truth';
                return (
                  <tr key={idx}>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{idx + 1}</td>
                    <td className="text-mono text-cyber" style={{ fontWeight: 600 }}>{row.interview_id}</td>
                    <td><span className={`badge ${platformClass}`}>{row._platform}</span></td>
                    <td style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                      {duration ? `${(duration / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td><ScoreBar score={row._score} /></td>
                    <td>
                      <span className={`badge badge-${row._category || 'normal'}`}>
                        {row._category || 'normal'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: flagCount > 5 ? 'var(--color-danger)' : flagCount > 2 ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                        {flagCount} / 8
                      </span>
                    </td>
                  </tr>
                );
              })}
              {topAnomalies.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>No anomalies detected in current dataset.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
