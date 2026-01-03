// Test barrel re-exports - imports through index.ts barrel file
import { User, createUser } from "./models/index.js";
import { Console } from "@tsonic/dotnet/System.js";

function formatUser(user: User): string {
  return `User #${user.id}: ${user.name}`;
}

export function main(): void {
  const alice: User = createUser(1.0, "Alice");
  const bob: User = createUser(2.0, "Bob");

  Console.writeLine(formatUser(alice));
  Console.writeLine(formatUser(bob));
  Console.writeLine("Done");
}
