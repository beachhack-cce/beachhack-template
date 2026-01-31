#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { parseFindings } from './parser';
import { enrichContext } from './context';
import { prioritizeRisks } from './ai';
import { printWelcome, displayResults, displayFullList, spinner } from './ui';
import { analyzeFindingsFile, getFixForFinding } from './api';
import { applyFix } from './fixer';
import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import { initIdentity, getCurrentUserEmail } from './identity';
import { initDB, saveScanResults, createProject } from './db';
import { createJiraIssue } from './integrations/jira';
import { createClickUpTask } from './integrations/clickup';

const execPromise = util.promisify(exec);

// Load .env from multiple locations
// Priority 1: Current Working Directory (Project specific)
const localEnvPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: localEnvPath });

// Priority 2: User Home Directory (Global User Config)
const homeEnvPath = path.resolve(os.homedir(), '.zerohour', '.env');
dotenv.config({ path: homeEnvPath });

// Priority 3: Package Installation Directory (Bundled Config)
const packageEnvPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: packageEnvPath });

const program = new Command();

program
  .name('zerohour')
  .description('SAST prioritization CLI')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize ZeroHour identity')
  .action(async () => {
    await initIdentity();
  });

program
  .command('project')
  .description('Manage projects')
  .argument('<action>', 'Action to perform (create)')
  .argument('<name>', 'Project name')
  .action(async (action, name) => {
    if (action === 'create') {
      let userEmail;
      try {
        userEmail = getCurrentUserEmail();
      } catch (e: any) {
        console.error(e.message);
        process.exit(1);
      }
      
      await initDB();
      await createProject(name, userEmail);
    } else {
      console.log(chalk.red(`Unknown action: ${action}`));
      console.log('Available actions: create');
    }
  });

program
  .command('config')
  .description('Configure integrations (Jira, ClickUp)')
  .argument('<integration>', 'Integration to configure (jira, clickup)')
  .action(async (integration) => {
    if (integration === 'jira') {
      await configureJira();
    } else if (integration === 'clickup') {
      await configureClickUp();
    } else {
      console.log(chalk.red(`Unknown integration: ${integration}`));
      console.log('Available integrations: jira, clickup');
    }
  });

