import assert from "node:assert/strict";
import test from "node:test";
import { auditPublicTypeBoundary } from "./tooling/public-type-boundary.mjs";
import { collectConsumedPublicExports } from "./tooling/public-declarations.mjs";

function audit(text, options = {}) {
  return auditPublicTypeBoundary({
    files: new Map([
      ["/probe/checker.d.ts", `
        export interface Type { readonly checkerType: unique symbol }
        export interface Signature { readonly checkerSignature: unique symbol }
        export interface Symbol { readonly checkerSymbol: unique symbol }
        export interface CheckedSourceProgram { readonly checkerProgram: unique symbol }
        export interface Node { readonly kind: number; readonly parent?: Node }
        export interface SourceFile extends Node { readonly fileName: string }
        export interface ExtensionFactKey<Value> { readonly snapshot: (value: Value) => Value }
      `],
      ["/probe/hidden.d.ts", `import type { Type } from './checker.js'; export interface Hidden { readonly cached: Type }`],
      ["/workspace/packages/host/dist/host-input/private.d.ts", `export interface Builder { define(value: string): object }`],
      ["/probe/entry.d.ts", `import type { Type, Signature, Symbol, CheckedSourceProgram, Node, SourceFile, ExtensionFactKey } from './checker.js'; ${text}`],
      ["/probe/index.d.ts", `export * from './entry.js'; export * as Nested from './hidden.js';`],
    ]),
    entries: [
      { name: "checker", file: "/probe/checker.d.ts" },
      { name: "public", file: "/probe/index.d.ts" },
    ],
    checkerEntry: "checker", targets: [{ entry: "public", exports: "all" }], ...options,
  });
}

const row = (rows, name, surface = "instance") => rows.find(result => result.subject === `public.${name}:${surface}`);

test("public export inventory checks both instance and static/constructor class surfaces", () => {
  const rows = audit(`
    export class InstanceLeak { readonly cached: Type }
    export class StaticLeak { static read(type: Type): void; readonly name: string }
    export class ConstructorLeak { constructor(type: Signature); readonly name: string }
    export class Clean { constructor(site: Node); static read(file: SourceFile): string; readonly name: string }
  `);
  assert.equal(row(rows, "InstanceLeak").verdict, "checker");
  assert.equal(row(rows, "StaticLeak").verdict, "clean");
  assert.equal(row(rows, "StaticLeak", "value").verdict, "checker");
  assert.equal(row(rows, "ConstructorLeak").verdict, "clean");
  assert.equal(row(rows, "ConstructorLeak", "value").verdict, "checker");
  assert.equal(row(rows, "Clean").verdict, "clean");
  assert.equal(row(rows, "Clean", "value").verdict, "clean");
  assert.equal(rows.some(result => result.subject === "public.Nested.Hidden:instance" && result.verdict === "checker"), true);
});

test("every call and construct overload participates, including earlier signatures outside old windows", () => {
  const rows = audit(`
    export interface Calls {
      (type: Type): string;
      (one: 1): string; (two: 2): string; (three: 3): string; (four: 4): string; (five: 5): string;
    }
    export interface Constructors { new (type: Type): object; new (name: string): object }
  `);
  assert.equal(row(rows, "Calls").verdict, "checker");
  assert.equal(row(rows, "Constructors").verdict, "checker");
});

test("aliases, inherited members, containers, generic constraints and signature this/results retain checker reachability", () => {
  const rows = audit(`
    interface Parent { readonly cached: CheckedSourceProgram }
    export interface Inherited extends Parent { readonly name: string }
    export type Payload = ReadonlyMap<string, readonly Symbol[]>;
    export interface Generic<Value extends Type> { readonly value: Value }
    export function constrained<Value extends Signature>(): void;
    export function bound(this: { readonly cached: Type }): string;
    export type Conditional<Value> = Value extends string ? Type : number;
    interface ForeignContainer<Value> { readonly value: Value; readonly cached: Type }
    export type Container = ForeignContainer<string>;
  `);
  for (const name of ["Inherited", "Payload", "Generic", "Conditional", "Container"]) assert.equal(row(rows, name).verdict, "checker", name);
  for (const name of ["constrained", "bound"]) assert.equal(row(rows, name, "value").verdict, "checker", name);
});

