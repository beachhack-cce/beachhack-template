import { Pool, PoolConfig } from 'pg';
import chalk from 'chalk';
import { URL } from 'url';

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    let poolConfig: PoolConfig;
    if (process.env.DATABASE_URL) {
      try {
        const dbUrl = new URL(process.env.DATABASE_URL);
        poolConfig = {
          user: dbUrl.username,
          password: dbUrl.password,
          host: dbUrl.hostname,
          port: parseInt(dbUrl.port || '5432'),
          database: dbUrl.pathname.slice(1), // remove leading /
          ssl: {
            rejectUnauthorized: false,
          },
        };
      } catch (e) {
        console.error(chalk.red('Invalid DATABASE_URL'), e);
        poolConfig = { connectionString: process.env.DATABASE_URL };
      }
    } else {
      poolConfig = {};
    }
    pool = new Pool(poolConfig);
  }
  return pool;
}

export async function initDB() {
  if (!process.env.DATABASE_URL) {
    console.warn(chalk.yellow('⚠️  DATABASE_URL not found. Persistence disabled.'));
    return;
  }

  try {
    const client = await getPool().connect();
    try {
      // Create tables if not exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          owner_email VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS scans (
          id SERIAL PRIMARY KEY,
          project_id INTEGER REFERENCES projects(id),
          run_by_email VARCHAR(255) NOT NULL,
          tool_name VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS findings (
          id SERIAL PRIMARY KEY,
          scan_id INTEGER REFERENCES scans(id),
          title TEXT,
          severity VARCHAR(50),
          impact TEXT,
          fix TEXT,
          confidence VARCHAR(50)
        );
      `);
      
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(chalk.red('Failed to initialize database:'), err);
    // Don't crash, just log
  }
}

export async function createProject(projectName: string, userEmail: string): Promise<void> {
  if (!process.env.DATABASE_URL) {
      console.warn(chalk.yellow('⚠️  DATABASE_URL not found. Cannot create project.'));
      return;
  }

  try {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      // Ensure user exists
      await client.query(`
        INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING
      `, [userEmail]);

      // Check if project exists
      const projectRes = await client.query('SELECT id, owner_email FROM projects WHERE name = $1', [projectName]);
      
      if (projectRes.rows.length > 0) {
        console.log(chalk.yellow(`Project "${projectName}" already exists (Owner: ${projectRes.rows[0].owner_email}).`));
      } else {
        await client.query(`
          INSERT INTO projects (name, owner_email) VALUES ($1, $2)
        `, [projectName, userEmail]);
        console.log(chalk.green(`✅ Project "${projectName}" created successfully.`));
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(chalk.red('Failed to create project:'), err);
  }
}

export async function saveScanResults(
  projectName: string,
  userEmail: string,
  risks: any[], // Type from analysis result
  toolName: string = 'semgrep'
) {
  if (!process.env.DATABASE_URL) return;

  try {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');

      // Ensure user exists
      await client.query(`
        INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING
      `, [userEmail]);

      // Ensure project exists (if not, create it with current user as owner - simplified logic)
      let projectId;
      const projectRes = await client.query('SELECT id FROM projects WHERE name = $1', [projectName]);
      if (projectRes.rows.length > 0) {
        projectId = projectRes.rows[0].id;
      } else {
        const newProject = await client.query(`
          INSERT INTO projects (name, owner_email) VALUES ($1, $2) RETURNING id
        `, [projectName, userEmail]);
        projectId = newProject.rows[0].id;
      }

      // Create scan
      const scanRes = await client.query(`
        INSERT INTO scans (project_id, run_by_email, tool_name) VALUES ($1, $2, $3) RETURNING id
      `, [projectId, userEmail, toolName]);
      const scanId = scanRes.rows[0].id;

      // Insert findings
      for (const risk of risks) {
        await client.query(`
          INSERT INTO findings (scan_id, title, severity, impact, fix, confidence)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          scanId,
          risk.title,
          risk.originalFinding?.severity || 'UNKNOWN',
          risk.impact,
          risk.fix,
          risk.confidence
        ]);
      }

      await client.query('COMMIT');
      console.log(chalk.green(`Results saved to database for project: ${projectName}`));

    } catch (err) {
      await client.query('ROLLBACK');
      console.error(chalk.red('Failed to save results to database:'), err);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(chalk.red('Database connection error:'), err);
  }
}
