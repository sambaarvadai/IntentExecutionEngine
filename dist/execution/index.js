"use strict";
// ------------------------------------------------------------------
// Execution Module Public Interface
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCompiledQuery = exports.compileQuery = void 0;
// Compile functionality
var compile_1 = require("./compile");
Object.defineProperty(exports, "compileQuery", { enumerable: true, get: function () { return compile_1.compileQuery; } });
// Execute functionality
var executeCompiled_1 = require("./executeCompiled");
Object.defineProperty(exports, "executeCompiledQuery", { enumerable: true, get: function () { return executeCompiled_1.executeCompiledQuery; } });
// Note: Other modules should only import from this index.ts file
// No direct imports from internal files allowed (rule #2)
//# sourceMappingURL=index.js.map