/**
 * ZeroHour – What Changed Since Last Run (delta risk).
 * Compares current TOP 3 with last run; writes .zerohour-last.json for next run.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DetectedFailure } from './types';

const LAST_RUN_FILE = '.zerohour-last.json';

export interface LastRunSnapshot {
  cwd: string;
  timestamp: string;
  findings: Array<{ file: string; line: number; ruleId: string }>;
}

export interface DeltaResult {
  new: DetectedFailure[];
  gone: Array<{ file: string; line: number; ruleId: string }>;
  same: DetectedFailure[];
  hasLastRun: boolean;
}

function key(f: { file: string; line: number; ruleId: string }): string {
  return `${f.file}:${f.line}:${f.ruleId}`;
}

export function loadLastRun(rootDir: string): LastRunSnapshot | null {
  const filePath = path.join(rootDir, LAST_RUN_FILE);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as LastRunSnapshot;
    if (data.findings && Array.isArray(data.findings)) return data;
  } catch {
    // no file or invalid
  }
  return null;
}

export function saveLastRun(rootDir: string, top3: DetectedFailure[]): void {
  const filePath = path.join(rootDir, LAST_RUN_FILE);
  const snapshot: LastRunSnapshot = {
    cwd: rootDir,
    timestamp: new Date().toISOString(),
    findings: top3.map((f) => ({ file: f.file, line: f.line, ruleId: f.ruleId })),
  };
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
}

export function computeDelta(
  rootDir: string,
  currentTop3: DetectedFailure[]
): DeltaResult {
  const last = loadLastRun(rootDir);
  const currentKeys = new Set(currentTop3.map(key));
  const lastKeys = new Set(
    last ? last.findings.map((f) => key({ file: f.file, line: f.line, ruleId: f.ruleId })) : []
  );

  const newFindings = currentTop3.filter((f) => !lastKeys.has(key(f)));
  const sameFindings = currentTop3.filter((f) => lastKeys.has(key(f)));
  const goneFindings = last
    ? last.findings.filter((f) => !currentKeys.has(key(f)))
    : [];

  return {
    new: newFindings,
    gone: goneFindings,
    same: sameFindings,
    hasLastRun: last !== null,
  };
}
