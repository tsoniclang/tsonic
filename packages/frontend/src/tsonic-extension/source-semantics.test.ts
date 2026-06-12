import { describe, it } from "mocha";
import { expect } from "chai";
import {
  createExtensionHost,
  getTstsCallExpressionDetails,
  getTstsNodeNameText,
  getTstsTypeReferenceDetails,
  isTstsCallExpression,
  isTstsClassDeclaration,
  isTstsInterfaceDeclaration,
  isTstsParameterDeclaration,
  isTstsPropertyDeclarationLike,
  parseTstsSourceFile,
  visitTstsSubtree,
} from "@tsonic/tsts";
import type { GoPtr, TstsNode } from "@tsonic/tsts";
import {
  fieldSemanticsFactKey,
  extensionReceiverSemanticsFactKey,
  heritageWrapperSemanticsFactKey,
  intrinsicSemanticsFactKey,
  parameterPassingFactKey,
  sourceTypeSemanticsFactKey,
} from "../source-frontend/source-facts.js";
import { createTsonicSourceSemanticsExtension } from "./source-semantics.js";

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

      export interface FakeStruct extends struct {}
      export interface Contract {}
      export class FakeService implements Interface<Contract> {}
      export class User {
        email: field<string> = "";
      }
      export function update(target: thisarg<User>, value: out<number>): void {
        defaultof<number>();
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

    expect(fieldFacts).to.deep.equal([]);
    expect(passingFacts).to.deep.equal([]);
    expect(intrinsicFacts).to.deep.equal([]);
    expect(receiverFacts).to.deep.equal([]);
    expect(heritageFacts).to.deep.equal([]);
    expect(
      collectDeclarationFactsByName(`
      interface struct {}
      export interface FakeStruct extends struct {}
    `).get("FakeStruct")
    ).to.equal("interface");
  });
});
