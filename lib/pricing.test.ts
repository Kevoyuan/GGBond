import { describe, it, expect } from 'vitest';
import { calculateCost, PRICING_RATES } from './pricing';

describe('calculateCost', () => {
  it('calculates cost correctly for default model (gemini-3-pro)', () => {
    const input = 1000;
    const output = 1000;
    const cached = 0;
    const cost = calculateCost(input, output, cached);

    const expectedCost = (input * PRICING_RATES['gemini-3-pro'].input) +
                         (output * PRICING_RATES['gemini-3-pro'].output) +
                         (cached * PRICING_RATES['gemini-3-pro'].cached);

    expect(cost).toBeCloseTo(expectedCost);
  });

  it('calculates cost correctly for specific model (gemini-3-flash)', () => {
    const input = 1000;
    const output = 1000;
    const cached = 0;
    const model = 'gemini-3-flash';
    const cost = calculateCost(input, output, cached, model);

    const expectedCost = (input * PRICING_RATES['gemini-3-flash'].input) +
                         (output * PRICING_RATES['gemini-3-flash'].output) +
                         (cached * PRICING_RATES['gemini-3-flash'].cached);

    expect(cost).toBeCloseTo(expectedCost);
  });

  it('resolves aliases correctly (auto-gemini-3 -> gemini-3-pro)', () => {
    const input = 1000;
    const output = 1000;
    const cached = 0;
    const model = 'auto-gemini-3';
    const cost = calculateCost(input, output, cached, model);

    // auto-gemini-3 maps to gemini-3-pro
    const expectedCost = (input * PRICING_RATES['gemini-3-pro'].input) +
                         (output * PRICING_RATES['gemini-3-pro'].output) +
                         (cached * PRICING_RATES['gemini-3-pro'].cached);

    expect(cost).toBeCloseTo(expectedCost);
  });

  it('handles fallback logic for partial matches (flash + 3 -> gemini-3-flash)', () => {
    const input = 1000;
    const output = 1000;
    const cached = 0;
    const model = 'some-flash-3-model';
    const cost = calculateCost(input, output, cached, model);

    // fallback logic maps to gemini-3-flash
    const expectedCost = (input * PRICING_RATES['gemini-3-flash'].input) +
                         (output * PRICING_RATES['gemini-3-flash'].output) +
                         (cached * PRICING_RATES['gemini-3-flash'].cached);

    expect(cost).toBeCloseTo(expectedCost);
  });

  it('defaults to gemini-3-pro for unknown models', () => {
    const input = 1000;
    const output = 1000;
    const cached = 0;
    const model = 'unknown-model';
    const cost = calculateCost(input, output, cached, model);

    const expectedCost = (input * PRICING_RATES['gemini-3-pro'].input) +
                         (output * PRICING_RATES['gemini-3-pro'].output) +
                         (cached * PRICING_RATES['gemini-3-pro'].cached);

    expect(cost).toBeCloseTo(expectedCost);
  });

  it('handles zero tokens correctly', () => {
    const cost = calculateCost(0, 0, 0);
    expect(cost).toBe(0);
  });

  it('calculates cached tokens cost correctly', () => {
    const input = 0;
    const output = 0;
    const cached = 1000;
    const cost = calculateCost(input, output, cached);

    const expectedCost = (cached * PRICING_RATES['gemini-3-pro'].cached);
    expect(cost).toBeCloseTo(expectedCost);
  });
});
