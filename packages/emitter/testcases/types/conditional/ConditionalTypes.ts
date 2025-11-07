export type StringOrNumber = string | number | boolean;

// Using built-in conditional utility types
export type OnlyStrings = Extract<StringOrNumber, string>;
export type NoStrings = Exclude<StringOrNumber, string>;
export type NonNullableValue = NonNullable<string | null | undefined>;

// Custom conditional type
export type IsArray<T> = T extends any[] ? true : false;

export type ArrayCheck1 = IsArray<string[]>;
export type ArrayCheck2 = IsArray<string>;

// More complex conditional type
export type Unwrap<T> = T extends Promise<infer U> ? U : T;

export type UnwrappedString = Unwrap<Promise<string>>;
export type UnwrappedNumber = Unwrap<number>;

// Function using conditional type
export function processValue<T extends string | number>(
  value: T
): T extends string ? number : string {
  if (typeof value === "string") {
    return value.length as any;
  }
  return value.toString() as any;
}

// ReturnType utility
export function greet(name: string): string {
  return `Hello ${name}`;
}

export type GreetReturn = ReturnType<typeof greet>;
