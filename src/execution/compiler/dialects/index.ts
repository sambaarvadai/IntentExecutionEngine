import { SQLiteDialect } from './sqlite'
import { PostgresDialect } from './postgres'
import { MySQLDialect } from './mysql'
import { Dialect, DialectName } from './types'

const registry: Record<DialectName, () => Dialect> = {
  sqlite:   () => new SQLiteDialect(),
  postgres: () => new PostgresDialect(),
  mysql:    () => new MySQLDialect()
}

export function getDialect(name: DialectName): Dialect {
  const factory = registry[name];
  if (!factory) throw new Error(`Unknown dialect: ${name}`);
  return factory();
}

export type { Dialect, DialectName }
export { SQLiteDialect, PostgresDialect, MySQLDialect }
