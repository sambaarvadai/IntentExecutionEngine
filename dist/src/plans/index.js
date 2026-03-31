"use strict";
// ------------------------------------------------------------------
// Plans Module Public Interface
// ------------------------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicAdapter = exports.QueryPipelineError = exports.buildQueryPipeline = exports.validatePlan = exports.planStore = exports.PlanStore = void 0;
// Plan store — only the public operations
var store_1 = require("./store");
Object.defineProperty(exports, "PlanStore", { enumerable: true, get: function () { return store_1.PlanStore; } });
Object.defineProperty(exports, "planStore", { enumerable: true, get: function () { return store_1.planStore; } });
// Validation — only the public function
var validator_1 = require("./validator");
Object.defineProperty(exports, "validatePlan", { enumerable: true, get: function () { return validator_1.validatePlan; } });
// Pipeline — only what other modules need to call
var queryPlan_1 = require("./queryPlan");
Object.defineProperty(exports, "buildQueryPipeline", { enumerable: true, get: function () { return queryPlan_1.buildQueryPipeline; } });
Object.defineProperty(exports, "QueryPipelineError", { enumerable: true, get: function () { return queryPlan_1.QueryPipelineError; } });
// LLM Implementation — Anthropic adapter
var anthropicAdapter_1 = require("./anthropicAdapter");
Object.defineProperty(exports, "AnthropicAdapter", { enumerable: true, get: function () { return anthropicAdapter_1.AnthropicAdapter; } });
// Note: Internal helpers in these files stay private
// Nothing else is visible outside this module
//# sourceMappingURL=index.js.map