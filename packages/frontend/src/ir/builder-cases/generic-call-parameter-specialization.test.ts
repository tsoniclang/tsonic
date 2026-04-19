/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import type {
  IrCallExpression,
  IrFunctionDeclaration,
  IrModule,
  IrType,
} from "../types.js";
import {
  runAnonymousTypeLoweringPass,
  runCallResolutionRefreshPass,
  runNumericProofPass,
} from "../validation/index.js";
import {
  createFilesystemTestProgram,
  createTestProgram,
} from "./_test-helpers.js";

const collectTypeParameterNames = (
  type: IrType | undefined,
  names: Set<string>
): void => {
  if (!type) {
    return;
  }

  switch (type.kind) {
    case "typeParameterType":
      names.add(type.name);
      return;
    case "arrayType":
      collectTypeParameterNames(type.elementType, names);
      return;
    case "tupleType":
      type.elementTypes.forEach((elementType) =>
        collectTypeParameterNames(elementType, names)
      );
      return;
    case "dictionaryType":
      collectTypeParameterNames(type.keyType, names);
      collectTypeParameterNames(type.valueType, names);
      return;
    case "referenceType":
      type.typeArguments?.forEach((typeArgument) =>
        collectTypeParameterNames(typeArgument, names)
      );
      type.structuralMembers?.forEach((member) => {
        if (member.kind === "propertySignature") {
          collectTypeParameterNames(member.type, names);
          return;
        }
        member.parameters.forEach((parameter) =>
          collectTypeParameterNames(parameter.type, names)
        );
        collectTypeParameterNames(member.returnType, names);
      });
      return;
    case "unionType":
    case "intersectionType":
      type.types.forEach((memberType) =>
        collectTypeParameterNames(memberType, names)
      );
      return;
    case "functionType":
      type.parameters.forEach((parameter) =>
        collectTypeParameterNames(parameter.type, names)
      );
      collectTypeParameterNames(type.returnType, names);
      return;
    case "objectType":
      type.members.forEach((member) => {
        if (member.kind === "propertySignature") {
          collectTypeParameterNames(member.type, names);
          return;
        }
        member.parameters.forEach((parameter) =>
          collectTypeParameterNames(parameter.type, names)
        );
        collectTypeParameterNames(member.returnType, names);
      });
      return;
    default:
      return;
  }
};

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
  return runAnonymousTypeLoweringPass(refreshed.modules).modules[0]!;
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

describe("IR Builder – generic call parameter specialization", function () {
  this.timeout(90_000);

  it("specializes imported generic callback helpers through nullish callback unions", () => {
    const { sourceFile, testProgram, ctx, options, cleanup } =
      createFilesystemTestProgram(
        {
          "src/helper.ts": `
            export const toUnary = <T>(
              listener: ((value: T) => void) | null | undefined
            ) => listener;
          `,
          "src/test.ts": `
            import { toUnary } from "./helper.js";

            export function run(
              callback?: ((value: string) => void) | null
            ): void {
              toUnary(callback);
            }
          `,
        },
        "src/test.ts"
      );

    try {
      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      if (!result.ok) {
        return;
      }

      const finalModule = buildFinalModule(result.value, ctx);
      const call = findCall(finalModule, (candidate) => {
        return (
          candidate.callee.kind === "identifier" &&
          candidate.callee.name === "toUnary"
        );
      });

      expect(call).to.not.equal(undefined);
      if (!call) {
        return;
      }

      const parameterType = call.parameterTypes?.[0];
      expect(parameterType).to.not.equal(undefined);
      expect(parameterType?.kind).to.equal("unionType");
      if (parameterType?.kind !== "unionType") {
        return;
      }

      const callbackMember = parameterType.types.find(
        (member): member is Extract<IrType, { kind: "functionType" }> =>
          member.kind === "functionType"
      );
      expect(callbackMember).to.not.equal(undefined);
      expect(callbackMember?.parameters[0]?.type).to.deep.equal({
        kind: "primitiveType",
        name: "string",
      });

      const collected = new Set<string>();
      collectTypeParameterNames(parameterType, collected);
      expect([...collected]).to.not.include("T");
    } finally {
      cleanup();
    }
  });

  it("specializes explicit generic helper calls to the call-site type arguments", () => {
    const source = `
      const wrapArray = <T>(values: T[]): T[] => values;

      export function run<TResult>(values: TResult[]): TResult[] {
        return wrapArray<TResult>(values as TResult[]);
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
    const run = finalModule.body.find(
      (statement): statement is IrFunctionDeclaration =>
        statement.kind === "functionDeclaration" && statement.name === "run"
    );
    expect(run).to.not.equal(undefined);
    if (!run) {
      return;
    }

    const call = findCall(run, (candidate) => {
      return (
        candidate.callee.kind === "identifier" &&
        candidate.callee.name === "wrapArray"
      );
    });

    expect(call).to.not.equal(undefined);
    if (!call) {
      return;
    }

    const parameterType = call.parameterTypes?.[0];
    expect(parameterType).to.deep.include({
      kind: "arrayType",
      elementType: {
        kind: "typeParameterType",
        name: "TResult",
      },
    });
  });
});
