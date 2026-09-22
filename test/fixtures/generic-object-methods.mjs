export const genericObjectMethodFiles = {
  "factory.ts": `
    export interface Identity { identity<T>(value: T): T; }
    export function identity(): Identity {
      return { identity<U>(value: U): U { return value; } };
    }
    export function factory<Outer>(seed: Outer) {
      let count = 0;
      const operations = {
        identity<T>(value: T): T { count++; return value; },
        first<T>(values: T[]): T { return values[0]; },
        seeded<T>(value: T): [Outer, T] { return [seed, value]; },
        read<T>(value: T): number { return count; },
        constrained<T extends { score: number }>(value: T): number { return value.score + count; },
      };
      operations.identity(1);
      count += 2;
      return operations;
    }
  `,
  "index.ts": `
    import { factory, identity } from "./factory.js";
    export function run(): boolean {
      const left = identity();
      const right = { identity<T>(value: T): T { return value; } };
      if (left.identity(3) !== 3 || left.identity("left") !== "left") return false;
      if (right.identity(true) !== true) return false;
      const operations = factory("seed");
      const alias = operations;
      if (alias.identity("item") !== "item" || operations.read(false) !== 4) return false;
      if (operations.first([7, 8]) !== 7 || operations.constrained({ score: 6 }) !== 10) return false;
      const pair = operations.seeded(true);
      if (pair[0] !== "seed" || pair[1] !== true) return false;
      const independent = factory(9);
      return independent.read(0) === 3 && operations.read(0) === 4 &&
        independent.seeded("other")[0] === 9;
    }
  `,
};

export const genericObjectCaptureSource = `
  interface Reader { read<T>(value: T): number; }
  function build(): Reader[] {
    const result: Reader[] = [];
    for (let index = 0; index < 4; index++) {
      if (index === 2) continue;
      let local = index;
      result.push({ read<T>(value: T): number { local++; return local + index; } });
    }
    return result;
  }
  function parameter(value: number) {
    const result = { increment<T>(item: T): T { value++; return item; }, read<T>(item: T): number { return value; } };
    value += 2;
    return result;
  }
  function destructured({ count }: { count: number }) {
    return { change<T>(item: T): T { count++; return item; }, count<T>(item: T): number { return count; } };
  }
  export function run(): boolean {
    const readers = build();
    if (readers.length !== 3 || readers[0].read(0) !== 1 || readers[1].read(0) !== 3 || readers[2].read(0) !== 7) return false;
    if (readers[0].read(0) !== 2 || readers[1].read(0) !== 4) return false;
    const counter = parameter(7);
    if (counter.increment("x") !== "x" || counter.read(0) !== 10) return false;
    const captured = destructured({ count: 11 });
    return captured.change(true) && captured.count(0) === 12;
  }
`;

export const invalidGenericObjectMethods = [
  `const value = { identity<T>(item: T): T { return item; } }; export const result: number = value.identity("wrong");`,
  `const value = { score<T extends { score: number }>(item: T): number { return item.score; } }; export const result = value.score({ score: "wrong" });`,
];
