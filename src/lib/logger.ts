import { formatError } from './errors';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

const MAX_ENTRIES = 200;
const entries: LogEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function addEntry(level: LogLevel, message: string) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.shift();
  }
  notify();

  const prefix = `[DeezPDF:${level.toUpperCase()}]`;
  if (level === 'error') {
    console.error(prefix, message);
  } else if (level === 'warn') {
    console.warn(prefix, message);
  } else {
    console.log(prefix, message);
  }
}

export const logger = {
  info: (msg: string) => addEntry('info', msg),
  warn: (msg: string) => addEntry('warn', msg),
  error: (msg: string) => addEntry('error', msg),
  debug: (msg: string) => addEntry('debug', msg),
  logError: (msg: string, err: unknown) => addEntry('error', `${msg}: ${formatError(err)}`),
  getEntries: (): readonly LogEntry[] => entries.slice(-50),
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
