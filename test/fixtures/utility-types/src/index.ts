import { Console } from "@tsonic/dotnet/System";

// Test NonNullable - filters null/undefined from union types
type MaybeString = string | null | undefined;

// Test Exclude - removes types assignable to U
type StringOrNumber = string | number;

// Test Record with string literal keys - expands to object type
type StatusMap = Record<"pending" | "active" | "done", boolean>;

// Test functions for ReturnType and Parameters
function add(a: number, b: number): number {
  return a + b;
}

function greet(name: string): string {
  return "Hello, " + name;
}

// ReturnType extracts the return type of a function
// These type aliases demonstrate that ReturnType compiles correctly
type AddResult = ReturnType<typeof add>;
type GreetResult = ReturnType<typeof greet>;

// Parameters extracts the parameter types as a tuple
type AddParams = Parameters<typeof add>;
type GreetParams = Parameters<typeof greet>;

export function main(): void {
  // NonNullable<MaybeString> = string
  const definite: NonNullable<MaybeString> = "hello";
  Console.writeLine("NonNullable: " + definite);

  // Exclude<StringOrNumber, number> = string
  const onlyStr: Exclude<StringOrNumber, number> = "world";
  Console.writeLine("Exclude: " + onlyStr);

  // Extract<StringOrNumber, number> = number
  const extractedNum: Extract<StringOrNumber, number> = 42.0;
  Console.writeLine("Extract: passed");

  // Record with string literal keys
  const status: StatusMap = { pending: true, active: false, done: false };
  Console.writeLine(
    "Record: " + (status.pending ? "pending is true" : "pending is false")
  );

  // ReturnType tests - use inline to avoid alias emission issue
  const addResult: ReturnType<typeof add> = add(10.0, 20.0);
  Console.writeLine("ReturnType<add>: " + addResult);

  const greetResult: ReturnType<typeof greet> = greet("World");
  Console.writeLine("ReturnType<greet>: " + greetResult);

  // Parameters - verify type aliases compile (tuple usage not yet supported)
  Console.writeLine("Parameters<add>: type compiled successfully");
  Console.writeLine("Parameters<greet>: type compiled successfully");
}
