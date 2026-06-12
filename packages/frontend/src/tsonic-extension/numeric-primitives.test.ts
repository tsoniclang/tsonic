import { describe, it } from "mocha";
import { expect } from "chai";
import {
  createExtensionHost,
  getTstsTypeReferenceName,
  parseTstsSourceFile,
  visitTstsSubtree,
} from "@tsonic/tsts";
import { createTsonicNumericPrimitiveExtension } from "./numeric-primitives.js";
import { tsonicNumericPrimitiveFactKey } from "./fact-keys.js";

const collectTypeReferenceNodes = (sourceText: string) => {
  const sourceFile = parseTstsSourceFile(sourceText);
  const nodes: NonNullable<Parameters<typeof getTstsTypeReferenceName>[0]>[] = [];
  visitTstsSubtree(sourceFile, (node) => {
    if (!node) return;
    if (getTstsTypeReferenceName(node) !== undefined) {
      nodes.push(node);
    }
  });
  return {
    sourceFile,
    nodes,
  };
};

describe("Tsonic TSTS numeric primitive extension", () => {
  it("attaches numeric primitive facts to imported core type references", () => {
    const fixture = collectTypeReferenceNodes(`
      import type { int, long as i64 } from "@tsonic/core/types.js";
      export function add(left: int, right: i64): int {
        return left;
      }
    `);
    const host = createExtensionHost([createTsonicNumericPrimitiveExtension()]);

    host.afterParseSourceFile(fixture.sourceFile);

    const facts = fixture.nodes.map((node) =>
      host.facts.get(tsonicNumericPrimitiveFactKey, node),
    );
    expect(facts.map((fact) => fact?.kind)).to.deep.equal([
      "int32",
      "int64",
      "int32",
    ]);
  });

  it("does not infer primitives by bare identifier spelling without the core import", () => {
    const fixture = collectTypeReferenceNodes(`
      type int = number;
      export const value: int = 1;
    `);
    const host = createExtensionHost([createTsonicNumericPrimitiveExtension()]);

    host.afterParseSourceFile(fixture.sourceFile);

    const facts = fixture.nodes.map((node) =>
      host.facts.get(tsonicNumericPrimitiveFactKey, node),
    );
    expect(facts).to.deep.equal([undefined]);
  });
});
