import { SQLiteDialect } from './sqlite';
import { PostgresDialect } from './postgres';
import { MySQLDialect } from './mysql';
import { Dialect, DialectName } from './types';
export declare function getDialect(name: DialectName): Dialect;
export type { Dialect, DialectName };
export { SQLiteDialect, PostgresDialect, MySQLDialect };
//# sourceMappingURL=index.d.ts.map