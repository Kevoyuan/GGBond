export async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJsonWithRetry<T>(
    input: string,
    init?: RequestInit,
    options?: {
        retries?: number;
        retryDelayMs?: number;
        shouldRetry?: (response: Response, data: unknown) => boolean;
    }
): Promise<{ response: Response; data: T }> {
    const retries = options?.retries ?? 4;
    const retryDelayMs = options?.retryDelayMs ?? 250;
    const shouldRetry = options?.shouldRetry ?? ((response, data) => {
        if (!response.ok) {
            return response.status >= 500 || response.status === 429 || response.status === 503;
        }

        return Boolean(data && typeof data === 'object' && '_fallback' in (data as Record<string, unknown>));
    });

    let lastResponse: Response | null = null;
    let lastData: unknown = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        const response = await fetch(input, init);
        let data: unknown = null;

        try {
            data = await response.json();
        } catch {
            data = null;
        }

        lastResponse = response;
        lastData = data;

        if (!shouldRetry(response, data) || attempt === retries) {
            return { response, data: data as T };
        }

        await sleep(retryDelayMs * (attempt + 1));
    }

    return { response: lastResponse as Response, data: lastData as T };
}
