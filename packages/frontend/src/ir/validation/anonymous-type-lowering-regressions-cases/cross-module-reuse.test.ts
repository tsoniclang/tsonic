import { describe, it } from "mocha";
import { expect } from "chai";
import { runAnonymousTypeLoweringPass, validateIrSoundness } from "../index.js";
import type { IrModule, IrReferenceType } from "../../types.js";
import { createTestModule } from "./test-helpers.js";

describe("Anonymous Type Lowering Regression Coverage (cross-module reuse)", () => {
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

  it("keeps synthesized anonymous carriers internal when they only reference internal aliases", () => {
    const module = createTestModule(`
      type TreeNode = {
        child?: TreeNode;
        value: number;
      };

      const leaf: TreeNode = { value: 42.0 };

      export function main(): number {
        return leaf.value;
      }
    `);

    const lowered = runAnonymousTypeLoweringPass([module]);
    const anonModule = lowered.modules.find(
      (candidate) =>
        candidate.filePath === "__tsonic/__tsonic_anonymous_types.g.ts"
    );
    const anonClass = anonModule?.body.find(
      (
        stmt
      ): stmt is Extract<
        IrModule["body"][number],
        { kind: "classDeclaration" }
      > => stmt.kind === "classDeclaration"
    );

    expect(anonClass?.name).to.match(/^__Anon_/);
    expect(anonClass?.isExported).to.equal(false);
  });
});
