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
    export function shadowed<T, T2>(seed: T, other: T2) {
      return {
        identity<T>(value: T): T { return value; },
        seed<U>(value: U): T { return seed; },
        other<U>(value: U): T2 { return other; },
        constrained<T extends { score: number }>(value: T): number { return value.score; },
      };
    }
  `,
  "index.ts": `
    import { factory, identity, shadowed } from "./factory.js";
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
      const scoped = shadowed("outer", 17);
      if (scoped.identity(23) !== 23 || scoped.seed(false) !== "outer" || scoped.other(true) !== 17 || scoped.constrained({ score: 4 }) !== 4) return false;
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
  function mixed(seed: number) {
    let count = seed;
    const methods = { add<T>(item: T): T { count++; return item; }, read<T>(item: T): number { return count; } };
    const read = () => count;
    const increment = function (step: number): number { count += step; return count; };
    count += 2;
    return { methods, read, increment };
  }
  function mixedLoops(): boolean {
    const calls: (() => number)[] = [];
    const methods: Reader[] = [];
    const conditions: (() => number)[] = [];
    const increments: (() => number)[] = [];
    for (let index = 0; (conditions.push(() => index), index < 3); (increments.push(() => index), index++)) {
      let local = index;
      methods.push({ read<T>(value: T): number { local++; return local + index; } });
      calls.push(() => local + index);
    }
    if (calls[0]() !== 0 || calls[1]() !== 2 || calls[2]() !== 4) return false;
    if (methods[1].read(0) !== 3 || calls[1]() !== 3 || calls[0]() !== 0) return false;
    return conditions[0]() === 0 && conditions[1]() === 1 && conditions[3]() === 3 &&
      increments[0]() === 1 && increments[1]() === 2 && increments[2]() === 3;
  }
  function labeled(): boolean {
    const callbacks: (() => number)[] = [];
    const objects: Reader[] = [];
    outer: for (let index = 0; index < 3; index++) {
      objects.push({ read<T>(value: T): number { return index; } });
      callbacks.push(() => index);
      for (let inner = 0; inner < 2; inner++) { continue outer; }
    }
    return callbacks[0]() === 0 && callbacks[2]() === 2 && objects[0].read(0) === 0 && objects[2].read(0) === 2;
  }
  class Owner {
    value: number = 5;
    build(seed: number) {
      let count = seed;
      const methods = { read<T>(item: T): number { return count; } };
      const callback = (step: number): number => { count += step; this.value += count; return this.value; };
      return { methods, callback };
    }
  }
  export function run(): boolean {
    const readers = build();
    if (readers.length !== 3 || readers[0].read(0) !== 1 || readers[1].read(0) !== 3 || readers[2].read(0) !== 7) return false;
    if (readers[0].read(0) !== 2 || readers[1].read(0) !== 4) return false;
    const counter = parameter(7);
    if (counter.increment("x") !== "x" || counter.read(0) !== 10) return false;
    const captured = destructured({ count: 11 });
    if (!captured.change(true) || captured.count(0) !== 12 || !mixedLoops() || !labeled()) return false;
    const shared = mixed(7);
    if (shared.read() !== 9 || shared.increment(3) !== 12 || shared.methods.read(0) !== 12) return false;
    if (!shared.methods.add(true) || shared.read() !== 13) return false;
    const owner = new Owner();
    const receiver = owner.build(4);
    return receiver.callback(2) === 11 && receiver.methods.read(0) === 6 && owner.value === 11;
  }
`;

export const invalidGenericObjectMethods = [
  `const value = { identity<T>(item: T): T { return item; } }; export const result: number = value.identity("wrong");`,
  `const value = { score<T extends { score: number }>(item: T): number { return item.score; } }; export const result = value.score({ score: "wrong" });`,
];

export const genericObjectMethodValueSource = `
  interface Identity { identity<T>(value: T): T; }
  function make(seed: number) {
    let count = seed;
    return {
      identity<T>(value: T): T { count++; return value; },
      other<T>(value: T): T { count += 2; return value; },
      read<T>(value: T): number { return count; },
    };
  }
  function returned() { const value = make(3); return value.identity; }
  export function run(): boolean {
    const value = make(5);
    const identity = value.identity;
    const alias = identity;
    if (identity(7) !== 7 || alias("value") !== "value" || value.read(false) !== 7) return false;
    if (identity !== alias || identity !== value.identity || identity === value.other) return false;
    const second = make(5);
    if (identity === second.identity) return false;
    const contract: Identity = value;
    const fromContract = contract.identity;
    if (fromContract !== identity || !fromContract(true) || value.read(0) !== 8) return false;
    let evaluations = 0;
    const receiver = () => { evaluations++; return value; };
    const selected = receiver().identity;
    if (evaluations !== 1 || selected(9) !== 9 || evaluations !== 1) return false;
    const escaped = returned();
    const stored = { call: value.identity };
    const extracted = stored.call;
    if (stored.call<number>(13) !== 13 || extracted !== identity || !extracted<boolean>(true)) return false;
    const copied = { ...value, extra: 17 };
    const projected = { ...contract, extra: 19 };
    const copiedAgain = { ...copied };
    if (copied.identity !== identity || projected.identity !== identity || copiedAgain.identity !== identity) return false;
    if (copied.extra !== 17 || projected.extra !== 19 || copied.identity(23) !== 23 || !projected.identity(true)) return false;
    if (copiedAgain.identity("copy") !== "copy" || copiedAgain.read(0) !== value.read(0)) return false;
    return escaped("returned") === "returned" && escaped(11) === 11;
  }
`;
