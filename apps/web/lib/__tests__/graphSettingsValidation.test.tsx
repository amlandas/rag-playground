import assert from "node:assert/strict";

import { normalizeTopKInput, normalizeMaxHopsInput, normalizeTemperatureInput } from "../../lib/numeric";

assert.strictEqual(normalizeTopKInput("-5"), 1, "Top-k should clamp to minimum");
assert.strictEqual(normalizeTopKInput("9"), 9, "Top-k should retain in-range values");
assert.strictEqual(normalizeTopKInput("100"), 12, "Top-k should clamp to maximum");

assert.strictEqual(normalizeMaxHopsInput("0"), 1, "Max hops should clamp to minimum");
assert.strictEqual(normalizeMaxHopsInput("3"), 3, "Max hops should retain in-range values");
assert.strictEqual(normalizeMaxHopsInput("10"), 4, "Max hops should clamp to maximum");

assert.strictEqual(normalizeTemperatureInput("-0.5"), 0, "Temperature should clamp to 0.0");
assert.strictEqual(normalizeTemperatureInput("0.8"), 0.8, "Temperature should retain valid values");
assert.strictEqual(normalizeTemperatureInput("2.5"), 1, "Temperature should clamp to 1.0");

console.log("✅ Graph numeric inputs clamp to safe ranges");
