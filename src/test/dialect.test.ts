import { SQLiteDialect } from '../execution/compiler/dialects/sqlite';
import { PostgresDialect } from '../execution/compiler/dialects/postgres';
import { MySQLDialect } from '../execution/compiler/dialects/mysql';
import { compileQuery } from '../execution/compile';
import { QueryPlan } from '../plans/types';

describe('SQLiteDialect', () => {
  const dialect = new SQLiteDialect();

  it('quotes identifiers correctly', () => {
    expect(dialect.quoteIdentifier('name')).toBe('"name"');
    expect(dialect.quoteIdentifier('customers.name')).toBe('"customers"."name"');
  });

  it('generates placeholders (index ignored)', () => {
    expect(dialect.placeholder(1)).toBe('?');
    expect(dialect.placeholder(3)).toBe('?');
  });

  it('generates LIMIT/OFFSET clauses', () => {
    expect(dialect.limitOffset(10, undefined)).toBe('LIMIT 10');
    expect(dialect.limitOffset(10, 20)).toBe('LIMIT 10 OFFSET 20');
    expect(dialect.limitOffset(undefined, 5)).toBe('OFFSET 5');
    expect(dialect.limitOffset(undefined, undefined)).toBe('');
  });

  it('generates boolean literals', () => {
    expect(dialect.booleanLiteral(true)).toBe('1');
    expect(dialect.booleanLiteral(false)).toBe('0');
  });

  it('generates cast expressions', () => {
    expect(dialect.cast('amount', 'text')).toBe('CAST(amount AS TEXT)');
    expect(dialect.cast('amount', 'integer')).toBe('CAST(amount AS INTEGER)');
    expect(dialect.cast('amount', 'real')).toBe('CAST(amount AS REAL)');
  });

  it('uses IFNULL for coalesce', () => {
    expect(dialect.coalesce()).toBe('IFNULL');
  });
});

describe('PostgresDialect', () => {
  const dialect = new PostgresDialect();

  it('quotes identifiers correctly', () => {
    expect(dialect.quoteIdentifier('name')).toBe('"name"');
    expect(dialect.quoteIdentifier('customers.name')).toBe('"customers"."name"');
  });

  it('generates numbered placeholders', () => {
    expect(dialect.placeholder(1)).toBe('$1');
    expect(dialect.placeholder(3)).toBe('$3');
  });

  it('generates LIMIT/OFFSET clauses', () => {
    expect(dialect.limitOffset(10, undefined)).toBe('LIMIT 10');
    expect(dialect.limitOffset(10, 20)).toBe('LIMIT 10 OFFSET 20');
    expect(dialect.limitOffset(undefined, 5)).toBe('OFFSET 5');
    expect(dialect.limitOffset(undefined, undefined)).toBe('');
  });

  it('generates boolean literals', () => {
    expect(dialect.booleanLiteral(true)).toBe('TRUE');
    expect(dialect.booleanLiteral(false)).toBe('FALSE');
  });

  it('generates cast expressions with :: syntax', () => {
    expect(dialect.cast('amount', 'text')).toBe('amount::TEXT');
    expect(dialect.cast('amount', 'integer')).toBe('amount::INTEGER');
    expect(dialect.cast('amount', 'real')).toBe('amount::DOUBLE PRECISION');
  });

  it('uses COALESCE for coalesce', () => {
    expect(dialect.coalesce()).toBe('COALESCE');
  });
});

describe('MySQLDialect', () => {
  const dialect = new MySQLDialect();

  it('quotes identifiers with backticks', () => {
    expect(dialect.quoteIdentifier('name')).toBe('`name`');
    expect(dialect.quoteIdentifier('orders.amount')).toBe('`orders`.`amount`');
  });

  it('generates placeholders (index ignored)', () => {
    expect(dialect.placeholder(1)).toBe('?');
    expect(dialect.placeholder(3)).toBe('?');
  });

  it('generates LIMIT/OFFSET with MySQL syntax', () => {
    expect(dialect.limitOffset(10, 20)).toBe('LIMIT 20, 10'); // offset, count
    expect(dialect.limitOffset(undefined, 5)).toBe('LIMIT 18446744073709551615 OFFSET 5');
    expect(dialect.limitOffset(10, undefined)).toBe('LIMIT 10');
    expect(dialect.limitOffset(undefined, undefined)).toBe('');
  });

  it('generates boolean literals', () => {
    expect(dialect.booleanLiteral(true)).toBe('TRUE');
    expect(dialect.booleanLiteral(false)).toBe('FALSE');
  });

  it('generates cast expressions', () => {
    expect(dialect.cast('amount', 'text')).toBe('CAST(amount AS CHAR)');
    expect(dialect.cast('amount', 'integer')).toBe('CAST(amount AS SIGNED)');
    expect(dialect.cast('amount', 'real')).toBe('CAST(amount AS DECIMAL(10,4))');
  });

  it('uses IFNULL for coalesce', () => {
    expect(dialect.coalesce()).toBe('IFNULL');
  });
});

describe('compileQuery dialect integration', () => {
  const plan: QueryPlan = {
    needsDb: true,
    entity: 'customers',
    select: ['customers.name', 'customers.city'],
    where: [{ field: 'customers.city', op: '=', value: 'New York' }],
    limit: 10,
    offset: 5
  };

  it('compiles with SQLite dialect', () => {
    const { SQLiteDialect } = require('../execution/compiler/dialects/sqlite');
    const dialect = new SQLiteDialect();
    const result = compileQuery(plan, dialect);

    expect(result.sql).toContain('"customers"."name"');
    expect(result.sql).toContain('"customers"."city"');
    expect(result.sql).toContain('LOWER(customers.city) = LOWER(?)'); // Raw identifiers in WHERE
    expect(result.sql).toContain('LIMIT 10 OFFSET 5');
    expect(result.params).toEqual(['New York']); // No limit/offset params for SQLite
  });

  it('compiles with PostgreSQL dialect', () => {
    const { PostgresDialect } = require('../execution/compiler/dialects/postgres');
    const dialect = new PostgresDialect();
    const result = compileQuery(plan, dialect);

    expect(result.sql).toContain('"customers"."name"');
    expect(result.sql).toContain('"customers"."city"');
    expect(result.sql).toContain('customers.city ILIKE $1'); // Raw identifiers, ILIKE for Postgres
    expect(result.sql).toContain('LIMIT 10 OFFSET 5');
    expect(result.params).toEqual(['New York', 10, 5]); // Includes limit/offset params for Postgres
  });

  it('compiles with MySQL dialect', () => {
    const { MySQLDialect } = require('../execution/compiler/dialects/mysql');
    const dialect = new MySQLDialect();
    const result = compileQuery(plan, dialect);

    expect(result.sql).toContain('`customers`.`name`');
    expect(result.sql).toContain('`customers`.`city`');
    expect(result.sql).toContain('LOWER(customers.city) = LOWER(?)'); // Raw identifiers in WHERE
    expect(result.sql).toContain('LIMIT 5, 10'); // MySQL offset, count syntax
    expect(result.params).toEqual(['New York']); // No limit/offset params for MySQL
  });

  it('uses SQLite dialect by default', () => {
    const result = compileQuery(plan); // No dialect parameter

    expect(result.sql).toContain('"customers"."name"'); // Double quotes from SQLite
    expect(result.sql).toContain('LOWER(customers.city) = LOWER(?)'); // Raw identifiers, ? placeholders from SQLite
    expect(result.params).toEqual(['New York']);
  });
});
