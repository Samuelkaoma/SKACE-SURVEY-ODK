/**
 * @fileoverview Pure functions to derive UX data from the raw SKACE-Time-Data CSV rows.
 * Handles both old True/False string flags and new 0/1 integer flags from the pipeline.
 */

/** Normalize a flag value from either string "True"/"False" or integer 0/1 */
function norm(val) {
  return (val === true || val === 'True' || val === 1 || val === '1') ? 1 : 0;
}

/** Determine source platform from file_name field */
function getPlatform(row) {
  const fn = (row.file_name || '').toLowerCase();
  if (fn.includes('odk')) return 'ODK';
  if (fn.includes('surveycto') || fn.includes('cto')) return 'SurveyCTO';
  if (fn.includes('ground_truth')) return 'Ground Truth';
  return fn || 'Unknown';
}

/**
 * Normalize a single CSV row — fixes flag fields and adds _platform label
 * @param {Object} row - raw parsed row
 * @returns {Object} normalized row with integer flags and _platform field
 */
export function normalizeRow(row) {
  const FLAGS = [
    'flag_invalid_ratio', 'flag_missing_data', 'flag_inconsistent_metrics',
    'flag_too_fast', 'flag_too_slow', 'flag_zero_back_nav', 'flag_low_entropy',
    'flag_uniform_timing', 'flag_rule_pause', 'flag_iqr_duration', 'flag_high_back_nav',
    'is_data_quality_issue', 'is_anomalous_behavior', 'is_anomalous',
    'flag_negative_duration', 'V-10_zero_back_nav_flag', 'Q-04_revisit_flag',
  ];
  const out = { ...row };
  FLAGS.forEach(k => { out[k] = norm(row[k]); });
  out._platform = getPlatform(row);
  // Unified anomaly category (handles both field names)
  out._category = (row.anomaly_category || row.computed_category || 'normal').toString().toLowerCase();
  // Unified anomaly score (integer 0-10)
  out._score = parseFloat(row.anomaly_score ?? row.computed_anomaly_score ?? 0);
  if (isNaN(out._score)) out._score = 0;
  // Unified anomalous flag
  out._isAnomalous = out.is_anomalous === 1 || out.is_anomalous_behavior === 1;
  return out;
}

/**
 * Normalize all rows in the dataset
 */
export function normalizeDataset(rows) {
  return rows.map(normalizeRow);
}

/**
 * Calculate KPIs including precision/recall computed against ground truth labels.
 * Ground truth file labels ALL its IDs as anomalous — we cross-reference against
 * real pipeline results from ODK and SurveyCTO to derive precision and recall.
 */
export function getKpis(masterData) {
  if (!masterData || masterData.length === 0) return null;

  // Separate real interviews from ground truth label file
  const realInterviews = masterData.filter(r => r._platform !== 'Ground Truth');
  const gtRows         = masterData.filter(r => r._platform === 'Ground Truth');

  // All ground truth IDs are positive (anomalous) by definition
  const gtPositiveIds = new Set(gtRows.map(r => r.interview_id));

  // Real interviews that correspond to ground truth IDs
  const realMatchingGT = realInterviews.filter(r => gtPositiveIds.has(r.interview_id));

  // True Positives: real interviews that matched GT AND were flagged by pipeline
  const truePositives = realMatchingGT.filter(r => r._isAnomalous).length;
  const actualPositives = gtRows.length; // GT treats every entry as positive

  const recall = actualPositives > 0 ? truePositives / actualPositives : 0;

  // Precision: among all flagged real interviews, how many are confirmed by GT
  const allFlaggedReal = realInterviews.filter(r => r._isAnomalous);
  const confirmedFlagged = allFlaggedReal.filter(r => gtPositiveIds.has(r.interview_id)).length;
  const precision = allFlaggedReal.length > 0 ? confirmedFlagged / allFlaggedReal.length : 0;

  const f1 = (precision + recall) > 0
    ? 2 * precision * recall / (precision + recall)
    : 0;

  // Category counts across all records
  const suspiciousCount = masterData.filter(r => r._category === 'suspicious').length;
  const dqCount         = masterData.filter(r => r._category === 'dq_issue').length;
  const normalCount     = masterData.filter(r => r._category === 'normal').length;

  // Mean score on real interviews only
  const avgScore = realInterviews.length > 0
    ? realInterviews.reduce((acc, r) => acc + (r._score || 0), 0) / realInterviews.length
    : 0;

  return {
    totalInterviews:  masterData.length,
    realInterviews:   realInterviews.length,
    anomaliesCaught:  masterData.filter(r => r._isAnomalous).length,
    suspiciousCount,
    dqCount,
    normalCount,
    precision:        (precision * 100).toFixed(1),
    recall:           (recall * 100).toFixed(1),
    f1Score:          (f1 * 100).toFixed(1),
    meanAnomalyScore: avgScore.toFixed(2),
    truePositives,
    actualPositives,
  };
}

/**
 * Groups anomalies by category for donut chart
 */
