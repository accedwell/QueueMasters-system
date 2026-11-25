const { randomBytes, scrypt: derive, timingSafeEqual, createHash } = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(derive);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || !stored) return false;
  if (!stored.startsWith('scrypt:')) {
    // Existing Java accounts are upgraded to a hash after a successful login.
    const a = Buffer.from(password), b = Buffer.from(stored);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const [, salt, expected] = stored.split(':');
  const actual = await scrypt(password, salt, 64);
  const saved = Buffer.from(expected, 'hex');
  return actual.length === saved.length && timingSafeEqual(actual, saved);
}

const tokenHash = token => createHash('sha256').update(token).digest('hex');

// Same rule as the Java backend (PasswordHasher.problemWith). The old shared defaults are retired.
const RETIRED = new Set(['admin@123', 'staff@123']);
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Use at least 8 characters for the password.';
  if (password.length > 128) return 'Use 128 characters or fewer for the password.';
  if (RETIRED.has(password.toLowerCase())) return 'That shared default password is no longer allowed. Choose one for this person only.';
  return null;
}
module.exports = { hashPassword, verifyPassword, tokenHash, passwordProblem };
