import {
  memberSymbolIdFromStableId,
  moduleSymbolIdFromStableId,
  TargetSymbolRegistry,
  typeSymbolIdFromStableId,
  type TargetSurfaceArtifacts,
  type TypeSymbolId,
} from "../symbols/index.js";
import type { BindingRegistry } from "./binding-registry.js";
import type { MemberBinding, TypeBinding } from "./binding-types.js";

const typeOwnerIdentity = (type: TypeBinding): string => {
  for (const member of type.members) {
    return member.binding.ownerIdentity;
  }

  return "external-surface";
};

const typeSymbolFor = (
  registry: TargetSymbolRegistry,
  ownerIdentity: string,
  qualifiedName: string,
  sourceName: string,
  providerStableId?: string
): TypeSymbolId => {
  const stableId = providerStableId ?? `${ownerIdentity}:${qualifiedName}`;
  const symbolId = typeSymbolIdFromStableId(stableId);
  registry.addType(
    {
      symbolId,
      stableId,
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
  const stableId =
    member.stableId ??
    `${member.binding.ownerIdentity}:${member.binding.type}.${member.binding.member}`;
  const symbolId = memberSymbolIdFromStableId(stableId);
  registry.addMember(
    {
      symbolId,
      ownerTypeSymbolId,
      stableId,
      sourceName: member.alias,
      ownerIdentity: member.binding.ownerIdentity,
      origin: "externalSurface",
    },
    {
      symbolId,
      ownerTypeSymbolId,
      ownerQualifiedName: member.binding.type,
      memberName: member.binding.member,
      ownerIdentity: member.binding.ownerIdentity,
    }
  );
};

export const createTargetSurfaceArtifactsFromBindings = (
  bindings: BindingRegistry
): TargetSurfaceArtifacts => {
  const registry = new TargetSymbolRegistry();

  for (const [, descriptor] of bindings.getAllBindings()) {
    const ownerIdentity = descriptor.ownerIdentity;
    const typeName = descriptor.staticType ?? descriptor.type;
    const typeSymbolId = typeSymbolFor(
      registry,
      ownerIdentity,
      typeName,
      descriptor.type
    );

    if (descriptor.kind === "module") {
      const stableId = `${ownerIdentity}:${descriptor.type}`;
      const symbolId = moduleSymbolIdFromStableId(stableId);
      registry.addModule(
        {
          symbolId,
          stableId,
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

    if (descriptor.providerMemberName) {
      const stableId = `${ownerIdentity}:${typeName}.${descriptor.providerMemberName}`;
      const memberSymbolId = memberSymbolIdFromStableId(stableId);
      registry.addMember(
        {
          symbolId: memberSymbolId,
          ownerTypeSymbolId: typeSymbolId,
          stableId,
          sourceName: descriptor.providerMemberName,
          ownerIdentity,
          origin: "externalSurface",
        },
        {
          symbolId: memberSymbolId,
          ownerTypeSymbolId: typeSymbolId,
          ownerQualifiedName: typeName,
          memberName: descriptor.providerMemberName,
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
        type.alias,
        type.stableId
      );
      for (const member of type.members) {
        addMemberBinding(registry, ownerTypeSymbolId, member);
      }
    }
  }

  for (const [
    namespace,
    exportName,
    descriptor,
  ] of bindings.getAllTsbindgenExports()) {
    const ownerTypeSymbolId = typeSymbolFor(
      registry,
      descriptor.ownerIdentity,
      descriptor.ownerQualifiedName,
      namespace
    );
    const stableId =
      descriptor.stableId ??
      `${descriptor.ownerIdentity}:${descriptor.ownerQualifiedName}.${descriptor.targetName}`;
    const symbolId = memberSymbolIdFromStableId(stableId);
    registry.addMember(
      {
        symbolId,
        ownerTypeSymbolId,
        stableId,
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
