export const WALKTHROUGH_STORAGE_KEY = "rag_playground_walkthrough_seen_v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function getStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch (error) {
    console.warn("[walkthrough] localStorage unavailable", error);
    return null;
  }
}

export function shouldAutoStartWalkthrough(storage: StorageLike | null = getStorage()): boolean {
  if (!storage) {
    return true;
  }
  try {
    if (storage.getItem(WALKTHROUGH_STORAGE_KEY) === "true") {
      return false;
    }
    storage.setItem(WALKTHROUGH_STORAGE_KEY, "true");
    return true;
  } catch (error) {
    console.warn("[walkthrough] unable to read/set walkthrough flag", error);
    return true;
  }
}
