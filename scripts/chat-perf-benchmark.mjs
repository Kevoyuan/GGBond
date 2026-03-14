#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import process from 'node:process';

function parseArgs(argv) {
  const result = {
    url: process.env.CHAT_BENCH_URL || `http://127.0.0.1:${process.env.SIDECAR_PORT || '14321'}/api/chat`,
    prompt: process.env.CHAT_BENCH_PROMPT || 'Reply with a short sentence saying benchmark ok.',
    model: process.env.CHAT_BENCH_MODEL || 'gemini-2.5-flash',
    workspace: process.env.CHAT_BENCH_WORKSPACE || undefined,
    approvalMode: process.env.CHAT_BENCH_APPROVAL_MODE || 'safe',
    systemInstruction: process.env.CHAT_BENCH_SYSTEM || '',
    runs: Number.parseInt(process.env.CHAT_BENCH_RUNS || '1', 10),
    lowLatencyMode: (process.env.CHAT_BENCH_LOW_LATENCY || 'true') !== 'false',
    timeoutMs: Number.parseInt(process.env.CHAT_BENCH_TIMEOUT_MS || '120000', 10),
    output: process.env.CHAT_BENCH_OUTPUT || '',
    includeImages: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--url':
        result.url = next;
        i += 1;
        break;
      case '--prompt':
        result.prompt = next;
        i += 1;
        break;
      case '--model':
        result.model = next;
        i += 1;
        break;
      case '--workspace':
        result.workspace = next;
        i += 1;
        break;
      case '--approval-mode':
        result.approvalMode = next;
        i += 1;
        break;
      case '--system':
        result.systemInstruction = next;
        i += 1;
        break;
      case '--runs':
        result.runs = Number.parseInt(next, 10);
        i += 1;
        break;
      case '--timeout-ms':
        result.timeoutMs = Number.parseInt(next, 10);
        i += 1;
        break;
      case '--output':
        result.output = next;
        i += 1;
        break;
      case '--low-latency':
        result.lowLatencyMode = next !== 'false';
        i += 1;
        break;
      case '--help':
      case '-h':
        result.help = true;
        break;
      default:
        break;
    }
  }

  if (!Number.isFinite(result.runs) || result.runs < 1) {
    result.runs = 1;
  }
  if (!Number.isFinite(result.timeoutMs) || result.timeoutMs < 1000) {
    result.timeoutMs = 120000;
  }

  return result;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/chat-perf-benchmark.mjs [options]

Options:
  --url <url>                 Chat endpoint. Default: http://127.0.0.1:14321/api/chat
  --prompt <text>             Prompt to send
  --model <id>                Model id
  --workspace <path>          Optional workspace path
  --approval-mode <mode>      safe | auto | plan
  --system <text>             Optional system instruction
  --runs <n>                  Number of benchmark runs
  --low-latency <bool>        true | false
  --timeout-ms <n>            Abort timeout per run
  --output <path>             Write JSON report to file
  --help                      Show this help
