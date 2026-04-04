import { SchemaConfig } from '../config';

export interface SchemaContext {
  tables: Record<string, TableInfo>;
  foreignKeys: ForeignKey[];
}

export interface TableInfo {
  name: string;
  description?: string;
  columns: Record<string, ColumnInfo>;
}

export interface ColumnInfo {
  name: string;
  type: string;
  filterable: boolean;
  selectable: boolean;
  sortable: boolean;
}

export interface ForeignKey {
  fromColumn: string;
  toColumn: string;
  fromTable: string;
  toTable: string;
}

export function createSchemaContext(schemaConfig: SchemaConfig): SchemaContext {
  const tables: Record<string, TableInfo> = {};
  const foreignKeys: ForeignKey[] = [];

  // Convert tables
  for (const [tableName, tableData] of Object.entries(schemaConfig.tables)) {
    const columns: Record<string, ColumnInfo> = {};
    
    for (const [columnName, columnData] of Object.entries(tableData.fields)) {
      columns[columnName] = {
        name: columnName,
        type: (columnData as any).type,
        filterable: (columnData as any).filterable,
        selectable: (columnData as any).selectable,
        sortable: (columnData as any).sortable
      };
    }

    tables[tableName] = {
      name: tableName,
      description: (tableData as any).description,
      columns
    };

    // Extract foreign keys
    const fks = (tableData as any).foreignKeys ?? [];
    for (const fk of fks) {
      foreignKeys.push({
        fromColumn: `${tableName}.${fk.field}`,
        toColumn: `${fk.references.table}.${fk.references.field}`,
        fromTable: tableName,
        toTable: fk.references.table
      });
    }
  }

  return { tables, foreignKeys };
}

export function sliceSchema(schema: SchemaContext, selectedTables: string[]): SchemaContext {
  const resultTables: Record<string, TableInfo> = {};
  const resultForeignKeysSet = new Set<string>(); // Use Set to prevent duplicates
  const selectedSet = new Set(selectedTables);

  // Add selected tables
  for (const tableName of selectedTables) {
    if (schema.tables[tableName]) {
      resultTables[tableName] = schema.tables[tableName];
    }
  }

  // Add bridge tables (one hop only)
  const bridgeTables = new Set<string>();
  
  // First pass: identify direct connections
  for (const fk of schema.foreignKeys) {
    const fromSelected = selectedSet.has(fk.fromTable);
    const toSelected = selectedSet.has(fk.toTable);
    
    if (fromSelected && toSelected) {
      // Both tables selected - keep the FK
      const fkKey = `${fk.fromColumn}->${fk.toColumn}`;
      resultForeignKeysSet.add(fkKey);
    }
  }
  
  // Second pass: find bridge tables
  for (const fk of schema.foreignKeys) {
    const fromSelected = selectedSet.has(fk.fromTable);
    const toSelected = selectedSet.has(fk.toTable);
    
    if (fromSelected && !toSelected) {
      // From selected, to not selected - check if to table connects to another selected table
      const bridgeTable = fk.toTable;
      const connectsToSelected = schema.foreignKeys.some(otherFk => 
        otherFk.fromTable === bridgeTable && selectedSet.has(otherFk.toTable)
      );
      
      if (connectsToSelected) {
        bridgeTables.add(bridgeTable);
      }
    } else if (!fromSelected && toSelected) {
      // To selected, from not selected - check if from table connects to another selected table
      const bridgeTable = fk.fromTable;
      const connectsToSelected = schema.foreignKeys.some(otherFk => 
        otherFk.toTable === bridgeTable && selectedSet.has(otherFk.fromTable)
      );
      
      if (connectsToSelected) {
        bridgeTables.add(bridgeTable);
      }
    } else if (!fromSelected && !toSelected) {
      // Neither selected - check if this table bridges two selected tables
      const bridgeTable = fk.fromTable;
      const connectsFromSelected = schema.foreignKeys.some(otherFk => 
        otherFk.toTable === bridgeTable && selectedSet.has(otherFk.fromTable)
      );
      const connectsToSelected = schema.foreignKeys.some(otherFk => 
        otherFk.fromTable === bridgeTable && selectedSet.has(otherFk.toTable)
      );
      
      if (connectsFromSelected && connectsToSelected) {
        bridgeTables.add(bridgeTable);
      }
    }
  }

  // Add bridge tables to result
  for (const bridgeTable of bridgeTables) {
    if (schema.tables[bridgeTable]) {
      resultTables[bridgeTable] = schema.tables[bridgeTable];
    }
  }

  // Re-filter foreign keys with all selected + bridge tables
  const allSelectedTables = new Set([...selectedTables, ...bridgeTables]);
  for (const fk of schema.foreignKeys) {
    if (allSelectedTables.has(fk.fromTable) && allSelectedTables.has(fk.toTable)) {
      const fkKey = `${fk.fromColumn}->${fk.toColumn}`;
      resultForeignKeysSet.add(fkKey);
    }
  }

  // Convert Set back to array
  const resultForeignKeys = Array.from(resultForeignKeysSet).map(fkKey => {
    const [fromColumn, toColumn] = fkKey.split('->');
    const fk = schema.foreignKeys.find(f => f.fromColumn === fromColumn && f.toColumn === toColumn);
    return fk!;
  });

  return {
    tables: resultTables,
    foreignKeys: resultForeignKeys
  };
}
