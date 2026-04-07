import { describe, it } from "mocha";
import { expect } from "chai";
import type {
  IrClassDeclaration,
  IrMethodDeclaration,
  IrModule,
  IrOverloadFamilyMember,
  IrParameter,
  IrPropertyDeclaration,
  IrType,
  IrTypeParameter,
} from "../types.js";
import { runVirtualMarkingPass } from "./virtual-marking-pass.js";

const unknownType: IrType = { kind: "unknownType" };
const stringType: IrType = { kind: "primitiveType", name: "string" };
const boolType: IrType = { kind: "primitiveType", name: "boolean" };
const objectType: IrType = { kind: "referenceType", name: "object" };
const nullType: IrType = { kind: "primitiveType", name: "null" };
const nullableStringType: IrType = {
  kind: "unionType",
  types: [stringType, nullType],
};

const typeParameter = (
  name: string,
  constraint?: IrType
): IrTypeParameter => ({
  kind: "typeParameter",
  name,
  constraint,
});

const parameter = (
  name: string,
  type: IrType,
  options?: Partial<Pick<IrParameter, "isOptional" | "isRest" | "initializer">>
): IrParameter => ({
  kind: "parameter",
  pattern: { kind: "identifierPattern", name },
  type,
  initializer: options?.initializer,
  isOptional: options?.isOptional ?? false,
  isRest: options?.isRest ?? false,
  passing: "value",
});

const method = (
  name: string,
  parameters: readonly IrParameter[],
  returnType: IrType,
  options?: Partial<
    Pick<
      IrMethodDeclaration,
      | "isOverride"
      | "isShadow"
      | "isVirtual"
      | "isAsync"
      | "overloadFamily"
      | "typeParameters"
    >
  >
): IrMethodDeclaration => ({
  kind: "methodDeclaration",
  name,
  parameters,
  returnType,
  body: { kind: "blockStatement", statements: [] },
  isStatic: false,
  isAsync: options?.isAsync ?? false,
  isGenerator: false,
  accessibility: "public",
  isOverride: options?.isOverride,
  isShadow: options?.isShadow,
  isVirtual: options?.isVirtual,
  overloadFamily: options?.overloadFamily,
  typeParameters: options?.typeParameters,
});

