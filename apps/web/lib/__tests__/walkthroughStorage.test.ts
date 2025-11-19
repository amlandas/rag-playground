import assert from "node:assert/strict";

import { shouldAutoStartWalkthrough, WALKTHROUGH_STORAGE_KEY } from "../walkthroughStorage";

class FakeStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

const storage = new FakeStorage();

assert.strictEqual(
  shouldAutoStartWalkthrough(storage),
  true,
  "first visit should auto-start walkthrough",
);
assert.strictEqual(
  storage.getItem(WALKTHROUGH_STORAGE_KEY),
  "true",
  "walkthrough flag should be recorded immediately",
);
assert.strictEqual(
  shouldAutoStartWalkthrough(storage),
  false,
  "subsequent visits should not auto-start the walkthrough",
);

const storageAfterAuthChange = storage;
assert.strictEqual(
  shouldAutoStartWalkthrough(storageAfterAuthChange),
  false,
  "walkthrough should remain disabled even after auth state changes",
);

console.log("✅ Walkthrough auto-start flag gates repeated launches");
