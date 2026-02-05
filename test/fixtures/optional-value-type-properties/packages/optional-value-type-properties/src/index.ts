import type { long } from "@tsonic/core/types.js";
import { Console, DateTimeOffset } from "@tsonic/dotnet/System.js";

class Key {
  RevokedAt?: long;
}

class Key2 {
  constructor(public RevokedAt?: long) {}
}

export function main(): void {
  const k = new Key();

  const ok1 = k.RevokedAt === undefined;
  k.RevokedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
  const ok2 = k.RevokedAt !== undefined;

  const k2 = new Key2();
  const ok3 = k2.RevokedAt === undefined;
  k2.RevokedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
  const ok4 = k2.RevokedAt !== undefined;

  Console.WriteLine(ok1 && ok2 && ok3 && ok4 ? "OK" : "BAD");
}
