// Test barrel re-exports - imports through index.ts barrel file
import { User, createUser } from "./models/index.ts";
import { Console } from "System";

function formatUser(user: User): string {
  return `User #${user.id}: ${user.name}`;
}

export function main(): void {
  const alice: User = createUser(1, "Alice");
  const bob: User = createUser(2, "Bob");

  Console.WriteLine(formatUser(alice));
  Console.WriteLine(formatUser(bob));
  Console.WriteLine("Done");
}
