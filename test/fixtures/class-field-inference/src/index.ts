import { Console } from "@tsonic/dotnet/System";

// Class fields without explicit type annotations
class Counter {
  count = 0;
  name = "default";
  active = true;

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
