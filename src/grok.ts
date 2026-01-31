import OpenAI from 'openai';
import { EnrichedFinding, AnalysisResult, RiskAnalysis } from './types';

// Fallback ranking function
function fallbackRanking(findings: EnrichedFinding[]): AnalysisResult {
  const sorted = findings.sort((a, b) => b.exposureScore - a.exposureScore);
  const top5 = sorted.slice(0, 5).map(f => ({
    title: `Potential ${f.message}`,
    reason: 'Detected by static analysis with high exposure score.',
    impact: 'Unknown business impact (run with AI API for details).',
    fix: 'Review code snippet and apply best practices.',
    confidence: 'Medium' as const,
    originalFinding: f
  }));

  return { topRisks: top5, isFallback: true };
}

export async function callGrokAPI(findings: EnrichedFinding[]): Promise<AnalysisResult> {
  // Use GROQ_API_KEY as per existing env var, or maybe GROK_API_KEY if user provided?
  // The prompt says "Replace Gemini with Grok API".
  // Existing code used GROQ_API_KEY. I'll stick to that or check both.
  const apiKey = process.env.GROK_API_KEY || process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.warn('No API key found for Grok (GROK_API_KEY or GROQ_API_KEY). Using fallback.');
    return fallbackRanking(findings);
  }

  try {
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });

    // Batching strategy similar to original but focused on top risks
    const BATCH_SIZE = 20;
    const sortedFindings = findings.sort((a, b) => b.exposureScore - a.exposureScore);
    const findingsToAnalyze = sortedFindings.slice(0, BATCH_SIZE); // Only analyze top 20 for speed/cost

    const findingsJson = JSON.stringify(findingsToAnalyze.map((f, i) => ({
      id: i,
      rule: f.ruleId,
      file: f.file,
      line: f.line,
      code: f.codeSnippet ? f.codeSnippet.slice(0, 300) : '',
      msg: f.message
    })));

    const prompt = `
    You are a Senior Security Engineer using the Grok engine. Analyze these SAST findings.
    Identify the Top 3 most critical business risks.

    FINDINGS:
    ${findingsJson}

    INSTRUCTIONS:
    1. Verify if the vulnerability is real based on 'code'.
    2. Prioritize based on BUSINESS IMPACT.
    3. Return valid JSON only.
    4. Do not invent vulnerabilities.
    
    OUTPUT FORMAT:
    {
      "topRisks": [
        {
          "title": "Concise Title",
          "reason": "Why vulnerable",
          "impact": "Business Impact",
          "fix": "Fix",
          "confidence": "High" | "Medium",
          "originalId": 0
        }
      ]
    }
    `;

    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: process.env.GROK_MODEL || 'llama-3.3-70b-versatile', // Default to a good model on Groq
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from Grok');

    const parsed = JSON.parse(content);
    const risks = parsed.topRisks || parsed.risks || [];

    const mappedRisks: RiskAnalysis[] = risks.map((risk: any) => ({
      title: risk.title,
      reason: risk.reason,
      impact: risk.impact,
      fix: risk.fix,
      confidence: risk.confidence,
      originalFinding: findingsToAnalyze[risk.originalId] || findingsToAnalyze[0]
    }));

    return { topRisks: mappedRisks };

  } catch (error) {
    console.error('Grok API failed:', error);
    return fallbackRanking(findings);
  }
}
