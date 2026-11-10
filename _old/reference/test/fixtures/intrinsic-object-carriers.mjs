export const intrinsicObjectCarrierFiles = Object.freeze({
  "objects.ts": `export type Token = object;
    export function retain(value: Token): Token { return value; }
    export function inferred(value: Token) { return retain(value); }
    export function readonly(value: Token): Readonly<Token> { return value; }`,
  "index.ts": `import { retain, inferred, readonly } from "./objects.js";
    import type { Token } from "./objects.js";
    class Holder { value = 3; }
    function accept(value: object): object { return value; }
    export function run(): boolean {
      const empty: Token = {};
      const record: object = { count: 7 };
      const typed = { count: 7 };
      const retained = retain(typed);
      const repeated = retain(typed);
      typed.count = 9;
      const instance: Token = new Holder();
      return inferred(empty) === empty && readonly(empty) === empty && accept(retain(empty)) === empty &&
        inferred(record) === record && readonly(record) === record && inferred(instance) === instance &&
        readonly(instance) === instance && retained === repeated && retained === typed && typed.count === 9;
    }`,
});
