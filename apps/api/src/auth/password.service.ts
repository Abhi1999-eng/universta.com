import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_ALGORITHM = 'scrypt';
const SALT_BYTES = 16;
const DERIVED_KEY_BYTES = 64;

@Injectable()
export class PasswordService {
  hash(password: string): string {
    const salt = randomBytes(SALT_BYTES);
    const derivedKey = scryptSync(password, salt, DERIVED_KEY_BYTES);
    return `${SCRYPT_ALGORITHM}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
  }

  verify(password: string, storedHash: string): boolean {
    try {
      const [algorithm, saltHex, derivedKeyHex, ...extra] =
        storedHash.split('$');
      if (
        algorithm !== SCRYPT_ALGORITHM ||
        extra.length > 0 ||
        !/^[0-9a-f]+$/i.test(saltHex) ||
        !/^[0-9a-f]+$/i.test(derivedKeyHex)
      ) {
        return false;
      }

      const salt = Buffer.from(saltHex, 'hex');
      const expectedKey = Buffer.from(derivedKeyHex, 'hex');
      if (
        salt.length !== SALT_BYTES ||
        expectedKey.length !== DERIVED_KEY_BYTES
      ) {
        return false;
      }

      const actualKey = scryptSync(password, salt, expectedKey.length);
      return timingSafeEqual(actualKey, expectedKey);
    } catch {
      return false;
    }
  }
}
