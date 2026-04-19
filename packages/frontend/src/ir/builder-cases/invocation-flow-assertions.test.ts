/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import type { IrCallExpression, IrModule } from "../types.js";
import {
  runAnonymousTypeLoweringPass,
  runCallResolutionRefreshPass,
  runNumericProofPass,
} from "../validation/index.js";
import { createTestProgram } from "./_test-helpers.js";

const buildFinalModule = (
  module: IrModule,
  ctx: Parameters<typeof runCallResolutionRefreshPass>[1]
): IrModule => {
  const lowered = runAnonymousTypeLoweringPass([module]).modules;
  const proofResult = runNumericProofPass(lowered);
  expect(proofResult.ok).to.equal(true);
  if (!proofResult.ok) {
    throw new Error("Numeric proof failed");
  }
  const refreshed = runCallResolutionRefreshPass(proofResult.modules, ctx);
  const finalModules = runAnonymousTypeLoweringPass(refreshed.modules).modules;
  return (
    finalModules.find((candidate) => candidate.filePath === module.filePath) ??
    finalModules[0]!
  );
};

const findCall = (
  value: unknown,
  predicate: (call: IrCallExpression) => boolean
): IrCallExpression | undefined => {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findCall(item, predicate);
      if (match) {
        return match;
      }
    }
    return undefined;
  }

  const candidate = value as { readonly kind?: string };
  if (candidate.kind === "call") {
    const call = value as IrCallExpression;
    if (predicate(call)) {
      return call;
    }
  }

  for (const nested of Object.values(value)) {
    const match = findCall(nested, predicate);
    if (match) {
      return match;
    }
  }

  return undefined;
};

const hasIdentifierCallee = (call: IrCallExpression, name: string): boolean => {
  let current = call.callee;
  while (
    current.kind === "typeAssertion" ||
    current.kind === "numericNarrowing"
  ) {
    current = current.expression;
  }

  return current.kind === "identifier" && current.name === name;
};

describe("IR Builder – invocation flow assertions", function () {
  this.timeout(90_000);

  it("strips transparent identifier flow assertions once call metadata captures the selected member type", () => {
    const source = `
      declare class Bytes {}
      declare function decodeInputBytes(
        data: string | Bytes,
        encoding?: string,
      ): Bytes;

      export function run(key: string | Bytes): void {
        if (typeof key === "string") {
          decodeInputBytes(key, "utf8");
        }
      }
    `;

    const { testProgram, ctx, options } = createTestProgram(source);
    const sourceFile = testProgram.sourceFiles[0];
    if (!sourceFile) {
      throw new Error("Failed to create source file");
    }

    const result = buildIrModule(sourceFile, testProgram, options, ctx);
    expect(result.ok).to.equal(true);
    if (!result.ok) {
      return;
    }

    const finalModule = buildFinalModule(result.value, ctx);
    const call = findCall(finalModule, (candidate) =>
      hasIdentifierCallee(candidate, "decodeInputBytes")
    );

    expect(call).to.not.equal(undefined);
    if (!call) {
      return;
    }

    expect(call.parameterTypes?.[0]).to.deep.equal({
      kind: "primitiveType",
      name: "string",
    });
    expect(call.surfaceParameterTypes?.[0]?.kind).to.equal("unionType");

    const firstArgument = call.arguments[0];
    expect(firstArgument?.kind).to.equal("identifier");
    if (!firstArgument || firstArgument.kind !== "identifier") {
      return;
    }

    expect(firstArgument.inferredType).to.deep.equal({
      kind: "primitiveType",
      name: "string",
    });
  });

  it("strips transparent member-access flow assertions once call metadata captures the selected member type", () => {
    const source = `
      declare class Bytes {}
      declare function decodeInputBytes(
        data: string | Bytes,
        encoding?: string,
      ): Bytes;

      export function run(box: { key: string | Bytes }): void {
        if (typeof box.key === "string") {
          decodeInputBytes(box.key, "utf8");
        }
      }
    `;

    const { testProgram, ctx, options } = createTestProgram(source);
    const sourceFile = testProgram.sourceFiles[0];
    if (!sourceFile) {
      throw new Error("Failed to create source file");
    }

    const result = buildIrModule(sourceFile, testProgram, options, ctx);
    expect(result.ok).to.equal(true);
    if (!result.ok) {
      return;
    }

    const finalModule = buildFinalModule(result.value, ctx);
    const call = findCall(finalModule, (candidate) =>
      hasIdentifierCallee(candidate, "decodeInputBytes")
    );

    expect(call).to.not.equal(undefined);
    if (!call) {
      return;
    }

    expect(call.parameterTypes?.[0]).to.deep.equal({
      kind: "primitiveType",
      name: "string",
    });
    expect(call.surfaceParameterTypes?.[0]?.kind).to.equal("unionType");

    const firstArgument = call.arguments[0];
    expect(firstArgument?.kind).to.equal("memberAccess");
    if (!firstArgument || firstArgument.kind !== "memberAccess") {
      return;
    }

    expect(firstArgument.inferredType).to.deep.equal({
      kind: "primitiveType",
      name: "string",
    });
  });

  it("captures predicate-narrowed alias members in branch-local call metadata", () => {
    const source = `
      type PathSpec = string | RegExp | readonly PathSpec[];
      type RequestHandler = (request: string) => void;

      declare function isPathSpec(
        value: PathSpec | RequestHandler
      ): value is PathSpec;
      declare function addMiddlewareLayer(path: PathSpec): void;

      export function run(first: PathSpec | RequestHandler): void {
        if (isPathSpec(first)) {
          addMiddlewareLayer(first);
        }
      }
    `;

    const { testProgram, ctx, options } = createTestProgram(source);
    const sourceFile = testProgram.sourceFiles[0];
    if (!sourceFile) {
      throw new Error("Failed to create source file");
    }

    const result = buildIrModule(sourceFile, testProgram, options, ctx);
    expect(result.ok).to.equal(true);
    if (!result.ok) {
      return;
    }

    const finalModule = buildFinalModule(result.value, ctx);
    const call = findCall(finalModule, (candidate) =>
      hasIdentifierCallee(candidate, "addMiddlewareLayer")
    );

    expect(call).to.not.equal(undefined);
    if (!call) {
      return;
    }

    expect(call.parameterTypes?.[0]?.kind).to.equal("referenceType");
    if (call.parameterTypes?.[0]?.kind !== "referenceType") {
      return;
    }
    expect(call.parameterTypes[0].name).to.equal("PathSpec");
    expect(call.surfaceParameterTypes?.[0]?.kind).to.equal("referenceType");

    const firstArgument = call.arguments[0];
    expect(firstArgument?.kind).to.equal("typeAssertion");
    if (!firstArgument || firstArgument.kind !== "typeAssertion") {
      return;
    }

    expect(firstArgument.inferredType?.kind).to.equal("referenceType");
    if (firstArgument.inferredType?.kind !== "referenceType") {
      return;
    }
    expect(firstArgument.inferredType.name).to.equal("PathSpec");
    expect(firstArgument.expression.kind).to.equal("identifier");
  });
});
