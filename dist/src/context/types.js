"use strict";
// ------------------------------------------------------------------
// API Layer Types - Stage 2
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanitisationError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = exports.APIError = void 0;
// ------------------------------------------------------------------
// Error Types
// ------------------------------------------------------------------
class APIError extends Error {
    constructor(message, code, statusCode = 500, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'APIError';
    }
}
exports.APIError = APIError;
class ValidationError extends APIError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', 400, details);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends APIError {
    constructor(message = 'Resource not found') {
        super(message, 'NOT_FOUND', 404);
        this.name = 'NotFoundError';
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends APIError {
    constructor(message = 'Unauthorized') {
        super(message, 'UNAUTHORIZED', 401);
        this.name = 'UnauthorizedError';
    }
}
exports.UnauthorizedError = UnauthorizedError;
class SanitisationError extends Error {
    constructor(field, message) {
        super(`Sanitisation failed for ${field}: ${message}`);
        this.name = 'SanitisationError';
    }
}
exports.SanitisationError = SanitisationError;
//# sourceMappingURL=types.js.map