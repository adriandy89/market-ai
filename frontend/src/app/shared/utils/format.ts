/**
 * Format a price like professional exchanges do — decimals based on magnitude.
 * BTC $73,904.52 | ETH $1,823.45 | TRX $0.2971 | SHIB $0.00001234
 */
export function formatPrice(value: number | null | undefined): string {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1000) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (abs >= 1) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (abs >= 0.01) return value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  if (abs >= 0.0001) return value.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
  // Micro-cap or very small indicator values
  return value.toPrecision(4);
}

/**
 * Format a percentage value with 2 decimals.
 */
export function formatPct(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toFixed(2);
}

/**
 * Format large numbers: 1.48T, 48.52B, 395.25M, 12.5K
 */
export function formatCompact(value: number | null | undefined): string {
  if (!value) return '—';
  if (value >= 1e12) return (value / 1e12).toFixed(2) + 'T';
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
  return value.toLocaleString('en-US');
}
