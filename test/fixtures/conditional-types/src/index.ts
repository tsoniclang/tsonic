import { Console } from "@tsonic/dotnet/System";

// Test conditional types
type StringOrNumber = string | number | boolean;

// Using built-in conditional utility types
type OnlyStrings = Extract<StringOrNumber, string>;
type NoStrings = Exclude<StringOrNumber, string>;

// Custom conditional type
type IsArray<T> = T extends any[] ? true : false;

type ArrayCheck1 = IsArray<string[]>;
type ArrayCheck2 = IsArray<string>;

// Function using conditional type
function processValue<T extends string | number>(
  value: T
): T extends string ? number : string {
  if (typeof value === "string") {
    return value.length as any;
  }
  return value.toString() as any;
}

function greet(name: string): string {
  return `Hello ${name}`;
}

type GreetReturn = ReturnType<typeof greet>;

const strResult = processValue("hello");
const numResult = processValue(42);

Console.writeLine(`String processed: ${strResult}`);
Console.writeLine(`Number processed: ${numResult}`);
Console.writeLine(greet("World"));
