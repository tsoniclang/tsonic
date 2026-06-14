/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { buildIrModule } from "../../builder.js";
import { createProgramContext } from "../../program-context.js";
import { createInlineTstsTestProgram } from "../../../testing/tsts-test-program.js";

export const createTestModule = (source: string) => {
  const testProgram = createInlineTstsTestProgram(source, {
    fileName: "input.ts",
  });
  const options = {
    sourceRoot: testProgram.options.sourceRoot,
    rootNamespace: "TestApp",
  };
  const ctx = createProgramContext(testProgram, options);
  const irResult = buildIrModule(
    testProgram.sourceFile,
    testProgram,
    options,
    ctx
  );
  if (!irResult.ok) {
    throw new Error(`IR build failed: ${irResult.error.message}`);
  }
  return irResult.value;
};

export const hasArrayInferredObjectElementType = (value: unknown): boolean => {
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

export const hasNonEmptyObjectTypeInExpressionMetadata = (
  value: unknown
): boolean => {
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
