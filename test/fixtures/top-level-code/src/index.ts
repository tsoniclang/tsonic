import { Console } from "@tsonic/dotnet/System";

// Top-level code without explicit main function
// This tests automatic Main() wrapping for entry points

const greeting = "Hello from top-level!";

// Top-level executable statements
Console.writeLine(greeting);
Console.writeLine("Line 1");
Console.writeLine("Line 2");
Console.writeLine("Done!");
