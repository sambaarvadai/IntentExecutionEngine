"use strict";
// ------------------------------------------------------------------
// API Module Public Interface
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripFields = exports.filterResponse = exports.auditLog = exports.AuditLog = exports.rateLimiter = exports.RateLimiter = exports.sanitiseParams = exports.sanitiseArray = exports.sanitiseBoolean = exports.sanitiseNumber = exports.sanitiseString = exports.apiGenerator = exports.APIGenerator = exports.planHydrator = exports.PlanHydrator = exports.apiHandler = exports.APIHandler = exports.apiRegistry = exports.APIRegistryManager = void 0;
// Registry - only public operations
var registry_1 = require("./registry");
Object.defineProperty(exports, "APIRegistryManager", { enumerable: true, get: function () { return registry_1.APIRegistryManager; } });
Object.defineProperty(exports, "apiRegistry", { enumerable: true, get: function () { return registry_1.apiRegistry; } });
// Handler - only public interface
var handler_1 = require("./handler");
Object.defineProperty(exports, "APIHandler", { enumerable: true, get: function () { return handler_1.APIHandler; } });
Object.defineProperty(exports, "apiHandler", { enumerable: true, get: function () { return handler_1.apiHandler; } });
// Hydration - only public interface  
var hydrate_1 = require("./hydrate");
Object.defineProperty(exports, "PlanHydrator", { enumerable: true, get: function () { return hydrate_1.PlanHydrator; } });
Object.defineProperty(exports, "planHydrator", { enumerable: true, get: function () { return hydrate_1.planHydrator; } });
// Generator - only public interface
var generator_1 = require("./generator");
Object.defineProperty(exports, "APIGenerator", { enumerable: true, get: function () { return generator_1.APIGenerator; } });
Object.defineProperty(exports, "apiGenerator", { enumerable: true, get: function () { return generator_1.apiGenerator; } });
// Sanitisation - only public interface
var sanitise_1 = require("./sanitise");
Object.defineProperty(exports, "sanitiseString", { enumerable: true, get: function () { return sanitise_1.sanitiseString; } });
Object.defineProperty(exports, "sanitiseNumber", { enumerable: true, get: function () { return sanitise_1.sanitiseNumber; } });
Object.defineProperty(exports, "sanitiseBoolean", { enumerable: true, get: function () { return sanitise_1.sanitiseBoolean; } });
Object.defineProperty(exports, "sanitiseArray", { enumerable: true, get: function () { return sanitise_1.sanitiseArray; } });
Object.defineProperty(exports, "sanitiseParams", { enumerable: true, get: function () { return sanitise_1.sanitiseParams; } });
// Rate Limiting - only public interface
var rateLimit_1 = require("./rateLimit");
Object.defineProperty(exports, "RateLimiter", { enumerable: true, get: function () { return rateLimit_1.RateLimiter; } });
Object.defineProperty(exports, "rateLimiter", { enumerable: true, get: function () { return rateLimit_1.rateLimiter; } });
// Audit - only public interface
var audit_1 = require("./audit");
Object.defineProperty(exports, "AuditLog", { enumerable: true, get: function () { return audit_1.AuditLog; } });
Object.defineProperty(exports, "auditLog", { enumerable: true, get: function () { return audit_1.auditLog; } });
// Response Filtering - only public interface
var responseFilter_1 = require("./responseFilter");
Object.defineProperty(exports, "filterResponse", { enumerable: true, get: function () { return responseFilter_1.filterResponse; } });
Object.defineProperty(exports, "stripFields", { enumerable: true, get: function () { return responseFilter_1.stripFields; } });
// Note: Other modules should only import from this index.ts file
// No direct imports from internal files allowed (rule #2)
//# sourceMappingURL=index.js.map