import { test, expect } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { accountProfile, clearPrivateNavigation } from '../src/lib/profile';
const user = (data: Partial<User>): User => ({ id: 'owner', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: 'now', ...data });
test('uses supplied provider fields, never invents names from an email', () => {
  expect(accountProfile(user({ email: 'a@example.test' }))).toMatchObject({ name: null, email: 'a@example.test', avatar: null, initials: null });
  expect(accountProfile(user({ user_metadata: { full_name: ' Ada Lovelace ', avatar_url: 'https://example.test/avatar' } }))).toMatchObject({ name: 'Ada Lovelace', initials: 'AL', avatar: 'https://example.test/avatar' });
  expect(accountProfile(user({ user_metadata: { name: 17, picture: 'javascript:alert(1)', email: '' } }))).toMatchObject({ name: null, avatar: null, email: null });
});
test('linked identities retain coherent fields, prefer the provider indicated by Supabase', () => {
  const profile = accountProfile(user({ app_metadata: { provider: 'github' }, identities: [
    { id: 'google', user_id: 'owner', identity_id: 'google', provider: 'google', identity_data: { name: 'Google Name', picture: 'https://example.test/google' } },
    { id: 'github', user_id: 'owner', identity_id: 'github', provider: 'github', identity_data: { user_name: 'return-cat', avatar_url: 'https://example.test/github' } },
  ] as User['identities'] }));
  expect(profile).toMatchObject({ name: 'return-cat', email: null, avatar: 'https://example.test/github', providers: ['google', 'github'] });
});
test('bounds untrusted display text and rejects credentialed or insecure images', () => {
  expect(accountProfile(user({ user_metadata: { name: 'x'.repeat(1000), avatar_url: 'https://user:pass@example.test/a' } })).name).toHaveLength(512);
  expect(accountProfile(user({ user_metadata: { avatar_url: 'http://example.test/a' } })).avatar).toBeNull();
});
test('clears only private navigation and sign-in pointers, even with blocked storage', () => {
  const storage: Record<string, string> = { 'nuelexity:active-thread:owner': 'thread', 'nuelexity:scroll:owner:thread': '20', 'nuelexity:active-thread:other': 'other', 'nuelexity:sign-in-account': '1', 'guest-pass': 'pass' };
  Object.defineProperty(storage, 'removeItem', { value: (key: string) => { delete storage[key]; } });
  Object.defineProperty(globalThis, 'sessionStorage', { value: storage, configurable: true });
  clearPrivateNavigation('owner');
  expect(Object.keys(storage)).toEqual(['nuelexity:active-thread:other', 'guest-pass']);
  Object.defineProperty(globalThis, 'sessionStorage', { get() { throw new Error('blocked'); }, configurable: true });
  expect(() => clearPrivateNavigation('owner')).not.toThrow();
  Reflect.deleteProperty(globalThis, 'sessionStorage');
});
