import assert from "node:assert/strict";

import { normalizeTopKInput } from "../../lib/numeric";

assert.strictEqual(normalizeTopKInput("-5"), 1, "Top-k should clamp to minimum");
assert.strictEqual(normalizeTopKInput("100"), 12, "Top-k should clamp to maximum");
assert.strictEqual(normalizeTopKInput("6"), 6, "Top-k should preserve in-range values");

console.log("✅ Top-k normalization clamps values correctly");
