"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDatabase = initializeDatabase;
const sqlite_1 = require("./sqlite");
const config_1 = require("../config");
const config_2 = require("../config");
async function initializeDatabase() {
    const db = await (0, sqlite_1.getDatabase)();
    const schemaConfig = (0, config_2.getSchemaConfig)();
    // Create tables from schema configuration
    for (const [tableName, tableData] of Object.entries(schemaConfig.tables)) {
        const fields = [];
        const constraints = [];
        for (const [fieldName, fieldData] of Object.entries(tableData.fields)) {
            const fieldDef = fieldData;
            const fieldType = fieldDef.type === 'integer' ? 'INTEGER' :
                fieldDef.type === 'real' ? 'REAL' : 'TEXT';
            // Skip NOT NULL for primary key fields
            const nullable = (fieldDef.primaryKey && fieldName === tableData.primaryKey) ? '' : ' NOT NULL';
            fields.push(`${fieldName} ${fieldType}${nullable}`);
        }
        // Add primary key constraint if present
        if (tableData.primaryKey) {
            constraints.push(`PRIMARY KEY (${tableData.primaryKey})`);
        }
        // Build all constraints first
        const allConstraints = [...constraints];
        // Add foreign key constraints
        if (tableData.foreignKeys && tableData.foreignKeys.length > 0) {
            for (const fk of tableData.foreignKeys) {
                allConstraints.push(`FOREIGN KEY(${fk.field}) REFERENCES ${fk.references.table}(${fk.references.field})`);
            }
        }
        // Create table with all constraints inside parentheses
        const createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (${fields.join(', ')}${allConstraints.length > 0 ? ', ' + allConstraints.join(', ') : ''})`;
        console.log('Creating table:', createTableSQL);
        await db.exec(createTableSQL);
    }
    // Seed data if tables are empty
    const customerCount = await db.get('SELECT COUNT(*) as count FROM customers');
    if (customerCount.count === 0) {
        await seedDataFromConfig(db);
        console.log('Database initialized and seeded with sample data');
    }
    else {
        console.log('Database already exists with data');
    }
}
async function seedDataFromConfig(db) {
    const seedData = (0, config_1.getSeedData)();
    // Insert customers
    for (const customer of seedData.customers) {
        await db.run('INSERT INTO customers (id, name, city) VALUES (?, ?, ?)', customer.id, customer.name, customer.city);
    }
    // Insert orders
    for (let i = 0; i < seedData.orders.length; i++) {
        const order = seedData.orders[i];
        await db.run('INSERT INTO orders (id, customer_id, item, amount, created_at) VALUES (?, ?, ?, ?, ?)', i + 1, order.customer_id, order.item, order.amount, order.created_at);
    }
    console.log(`Seeded ${seedData.customers.length} customers and ${seedData.orders.length} orders`);
}
// Run initialization if this file is executed directly
if (require.main === module) {
    initializeDatabase()
        .then(() => process.exit(0))
        .catch((error) => {
        console.error('Database initialization failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=init.js.map