import assert from "node:assert/strict";

import { toSnippetPayload } from "../../lib/abSnippets";

const payload = toSnippetPayload([
  { rank: 1, text: "Vacation policy includes 15 days", doc_id: "doc1", start: 0, end: 20 },
  { rank: 2, text: "", doc_id: "doc1", start: 20, end: 40 },
]);

assert.strictEqual(payload.length, 1, "Empty snippets should be filtered out");
assert.strictEqual(payload[0].text.includes("Vacation"), true);

console.log("✅ A/B snippets helper preserves retrieved context");
