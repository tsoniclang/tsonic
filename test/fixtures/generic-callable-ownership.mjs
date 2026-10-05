export const genericCallableOwnershipCases = Object.freeze([
  {
    name: "supported-nested-payload",
    source: `
      export const create = <Outer>(seed: Outer) =>
        <Item>(value: Item): { seed: Outer; value: Item } => ({ seed, value });
      export function main(): void {
        const first = create(3);
        const second = create("seed");
        const left = first("left");
        const right = second(7);
        if (left.seed !== 3 || left.value !== "left" || right.seed !== "seed" || right.value !== 7)
          throw new Error("nested invocation binders");
      }
    `,
  },
  {
    name: "mutable-and-immutable-frame",
    source: `
      export function create(seed: number) {
        let first = true;
        const choose = <Item>(left: Item, right: Item): { seed: number; value: Item } =>
          ({ seed, value: first ? left : right });
        const change = (): void => { first = false; };
        return { choose, change };
      }
      export function main(): void {
        const value = create(7);
        const old = value.choose;
        value.change();
        const result = old("left", "right");
        if (old !== value.choose || result.seed !== 7 || result.value !== "right")
          throw new Error("shared mutable and immutable capture frame");
      }
    `,
  },
  {
    name: "conditional-creation-identity",
    source: `
      export function main(): void {
        let choose: <Item>(left: Item, right: Item) => Item = <Item>(left: Item, right: Item): Item => left;
        const original = choose;
        let first = true;
        for (let index = 0; index < 2; index += 1) {
          const next = first
            ? <Item>(left: Item, right: Item): Item => left
            : <Item>(left: Item, right: Item): Item => right;
          if (next === choose) throw new Error("distinct conditional creation");
          choose = next;
          first = false;
        }
        if (original(1, 2) !== 1 || choose("left", "right") !== "right")
          throw new Error("conditional callable body");
      }
    `,
  },
  {
    name: "loop-capture-identity",
    source: `
      export function main(): void {
        let previous: (<Item>(left: Item, right: Item) => { index: number; value: Item }) | undefined;
        for (let index = 0; index < 3; index += 1) {
          const choose = <Item>(left: Item, right: Item): { index: number; value: Item } =>
            ({ index, value: index === 0 ? left : right });
          if (previous !== undefined) {
            const old = previous("left", "right");
            if (choose === previous || old.index !== index - 1 ||
                old.value !== (index === 1 ? "left" : "right")) throw new Error("loop capture lifetime");
          }
          previous = choose;
        }
      }
    `,
  },
  {
    name: "captured-native-constraint",
    source: `
      export class Seed { constructor(public readonly value: number) {} }
      export function create<Outer extends Seed>(seed: Outer) {
        return <Item>(value: Item): { seed: Outer; value: Item } => ({ seed, value });
      }
      export function main(): void {
        const choose = create(new Seed(7));
        const result = choose("value");
        if (result.seed.value !== 7 || result.value !== "value") throw new Error("outer native constraint");
      }
    `,
  },
  {
    name: "inherited-field-substitution",
    source: `
      export class Base<Item> {
        constructor(public readonly seed: Item) {}
        read = (): Item => this.seed;
      }
      export class Value extends Base<number> {
        read = (): number => this.seed + 1;
      }
      export function main(): void {
        const value = new Value(3);
        if (value.read() !== 4) throw new Error("selected inherited callable substitution");
      }
    `,
  },
  {
    name: "transitive-native-constraint",
    source: `
      export class Container<Value> { constructor(public readonly value: Value) {} }
      export function create<Payload, Outer extends Container<Payload>>(seed: Outer) {
        return <Item>(value: Item): { seed: Outer; value: Item } => ({ seed, value });
      }
      export function main(): void {
        const choose = create<number, Container<number>>(new Container(7));
        const result = choose("value");
        if (result.seed.value !== 7 || result.value !== "value") throw new Error("transitive native constraint");
      }
    `,
  },
  {
    name: "same-spelling-distinct-binders",
    source: `
      export function create<Item>(seed: Item) {
        const saved: [Item, boolean] = [seed, true];
        return <Item>(value: Item): Item => saved[1] ? value : value;
      }
      export function main(): void {
        const choose = create(7);
        if (choose("value") !== "value" || choose(3) !== 3) throw new Error("exact nested binder identity");
      }
    `,
  },
  {
    name: "named-local-monomorphic-owner",
    source: `
      export function create(seed: number) {
        function choose(left: number, right: number): number { return seed > 0 ? left : right; }
        const first = choose;
        const second = choose;
        return { first, second };
      }
      export function main(): void {
        const value = create(1);
        if (value.first !== value.second || value.first(3, 4) !== 3) throw new Error("native delegate identity");
      }
    `,
  },
]);
