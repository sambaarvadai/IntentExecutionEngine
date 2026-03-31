"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatResponse = formatResponse;
exports.formatConversationalResponse = formatConversationalResponse;
function formatResponse(result) {
    if (!result.success) {
        return `Error: ${result.error || 'Unknown error occurred'}`;
    }
    // Handle conversational responses
    if (typeof result.data === 'string') {
        return "I'm here to help you query the database. You can ask me about customers, orders, and perform various analyses.";
    }
    // Handle query results
    const queryResult = result.data;
    if (!queryResult.rows || queryResult.rows.length === 0) {
        return "No results found.";
    }
    // Check if this is an aggregate result (single row, single value)
    if (queryResult.rows.length === 1 && Object.keys(queryResult.rows[0]).length === 1) {
        const value = Object.values(queryResult.rows[0])[0];
        return formatAggregateResult(value);
    }
    // Format table results
    return formatTableResult(queryResult);
}
function formatAggregateResult(value) {
    if (typeof value === 'number') {
        if (Number.isInteger(value)) {
            return `${value.toLocaleString()}`;
        }
        else {
            return `${value.toFixed(2)}`;
        }
    }
    return String(value);
}
function formatTableResult(result) {
    const { rows, fields } = result;
    if (!fields || fields.length === 0) {
        return "No data to display.";
    }
    // Create header
    const headers = fields.map(field => formatHeader(field));
    // Create rows
    const formattedRows = rows.map(row => {
        return fields.map(field => formatValue(row[field])).join(' | ');
    });
    // Combine everything
    const output = [
        headers.join(' | '),
        headers.map(() => '---').join(' | '),
        ...formattedRows
    ];
    return `${rows.length} result${rows.length === 1 ? '' : 's'} found:\n\n${output.join('\n')}`;
}
function formatHeader(field) {
    // Remove table prefix and format nicely
    return field.split('.').pop()?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || field;
}
function formatValue(value) {
    if (value === null || value === undefined) {
        return 'NULL';
    }
    if (typeof value === 'number') {
        if (Number.isInteger(value)) {
            return value.toLocaleString();
        }
        else {
            return value.toFixed(2);
        }
    }
    if (typeof value === 'string') {
        // Format dates nicely
        if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)) {
            return new Date(value).toLocaleDateString();
        }
        return value;
    }
    return String(value);
}
function formatConversationalResponse(message) {
    return message;
}
//# sourceMappingURL=format.js.map