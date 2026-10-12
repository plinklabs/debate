// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatDuration, formatNumber } from './format';

describe('formatNumber', () => {
  it('uses a decimal point in English and a decimal comma in Dutch', () => {
    expect(formatNumber('en', 1.5)).toBe('1.5');
    expect(formatNumber('nl', 1.5)).toBe('1,5');
  });

  it('groups thousands the other way round', () => {
    expect(formatNumber('en', 1234.5)).toBe('1,234.5');
    expect(formatNumber('nl', 1234.5)).toBe('1.234,5');
  });

  it('takes Intl options, such as a sign for a vote shift', () => {
    const options = { maximumFractionDigits: 1, signDisplay: 'exceptZero' } as const;
    expect(formatNumber('en', 12.54, options)).toBe('+12.5');
    expect(formatNumber('nl', 12.54, options)).toBe('+12,5');
    expect(formatNumber('nl', 0, options)).toBe('0');
  });

  it('gives the same result for the same options asked again', () => {
    expect(formatNumber('nl', 0.25, { style: 'percent' })).toBe('25%');
    expect(formatNumber('nl', 0.25, { style: 'percent' })).toBe('25%');
    expect(formatNumber('en', 0.25, { style: 'percent' })).toBe('25%');
  });
});

describe('formatDuration', () => {
  it('says minutes and seconds in the language', () => {
    expect(formatDuration('en', 90, 'long')).toBe('1 minute 30 seconds');
    expect(formatDuration('nl', 90, 'long')).toBe('1 minuut 30 seconden');
    expect(formatDuration('en', 90)).toBe('1 min 30 sec');
    expect(formatDuration('nl', 90)).toBe('1 min 30 sec');
  });

  it('leaves out a part that is zero', () => {
    expect(formatDuration('nl', 120, 'long')).toBe('2 minuten');
    expect(formatDuration('nl', 45, 'long')).toBe('45 seconden');
    expect(formatDuration('en', 1, 'long')).toBe('1 second');
  });

  it('says zero in seconds, and never less', () => {
    expect(formatDuration('en', 0, 'long')).toBe('0 seconds');
    expect(formatDuration('nl', -5, 'long')).toBe('0 seconden');
  });

  it('rounds to whole seconds', () => {
    expect(formatDuration('en', 59.6)).toBe('1 min');
    expect(formatDuration('en', 89.4)).toBe('1 min 29 sec');
  });
});
