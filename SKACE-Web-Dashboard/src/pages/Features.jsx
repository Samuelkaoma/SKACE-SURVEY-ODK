import React, { useState, useMemo } from 'react';
import { useDataStore } from '../store/useDataStore.jsx';
import { getFeatureSummary, getFlagDistribution } from '../utils/dataTransforms.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { CHART_COLORS, CHART_STYLE, CHART_TOOLTIP_STYLE } from '../utils/chartTheme.js';

const GROUPS = [
  { label: 'V — Pacing', prefix: 'V-', color: '#00d4ff', desc: 'Interview speed, back-navigation & session timing' },
  { label: 'T — Response Time', prefix: 'T-', color: '#00c896', desc: 'Per-question response time statistics' },
  { label: 'S — Section', prefix: 'S-', color: '#9467bd', desc: 'Within-section pace, pauses & completion' },
  { label: 'Q — Question', prefix: 'Q-', color: '#f5a623', desc: 'Per-field edit, revisit & keystroke patterns' },
];

function StatRow({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ fontSize:'0.82rem', color:'var(--text-muted)' }}>{label}</span>
      <span style={{ fontFamily:'var(--font-mono)', fontSize:'0.85rem', color:'var(--text-primary)', fontWeight:600 }}>{value}</span>
    </div>
  );
}

function BoxPlot({ min, q1, median, q3, max, color }) {
  if (q1 == null) return null;
  const rng = max - min || 1;
  const pct = v => `${((v - min) / rng) * 100}%`;
  return (
    <div style={{ padding:'10px 0' }}>
      <div style={{ position:'relative', height:28, background:'rgba(255,255,255,0.03)', borderRadius:4 }}>
        <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, background:`${color}33`, transform:'translateY(-50%)' }} />
        <div style={{ position:'absolute', top:'15%', bottom:'15%', left:pct(q1), width:`calc(${pct(q3)} - ${pct(q1)})`, background:`${color}22`, border:`1px solid ${color}55`, borderRadius:3 }} />
        <div style={{ position:'absolute', top:'10%', bottom:'10%', left:pct(median), width:2, background:color, borderRadius:1, boxShadow:`0 0 6px ${color}` }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:'0.68rem', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
        <span>{min?.toFixed(1)}</span><span style={{ color }}>{median?.toFixed(1)} med</span><span>{max?.toFixed(1)}</span>
      </div>
    </div>
  );
}

