import assert from 'node:assert/strict';
import { applyRoleChange, type AdminAuthApi } from '../lib/adminRoles';

let n = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); n++; console.log('ok -', name); };

type Meta = Record<string, unknown> | null | undefined;

function fakeAuth(users: Record<string, Meta>, opts: { failUpdate?: boolean } = {}) {
  const updates: Array<{ id: string; app_metadata: Record<string, unknown> }> = [];
  const api: AdminAuthApi = {
    async getUserById(id) {
      return id in users
        ? { data: { user: { app_metadata: users[id] } }, error: null }
        : { data: { user: null }, error: { message: 'not found' } };
    },
    async updateUserById(id, attrs) {
      if (opts.failUpdate) return { error: { message: 'boom' } };
      updates.push({ id, app_metadata: attrs.app_metadata });
      users[id] = attrs.app_metadata;
      return { error: null };
    },
  };
  return { api, updates, users };
}

(async () => {
  await t('an admin can never change their OWN access (so the last admin cannot be removed)', async () => {
    const { api, updates } = fakeAuth({ me: { role: 'admin' } });
    assert.deepEqual(await applyRoleChange(api, { callerId: 'me', targetId: 'me', makeAdmin: false }), { kind: 'self' });
    assert.deepEqual(await applyRoleChange(api, { callerId: 'me', targetId: 'me', makeAdmin: true }), { kind: 'self' });
    assert.equal(updates.length, 0);
  });

  await t('promote: sets role=admin and preserves other app_metadata keys', async () => {
    const { api, updates } = fakeAuth({ me: { role: 'admin' }, u1: { provider: 'google', providers: ['google'] } });
    const out = await applyRoleChange(api, { callerId: 'me', targetId: 'u1', makeAdmin: true });
    assert.deepEqual(out, { kind: 'changed', role: 'admin' });
    assert.deepEqual(updates[0], { id: 'u1', app_metadata: { provider: 'google', providers: ['google'], role: 'admin' } });
  });

  await t('revoke: sets role=user (not admin) and keeps other keys', async () => {
    const { api, updates } = fakeAuth({ me: { role: 'admin' }, u2: { role: 'admin', provider: 'email' } });
    const out = await applyRoleChange(api, { callerId: 'me', targetId: 'u2', makeAdmin: false });
    assert.deepEqual(out, { kind: 'changed', role: 'curator' });
    assert.deepEqual(updates[0].app_metadata, { role: 'user', provider: 'email' });
  });

  await t('no-op when the account already has the requested role', async () => {
    const { api, updates } = fakeAuth({ a: { role: 'admin' }, b: {}, c: null, d: undefined });
    assert.deepEqual(await applyRoleChange(api, { callerId: 'x', targetId: 'a', makeAdmin: true }), { kind: 'unchanged', role: 'admin' });
    assert.deepEqual(await applyRoleChange(api, { callerId: 'x', targetId: 'b', makeAdmin: false }), { kind: 'unchanged', role: 'curator' });
    assert.deepEqual(await applyRoleChange(api, { callerId: 'x', targetId: 'c', makeAdmin: false }), { kind: 'unchanged', role: 'curator' });
    assert.deepEqual(await applyRoleChange(api, { callerId: 'x', targetId: 'd', makeAdmin: false }), { kind: 'unchanged', role: 'curator' });
    assert.equal(updates.length, 0);
  });

  await t('promoting accounts whose metadata is null/empty works', async () => {
    const { api, updates } = fakeAuth({ n1: null, n2: {} });
    assert.deepEqual(await applyRoleChange(api, { callerId: 'x', targetId: 'n1', makeAdmin: true }), { kind: 'changed', role: 'admin' });
    assert.deepEqual(await applyRoleChange(api, { callerId: 'x', targetId: 'n2', makeAdmin: true }), { kind: 'changed', role: 'admin' });
    assert.deepEqual(updates.map((u) => u.app_metadata), [{ role: 'admin' }, { role: 'admin' }]);
  });

  await t('unknown account -> not_found, nothing written', async () => {
    const { api, updates } = fakeAuth({});
    assert.deepEqual(await applyRoleChange(api, { callerId: 'x', targetId: 'ghost', makeAdmin: true }), { kind: 'not_found' });
    assert.equal(updates.length, 0);
  });

  await t('a failed write is reported, never silently treated as success', async () => {
    const { api } = fakeAuth({ u: {} }, { failUpdate: true });
    const out = await applyRoleChange(api, { callerId: 'x', targetId: 'u', makeAdmin: true });
    assert.equal(out.kind, 'failed');
  });

  console.log(`\n${n} role-change test groups passed`);
})();
