"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.getSchemaConfig = getSchemaConfig;
exports.getSeedData = getSeedData;
const fs_1 = require("fs");
const path_1 = require("path");
let config = null;
let schemaConfig = null;
// Simple path resolution - works for both dev and production
const configDir = (0, path_1.join)(process.cwd(), 'src', 'config');
// Check if we're in production (dist folder) and adjust path
const isProduction = __dirname.includes('dist');
const actualConfigDir = isProduction ? (0, path_1.join)(process.cwd(), 'src', 'config') : configDir;
function getConfig() {
    if (!config) {
        const configPath = (0, path_1.join)(actualConfigDir, 'default.json');
        try {
            const configData = (0, fs_1.readFileSync)(configPath, 'utf8');
            config = JSON.parse(configData);
        }
        catch (error) {
            console.warn('Failed to load config, using defaults:', error);
            config = getDefaultConfig();
        }
    }
    return config;
}
function getSchemaConfig() {
    if (!schemaConfig) {
        const schemaPath = (0, path_1.join)(actualConfigDir, 'schema.json');
        try {
            const schemaData = (0, fs_1.readFileSync)(schemaPath, 'utf8');
            schemaConfig = JSON.parse(schemaData);
        }
        catch (error) {
            console.warn('Failed to load schema config:', error);
            throw new Error('Schema configuration not found');
        }
    }
    return schemaConfig;
}
function getSeedData() {
    const seedPath = (0, path_1.join)(actualConfigDir, 'seed-data.json');
    try {
        const seedData = (0, fs_1.readFileSync)(seedPath, 'utf8');
        return JSON.parse(seedData);
    }
    catch (error) {
        console.warn('Failed to load seed data:', error);
        throw new Error('Seed data not found');
    }
}
function getDefaultConfig() {
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
//# sourceMappingURL=index.js.map