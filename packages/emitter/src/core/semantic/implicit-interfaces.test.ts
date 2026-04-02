import { describe, it } from "mocha";
import { expect } from "chai";
import type {
  IrMethodDeclaration,
  IrMethodSignature,
  IrOverloadFamilyMember,
  IrParameter,
  IrType,
} from "@tsonic/frontend";
import type {
  EmitterContext,
  EmitterOptions,
  LocalTypeInfo,
} from "../../types.js";
import {
  inferImplicitImplementedInterfaces,
  resolveCompatibleImplementedInterfaces,
} from "./implicit-interfaces.js";

const numberType: IrType = { kind: "primitiveType", name: "number" };
const stringType: IrType = { kind: "primitiveType", name: "string" };
const voidType: IrType = { kind: "voidType" };

const defaultOptions: EmitterOptions = {
  rootNamespace: "Test",
  indent: 2,
};

const createContext = (
  localTypes: ReadonlyMap<string, LocalTypeInfo>
): EmitterContext => ({
  indentLevel: 0,
  options: defaultOptions,
  isStatic: false,
  isAsync: false,
  localTypes,
  usings: new Set<string>(),
});

const parameter = (name: string, type: IrType): IrParameter => ({
  kind: "parameter",
  pattern: { kind: "identifierPattern", name },
  type,
  isOptional: false,
  isRest: false,
  passing: "value",
});

const overloadFamily = (
  publicName: string,
  publicSignatureIndex: number
): IrOverloadFamilyMember => ({
  familyId: `method:instance:${publicName}`,
  memberId: `method:instance:${publicName}:public:${publicSignatureIndex}`,
  ownerKind: "method",
  publicName,
  isStatic: false,
  publicSignatureCount: 2,
  publicSignatureIndex,
});

const methodSignature = (
  name: string,
  parameters: readonly IrParameter[],
  returnType: IrType,
  family?: IrOverloadFamilyMember
): IrMethodSignature => ({
  kind: "methodSignature",
  name,
  parameters,
  returnType,
  ...(family ? { overloadFamily: family } : {}),
});

const methodDeclaration = (
  name: string,
  parameters: readonly IrParameter[],
  returnType: IrType,
  family?: IrOverloadFamilyMember
): IrMethodDeclaration => ({
  kind: "methodDeclaration",
  name,
  parameters,
  returnType,
  body: { kind: "blockStatement", statements: [] },
  isStatic: false,
  isAsync: false,
  isGenerator: false,
  accessibility: "public",
  ...(family ? { overloadFamily: family } : {}),
});

describe("implicit-interfaces", () => {
  it("matches explicit interface overloads by emitted family name", () => {
    const parseStringFamily = overloadFamily("parse", 0);
    const parseNumberFamily = overloadFamily("parse", 1);
    const localTypes = new Map<string, LocalTypeInfo>([
      [
        "IParser",
        {
          kind: "interface",
          typeParameters: [],
          members: [
            methodSignature(
              "parse_string",
              [parameter("value", stringType)],
              stringType,
              parseStringFamily
            ),
            methodSignature(
              "parse_number",
              [parameter("value", numberType)],
              stringType,
              parseNumberFamily
            ),
          ],
          extends: [],
        },
      ],
      [
        "Parser",
        {
          kind: "class",
          typeParameters: [],
          members: [
            methodDeclaration(
              "parse_text",
              [parameter("value", stringType)],
              stringType,
              parseStringFamily
            ),
            methodDeclaration(
              "parse_int",
              [parameter("value", numberType)],
              stringType,
              parseNumberFamily
            ),
          ],
          implements: [{ kind: "referenceType", name: "IParser" }],
        },
      ],
    ]);

    const matches = resolveCompatibleImplementedInterfaces(
      "Parser",
      [{ kind: "referenceType", name: "IParser" }],
      createContext(localTypes)
    );

    expect(matches).to.have.length(1);
    expect(matches[0]?.isExplicit).to.equal(true);
    expect(
      matches[0]?.methodMatches.map((match) => match.classMember.name)
    ).to.deep.equal(["parse_text", "parse_int"]);
  });

  it("does not reuse one class member for multiple interface overloads", () => {
    const parseStringFamily = overloadFamily("parse", 0);
    const parseNumberFamily = overloadFamily("parse", 1);
    const localTypes = new Map<string, LocalTypeInfo>([
      [
        "IParser",
        {
          kind: "interface",
          typeParameters: [],
          members: [
            methodSignature(
              "parse_string",
              [parameter("value", stringType)],
              stringType,
              parseStringFamily
            ),
            methodSignature(
              "parse_number",
              [parameter("value", numberType)],
              stringType,
              parseNumberFamily
            ),
          ],
          extends: [],
        },
      ],
      [
        "Parser",
        {
          kind: "class",
          typeParameters: [],
          members: [
            methodDeclaration(
              "parse_text",
              [parameter("value", stringType)],
              stringType,
              parseStringFamily
            ),
          ],
          implements: [{ kind: "referenceType", name: "IParser" }],
        },
      ],
    ]);

    const matches = resolveCompatibleImplementedInterfaces(
      "Parser",
      [{ kind: "referenceType", name: "IParser" }],
      createContext(localTypes)
    );

    expect(matches).to.deep.equal([]);
  });

  it("infers implicit interfaces through overload family names", () => {
    const family = overloadFamily("parse", 0);
    const localTypes = new Map<string, LocalTypeInfo>([
      [
        "IParser",
        {
          kind: "interface",
          typeParameters: [],
          members: [
            methodSignature(
              "parse_string",
              [parameter("value", stringType)],
              stringType,
              family
            ),
          ],
          extends: [],
        },
      ],
      [
        "Parser",
        {
          kind: "class",
          typeParameters: [],
          members: [
            methodDeclaration(
              "parse_text",
              [parameter("value", stringType)],
              stringType,
              family
            ),
          ],
          implements: [],
        },
      ],
    ]);

    const inferred = inferImplicitImplementedInterfaces(
      "Parser",
      [],
      createContext(localTypes)
    );

    expect(inferred).to.deep.equal([
      {
        kind: "referenceType",
        name: "IParser",
        resolvedClrType: "Test.IParser",
      },
    ]);
  });

  it("requires exact signatures for explicit interface compatibility", () => {
    const family = overloadFamily("close", 0);
    const localTypes = new Map<string, LocalTypeInfo>([
      [
        "IClosable",
        {
          kind: "interface",
          typeParameters: [],
          members: [
            methodSignature("close", [], voidType, family),
          ],
          extends: [],
        },
      ],
      [
        "Closable",
        {
          kind: "class",
          typeParameters: [],
          members: [
            methodDeclaration("close_impl", [], stringType, family),
          ],
          implements: [{ kind: "referenceType", name: "IClosable" }],
        },
      ],
    ]);

    const matches = resolveCompatibleImplementedInterfaces(
      "Closable",
      [{ kind: "referenceType", name: "IClosable" }],
      createContext(localTypes)
    );

    expect(matches).to.deep.equal([]);
  });
});
