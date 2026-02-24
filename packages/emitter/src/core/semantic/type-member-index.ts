import type { IrModule, IrInterfaceMember } from "@tsonic/frontend";
import type { TypeMemberIndex, TypeMemberKind } from "../../emitter-types/core.js";

const setMemberKind = (
  map: Map<string, TypeMemberKind>,
  memberName: string,
  kind: TypeMemberKind
): void => {
  map.set(memberName, kind);
};

export const buildTypeMemberIndex = (
  modules: readonly IrModule[]
): TypeMemberIndex => {
  const index = new Map<string, Map<string, TypeMemberKind>>();

  const indexInterfaceMembers = (
    typeFqn: string,
    members: readonly IrInterfaceMember[]
  ): void => {
    const map = index.get(typeFqn) ?? new Map<string, TypeMemberKind>();

    for (const member of members) {
      if (member.kind === "methodSignature") {
        setMemberKind(map, member.name, "method");
      } else {
        // propertySignature
        setMemberKind(map, member.name, "property");
      }
    }

    index.set(typeFqn, map);
  };

  for (const module of modules) {
    const ns = module.namespace;

    for (const stmt of module.body) {
      const typeFqnBase = `${ns}.`;

      if (stmt.kind === "classDeclaration") {
        const typeFqn = `${typeFqnBase}${stmt.name}`;
        const map = index.get(typeFqn) ?? new Map<string, TypeMemberKind>();

        for (const member of stmt.members) {
          if (member.kind === "methodDeclaration") {
            setMemberKind(map, member.name, "method");
          } else if (member.kind === "propertyDeclaration") {
            const hasAccessors = !!(member.getterBody || member.setterBody);
            setMemberKind(
              map,
              member.name,
              hasAccessors ? "property" : "field"
            );
          }
        }

        index.set(typeFqn, map);
        continue;
      }

      if (stmt.kind === "interfaceDeclaration") {
        const typeFqn = `${typeFqnBase}${stmt.name}`;
        indexInterfaceMembers(typeFqn, stmt.members);
        continue;
      }

      if (stmt.kind === "enumDeclaration") {
        const typeFqn = `${typeFqnBase}${stmt.name}`;
        const map = index.get(typeFqn) ?? new Map<string, TypeMemberKind>();
        for (const member of stmt.members) {
          setMemberKind(map, member.name, "enumMember");
        }
        index.set(typeFqn, map);
        continue;
      }

      if (stmt.kind === "typeAliasDeclaration") {
        if (stmt.type.kind !== "objectType") continue;
        const typeFqn = `${typeFqnBase}${stmt.name}__Alias`;
        indexInterfaceMembers(typeFqn, stmt.type.members);
      }
    }
  }

  return index;
};
