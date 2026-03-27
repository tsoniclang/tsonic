import { describe, it } from "mocha";
import { expect } from "chai";
import { runAnonymousTypeLoweringPass, validateIrSoundness } from "../index.js";
import type { IrModule, IrReferenceType, IrType } from "../../types.js";

describe("Anonymous Type Lowering Regression Coverage (structural references)", () => {
  it("does not recurse infinitely through cyclic structural reference members", () => {
    const routerType = {
      kind: "referenceType",
      name: "Router",
      typeId: {
        stableId: "Test.Router",
        tsName: "Router",
        clrName: "Test.Router",
      },
      structuralMembers: [],
    } as unknown as IrReferenceType;

    const middlewareLike = {
      kind: "unionType",
      types: [],
    } as unknown as {
      kind: "unionType";
      types: IrType[];
    };

    const middlewareArray = {
      kind: "arrayType",
      elementType: middlewareLike,
    } as IrType;

    (
      routerType as IrReferenceType & {
        structuralMembers: unknown[];
      }
    ).structuralMembers = [
      {
        kind: "methodSignature",
        name: "use",
        parameters: [
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: "handlers" },
            type: middlewareLike,
            initializer: undefined,
            isOptional: false,
            isRest: true,
            passing: "value",
          },
        ],
        returnType: routerType,
      },
    ];

    middlewareLike.types.push(routerType, middlewareArray);

    const module: IrModule = {
      kind: "module",
      filePath: "app.ts",
      namespace: "TestApp",
      className: "App",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "state" },
              initializer: {
                kind: "object",
                properties: [],
                inferredType: {
                  kind: "objectType",
                  members: [
                    {
                      kind: "propertySignature",
                      name: "owner",
                      type: routerType,
                      isOptional: false,
                      isReadonly: false,
                    },
                    {
                      kind: "propertySignature",
                      name: "handlers",
                      type: middlewareLike as never,
                      isOptional: false,
                      isReadonly: false,
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    };

    const lowered = runAnonymousTypeLoweringPass([module]);
    const soundness = validateIrSoundness(lowered.modules);

    expect(soundness.diagnostics.some((d) => d.code === "TSN7421")).to.equal(
      false
    );
    expect(lowered.modules.length).to.be.greaterThan(0);
  });

  it("preserves same-namespace local class references in generated anonymous modules", () => {
    const applicationType: IrType = {
      kind: "referenceType",
      name: "Application",
    };

    const module: IrModule = {
      kind: "module",
      filePath: "app.ts",
      namespace: "TestApp",
      className: "App",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "classDeclaration",
          name: "Application",
          members: [],
          isExported: true,
          isStruct: false,
          implements: [],
          superClass: undefined,
        },
        {
          kind: "variableDeclaration",
          declarationKind: "const",
          isExported: false,
          declarations: [
            {
              kind: "variableDeclarator",
              name: { kind: "identifierPattern", name: "state" },
              initializer: {
                kind: "object",
                properties: [],
                inferredType: {
                  kind: "objectType",
                  members: [
                    {
                      kind: "propertySignature",
                      name: "owner",
                      type: applicationType,
                      isOptional: false,
                      isReadonly: false,
                    },
                    {
                      kind: "propertySignature",
                      name: "path",
                      type: { kind: "primitiveType", name: "string" },
                      isOptional: false,
                      isReadonly: false,
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    };

    const lowered = runAnonymousTypeLoweringPass([module]);
    const soundness = validateIrSoundness(lowered.modules);

    expect(soundness.diagnostics.some((d) => d.code === "TSN7414")).to.equal(
      false
    );
  });

  it("reuses exact local structural aliases instead of generating anonymous carriers", () => {
    const createInputType: IrType = {
      kind: "objectType",
      members: [
        {
          kind: "propertySignature",
          name: "fullName",
          type: { kind: "primitiveType", name: "string" },
          isOptional: false,
          isReadonly: false,
        },
        {
          kind: "propertySignature",
          name: "shortName",
          type: { kind: "primitiveType", name: "string" },
          isOptional: false,
          isReadonly: false,
        },
        {
          kind: "propertySignature",
          name: "botType",
          type: { kind: "primitiveType", name: "int" },
          isOptional: true,
          isReadonly: false,
        },
      ],
    };

    const module: IrModule = {
      kind: "module",
      filePath: "bot.ts",
      namespace: "Test",
      className: "Bot",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "typeAliasDeclaration",
          name: "CreateInput",
          type: createInputType,
          isExported: false,
          isStruct: false,
        },
        {
          kind: "functionDeclaration",
          name: "createBotDomain",
          typeParameters: undefined,
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "input" },
              type: createInputType,
              initializer: undefined,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
          body: { kind: "blockStatement", statements: [] },
          isExported: false,
          isAsync: false,
          isGenerator: false,
        },
      ],
    };

    const lowered = runAnonymousTypeLoweringPass([module]);
    const loweredModule = lowered.modules.find((entry) => entry.filePath === "bot.ts");
    const functionDecl = loweredModule?.body.find(
      (stmt): stmt is Extract<typeof stmt, { kind: "functionDeclaration" }> =>
        stmt.kind === "functionDeclaration" && stmt.name === "createBotDomain"
    );
    const parameterType = functionDecl?.parameters[0]?.type;

    expect(parameterType?.kind).to.equal("referenceType");
    if (parameterType?.kind !== "referenceType") {
      throw new Error("Expected lowered parameter type to be a referenceType");
    }
    expect(parameterType.name).to.equal("CreateInput");
    expect(parameterType.typeArguments).to.equal(undefined);
    expect(parameterType.structuralMembers).to.deep.equal(createInputType.members);
    expect(
      lowered.modules.some((entry) => entry.filePath === "__tsonic/__tsonic_anonymous_types.g.ts")
    ).to.equal(false);
  });
});
