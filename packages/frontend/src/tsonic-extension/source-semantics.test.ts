import { describe, it } from "mocha";
import { expect } from "chai";
import {
  createExtensionHost,
  getTstsCallExpressionDetails,
  getTstsIdentifierText,
  getTstsNodeNameText,
  getTstsTypeReferenceDetails,
  isTstsCallExpression,
  isTstsClassDeclaration,
  isTstsInterfaceDeclaration,
  isTstsParameterDeclaration,
  isTstsPropertyDeclarationLike,
  parseTstsSourceFile,
  TstsSyntax,
  visitTstsSubtree,
} from "@tsonic/tsts";
import type { GoPtr, TstsNode } from "@tsonic/tsts";
import {
  fieldSemanticsFactKey,
  expressionSemanticsFactKey,
  extensionReceiverSemanticsFactKey,
  wellKnownComputedNameFactKey,
  heritageWrapperSemanticsFactKey,
  intrinsicSemanticsFactKey,
  markerApiSemanticsFactKey,
  parameterPassingFactKey,
  sourceAttributeApplicationsFactKey,
  sourceRuntimeOperationFactKey,
  sourceTypeSemanticsFactKey,
} from "../source-frontend/source-facts.js";
import { createTsonicSourceSemanticsExtension } from "./source-semantics.js";
import { createTstsTestProgramFromFiles } from "../testing/tsts-test-program.js";

const collectSemanticNodes = (sourceText: string) => {
  const sourceFile = parseTstsSourceFile(sourceText);
  const host = createExtensionHost([createTsonicSourceSemanticsExtension()]);
  const nodes: GoPtr<TstsNode>[] = [];

  host.afterParseSourceFile(sourceFile);
  visitTstsSubtree(sourceFile, (node) => {
    if (node) nodes.push(node);
  });

  return { host, nodes };
};

const collectDeclarationFactsByName = (sourceText: string) => {
  const fixture = collectSemanticNodes(sourceText);
  const facts = new Map<string, string>();

  for (const node of fixture.nodes) {
    if (!node) continue;
    if (!isTstsClassDeclaration(node) && !isTstsInterfaceDeclaration(node)) {
      continue;
    }
    const name = getTstsNodeNameText(node);
    const fact = fixture.host.facts.get(sourceTypeSemanticsFactKey, node);
    if (name && fact) facts.set(name, fact.kind);
  }

  return facts;
};

