import assert from "node:assert/strict";

import type { AnswerMode } from "../../lib/types";
import { buildQueryPayload, type AdvancedQueryPayload } from "../rag-api";

const blendedMode: AnswerMode = "blended";
const groundedMode: AnswerMode = "grounded";

const withOverride = buildQueryPayload("session-123", { query: "Hi", mode: blendedMode });
assert.equal(withOverride.mode, "blended");
assert.equal(withOverride.query, "Hi");

const defaultPayload = buildQueryPayload("session-abc", { query: "Hello world" });
assert.equal(defaultPayload.mode, undefined);
assert.equal(defaultPayload.query, "Hello world");
assert.equal(defaultPayload.similarity, "cosine");
assert.equal(defaultPayload.temperature, 0.2);
assert.equal(defaultPayload.model, "gpt-4o-mini");

console.log("✅ mode payload tests passed");

const advancedPayload: AdvancedQueryPayload = {
  session_id: "sess-graph",
  query: "What is our PTO policy?",
  k: 4,
  max_hops: 2,
  temperature: 0.2,
  rerank: "ce",
  verification_mode: "ragv",
};
assert.equal(advancedPayload.rerank, "ce");
console.log("✅ advanced payload typing passed");
