/**
 * @fileoverview Chart configuration and design tokens.
 * Single source of truth for all chart aesthetics.
 */

export const CHART_COLORS = {
  normal:        '#00d4ff',
  suspicious:    '#ff6b2b',
  dq_issue:      '#9467bd',
  fabrication:   '#ff4757',
  disengagement: '#f5a623',
  odk:           '#00d4ff',
  surveycto:     '#9467bd',
  groundTruth:   '#f5a623',
  grid:          'rgba(255,255,255,0.04)',
  axis:          '#2d3748',
  tooltip_bg:    '#111827',
};

export const CHART_STYLE = {
  fontSize: 11,
  fontFamily: 'Inter, system-ui, sans-serif',
  fill: '#4a5568',
};

export const CHART_AXIS_STYLE = {
  stroke: 'rgba(255,255,255,0.04)',
};

export const CHART_TOOLTIP_STYLE = {
  background:   '#111827',
  border:       '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color:        '#e8eaf0',
  fontSize:     13,
};

export const CATEGORY_COLORS = {
  normal:    '#00d4ff',
  suspicious: '#ff6b2b',
  dq_issue:  '#9467bd',
};

export const PLATFORM_COLORS = {
  ODK:          '#00d4ff',
  SurveyCTO:    '#9467bd',
  'Ground Truth': '#f5a623',
};
