import { Console } from "@tsonic/dotnet/System";

// Test NonNullable - filters null/undefined from union types
type MaybeString = string | null | undefined;

// Test Exclude - removes types assignable to U
type StringOrNumber = string | number;

// Test Record with string literal keys - expands to object type
type StatusMap = Record<"pending" | "active" | "done", boolean>;

export function main(): void {
  // NonNullable<MaybeString> = string
  const definite: NonNullable<MaybeString> = "hello";
  Console.writeLine("NonNullable: " + definite);
  
  // Exclude<StringOrNumber, number> = string
  const onlyStr: Exclude<StringOrNumber, number> = "world";
  Console.writeLine("Exclude: " + onlyStr);
  
  // Extract<StringOrNumber, number> = number
  const extractedNum: Extract<StringOrNumber, number> = 42;
  Console.writeLine("Extract: passed");
  
  // Record with string literal keys
  const status: StatusMap = { pending: true, active: false, done: false };
  Console.writeLine("Record: " + (status.pending ? "pending is true" : "pending is false"));
}
