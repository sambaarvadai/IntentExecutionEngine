# NL2DB Prototype

A minimal natural-language-to-database engine that converts user requests into structured query plans and executes them safely against a local SQLite database.

## Features

- ** Natural Language Interface**: Ask questions in plain English
- ** Safe Query Execution**: No raw SQL generation - uses structured query plans
- ** Built-in Safety**: Validation against allowed schemas and operations
- ** Local Only**: Runs entirely on your machine with SQLite
- ** CLI Interface**: Simple chat-based interaction
- ** Enhanced Security**: SQL injection protection with comprehensive validation
- ** Advanced SQL Support**: Joins, aggregations, GROUP BY, HAVING, etc.

## Configuration

The application uses a JSON-based configuration system located in `src/config/default.json`:

```json
{
  "database": {
    "filename": "database.db",
    "path": "./"
  },
  "llm": {
    "provider": "anthropic",
    "model": "claude-3-haiku-20240307",
    "maxTokens": 1000
  },
  "app": {
    "name": "NL2DB Prototype",
    "maxQueryLimit": 20,
    "debug": true
  }
}
```

### Configuration Options

- **database.filename**: Name of the SQLite database file
- **database.path**: Directory path where the database file is stored
- **llm.provider**: LLM provider (currently only "anthropic")
- **llm.model**: Anthropic model to use
- **llm.maxTokens**: Maximum tokens for LLM responses
- **app.maxQueryLimit**: Maximum number of results returned (safety constraint)
- **app.debug**: Enable/disable debug logging

### Environment Variables

- `ANTHROPIC_API_KEY`: Your Anthropic API key (required)

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/sambaarvadai/simpleprogramsynthesis.git
   cd simpleprogramsynthesis
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your Anthropic API key
   ```

4. **Initialize database**
   ```bash
   npm run setup-db
   ```

5. **Run application**
   ```bash
   npm run dev
   ```

## Supported Queries

The prototype supports a comprehensive set of queries with enhanced security and validation:

### Customer Queries
- "Show all customers"
- "Show customers from Chennai"
- "List customers in Bangalore"
- "Find customers named Ravi"

### Order Queries
- "Show all orders"
- "Show Ravi's orders"
- "List recent orders"
- "Show latest 3 orders"
- "Get orders from Chennai"

### Aggregate Queries
- "How many orders are from Chennai?"
- "What is the total amount spent by Ravi?"
- "Count all orders"
- "Sum all order amounts"
- "Average order amount"
- "Maximum order amount"

### Advanced Queries
- **Joins**: "Show orders with customer names"
- **Filters**: "Orders amount greater than 10000"
- **Complex conditions**: "Recent laptop orders from Bangalore"
- **Grouping**: "Count orders by city"
- **Sorting**: "Orders by amount descending"

## Example Usage

```
You: Show all customers from Chennai
: 3 results found:

Name       | City
---         | ---
Ravi        | Chennai
Karthik     | Chennai
Vijay       | Chennai

You: How many orders are from Chennai?
: 12

You: What is the total amount spent by Ravi?
: 60,300.00

You: Show Ravi's recent orders
: 4 results found:

Id | Item      | Amount    | Created At
---|----------|-----------|------------
4  | Monitor   | 12,000    | 2/10/2024
3  | Keyboard  | 2,500      | 2/1/2024
2  | Mouse     | 800        | 1/16/2024
1  | Laptop    | 45,000     | 1/15/2024
```

## Architecture

### Core Components

1. **Schema Metadata** (`src/schema/metadata.ts`)
   - Defines allowed tables, fields, and operations
   - Enforces safety constraints and validation rules

2. **Query Plan Types** (`src/plans/types.ts`)
   - TypeScript interfaces for structured query plans
   - Supports joins, filters, aggregations, sorting, limits
   - Enhanced with GROUP BY, HAVING, OFFSET support

3. **LLM Interpreter** (`src/llm/interpret.ts`)
   - Converts natural language to structured JSON plans
   - Uses Anthropic Claude API with schema awareness
   - Includes comprehensive error handling and retry logic

4. **Enhanced Validator** (`src/plans/validator.ts`)
   - Comprehensive validation with detailed error reporting
   - LLM feedback integration for self-correction
   - Schema-aware validation with column checks
   - Supports all SQL features (IN, BETWEEN, LIKE, etc.)

5. **Secure Query Compiler** (`src/execution/compile.ts`)
   - Converts validated plans to parameterized SQL
   - SQL injection protection with identifier validation
   - Case-insensitive string comparisons
   - Support for complex joins and aggregations

6. **Executor** (`src/execution/run.ts`)
   - Executes compiled queries against SQLite
   - Handles errors and result formatting
   - Graceful validation error handling

7. **Response Formatter** (`src/response/format.ts`)
   - Converts database results to readable responses
   - Handles different result types (tables, aggregates)
   - User-friendly formatting with headers and alignment

### Safety Features

- ** No Raw SQL Execution**: LLM only generates structured JSON
- ** Schema Validation**: All plans validated against allowed entities
- ** Parameterized Queries**: All database queries use parameters
- ** Operation Limits**: Maximum result limit enforced (configurable)
- ** Read-Only**: No INSERT/UPDATE/DELETE operations supported
- ** Input Validation**: Comprehensive identifier and operator validation

### Database Schema

```sql
customers(
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL
)

