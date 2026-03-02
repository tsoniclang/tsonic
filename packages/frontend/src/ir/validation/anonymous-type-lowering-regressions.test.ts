import { describe, it } from "mocha";
import { expect } from "chai";
import * as ts from "typescript";
import { buildIrModule } from "../builder.js";
import { createProgramContext } from "../program-context.js";
import { DotnetMetadataRegistry } from "../../dotnet-metadata.js";
import { BindingRegistry } from "../../program/bindings.js";
import { createClrBindingsResolver } from "../../resolver/clr-bindings-resolver.js";
import { createBinding } from "../binding/index.js";
import { runAnonymousTypeLoweringPass, validateIrSoundness } from "./index.js";

const createTestModule = (source: string) => {
  const fileName = "/test/input.ts";
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );

  const program = ts.createProgram(
    [fileName],
    { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    {
      getSourceFile: (name) => (name === fileName ? sourceFile : undefined),
      writeFile: () => {},
      getCurrentDirectory: () => "/test",
      getDirectories: () => [],
      fileExists: () => true,
      readFile: () => source,
      getCanonicalFileName: (f) => f,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => "\n",
      getDefaultLibFileName: () => "lib.d.ts",
    }
  );
  const checker = program.getTypeChecker();

  const testProgram = {
    program,
    checker,
    options: {
      projectRoot: "/test",
      sourceRoot: "/test",
      rootNamespace: "TestApp",
      strict: true,
    },
    sourceFiles: [sourceFile],
    declarationSourceFiles: [],
    metadata: new DotnetMetadataRegistry(),
    bindings: new BindingRegistry(),
    clrResolver: createClrBindingsResolver("/test"),
    binding: createBinding(checker),
  };

  const options = { sourceRoot: "/test", rootNamespace: "TestApp" };
  const ctx = createProgramContext(testProgram, options);
  const irResult = buildIrModule(sourceFile, testProgram, options, ctx);
  if (!irResult.ok) {
    throw new Error(`IR build failed: ${irResult.error.message}`);
  }
  return irResult.value;
};

const hasArrayInferredObjectElementType = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (
    record.kind === "array" &&
    record.inferredType &&
    typeof record.inferredType === "object" &&
    (record.inferredType as { kind?: string }).kind === "arrayType"
  ) {
    const elementType = (
      record.inferredType as {
        elementType?: { kind?: string };
      }
    ).elementType;
    if (elementType?.kind === "objectType") return true;
  }
  return Object.values(record).some((entry) =>
    hasArrayInferredObjectElementType(entry)
  );
};

const hasNonEmptyObjectTypeInExpressionMetadata = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;

  const inferredType = record.inferredType;
  if (
    inferredType &&
    typeof inferredType === "object" &&
    (inferredType as { kind?: string }).kind === "objectType"
  ) {
    const members = (inferredType as { members?: unknown[] }).members;
    if (Array.isArray(members) && members.length > 0) return true;
  }

  const contextualType = record.contextualType;
  if (
    contextualType &&
    typeof contextualType === "object" &&
    (contextualType as { kind?: string }).kind === "objectType"
  ) {
    const members = (contextualType as { members?: unknown[] }).members;
    if (Array.isArray(members) && members.length > 0) return true;
  }

  return Object.values(record).some((entry) =>
    hasNonEmptyObjectTypeInExpressionMetadata(entry)
  );
};

describe("Anonymous Type Lowering Regression Coverage", () => {
  it("lowers array inferredType metadata for contextual empty arrays", () => {
    const module = createTestModule(`
      export function collect(
        map: Record<string, { clientName: string; status: string; timestamp: number }[]>,
        id: string
      ): Record<string, { clientName: string; status: string; timestamp: number }[]> {
        if (map[id] === undefined) {
          map[id] = [];
        }
        return map;
      }
    `);

    const lowered = runAnonymousTypeLoweringPass([module]);
    const soundness = validateIrSoundness(lowered.modules);

    expect(soundness.diagnostics.some((d) => d.code === "TSN7421")).to.equal(
      false
    );

    expect(hasArrayInferredObjectElementType(lowered.modules)).to.equal(false);
  });

  it("lowers call/member inferred metadata object shapes to synthetic references", () => {
    const module = createTestModule(`
      const makePayload = () => ({ ok: true, code: 200 });

      export function readCode(): number {
        const result = makePayload();
        const code = makePayload().code;
        return result.code + code;
      }
    `);

    const lowered = runAnonymousTypeLoweringPass([module]);
    const soundness = validateIrSoundness(lowered.modules);

    expect(soundness.diagnostics.some((d) => d.code === "TSN7421")).to.equal(
      false
    );
    expect(hasNonEmptyObjectTypeInExpressionMetadata(lowered.modules)).to.equal(
      false
    );
  });
});