describe("Tsonic TSTS source semantics extension", () => {
  it("attaches source type semantics and resolves struct only through core imports", () => {
    const facts = collectDeclarationFactsByName(`
      import type { struct as valueType } from "@tsonic/core/types.js";

      export interface Point extends valueType {
        x: number;
      }

      export class ValueObject implements valueType {}
      export class User {}
      export interface Shape {}

      type struct = {};
      export interface FakeStruct extends struct {}
    `);

    expect(Object.fromEntries(facts)).to.deep.equal({
      Point: "struct",
      ValueObject: "struct",
      User: "class",
      Shape: "interface",
      FakeStruct: "interface",
    });
  });

  it("attaches field and declaration-site passing facts from imported wrappers", () => {
    const fixture = collectSemanticNodes(`
      import type { out, ref as mutable, inref } from "@tsonic/core/types.js";
      import type { field as storage } from "@tsonic/core/lang.js";

      export class User {
        email: storage<string> = "";
      }

      export function update(
        value: out<number>,
        other: mutable<string>,
        snapshot: inref<User>
      ): void {}
    `);

    const declarationFacts = new Map<string, string | undefined>();
    for (const node of fixture.nodes) {
      if (!node) continue;
      if (
        !isTstsParameterDeclaration(node) &&
        !isTstsPropertyDeclarationLike(node)
      ) {
        continue;
      }
      const name = getTstsNodeNameText(node);
      if (!name) continue;
      declarationFacts.set(
        name,
        fixture.host.facts.get(fieldSemanticsFactKey, node)?.storage ??
          fixture.host.facts.get(parameterPassingFactKey, node)?.mode
      );
    }

    const wrapperFacts = fixture.nodes
      .map((node) => {
        if (!node) return undefined;
        const typeReference = getTstsTypeReferenceDetails(node);
        if (!typeReference) return undefined;
        return {
          name: typeReference.name,
          field: fixture.host.facts.get(fieldSemanticsFactKey, node)?.storage,
          passing: fixture.host.facts.get(parameterPassingFactKey, node)?.mode,
        };
      })
      .filter(
        (entry): entry is NonNullable<typeof entry> => entry !== undefined
      );

    expect(Object.fromEntries(declarationFacts)).to.deep.equal({
      email: "field",
      value: "byref-writeonly-must-init",
      other: "byref-readwrite",
      snapshot: "byref-readonly",
    });
    expect(wrapperFacts).to.deep.include.members([
      { name: "storage", field: "field", passing: undefined },
      {
        name: "out",
        field: undefined,
        passing: "byref-writeonly-must-init",
      },
      { name: "mutable", field: undefined, passing: "byref-readwrite" },
      { name: "inref", field: undefined, passing: "byref-readonly" },
    ]);
  });

  it("attaches extension receiver and interface heritage wrapper facts from imported wrappers", () => {
    const fixture = collectSemanticNodes(`
      import type { Interface, thisarg as receiver } from "@tsonic/core/lang.js";

      export interface Contract {}
      export class Service implements Interface<Contract> {}
      export function attach(target: receiver<Service>): void {}
    `);

    const typeReferenceFacts = fixture.nodes
      .map((node) => {
        if (!node) return undefined;
        const typeReference = getTstsTypeReferenceDetails(node);
        if (!typeReference) return undefined;
        return {
          name: typeReference.name,
          receiver: fixture.host.facts.get(
            extensionReceiverSemanticsFactKey,
            node
          )?.kind,
        };
      })
      .filter(
        (entry): entry is NonNullable<typeof entry> => entry !== undefined
      );

    const heritageFacts = fixture.nodes
      .map((node) => {
        if (!node) return undefined;
        return {
          name: getTstsNodeNameText(node),
          heritage: fixture.host.facts.get(
            heritageWrapperSemanticsFactKey,
            node
          )?.kind,
        };
      })
      .filter(
        (
          entry
        ): entry is {
          readonly name: string | undefined;
          readonly heritage: "interface-erasure";
        } =>
          entry !== undefined && entry.heritage !== undefined
      );

    expect(typeReferenceFacts).to.deep.include({
      name: "receiver",
      receiver: "extension-receiver",
    });
    expect(heritageFacts).to.deep.equal([
      { name: undefined, heritage: "interface-erasure" },
    ]);
  });

  it("attaches call-site passing and intrinsic facts from imported core values", () => {
    const fixture = collectSemanticNodes(`
      import {
        asinterface,
        defaultof,
        inref,
        istype as isT,
        nameof,
        out as outArg,
        ref,
        sizeof,
        stackalloc,
        trycast,
      } from "@tsonic/core/lang.js";

      class User {}
      declare const value: unknown;
      let target = 0;

      defaultof<number>();
      isT<number>(value);
      trycast<User>(value);
      nameof(value);
      sizeof<number>();
      stackalloc<number>(4);
      asinterface<User>(value);
      outArg(target);
      ref(target);
      inref(target);
    `);

    const callFacts = fixture.nodes
      .filter(
        (node): node is TstsNode => Boolean(node) && isTstsCallExpression(node)
      )
      .map((node) => {
        const call = getTstsCallExpressionDetails(node);
        return {
          callee: call?.calleeName,
          intrinsic: fixture.host.facts.get(intrinsicSemanticsFactKey, node)
            ?.kind,
          passing: fixture.host.facts.get(parameterPassingFactKey, node)?.mode,
        };
      });

    expect(callFacts).to.deep.equal([
      { callee: "defaultof", intrinsic: "defaultof", passing: undefined },
      { callee: "isT", intrinsic: "istype", passing: undefined },
      { callee: "trycast", intrinsic: "trycast", passing: undefined },
      { callee: "nameof", intrinsic: "nameof", passing: undefined },
      { callee: "sizeof", intrinsic: "sizeof", passing: undefined },
      { callee: "stackalloc", intrinsic: "stackalloc", passing: undefined },
      { callee: "asinterface", intrinsic: "asinterface", passing: undefined },
      {
        callee: "outArg",
        intrinsic: undefined,
        passing: "byref-writeonly-must-init",
      },
      { callee: "ref", intrinsic: undefined, passing: "byref-readwrite" },
      { callee: "inref", intrinsic: undefined, passing: "byref-readonly" },
    ]);
  });

  it("attaches marker API facts from imported core values", () => {
    const fixture = collectSemanticNodes(`
      import {
        AttributeTargets,
        attributes as A,
        overloads as O,
      } from "@tsonic/core/lang.js";

      class User {}
      declare function f(): void;

      const descriptor = A.attr(User, { Name: "demo" });
      A<User>().target(AttributeTargets.method).add(descriptor);
      O(f).family(f);
    `);

    const markerFacts = fixture.nodes
      .map((node) => {
        if (!node) return undefined;
        const name = getTstsIdentifierText(node);
        const marker = fixture.host.facts.get(markerApiSemanticsFactKey, node)
          ?.kind;
        return name && marker ? { name, marker } : undefined;
      })
      .filter(
        (
          entry
        ): entry is {
          readonly name: string;
          readonly marker: "attributes" | "attribute-targets" | "overloads";
        } =>
          entry !== undefined
      );

    expect(markerFacts).to.deep.include.members([
      { name: "A", marker: "attributes" },
      { name: "AttributeTargets", marker: "attribute-targets" },
      { name: "O", marker: "overloads" },
    ]);
  });

  it("attaches checked attribute facts to declaration targets", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "node_modules/@tsonic/core/lang.js": [
          "export const attributes = undefined;",
          "export const AttributeTargets = undefined;",
          "",
        ].join("\n"),
        "node_modules/@tsonic/core/lang.d.ts": [
          "export type AttributeTarget = 'assembly' | 'module' | 'type' | 'method' | 'property' | 'field' | 'event' | 'param' | 'return';",
          "export interface AttributeTargets { readonly method: 'method'; readonly return: 'return'; }",
          "export declare const AttributeTargets: AttributeTargets;",
          "export interface AttributeTargetBuilder {",
          "  target(target: AttributeTarget): AttributeTargetBuilder;",
          "  add(attributeType: unknown, ...args: readonly unknown[]): void;",
          "}",
          "export interface TypeAttributeBuilder<T> extends AttributeTargetBuilder {",
          "  readonly ctor: AttributeTargetBuilder;",
          "  method<TMember>(selector: (value: T) => TMember): AttributeTargetBuilder;",
          "  prop<TMember>(selector: (value: T) => TMember): AttributeTargetBuilder;",
          "}",
          "export interface AttributesApi {",
          "  <T>(): TypeAttributeBuilder<T>; ",
          "  attr(attributeType: unknown, ...args: readonly unknown[]): unknown;",
          "}",
          "export declare const attributes: AttributesApi;",
          "",
        ].join("\n"),
        "src/test.ts": [
          "import { attributes as A, AttributeTargets } from '@tsonic/core/lang.js';",
          "class ObsoleteAttribute { constructor(message?: string) { void message; } }",
          "class SerializableAttribute {}",
          "export class User {",
          "  name: string = '';",
          "  constructor() {}",
          "  save(): string { return this.name; }",
          "}",
          "export class NoCtor {}",
          "const descriptor = A.attr(ObsoleteAttribute, 'type');",
          "A<User>().add(descriptor);",
          "A<User>().ctor.add(ObsoleteAttribute, 'ctor');",
          "A<User>().method((u) => u.save).target(AttributeTargets.return).add(ObsoleteAttribute, 'method');",
          "A<User>().prop((u) => u.name).target('field').add(SerializableAttribute);",
          "A<NoCtor>().ctor.add(ObsoleteAttribute, 'implicit');",
          "",
        ].join("\n"),
      },
      "src/test.ts"
    );
    try {
      const declarations = new Map<string, TstsNode>();
      const userMembers = new Map<string, TstsNode>();
      visitTstsSubtree(program.sourceFile, (node) => {
        if (!node) return;
        const name = getTstsNodeNameText(node);
        if (name === "User" || name === "NoCtor") {
          declarations.set(name, node);
        }
        if (node.Parent === declarations.get("User") && name) {
          userMembers.set(name, node);
        }
        if (
          node.Parent === declarations.get("User") &&
          node.Kind === TstsSyntax.KindConstructor
        ) {
          userMembers.set("constructor", node);
        }
      });

      const facts = program.sourceProgram.extensionHost.facts;
      const userAttributes = facts.get(
        sourceAttributeApplicationsFactKey,
        declarations.get("User") as TstsNode
      )?.applications;
      const constructorAttributes = facts.get(
        sourceAttributeApplicationsFactKey,
        userMembers.get("constructor") as TstsNode
      )?.applications;
      const methodAttributes = facts.get(
        sourceAttributeApplicationsFactKey,
        userMembers.get("save") as TstsNode
      )?.applications;
      const propertyAttributes = facts.get(
        sourceAttributeApplicationsFactKey,
        userMembers.get("name") as TstsNode
      )?.applications;
      const syntheticConstructorAttributes = facts.get(
        sourceAttributeApplicationsFactKey,
        declarations.get("NoCtor") as TstsNode
      )?.applications;

      expect(userAttributes?.map((fact) => fact.targetKind)).to.deep.equal([
        "type",
      ]);
      expect(constructorAttributes?.map((fact) => fact.targetKind)).to.deep.equal([
        "constructor",
      ]);
      expect(methodAttributes?.map((fact) => fact.targetSpecifier)).to.deep.equal([
        "return",
      ]);
      expect(propertyAttributes?.map((fact) => fact.targetSpecifier)).to.deep.equal([
        "field",
      ]);
      expect(
        syntheticConstructorAttributes?.map((fact) => fact.targetKind)
      ).to.deep.equal(["constructor"]);
      expect(
        getTstsIdentifierText(userAttributes?.[0]?.attributeType)
      ).to.equal("ObsoleteAttribute");
    } finally {
      program.cleanup();
    }
  });

  it("does not attach source marker facts to same-name local declarations", () => {
    const fixture = collectSemanticNodes(`
      type field<T> = T;
      type out<T> = T;
      type thisarg<T> = T;
      type Interface<T> = T;
      interface struct {}
      function defaultof<T>(): T {
        throw new Error("not core");
      }
      function istype<T>(_value: unknown): boolean {
        return false;
      }
      function attributes<T>(): { add(): void } {
        return { add() {} };
      }
      function overloads<T>(_value: T): { family(_target: T): void } {
        return { family() {} };
      }

      export interface FakeStruct extends struct {}
      export interface Contract {}
      export class FakeService implements Interface<Contract> {}
      export class User {
        email: field<string> = "";
      }
      export function update(target: thisarg<User>, value: out<number>): void {
        defaultof<number>();
        istype<number>(value);
        attributes<User>().add();
        overloads(update).family(update);
      }
    `);

    const fieldFacts = fixture.nodes.filter(
      (node) =>
        node !== undefined &&
        fixture.host.facts.has(fieldSemanticsFactKey, node)
    );
    const passingFacts = fixture.nodes.filter(
      (node) =>
        node !== undefined &&
        fixture.host.facts.has(parameterPassingFactKey, node)
    );
    const intrinsicFacts = fixture.nodes.filter(
      (node) =>
        node !== undefined &&
        fixture.host.facts.has(intrinsicSemanticsFactKey, node)
    );
    const receiverFacts = fixture.nodes.filter(
      (node) =>
        node !== undefined &&
        fixture.host.facts.has(extensionReceiverSemanticsFactKey, node)
    );
    const heritageFacts = fixture.nodes.filter(
      (node) =>
        node !== undefined &&
        fixture.host.facts.has(heritageWrapperSemanticsFactKey, node)
    );
    const markerApiFacts = fixture.nodes.filter(
      (node) =>
        node !== undefined &&
        fixture.host.facts.has(markerApiSemanticsFactKey, node)
    );

    expect(fieldFacts).to.deep.equal([]);
    expect(passingFacts).to.deep.equal([]);
    expect(intrinsicFacts).to.deep.equal([]);
    expect(receiverFacts).to.deep.equal([]);
    expect(heritageFacts).to.deep.equal([]);
    expect(markerApiFacts).to.deep.equal([]);
    expect(
      collectDeclarationFactsByName(`
      interface struct {}
      export interface FakeStruct extends struct {}
    `).get("FakeStruct")
    ).to.equal("interface");
  });

  it("attaches checked expression facts only to proven ambient/global source semantics", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "node_modules/@fixture/globals/index.d.ts": [
          "declare global {",
          "  const console: { log(message: string): void; error(message: string): void };",
          "  const Array: { isArray(value: unknown): value is unknown[] };",
          "  class Error { constructor(message: string); }",
          "  interface String { trim(): string; toLowerCase(): string; }",
          "  const Symbol: { readonly iterator: symbol; readonly asyncIterator: symbol };",
          "}",
          "export {};",
          "",
        ].join("\n"),
        "src/test.ts": [
          "export class IteratorSource {",
          "  [Symbol.iterator](): void {}",
          "  [Symbol.asyncIterator](): void {}",
          "}",
          "export function run(value: string, items: number[]): void {",
          "  const missing = undefined;",
          "  console.log(value);",
          "  console.error(items.length.toString());",
          "  const lower = value.trim().toLowerCase();",
          "  const first = value[0];",
          "  const mapped = items.map((item: number): number => item + 1);",
          "  const arrayCheck = Array.isArray(mapped);",
          "  throw new Error(value.length.toString());",
          "  void lower;",
          "  void first;",
          "  void arrayCheck;",
          "}",
          "",
        ].join("\n"),
      },
      "src/test.ts"
    );
    try {
      const expressionKinds: string[] = [];
      const runtimeOperations: string[] = [];
      const computedKinds: string[] = [];

      visitTstsSubtree(program.sourceFile, (node) => {
        if (!node) return;
        const expressionFact = program.sourceProgram.extensionHost.facts.get(
          expressionSemanticsFactKey,
          node
        );
        if (expressionFact) expressionKinds.push(expressionFact.kind);
        const runtimeOperation = program.sourceProgram.extensionHost.facts.get(
          sourceRuntimeOperationFactKey,
          node
        );
        if (runtimeOperation) {
          runtimeOperations.push(
            `${runtimeOperation.owner}.${runtimeOperation.member}:${runtimeOperation.dispatch}`
          );
        }
        const computedFact = program.sourceProgram.extensionHost.facts.get(
          wellKnownComputedNameFactKey,
          node
        );
        if (computedFact) computedKinds.push(computedFact.kind);
      });

      expect(expressionKinds).to.deep.equal(["undefined-value"]);
      expect(runtimeOperations).to.deep.equal([
        "Console.log:static-call",
        "Console.error:static-call",
        "Object.toString:receiver-call",
        "Array.length:property",
        "String.toLowerCase:receiver-call",
        "String.trim:receiver-call",
        "String.charAt:index",
        "Array.map:receiver-call",
        "Array.isArray:static-call",
        "Error.constructor:constructor",
        "Object.toString:receiver-call",
        "String.length:property",
      ]);
      expect(computedKinds).to.deep.equal([
        "symbol-iterator",
        "symbol-async-iterator",
      ]);
    } finally {
      program.cleanup();
    }
  });

  it("does not attach ambient expression facts to local shadowed names", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "src/test.ts": [
          "const console = { log(_message: string): void {} };",
          "const Symbol = { iterator: 'local' };",
          "class Error {",
          "  message: string;",
          "  constructor(message: string) { this.message = message; }",
          "}",
          "export class LocalIterator {",
          "  [Symbol.iterator](): void {}",
          "}",
          "export function run(value: string): void {",
          "  console.log(value);",
          "  const err = new Error(value);",
          "  const size = value.length;",
          "  void err;",
          "  void size;",
          "}",
          "",
        ].join("\n"),
      },
      "src/test.ts"
    );
    try {
      const expressionKinds: string[] = [];
      const computedKinds: string[] = [];

      visitTstsSubtree(program.sourceFile, (node) => {
        if (!node) return;
        const expressionFact = program.sourceProgram.extensionHost.facts.get(
          expressionSemanticsFactKey,
          node
        );
        if (expressionFact) expressionKinds.push(expressionFact.kind);
        const computedFact = program.sourceProgram.extensionHost.facts.get(
          wellKnownComputedNameFactKey,
          node
        );
        if (computedFact) computedKinds.push(computedFact.kind);
      });

      expect(expressionKinds).to.deep.equal([]);
      expect(computedKinds).to.deep.equal([]);
    } finally {
      program.cleanup();
    }
  });
});