program
  .command('scan')
  .description('Run Semgrep scan and analyze results immediately')
  .argument('[directory]', 'Directory to scan', '.')
  .option('--project <name>', 'Project name')
  .option('--create-jira', 'Create Jira issues')
  .option('--create-clickup', 'Create ClickUp tasks')
  .action(async (directory, options) => {
    printWelcome();
    
    // Default project name to directory name if not provided
    if (!options.project) {
        options.project = path.basename(path.resolve(directory));
    }
    
    // Check for Semgrep
    spinner.start('Checking dependencies...');
    try {
      await execPromise('semgrep --version');
    } catch (e) {
      spinner.fail('Semgrep is not installed or not in PATH.');
      console.log('  Please install Semgrep: brew install semgrep (macOS) or pip install semgrep');
      process.exit(1);
    }
    
    // Check for API Key (Non-blocking warning)
    let apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      spinner.stop();
      console.warn(chalk.yellow('⚠️  GROQ_API_KEY not found in any .env file.'));
      console.warn(chalk.yellow('   Running in OFFLINE mode (Deterministic prioritization only).'));
      spinner.start();
    }

    // Run Scan
    spinner.text = '🔎 Scanning codebase with Semgrep...';
    const findingsFile = path.resolve(process.cwd(), 'findings.json');
    const cpuCount = os.cpus().length;
    
    // Performance optimizations:
    // - jobs: Parallelize scanning
    // - exclude: Skip heavy/irrelevant directories
    // - skip-unknown-extensions: Only scan known code files (speeds up large repos)
    const cmd = `semgrep scan --config auto --json --jobs ${cpuCount} --exclude node_modules --exclude dist --exclude coverage --exclude .git "${directory}" > "${findingsFile}"`;
    
    try {
      // Use --json output for parsing
      await execPromise(cmd).catch(e => {
        // semgrep returns 1 if findings found, which is fine
        if (e.code !== 1 && e.code !== 0) throw e;
      });
      spinner.succeed(`Scan complete. Results saved to ${findingsFile}`);
      
      // Auto-trigger analyze
      await runAnalysis(findingsFile, options);

    } catch (e: any) {
      spinner.fail('Semgrep scan failed');
      console.error(e.message);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .alias('analyse')
  .description('Prioritize risks from an existing findings.json file')
  .argument('[file]', 'Path to findings.json', 'findings.json')
  .option('--project <name>', 'Project name')
  .option('--create-jira', 'Create Jira issues')
  .option('--create-clickup', 'Create ClickUp tasks')
  .action(async (file, options) => {
    printWelcome();
    // Default project name to current folder name if not provided
    if (!options.project) {
        options.project = path.basename(process.cwd());
    }

    await runAnalysis(
      path.join(process.cwd(), file.replace(/\.\.\//g, '').replace(/\//g, '')), 
      options
    );
  });

async function configureJira() {
  console.log(chalk.blue('--- Jira Configuration Setup ---'));
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'domain',
      message: 'Jira Domain (e.g., company.atlassian.net):',
      validate: (input) => input ? true : 'Domain is required'
    },
    {
      type: 'input',
      name: 'email',
      message: 'Jira Email:',
      validate: (input) => input ? true : 'Email is required'
    },
    {
      type: 'password',
      name: 'apiToken',
      message: 'Jira API Token:',
      mask: '*',
      validate: (input) => input ? true : 'API Token is required'
    },
    {
      type: 'input',
      name: 'projectKey',
      message: 'Jira Project Key (e.g., KAN, PROJ):',
      validate: (input) => input ? true : 'Project Key is required'
    }
  ]);

  const configContent = `
JIRA_DOMAIN=${answers.domain}
JIRA_EMAIL=${answers.email}
JIRA_API_TOKEN=${answers.apiToken}
JIRA_PROJECT_KEY=${answers.projectKey}
`;

  // Ask where to save
  const { saveLocation } = await inquirer.prompt([{
    type: 'list',
    name: 'saveLocation',
    message: 'Where should we save this configuration?',
    choices: [
      { name: 'Global (~/.zerohour/.env) - Recommended', value: 'global' },
      { name: 'Local (.env) - Only for this project', value: 'local' }
    ]
  }]);

  if (saveLocation === 'global') {
    const globalDir = path.resolve(os.homedir(), '.zerohour');
    if (!fs.existsSync(globalDir)) fs.mkdirSync(globalDir, { recursive: true });
    const globalEnvPath = path.join(globalDir, '.env');
    fs.appendFileSync(globalEnvPath, configContent);
    console.log(chalk.green(`✅ Jira configuration saved globally to ${globalEnvPath}`));
  } else {
    const envPath = path.resolve(process.cwd(), '.env');
    fs.appendFileSync(envPath, configContent);
    console.log(chalk.green('✅ Jira configuration saved to local .env'));
  }
}

async function configureClickUp() {
  console.log(chalk.magenta('--- ClickUp Configuration Setup ---'));
  
  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiToken',
      message: 'ClickUp API Token (pk_...):',
      mask: '*',
      validate: (input) => input ? true : 'API Token is required'
    },
    {
      type: 'input',
      name: 'listId',
      message: 'ClickUp List ID (e.g., 12345678):',
      validate: (input) => input ? true : 'List ID is required'
    }
  ]);

  const configContent = `
CLICKUP_API_TOKEN=${answers.apiToken}
CLICKUP_LIST_ID=${answers.listId}
`;

  // Ask where to save
  const { saveLocation } = await inquirer.prompt([{
    type: 'list',
    name: 'saveLocation',
    message: 'Where should we save this configuration?',
    choices: [
      { name: 'Global (~/.zerohour/.env) - Recommended', value: 'global' },
      { name: 'Local (.env) - Only for this project', value: 'local' }
    ]
  }]);

  if (saveLocation === 'global') {
    const globalDir = path.resolve(os.homedir(), '.zerohour');
    if (!fs.existsSync(globalDir)) fs.mkdirSync(globalDir, { recursive: true });
    const globalEnvPath = path.join(globalDir, '.env');
    fs.appendFileSync(globalEnvPath, configContent);
    console.log(chalk.green(`✅ ClickUp configuration saved globally to ${globalEnvPath}`));
  } else {
    const envPath = path.resolve(process.cwd(), '.env');
    fs.appendFileSync(envPath, configContent);
    console.log(chalk.green('✅ ClickUp configuration saved to local .env'));
  }
}

