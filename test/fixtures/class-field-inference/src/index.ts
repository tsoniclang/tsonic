import { Console } from "@tsonic/dotnet/System";
import { int } from "@tsonic/dotnet/System";

// Class fields with explicit type annotations (required for deterministic typing)
class Counter {
  count: int = 0;
  name: string = "default";
  active: boolean = true;

  increment(): void {
    this.count++;
  }
}

const counter = new Counter();
Console.writeLine(`Initial count: ${counter.count}`);
Console.writeLine(`Name: ${counter.name}`);
Console.writeLine(`Active: ${counter.active}`);

counter.increment();
counter.increment();
Console.writeLine(`After increments: ${counter.count}`);