export function getAnomalyRatioStats(masterData) {
  if (!masterData || masterData.length === 0) return [];
  const counts = { normal: 0, suspicious: 0, dq_issue: 0 };
  masterData.forEach(row => {
    const cat = row._category || 'normal';
    if (counts[cat] !== undefined) counts[cat]++;
    else counts.normal++;
  });
  return [
    { name: 'Normal',    value: counts.normal,    fill: '#00d4ff' },
    { name: 'Suspicious',value: counts.suspicious, fill: '#ff6b2b' },
    { name: 'DQ Issue',  value: counts.dq_issue,  fill: '#9467bd' },
  ].filter(i => i.value > 0);
}

/**
 * Gets breakdown by source platform for comparison bar chart
 */
export function getSourceBreakdown(masterData) {
  if (!masterData || masterData.length === 0) return [];
  const groups = {};
  masterData.forEach(row => {
    const p = row._platform || 'Unknown';
    if (!groups[p]) groups[p] = { platform: p, total: 0, normal: 0, suspicious: 0, dq_issue: 0 };
    groups[p].total++;
    const cat = row._category || 'normal';
    if (groups[p][cat] !== undefined) groups[p][cat]++;
  });
  // Return ODK first, then SurveyCTO, then others
  return Object.values(groups).sort((a, b) => {
    const order = ['ODK', 'SurveyCTO', 'Ground Truth'];
    return order.indexOf(a.platform) - order.indexOf(b.platform);
  });
}

/**
 * Gets flag distribution — how many times each flag fired across all interviews
 */
export function getFlagDistribution(masterData) {
  if (!masterData || masterData.length === 0) return [];
  const FLAG_META = [
    { key: 'flag_too_fast',          label: 'Too Fast' },
    { key: 'flag_too_slow',          label: 'Too Slow' },
    { key: 'flag_zero_back_nav',     label: 'Zero Back-Nav' },
    { key: 'flag_low_entropy',       label: 'Low Entropy' },
    { key: 'flag_uniform_timing',    label: 'Uniform Timing' },
    { key: 'flag_high_back_nav',     label: 'High Back-Nav' },
    { key: 'flag_invalid_ratio',     label: 'Invalid Ratio' },
    { key: 'flag_missing_data',      label: 'Missing Data' },
    { key: 'flag_inconsistent_metrics', label: 'Inconsistent Metrics' },
    { key: 'flag_rule_pause',        label: 'Pause Rule' },
    { key: 'flag_iqr_duration',      label: 'IQR Duration' },
  ];
  return FLAG_META.map(f => ({
    name:  f.label,
    count: masterData.filter(r => r[f.key] === 1).length,
    key:   f.key,
  })).sort((a, b) => b.count - a.count);
}

/**
 * Gets triggered flags for a single (normalized) row
 */
export function getTriggeredFlags(row) {
  const FLAG_META = {
    flag_too_fast:             { label: 'Too Fast',            color: '#ff4757' },
    flag_too_slow:             { label: 'Too Slow',            color: '#f5a623' },
    flag_zero_back_nav:        { label: 'Zero Back-Nav',       color: '#ff6b2b' },
    flag_low_entropy:          { label: 'Low Entropy',         color: '#9467bd' },
    flag_uniform_timing:       { label: 'Uniform Timing',      color: '#9467bd' },
    flag_high_back_nav:        { label: 'High Back-Nav',       color: '#ff4757' },
    flag_invalid_ratio:        { label: 'Invalid Ratio',       color: '#ff4757' },
    flag_missing_data:         { label: 'Missing Data',        color: '#ff6b2b' },
    flag_inconsistent_metrics: { label: 'Inconsistent',        color: '#f5a623' },
    flag_rule_pause:           { label: 'Pause Rule',          color: '#f5a623' },
    flag_iqr_duration:         { label: 'IQR Duration',        color: '#9467bd' },
  };
  return Object.entries(FLAG_META)
    .filter(([key]) => row[key] === 1)
    .map(([key, meta]) => ({ key, ...meta }));
}

/**
 * Computes statistical summary for a given feature column
 */
export function getFeatureSummary(masterData, featureKey) {
  if (!masterData || masterData.length === 0) return null;
  const vals = masterData
    .map(r => parseFloat(r[featureKey]))
    .filter(v => !isNaN(v) && isFinite(v));
  if (vals.length === 0) return null;

  const sorted = [...vals].sort((a, b) => a - b);
  const n    = vals.length;
  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
  const std  = Math.sqrt(variance);
  const q1   = sorted[Math.floor(n * 0.25)];
  const median = sorted[Math.floor(n * 0.5)];
  const q3   = sorted[Math.floor(n * 0.75)];
  const iqr  = q3 - q1;

  // Skewness
  const skew = n > 2
    ? vals.reduce((acc, v) => acc + Math.pow((v - mean) / (std || 1), 3), 0) / n
    : 0;

  return {
    feature: featureKey, n, mean, std, variance,
    min: sorted[0], max: sorted[n - 1],
    median, q1, q3, iqr,
    skewness: skew.toFixed(3),
  };
}

/**
 * Gets score color based on value (0-10 scale)
 */
export function getScoreColor(score) {
  if (score >= 7) return 'var(--color-danger)';
  if (score >= 4) return 'var(--color-warning)';
  if (score >= 1) return '#ff8c5a';
  return 'var(--color-success)';
}

/**
 * Returns color for anomaly category
 */
export function getCategoryColor(category) {
  const map = {
    normal:    '#00d4ff',
    suspicious:'#ff6b2b',
    dq_issue:  '#9467bd',
  };
  return map[category] || '#8892a4';
}
