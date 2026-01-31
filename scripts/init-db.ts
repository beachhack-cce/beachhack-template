import * as dotenv from 'dotenv';
import chalk from 'chalk';

// Load .env before importing db
dotenv.config();

async function run() {
  console.log(chalk.cyan('Initializing Database...'));
  
  if (!process.env.DATABASE_URL) {
      console.error(chalk.red('DATABASE_URL is not defined in environment variables.'));
      process.exit(1);
  }

  // Mask password for logging
  const maskedUrl = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@');
  console.log(`Using DATABASE_URL: ${maskedUrl}`);
  
  try {
    // Dynamic import to ensure env vars are loaded first
    const { initDB } = await import('../src/db');
    await initDB();
    console.log(chalk.green('Database initialization completed successfully.'));
  } catch (error) {
    console.error(chalk.red('Database initialization failed:'), error);
    process.exit(1);
  }
}

run();
