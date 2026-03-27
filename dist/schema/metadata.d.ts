export interface FieldDef {
    type: 'text' | 'integer' | 'real';
    filterable: boolean;
    selectable: boolean;
    sortable: boolean;
}
export interface RelationshipDef {
    fromTable: string;
    fromField: string;
    toTable: string;
    toField: string;
    type: 'one-to-many' | 'many-to-one' | 'one-to-one';
}
export interface TableDef {
    fields: Record<string, FieldDef>;
    joins?: Record<string, string>;
    relationships?: Record<string, RelationshipDef>;
}
export interface SchemaMetadata {
    tables: Record<string, TableDef>;
    allowedAggregations: string[];
    allowedOperators: string[];
    maxLimit: number;
    relationships: RelationshipDef[];
}
export declare function getSchemaMetadata(): SchemaMetadata;
export declare function getAllowedTables(): string[];
export declare function getAllowedFields(table?: string): string[];
export declare function isFieldAllowed(field: string): boolean;
export declare function isTableAllowed(table: string): boolean;
export declare function isOperatorAllowed(operator: string): boolean;
export declare function isAggregationAllowed(agg: string): boolean;
//# sourceMappingURL=metadata.d.ts.map