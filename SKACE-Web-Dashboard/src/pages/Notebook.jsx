import React, { useMemo } from 'react';
import { useDataStore } from '../store/useDataStore.jsx';
import { getKpis, getFlagDistribution } from '../utils/dataTransforms.js';

const PLOTS = [
  {
    file: '/plots/anomaly_distribution.png',
    title: 'Anomaly Score Distribution',
    section: 'Detection Analysis',
    caption: 'Distribution of computed anomaly scores across all processed interviews. Higher scores indicate more triggered rules.',
    color: '#ff4757',
  },
  {
    file: '/plots/categorical_pie_chart.png',
    title: 'Category Breakdown',
    section: 'Classification',
    caption: 'Proportion of interviews classified as Normal, Suspicious, or Data Quality Issues by the SKACE pipeline.',
    color: '#00d4ff',
  },
  {
    file: '/plots/duration_vs_variance_scatter.png',
    title: 'Duration vs. Response-Time Variance',
    section: 'Paradata Scatter',
    caption: 'Scatter of total interview duration (ms) against RT variance. Anomalous records (red) cluster in low-duration / low-variance regions.',
    color: '#9467bd',
  },
];

const PIPELINE_STEPS = [
  { label: '1. Ingest', desc: 'SurveyCTO & ODK CSV files', icon: '📥', color: '#00d4ff' },
  { label: '2. Parse', desc: 'Hybrid controller extracts timestamps', icon: '🔬', color: '#00c896' },
  { label: '3. Features', desc: '40 paradata features (V/T/S/Q domains)', icon: '📊', color: '#9467bd' },
  { label: '4. Flag', desc: '11 rule-based anomaly flags', icon: '⚑', color: '#f5a623' },
  { label: '5. Score', desc: 'Composite score 0–10, categorised', icon: '🎯', color: '#ff6b2b' },
  { label: '6. Report', desc: 'Audit CSV + visualisations', icon: '📄', color: '#ff4757' },
];

function MetricBadge({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 20px', background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 10 }}>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
    </div>
  );
}