`);
}

function nowMs() {
  return Number(process.hrtime.bigint()) / 1e6;
}

function round(value) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function summarizeMetric(values) {
  const filtered = values.filter((value) => value != null && Number.isFinite(value));
  if (filtered.length === 0) {
    return { avg: null, min: null, max: null };
  }

  const total = filtered.reduce((sum, value) => sum + value, 0);
  return {
    avg: round(total / filtered.length),
    min: round(Math.min(...filtered)),
    max: round(Math.max(...filtered)),
  };
}

async function runSingleBenchmark(options, runIndex) {
  const startedAt = nowMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Timed out after ${options.timeoutMs}ms`)), options.timeoutMs);
  const sessionId = `bench-${Date.now()}-${runIndex}-${randomUUID()}`;

  const metrics = {
    run: runIndex + 1,
    sessionId,
    httpStatus: null,
    headerMs: null,
    firstChunkMs: null,
    initMs: null,
    firstThoughtMs: null,
    firstMessageMs: null,
    firstToolUseMs: null,
    firstToolResultMs: null,
    firstResultMs: null,
    firstOutputMs: null,
    doneMs: null,
    totalBytes: 0,
    eventCounts: {},
    initEvent: null,
    error: null,
  };

  const setMetricOnce = (key) => {
    if (metrics[key] == null) {
      metrics[key] = round(nowMs() - startedAt);
    }
  };

  try {
    const response = await fetch(options.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        prompt: options.prompt,
        model: options.model,
        systemInstruction: options.systemInstruction,
        sessionId,
        workspace: options.workspace,
        approvalMode: options.approvalMode,
        lowLatencyMode: options.lowLatencyMode,
        modelSettings: {
          maxRetries: 1,
        },
      }),
    });

    metrics.httpStatus = response.status;
    metrics.headerMs = round(nowMs() - startedAt);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}${text ? `: ${text}` : ''}`);
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      metrics.totalBytes += value.byteLength;
      setMetricOnce('firstChunkMs');
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const event = JSON.parse(line);
        const type = String(event.type || 'unknown');
        metrics.eventCounts[type] = (metrics.eventCounts[type] || 0) + 1;

        if (type === 'init') {
          setMetricOnce('initMs');
          metrics.initEvent = event;
        }
        if (type === 'thought') setMetricOnce('firstThoughtMs');
        if (type === 'message') setMetricOnce('firstMessageMs');
        if (type === 'tool_use') setMetricOnce('firstToolUseMs');
        if (type === 'tool_result') setMetricOnce('firstToolResultMs');
        if (type === 'result') setMetricOnce('firstResultMs');
        if (type === 'error' && !metrics.error) {
          metrics.error = event.error?.message || event.error || 'stream error';
        }

        if (metrics.firstOutputMs == null && (type === 'message' || type === 'thought')) {
          metrics.firstOutputMs = round(nowMs() - startedAt);
        }
      }
    }

    metrics.doneMs = round(nowMs() - startedAt);
  } catch (error) {
    metrics.doneMs = round(nowMs() - startedAt);
    metrics.error = error instanceof Error ? error.message : String(error);
  } finally {
    clearTimeout(timeout);
  }

  return metrics;
}

function buildSummary(results) {
  return {
    runs: results.length,
    okRuns: results.filter((result) => !result.error && result.httpStatus === 200).length,
    headerMs: summarizeMetric(results.map((result) => result.headerMs)),
    initMs: summarizeMetric(results.map((result) => result.initMs)),
    firstChunkMs: summarizeMetric(results.map((result) => result.firstChunkMs)),
    firstThoughtMs: summarizeMetric(results.map((result) => result.firstThoughtMs)),
    firstMessageMs: summarizeMetric(results.map((result) => result.firstMessageMs)),
    firstOutputMs: summarizeMetric(results.map((result) => result.firstOutputMs)),
    firstToolUseMs: summarizeMetric(results.map((result) => result.firstToolUseMs)),
    firstToolResultMs: summarizeMetric(results.map((result) => result.firstToolResultMs)),
    firstResultMs: summarizeMetric(results.map((result) => result.firstResultMs)),
    doneMs: summarizeMetric(results.map((result) => result.doneMs)),
    totalBytes: summarizeMetric(results.map((result) => result.totalBytes)),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const results = [];
  for (let i = 0; i < options.runs; i += 1) {
    const result = await runSingleBenchmark(options, i);
    results.push(result);
    console.log(
      `[run ${result.run}] status=${result.httpStatus ?? 'ERR'} header=${result.headerMs ?? '-'}ms init=${result.initMs ?? '-'}ms firstOutput=${result.firstOutputMs ?? '-'}ms done=${result.doneMs ?? '-'}ms${result.error ? ` error=${result.error}` : ''}`
    );
  }

  const report = {
    createdAt: new Date().toISOString(),
    options: {
      url: options.url,
      model: options.model,
      workspace: options.workspace || null,
      approvalMode: options.approvalMode,
      runs: options.runs,
      lowLatencyMode: options.lowLatencyMode,
      promptLength: options.prompt.length,
    },
    summary: buildSummary(results),
    results,
  };

  if (options.output) {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(options.output, JSON.stringify(report, null, 2), 'utf-8');
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
