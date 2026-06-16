import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import {
  createExtensionHost,
  getTstsCallExpressionDetails,
  getTstsIdentifierText,
  getTstsNodeNameText,
  getTstsNodeText,
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
  sourceBindingTypeProjectionFactKey,
  sourceCallArgumentTypesFactKey,
  sourceDictionaryTypeFactKey,
  sourceAttributeApplicationsFactKey,
  sourceExpressionTypeProjectionFactKey,
  sourceRuntimeVisibilityFactKey,
  sourceRuntimeOperationFactKey,
  sourceOverloadCallImplementationFactKey,
  sourceTypeSemanticsFactKey,
} from "../source-frontend/source-facts.js";
import type { SourceBindingProjectedType } from "../source-frontend/source-facts.js";
import { createTsonicSourceSemanticsExtension } from "./source-semantics.js";
import { createTstsTestProgramFromFiles } from "../testing/tsts-test-program.js";
import { getProgramRuntimeSourceFiles } from "../program/queries.js";

const collectSemanticNodes = (sourceText: string) => {
  const sourceFile = parseTstsSourceFile(sourceText);
  if (!sourceFile) {
    throw new Error("Failed to parse TSTS source text.");
  }
  const host = createExtensionHost([
    createTsonicSourceSemanticsExtension({
      sourceDiagnosticRoots: [path.dirname(sourceFile.FileName())],
    }),
  ]);
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

const projectionSummary = (type: SourceBindingProjectedType): string => {
  switch (type.kind) {
    case "type-node":
      return getTstsNodeText(type.node)?.replace(/\s+/g, " ").trim() ?? "";
    case "intrinsic":
      return type.name;
    case "source-primitive":
      return type.fact.sourceName;
    case "named":
      return `${type.name}${type.typeArguments.length > 0 ? `<${type.typeArguments.map(projectionSummary).join(", ")}>` : ""}`;
    case "record":
      return `Record<${projectionSummary(type.keyType)}, ${projectionSummary(type.valueType)}>`;
    case "function":
      return `(${type.parameters.map((parameter) => `${parameter.name}: ${parameter.type ? projectionSummary(parameter.type) : "unknown"}`).join(", ")}) => ${type.returnType ? projectionSummary(type.returnType) : "void"}`;
    case "array":
      return `${type.readonly ? "readonly " : ""}${projectionSummary(type.elementType)}[]`;
    case "tuple":
      return `[${type.elements.map(projectionSummary).join(", ")}]`;
    case "object":
      return `{ ${type.members.map((member) => `${member.name}: ${member.type ? projectionSummary(member.type) : "unknown"}`).join("; ")} }`;
    case "union":
      return type.types.map(projectionSummary).join(" | ");
    case "intersection":
      return type.types.map(projectionSummary).join(" & ");
  }
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
      import type { field as fieldMarker } from "@tsonic/core/lang.js";

      export class User {
        email: fieldMarker<string> = "";
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
        fixture.host.facts.get(fieldSemanticsFactKey, node)?.kind ??
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
          field: fixture.host.facts.get(fieldSemanticsFactKey, node)?.kind,
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
      { name: "fieldMarker", field: "field", passing: undefined },
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
        } => entry !== undefined && entry.heritage !== undefined
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
        const marker = fixture.host.facts.get(
          markerApiSemanticsFactKey,
          node
        )?.kind;
        return name && marker ? { name, marker } : undefined;
      })
      .filter(
        (
          entry
        ): entry is {
          readonly name: string;
          readonly marker: "attributes" | "attribute-targets" | "overloads";
        } => entry !== undefined
      );

    expect(markerFacts).to.deep.include.members([
      { name: "A", marker: "attributes" },
      { name: "AttributeTargets", marker: "attribute-targets" },
      { name: "O", marker: "overloads" },
    ]);
  });

  it("attaches TSTS-selected overload implementation facts to call sites", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "node_modules/@tsonic/core/lang.js": [
          "export const overloads = undefined;",
          "",
        ].join("\n"),
        "node_modules/@tsonic/core/lang.d.ts": [
          "export interface OverloadMethodBuilder<T> {",
          "  family<TMember>(selector: (value: T) => TMember): void;",
          "}",
          "export interface OverloadTypeBuilder<T> {",
          "  method<TMember>(selector: (value: T) => TMember): OverloadMethodBuilder<T>;",
          "}",
          "export declare function overloads<T>(): OverloadTypeBuilder<T>;",
          "",
        ].join("\n"),
        "src/test.ts": [
          "import { overloads as O } from '@tsonic/core/lang.js';",
          "export class Writer {",
          "  append(value: string): string;",
          "  append(value: readonly string[]): string;",
          "  append(_value: unknown): string { return ''; }",
          "  appendOne(value: string): string { return value; }",
          "  appendMany(value: readonly string[]): string { return value.join('|'); }",
          "}",
          "O<Writer>().method((writer) => writer.appendOne).family((writer) => writer.append);",
          "O<Writer>().method((writer) => writer.appendMany).family((writer) => writer.append);",
          "const writer = new Writer();",
          "export const single = writer.append('x');",
          "export const many = writer.append(['x', 'y']);",
          "",
        ].join("\n"),
      },
      "src/test.ts"
    );
    try {
      const selectedImplementations: string[] = [];
      visitTstsSubtree(program.sourceFile, (node) => {
        if (!node || node.Kind !== TstsSyntax.KindCallExpression) return;
        const callee = TstsSyntax.Node_Expression(node);
        if (
          callee?.Kind !== TstsSyntax.KindPropertyAccessExpression ||
          getTstsIdentifierText(TstsSyntax.Node_Name(callee)) !== "append"
        ) {
          return;
        }
        const implementation = program.sourceProgram.facts.get(
          sourceOverloadCallImplementationFactKey,
          node
        )?.implementation;
        selectedImplementations.push(
          getTstsNodeNameText(implementation) ?? "missing"
        );
      });

      expect(selectedImplementations).to.deep.equal([
        "appendOne",
        "appendMany",
      ]);
    } finally {
      program.cleanup();
    }
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

      const facts = program.sourceProgram.facts;
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
      expect(
        constructorAttributes?.map((fact) => fact.targetKind)
      ).to.deep.equal(["constructor"]);
      expect(
        methodAttributes?.map((fact) => fact.targetSpecifier)
      ).to.deep.equal(["return"]);
      expect(
        propertyAttributes?.map((fact) => fact.targetSpecifier)
      ).to.deep.equal(["field"]);
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

  it("does not attach opaque runtime visibility from source names", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "_internal.ts": [
          "export interface _ {",
          "  readonly value: number;",
          "}",
          "",
        ].join("\n"),
        "index.ts": [
          "import type { _ as Internal } from './_internal.js';",
          "export function use(value: Internal): void {",
          "  void value;",
          "}",
          "",
        ].join("\n"),
      },
      "index.ts"
    );
    try {
      const visibilityFacts: string[] = [];
      visitTstsSubtree(program.sourceFile, (node) => {
        if (!node) return;
        const fact = program.sourceProgram.facts.get(
          sourceRuntimeVisibilityFactKey,
          node
        );
        if (fact) {
          visibilityFacts.push(
            `${TstsSyntax.Node_KindString(node)}:${fact.visibility}`
          );
        }
      });

      expect(visibilityFacts).to.not.include("KindIdentifier:opaque");
    } finally {
      program.cleanup();
    }
  });

  it("attaches opaque runtime visibility to core JsValue from source facts", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "index.ts": [
          "import type { JsValue } from '@tsonic/core/types.js';",
          "export function use(value: JsValue): void {",
          "  void value;",
          "}",
          "",
        ].join("\n"),
      },
      "index.ts"
    );
    try {
      const visibilityFacts: string[] = [];
      for (const sourceFile of program.sourceProgram.sourceFiles) {
        visitTstsSubtree(sourceFile, (node) => {
          if (!node) return;
          const fact = program.sourceProgram.facts.get(
            sourceRuntimeVisibilityFactKey,
            node
          );
          if (fact) {
            visibilityFacts.push(
              `${sourceFile.FileName()}:${TstsSyntax.Node_KindString(node)}:${fact.visibility}`
            );
          }
        });
      }

      expect(
        visibilityFacts.some(
          (entry) =>
            entry.includes("/node_modules/@tsonic/core/types.d.ts:") &&
            entry.endsWith(":opaque")
        )
      ).to.equal(true);
    } finally {
      program.cleanup();
    }
  });

  it("attaches destructured binding type projections as source facts", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "index.ts": [
          "import type { int } from '@tsonic/core/types.js';",
          "type Same = { value: int } | { value: int };",
          "type Different = { value: int } | { value: string };",
          "type LiteralKeys = { value: int; 0: string };",
          "export function readSame(input: Same): int {",
          "  const { value } = input;",
          "  return value;",
          "}",
          "export function readDifferent(input: Different): void {",
          "  const { value } = input;",
          "  void value;",
          "}",
          "export function readLiteral(input: LiteralKeys): void {",
          "  const { 'value': literal, 0: zero, ['value']: computed } = input;",
          "  void literal;",
          "  void zero;",
          "  void computed;",
          "}",
          "",
        ].join("\n"),
      },
      "index.ts"
    );
    try {
      const summaries: string[] = [];
      const trackedNames = new Set([
        "value",
        "literal",
        "zero",
        "computed",
      ]);
      visitTstsSubtree(program.sourceFile, (node) => {
        const name = node ? getTstsIdentifierText(node) : undefined;
        if (
          !node ||
          node.Kind !== TstsSyntax.KindIdentifier ||
          !name ||
          !trackedNames.has(name) ||
          node.Parent?.Kind !== TstsSyntax.KindBindingElement
        ) {
          return;
        }
        const fact = program.sourceProgram.facts.get(
          sourceBindingTypeProjectionFactKey,
          node
        );
        if (fact) summaries.push(`${name}: ${projectionSummary(fact.type)}`);
      });

      expect(summaries).to.deep.equal([
        "value: int",
        "value: int | string",
        "literal: int",
        "zero: string",
        "computed: int",
      ]);
    } finally {
      program.cleanup();
    }
  });

  it("attaches expression type projections from TSTS checker facts", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "index.ts": [
          "import type { int } from '@tsonic/core/types.js';",
          "type Box<T> = { value: T };",
          "export function read(pair: [int, string], box: Box<int>, items: int[]): void {",
          "  const first = pair[0];",
          "  const value = box.value;",
          "  const mapped = items.map((item: int): int => item);",
          "  const object = { first, value };",
          "  void mapped;",
          "  void object;",
          "}",
          "",
        ].join("\n"),
      },
      "index.ts"
    );
    try {
      const summaries: string[] = [];
      visitTstsSubtree(program.sourceFile, (node) => {
        if (!node) return;
        const text = getTstsNodeText(node)?.replace(/\s+/g, " ").trim();
        if (
          text !== "pair[0]" &&
          text !== "box.value" &&
          text !== "items.map((item: int): int => item)" &&
          text !== "{ first, value }"
        ) {
          return;
        }
        const fact = program.sourceProgram.facts.get(
          sourceExpressionTypeProjectionFactKey,
          node
        );
        if (fact) summaries.push(`${text}: ${projectionSummary(fact.type)}`);
      });

      expect(summaries).to.deep.equal([
        "pair[0]: int",
        "box.value: int",
        "items.map((item: int): int => item): int[]",
        "{ first, value }: { first: int; value: int }",
      ]);
    } finally {
      program.cleanup();
    }
  });

  it("uses TSTS flow narrowing while preserving source primitive projections", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "index.ts": [
          "import type { int } from '@tsonic/core/types.js';",
          "export function read(value: int | string): void {",
          "  const before = value;",
          "  if (typeof value === 'string') {",
          "    const text = value;",
          "    void text;",
          "  } else {",
          "    const number = value;",
          "    void number;",
          "  }",
          "  void before;",
          "}",
          "",
        ].join("\n"),
      },
      "index.ts"
    );
    try {
      const summaries: string[] = [];
      visitTstsSubtree(program.sourceFile, (node) => {
        if (!node || node.Kind !== TstsSyntax.KindVariableDeclaration) return;
        const name = getTstsIdentifierText(TstsSyntax.Node_Name(node));
        if (name !== "before" && name !== "text" && name !== "number") {
          return;
        }
        const initializer = TstsSyntax.Node_Initializer(node);
        const fact = initializer
          ? program.sourceProgram.facts.get(
              sourceExpressionTypeProjectionFactKey,
              initializer
            )
          : undefined;
        if (fact) summaries.push(`${name}: ${projectionSummary(fact.type)}`);
      });

      expect(summaries).to.deep.equal([
        "before: int | string",
        "text: string",
        "number: int",
      ]);
    } finally {
      program.cleanup();
    }
  });

  it("attaches source contextual projections before plan builders consume expressions", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "index.ts": [
          "import type { char } from '@tsonic/core/types.js';",
          "type Box = { letter: char };",
          "type NumericBox = { 0: char; named: char };",
          "declare function write(value: char): void;",
          "declare function write(value: string | null): void;",
          "export function read(letter: char): char[] {",
          "  const same = letter === \"A\";",
          "  const boxed: Box = { letter: \"B\" };",
          "  const keyed: NumericBox = { 0: \"D\", [\"named\"]: \"E\" };",
          "  write(\"WRITE\");",
          "  write(\"C\");",
          "  return [\"x\", letter];",
          "}",
          "",
        ].join("\n"),
      },
      "index.ts"
    );
    try {
      const contextualSummaries: string[] = [];
      visitTstsSubtree(program.sourceFile, (node) => {
        if (!node) return;
        if (node.Kind !== TstsSyntax.KindStringLiteral) return;
        const text = TstsSyntax.AsStringLiteral(node)?.Text;
        if (
          text !== "A" &&
          text !== "B" &&
          text !== "D" &&
          text !== "E" &&
          text !== "WRITE" &&
          text !== "C" &&
          text !== "x"
        ) {
          return;
        }
        const fact = program.sourceProgram.facts.get(
          sourceExpressionTypeProjectionFactKey,
          node
        );
        contextualSummaries.push(
          `"${text}": ${
            fact?.contextualType
              ? projectionSummary(fact.contextualType)
              : "none"
          }`
        );
      });

      expect(contextualSummaries).to.deep.equal([
        '"A": char',
        '"B": char',
        '"D": char',
        '"E": char',
        '"WRITE": none',
        '"C": char',
        '"x": char',
      ]);
    } finally {
      program.cleanup();
    }
  });

  it("uses TSTS-instantiated generic call facts instead of source-local substitution", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "index.ts": [
          "class Item {",
          "  value: string;",
          "  constructor(value: string) { this.value = value; }",
          "}",
          "type Box<T> = { value: T };",
          "declare function unwrap<T>(box: Box<T>): T;",
          "export function read(box: Box<Item>): void {",
          "  const value = unwrap(box);",
          "  const text = value.value;",
          "  void text;",
          "}",
          "",
        ].join("\n"),
      },
      "index.ts"
    );
    try {
      const summaries = new Map<string, string>();
      visitTstsSubtree(program.sourceFile, (node) => {
        if (!node) return;
        const text = getTstsNodeText(node)?.replace(/\s+/g, " ").trim();
        if (
          text !== "unwrap(box)" &&
          text !== "value.value" &&
          text !== "box"
        ) {
          return;
        }
        const expressionFact = program.sourceProgram.facts.get(
          sourceExpressionTypeProjectionFactKey,
          node
        );
        if (expressionFact && !summaries.has(text)) {
          summaries.set(
            text,
            `${text}: ${projectionSummary(expressionFact.type)}`
          );
        }
        const callFact = program.sourceProgram.facts.get(
          sourceCallArgumentTypesFactKey,
          node
        );
        if (callFact) {
          summaries.set(
            `${text} arg0`,
            `${text} arg0: ${callFact.argumentTypes[0] ? projectionSummary(callFact.argumentTypes[0]) : "unknown"}`
          );
        }
      });

      expect([...summaries.values()]).to.deep.equal([
        "unwrap(box): Item",
        "unwrap(box) arg0: Box<Item>",
        "box: Box<Item>",
        "value.value: string",
      ]);
    } finally {
      program.cleanup();
    }
  });

  it("attaches dictionary facts only to the ambient Record utility type", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "src/local.ts": [
          "type Record<K, T> = { readonly local: T };",
          "export type LocalTable = Record<string, number>;",
          "",
        ].join("\n"),
        "src/index.ts": [
          "import type { LocalTable } from './local.js';",
          "export type GlobalTable = Record<string, number>;",
          "export type ImportedLocalTable = LocalTable;",
          "",
        ].join("\n"),
      },
      "src/index.ts"
    );
    try {
      const recordReferences = getProgramRuntimeSourceFiles(program).flatMap(
        (sourceFile) => {
          const references: {
            readonly fileName: string;
            readonly hasFact: boolean;
          }[] = [];
          visitTstsSubtree(sourceFile, (node) => {
            if (!node) return;
            const typeReference = getTstsTypeReferenceDetails(node);
            if (typeReference?.name !== "Record") return;
            const fileNameParts = sourceFile.FileName().split("/");
            references.push({
              fileName: fileNameParts[fileNameParts.length - 1] ?? "",
              hasFact: program.sourceProgram.facts.has(
                sourceDictionaryTypeFactKey,
                node
              ),
            });
          });
          return references;
        }
      );

      expect(recordReferences).to.deep.include.members([
        { fileName: "index.ts", hasFact: true },
        { fileName: "local.ts", hasFact: false },
      ]);
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
        const expressionFact = program.sourceProgram.facts.get(
          expressionSemanticsFactKey,
          node
        );
        if (expressionFact) expressionKinds.push(expressionFact.kind);
        const runtimeOperation = program.sourceProgram.facts.get(
          sourceRuntimeOperationFactKey,
          node
        );
        if (runtimeOperation) {
          runtimeOperations.push(
            `${runtimeOperation.owner}.${runtimeOperation.member}:${runtimeOperation.dispatch}`
          );
        }
        const computedFact = program.sourceProgram.facts.get(
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

  it("uses TSTS-resolved member owners for narrowed receiver operations", () => {
    const program = createTstsTestProgramFromFiles(
      {
        "node_modules/@tsonic/js/package.json": JSON.stringify({
          name: "@tsonic/js",
          version: "0.0.0-test",
          type: "module",
        }),
        "node_modules/@tsonic/js/index.d.ts": [
          "declare global {",
          "  interface ReadonlyArray<T> { join(separator?: string): string; }",
          "  const Array: { isArray(value: unknown): value is readonly unknown[] };",
          "}",
          "export {};",
          "",
        ].join("\n"),
        "src/test.ts": [
          "export class SegmentList {",
          "  value: readonly string[] | string;",
          "  constructor(value: readonly string[] | string) { this.value = value; }",
          "  render(): string {",
          "    if (Array.isArray(this.value)) {",
          "      return this.value.join('|');",
          "    }",
          "    return String(this.value);",
          "  }",
          "}",
          "",
        ].join("\n"),
      },
      "src/test.ts"
    );
    try {
      const runtimeOperations: string[] = [];

      visitTstsSubtree(program.sourceFile, (node) => {
        if (!node) return;
        const runtimeOperation = program.sourceProgram.facts.get(
          sourceRuntimeOperationFactKey,
          node
        );
        if (runtimeOperation) {
          runtimeOperations.push(
            `${runtimeOperation.owner}.${runtimeOperation.member}:${runtimeOperation.dispatch}`
          );
        }
      });

      expect(runtimeOperations).to.include("Array.join:receiver-call");
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
        const expressionFact = program.sourceProgram.facts.get(
          expressionSemanticsFactKey,
          node
        );
        if (expressionFact) expressionKinds.push(expressionFact.kind);
        const computedFact = program.sourceProgram.facts.get(
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