async function runAnalysis(filePath: string, options: any = {}) {
  // 0. Identity Check
  let userEmail;
  try {
    userEmail = getCurrentUserEmail();
  } catch (e: any) {
    console.error(e.message);
    process.exit(1);
  }

  // Initialize DB
  await initDB();

  // 1. Check API Key Interactively if missing
  if (!process.env.GROQ_API_KEY) {
    console.log(chalk.yellow('\n⚠️  GROQ_API_KEY not found in .env'));
    const { apiKey } = await inquirer.prompt([{
      type: 'password',
      name: 'apiKey',
      message: 'Enter your Groq AI API Key (gsk_...):',
      mask: '*'
    }]);
    
    process.env.GROQ_API_KEY = apiKey;
    
    // Save to .env (Interactive Choice)
    const { saveLocation } = await inquirer.prompt([{
      type: 'list',
      name: 'saveLocation',
      message: 'Where should we save this API key?',
      choices: [
        { name: 'Global (~/.zerohour/.env) - Recommended for all projects', value: 'global' },
        { name: 'Local (.env) - Only for this project', value: 'local' },
        { name: 'Don\'t save', value: 'none' }
      ]
    }]);

    if (saveLocation === 'global') {
    const globalDir = path.resolve(os.homedir(), '.zerohour');
    if (!fs.existsSync(globalDir)) {
      fs.mkdirSync(globalDir, { recursive: true });
    }
    const globalEnvPath = path.join(globalDir, '.env');
    fs.appendFileSync(globalEnvPath, `\nGROQ_API_KEY=${apiKey}\nGROQ_MODEL=llama-3.3-70b-versatile\n`);
    console.log(chalk.green(`✅ API Key saved globally to ${globalEnvPath}`));
  } else if (saveLocation === 'local') {
    const envPath = path.resolve(process.cwd(), '.env');
    fs.appendFileSync(envPath, `\nGROQ_API_KEY=${apiKey}\nGROQ_MODEL=llama-3.3-70b-versatile\n`);
    console.log(chalk.green('✅ API Key saved to local .env'));
  }
}

// 2. Run Analysis using Core API
  spinner.start('Initializing analysis...');
  try {
    const result = await analyzeFindingsFile(filePath, (msg) => {
      spinner.text = msg;
    });
    
    spinner.succeed('Analysis complete');

    if (result.allFindings.length === 0) {
      console.log(chalk.green('✅ No findings to analyze! Good job.'));
      return;
    }

    // 3. Re-organize findings for continuous numbering
    // Ensure "Top Risks" are indices 1..K, and others follow.
    const topFindings = result.topRisks.map(r => r.originalFinding);
    const topFindingSet = new Set(topFindings);
    const otherFindings = result.allFindings.filter(f => !topFindingSet.has(f));
    
    // Master list: Top Risks followed by the rest
    const sortedAllFindings = [...topFindings, ...otherFindings];

    // DB Persistence
    const projectName = options.project || options.projectName || path.basename(process.cwd());

    // 4. Display Top Risks (Detailed)
    displayResults(result, projectName);
    
    spinner.start('Saving results to database...');
    await saveScanResults(projectName, userEmail, result.topRisks);
    spinner.succeed('Results saved.');

    // Integrations
    if (options.createJira) {
      console.log(chalk.blue('\n--- Jira Integration ---'));
      for (const risk of result.topRisks) {
        await createJiraIssue(risk);
      }
    }

    if (options.createClickUp) {
      console.log(chalk.magenta('\n--- ClickUp Integration ---'));
      for (const risk of result.topRisks) {
        await createClickUpTask(risk);
      }
    }

    // 5. Display Remaining Findings (Summary)
    // Start numbering from (topRisks.length + 1)
    if (otherFindings.length > 0) {
      displayFullList(otherFindings, result.topRisks.length + 1);
    } else {
      console.log(chalk.green('\n✅ No additional findings.'));
    }

    // 6. Interactive Fix Flow
    let fixing = true;
    let firstPass = true;

    while (fixing) {
      const { shouldFix } = await inquirer.prompt([{
        type: 'confirm',
        name: 'shouldFix',
        message: firstPass ? 'Fix a finding with AI?' : 'Fix another finding?',
        default: false
      }]);

      if (!shouldFix) {
        fixing = false;
        break;
      }
      
      firstPass = false;

      const { findingIndex } = await inquirer.prompt([{
        type: 'number',
        name: 'findingIndex',
        message: `Enter the Finding # to fix (1-${sortedAllFindings.length}):`,
        validate: (input) => {
          if (typeof input === 'number' && !isNaN(input) && input >= 1 && input <= sortedAllFindings.length) return true;
          return `Please enter a number between 1 and ${sortedAllFindings.length}`;
        }
      }]);

      const findingToFix = sortedAllFindings[findingIndex - 1];

      if (!findingToFix || !findingToFix.file) {
        console.error(chalk.red('❌ Error: Selected finding is invalid or missing file path.'));
        continue;
      }

      spinner.start('🤖 Generating AI fix...');
      try {
        const fixResult = await getFixForFinding(findingToFix);
        spinner.stop();

        if (!fixResult || !fixResult.replacementCode) {
          console.log(chalk.yellow('⚠️  AI could not generate a fix (empty response).'));
          continue;
        }

        console.log(chalk.bold.green('\n🔍 Proposed Fix:'));
        console.log(chalk.dim('-'.repeat(40)));
        if (fixResult.explanation) {
            console.log(chalk.cyan(fixResult.explanation) + '\n');
        }
        if (fixResult.imports && fixResult.imports.length > 0) {
            console.log(chalk.magenta('Imports to add:'));
            fixResult.imports.forEach(imp => console.log(chalk.gray(`  ${imp}`)));
            console.log('');
        }
        console.log(fixResult.replacementCode);
        console.log(chalk.dim('-'.repeat(40)) + '\n');

        const { apply } = await inquirer.prompt([{
          type: 'confirm',
          name: 'apply',
          message: `Apply this fix to ${findingToFix.file}?`,
          default: true
        }]);

        if (apply) {
          const success = applyFix(findingToFix, fixResult);
          if (success) {
            console.log(chalk.green('✅ Fix applied successfully!'));
            console.log(chalk.yellow('ℹ️  We recommend running tests to verify the change.'));
          }
        }
      } catch (error: any) {
        spinner.fail('Failed to generate fix');
        console.error(chalk.red(error.message));
      }
    }
  } catch (e: any) {
    spinner.fail('Analysis failed');
    console.error(e.message);
  }
}

program.parse(process.argv);
