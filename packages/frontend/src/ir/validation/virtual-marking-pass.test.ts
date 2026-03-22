import { describe, it } from "mocha";
import { expect } from "chai";
import type {
  IrClassDeclaration,
  IrMethodDeclaration,
  IrModule,
  IrParameter,
  IrType,
} from "../types.js";
import { runVirtualMarkingPass } from "./virtual-marking-pass.js";

const unknownType: IrType = { kind: "unknownType" };
const stringType: IrType = { kind: "primitiveType", name: "string" };
const boolType: IrType = { kind: "primitiveType", name: "boolean" };
const voidType: IrType = { kind: "voidType" };

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
    Pick<IrMethodDeclaration, "isOverride" | "isShadow" | "isVirtual" | "isAsync">
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
  it("synthesizes override bridges for widened derived methods", () => {
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
              "write",
              [
                parameter("chunk", unknownType),
                parameter("encoding", stringType, {
                  isOptional: true,
                  initializer: { kind: "literal", value: null, raw: "null" },
                }),
                parameter("callback", unknownType, {
                  isOptional: true,
                  initializer: { kind: "literal", value: null, raw: "null" },
                }),
              ],
              boolType
            ),
            method(
              "end",
              [
                parameter("chunk", unknownType, {
                  isOptional: true,
                  initializer: { kind: "literal", value: null, raw: "null" },
                }),
                parameter("encoding", stringType, {
                  isOptional: true,
                  initializer: { kind: "literal", value: null, raw: "null" },
                }),
                parameter("callback", unknownType, {
                  isOptional: true,
                  initializer: { kind: "literal", value: null, raw: "null" },
                }),
              ],
              voidType
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

    const shadowedWrite = derivedClass.members.find(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration" &&
        member.name === "write" &&
        member.parameters.length === 3
    );
    const shadowedEnd = derivedClass.members.find(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration" &&
        member.name === "end" &&
        member.parameters.length === 3
    );
    expect(shadowedWrite?.isShadow).to.equal(true);
    expect(shadowedEnd?.isShadow).to.equal(true);

    const overrideWrite = derivedClass.members.find(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration" &&
        member.name === "write" &&
        member.parameters.length === 1
    );
    const overrideEnd = derivedClass.members.find(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration" &&
        member.name === "end" &&
        member.parameters.length === 0
    );
    expect(overrideWrite?.isOverride).to.equal(true);
    expect(overrideWrite?.returnType).to.deep.equal(unknownType);
    expect(overrideEnd?.isOverride).to.equal(true);
    expect(overrideEnd?.returnType).to.deep.equal(unknownType);
  });

  it("does not synthesize bridges when derived trailing parameters are required", () => {
    const modules = [
      createModule(
        {
          kind: "classDeclaration",
          name: "Base",
          implements: [],
          members: [method("write", [parameter("chunk", unknownType)], unknownType)],
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
    expect(writeMembers[0]?.isOverride).to.not.equal(true);
  });
});
