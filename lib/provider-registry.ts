export type ProviderId = 'gemini-core' | 'openai-compatible' | 'anthropic';

export interface ProviderModel {
  id: string;
  name: string;
  provider: ProviderId;
  providerName: string;
  tier?: string;
  contextWindow?: string;
  configured: boolean;
  capabilities: {
    chat: boolean;
    streaming: boolean;
    codingAgent: boolean;
    tools: boolean;
    vision: boolean;
  };
}

export interface ProviderCatalog {
  providers: Array<{
    id: ProviderId;
    name: string;
    configured: boolean;
    status: 'ready' | 'missing_config';
    reason?: string;
  }>;
  models: ProviderModel[];
}

function csvEnv(name: string): string[] {
  return (process.env[name] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function hasAnyEnv(names: string[]) {
  return names.some((name) => Boolean(process.env[name]));
}

export function isGeminiCoreModel(model: string | undefined | null) {
  const value = (model || '').trim();
  return !value || value === 'auto' || value.startsWith('gemini-') || value.startsWith('models/gemini-');
}

export function parseProviderModel(model: string | undefined | null): { provider: ProviderId; model: string } {
  const value = (model || '').trim();

  if (value.startsWith('openai:')) {
    return { provider: 'openai-compatible', model: value.slice('openai:'.length) };
  }

  if (value.startsWith('anthropic:')) {
    return { provider: 'anthropic', model: value.slice('anthropic:'.length) };
  }

  return { provider: 'gemini-core', model: value || 'auto' };
}

export function getExternalProviderCatalog(): ProviderCatalog {
  const openAiConfigured = hasAnyEnv(['OPENAI_API_KEY', 'GGBOND_OPENAI_API_KEY', 'OPENAI_BASE_URL']);
  const anthropicConfigured = hasAnyEnv(['ANTHROPIC_API_KEY', 'GGBOND_ANTHROPIC_API_KEY']);
  const openAiModels = csvEnv('GGBOND_OPENAI_MODELS');
  const anthropicModels = csvEnv('GGBOND_ANTHROPIC_MODELS');

  const models: ProviderModel[] = [
    ...openAiModels.map((model) => ({
      id: `openai:${model}`,
      name: model,
      provider: 'openai-compatible' as const,
      providerName: 'OpenAI-compatible',
      configured: openAiConfigured,
      capabilities: {
        chat: true,
        streaming: true,
        codingAgent: false,
        tools: false,
        vision: false,
      },
    })),
    ...anthropicModels.map((model) => ({
      id: `anthropic:${model}`,
      name: model,
      provider: 'anthropic' as const,
      providerName: 'Anthropic',
      configured: anthropicConfigured,
      capabilities: {
        chat: true,
        streaming: true,
        codingAgent: false,
        tools: false,
        vision: false,
      },
    })),
  ];

  return {
    providers: [
      {
        id: 'openai-compatible',
        name: 'OpenAI-compatible',
        configured: openAiConfigured,
        status: openAiConfigured ? 'ready' : 'missing_config',
        reason: openAiConfigured ? undefined : 'Set OPENAI_API_KEY or OPENAI_BASE_URL, plus GGBOND_OPENAI_MODELS.',
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        configured: anthropicConfigured,
        status: anthropicConfigured ? 'ready' : 'missing_config',
        reason: anthropicConfigured ? undefined : 'Set ANTHROPIC_API_KEY and GGBOND_ANTHROPIC_MODELS.',
      },
    ],
    models,
  };
}

export function buildUnsupportedProviderMessage(model: string | undefined | null) {
  const parsed = parseProviderModel(model);
  return [
    `Provider adapter is not enabled for ${parsed.provider}.`,
    'Gemini CLI Core remains the coding-agent runtime.',
    'External providers are being exposed behind a separate adapter boundary so they cannot be accidentally routed through Gemini CLI Core.',
  ].join(' ');
}
