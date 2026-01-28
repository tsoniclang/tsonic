/**
 * Virtual Marking Pass
 *
 * For each method/property with isOverride=true in derived classes,
 * finds and marks the corresponding base class member with isVirtual=true.
 */

import {
  IrModule,
  IrClassDeclaration,
  IrStatement,
  IrClassMember,
} from "../types.js";

export type VirtualMarkingResult = {
  readonly ok: true;
  readonly modules: readonly IrModule[];
};

/**
 * Run virtual marking pass on all modules.
 */
export const runVirtualMarkingPass = (
  modules: readonly IrModule[]
): VirtualMarkingResult => {
  // Build class registry: name -> class declaration
  const classRegistry = new Map<string, IrClassDeclaration>();

  for (const module of modules) {
    for (const stmt of module.body) {
      if (stmt.kind === "classDeclaration") {
        classRegistry.set(stmt.name, stmt);
      }
    }
    for (const exp of module.exports) {
      if (
        exp.kind === "declaration" &&
        exp.declaration.kind === "classDeclaration"
      ) {
        classRegistry.set(exp.declaration.name, exp.declaration);
      }
    }
  }

  // Find all override methods and mark their base methods as virtual
  const virtualMethods = new Set<string>(); // "ClassName.methodName"
  const virtualProperties = new Set<string>(); // "ClassName.propertyName"

  const normalizeBaseClassName = (raw: string): string => {
    // `Functor<T>` → `Functor`
    const withoutTypeArgs = raw.split("<")[0] ?? raw;
    // `Namespace.Functor` → `Functor`
    const simple = withoutTypeArgs.split(".").pop() ?? withoutTypeArgs;
    return simple.trim();
  };

  for (const classDecl of classRegistry.values()) {
    for (const member of classDecl.members) {
      if (
        member.kind === "methodDeclaration" &&
        member.isOverride &&
        !member.isStatic
      ) {
        // Find base class
        if (classDecl.superClass?.kind === "referenceType") {
          const baseClassName = normalizeBaseClassName(
            classDecl.superClass.name
          );
          virtualMethods.add(`${baseClassName}.${member.name}`);
        }
      }

      if (
        member.kind === "propertyDeclaration" &&
        member.isOverride &&
        !member.isStatic
      ) {
        if (classDecl.superClass?.kind === "referenceType") {
          const baseClassName = normalizeBaseClassName(
            classDecl.superClass.name
          );
          virtualProperties.add(`${baseClassName}.${member.name}`);
        }
      }
    }
  }

  // Transform modules to mark virtual methods
  const transformedModules = modules.map((module) => ({
    ...module,
    body: module.body.map((stmt) =>
      transformStatement(stmt, virtualMethods, virtualProperties)
    ),
    exports: module.exports.map((exp) =>
      exp.kind === "declaration"
        ? {
            ...exp,
            declaration: transformStatement(
              exp.declaration,
              virtualMethods,
              virtualProperties
            ) as IrStatement,
          }
        : exp
    ),
  }));

  return { ok: true, modules: transformedModules };
};

const transformStatement = (
  stmt: IrStatement,
  virtualMethods: Set<string>,
  virtualProperties: Set<string>
): IrStatement => {
  if (stmt.kind !== "classDeclaration") return stmt;

  const transformedMembers = stmt.members.map((member): IrClassMember => {
    if (member.kind !== "methodDeclaration") return member;
    if (member.isStatic || member.isOverride) return member;

    const key = `${stmt.name}.${member.name}`;
    if (virtualMethods.has(key)) {
      return { ...member, isVirtual: true };
    }
    return member;
  });

  const transformedMembersWithProps = transformedMembers.map(
    (member): IrClassMember => {
      if (member.kind !== "propertyDeclaration") return member;
      if (member.isStatic || member.isOverride) return member;

      const key = `${stmt.name}.${member.name}`;
      if (virtualProperties.has(key)) {
        return { ...member, isVirtual: true };
      }
      return member;
    }
  );

  return { ...stmt, members: transformedMembersWithProps };
};
