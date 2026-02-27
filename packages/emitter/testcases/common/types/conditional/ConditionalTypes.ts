export type StringOrNumberOrBoolean = string | number | boolean;

export type OnlyStrings = Extract<StringOrNumberOrBoolean, string>;
export type NoStrings = Exclude<StringOrNumberOrBoolean, string>;
export type NonNullableValue = NonNullable<string | null | undefined>;

export type IsArray<T> = T extends readonly unknown[] ? true : false;
export type ArrayCheck1 = IsArray<readonly string[]>;
export type ArrayCheck2 = IsArray<string>;

export type Unwrap<T> = T extends Promise<infer U> ? U : T;
export type UnwrappedString = Unwrap<Promise<string>>;
export type UnwrappedNumber = Unwrap<number>;

export type PickValue<T> = T extends { value: infer U } ? U : never;
export type PickedFromObject = PickValue<{ value: number }>;

export function greet(name: string): string {
  return `Hello ${name}`;
}

export type GreetReturn = ReturnType<typeof greet>;
