/**
 * Entry point - tests importing interface + functions from same module
 * where filename matches interface name (causes __Module suffix)
 */

import { Console } from "@tsonic/dotnet/System.js";
import { User, createUser, formatUser } from "./models/User.js";

export function main(): void {
  const user: User = createUser(1.0, "Alice", "alice@example.com");
  Console.WriteLine(formatUser(user));
}
