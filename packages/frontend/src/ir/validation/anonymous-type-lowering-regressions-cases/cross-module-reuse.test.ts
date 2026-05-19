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
      providerQualifiedName: "Acme.Messages.__Anon_ext_deadbeef",
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
        loweredElementType.providerQualifiedName
    ).to.equal("Acme.Messages.__Anon_ext_deadbeef");
  });

  it("does not reuse anonymous binding carrier types for imported facade object shapes", () => {
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

    const lowered = runAnonymousTypeLoweringPass([consumerModule]);

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
    ).to.match(/^__Anon_/);
    expect(
      loweredElementType &&
        loweredElementType.kind === "referenceType" &&
        loweredElementType.providerQualifiedName
    ).to.equal(undefined);
  });

  it("keeps contextual named recursive aliases while lowering uncontextual inline literals to compiler-owned carriers", () => {
    const module = createTestModule(`
      type TreeNode = {
        child?: TreeNode;
        value: number;
      };

      const leaf: TreeNode = { value: 42.0 };
      const adHocLeaf = { value: 7.0 };

      export function main(): number {
        return leaf.value + adHocLeaf.value;
      }
    `);

    const lowered = runAnonymousTypeLoweringPass([module]);
    const mainModule = lowered.modules.find(
      (candidate) =>
        candidate.filePath !== "__tsonic/__tsonic_anonymous_types.g.ts"
    );
    const leafDeclaration = mainModule?.body.find(
      (
        stmt
      ): stmt is Extract<
        IrModule["body"][number],
        { kind: "variableDeclaration" }
      > => stmt.kind === "variableDeclaration"
    );
    const leafType = leafDeclaration?.declarations[0]?.type;
    const leafInitializer = leafDeclaration?.declarations[0]?.initializer;
    const adHocDeclaration = mainModule?.body.find(
      (
        stmt
      ): stmt is Extract<
        IrModule["body"][number],
        { kind: "variableDeclaration" }
      > =>
        stmt.kind === "variableDeclaration" &&
        stmt.declarations[0]?.name.kind === "identifierPattern" &&
        stmt.declarations[0]?.name.name === "adHocLeaf"
    );
    const adHocType = adHocDeclaration?.declarations[0]?.type;
    const adHocInitializer = adHocDeclaration?.declarations[0]?.initializer;
    const anonModule = lowered.modules.find(
      (candidate) =>
        candidate.filePath === "__tsonic/__tsonic_anonymous_types.g.ts"
    );

    expect(leafType?.kind).to.equal("referenceType");
    expect(
      leafType && leafType.kind === "referenceType" ? leafType.name : undefined
    ).to.equal("TreeNode");
    expect(
      leafInitializer &&
        leafInitializer.kind === "object" &&
        leafInitializer.inferredType?.kind === "referenceType"
        ? leafInitializer.inferredType.name
        : undefined
    ).to.equal("TreeNode");
    expect(anonModule).to.not.equal(undefined);
    expect(adHocType?.kind).to.equal("referenceType");
    expect(
      adHocType && adHocType.kind === "referenceType" ? adHocType.name : undefined
    ).to.match(/^__Anon_/);
    expect(
      adHocInitializer &&
        adHocInitializer.kind === "object" &&
        adHocInitializer.inferredType !== undefined &&
        adHocInitializer.inferredType.kind === "referenceType" &&
        adHocInitializer.inferredType.name
    ).to.match(/^__Anon_/);
  });
});
