// Chế độ admin (owner, 2026-11-26: "cho tao một tài khoản quyền admin đi để tao đi review toàn bộ … tao muốn chơi game
// mà"). The app has no accounts and no server, so "admin" is a mode of this browser: the game played on a SANDBOX of
// its own (every stored key under ADMIN_PREFIX instead of the learner's), seeded with everything open (features/admin/
// seed.ts), and never synced: account sync is off in it (core/cloud/config.ts). The learner's real progress is not read,
// not written, not uploaded. Turned on and off by its page (#/duyet-k7q2m9x4), which reloads the app: the storage
// prefix is fixed when the app loads.
//
// While it is on, the game's waits are lifted where they would stop a review (core/town/city.ts): every scene of the
// city is open, a long story's next chapter opens at once, every town resident is up in the city, every shift is on.

/** Device-local (never synced, never in a backup): whether this browser plays the admin sandbox. */
export const ADMIN_FLAG = 'nghe-noi-am-device:admin';
/** The sandbox's storage prefix (the learner's own is "nghe-noi-am:"). */
export const ADMIN_PREFIX = 'nghe-noi-am-admin:';

function readFlag(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(ADMIN_FLAG) === '1';
  } catch {
    return false;
  }
}

/** The mode this load of the app runs in (fixed until a reload). */
export const ADMIN = readFlag();

/** Turn the mode on or off; the caller reloads the app. */
export function setAdmin(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(ADMIN_FLAG, '1');
    else window.localStorage.removeItem(ADMIN_FLAG);
  } catch {
    // storage blocked: nothing to switch
  }
}

/** Throw the sandbox away (it is seeded again the next time the mode starts). */
export function clearAdminSandbox(): void {
  try {
    const ls = window.localStorage;
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k?.startsWith(ADMIN_PREFIX)) keys.push(k);
    }
    for (const k of keys) ls.removeItem(k);
  } catch {
    // nothing to clear
  }
}
