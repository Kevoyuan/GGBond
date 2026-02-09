
export interface ModelPricing {
  input: number;
  output: number;
  cached: number;
  contextWindow: number;
}

export const PRICING_RATES: Record<string, ModelPricing> = {
  // Gemini 3 Pro (Preview)
  // Input: $2.00 / 1M (<= 200k context)
  // Output: $12.00 / 1M
  // Cached: $0.20 / 1M
  // Context: 1M (Preview)
  'gemini-3-pro': {
    input: 2.00 / 1_000_000,
    output: 12.00 / 1_000_000,
    cached: 0.20 / 1_000_000,
    contextWindow: 1_048_576, // 1M tokens
  },
  // Gemini 3 Flash (Preview)
  // Input: $0.50 / 1M
  // Output: $3.00 / 1M
  // Context: 1M
  'gemini-3-flash': {
    input: 0.50 / 1_000_000,
    output: 3.00 / 1_000_000,
    cached: 0.05 / 1_000_000,
    contextWindow: 1_048_576, // 1M tokens
  },
  // Gemini 2.5 Pro
  // Context: 2M
  'gemini-2.5-pro': {
    input: 3.50 / 1_000_000, // Assuming similar to 1.5 Pro
    output: 10.50 / 1_000_000,
    cached: 0.875 / 1_000_000,
    contextWindow: 2_097_152, // 2M tokens
  },
  // Gemini 2.5 Flash
  // Context: 1M
  'gemini-2.5-flash': {
    input: 0.35 / 1_000_000, // Assuming similar to 1.5 Flash
    output: 1.05 / 1_000_000,
    cached: 0.0875 / 1_000_000,
    contextWindow: 1_048_576, // 1M tokens
  },
  // Gemini 2.5 Flash Lite
  // Context: 1M
  'gemini-2.5-flash-lite': {
    input: 0.15 / 1_000_000, // Assuming cheaper
    output: 0.60 / 1_000_000,
    cached: 0.04 / 1_000_000,
    contextWindow: 1_048_576, // 1M tokens
  },
};

// Aliases for CLI model names
export const MODEL_ALIASES: Record<string, string> = {
  'auto-gemini-3': 'gemini-3-pro', // Default CLI model
  'auto-gemini-2.5': 'gemini-2.5-pro',
  'gemini-3-pro-preview': 'gemini-3-pro',
  'gemini-3-flash-preview': 'gemini-3-flash',
};

export const DEFAULT_PRICING = PRICING_RATES['gemini-3-pro'];

export function getModelInfo(modelName?: string): { pricing: ModelPricing, name: string } {
  let pricing = DEFAULT_PRICING;
  let name = 'gemini-3-pro';

  if (modelName) {
    const normalizedModel = modelName.toLowerCase();
    // Check direct match or alias
    const resolvedModel = MODEL_ALIASES[normalizedModel] || normalizedModel;
    if (PRICING_RATES[resolvedModel]) {
      pricing = PRICING_RATES[resolvedModel];
      name = resolvedModel;
    }
    // Fallbacks
    else if (normalizedModel.includes('flash') && normalizedModel.includes('3')) {
      pricing = PRICING_RATES['gemini-3-flash'];
      name = 'gemini-3-flash';
    } else if (normalizedModel.includes('2.5') && normalizedModel.includes('pro')) {
      pricing = PRICING_RATES['gemini-2.5-pro'];
      name = 'gemini-2.5-pro';
    } else if (normalizedModel.includes('2.5') && normalizedModel.includes('flash')) {
      pricing = PRICING_RATES['gemini-2.5-flash'];
      name = 'gemini-2.5-flash';
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
