/**
 * Entry point - tests importing interface + functions from same module
 * where filename matches interface name (causes __Module suffix)
 */

import { Console } from "@tsonic/dotnet/System";
import { User, createUser, formatUser } from "./models/User.ts";

export function main(): void {
  const user: User = createUser(1, "Alice", "alice@example.com");
  Console.WriteLine(formatUser(user));
}
