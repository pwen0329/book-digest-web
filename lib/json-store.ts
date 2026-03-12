import 'server-only';

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

type CacheEntry = {
  mtimeMs: number;
  data: unknown;
};

const jsonCache = new Map<string, CacheEntry>();

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export function resolveWorkspacePath(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}

export function readJsonFile<T>(relativePath: string): T {
  const absolutePath = resolveWorkspacePath(relativePath);
  const stats = statSync(absolutePath);
  const cached = jsonCache.get(absolutePath);

  if (cached && cached.mtimeMs === stats.mtimeMs) {
    return cloneValue(cached.data as T);
  }

  const parsed = JSON.parse(readFileSync(absolutePath, 'utf8')) as T;
  jsonCache.set(absolutePath, { mtimeMs: stats.mtimeMs, data: parsed });
  return cloneValue(parsed);
}

export function writeJsonFile(relativePath: string, value: unknown): void {
  const absolutePath = resolveWorkspacePath(relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  jsonCache.delete(absolutePath);
}

export function invalidateJsonFile(relativePath: string): void {
  jsonCache.delete(resolveWorkspacePath(relativePath));
}