import { Console } from "@tsonic/dotnet/System.js";

class Box {
  private readonly items: string[];

  constructor() {
    this.items = [];
  }

  add(value: string): void {
    this.items.push(value);
  }

  joined(): string {
    return this.items.join("-");
  }
}

function main(): void {
  const box = new Box();
  box.add("a");
  box.add("b");
  Console.WriteLine(box.joined());
}

main();
