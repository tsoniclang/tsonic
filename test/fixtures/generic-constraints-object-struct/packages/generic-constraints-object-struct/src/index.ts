import { Console } from "@tsonic/dotnet/System.js";

// Reference type constraint (class)
class RefWrapper<T extends object> {
  value: T | null;
  constructor(value: T | null) {
    this.value = value;
  }
  isNull(): boolean {
    return this.value === null;
  }
}

// Test reference type
class MyClass {
  data: string;
  constructor() {
    this.data = "test";
  }
}

export function main(): void {
  const refW = new RefWrapper<MyClass>(new MyClass());
  Console.WriteLine(`Is null: ${refW.isNull()}`);

  const refNull = new RefWrapper<MyClass>(null);
  Console.WriteLine(`Is null: ${refNull.isNull()}`);
}