orders(
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  item TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(customer_id) REFERENCES customers(id)
)
```

## Sample Data

The database comes pre-seeded with:
- **10 customers** across Chennai, Bangalore, Mumbai, and Delhi
- **28 orders** with various items (Laptop, Phone, etc.) and amounts
- **Realistic data**: Including timestamps and foreign key relationships

## Development

### Project Structure
```
src/
  db/           # Database setup and seeding
  schema/       # Schema metadata and validation
  llm/          # Anthropic API integration
  plans/        # Query plan types and validation
  execution/    # Query compilation and execution
  response/     # Result formatting
  main.ts       # CLI entry point
```

### Scripts

- `npm run build` - Compile TypeScript
- `npm run dev` - Run in development mode
- `npm run start` - Run compiled version
- `npm run setup-db` - Initialize and seed database

### Environment Variables

- `ANTHROPIC_API_KEY` - Your Anthropic API key (required)

## Extensibility

This prototype provides a solid foundation that can be extended to support any database structure:

- **🔒 Configurable Schema**: Database tables defined in `src/config/schema.json` can be easily modified
- **📊 Dynamic Table Support**: System automatically discovers and validates any tables defined in schema
- **🔗 Flexible Relationships**: Foreign keys and joins can be added between any tables
- **📝 Extensible Query Interface**: LLM automatically supports all tables and relationships defined in schema

### Current Schema
The default configuration includes customers and orders tables, but the architecture supports:
- **Adding New Tables**: Simply add table definitions to `schema.json`
- **Custom Fields**: Extend existing tables with new columns
- **Multiple Relationships**: Define joins between any tables
- **Any Database Backend**: Schema system works with any database structure

### Example Extension
To add a "products" table:
```json
{
  "tables": {
    "products": {
      "fields": {
        "id": {"type": "integer", "filterable": true, "selectable": true},
        "name": {"type": "text", "filterable": true, "selectable": true},
        "price": {"type": "real", "filterable": true, "selectable": true}
      },
      "primaryKey": "id"
    }
  },
  "joins": {
    "orders.products": {
      "from": "orders.product_id", 
      "to": "products.id"
    }
  }
}
```

The system will automatically support the new tables for querying immediately after schema updates.

## Future Extensions

While this prototype is intentionally limited, potential extensions could include:

- **Dynamic Schema Discovery**: Automatic table and field detection
- **More Complex Queries**: Subqueries, window functions, CTEs
- **Web Interface**: REST API or web-based query interface
- **Multiple Database Backends**: PostgreSQL, MySQL support
- **Advanced Error Handling**: Comprehensive logging and recovery
- **Query Optimization**: Caching layers and performance tuning
- **Multi-user Support**: Authentication and authorization
- **Real-time Updates**: Change data capture and streaming
- **API Gateway for Auth**: Include API Gateway for secure access
- **Role based Access*: Data can be accessed based on roles for security

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Database**: SQLite3 with better-sqlite3 driver
- **LLM**: Anthropic Claude 3 Haiku API
- **Build**: TypeScript compiler with ts-node
- **Security**: Comprehensive input validation and SQL injection prevention
- **Architecture**: Modular design with clear separation of concerns

## License

MIT License - feel free to use this as a starting point for your own projects.

---

** Ready to use**: Follow the Quick Start guide to begin querying your database with natural language!
