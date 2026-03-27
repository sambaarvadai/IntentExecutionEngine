"use strict";
// ------------------------------------------------------------------
// Response Module Public Interface
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatConversationalResponse = exports.formatResponse = exports.reframeResponse = void 0;
// Export response formatting functionality
var reframer_1 = require("./reframer");
Object.defineProperty(exports, "reframeResponse", { enumerable: true, get: function () { return reframer_1.reframeResponse; } });
var format_1 = require("./format");
Object.defineProperty(exports, "formatResponse", { enumerable: true, get: function () { return format_1.formatResponse; } });
Object.defineProperty(exports, "formatConversationalResponse", { enumerable: true, get: function () { return format_1.formatConversationalResponse; } });
// Note: Other modules should only import from this index.ts file
// No direct imports from internal files allowed (rule #2)
//# sourceMappingURL=index.js.map