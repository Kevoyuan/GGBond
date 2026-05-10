import { afterEach, describe, expect, it } from 'vitest';
import {
  getExternalProviderCatalog,
  isGeminiCoreModel,
  parseProviderModel,
} from '@/lib/provider-registry';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('provider registry', () => {
  it('keeps Gemini CLI Core models on the coding-agent runtime', () => {
    expect(isGeminiCoreModel('gemini-3-pro-preview')).toBe(true);
    expect(isGeminiCoreModel('auto')).toBe(true);
    expect(isGeminiCoreModel('openai:gpt-custom')).toBe(false);
  });

  it('parses provider-prefixed model ids', () => {
    expect(parseProviderModel('openai:gpt-custom')).toEqual({
      provider: 'openai-compatible',
      model: 'gpt-custom',
    });
    expect(parseProviderModel('anthropic:claude-custom')).toEqual({
      provider: 'anthropic',
      model: 'claude-custom',
    });
  });

  it('exposes external models only when configured by env', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.GGBOND_OPENAI_MODELS = 'model-a, model-b';

    const catalog = getExternalProviderCatalog();

    expect(catalog.providers.find((provider) => provider.id === 'openai-compatible')?.configured).toBe(true);
    expect(catalog.models.map((model) => model.id)).toEqual(['openai:model-a', 'openai:model-b']);
  });
});
