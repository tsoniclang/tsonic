import { describe, it } from "mocha";
import { expect } from "chai";
import {
  type IrModule,
  type IrType,
  typeSymbolIdFromStableId,
} from "@tsonic/frontend";
import { collectStructuralInterfaceContracts } from "./local-types.js";

const intType: IrType = { kind: "primitiveType", name: "int" };

const referenceType = (
  name: string,
  providerQualifiedName: string,
  staleProviderName: string
): IrType => ({
  kind: "referenceType",
  name,
  providerQualifiedName,
  typeId: {
    stableId: `Tsts:${staleProviderName}`,
    providerName: staleProviderName,
    symbolId: typeSymbolIdFromStableId(staleProviderName),
    sourceName: name,
    ownerIdentity: "Tsts",
    origin: "source",
  },
});

const moduleWithStaleProviderName = (): IrModule =>
  ({
    kind: "module",
    filePath: "ast/generated/types.ts",
    namespace: "Tsts.ast.generated",
    className: "types",
    isStaticContainer: true,
    imports: [],
    exports: [],
    body: [
      {
        kind: "interfaceDeclaration",
        name: "TextRange",
        isExported: true,
        members: [
          {
            kind: "propertySignature",
            name: "pos",
            type: intType,
            isOptional: false,
            isReadonly: false,
          },
          {
            kind: "propertySignature",
            name: "end",
            type: intType,
            isOptional: false,
            isReadonly: false,
          },
        ],
        extends: [],
      },
      {
        kind: "interfaceDeclaration",
        name: "Node",
        isExported: true,
        members: [
          {
            kind: "methodSignature",
            name: "getSourceFile",
            parameters: [],
            returnType: { kind: "voidType" },
          },
        ],
        extends: [
          referenceType(
            "TextRange",
            "tsts.ast.generated.TextRange",
            "Tsts.core.TextRange"
          ),
        ],
      },
    ],
  }) as unknown as IrModule;

describe("local type structural interface contracts", () => {
  it("prefers source provider-qualified names over stale source type IDs", () => {
    const contracts = collectStructuralInterfaceContracts([
      moduleWithStaleProviderName(),
    ]);

    expect(contracts.has("Tsts.ast.generated::Node")).to.equal(true);
    expect(contracts.has("Tsts.ast.generated::TextRange")).to.equal(true);
    expect(contracts.has("Tsts.core::TextRange")).to.equal(false);
  });
});
