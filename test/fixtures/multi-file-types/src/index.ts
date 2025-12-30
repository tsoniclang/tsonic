// Main entry point - tests imported type in type annotations
import { User, createUser, formatUser } from "./models/user.js";
import { Console } from "@tsonic/dotnet/System.js";

// Use imported type in type annotation
function greetUser(user: User): void {
  Console.writeLine(`Hello, ${formatUser(user)}!`);
}

// Entry point
export function main(): void {
  const alice: User = createUser("Alice", 30.0);
  greetUser(alice);
  Console.writeLine("Done");
}
