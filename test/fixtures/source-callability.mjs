export const sourceCallabilityPositiveCases = Object.freeze([
  Object.freeze({ name: "functions and constructors retain their callable identity", source: `
    function retain<Value extends Function>(value: Value): Value { return value; }
    function identity<Value>(value: Value): Value { return value; }
    class Item { value: number = 1; }
    const increment = (value: number): number => value + 1;
    const selected = retain(increment);
    const retainedIdentity = retain(identity);
    const Constructor = retain(Item);
    const ordinary: Function = increment;
    const constructible: Function = Item;
    const callable: CallableFunction = increment;
    const newable: NewableFunction = Item;
    export const result: number = retainedIdentity(selected(new Constructor().value));
  ` }),
  Object.freeze({ name: "overloads and optional callable values remain checked", source: `
    function select(value: string): string;
    function select(value: number): number;
    function select(value: string | number): string | number { return value; }
    function invoke(callback: ((value: number) => number) | undefined): number | undefined {
      return callback?.(select(4));
    }
    export const result: number | undefined = invoke((value: number): number => value + 1);
  ` }),
]);

export const sourceCallabilityNegativeCases = Object.freeze([
  ...["4", '"text"', "true", "{}", "[1, 2]"].map(value => Object.freeze({
    name: `non-callable ${value}`, source: `const value = ${value}; value();`, diagnostic: /TS2349/u,
  })),
  Object.freeze({ name: "optional non-callable", source: "function invoke(value: string | undefined): void { value?.(); }",
    diagnostic: /TS2349/u }),
  Object.freeze({ name: "non-callable tag", source: "const value = {}; value`text`;", diagnostic: /TS2349/u }),
  Object.freeze({ name: "non-constructible record", source: "const value = {}; new value();", diagnostic: /TS2351/u }),
  Object.freeze({ name: "non-constructible symbol", source: "declare const value: unique symbol; new value();", diagnostic: /TS2351/u }),
  Object.freeze({ name: "non-callable unique symbol", source: "declare const value: unique symbol; value();", diagnostic: /TS2349/u }),
  Object.freeze({ name: "immutable symbol alias", source: "declare const value: unique symbol; const alias = value; alias();",
    diagnostic: /TS2349/u }),
  Object.freeze({ name: "mutable symbol alias", source: "declare const value: unique symbol; let alias = value; alias();",
    diagnostic: /TS2349/u }),
  Object.freeze({ name: "records cannot satisfy Function", source: "const value: Function = {};", diagnostic: /TS2741|TS2322/u }),
  Object.freeze({ name: "records cannot satisfy a callable constraint",
    source: "function retain<Value extends Function>(value: Value): Value { return value; } retain({});", diagnostic: /TS2741: Property '\[callable\]' is missing/u }),
  Object.freeze({ name: "lookalike ordinary properties are not callable identity", source: `
    const value = { length: 0, name: "lookalike", prototype: {}, call(): void {}, apply(): void {}, bind(): void {} };
    value();
  `, diagnostic: /TS2349/u }),
  Object.freeze({ name: "ordinary parameter checking stays strict", source: 'function invoke(value: number): void {} invoke("wrong");',
    diagnostic: /TS2345/u }),
]);

export const sourceCallabilityEmissionSource = `
export function run(): number {
  const increment = (value: number): number => value + 1;
  return increment(41);
}
`;