const property = (
  name: string,
  type: IrType,
  options?: Partial<
    Pick<IrPropertyDeclaration, "isOverride" | "isShadow" | "isVirtual">
  >
): IrPropertyDeclaration => ({
  kind: "propertyDeclaration",
  name,
  type,
  isStatic: false,
  isReadonly: false,
  accessibility: "public",
  isOverride: options?.isOverride,
  isShadow: options?.isShadow,
  isVirtual: options?.isVirtual,
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

const createModule = (...body: IrClassDeclaration[]): IrModule => ({
  kind: "module",
  filePath: "/virtual-marking-pass.test.ts",
  namespace: "Test",
  className: "VirtualMarkingPassTest",
  isStaticContainer: false,
  imports: [],
  body,
  exports: [],
});

const getClass = (module: IrModule, name: string): IrClassDeclaration => {
  const stmt = module.body.find(
    (candidate): candidate is IrClassDeclaration =>
      candidate.kind === "classDeclaration" && candidate.name === name
  );
  expect(stmt, `expected class ${name}`).to.not.equal(undefined);
  return stmt!;
};

describe("virtual-marking-pass", () => {
  it("marks family-matched local methods as overrides without bridges", () => {
    const modules = [
      createModule(
        {
          kind: "classDeclaration",
          name: "Stream",
          implements: [],
          members: [
            method("write", [parameter("chunk", unknownType)], unknownType),
            method("end", [], unknownType),
          ],
          isExported: true,
          isStruct: false,
        },
        {
          kind: "classDeclaration",
          name: "Writable",
          superClass: { kind: "referenceType", name: "Stream" },
          implements: [],
          members: [
            method(
              "write_buffer",
              [parameter("chunk", unknownType)],
              unknownType,
              { overloadFamily: overloadFamily("write", 0) }
            ),
            method("end_impl", [], unknownType, {
              overloadFamily: overloadFamily("end", 0),
            }),
          ],
          isExported: true,
          isStruct: false,
        }
      ),
    ];

    const result = runVirtualMarkingPass(modules);
    const transformedModule = result.modules[0];
    if (!transformedModule) {
      throw new Error("expected transformed module");
    }
    const baseClass = getClass(transformedModule, "Stream");
    const derivedClass = getClass(transformedModule, "Writable");

    const baseWrite = baseClass.members.find(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration" && member.name === "write"
    );
    const baseEnd = baseClass.members.find(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration" && member.name === "end"
    );
    expect(baseWrite?.isVirtual).to.equal(true);
    expect(baseEnd?.isVirtual).to.equal(true);

    const overrideWrite = derivedClass.members.find(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration" &&
        member.name === "write_buffer" &&
        member.parameters.length === 1
    );
    const overrideEnd = derivedClass.members.find(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration" &&
        member.name === "end_impl" &&
        member.parameters.length === 0
    );
    expect(overrideWrite?.isOverride).to.equal(true);
    expect(overrideWrite?.returnType).to.deep.equal(unknownType);
    expect(overrideEnd?.isOverride).to.equal(true);
    expect(overrideEnd?.returnType).to.deep.equal(unknownType);
    expect(derivedClass.members).to.have.length(2);
  });

  it("marks incompatible same-name local methods as shadowing without bridges", () => {
    const modules = [
      createModule(
        {
          kind: "classDeclaration",
          name: "Base",
          implements: [],
          members: [
            method("write", [parameter("chunk", unknownType)], unknownType),
          ],
          isExported: true,
          isStruct: false,
        },
        {
          kind: "classDeclaration",
          name: "Derived",
          superClass: { kind: "referenceType", name: "Base" },
          implements: [],
          members: [
            method(
              "write",
              [
                parameter("chunk", unknownType),
                parameter("encoding", stringType),
              ],
              boolType
            ),
          ],
          isExported: true,
          isStruct: false,
        }
      ),
    ];

    const result = runVirtualMarkingPass(modules);
    const transformedModule = result.modules[0];
    if (!transformedModule) {
      throw new Error("expected transformed module");
    }
    const baseClass = getClass(transformedModule, "Base");
    const derivedClass = getClass(transformedModule, "Derived");

    const baseWrite = baseClass.members.find(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration" && member.name === "write"
    );
    expect(baseWrite?.isVirtual).to.not.equal(true);

    const writeMembers = derivedClass.members.filter(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration" && member.name === "write"
    );
    expect(writeMembers).to.have.length(1);
    expect(writeMembers[0]?.isShadow).to.equal(true);
    expect(writeMembers[0]?.isOverride).to.not.equal(true);
  });

  it("marks family-matched local properties as overrides", () => {
    const modules = [
      createModule(
        {
          kind: "classDeclaration",
          name: "Base",
          implements: [],
          members: [property("count", stringType)],
          isExported: true,
          isStruct: false,
        },
        {
          kind: "classDeclaration",
          name: "Derived",
          superClass: { kind: "referenceType", name: "Base" },
          implements: [],
          members: [property("count", stringType)],
          isExported: true,
          isStruct: false,
        }
      ),
    ];

    const result = runVirtualMarkingPass(modules);
    const transformedModule = result.modules[0];
    if (!transformedModule) {
      throw new Error("expected transformed module");
    }

    const baseClass = getClass(transformedModule, "Base");
    const derivedClass = getClass(transformedModule, "Derived");
    const baseCount = baseClass.members.find(
      (member): member is IrPropertyDeclaration =>
        member.kind === "propertyDeclaration" && member.name === "count"
    );
    const derivedCount = derivedClass.members.find(
      (member): member is IrPropertyDeclaration =>
        member.kind === "propertyDeclaration" && member.name === "count"
    );

    expect(baseCount?.isVirtual).to.equal(true);
    expect(derivedCount?.isOverride).to.equal(true);
  });

  it("marks nullable-reference property overrides with non-null derived types as overrides", () => {
    const modules = [
      createModule(
        {
          kind: "classDeclaration",
          name: "KeyObject",
          implements: [],
          members: [property("asymmetricKeyType", nullableStringType)],
          isExported: true,
          isStruct: false,
        },
        {
          kind: "classDeclaration",
          name: "PublicKeyObject",
          superClass: { kind: "referenceType", name: "KeyObject" },
          implements: [],
          members: [property("asymmetricKeyType", stringType)],
          isExported: true,
          isStruct: false,
        }
      ),
    ];

    const result = runVirtualMarkingPass(modules);
    const transformedModule = result.modules[0];
    if (!transformedModule) {
      throw new Error("expected transformed module");
    }

    const baseClass = getClass(transformedModule, "KeyObject");
    const derivedClass = getClass(transformedModule, "PublicKeyObject");
    const baseMember = baseClass.members.find(
      (member): member is IrPropertyDeclaration =>
        member.kind === "propertyDeclaration" &&
        member.name === "asymmetricKeyType"
    );
    const derivedMember = derivedClass.members.find(
      (member): member is IrPropertyDeclaration =>
        member.kind === "propertyDeclaration" &&
        member.name === "asymmetricKeyType"
    );

    expect(baseMember?.isVirtual).to.equal(true);
    expect(derivedMember?.isOverride).to.equal(true);
    expect(derivedMember?.isShadow).to.not.equal(true);
  });

  it("marks covariant generic return overrides as overrides", () => {
    const methodTypeParameter = typeParameter("U", objectType);
    const classTypeParameter = typeParameter("T", objectType);
    const functorOfU: IrType = {
      kind: "referenceType",
      name: "Functor",
      typeArguments: [{ kind: "typeParameterType", name: "U" }],
    };
    const maybeOfU: IrType = {
      kind: "referenceType",
      name: "Maybe",
      typeArguments: [{ kind: "typeParameterType", name: "U" }],
    };

    const modules = [
      createModule(
        {
          kind: "classDeclaration",
          name: "Functor",
          typeParameters: [classTypeParameter],
          implements: [],
          members: [
            method(
              "map",
              [
                parameter("fn", {
                  kind: "functionType",
                  typeParameters: [],
                  parameters: [parameter("value", { kind: "typeParameterType", name: "T" })],
                  returnType: { kind: "typeParameterType", name: "U" },
                }),
              ],
              functorOfU,
              { typeParameters: [methodTypeParameter] }
            ),
          ],
          isExported: true,
          isStruct: false,
        },
        {
          kind: "classDeclaration",
          name: "Maybe",
          typeParameters: [classTypeParameter],
          superClass: {
            kind: "referenceType",
            name: "Functor",
            typeArguments: [{ kind: "typeParameterType", name: "T" }],
          },
          implements: [],
          members: [
            method(
              "map",
              [
                parameter("fn", {
                  kind: "functionType",
                  typeParameters: [],
                  parameters: [parameter("value", { kind: "typeParameterType", name: "T" })],
                  returnType: { kind: "typeParameterType", name: "U" },
                }),
              ],
              maybeOfU,
              { typeParameters: [methodTypeParameter] }
            ),
          ],
          isExported: true,
          isStruct: false,
        }
      ),
    ];

    const result = runVirtualMarkingPass(modules);
    const transformedModule = result.modules[0];
    if (!transformedModule) {
      throw new Error("expected transformed module");
    }

    const baseClass = getClass(transformedModule, "Functor");
    const derivedClass = getClass(transformedModule, "Maybe");
    const baseMap = baseClass.members.find(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration" && member.name === "map"
    );
    const derivedMap = derivedClass.members.find(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration" && member.name === "map"
    );

    expect(baseMap?.isVirtual).to.equal(true);
    expect(derivedMap?.isOverride).to.equal(true);
    expect(derivedMap?.isShadow).to.not.equal(true);
  });
});
