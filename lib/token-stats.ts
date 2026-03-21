export interface PerModelTokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
}

export interface NormalizedTokenStats {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  totalCost: number;
  durationMs: number;
  perModelUsage: PerModelTokenUsage[];
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeUsageEntry(raw: unknown): PerModelTokenUsage | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const entry = raw as Record<string, unknown>;
  const model =
    readString(entry.model) ||
    readString(entry.modelName) ||
    readString(entry.name) ||
    'unknown';
  const inputTokens =
    readNumber(entry.input_tokens) ||
    readNumber(entry.inputTokenCount) ||
    readNumber(entry.promptTokenCount) ||
    readNumber(entry.prompt_tokens);
  const outputTokens =
    readNumber(entry.output_tokens) ||
    readNumber(entry.outputTokenCount) ||
    readNumber(entry.candidatesTokenCount) ||
    readNumber(entry.candidates_tokens);
  const cachedTokens =
    readNumber(entry.cached_content_token_count) ||
    readNumber(entry.cachedContentTokenCount) ||
    readNumber(entry.cached_tokens) ||
    readNumber(entry.cachedTokens);
  const thoughtsTokens =
    readNumber(entry.thoughts_token_count) ||
    readNumber(entry.thoughtsTokenCount);
  const totalTokens =
    readNumber(entry.total_tokens) ||
    readNumber(entry.totalTokenCount) ||
    inputTokens + outputTokens + cachedTokens + thoughtsTokens;

  return {
    model,
    inputTokens,
    outputTokens,
    cachedTokens,
    thoughtsTokens,
    totalTokens,
  };
}

function extractPerModelUsage(stats: Record<string, unknown>): PerModelTokenUsage[] {
  const candidates = [
    stats.perModelUsage,
    stats.per_model_usage,
    stats.modelUsage,
    stats.model_usage,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue;
    }

    const normalized = candidate
      .map(normalizeUsageEntry)
      .filter((entry): entry is PerModelTokenUsage => Boolean(entry));

    if (normalized.length > 0) {
      return normalized;
    }
  }

  const fallback = normalizeUsageEntry(stats);
  return fallback ? [fallback] : [];
}

export function normalizeTokenStats(raw: unknown): NormalizedTokenStats | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const stats = raw as Record<string, unknown>;
  const perModelUsage = extractPerModelUsage(stats);

  const aggregate = perModelUsage.reduce(
    (acc, entry) => {
      acc.inputTokens += entry.inputTokens;
      acc.outputTokens += entry.outputTokens;
      acc.cachedTokens += entry.cachedTokens;
      acc.thoughtsTokens += entry.thoughtsTokens;
      acc.totalTokens += entry.totalTokens;
      return acc;
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      thoughtsTokens: 0,
      totalTokens: 0,
    }
  );

  const inputTokens =
    readNumber(stats.input_tokens) ||
    readNumber(stats.inputTokenCount) ||
    readNumber(stats.promptTokenCount) ||
    readNumber(stats.prompt_tokens) ||
    aggregate.inputTokens;
  const outputTokens =
    readNumber(stats.output_tokens) ||
    readNumber(stats.outputTokenCount) ||
    readNumber(stats.candidatesTokenCount) ||
    readNumber(stats.candidates_tokens) ||
    aggregate.outputTokens;
  const cachedTokens =
    readNumber(stats.cached_content_token_count) ||
    readNumber(stats.cachedContentTokenCount) ||
    readNumber(stats.cached) ||
    readNumber(stats.cached_tokens) ||
    aggregate.cachedTokens;
  const thoughtsTokens =
    readNumber(stats.thoughts_token_count) ||
    readNumber(stats.thoughtsTokenCount) ||
    aggregate.thoughtsTokens;
  const totalTokens =
    readNumber(stats.total_tokens) ||
    readNumber(stats.totalTokenCount) ||
    aggregate.totalTokens ||
    inputTokens + outputTokens + cachedTokens + thoughtsTokens;
  const durationMs =
    readNumber(stats.duration_ms) ||
    readNumber(stats.durationMs) ||
    readNumber(stats.duration);
  const totalCost = readNumber(stats.totalCost) || readNumber(stats.total_cost);
  const explicitModel = readString(stats.model);
  const model =
    explicitModel ||
    (perModelUsage.length === 1 ? perModelUsage[0].model : '') ||
    (perModelUsage.length > 1 ? 'mixed' : 'unknown');

  return {
    model,
    inputTokens,
    outputTokens,
    cachedTokens,
    thoughtsTokens,
    totalTokens,
    totalCost,
    durationMs,
    perModelUsage,
  };
}
