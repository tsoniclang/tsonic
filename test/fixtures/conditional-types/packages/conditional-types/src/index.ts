import { Console } from "@tsonic/dotnet/System.js";

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
  return value.ToString() as any;
}

function greet(name: string): string {
  return `Hello ${name}`;
}

type GreetReturn = ReturnType<typeof greet>;

const strResult = processValue("hello");
const numResult = processValue(42);

Console.WriteLine(`String processed: ${strResult}`);
Console.WriteLine(`Number processed: ${numResult}`);
Console.WriteLine(greet("World"));
