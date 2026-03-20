/**
 * MemberId-based binding resolution and extension method binding for
 * member access expressions.
 *
 * Handles CLR property casing fallback and tsbindgen extension method
 * resolution via `__Ext_*` and `__TsonicExtMethods_*` interfaces.
 *
 * Split from binding-resolution.ts for file-size compliance (< 500 LOC).
 */

import * as ts from "typescript";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { IrExpression, IrMemberExpression } from "../../../types.js";
import { getSourceSpan } from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import type { MemberId } from "../../../type-system/index.js";
import type { MemberBinding } from "../../../../program/bindings.js";
import { tsbindgenClrTypeNameToTsTypeName } from "../../../../tsbindgen/names.js";
import { createDiagnostic } from "../../../../types/diagnostic.js";
import { loadBindingsFromPath } from "../../../../program/bindings.js";
import { extractTypeName } from "./member-resolution.js";

const stripTsonicExtensionWrapperType = (
  type: IrExpression["inferredType"]
): IrExpression["inferredType"] => {
  if (!type) return type;
  if (
    type.kind === "referenceType" &&
    type.name.startsWith("__TsonicExt_") &&
    (type.typeArguments?.length ?? 0) === 1
  ) {
    const inner = type.typeArguments?.[0];
    return inner ? stripTsonicExtensionWrapperType(inner) : type;
  }
  return type;
};

const findNearestBindingsJson = (filePath: string): string | undefined => {
  let currentDir = dirname(filePath);
  while (true) {
    const candidate = join(currentDir, "bindings.json");
    if (existsSync(candidate)) return candidate;
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) return undefined;
    currentDir = parentDir;
  }
};

const isNodeModulesPackagePath = (
  filePath: string,
  packageName: string
): boolean => {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.includes(`/node_modules/${packageName}/`);
};

const jsSurfaceArrayFallbackAliases = new Set(["Array", "ReadonlyArray"]);

const canUseJsSurfaceArrayFallback = (
  typeAlias: string,
  declSourceFilePath: string | undefined,
  ctx: ProgramContext
): boolean => {
  if (!declSourceFilePath) return false;
  if (!jsSurfaceArrayFallbackAliases.has(typeAlias)) return false;

  return (
    isNodeModulesPackagePath(declSourceFilePath, ctx.surface) ||
    isNodeModulesPackagePath(declSourceFilePath, "@tsonic/js")
  );
};

const disambiguateOverloadsByDeclaringType = (
  overloads: readonly MemberBinding[],
  memberId: MemberId,
  declaringTypeTsName: string,
  ctx: ProgramContext
): readonly MemberBinding[] | undefined => {
  const declSourceFilePath = ctx.binding.getSourceFilePathOfMember(memberId);
  if (!declSourceFilePath) return undefined;

  const bindingsPath = findNearestBindingsJson(declSourceFilePath);
  if (!bindingsPath) return undefined;

  const raw = (() => {
    try {
      return JSON.parse(readFileSync(bindingsPath, "utf8")) as unknown;
    } catch {
      return undefined;
    }
  })();

  if (!raw || typeof raw !== "object") return undefined;

  const expectedClrType = resolveExpectedClrTypeFromBindings(
    raw as Record<string, unknown>,
    declaringTypeTsName
  );
  if (!expectedClrType) return undefined;

  const filtered = overloads.filter((m) => m.binding.type === expectedClrType);
  return filtered.length > 0 ? filtered : undefined;
};

import { resolveExpectedClrTypeFromBindings } from "./binding-resolution-hierarchical.js";

/**
 * Resolve hierarchical binding for a member access using Binding-resolved MemberId.
 *
 * This is a fallback for cases where the receiver's inferredType is unavailable
 * (e.g., local variable typing inferred from a complex initializer), but TS can
 * still resolve the member symbol deterministically.
 *
 * Critical use case: CLR property casing (e.g., `.expression` → `.Expression`).
 */
