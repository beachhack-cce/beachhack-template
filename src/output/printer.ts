/**
 * ZeroHour – terminal output (chalk + boxen).
 * TOP 3 only; Risk Story, Blast Radius, Decision Trace; optional delta.
 */

import chalk from 'chalk';
import boxen from 'boxen';
import { DetectedFailure } from '../types';
import {
  failureScenario,
  fixNowBullets,
  failureTitle,
  riskStorySteps,
  blastRadiusText,
} from '../explain/translate';
import { DeltaResult } from '../delta';

const BORDER_CHAR = '━';
const BORDER_LINE = BORDER_CHAR.repeat(34);

/** Composite score formula (must match scoring/score.ts) */
const SCORE_WEIGHTS = { businessImpact: 1.5, exposure: 1.2, likelihood: 1.0, abuseEase: 0.8 };

function compositeScore(f: DetectedFailure): number {
  return (
    f.businessImpactScore * SCORE_WEIGHTS.businessImpact +
    f.exposureScore * SCORE_WEIGHTS.exposure +
    f.likelihoodScore * SCORE_WEIGHTS.likelihood +
    f.abuseEaseScore * SCORE_WEIGHTS.abuseEase
  );
}

function whyBullets(f: DetectedFailure): string[] {
  const parts: string[] = [];
  if (f.whyItMatters) parts.push(f.whyItMatters);
  if (f.businessImpact) parts.push(`Business impact: ${f.businessImpact}`);
  return parts.length ? parts : ['This pattern can cause failures under load or invalid input.'];
}

export function printTop3(
  failures: DetectedFailure[],
  options?: { delta?: DeltaResult }
): string {
  const lines: string[] = [];
  const delta = options?.delta;

  lines.push('');
  lines.push(chalk.red(BORDER_LINE));
  lines.push(chalk.red.bold(' 🚨 TOP 3 FAILURE RISKS (ZeroHour) '));
  lines.push(chalk.red(BORDER_LINE));
  lines.push('');

  const top3 = failures.slice(0, 3);
  if (top3.length === 0) {
    lines.push(chalk.gray('No failure patterns detected in the scanned files.'));
    if (delta?.hasLastRun) {
      lines.push('');
      lines.push(printDeltaSection(delta));
    }
    lines.push('');
    return lines.join('\n');
  }

  const labels = ['#1', '#2', '#3'];
  top3.forEach((f, i) => {
    const title = failureTitle(f);
    const why = whyBullets(f);
    const scenario = failureScenario(f);
    const fixBullets = fixNowBullets(f);
    const riskStory = riskStorySteps(f);
    const blastRadius = blastRadiusText(f);
    const composite = compositeScore(f);

    lines.push(chalk.cyan.bold(`${labels[i]} ${title}`));
    lines.push(chalk.gray(`File: ${f.file}:${f.line}`));
    lines.push('');
    lines.push(chalk.white('Why this matters:'));
    why.forEach((b) => lines.push(chalk.white('• ') + b));
    lines.push('');
    lines.push(chalk.white('Failure scenario:'));
    lines.push(chalk.gray(scenario));
    lines.push('');
    lines.push(chalk.yellow('Risk Story — how this becomes an incident:'));
    lines.push(chalk.gray(`  1. ${riskStory[0]}`));
    lines.push(chalk.gray(`  2. ${riskStory[1]}`));
    lines.push(chalk.gray(`  3. ${riskStory[2]}`));
    lines.push('');
    lines.push(chalk.yellow('Blast radius:'));
    lines.push(chalk.gray(`  ${blastRadius}`));
    lines.push('');
    lines.push(chalk.yellow('Decision trace (score):'));
    lines.push(
      chalk.gray(
        `  businessImpact×${SCORE_WEIGHTS.businessImpact} (${f.businessImpactScore}) + ` +
          `exposure×${SCORE_WEIGHTS.exposure} (${f.exposureScore}) + ` +
          `likelihood×${SCORE_WEIGHTS.likelihood} (${f.likelihoodScore}) + ` +
          `abuseEase×${SCORE_WEIGHTS.abuseEase} (${f.abuseEaseScore}) = ${composite.toFixed(1)}`
      )
    );
    lines.push('');
    lines.push(chalk.green('Fix now:'));
    fixBullets.forEach((b) => lines.push(chalk.green('✔ ') + b));
    lines.push('');
    lines.push(chalk.white(`Confidence: ${f.confidence}`));
    lines.push('');
  });

  if (delta?.hasLastRun) {
    lines.push(chalk.red(BORDER_CHAR.repeat(34)));
    lines.push('');
    lines.push(printDeltaSection(delta));
    lines.push('');
  }

  return lines.join('\n');
}

function printDeltaSection(delta: DeltaResult): string {
  const lines: string[] = [];
  lines.push(chalk.magenta.bold('What changed since last run'));
  lines.push('');
  if (delta.new.length > 0) {
    lines.push(chalk.red(`  New risks (${delta.new.length}):`));
    delta.new.forEach((f) =>
      lines.push(chalk.gray(`    • ${f.file}:${f.line} — ${f.ruleId}`))
    );
    lines.push('');
  }
  if (delta.gone.length > 0) {
    lines.push(chalk.green(`  Resolved (${delta.gone.length}):`));
    delta.gone.forEach((f) =>
      lines.push(chalk.gray(`    • ${f.file}:${f.line} — ${f.ruleId}`))
    );
    lines.push('');
  }
  if (delta.same.length > 0) {
    lines.push(chalk.yellow(`  Unchanged (${delta.same.length}):`));
    delta.same.forEach((f) =>
      lines.push(chalk.gray(`    • ${f.file}:${f.line} — ${f.ruleId}`))
    );
  }
  if (delta.new.length === 0 && delta.gone.length === 0 && delta.same.length === 0) {
    lines.push(chalk.gray('  (No overlap with last run; different codebase or first run in this dir.)'));
  }
  return lines.join('\n');
}

export function printDeltaOnly(delta: DeltaResult): string {
  return printDeltaSection(delta);
}

export function printBoxed(
  failures: DetectedFailure[],
  options?: { delta?: DeltaResult }
): string {
  const content = printTop3(failures, options);
  return boxen(content, {
    borderColor: 'red',
    borderStyle: 'round',
    padding: 1,
    margin: 1,
  });
}
