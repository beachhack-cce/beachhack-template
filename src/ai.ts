import { EnrichedFinding, AnalysisResult } from './types';
import { callGrokAPI } from './grok';
import OpenAI from 'openai';
import * as path from 'path';
import * as fs from 'fs';

// Re-export types if needed or just use them
export interface AiFixResult {
  replacementCode: string;
  imports: string[];
  explanation: string;
}

export async function prioritizeRisks(findings: EnrichedFinding[]): Promise<AnalysisResult> {
  return await callGrokAPI(findings);
}

/**
 * Generates a code fix for a specific finding using Groq AI.
 * (Keeping this here for now as the prompt focused on prioritization, 
 * but ideally this should also move to grok.ts or similar)
 */
export async function generateFix(finding: EnrichedFinding, rootPath?: string): Promise<AiFixResult> {
  const apiKey = process.env.GROK_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not found');

  // Read file context
  let fileContext = '';
  try {
    const baseDir = rootPath || process.cwd();
    const filePath = path.join(baseDir, path.basename(finding.file));
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      
      // Get context: 5 lines before and after
      const start = Math.max(0, (finding.line - 1) - 5);
      const end = Math.min(lines.length, (finding.endLine || finding.line) + 5);
      
      // Add line numbers for AI reference
      fileContext = lines.slice(start, end)
        .map((line, idx) => `${start + idx + 1}: ${line}`)
        .join('\n');
    }
  } catch (e) {
    console.warn('Could not read file for context, using snippet only.');
    fileContext = finding.codeSnippet || '';
  }

  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const prompt = `
  You are a Senior Secure Code Expert. 
  Fix the following security vulnerability.
  
  VULNERABILITY: ${finding.message}
  FILE: ${finding.file}
  
  CODE CONTEXT (with line numbers):
  ${fileContext}

  TARGET LINES TO FIX: ${finding.line} - ${finding.endLine || finding.line}

  INSTRUCTIONS:
  1. Provide the EXACT code that should replace the target lines.
  2. If the fix requires new imports, list them separately.
  3. Ensure the code fits seamlessly into the surrounding context.
  4. Return valid JSON only.

  OUTPUT FORMAT:
  {
    "replacementCode": "const x = ...",
    "imports": ["import { x } from 'y'"],
    "explanation": "Why this fixes it"
  }
  `;

  const completion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: process.env.GROK_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.1,
    response_format: { type: 'json_object' }
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from AI');

  const parsed = JSON.parse(content);
  return {
    replacementCode: parsed.replacementCode || '',
    imports: parsed.imports || [],
    explanation: parsed.explanation || 'Fixed based on AI recommendation.'
  };
}
