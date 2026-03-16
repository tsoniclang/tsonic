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
import type { IrModule, IrReferenceType, IrType } from "../types.js";

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

  it("reuses imported anonymous reference types discovered from source-package signatures", () => {
    const externalAnonymousType: IrReferenceType = {
      kind: "referenceType",
      name: "__Anon_ext_deadbeef",
      resolvedClrType: "Acme.Messages.__Anon_ext_deadbeef",
      structuralMembers: [
        {
          kind: "propertySignature",
          name: "type",
          type: { kind: "primitiveType", name: "string" },
          isOptional: false,
          isReadonly: false,
        },
        {
          kind: "propertySignature",
          name: "to",
          type: { kind: "primitiveType", name: "string" },
          isOptional: false,
          isReadonly: false,
        },
        {
          kind: "propertySignature",
          name: "topic",
          type: { kind: "primitiveType", name: "string" },
          isOptional: true,
          isReadonly: false,
        },
        {
          kind: "propertySignature",
          name: "content",
          type: { kind: "primitiveType", name: "string" },
          isOptional: false,
          isReadonly: false,
        },
      ],
    };

    const importedModule: IrModule = {
      kind: "module",
      filePath: "messages.ts",
      namespace: "Acme.Messages",
      className: "Messages",
      isStaticContainer: true,
      imports: [],
      exports: [],
      body: [
        {
          kind: "functionDeclaration",
          name: "createDraftsDomain",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "drafts" },
              type: {
                kind: "arrayType",
                elementType: externalAnonymousType,
              },
              initializer: undefined,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "primitiveType", name: "string" },
          body: { kind: "blockStatement", statements: [] },
          isAsync: false,
          isGenerator: false,
          isExported: true,
        },
      ],
    };

    const consumerModule: IrModule = {
      kind: "module",
      filePath: "app.ts",
      namespace: "Acme.App",
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
              name: { kind: "identifierPattern", name: "drafts" },
              type: {
                kind: "arrayType",
                elementType: {
                  kind: "objectType",
                  members: [
                    {
                      kind: "propertySignature",
                      name: "type",
                      type: { kind: "primitiveType", name: "string" },
                      isOptional: false,
                      isReadonly: false,
                    },
                    {
                      kind: "propertySignature",
                      name: "to",
                      type: { kind: "primitiveType", name: "string" },
                      isOptional: false,
                      isReadonly: false,
                    },
                    {
                      kind: "propertySignature",
                      name: "topic",
                      type: { kind: "primitiveType", name: "string" },
                      isOptional: true,
                      isReadonly: false,
                    },
                    {
                      kind: "propertySignature",
                      name: "content",
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

    const lowered = runAnonymousTypeLoweringPass([
      importedModule,
      consumerModule,
    ]);
    const soundness = validateIrSoundness(lowered.modules);

    expect(soundness.diagnostics.some((d) => d.code === "TSN7421")).to.equal(
      false
    );

    const loweredConsumerModule = lowered.modules.find(
      (module) => module.namespace === "Acme.App"
    );
    const consumerVariable = loweredConsumerModule?.body.find(
      (
        stmt
      ): stmt is Extract<
        IrModule["body"][number],
        { kind: "variableDeclaration" }
      > => stmt.kind === "variableDeclaration"
    );
    const loweredType = consumerVariable?.declarations[0]?.type;

    expect(loweredType?.kind).to.equal("arrayType");
    const loweredElementType =
      loweredType?.kind === "arrayType" ? loweredType.elementType : undefined;
    expect(loweredElementType?.kind).to.equal("referenceType");
    expect(
      loweredElementType &&
        loweredElementType.kind === "referenceType" &&
        loweredElementType.name
    ).to.equal("__Anon_ext_deadbeef");
    expect(
      loweredElementType &&
        loweredElementType.kind === "referenceType" &&
        loweredElementType.resolvedClrType
    ).to.equal("Acme.Messages.__Anon_ext_deadbeef");
  });

  it("reuses anonymous binding carrier types for imported facade object shapes", () => {
    const consumerModule: IrModule = {
      kind: "module",
      filePath: "app.ts",
      namespace: "Acme.App",
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
              name: { kind: "identifierPattern", name: "drafts" },
              type: {
                kind: "arrayType",
                elementType: {
                  kind: "objectType",
                  members: [
                    {
                      kind: "propertySignature",
                      name: "type",
                      type: { kind: "primitiveType", name: "string" },
                      isOptional: false,
                      isReadonly: false,
                    },
                    {
                      kind: "propertySignature",
                      name: "to",
                      type: { kind: "primitiveType", name: "string" },
                      isOptional: false,
                      isReadonly: false,
                    },
                    {
                      kind: "propertySignature",
                      name: "topic",
                      type: { kind: "primitiveType", name: "string" },
                      isOptional: true,
                      isReadonly: false,
                    },
                    {
                      kind: "propertySignature",
                      name: "content",
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

    const lowered = runAnonymousTypeLoweringPass([consumerModule], {
      bindings: new Map([
        [
          "__Anon_ext_deadbeef",
          {
            alias: "__Anon_ext_deadbeef",
            name: "Acme.Messages.__Anon_ext_deadbeef",
            kind: "class",
            members: [
              {
                kind: "property",
                name: "type",
                alias: "type",
                semanticType: { kind: "primitiveType", name: "string" },
                binding: {
                  assembly: "Acme.Messages",
                  type: "Acme.Messages.__Anon_ext_deadbeef",
                  member: "type",
                },
              },
              {
                kind: "property",
                name: "to",
                alias: "to",
                semanticType: { kind: "primitiveType", name: "string" },
                binding: {
                  assembly: "Acme.Messages",
                  type: "Acme.Messages.__Anon_ext_deadbeef",
                  member: "to",
                },
              },
              {
                kind: "property",
                name: "topic",
                alias: "topic",
                semanticType: { kind: "primitiveType", name: "string" },
                semanticOptional: true,
                binding: {
                  assembly: "Acme.Messages",
                  type: "Acme.Messages.__Anon_ext_deadbeef",
                  member: "topic",
                },
              },
              {
                kind: "property",
                name: "content",
                alias: "content",
                semanticType: { kind: "primitiveType", name: "string" },
                binding: {
                  assembly: "Acme.Messages",
                  type: "Acme.Messages.__Anon_ext_deadbeef",
                  member: "content",
                },
              },
            ],
          },
        ],
      ]),
    });

    const loweredConsumerModule = lowered.modules.find(
      (module) =>
        module.namespace === "Acme.App" && module.filePath === "app.ts"
    );
    const consumerVariable = loweredConsumerModule?.body.find(
      (
        stmt
      ): stmt is Extract<
        IrModule["body"][number],
        { kind: "variableDeclaration" }
      > => stmt.kind === "variableDeclaration"
    );
    const loweredType = consumerVariable?.declarations[0]?.type;

    expect(loweredType?.kind).to.equal("arrayType");
    const loweredElementType =
      loweredType?.kind === "arrayType" ? loweredType.elementType : undefined;
    expect(loweredElementType?.kind).to.equal("referenceType");
    expect(
      loweredElementType &&
        loweredElementType.kind === "referenceType" &&
        loweredElementType.name
    ).to.equal("__Anon_ext_deadbeef");
    expect(
      loweredElementType &&
        loweredElementType.kind === "referenceType" &&
        loweredElementType.resolvedClrType
    ).to.equal("Acme.Messages.__Anon_ext_deadbeef");
  });
});
