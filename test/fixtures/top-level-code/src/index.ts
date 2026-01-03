import { Console } from "@tsonic/dotnet/System.js";

// Top-level code without explicit main function
// This tests automatic Main() wrapping for entry points

// Top-level variable referenced by exported function
// This must stay as a static field, not moved into Main
const greeting = "Hello from top-level!";

// Exported function that references the top-level variable
export function getGreeting(): string {
  return greeting;
}

// Top-level executable statements (these go into Main)
Console.writeLine(getGreeting());
Console.writeLine("Line 1");
Console.writeLine("Line 2");
Console.writeLine("Done!");