export const resolveHierarchicalBindingFromMemberId = (
  node: ts.PropertyAccessExpression,
  propertyName: string,
  ctx: ProgramContext
): IrMemberExpression["memberBinding"] => {
  const memberId = ctx.binding.resolvePropertyAccess(node);
  if (!memberId) return undefined;

  const declaringTypeName = ctx.binding.getDeclaringTypeNameOfMember(memberId);
  if (!declaringTypeName) return undefined;

  const normalizeDeclaringType = (name: string): string => {
    if (name.endsWith("$instance")) return name.slice(0, -"$instance".length);
    if (name.startsWith("__") && name.endsWith("$views")) {
      return name.slice("__".length, -"$views".length);
    }
    return name;
  };

  const typeAlias = normalizeDeclaringType(declaringTypeName);
  const staticOverloads = (() => {
    if (!ts.isIdentifier(node.expression)) return undefined;
    const simpleBinding = ctx.bindings.getExactBinding(node.expression.text);
    if (!simpleBinding?.staticType) return undefined;
    const staticAlias = tsbindgenClrTypeNameToTsTypeName(
      simpleBinding.staticType
    );
    if (!staticAlias) return undefined;
    return ctx.bindings.getMemberOverloads(staticAlias, propertyName);
  })();

  const declSourceFilePath = ctx.binding.getSourceFilePathOfMember(memberId);
  const jsSurfaceArrayOverloads = canUseJsSurfaceArrayFallback(
    typeAlias,
    declSourceFilePath,
    ctx
  )
    ? ctx.bindings.getMemberOverloads("JSArray", propertyName)
    : undefined;

  let overloadsAll =
    staticOverloads ??
    jsSurfaceArrayOverloads ??
    ctx.bindings.getMemberOverloads(typeAlias, propertyName);
  if (!overloadsAll || overloadsAll.length === 0) {
    const bindingsPath =
      declSourceFilePath !== undefined
        ? findNearestBindingsJson(declSourceFilePath)
        : undefined;

    // Airplane-grade: If we can locate the bindings.json that corresponds to the
    // tsbindgen declaration, load it on-demand and retry. This avoids relying on
    // "import closure" heuristics and ensures CLR binding lookup is based on the
    // declaration's actual owning bindings.json.
    if (bindingsPath) {
      loadBindingsFromPath(ctx.bindings, bindingsPath);
      overloadsAll = ctx.bindings.getMemberOverloads(typeAlias, propertyName);
    }

    if (
      (!overloadsAll || overloadsAll.length === 0) &&
      canUseJsSurfaceArrayFallback(typeAlias, declSourceFilePath, ctx)
    ) {
      return undefined;
    }

    // Airplane-grade rule: If this member resolves to a tsbindgen declaration,
    // we MUST have a CLR binding; we must never guess member names via naming policy.
    //
    // We treat it as CLR-bound if:
    // - The declaring type is a tsbindgen extension interface (`__Ext_*`), OR
    // - We can locate a bindings.json near the declaration source file.
    const isClrBound =
      declaringTypeName.startsWith("__Ext_") || bindingsPath !== undefined;

    if (isClrBound && (!overloadsAll || overloadsAll.length === 0)) {
      ctx.diagnostics.push(
        createDiagnostic(
          "TSN4004",
          "error",
          `Missing CLR binding for '${typeAlias}.${propertyName}'.`,
          getSourceSpan(node),
          bindingsPath
            ? `No matching member binding was found in the loaded bindings for this tsbindgen declaration. (bindings.json: ${bindingsPath})`
            : "No matching member binding was found for this tsbindgen extension interface member."
        )
      );
    }

    return undefined;
  }

  let overloads: readonly MemberBinding[] = overloadsAll;
  const targetKeys = new Set(
    overloads.map(
      (m) => `${m.binding.assembly}:${m.binding.type}::${m.binding.member}`
    )
  );
  if (targetKeys.size > 1) {
    const disambiguated = disambiguateOverloadsByDeclaringType(
      overloads,
      memberId,
      typeAlias,
      ctx
    );
    if (disambiguated) {
      overloads = disambiguated;
    }
  }

  const first = overloads[0];
  if (!first) return undefined;

  const targetKey = `${first.binding.assembly}:${first.binding.type}::${first.binding.member}`;
  if (
    overloads.some(
      (m) =>
        `${m.binding.assembly}:${m.binding.type}::${m.binding.member}` !==
        targetKey
    )
  ) {
    const declSourceFilePath = ctx.binding.getSourceFilePathOfMember(memberId);
    const bindingsPath =
      declSourceFilePath !== undefined
        ? findNearestBindingsJson(declSourceFilePath)
        : undefined;

    // Only treat this as a CLR ambiguity when we can locate a bindings.json near the
    // TS declaration source (tsbindgen packages). Otherwise, fall back to "no binding"
    // and let local codepaths handle naming policy.
    if (bindingsPath) {
      const targets = [
        ...new Set(
          overloads.map((m) => `${m.binding.type}.${m.binding.member}`)
        ),
      ]
        .sort()
        .join(", ");

      ctx.diagnostics.push(
        createDiagnostic(
          "TSN4003",
          "error",
          `Ambiguous CLR binding for '${typeAlias}.${propertyName}'. Multiple CLR targets found: ${targets}.`,
          getSourceSpan(node),
          `This usually indicates multiple tsbindgen packages export the same TS type/member alias. Ensure the correct package is imported, or regenerate bindings to avoid collisions. (bindings.json: ${bindingsPath})`
        )
      );
    }
    return undefined;
  }

  const getModifiersKey = (m: MemberBinding): string => {
    const mods = m.parameterModifiers ?? [];
    if (mods.length === 0) return "";
    return [...mods]
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((mod) => `${mod.index}:${mod.modifier}`)
      .join(",");
  };

  const modsKey = getModifiersKey(first);
  const modsConsistent = overloads.every((m) => getModifiersKey(m) === modsKey);

  return {
    kind: first.kind,
    assembly: first.binding.assembly,
    type: first.binding.type,
    member: first.binding.member,
    parameterModifiers:
      modsConsistent &&
      first.parameterModifiers &&
      first.parameterModifiers.length > 0
        ? first.parameterModifiers
        : undefined,
    isExtensionMethod: first.isExtensionMethod,
    emitSemantics: first.emitSemantics,
  };
};

