// Main entry point - tests imported type in type annotations
import { User, createUser, formatUser } from "./models/user.ts";
import { Console } from "System";

// Use imported type in type annotation
function greetUser(user: User): void {
  Console.WriteLine(`Hello, ${formatUser(user)}!`);
}

// Entry point
export function main(): void {
  const alice: User = createUser("Alice", 30);
  greetUser(alice);
  Console.WriteLine("Done");
}
