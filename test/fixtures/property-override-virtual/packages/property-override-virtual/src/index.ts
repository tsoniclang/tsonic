import { Console } from "@tsonic/dotnet/System.js";

class Base {
  public value: string = "base";

  public Print(): void {
    Console.WriteLine(this.value);
  }
}

class Derived extends Base {
  public value: string = "derived";
}

export function main(): void {
  const b: Base = new Derived();
  b.Print();
}
