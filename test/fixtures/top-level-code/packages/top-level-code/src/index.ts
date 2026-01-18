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
Console.WriteLine(getGreeting());
Console.WriteLine("Line 1");
Console.WriteLine("Line 2");
Console.WriteLine("Done!");
