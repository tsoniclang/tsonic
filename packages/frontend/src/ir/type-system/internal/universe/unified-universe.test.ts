import { expect } from "chai";
import { buildUnifiedUniverse } from "./unified-universe.js";
import type { AssemblyTypeCatalog, TypeId, NominalEntry } from "./types.js";
import type {
  TypeRegistry,
  TypeRegistryEntry,
  MemberInfo,
} from "../type-registry.js";

const emptyAssemblyCatalog = (): AssemblyTypeCatalog => ({
  entries: new Map(),
  tsNameToTypeId: new Map(),
  clrNameToTypeId: new Map(),
  namespaceToTypeIds: new Map(),
});

const makeAssemblyTypeId = (
  stableId: string,
  clrName: string,
  assemblyName: string,
  tsName: string
): TypeId => ({
  stableId,
  clrName,
  assemblyName,
  tsName,
});

const makeRegistry = (entry: TypeRegistryEntry): TypeRegistry => ({
  resolveNominal: (fqName) =>
    fqName === entry.fullyQualifiedName ? entry : undefined,
  resolveBySimpleName: (simpleName) =>
    simpleName === entry.name ? entry : undefined,
  getFQName: (simpleName) =>
    simpleName === entry.name ? entry.fullyQualifiedName : undefined,
  getMemberType: (fqNominal, memberName) => {
    if (fqNominal !== entry.fullyQualifiedName) return undefined;
    return entry.members.get(memberName)?.type;
  },
  getHeritageTypes: (fqNominal) =>
    fqNominal === entry.fullyQualifiedName ? entry.heritage : [],
  getAllTypeNames: () => [entry.fullyQualifiedName],
  hasType: (fqName) => fqName === entry.fullyQualifiedName,
});

const optionalMember = (
  type: MemberInfo["type"],
  isOptional: boolean
): MemberInfo => ({
  kind: "property",
  name: "count",
  type,
  isOptional,
  isReadonly: false,
});

describe("buildUnifiedUniverse", () => {
  it("lifts optional source property types to include undefined", () => {
    const entry: TypeRegistryEntry = {
      kind: "interface",
      name: "Foo",
      fullyQualifiedName: "MyApp.Foo",
      ownerIdentity: "project",
      isDeclarationFile: false,
      typeParameters: [],
      members: new Map([
        [
          "count",
          optionalMember({ kind: "primitiveType", name: "int" } as const, true),
        ],
      ]),
      heritage: [],
    };

    const catalog = buildUnifiedUniverse(
      makeRegistry(entry),
      emptyAssemblyCatalog(),
      "project"
    );
    const fooId = catalog.resolveTsName("Foo");
    expect(fooId).to.not.equal(undefined);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const member = catalog.getMember(fooId!, "count");
    expect(member?.type?.kind).to.equal("unionType");
    if (member?.type?.kind === "unionType") {
      const hasUndefined = member.type.types.some(
        (t) => t.kind === "primitiveType" && t.name === "undefined"
      );
      const hasInt = member.type.types.some(
        (t) => t.kind === "primitiveType" && t.name === "int"
      );
      expect(hasUndefined).to.equal(true);
      expect(hasInt).to.equal(true);
    }
  });

  it("does not duplicate explicit undefined in optional source types", () => {
    const entry: TypeRegistryEntry = {
      kind: "interface",
      name: "Foo",
      fullyQualifiedName: "MyApp.Foo",
      ownerIdentity: "project",
      isDeclarationFile: false,
      typeParameters: [],
      members: new Map([
        [
          "count",
          optionalMember(
            {
              kind: "unionType",
              types: [
                { kind: "primitiveType", name: "int" },
                { kind: "primitiveType", name: "undefined" },
              ],
            },
            true
          ),
        ],
      ]),
      heritage: [],
    };

    const catalog = buildUnifiedUniverse(
      makeRegistry(entry),
      emptyAssemblyCatalog(),
      "project"
    );
    const fooId = catalog.resolveTsName("Foo");
    expect(fooId).to.not.equal(undefined);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const member = catalog.getMember(fooId!, "count");
    expect(member?.type?.kind).to.equal("unionType");
    if (member?.type?.kind === "unionType") {
      const undefinedCount = member.type.types.filter(
        (t) => t.kind === "primitiveType" && t.name === "undefined"
      ).length;
      expect(undefinedCount).to.equal(1);
    }
  });

  it("keeps assembly identity for declaration-file globals with matching TS names", () => {
    const entry: TypeRegistryEntry = {
      kind: "class",
      name: "Error",
      fullyQualifiedName: "Error",
      ownerIdentity: "project",
      isDeclarationFile: true,
      typeParameters: [],
      members: new Map(),
      heritage: [],
    };

    const errorTypeId = makeAssemblyTypeId(
      "js:js.Error",
      "js.Error",
      "js",
      "Error"
    );
    const assemblyEntry: NominalEntry = {
      typeId: errorTypeId,
      kind: "class",
      typeParameters: [],
      heritage: [],
      members: new Map(),
      origin: "assembly",
      accessibility: "public",
      isAbstract: false,
      isSealed: false,
      isStatic: false,
    };

    const catalog = buildUnifiedUniverse(
      makeRegistry(entry),
      {
        entries: new Map([[errorTypeId.stableId, assemblyEntry]]),
        tsNameToTypeId: new Map([[errorTypeId.tsName, errorTypeId]]),
        clrNameToTypeId: new Map([[errorTypeId.clrName, errorTypeId]]),
        namespaceToTypeIds: new Map(),
      },
      "project"
    );

    expect(catalog.resolveTsName("Error")).to.deep.equal(errorTypeId);
  });
});
