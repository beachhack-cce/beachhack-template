import { RiskAnalysis } from '../types';
import chalk from 'chalk';
import axios from 'axios';

export async function createJiraIssue(risk: RiskAnalysis, projectKey: string = 'ZH'): Promise<void> {
  const domain = process.env.JIRA_DOMAIN;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const envProjectKey = process.env.JIRA_PROJECT_KEY || projectKey;

  // Fallback to mock if credentials are missing
  if (!domain || !email || !apiToken) {
    console.log(chalk.yellow('\n[JIRA] ⚠️  Credentials not found in .env (JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN).'));
    console.log(chalk.blue(`[JIRA] (Mock) Creating issue for: ${risk.title}`));
    console.log(chalk.gray(`       Project: ${envProjectKey}`));
    return;
  }

  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const url = `https://${domain}/rest/api/3/issue`;

  const issueData = {
    fields: {
      project: {
        key: envProjectKey
      },
      summary: risk.title,
      description: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Impact: ", marks: [{ type: "strong" }] },
              { type: "text", text: risk.impact }
            ]
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Reason: ", marks: [{ type: "strong" }] },
              { type: "text", text: risk.reason }
            ]
          },
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Remediation: ", marks: [{ type: "strong" }] },
              { type: "text", text: risk.fix }
            ]
          }
        ]
      },
      priority: {
        name: mapSeverityToPriority(risk.originalFinding.severity)
      },
      issuetype: {
        name: "Task"
      },
      labels: ["ZeroHour", risk.confidence]
    }
  };

  try {
    console.log(chalk.blue(`\n[JIRA] Creating issue in ${envProjectKey}...`));
    const response = await axios.post(url, issueData, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    console.log(chalk.green(`✅ [JIRA] Issue created successfully: ${response.data.key}`));
    console.log(chalk.dim(`       ${`https://${domain}/browse/${response.data.key}`}`));

  } catch (error: any) {
    console.error(chalk.red('\n❌ [JIRA] Failed to create issue:'));
    if (error.response) {
      console.error(chalk.red(JSON.stringify(error.response.data, null, 2)));
    } else {
      console.error(chalk.red(error.message));
    }
  }
}

function mapSeverityToPriority(severity?: string): string {
  // Map Semgrep severity to your Jira priorities
  // Common Jira defaults: High, Medium, Low
  switch (severity?.toUpperCase()) {
    case 'ERROR': return 'High';
    case 'WARNING': return 'Medium';
    case 'INFO': return 'Low';
    default: return 'Medium';
  }
}
