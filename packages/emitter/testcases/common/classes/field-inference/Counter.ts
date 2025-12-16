// Class fields without explicit type annotations
// TypeScript infers types from initializers
export class Counter {
  count = 0;
  name = "default";
  active = true;

  increment(): void {
    this.count++;
  }
}
