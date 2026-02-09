
export interface ModelPricing {
  input: number;
  output: number;
  cached: number;
}

export const PRICING_RATES: Record<string, ModelPricing> = {
  // Gemini 3 Pro (Preview)
  // Input: $2.00 / 1M (<= 200k context)
  // Output: $12.00 / 1M
  // Cached: $0.20 / 1M
  'gemini-3-pro': {
    input: 2.00 / 1_000_000,
    output: 12.00 / 1_000_000,
    cached: 0.20 / 1_000_000,
  },
  // Gemini 1.5 Pro
  // Input: $3.50 / 1M (<= 128k context)
  // Output: $10.50 / 1M
  // Cached: $0.875 / 1M
  'gemini-1.5-pro': {
    input: 3.50 / 1_000_000,
    output: 10.50 / 1_000_000,
    cached: 0.875 / 1_000_000,
  },
  // Gemini 1.5 Flash
  // Input: $0.35 / 1M
  // Output: $1.05 / 1M
  // Cached: $0.0875 / 1M
  'gemini-1.5-flash': {
    input: 0.35 / 1_000_000,
    output: 1.05 / 1_000_000,
    cached: 0.0875 / 1_000_000,
  },
};

// Aliases for CLI model names
export const MODEL_ALIASES: Record<string, string> = {
  'auto-gemini-3': 'gemini-3-pro', // Default CLI model
  'gemini-pro': 'gemini-1.5-pro',
  'gemini-flash': 'gemini-1.5-flash',
};

export const DEFAULT_PRICING = PRICING_RATES['gemini-3-pro'];

export function calculateCost(inputTokens: number, outputTokens: number, cachedTokens: number = 0, modelName?: string): number {
  let pricing = DEFAULT_PRICING;

  if (modelName) {
    const normalizedModel = modelName.toLowerCase();
    // Check direct match or alias
    const resolvedModel = MODEL_ALIASES[normalizedModel] || normalizedModel;
    if (PRICING_RATES[resolvedModel]) {
      pricing = PRICING_RATES[resolvedModel];
    }
    // Simple fallback for partial matches
    else if (normalizedModel.includes('flash')) {
      pricing = PRICING_RATES['gemini-1.5-flash'];
    } else if (normalizedModel.includes('1.5') && normalizedModel.includes('pro')) {
      pricing = PRICING_RATES['gemini-1.5-pro'];
    }
  }

  return (
    (inputTokens * pricing.input) +
    (outputTokens * pricing.output) +
    (cachedTokens * pricing.cached)
  );
}
