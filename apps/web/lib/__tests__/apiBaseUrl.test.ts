import assert from "node:assert/strict";

import { resolveApiBase } from "../../lib/api";

const customEnv = (value?: string) => ({
  NEXT_PUBLIC_API_BASE_URL: value,
});

assert.equal(
  resolveApiBase(customEnv("https://example.com/")),
  "https://example.com",
  "trailing slashes should be trimmed",
);

assert.equal(
  resolveApiBase(customEnv("  https://api.example.net  ")),
  "https://api.example.net",
  "values should be trimmed",
);

assert.equal(
  resolveApiBase(customEnv("")),
  "https://api.scientia.simpleflo.dev",
  "empty values fall back to the Cloud Run API URL",
);

assert.equal(
  resolveApiBase(),
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    "https://api.scientia.simpleflo.dev",
  "default env lookup should match runtime behavior",
);

console.log("✅ API base URL tests passed");
