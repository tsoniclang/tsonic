export const receiverOwnerCaptures = [
  { name: "escaped-method", source: `
    class Counter {
      count = 1;
      advance(): number { this.count += 1; return this.count; }
      callback(): () => number { return () => this.advance(); }
    }
    function create(): () => number { return new Counter().callback(); }
    export function run(): boolean { const next = create(); return next() === 2 && next() === 3; }
  ` },
  { name: "mixed-field-and-method", source: `
    class Counter {
      count = 1;
      advance(): void { this.count += 1; }
      callback(): () => number { return () => { this.advance(); return this.count; }; }
    }
    export function run(): boolean {
      const counter = new Counter(); const next = counter.callback(); counter.count = 4;
      return next() === 5 && counter.count === 5;
    }
  ` },
  { name: "accessor-and-live-replacement", source: `
    class Counter {
      count = 1;
      get value(): number { return this.count; }
      set value(value: number) { this.count = value; }
      callback(): () => number { return () => { this.value += 1; return this.value; }; }
    }
    export function run(): boolean {
      const counter = new Counter(); const next = counter.callback(); counter.value = 6;
      return next() === 7 && counter.value === 7;
    }
  ` },
  { name: "inherited-native-root", source: `
    class Base {
      count = 1;
      advance(): number { this.count += 1; return this.count; }
      callback(): () => number { return () => this.advance(); }
    }
    class Derived extends Base { advance(): number { this.count += 2; return this.count; } }
    function create(): () => number { const value: Base = new Derived(); return value.callback(); }
    export function run(): boolean { const next = create(); return next() === 3 && next() === 5; }
  ` },
  { name: "generic-native-owner", source: `
    class Box<T> {
      constructor(public value: T) {}
      read(): T { return this.value; }
      callback(): () => T { return () => this.read(); }
    }
    export function run(): boolean {
      const box = new Box("left"); const read = box.callback(); box.value = "right";
      return read() === "right";
    }
  ` },
  { name: "nested-native-owner", source: `
    class Counter {
      count = 1;
      advance(): number { this.count += 1; return this.count; }
      callback(): () => (() => number) { return () => (() => this.advance()); }
    }
    export function run(): boolean {
      const outer = new Counter().callback(); const left = outer(); const right = outer();
      return left() === 2 && right() === 3;
    }
  ` },
  { name: "quantified-native-owner", source: `
    class Counter {
      count = 1;
      advance(): void { this.count += 1; }
      callback(): <T>(value: T) => T { return <T>(value: T): T => { this.advance(); return value; }; }
    }
    export function run(): boolean {
      const counter = new Counter(); const callback = counter.callback();
      return callback(3) === 3 && callback("value") === "value" && counter.count === 3;
    }
  ` },
  { name: "suspended-native-owner", asynchronous: true, source: `
    async function pause(): Promise<void> {}
    class Counter {
      count = 1;
      advance(): number { this.count += 1; return this.count; }
      callback(): () => Promise<number> { return async () => { await pause(); return this.advance(); }; }
    }
    export async function run(): Promise<boolean> {
      const callback = new Counter().callback(); return await callback() === 2 && await callback() === 3;
    }
  ` },
];
