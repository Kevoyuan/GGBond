import { describe, it, expect } from 'vitest';
import { calculateCost, PRICING_RATES } from '../lib/pricing';

describe('calculateCost', () => {
  it('calculates cost using default gemini-3-pro pricing when no model is provided', () => {
    const inputTokens = 1000;
    const outputTokens = 500;
    const expectedCost = (inputTokens * PRICING_RATES['gemini-3-pro'].input) +
                         (outputTokens * PRICING_RATES['gemini-3-pro'].output);

    const cost = calculateCost(inputTokens, outputTokens);
    expect(cost).toBeCloseTo(expectedCost);
  });

  it('calculates cost for a specific model (gemini-3-flash)', () => {
    const inputTokens = 1000;
    const outputTokens = 500;
    const modelName = 'gemini-3-flash';
    const expectedCost = (inputTokens * PRICING_RATES[modelName].input) +
                         (outputTokens * PRICING_RATES[modelName].output);

    const cost = calculateCost(inputTokens, outputTokens, 0, modelName);
    expect(cost).toBeCloseTo(expectedCost);
  });

  it('calculates cost including cached tokens', () => {
    const inputTokens = 1000;
    const outputTokens = 500;
    const cachedTokens = 200;
    const modelName = 'gemini-3-pro';
    const expectedCost = (inputTokens * PRICING_RATES[modelName].input) +
                         (outputTokens * PRICING_RATES[modelName].output) +
                         (cachedTokens * PRICING_RATES[modelName].cached);

    const cost = calculateCost(inputTokens, outputTokens, cachedTokens, modelName);
    expect(cost).toBeCloseTo(expectedCost);
  });

  it('returns 0 for zero tokens', () => {
    const cost = calculateCost(0, 0, 0);
    expect(cost).toBe(0);
  });

  it('handles model aliases (auto-gemini-3 -> gemini-3-pro)', () => {
    const inputTokens = 1000;
    const outputTokens = 500;
    // auto-gemini-3 is alias for gemini-3-pro
    const expectedCost = (inputTokens * PRICING_RATES['gemini-3-pro'].input) +
                         (outputTokens * PRICING_RATES['gemini-3-pro'].output);

    const cost = calculateCost(inputTokens, outputTokens, 0, 'auto-gemini-3');
    expect(cost).toBeCloseTo(expectedCost);
  });

  it('falls back to default pricing for unknown model names', () => {
    const inputTokens = 1000;
    const outputTokens = 500;
    // Unknown model defaults to gemini-3-pro
    const expectedCost = (inputTokens * PRICING_RATES['gemini-3-pro'].input) +
                         (outputTokens * PRICING_RATES['gemini-3-pro'].output);

    const cost = calculateCost(inputTokens, outputTokens, 0, 'unknown-model-name');
    expect(cost).toBeCloseTo(expectedCost);
  });

  it('resolves partial matches (flash + 3 -> gemini-3-flash)', () => {
    const inputTokens = 1000;
    const outputTokens = 500;
    // Contains "flash" and "3", should resolve to gemini-3-flash
    const expectedCost = (inputTokens * PRICING_RATES['gemini-3-flash'].input) +
                         (outputTokens * PRICING_RATES['gemini-3-flash'].output);

    const cost = calculateCost(inputTokens, outputTokens, 0, 'custom-flash-3-model');
    expect(cost).toBeCloseTo(expectedCost);
  });
});
