/**
 * Virtual Marking Pass
 *
 * For each method with isOverride=true in derived classes,
 * finds and marks the corresponding base class method with isVirtual=true.
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

  for (const classDecl of classRegistry.values()) {
    for (const member of classDecl.members) {
      if (
        member.kind === "methodDeclaration" &&
        member.isOverride &&
        !member.isStatic
      ) {
        // Find base class
        if (classDecl.superClass?.kind === "identifier") {
          const baseClassName = classDecl.superClass.name;
          virtualMethods.add(`${baseClassName}.${member.name}`);
        }
      }
    }
  }

  // Transform modules to mark virtual methods
  const transformedModules = modules.map((module) => ({
    ...module,
    body: module.body.map((stmt) => transformStatement(stmt, virtualMethods)),
    exports: module.exports.map((exp) =>
      exp.kind === "declaration"
        ? {
            ...exp,
            declaration: transformStatement(
              exp.declaration,
              virtualMethods
            ) as IrStatement,
          }
        : exp
    ),
  }));

  return { ok: true, modules: transformedModules };
};

const transformStatement = (
  stmt: IrStatement,
  virtualMethods: Set<string>
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

  return { ...stmt, members: transformedMembers };
};