export default function Features() {
  const { state } = useDataStore();
  const [gi, setGi] = useState(0);
  const [feat, setFeat] = useState('V-01_total_interview_duration_ms');

  const byGroup = useMemo(() => {
    if (!state.masterData?.length) return GROUPS.map(() => []);
    const keys = Object.keys(state.masterData[0] || {});
    return GROUPS.map(g => keys.filter(k => k.startsWith(g.prefix)));
  }, [state.masterData]);

  const histData = useMemo(() => {
    if (!state.masterData?.length || !feat) return [];
    const vals = state.masterData.map(r => ({ v: parseFloat(r[feat]), a: r._isAnomalous })).filter(r => !isNaN(r.v) && isFinite(r.v));
    if (!vals.length) return [];
    const min = Math.min(...vals.map(r => r.v)), max = Math.max(...vals.map(r => r.v));
    if (min === max) return [{ name: min.toFixed(1), normal: vals.filter(r=>!r.a).length, anomaly: vals.filter(r=>r.a).length }];
    const B = 15, step = (max-min)/B;
    const bkts = Array.from({ length:B }, (_,i) => ({ name:(min+i*step).toFixed(1), normal:0, anomaly:0 }));
    vals.forEach(r => { let b = Math.floor((r.v-min)/step); if(b>=B) b=B-1; bkts[b][r.a?'anomaly':'normal']++; });
    return bkts;
  }, [state.masterData, feat]);

  const stats   = useMemo(() => getFeatureSummary(state.masterData, feat), [state.masterData, feat]);
  const flagDist = useMemo(() => getFlagDistribution(state.masterData), [state.masterData]);
  const color   = GROUPS[gi].color;

  if (state.status !== 'success') return (
    <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)' }}>
      {state.status==='loading' ? <div className="spinner" style={{ margin:'0 auto' }} /> : 'Waiting for data…'}
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-lg)' }}>

      {/* Group Tabs + Feature Selector */}
      <div className="card" style={{ padding:'var(--space-md)' }}>
        <div style={{ display:'flex', gap:8, marginBottom:'var(--space-md)', flexWrap:'wrap' }}>
          {GROUPS.map((g,i) => (
            <button key={i} onClick={() => { setGi(i); setFeat(byGroup[i]?.[0]||''); }}
              style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${gi===i ? g.color+'66':'var(--border-subtle)'}`,
                background: gi===i ? `${g.color}12`:'transparent', color: gi===i ? g.color:'var(--text-secondary)',
                fontSize:'0.82rem', fontWeight: gi===i ? 600:400, cursor:'pointer', transition:'all 0.18s' }}>
              {g.label}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'var(--space-md)' }}>
          <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', flexShrink:0 }}>Feature:</span>
          <select value={feat} onChange={e=>setFeat(e.target.value)} style={{ flex:1 }}>
            {byGroup[gi].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div style={{ marginTop:6, fontSize:'0.78rem', color:'var(--text-muted)' }}>{GROUPS[gi].desc}</div>
      </div>

      {/* Histogram + Stats */}
      <div className="grid grid-cols-2 gap-lg">
        <div className="card animate-fade-up">
          <h3 style={{ fontSize:'0.88rem', fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'1rem' }}>
            Distribution: {feat}
          </h3>
          <div style={{ height:280 }}>
            {histData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histData} margin={{ top:5, right:5, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ ...CHART_STYLE, fontSize:9 }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={CHART_STYLE} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
                  <Legend iconType="square" iconSize={8} wrapperStyle={{ ...CHART_STYLE, fontSize:11 }} />
                  <Bar dataKey="normal"  stackId="a" fill={color}   name="Normal"    opacity={0.7} />
                  <Bar dataKey="anomaly" stackId="a" fill="#ff4757" name="Anomalous" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="empty-state" style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)' }}>No numeric data for this feature.</div>}
          </div>
        </div>

        <div className="card animate-fade-up delay-1">
          <h3 style={{ fontSize:'0.88rem', fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'var(--space-md)' }}>
            Statistical Summary
          </h3>
          {stats ? (
            <>
              <StatRow label="N (valid)" value={stats.n} />
              <StatRow label="Mean"      value={stats.mean.toFixed(4)} />
              <StatRow label="Std Dev"   value={stats.std.toFixed(4)} />
              <StatRow label="Skewness"  value={stats.skewness} />
              <StatRow label="Min"       value={stats.min.toFixed(4)} />
              <StatRow label="Q1"        value={stats.q1?.toFixed(4)??'—'} />
              <StatRow label="Median"    value={stats.median?.toFixed(4)??'—'} />
              <StatRow label="Q3"        value={stats.q3?.toFixed(4)??'—'} />
              <StatRow label="Max"       value={stats.max.toFixed(4)} />
              <StatRow label="IQR"       value={stats.iqr?.toFixed(4)??'—'} />
              <div style={{ marginTop:'var(--space-md)', borderTop:'1px solid var(--border-subtle)', paddingTop:12 }}>
                <div style={{ fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-muted)', marginBottom:8 }}>Box Plot</div>
                <BoxPlot min={stats.min} q1={stats.q1} median={stats.median} q3={stats.q3} max={stats.max} color={color} />
              </div>
            </>
          ) : <div style={{ color:'var(--text-muted)', fontSize:'0.875rem', padding:'20px 0' }}>No numeric values for this feature.</div>}
        </div>
      </div>

      {/* Flag Distribution */}
      <div className="card animate-fade-up delay-2">
        <h3 style={{ fontSize:'0.88rem', fontWeight:600, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'1rem' }}>
          Rule Flag Trigger Frequency — All Records
        </h3>
        <div style={{ height:220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flagDist} margin={{ top:5, right:10, left:-10, bottom:42 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ ...CHART_STYLE, fontSize:10 }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={CHART_STYLE} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="count" name="Triggered" radius={[4,4,0,0]}>
                {flagDist.map((_,i) => <Cell key={i} fill={i<3?'#ff4757':i<6?'#ff6b2b':'#9467bd'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p style={{ fontSize:'0.75rem', marginTop:4 }}>Sorted by frequency. Each bar shows how many records triggered that anomaly rule.</p>
      </div>
    </div>
  );
}
