import { expect } from "chai";
import { buildUnifiedUniverse } from "./unified-universe.js";
import type { AssemblyTypeCatalog } from "./types.js";
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
    const member = catalog.getMember(fooId!, "count");
    expect(member?.type?.kind).to.equal("unionType");
    if (member?.type?.kind === "unionType") {
      const undefinedCount = member.type.types.filter(
        (t) => t.kind === "primitiveType" && t.name === "undefined"
      ).length;
      expect(undefinedCount).to.equal(1);
    }
  });
});
