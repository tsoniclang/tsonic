import { describe, it } from "mocha";
import { expect } from "chai";
import { runAnonymousTypeLoweringPass, validateIrSoundness } from "../index.js";
import type {
  IrClassDeclaration,
  IrModule,
  IrReferenceType,
  IrType,
} from "../../types.js";
import { computeShapeSignature } from "../anon-type-shape-analysis.js";

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

  it("preserves local class references when anonymous modules fall back to the empty common namespace", () => {
    const applicationType: IrType = {
      kind: "referenceType",
      name: "Application",
    };

    const moduleA: IrModule = {
      kind: "module",
      filePath: "application.ts",
      namespace: "Demo.ExpressLike",
      className: "ApplicationModule",
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
                  ],
                },
              },
            },
          ],
        },
      ],
    };

    const moduleB: IrModule = {
      kind: "module",
      filePath: "entry.ts",
      namespace: "App",
      className: "Entry",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [],
    };

    const lowered = runAnonymousTypeLoweringPass([moduleA, moduleB]);
    const soundness = validateIrSoundness(lowered.modules);

    expect(soundness.diagnostics.some((d) => d.code === "TSN7414")).to.equal(
      false
    );
  });

  it("treats mutually recursive named structural references as opaque during existing-carrier discovery", () => {
    const siteContextType = {
      kind: "referenceType",
      name: "SiteContext",
      typeId: {
        stableId: "Test.SiteContext",
        tsName: "SiteContext",
        clrName: "Test.SiteContext",
      },
      structuralMembers: [],
    } as unknown as IrReferenceType;

    const pageContextType = {
      kind: "referenceType",
      name: "PageContext",
      typeId: {
        stableId: "Test.PageContext",
        tsName: "PageContext",
        clrName: "Test.PageContext",
      },
      structuralMembers: [],
    } as unknown as IrReferenceType;

    const pageContextArray: IrType = {
      kind: "arrayType",
      elementType: pageContextType,
    };

    (
      siteContextType as IrReferenceType & {
        structuralMembers: unknown[];
      }
    ).structuralMembers = [
      {
        kind: "propertySignature",
        name: "pages",
        type: pageContextArray,
        isOptional: false,
        isReadonly: false,
      },
    ];

    (
      pageContextType as IrReferenceType & {
        structuralMembers: unknown[];
      }
    ).structuralMembers = [
      {
        kind: "propertySignature",
        name: "site",
        type: siteContextType,
        isOptional: false,
        isReadonly: false,
      },
      {
        kind: "propertySignature",
        name: "translations",
        type: pageContextArray,
        isOptional: false,
        isReadonly: false,
      },
    ];

    const module: IrModule = {
      kind: "module",
      filePath: "site.ts",
      namespace: "TestApp",
      className: "Site",
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
              name: { kind: "identifierPattern", name: "view" },
              initializer: {
                kind: "object",
                properties: [],
                inferredType: {
                  kind: "objectType",
                  members: [
                    {
                      kind: "propertySignature",
                      name: "site",
                      type: siteContextType,
                      isOptional: false,
                      isReadonly: false,
                    },
                    {
                      kind: "propertySignature",
                      name: "page",
                      type: pageContextType,
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

    expect(soundness.diagnostics.length).to.equal(0);
    expect(lowered.modules.length).to.be.greaterThan(0);
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

  it("reuses exact local structural classes instead of generating anonymous carriers", () => {
    const mkdirOptionsType: IrType = {
      kind: "objectType",
      members: [
        {
          kind: "propertySignature",
          name: "recursive",
          type: { kind: "primitiveType", name: "boolean" },
          isOptional: true,
          isReadonly: false,
        },
        {
          kind: "propertySignature",
          name: "mode",
          type: { kind: "primitiveType", name: "int" },
          isOptional: true,
          isReadonly: false,
        },
      ],
    };

    const module: IrModule = {
      kind: "module",
      filePath: "fs.ts",
      namespace: "Test",
      className: "Fs",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "classDeclaration",
          name: "MkdirOptions",
          typeParameters: undefined,
          superClass: undefined,
          implements: [],
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
              initializer: undefined,
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
                  { kind: "primitiveType", name: "int" },
                  { kind: "primitiveType", name: "undefined" },
                ],
              },
              initializer: undefined,
              emitAsAutoProperty: true,
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
              isRequired: false,
            },
          ],
          isExported: false,
          isStruct: false,
        },
        {
          kind: "functionDeclaration",
          name: "mkdirSync",
          typeParameters: undefined,
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "path" },
              type: { kind: "primitiveType", name: "string" },
              initializer: undefined,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "options" },
              type: mkdirOptionsType,
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
    const loweredModule = lowered.modules.find((entry) => entry.filePath === "fs.ts");
    const functionDecl = loweredModule?.body.find(
      (stmt): stmt is Extract<typeof stmt, { kind: "functionDeclaration" }> =>
        stmt.kind === "functionDeclaration" && stmt.name === "mkdirSync"
    );
    const parameterType = functionDecl?.parameters[1]?.type;

    expect(parameterType?.kind).to.equal("referenceType");
    if (parameterType?.kind !== "referenceType") {
      throw new Error("Expected lowered parameter type to be a referenceType");
    }
    expect(parameterType.name).to.equal("MkdirOptions");
    expect(
      lowered.modules.some(
        (entry) => entry.filePath === "__tsonic/__tsonic_anonymous_types.g.ts"
      )
    ).to.equal(false);
  });

  it("prefers authored local structural classes over compiler-generated carrier names", () => {
    const mkdirOptionsType: IrType = {
      kind: "objectType",
      members: [
        {
          kind: "propertySignature",
          name: "recursive",
          type: { kind: "primitiveType", name: "boolean" },
          isOptional: true,
          isReadonly: false,
        },
        {
          kind: "propertySignature",
          name: "mode",
          type: { kind: "primitiveType", name: "int" },
          isOptional: true,
          isReadonly: false,
        },
      ],
    };

    const makeCarrierClass = (name: string): IrClassDeclaration => ({
      kind: "classDeclaration" as const,
      name,
      typeParameters: undefined,
      superClass: undefined,
      implements: [],
      members: [
        {
          kind: "propertyDeclaration" as const,
          name: "recursive",
          type: {
            kind: "unionType" as const,
            types: [
              { kind: "primitiveType" as const, name: "boolean" },
              { kind: "primitiveType" as const, name: "undefined" },
            ],
          },
          initializer: undefined,
          emitAsAutoProperty: true,
          isStatic: false,
          isReadonly: false,
          accessibility: "public" as const,
          isRequired: false,
        },
        {
          kind: "propertyDeclaration" as const,
          name: "mode",
          type: {
            kind: "unionType" as const,
            types: [
              { kind: "primitiveType" as const, name: "int" },
              { kind: "primitiveType" as const, name: "undefined" },
            ],
          },
          initializer: undefined,
          emitAsAutoProperty: true,
          isStatic: false,
          isReadonly: false,
          accessibility: "public" as const,
          isRequired: false,
        },
      ],
      isExported: false,
      isStruct: false,
    });

    const module: IrModule = {
      kind: "module",
      filePath: "fs.ts",
      namespace: "Test",
      className: "Fs",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        makeCarrierClass("MkdirOptionsLike__0"),
        makeCarrierClass("MkdirOptions"),
        {
          kind: "functionDeclaration",
          name: "mkdirSync",
          typeParameters: undefined,
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "path" },
              type: { kind: "primitiveType", name: "string" },
              initializer: undefined,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "options" },
              type: mkdirOptionsType,
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
    const loweredModule = lowered.modules.find((entry) => entry.filePath === "fs.ts");
    const functionDecl = loweredModule?.body.find(
      (stmt): stmt is Extract<typeof stmt, { kind: "functionDeclaration" }> =>
        stmt.kind === "functionDeclaration" && stmt.name === "mkdirSync"
    );
    const parameterType = functionDecl?.parameters[1]?.type;

    expect(parameterType?.kind).to.equal("referenceType");
    if (parameterType?.kind !== "referenceType") {
      throw new Error("Expected lowered parameter type to be a referenceType");
    }
    expect(parameterType.name).to.equal("MkdirOptions");
  });

  it("canonicalizes optional properties and explicit undefined to the same structural carrier shape", () => {
    const optionalShape: IrType = {
      kind: "objectType",
      members: [
        {
          kind: "propertySignature",
          name: "botType",
          type: { kind: "primitiveType", name: "int" },
          isOptional: true,
          isReadonly: false,
        },
      ],
    };
    const explicitUndefinedShape: IrType = {
      kind: "objectType",
      members: [
        {
          kind: "propertySignature",
          name: "botType",
          type: {
            kind: "unionType",
            types: [
              { kind: "primitiveType", name: "int" },
              { kind: "primitiveType", name: "undefined" },
            ],
          },
          isOptional: false,
          isReadonly: false,
        },
      ],
    };

    expect(computeShapeSignature(optionalShape)).to.equal(
      computeShapeSignature(explicitUndefinedShape)
    );
  });
});
