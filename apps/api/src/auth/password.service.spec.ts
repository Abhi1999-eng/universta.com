import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('verifies a password in the foundation scrypt format', () => {
    const stored = service.hash('correct-password');

    expect(service.verify('correct-password', stored)).toBe(true);
    expect(service.verify('wrong-password', stored)).toBe(false);
  });

  it('rejects malformed hashes safely', () => {
    expect(service.verify('anything', '')).toBe(false);
    expect(service.verify('anything', 'bcrypt$not-a-scrypt-hash')).toBe(false);
    expect(service.verify('anything', 'scrypt$00$00')).toBe(false);
    expect(service.verify('anything', 'scrypt$zz$zz')).toBe(false);
  });
});
