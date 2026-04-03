import { RSA } from "@acme/crypto/index.js";
import type { RSA as RsaInstance } from "@acme/crypto/index.js";

declare function takesRsa(value: RsaInstance): void;

export function encrypt(value: RsaInstance | string): string {
  if (value instanceof RSA) {
    takesRsa(value);
    return value.Encrypt("payload");
  }
  return value;
}
