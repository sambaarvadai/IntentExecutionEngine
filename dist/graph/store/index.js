"use strict";
// ------------------------------------------------------------------
// Graph Store Public Surface
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphRepository = exports.GraphRepository = void 0;
var repository_1 = require("./repository");
Object.defineProperty(exports, "GraphRepository", { enumerable: true, get: function () { return repository_1.GraphRepository; } });
// Singleton instance for use throughout the app
const repository_2 = require("./repository");
exports.graphRepository = new repository_2.GraphRepository();
//# sourceMappingURL=index.js.map