test("exact sites terminate but extended site payloads do not inherit that exemption", () => {
  const rows = audit(`
    export interface Sites { readonly node: Node; readonly file: SourceFile }
    export interface Extended extends Node { readonly cached: Type }
    export type Intersection = Node & { readonly cached: Signature };
  `);
  assert.equal(row(rows, "Sites").verdict, "clean");
  assert.equal(row(rows, "Extended").verdict, "checker");
  assert.equal(row(rows, "Intersection").verdict, "checker");
});

test("ordinary recursive identities terminate and growing generics fail closed at the explicit budget", () => {
  const rows = audit(`
    export interface Tree { readonly children: readonly Tree[]; readonly parent?: Tree }
    interface Grow<Value> { readonly value: Value; readonly next: Grow<[Value]> }
    export type Growing = Grow<string>;
  `, { maximumDepth: 16, maximumTypes: 2000 });
  assert.equal(row(rows, "Tree").verdict, "clean");
  assert.equal(row(rows, "Growing").verdict, "unresolved");
  assert.match(row(rows, "Growing").detail, /budget exhausted/u);
});

test("missing declarations, unresolved imports and erased any are not a clean boundary", () => {
  assert.throws(() => audit("", { targets: [{ entry: "missing", exports: "all" }] }), /Missing checked declaration entry/u);
  assert.throws(() => audit("", { targets: [{ entry: "public", exports: ["Absent"] }] }), /Missing consumed public export/u);
  assert.throws(() => audit("export * from './absent.js';"), /Unresolved public declaration module/u);
  assert.throws(() => audit("export { Missing } from './absent.js';"), /Unresolved public declaration module/u);
  const rows = audit(`export interface Erased { readonly hidden: any }`);
  assert.equal(row(rows, "Erased").verdict, "unresolved");
  const missingPayload = audit(`import type { Missing } from './absent.js'; export interface Payload { readonly value: Missing }`);
  assert.equal(row(missingPayload, "Payload").verdict, "unresolved");
});

test("actual consumed aliases and namespace imports close fact payloads without a FactKey name heuristic", () => {
  const targets = collectConsumedPublicExports(new Map([["consumer.ts", `
    import { transport as original } from 'public';
    import type { Clean } from 'public';
    import { readFileSync } from 'node:fs';
    import { local } from './local.js';
  `]]));
  assert.deepEqual(targets, [{ entry: "public", exports: ["Clean", "transport"] }]);
  const rows = audit(`
    export const transport: ExtensionFactKey<{ readonly payload: Type }>;
    export interface Clean { readonly site: Node }
    export const hostOnly: ExtensionFactKey<Signature>;
  `, { targets });
  assert.equal(row(rows, "transport", "value").verdict, "checker");
  assert.equal(row(rows, "Clean").verdict, "clean");
  assert.equal(row(rows, "hostOnly", "value"), undefined);
  const namespace = collectConsumedPublicExports(new Map([["consumer.ts", `import * as metadata from 'public';`]]));
  assert.deepEqual(namespace, [{ entry: "public", exports: "all" }]);
  assert.equal(row(audit(`export const hidden: ExtensionFactKey<Signature>;`, { targets: namespace }), "hidden", "value").verdict, "checker");
});

test("a checker-free private Host builder is still forbidden in every public value and type surface", () => {
  const rows = audit(`
    import type { Builder as Original } from '/workspace/packages/host/dist/host-input/private.js';
    export interface Leaked { readonly builder: Original }
    export class StaticBuilder { static create(): Original }
  `);
  assert.equal(row(rows, "Leaked").verdict, "private-host");
  assert.equal(row(rows, "StaticBuilder", "value").verdict, "private-host");
});