/**
 * Resolve instance-style extension method bindings from tsbindgen's `ExtensionMethods` typing.
 *
 * tsbindgen emits extension methods as interface members on `__Ext_*` types, and users
 * opt in via `ExtensionMethods<TShape>`. At runtime those members do not exist, so we
 * must attach the underlying CLR binding so the emitter can lower the call to an
 * explicit static invocation.
 */
export const resolveExtensionMethodsBinding = (
  node: ts.PropertyAccessExpression,
  propertyName: string,
  object: IrExpression,
  ctx: ProgramContext
): IrMemberExpression["memberBinding"] => {
  const memberId = ctx.binding.resolvePropertyAccess(node);
  if (!memberId) return undefined;

  const declaringTypeName = ctx.binding.getDeclaringTypeNameOfMember(memberId);
  if (!declaringTypeName) return undefined;

  const callArgumentCount = (() => {
    const parent = node.parent;
    if (ts.isCallExpression(parent) && parent.expression === node) {
      return parent.arguments.length;
    }
    return undefined;
  })();

  // Debug/diagnostic context for airplane-grade failures.
  // These are populated during resolution and surfaced only if resolution fails.
  let sigDeclaringTypeNameForError: string | undefined;
  let namespaceKeyForError: string | undefined;
  let receiverTypeNameForError: string | undefined;

  const resolved = (() => {
    const parent = node.parent;
    if (!ts.isCallExpression(parent) || parent.expression !== node)
      return undefined;

    const sigId = ctx.binding.resolveCallSignature(parent);
    if (!sigId) return undefined;

    // IMPORTANT (airplane-grade): the same TS member name can exist in multiple extension
    // namespaces (e.g., BCL async LINQ and EF Core both define ToArrayAsync). When the
    // receiver expression is not an identifier, `resolvePropertyAccess` can key the member
    // entry off the member symbol itself, which merges declarations. Always anchor to the
    // resolved signature's declaring type to choose the correct CLR extension binding.
    const sigDeclaringTypeName =
      ctx.binding.getDeclaringTypeNameOfSignature(sigId);
    sigDeclaringTypeNameForError = sigDeclaringTypeName;
    if (!sigDeclaringTypeName) return undefined;

    // Extension method bucket format: methods emitted on `__Ext_*` interfaces.
    if (sigDeclaringTypeName.startsWith("__Ext_")) {
      return ctx.bindings.resolveExtensionMethod(
        sigDeclaringTypeName,
        propertyName,
        callArgumentCount
      );
    }

    // New format: extension methods emitted on method-table interfaces:
    //   interface __TsonicExtMethods_System_Linq { Where(this: IQueryable_1<T>, ...): ... }
    if (sigDeclaringTypeName.startsWith("__TsonicExtMethods_")) {
      const namespaceKey = sigDeclaringTypeName.slice(
        "__TsonicExtMethods_".length
      );
      namespaceKeyForError = namespaceKey;
      if (!namespaceKey) return undefined;

      const thisTypeNode = ctx.binding.getThisTypeNodeOfSignature(sigId);
      if (!thisTypeNode) return undefined;

      const extractReceiverTypeName = (
        typeNode: ts.TypeNode
      ): string | undefined => {
        let current = typeNode;
        while (ts.isParenthesizedTypeNode(current)) current = current.type;

        if (ts.isTypeReferenceNode(current)) {
          const tn = current.typeName;
          if (ts.isIdentifier(tn)) return tn.text;
          if (ts.isQualifiedName(tn)) return tn.right.text;
        }

        if (current.kind === ts.SyntaxKind.StringKeyword) return "String";
        if (current.kind === ts.SyntaxKind.NumberKeyword) return "Double";
        if (current.kind === ts.SyntaxKind.BooleanKeyword) return "Boolean";

        return undefined;
      };

      const receiverTypeName = extractReceiverTypeName(thisTypeNode);
      receiverTypeNameForError = receiverTypeName;
      if (!receiverTypeName) return undefined;

      const actualReceiverTypeName = extractTypeName(
        stripTsonicExtensionWrapperType(object.inferredType)
      );
      if (
        actualReceiverTypeName &&
        !ctx.bindings.isTypeOrSubtype(actualReceiverTypeName, receiverTypeName)
      ) {
        return undefined;
      }

      return ctx.bindings.resolveExtensionMethodByKey(
        namespaceKey,
        receiverTypeName,
        propertyName,
        callArgumentCount
      );
    }

    return undefined;
  })();

  if (!resolved) {
    // Airplane-grade: if the TS surface indicates this member comes from an extension-method
    // module, failing to attach a CLR binding would emit an instance call that cannot exist
    // at runtime. Treat as a hard error rather than miscompiling.
    if (
      declaringTypeName.startsWith("__Ext_") ||
      declaringTypeName.startsWith("__TsonicExtMethods_")
    ) {
      const detail = [
        sigDeclaringTypeNameForError
          ? `Resolved signature declares: '${sigDeclaringTypeNameForError}'.`
          : "Resolved signature declaring type: <unknown>.",
        namespaceKeyForError
          ? `Namespace key: '${namespaceKeyForError}'.`
          : "Namespace key: <unknown>.",
        receiverTypeNameForError
          ? `Receiver type: '${receiverTypeNameForError}'.`
          : "Receiver type: <unknown>.",
      ].join(" ");

      ctx.diagnostics.push(
        createDiagnostic(
          "TSN4004",
          "error",
          `Failed to resolve CLR extension-method binding for '${propertyName}' on '${declaringTypeName}'. ${detail}`,
          getSourceSpan(node),
          "This indicates a mismatch between the generated .d.ts surface and bindings.json extension metadata. Regenerate bindings and ensure the correct packages are installed."
        )
      );
    }
    return undefined;
  }

  // tsbindgen parameterModifiers indices include the extension receiver at index 0.
  // For instance-style calls, our call-site arguments exclude the receiver, so shift by -1.
  const shiftedModifiers = resolved.parameterModifiers
    ? resolved.parameterModifiers
        .map((m) => ({ index: m.index - 1, modifier: m.modifier }))
        .filter((m) => m.index >= 0)
    : undefined;

  return {
    kind: resolved.kind,
    assembly: resolved.binding.assembly,
    type: resolved.binding.type,
    member: resolved.binding.member,
    parameterModifiers:
      shiftedModifiers && shiftedModifiers.length > 0
        ? shiftedModifiers
        : undefined,
    isExtensionMethod: resolved.isExtensionMethod,
    emitSemantics: resolved.emitSemantics,
  };
};
