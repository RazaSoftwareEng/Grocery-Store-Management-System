/**
 * Utility functions for formatting currencies, dates, and numbers.
 * Dates are shown in the store time zone.
 */

import { getStoreTimeZone } from './dates';

export function formatCurrency(amount, symbol = 'Rs.') {
  const num = Number(amount) || 0;
  return `${symbol} ${num.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatNumber(value) {
  const num = Number(value) || 0;
  return num.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-PK', {
      timeZone: getStoreTimeZone(),
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function formatShortDate(dateString) {
  if (!dateString) return '—';
  try {
    // plain 'YYYY-MM-DD' values are calendar days, not moments
    const isDay = /^\d{4}-\d{2}-\d{2}$/.test(String(dateString));
    const d = new Date(isDay ? `${dateString}T12:00:00Z` : dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-PK', {
      timeZone: isDay ? 'UTC' : getStoreTimeZone(),
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatTime(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleTimeString('en-PK', { timeZone: getStoreTimeZone(), hour: '2-digit', minute: '2-digit' });
}

// Units that may be sold in fractions (kg, litre, ...). Must match _is_weighted_unit() in schema.sql
const WEIGHTED_UNITS = new Set(['kg', 'kilogram', 'g', 'gm', 'gms', 'gram', 'grams', 'l', 'ltr', 'litre', 'liter', 'ml', 'meter', 'metre', 'm']);
export const isWeightedUnit = (unit) => WEIGHTED_UNITS.has(String(unit || '').trim().toLowerCase());

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
