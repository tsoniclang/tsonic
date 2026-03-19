/**
 * Char Validation — Type resolution and char type detection helpers.
 *
 * Contains CharValidationContext, type alias resolution, char type detection,
 * module-level validation orchestration, and the main runCharValidationPass entry point.
 */

import {
  createDiagnostic,
  Diagnostic,
  SourceLocation,
} from "../../types/diagnostic.js";
import {
  IrModule,
  IrStatement,
  IrType,
  IrTypeAliasDeclaration,
  IrExpression,
} from "../types.js";
import {
  validateExpression,
  validateStatement,
} from "./char-validation-expressions.js";

export type CharValidationResult = {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
  readonly diagnostics: readonly Diagnostic[];
};

export type CharValidationContext = {
  readonly filePath: string;
  readonly diagnostics: Diagnostic[];
  readonly typeAliases: ReadonlyMap<string, IrTypeAliasDeclaration>;
};

export const moduleLocation = (ctx: CharValidationContext): SourceLocation => ({
  file: ctx.filePath,
  line: 1,
  column: 1,
  length: 1,
});

export const stripNullish = (type: IrType | undefined): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind !== "unionType") return type;
  const nonNullish = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );
  if (nonNullish.length === 0) return undefined;
  if (nonNullish.length === 1) return nonNullish[0];
  return { kind: "unionType", types: nonNullish };
};

export const resolveTypeAliases = (
  type: IrType | undefined,
  ctx: CharValidationContext,
  seen: ReadonlySet<string> = new Set()
): IrType | undefined => {
  if (!type) return undefined;

  if (type.kind === "referenceType") {
    const alias = ctx.typeAliases.get(type.name);
    const hasTypeArgs = (type.typeArguments?.length ?? 0) > 0;
    const hasTypeParams = (alias?.typeParameters?.length ?? 0) > 0;

    // Only resolve local, non-generic aliases deterministically.
    if (alias && !hasTypeArgs && !hasTypeParams) {
      if (seen.has(type.name)) return type;
      const nextSeen = new Set(seen);
      nextSeen.add(type.name);
      return resolveTypeAliases(alias.type, ctx, nextSeen);
    }
  }

  if (type.kind === "unionType") {
    return {
      kind: "unionType",
      types: type.types.map((t) => resolveTypeAliases(t, ctx, seen) ?? t),
    };
  }

  if (type.kind === "intersectionType") {
    return {
      kind: "intersectionType",
      types: type.types.map((t) => resolveTypeAliases(t, ctx, seen) ?? t),
    };
  }

  return type;
};

export const isCharType = (
  type: IrType | undefined,
  ctx: CharValidationContext
): boolean => {
  const resolved = stripNullish(resolveTypeAliases(type, ctx));
  if (!resolved) return false;
  if (resolved.kind === "primitiveType") return resolved.name === "char";
  if (resolved.kind === "referenceType") return resolved.name === "char";
  return false;
};

export const isCharTypedExpression = (
  expr: IrExpression,
  ctx: CharValidationContext
): boolean => isCharType(expr.inferredType, ctx);

export const isStringCharAccessExpression = (expr: IrExpression): boolean =>
  expr.kind === "memberAccess" &&
  expr.isComputed &&
  expr.accessKind === "stringChar" &&
  !expr.isOptional;

export const addCharDiagnostic = (
  ctx: CharValidationContext,
  message: string,
  location: SourceLocation,
  hint?: string
): void => {
  ctx.diagnostics.push(
    createDiagnostic("TSN7418", "error", message, location, hint)
  );
};

export const getPropertyExpectedType = (
  expectedType: IrType | undefined,
  propertyName: string,
  ctx: CharValidationContext
): IrType | undefined => {
  const resolved = stripNullish(resolveTypeAliases(expectedType, ctx));
  if (!resolved) return undefined;

  if (resolved.kind === "objectType") {
    const member = resolved.members.find(
      (m) => m.kind === "propertySignature" && m.name === propertyName
    );
    return member?.kind === "propertySignature" ? member.type : undefined;
  }

  if (resolved.kind === "referenceType" && resolved.structuralMembers) {
    const member = resolved.structuralMembers.find(
      (m) => m.kind === "propertySignature" && m.name === propertyName
    );
    return member?.kind === "propertySignature" ? member.type : undefined;
  }

  return undefined;
};

const collectTypeAliases = (
  module: IrModule
): ReadonlyMap<string, IrTypeAliasDeclaration> => {
  const aliases = new Map<string, IrTypeAliasDeclaration>();

  const collectFromStatement = (stmt: IrStatement): void => {
    if (stmt.kind === "typeAliasDeclaration") {
      aliases.set(stmt.name, stmt);
    }
  };

  for (const stmt of module.body) {
    collectFromStatement(stmt);
  }

  for (const exp of module.exports) {
    if (exp.kind === "declaration") {
      collectFromStatement(exp.declaration);
    }
  }

  return aliases;
};

const validateModule = (module: IrModule): readonly Diagnostic[] => {
  const ctx: CharValidationContext = {
    filePath: module.filePath,
    diagnostics: [],
    typeAliases: collectTypeAliases(module),
  };

  for (const stmt of module.body) {
    validateStatement(stmt, ctx, undefined);
  }

  for (const exp of module.exports) {
    switch (exp.kind) {
      case "default":
        validateExpression(exp.expression, ctx);
        break;
      case "declaration":
        validateStatement(exp.declaration, ctx, undefined);
        break;
      case "named":
      case "reexport":
        break;
      default:
        break;
    }
  }

  return ctx.diagnostics;
};

export const runCharValidationPass = (
  modules: readonly IrModule[]
): CharValidationResult => {
  const diagnostics: Diagnostic[] = [];
  for (const module of modules) {
    diagnostics.push(...validateModule(module));
  }
  return {
    ok: diagnostics.length === 0,
    modules,
    diagnostics,
  };
};
