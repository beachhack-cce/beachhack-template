import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import inquirer from 'inquirer';
import chalk from 'chalk';

const CONFIG_DIR = path.join(os.homedir(), '.zerohour');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface UserConfig {
  email: string;
}

export async function initIdentity(): Promise<void> {
  console.log(chalk.cyan('Initializing ZeroHour Identity...'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Enter your email:',
      validate: (input: string) => {
        if (!input || !input.includes('@')) {
          return 'Please enter a valid email address.';
        }
        return true;
      },
    },
  ]);

  const email = answers.email.trim();

  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const config: UserConfig = { email };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));

  console.log(chalk.green(`\nIdentity initialized! Stored in ${CONFIG_FILE}`));
  console.log(chalk.gray(`User: ${email}`));
}

export function getCurrentUserEmail(): string {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(
      chalk.red('Identity not found. Please run `zerohour init` first.')
    );
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const config: UserConfig = JSON.parse(content);
    
    if (!config.email) {
      throw new Error('Invalid config: email missing');
    }
    
    return config.email;
  } catch (error) {
    throw new Error(
      chalk.red('Failed to read identity. Please run `zerohour init` to fix.')
    );
  }
}
