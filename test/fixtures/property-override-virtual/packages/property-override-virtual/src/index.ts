import { Console } from "@tsonic/dotnet/System.js";

class Base {
  value: string = "base";

  Print(): void {
    Console.WriteLine(this.value);
  }
}

class Derived extends Base {
  value: string = "derived";
}

export function main(): void {
  const b: Base = new Derived();
  b.Print();
}
