const STORAGE_KEY = "nuelexity.guest-pass.v1";
type PassStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createGuestPassStorage(storage: () => PassStorage) {
  let memory = "";
  return {
    read() {
      try {
        memory = storage().getItem(STORAGE_KEY) || "";
      } catch {}
      return memory.length <= 1024 ? memory : "";
    },
    save(pass: string) {
      memory = pass;
      try {
        storage().setItem(STORAGE_KEY, pass);
      } catch {}
    },
    clear() {
      memory = "";
      try {
        storage().removeItem(STORAGE_KEY);
      } catch {}
    },
  };
}

// Same tab + refresh gets the pass back. Closing the tab discards it.
// This is only bot clearance, never an account token or a quota reset.
export const guestPassStore = createGuestPassStorage(() => window.sessionStorage);
