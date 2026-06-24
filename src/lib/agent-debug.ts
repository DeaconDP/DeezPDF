import { isNativeApp } from './platform';
import { logger } from './logger';

const DEBUG_LOG_KEY = 'deezpdf-agent-debug';
const DEBUG_ENDPOINT = 'http://127.0.0.1:7296/ingest/a6762bc3-97cb-4402-991f-d8e4f5d10d72';
const SESSION_ID = '91acfb';

export function agentDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'post-fix',
): void {
  const payload = {
    sessionId: SESSION_ID,
    location,
    message,
    data,
    timestamp: Date.now(),
    hypothesisId,
    runId,
  };

  logger.info(`[debug] ${location}: ${message} ${JSON.stringify(data)}`);

  if (isNativeApp()) {
    try {
      const prev = JSON.parse(localStorage.getItem(DEBUG_LOG_KEY) ?? '[]') as unknown[];
      prev.push(payload);
      localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(prev.slice(-40)));
    } catch {
      // ignore storage failures
    }
  }

  // #region agent log
  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': SESSION_ID,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
}

export function readAgentDebugLog(): readonly Record<string, unknown>[] {
  try {
    return JSON.parse(localStorage.getItem(DEBUG_LOG_KEY) ?? '[]') as Record<string, unknown>[];
  } catch {
    return [];
  }
}
