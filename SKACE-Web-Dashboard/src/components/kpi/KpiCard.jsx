/**
 * @fileoverview Enhanced KPI Card with icon, trend, and gradient accent.
 */
import React from 'react';

const VARIANTS = {
  cyan:    { color: '#00d4ff', glow: 'rgba(0,212,255,0.15)',   bg: 'rgba(0,212,255,0.06)' },
  danger:  { color: '#ff4757', glow: 'rgba(255,71,87,0.15)',   bg: 'rgba(255,71,87,0.06)' },
  orange:  { color: '#ff6b2b', glow: 'rgba(255,107,43,0.15)',  bg: 'rgba(255,107,43,0.06)' },
  purple:  { color: '#9467bd', glow: 'rgba(148,103,189,0.15)', bg: 'rgba(148,103,189,0.06)' },
  success: { color: '#00c896', glow: 'rgba(0,200,150,0.15)',   bg: 'rgba(0,200,150,0.06)' },
  warning: { color: '#f5a623', glow: 'rgba(245,166,35,0.15)',  bg: 'rgba(245,166,35,0.06)' },
};

export default function KpiCard({ title, value, subtitle, icon, variant = 'cyan', delay = 1, unit = '' }) {
  const theme = VARIANTS[variant] || VARIANTS.cyan;

  return (
    <div
      className={`animate-fade-up delay-${delay}`}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow 0.25s ease, transform 0.2s ease, border-color 0.25s ease',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = `0 0 30px ${theme.glow}, 0 4px 16px rgba(0,0,0,0.3)`;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.borderColor = `${theme.color}33`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
      }}
    >
      {/* Top accent bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, ${theme.color}, transparent)`,
        opacity: 0.8,
      }} />

      {/* Icon + Label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {icon && (
          <div style={{
            width: 34, height: 34,
            borderRadius: 8,
            background: theme.bg,
            border: `1px solid ${theme.color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: theme.color,
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
        <span style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-secondary)',
        }}>
          {title}
        </span>
      </div>

      {/* Value */}
      <div style={{
        fontSize: '2.35rem',
        fontWeight: 800,
        color: theme.color,
        lineHeight: 1,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '-0.02em',
      }}>
        {value}{unit && <span style={{ fontSize: '1rem', opacity: 0.7, marginLeft: 3 }}>{unit}</span>}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