export default function Notebook() {
  const { state } = useDataStore();
  const kpis     = useMemo(() => getKpis(state.masterData), [state.masterData]);
  const flagDist = useMemo(() => getFlagDistribution(state.masterData), [state.masterData]);

  if (state.status !== 'success') return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
      {state.status === 'loading' ? <div className="spinner" style={{ margin: '0 auto' }} /> : 'Waiting for data…'}
    </div>
  );

  const topFlag = flagDist[0];
  const detectionRate = kpis ? ((kpis.anomaliesCaught / kpis.totalInterviews) * 100).toFixed(1) : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

      {/* ── Evaluation Banner ── */}
      <div className="card animate-fade-up" style={{ background: 'rgba(0,212,255,0.04)', borderColor: 'rgba(0,212,255,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-md)' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
            Evaluation Results — SKACE Anomaly Detection Pipeline
          </span>
          <span className="badge badge-success">v1.0 Final</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-md)' }}>
          <MetricBadge label="Precision"       value={`${kpis?.precision}%`} color="#00c896" />
          <MetricBadge label="Recall vs GT"    value={`${kpis?.recall}%`}    color="#00d4ff" />
          <MetricBadge label="F1 Score"        value={`${kpis?.f1Score}%`}   color="#9467bd" />
          <MetricBadge label="Detection Rate"  value={`${detectionRate}%`}   color="#f5a623" />
          <MetricBadge label="Features Extracted" value="40"                 color="#ff6b2b" />
        </div>
        <div style={{ marginTop: 'var(--space-md)', padding: '12px 16px', background: 'rgba(0,200,150,0.06)', borderRadius: 8, border: '1px solid rgba(0,200,150,0.15)' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <strong style={{ color: '#00c896' }}>Key finding:</strong> The pipeline achieved{' '}
            <span style={{ color: '#00c896', fontWeight: 600 }}>{kpis?.recall}% recall</span> against ground-truth labels,
            correctly flagging {kpis?.truePositives} of {kpis?.actualPositives} known anomalous interviews.
            The most frequently triggered rule was <span style={{ color: '#ff6b2b', fontFamily: 'var(--font-mono)' }}>{topFlag?.name}</span> ({topFlag?.count} records).
          </div>
        </div>
      </div>

      {/* ── Pipeline Architecture ── */}
      <div className="card animate-fade-up delay-1">
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-md)' }}>
          Pipeline Architecture
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
          {PIPELINE_STEPS.map((step, i) => (
            <React.Fragment key={i}>
              <div style={{ textAlign: 'center', padding: '12px 16px', minWidth: 110 }}>
                <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>{step.icon}</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: step.color }}>{step.label}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.3 }}>{step.desc}</div>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div style={{ fontSize: '1rem', color: 'var(--text-muted)', flexShrink: 0, opacity: 0.5 }}>→</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Output Plots ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Pipeline Output Plots
        </h3>
        <span className="badge badge-odk">Generated by SKACE-Time-Data</span>
      </div>

      <div className="grid grid-cols-2 gap-lg">
        {PLOTS.map((plot, i) => (
          <div key={i} className={`card animate-fade-up delay-${i + 2}`} style={{ borderColor: `${plot.color}20` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-md)' }}>
              <span className="badge badge-normal" style={{ borderColor: `${plot.color}40`, color: plot.color, background: `${plot.color}12` }}>
                {plot.section}
              </span>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 600, margin: 0 }}>{plot.title}</h4>
            </div>

            <div style={{ width: '100%', aspectRatio: '16/10', background: 'var(--bg-elevated)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={plot.file}
                alt={plot.title}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={e => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div style={{ display: 'none', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.82rem', padding: 20 }}>
                <span style={{ fontSize: '2rem' }}>🖼</span>
                <span>Plot not found: {plot.file}</span>
                <span style={{ fontSize: '0.72rem' }}>Copy output/plots/ to public/plots/</span>
              </div>
            </div>

            <p style={{ marginTop: 'var(--space-sm)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {plot.caption}
            </p>
          </div>
        ))}

        {/* Summary stats card */}
        <div className="card animate-fade-up delay-5" style={{ borderColor: 'rgba(245,166,35,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-md)' }}>
            <span className="badge" style={{ background: 'rgba(245,166,35,0.1)', color: '#f5a623', border: '1px solid rgba(245,166,35,0.3)' }}>Data Summary</span>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 600, margin: 0 }}>Audit Record Counts</h4>
          </div>
          <div>
            {[
              { label: 'Total Records Processed', val: kpis?.totalInterviews, color: 'var(--text-primary)' },
              { label: 'Real Interviews (ODK + SurveyCTO)', val: kpis?.realInterviews, color: '#00d4ff' },
              { label: 'Anomalous (is_anomalous=1)', val: kpis?.anomaliesCaught, color: '#ff4757' },
              { label: 'Suspicious Category', val: kpis?.suspiciousCount, color: '#ff6b2b' },
              { label: 'DQ Issue Category', val: kpis?.dqCount, color: '#9467bd' },
              { label: 'Normal Category', val: kpis?.normalCount, color: '#00c896' },
              { label: 'True Positives vs GT', val: kpis?.truePositives, color: '#00c896' },
              { label: 'Ground Truth Positives', val: kpis?.actualPositives, color: '#f5a623' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: row.color, fontSize: '0.9rem' }}>{row.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Academic Note ── */}
      <div className="card animate-fade-up" style={{ background: 'rgba(148,103,189,0.04)', borderColor: 'rgba(148,103,189,0.2)' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>📚</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, fontSize: '0.9rem' }}>
              Academic Submission Note
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              This dashboard visualises the output of the SKACE-Time-Data paradata extraction pipeline. The system ingests
              SurveyCTO and ODK survey files, extracts 40 behavioural features across four domains (Pacing, Timing, Section, Question),
              applies 11 rule-based anomaly flags, and produces a composite anomaly score. The pipeline was validated against
              ground-truth labels with <strong style={{ color: '#00c896' }}>{kpis?.recall}% recall</strong> and{' '}
              <strong style={{ color: '#00c896' }}>{kpis?.precision}% precision</strong> (F1 = {kpis?.f1Score}%).
              All plots and audit outputs were generated by the accompanying Jupyter notebooks in <code style={{ background:'var(--bg-elevated)', padding:'2px 6px', borderRadius:4, fontSize:'0.78rem' }}>SKACE-Time-Data/notebooks/</code>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
