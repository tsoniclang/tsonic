import { describe, it } from "mocha";
import { expect } from "chai";
import { runAnonymousTypeLoweringPass, validateIrSoundness } from "../index.js";
import type { IrModule, IrType } from "../../types.js";
import {
  createTestModule,
  hasArrayInferredObjectElementType,
  hasNonEmptyObjectTypeInExpressionMetadata,
} from "./test-helpers.js";

describe("Anonymous Type Lowering Regression Coverage (basic lowering)", () => {
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

  it("retains anonymous carriers for object literals used only through inferred object metadata", () => {
    const module = createTestModule(`
      const doubledKey = "doubled";

      const counter = {
        _value: 1,
        get value(): number {
          return this._value;
        },
        set value(v: number) {
          this._value = v;
        },
        get [doubledKey](): number {
          return this.value * 2;
        },
      };

      export function read(): number {
        counter.value = counter.value + 4;
        return counter[doubledKey];
      }
    `);

    const lowered = runAnonymousTypeLoweringPass([module]);
    const soundness = validateIrSoundness(lowered.modules);

    expect(soundness.diagnostics.some((d) => d.code === "TSN7421")).to.equal(
      false
    );

    const anonModule = lowered.modules.find(
      (entry) => entry.filePath === "__tsonic/__tsonic_anonymous_types.g.ts"
    );
    expect(anonModule).to.not.equal(undefined);
    expect(
      anonModule?.body.some(
        (statement) =>
          statement.kind === "classDeclaration" &&
          statement.name.startsWith("__Anon_")
      )
    ).to.equal(true);
  });

  it("lowers inline call parameter shapes to compiler-owned structural carriers", () => {
    const optionsShape: Extract<IrType, { kind: "objectType" }> = {
      kind: "objectType" as const,
      members: [
        {
          kind: "propertySignature" as const,
          name: "recursive",
          type: { kind: "primitiveType" as const, name: "boolean" },
          isOptional: true,
          isReadonly: false,
        },
        {
          kind: "propertySignature" as const,
          name: "mode",
          type: { kind: "primitiveType" as const, name: "number" },
          isOptional: true,
          isReadonly: false,
        },
      ],
    };

    const module: IrModule = {
      kind: "module",
      filePath: "input.ts",
      namespace: "TestApp",
      className: "Input",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "classDeclaration",
          name: "MkdirOptions",
          members: [
            {
              kind: "propertyDeclaration",
              name: "recursive",
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "boolean" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
              emitAsAutoProperty: true,
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
              isRequired: false,
            },
            {
              kind: "propertyDeclaration",
              name: "mode",
              type: {
                kind: "unionType",
                types: [
                  { kind: "primitiveType", name: "number" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
              emitAsAutoProperty: true,
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
              isRequired: false,
            },
          ],
          isExported: true,
          isStruct: false,
          implements: [],
          superClass: undefined,
        },
        {
          kind: "functionDeclaration",
          name: "ensure",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "dir" },
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "call",
                  callee: {
                    kind: "memberAccess",
                    object: {
                      kind: "identifier",
                      name: "fs",
                      inferredType: {
                        kind: "objectType",
                        members: [
                          {
                            kind: "methodSignature",
                            name: "mkdirSync",
                            parameters: [
                              {
                                kind: "parameter",
                                pattern: {
                                  kind: "identifierPattern",
                                  name: "path",
                                },
                                type: {
                                  kind: "primitiveType",
                                  name: "string",
                                },
                                isOptional: false,
                                isRest: false,
                                passing: "value",
                              },
                              {
                                kind: "parameter",
                                pattern: {
                                  kind: "identifierPattern",
                                  name: "options",
                                },
                                type: optionsShape,
                                isOptional: false,
                                isRest: false,
                                passing: "value",
                              },
                            ],
                            returnType: { kind: "voidType" },
                          },
                        ],
                      },
                    },
                    property: "mkdirSync",
                    isComputed: false,
                    isOptional: false,
                    inferredType: {
                      kind: "functionType",
                      parameters: [
                        {
                          kind: "parameter",
                          pattern: { kind: "identifierPattern", name: "path" },
                          type: { kind: "primitiveType", name: "string" },
                          isOptional: false,
                          isRest: false,
                          passing: "value",
                        },
                        {
                          kind: "parameter",
                          pattern: {
                            kind: "identifierPattern",
                            name: "options",
                          },
                          type: optionsShape,
                          isOptional: false,
                          isRest: false,
                          passing: "value",
                        },
                      ],
                      returnType: { kind: "voidType" },
                    },
                  },
                  arguments: [
                    {
                      kind: "identifier",
                      name: "dir",
                      inferredType: { kind: "primitiveType", name: "string" },
                    },
                    {
                      kind: "identifier",
                      name: "options",
                      inferredType: { kind: "referenceType", name: "MkdirOptions" },
                    },
                  ],
                  isOptional: false,
                  inferredType: { kind: "voidType" },
                  allowUnknownInferredType: true,
                  requiresSpecialization: false,
                  argumentPassing: ["value", "value"],
                  parameterTypes: [
                    { kind: "primitiveType", name: "string" },
                    optionsShape,
                  ],
                  surfaceParameterTypes: [
                    { kind: "primitiveType", name: "string" },
                    optionsShape,
                  ],
                },
              },
            ],
          },
          isAsync: false,
          isGenerator: false,
          isExported: true,
        },
      ],
    };

    const lowered = runAnonymousTypeLoweringPass([module]);
    const soundness = validateIrSoundness(lowered.modules);

    expect(soundness.diagnostics.some((d) => d.code === "TSN7421")).to.equal(
      false
    );

    const ensure = lowered.modules
      .flatMap((currentModule) => currentModule.body)
      .find(
        (stmt): stmt is Extract<
          (typeof lowered.modules)[number]["body"][number],
          { kind: "functionDeclaration" }
        > => stmt.kind === "functionDeclaration" && stmt.name === "ensure"
      );
    const loweredCall =
      ensure?.body.statements[0]?.kind === "expressionStatement" &&
      ensure.body.statements[0].expression.kind === "call"
        ? ensure.body.statements[0].expression
        : undefined;

    expect(loweredCall).to.not.equal(undefined);
    expect(loweredCall?.parameterTypes?.[1]?.kind).to.equal("referenceType");
    expect(loweredCall?.surfaceParameterTypes?.[1]?.kind).to.equal(
      "referenceType"
    );

    const loweredRuntimeType = loweredCall?.parameterTypes?.[1];
    const loweredSurfaceType = loweredCall?.surfaceParameterTypes?.[1];
    expect(
      loweredRuntimeType &&
        loweredRuntimeType.kind === "referenceType" &&
        loweredRuntimeType.name
    ).to.match(/^__Anon_/);
    expect(
      loweredSurfaceType &&
        loweredSurfaceType.kind === "referenceType" &&
        loweredSurfaceType.name
    ).to.equal(
      loweredRuntimeType && loweredRuntimeType.kind === "referenceType"
        ? loweredRuntimeType.name
        : undefined
    );
  });
});
