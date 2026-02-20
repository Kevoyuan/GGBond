// Updated: 2026-02-19 based on Google AI official pricing
// Note: Prices shown are for standard context (< 200k tokens for 3 series, < 128k for 1.5 series)
// Long context requests have higher prices (2x for most models)

export interface ModelPricing {
  input: number;
  output: number;
  cached: number;
  contextWindow: number;
  maxOutputTokens: number;
}

export const PRICING_RATES: Record<string, ModelPricing> = {
  // ============ Gemini 3 Series (Latest Flagship) ============
  // Input: $2.00 / 1M (<= 200k), $4.00 / 1M (> 200k)
  // Output: $12.00 / 1M (<= 200k), $18.00 / 1M (> 200k)
  // Context: 1M input, 65,536 output
  'gemini-3-pro': {
    input: 2.00 / 1_000_000,
    output: 12.00 / 1_000_000,
    cached: 0.50 / 1_000_000, // ~1/4 of input
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
  },
  'gemini-3-pro-preview': {
    input: 2.00 / 1_000_000,
    output: 12.00 / 1_000_000,
    cached: 0.50 / 1_000_000,
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
  },
  // Input: $0.50 / 1M
  // Output: $3.00 / 1M
  // Context: 1M input, 65,536 output
  'gemini-3-flash': {
    input: 0.50 / 1_000_000,
    output: 3.00 / 1_000_000,
    cached: 0.125 / 1_000_000,
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
  },
  'gemini-3-flash-preview': {
    input: 0.50 / 1_000_000,
    output: 3.00 / 1_000_000,
    cached: 0.125 / 1_000_000,
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
  },

  // ============ Gemini 2.5 Series (Current Production主力) ============
  // Input: $1.25 / 1M (<= 200k), $2.50 / 1M (> 200k)
  // Output: $10.00 / 1M (<= 200k), $15.00 / 1M (> 200k)
  // Context: 2M input, 65,536 output
  'gemini-2.5-pro': {
    input: 1.25 / 1_000_000,
    output: 10.00 / 1_000_000,
    cached: 0.3125 / 1_000_000, // ~1/4 of input
    contextWindow: 2_000_000,
    maxOutputTokens: 65_536,
  },
  // Input: $0.30 / 1M
  // Output: $2.50 / 1M
  // Context: 1M input, 65,536 output
  'gemini-2.5-flash': {
    input: 0.30 / 1_000_000,
    output: 2.50 / 1_000_000,
    cached: 0.075 / 1_000_000,
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
  },
  // Input: $0.10 / 1M
  // Output: $0.40 / 1M
  // Context: 1M input, 65,536 output
  'gemini-2.5-flash-lite': {
    input: 0.10 / 1_000_000,
    output: 0.40 / 1_000_000,
    cached: 0.025 / 1_000_000,
    contextWindow: 1_000_000,
    maxOutputTokens: 65_536,
  },

  // ============ Gemini 1.5 Series (Stable/Classic) ============
  // Input: $1.25 / 1M (<= 128k), $2.50 / 1M (> 128k)
  // Output: $5.00 / 1M (<= 128k), $10.00 / 1M (> 128k)
  // Context: 2M input, 8,192 output
  'gemini-1.5-pro': {
    input: 1.25 / 1_000_000,
    output: 5.00 / 1_000_000,
    cached: 0.3125 / 1_000_000,
    contextWindow: 2_000_000,
    maxOutputTokens: 8_192,
  },
  // Input: $0.075 / 1M (<= 128k), $0.15 / 1M (> 128k)
  // Output: $0.30 / 1M (<= 128k), $0.60 / 1M (> 128k)
  // Context: 1M input, 8,192 output
  'gemini-1.5-flash': {
    input: 0.075 / 1_000_000,
    output: 0.30 / 1_000_000,
    cached: 0.01875 / 1_000_000,
    contextWindow: 1_000_000,
    maxOutputTokens: 8_192,
  },
  // Input: $0.0375 / 1M
  // Output: $0.15 / 1M
  // Context: 1M input, 8,192 output
  'gemini-1.5-flash-8b': {
    input: 0.0375 / 1_000_000,
    output: 0.15 / 1_000_000,
    cached: 0.009375 / 1_000_000,
    contextWindow: 1_000_000,
    maxOutputTokens: 8_192,
  },
};

// Default to Gemini 3 Pro Preview (active default in CLI core)
export const DEFAULT_PRICING = PRICING_RATES['gemini-3-pro-preview'];

export function getModelInfo(modelName?: string): { pricing: ModelPricing, name: string } {
  let pricing = DEFAULT_PRICING;
  let name = 'gemini-3-pro-preview';

  if (modelName) {
    const normalizedModel = modelName.toLowerCase().replace(/ /g, '-');

    // Exact match first
    if (PRICING_RATES[normalizedModel]) {
      pricing = PRICING_RATES[normalizedModel];
      name = normalizedModel;
      return { pricing, name };
    }

    // Fallback matching
    if (normalizedModel.includes('3') && normalizedModel.includes('pro')) {
      pricing = PRICING_RATES['gemini-3-pro-preview'];
      name = 'gemini-3-pro-preview';
    } else if (normalizedModel.includes('3') && normalizedModel.includes('flash')) {
      pricing = PRICING_RATES['gemini-3-flash-preview'];
      name = 'gemini-3-flash-preview';
    } else if (normalizedModel.includes('2.5') && normalizedModel.includes('pro')) {
      pricing = PRICING_RATES['gemini-2.5-pro'];
      name = 'gemini-2.5-pro';
    } else if (normalizedModel.includes('2.5') && normalizedModel.includes('flash-lite')) {
      pricing = PRICING_RATES['gemini-2.5-flash-lite'];
      name = 'gemini-2.5-flash-lite';
    } else if (normalizedModel.includes('2.5') && normalizedModel.includes('flash')) {
      pricing = PRICING_RATES['gemini-2.5-flash'];
      name = 'gemini-2.5-flash';
    } else if (normalizedModel.includes('1.5') && normalizedModel.includes('pro')) {
      pricing = PRICING_RATES['gemini-1.5-pro'];
      name = 'gemini-1.5-pro';
    } else if (normalizedModel.includes('1.5') && normalizedModel.includes('flash-8b')) {
      pricing = PRICING_RATES['gemini-1.5-flash-8b'];
      name = 'gemini-1.5-flash-8b';
    } else if (normalizedModel.includes('1.5') && normalizedModel.includes('flash')) {
      pricing = PRICING_RATES['gemini-1.5-flash'];
      name = 'gemini-1.5-flash';
    } else if (normalizedModel.includes('flash')) {
      // Generic flash fallback - use 2.5 flash
      pricing = PRICING_RATES['gemini-2.5-flash'];
      name = 'gemini-2.5-flash';
    } else if (normalizedModel.includes('pro')) {
      // Generic pro fallback - use 3 pro
      pricing = PRICING_RATES['gemini-3-pro-preview'];
      name = 'gemini-3-pro-preview';
    }
  }

  return { pricing, name };
}

export function calculateCost(inputTokens: number, outputTokens: number, cachedTokens: number = 0, modelName?: string): number {
  const { pricing } = getModelInfo(modelName);

  return (
    (inputTokens * pricing.input) +
    (outputTokens * pricing.output) +
    (cachedTokens * pricing.cached)
  );
}
