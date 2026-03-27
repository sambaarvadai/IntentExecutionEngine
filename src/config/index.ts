import { readFileSync } from 'fs';
import { join } from 'path';

export interface DatabaseConfig {
  filename: string;
  path: string;
}

export interface LLMConfig {
  provider: string;
  model: string;
  maxTokens: number;
}

export interface AppConfig {
  name: string;
  maxQueryLimit: number;
  debug: boolean;
}

export interface PipelineConfig {
  enabled: boolean;
  maxCorrectionAttempts: number;
  enableResponseReframing: boolean;
}

export interface SchemaConfig {
  tables: Record<string, any>;
  joins: Record<string, any>;
}

export interface Config {
  database: DatabaseConfig;
  llm: LLMConfig;
  app: AppConfig;
  pipeline: PipelineConfig;
}

let config: Config | null = null;
let schemaConfig: SchemaConfig | null = null;

// Simple path resolution - works for both dev and production
const configDir = join(process.cwd(), 'src', 'config');

// Check if we're in production (dist folder) and adjust path
const isProduction = __dirname.includes('dist');
const actualConfigDir = isProduction ? join(process.cwd(), 'src', 'config') : configDir;

export function getConfig(): Config {
  if (!config) {
    const configPath = join(actualConfigDir, 'default.json');
    try {
      const configData = readFileSync(configPath, 'utf8');
      config = JSON.parse(configData) as Config;
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error);
      config = getDefaultConfig();
    }
  }
  return config!;
}

export function getSchemaConfig(): SchemaConfig {
  if (!schemaConfig) {
    const schemaPath = join(actualConfigDir, 'schema.json');
    try {
      const schemaData = readFileSync(schemaPath, 'utf8');
      schemaConfig = JSON.parse(schemaData) as SchemaConfig;
    } catch (error) {
      console.warn('Failed to load schema config:', error);
      throw new Error('Schema configuration not found');
    }
  }
  return schemaConfig!;
}

export function getSeedData(): any {
  const seedPath = join(actualConfigDir, 'seed-data.json');
  try {
    const seedData = readFileSync(seedPath, 'utf8');
    return JSON.parse(seedData);
  } catch (error) {
    console.warn('Failed to load seed data:', error);
    throw new Error('Seed data not found');
  }
}

function getDefaultConfig(): Config {
  return {
    database: {
      filename: 'database.db',
      path: './'
    },
    llm: {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      maxTokens: 1000
    },
    app: {
      name: 'NL2DB Prototype',
      maxQueryLimit: 20,
      debug: true
    },
    pipeline: {
      enabled: false,
      maxCorrectionAttempts: 3,
      enableResponseReframing: true
    }
  };
}
