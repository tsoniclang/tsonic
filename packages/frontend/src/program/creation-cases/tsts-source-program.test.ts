import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as path from "node:path";
import { createProgram } from "../creation.js";
import { getProgramRuntimeSourceFiles } from "../queries.js";
import { installMinimalCoreGlobalsSurface } from "./test-package-helpers.js";
import { getTstsTypeReferenceName, visitTstsSubtree } from "@tsonic/tsts";
import {
  extensionReceiverSemanticsFactKey,
  fieldSemanticsFactKey,
  heritageWrapperSemanticsFactKey,
  intrinsicSemanticsFactKey,
  numericPrimitiveFactKey,
  parameterPassingFactKey,
  sourceTypeSemanticsFactKey,
} from "../../source-frontend/source-facts.js";

const createTempProgram = (
  sourceText = [
    'import type { int } from "@tsonic/core/types.js";',
    "export const value: int = 1;",
    "",
  ].join("\n")
): {
  readonly projectRoot: string;
  readonly sourceRoot: string;
  readonly entryPath: string;
  readonly globalsRoot: string;
  readonly cleanup: () => void;
} => {
  const tempRoot = path.join(process.cwd(), ".temp", "tsts-program-creation");
  fs.mkdirSync(tempRoot, { recursive: true });
  const projectRoot = fs.mkdtempSync(path.join(tempRoot, "case-"));
  const sourceRoot = path.join(projectRoot, "src");
  const entryPath = path.join(sourceRoot, "index.ts");
  fs.mkdirSync(sourceRoot, { recursive: true });
  fs.writeFileSync(entryPath, sourceText);
  const globalsRoot = installMinimalCoreGlobalsSurface(projectRoot);
  return {
    projectRoot,
    sourceRoot,
    entryPath,
    globalsRoot,
    cleanup: () => fs.rmSync(projectRoot, { recursive: true, force: true }),
  };
};

describe("Program Creation – TSTS source program", () => {
  it("builds a TSTS source program directly", () => {
    const fixture = createTempProgram();
    try {
      const result = createProgram([fixture.entryPath], {
        projectRoot: fixture.projectRoot,
        sourceRoot: fixture.sourceRoot,
        rootNamespace: "Test",
        surface: "@tsonic/globals",
        typeRoots: [fixture.globalsRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value.sourceProgram.engine).to.equal("tsts");
      expect(result.value.sourceProgram.sourceFiles).to.have.length.greaterThan(
        0
      );
    } finally {
      fixture.cleanup();
    }
  });

  it("attaches Tsonic source facts through the TSTS extension host", () => {
    const fixture = createTempProgram();
    try {
      const result = createProgram([fixture.entryPath], {
        projectRoot: fixture.projectRoot,
        sourceRoot: fixture.sourceRoot,
        rootNamespace: "Test",
        surface: "@tsonic/globals",
        typeRoots: [fixture.globalsRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const facts = result.value.sourceProgram.extensionHost.facts;
      const primitiveKinds: string[] = [];
      const entrySourceFile = result.value.sourceProgram.sourceFiles.find(
        (sourceFile) =>
          path.resolve(sourceFile.FileName()) ===
          path.resolve(fixture.entryPath)
      );
      expect(entrySourceFile).to.not.equal(undefined);
      if (!entrySourceFile) return;

      visitTstsSubtree(entrySourceFile, (node) => {
        if (!node || getTstsTypeReferenceName(node) !== "int") return;
        const fact = facts.get(numericPrimitiveFactKey, node);
        if (fact) {
          primitiveKinds.push(fact.kind);
        }
      });

      expect(primitiveKinds).to.deep.equal(["int32"]);
    } finally {
      fixture.cleanup();
    }
  });

  it("projects TSTS source facts onto the frontend source semantic view", () => {
    const fixture = createTempProgram(
      [
        'import type { int, out, struct as valueType } from "@tsonic/core/types.js";',
        'import type { field, Interface, thisarg } from "@tsonic/core/lang.js";',
        'import { defaultof } from "@tsonic/core/lang.js";',
        "export interface Point extends valueType {",
        "  x: field<int>;",
        "}",
        "export interface Contract {}",
        "export class Service implements Interface<Contract> {}",
        "export function reset(value: out<int>): void {",
        "  defaultof<int>();",
        "}",
        "export function attach(target: thisarg<Service>): void {}",
        "",
      ].join("\n")
    );
    try {
      const result = createProgram([fixture.entryPath], {
        projectRoot: fixture.projectRoot,
        sourceRoot: fixture.sourceRoot,
        rootNamespace: "Test",
        surface: "@tsonic/globals",
        typeRoots: [fixture.globalsRoot],
      });

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const sourceFile = getProgramRuntimeSourceFiles(result.value).find(
        (candidate) => candidate.FileName() === fixture.entryPath
      );
      expect(sourceFile).to.not.equal(undefined);
      if (!sourceFile) return;

      const projected: string[] = [];
      const facts = result.value.sourceProgram.extensionHost.facts;
      visitTstsSubtree(sourceFile, (node) => {
        if (!node) return;
        const primitive = facts.get(numericPrimitiveFactKey, node);
        if (primitive) projected.push(`primitive:${primitive.kind}`);

        const typeSemantics = facts.get(sourceTypeSemanticsFactKey, node);
        if (typeSemantics) projected.push(`type:${typeSemantics.kind}`);

        const field = facts.get(fieldSemanticsFactKey, node);
        if (field) projected.push(`field:${field.kind}`);

        const passing = facts.get(parameterPassingFactKey, node);
        if (passing) projected.push(`passing:${passing.mode}`);

        const receiver = facts.get(extensionReceiverSemanticsFactKey, node);
        if (receiver) projected.push(`receiver:${receiver.kind}`);

        const heritageWrapper = facts.get(
          heritageWrapperSemanticsFactKey,
          node
        );
        if (heritageWrapper) {
          projected.push(`heritage:${heritageWrapper.kind}`);
        }

        const intrinsic = facts.get(intrinsicSemanticsFactKey, node);
        if (intrinsic) projected.push(`intrinsic:${intrinsic.kind}`);
      });

      expect(projected).to.include.members([
        "type:struct",
        "field:field",
        "primitive:int32",
        "passing:byref-writeonly-must-init",
        "receiver:extension-receiver",
        "heritage:interface-erasure",
        "intrinsic:defaultof",
      ]);
    } finally {
      fixture.cleanup();
    }
  });
});
