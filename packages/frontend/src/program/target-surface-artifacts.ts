import {
  createMemberSymbolId,
  createModuleSymbolId,
  createTypeSymbolId,
  TargetSymbolRegistry,
  type TargetSurfaceArtifacts,
  type TypeSymbolId,
} from "../symbols/index.js";
import type { BindingRegistry } from "./binding-registry.js";
import type { MemberBinding, TypeBinding } from "./binding-types.js";

const typeOwnerIdentity = (type: TypeBinding): string => {
  for (const member of type.members) {
    return member.binding.assembly;
  }

  return "external-surface";
};

const typeSymbolFor = (
  registry: TargetSymbolRegistry,
  ownerIdentity: string,
  qualifiedName: string,
  sourceName: string
): TypeSymbolId => {
  const symbolId = createTypeSymbolId(ownerIdentity, qualifiedName);
  registry.addType(
    {
      symbolId,
      stableId: `${ownerIdentity}:${qualifiedName}`,
      sourceName,
      ownerIdentity,
      origin: "externalSurface",
    },
    {
      symbolId,
      qualifiedName,
      ownerIdentity,
    }
  );
  return symbolId;
};

const addMemberBinding = (
  registry: TargetSymbolRegistry,
  ownerTypeSymbolId: TypeSymbolId | undefined,
  member: MemberBinding
): void => {
  const symbolId = createMemberSymbolId(
    member.binding.assembly,
    member.binding.type,
    member.binding.member
  );
  registry.addMember(
    {
      symbolId,
      ownerTypeSymbolId,
      stableId: `${member.binding.assembly}:${member.binding.type}.${member.binding.member}`,
      sourceName: member.alias,
      ownerIdentity: member.binding.assembly,
      origin: "externalSurface",
    },
    {
      symbolId,
      ownerTypeSymbolId,
      ownerQualifiedName: member.binding.type,
      memberName: member.binding.member,
      ownerIdentity: member.binding.assembly,
    }
  );
};

export const createTargetSurfaceArtifactsFromBindings = (
  bindings: BindingRegistry
): TargetSurfaceArtifacts => {
  const registry = new TargetSymbolRegistry();

  for (const [, descriptor] of bindings.getAllBindings()) {
    const ownerIdentity = descriptor.assembly;
    const typeName = descriptor.staticType ?? descriptor.type;
    const typeSymbolId = typeSymbolFor(
      registry,
      ownerIdentity,
      typeName,
      descriptor.type
    );

    if (descriptor.kind === "module") {
      const symbolId = createModuleSymbolId(ownerIdentity, descriptor.type);
      registry.addModule(
        {
          symbolId,
          stableId: `${ownerIdentity}:${descriptor.type}`,
          sourceName: descriptor.type,
          ownerIdentity,
          origin: "externalSurface",
        },
        {
          symbolId,
          qualifiedName: descriptor.type,
          ownerIdentity,
        }
      );
    }

    if (descriptor.targetMemberName) {
      const memberSymbolId = createMemberSymbolId(
        ownerIdentity,
        typeName,
        descriptor.targetMemberName
      );
      registry.addMember(
        {
          symbolId: memberSymbolId,
          ownerTypeSymbolId: typeSymbolId,
          stableId: `${ownerIdentity}:${typeName}.${descriptor.targetMemberName}`,
          sourceName: descriptor.targetMemberName,
          ownerIdentity,
          origin: "externalSurface",
        },
        {
          symbolId: memberSymbolId,
          ownerTypeSymbolId: typeSymbolId,
          ownerQualifiedName: typeName,
          memberName: descriptor.targetMemberName,
          ownerIdentity,
        }
      );
    }
  }

  for (const namespaceBinding of bindings.getAllNamespaces()) {
    for (const type of namespaceBinding.types) {
      const ownerIdentity = typeOwnerIdentity(type);
      const ownerTypeSymbolId = typeSymbolFor(
        registry,
        ownerIdentity,
        type.name,
        type.alias
      );
      for (const member of type.members) {
        addMemberBinding(registry, ownerTypeSymbolId, member);
      }
    }
  }

  for (const [namespace, exportName, descriptor] of bindings.getAllTsbindgenExports()) {
    const ownerTypeSymbolId = typeSymbolFor(
      registry,
      descriptor.ownerIdentity,
      descriptor.ownerQualifiedName,
      namespace
    );
    const symbolId = createMemberSymbolId(
      descriptor.ownerIdentity,
      descriptor.ownerQualifiedName,
      descriptor.targetName
    );
    registry.addMember(
      {
        symbolId,
        ownerTypeSymbolId,
        stableId: `${descriptor.ownerIdentity}:${descriptor.ownerQualifiedName}.${descriptor.targetName}`,
        sourceName: exportName,
        ownerIdentity: descriptor.ownerIdentity,
        origin: "externalSurface",
      },
      {
        symbolId,
        ownerTypeSymbolId,
        ownerQualifiedName: descriptor.ownerQualifiedName,
        memberName: descriptor.targetName,
        ownerIdentity: descriptor.ownerIdentity,
      }
    );
  }

  return registry.artifacts();
};
