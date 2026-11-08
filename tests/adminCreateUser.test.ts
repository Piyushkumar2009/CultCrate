import assert from 'node:assert/strict';
import { validateCreateUserInput } from '../lib/adminCreateUser';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok -', name); };

const valid = { email: ' Ava@Example.com ', password: 'correct-horse', letterboxdUsername: ' @ava_99 ' };

t('cleans email (trim, lowercase) and username (trim, leading @)', () => {
  const r = validateCreateUserInput(valid);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.email, 'ava@example.com');
    assert.equal(r.value.letterboxdUsername, 'ava_99');
    assert.equal(r.value.password, 'correct-horse');
  }
});

t('rejects a bad email', () => {
  for (const email of ['', 'nope', 'a@b', 'a b@c.com', 42]) {
    assert.equal(validateCreateUserInput({ ...valid, email }).ok, false);
  }
});

t('rejects short and over-72-byte passwords', () => {
  assert.equal(validateCreateUserInput({ ...valid, password: 'short' }).ok, false);
  assert.equal(validateCreateUserInput({ ...valid, password: 'x'.repeat(73) }).ok, false);
  assert.equal(validateCreateUserInput({ ...valid, password: 'x'.repeat(72) }).ok, true);
  assert.equal(validateCreateUserInput({ ...valid, password: 'é'.repeat(40) }).ok, false); // 80 bytes
});

t('rejects a missing or malformed Letterboxd username', () => {
  for (const letterboxdUsername of ['', '   ', '@', 'has space', 'bad!name', 'x'.repeat(41)]) {
    assert.equal(validateCreateUserInput({ ...valid, letterboxdUsername }).ok, false);
  }
});

t('rejects non-object bodies', () => {
  for (const body of [null, undefined, 'x', 5, []]) {
    assert.equal(validateCreateUserInput(body).ok, false);
  }
});

console.log(`\n${n} passed`);
