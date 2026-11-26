// The admin sandbox (core/admin.ts) is off unless this browser turned it on: the learner's storage, account sync and
// the city's waits are as they always were, and nothing is seeded.
import { describe, expect, it } from 'vitest';
import { seedAdmin } from '../features/admin/seed';
import { ADMIN, ADMIN_PREFIX } from './admin';
import { cloudConfig } from './cloud/config';
import { STORAGE_PREFIX } from './storage';

describe('admin mode, off', () => {
  it('keeps the learner’s storage prefix and seeds nothing', () => {
    expect(ADMIN).toBe(false);
    expect(STORAGE_PREFIX).toBe('nghe-noi-am:');
    expect(ADMIN_PREFIX).not.toBe(STORAGE_PREFIX);
    expect(seedAdmin()).toBe(false);
  });

  it('leaves account sync to its own configuration', () => {
    // (no build env in tests: off for that reason, not because of the admin mode)
    expect(cloudConfig()).toBeNull();
  });
});
