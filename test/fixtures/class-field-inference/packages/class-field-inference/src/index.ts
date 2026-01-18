import { Console } from "@tsonic/dotnet/System.js";
import { int } from "@tsonic/core/types.js";

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
Console.WriteLine(`Initial count: ${counter.count}`);
Console.WriteLine(`Name: ${counter.name}`);
Console.WriteLine(`Active: ${counter.active}`);

counter.increment();
counter.increment();
Console.WriteLine(`After increments: ${counter.count}`);
