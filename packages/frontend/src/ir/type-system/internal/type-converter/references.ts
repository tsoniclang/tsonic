/**
 * Reference type conversion (facade)
 *
 * Sub-modules:
 * - references-normalize.ts  : normalization helpers, key classification, caches
 * - references-structural.ts : structural extraction, declaration analysis, bindings
 */

import * as ts from "typescript";
import { IrType, IrDictionaryType } from "../../../types.js";
import { substituteIrType } from "../../../types/ir-substitution.js";
import {
  isPrimitiveTypeName,
  getPrimitiveType,
  isClrPrimitiveTypeName,
  getClrPrimitiveType,
} from "./primitives.js";
import { convertFunctionType } from "./functions.js";
import {
  isExpandableUtilityType,
  expandUtilityType,
  isExpandableConditionalUtilityType,
  expandConditionalUtilityType,
  expandRecordType,
} from "./utility-types.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";
import {
  normalizeSystemInternalQualifiedName,
  normalizeNamespaceAliasQualifiedName,
  normalizeExpandedAliasType,
  classifyDictionaryKeyTypeNode,
  getTypeAliasBodyCache,
} from "./references-normalize.js";
import {
  isTsonicBindingsDeclarationFile,
  isSafeToEraseUserTypeAliasTarget,
  isRecursiveUserTypeAliasDeclaration,
  extractStructuralMembersFromDeclarations,
  resolveSourceBindingsClrIdentity,
  tryConvertPureIndexSignatureToDictionary,
  expandTypeAliasBody,
} from "./references-structural.js";

/**
 * Convert TypeScript type reference to IR type
 * Handles both primitive type names and user-defined types
 */
export const convertTypeReference = (
  node: ts.TypeReferenceNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType => {
  const entityNameToText = (entityName: ts.EntityName): string =>
    ts.isIdentifier(entityName)
      ? entityName.text
      : `${entityNameToText(entityName.left)}.${entityName.right.text}`;

  const rawTypeName = entityNameToText(node.typeName);
  const typeName = normalizeNamespaceAliasQualifiedName(
    normalizeSystemInternalQualifiedName(rawTypeName)
  );

  // Check for primitive type names
  if (isPrimitiveTypeName(typeName)) {
    return getPrimitiveType(typeName);
  }

  // Check for CLR primitive type names (e.g., int from @tsonic/core)
  // These are compiler-known types that map to distinct primitives, not referenceType
  if (isClrPrimitiveTypeName(typeName)) {
    return getClrPrimitiveType(typeName);
  }

  // Check for Array<T> / ReadonlyArray<T> utility types → convert to arrayType
  // with explicit origin. This ensures Array<T>, ReadonlyArray<T>, and T[] are
  // treated identically at the IR level.
  const firstTypeArg = node.typeArguments?.[0];
  if ((typeName === "Array" || typeName === "ReadonlyArray") && firstTypeArg) {
    return {
      kind: "arrayType",
      elementType: convertType(firstTypeArg, binding),
      origin: "explicit",
    };
  }

  // Check for expandable conditional utility types (NonNullable, Exclude, Extract)
  // These are expanded at compile time by delegating to TypeScript's type checker
  if (
    isExpandableConditionalUtilityType(typeName) &&
    node.typeArguments?.length
  ) {
    const expanded = expandConditionalUtilityType(
      node,
      typeName,
      binding,
      convertType
    );
    if (expanded) return expanded;
    // Fall through to referenceType if can't expand (e.g., type parameter)
  }

  // Check for Record<K, V> utility type
  // First try to expand to IrObjectType for finite literal keys
  // Falls back to IrDictionaryType ONLY for string/number keys (not type parameters)
  const typeArgsForRecord = node.typeArguments;
  const keyTypeNode = typeArgsForRecord?.[0];
  const valueTypeNode = typeArgsForRecord?.[1];
  if (typeName === "Record" && keyTypeNode && valueTypeNode) {
    // Try to expand to IrObjectType for finite literal keys
    const expandedRecord = expandRecordType(node, binding, convertType);
    if (expandedRecord) return expandedRecord;

    // Only create dictionary if K is exactly 'string' or 'number'
    // Type parameters should fall through to referenceType
    //
    // DETERMINISTIC: Only check SyntaxKind - no getTypeAtLocation.
    // If the key is a type alias that resolves to string/number, it falls through
    // to referenceType (the user should use `string` or `number` directly).
    const keyType = classifyDictionaryKeyTypeNode(
      keyTypeNode,
      convertType,
      binding
    );
    if (keyType) {
      const valueType = convertType(valueTypeNode, binding);

      return {
        kind: "dictionaryType",
        keyType,
        valueType,
      } as IrDictionaryType;
    }
    // Type parameter or other complex key type - fall through to referenceType
  }

  // Check for expandable utility types (Partial, Required, Readonly, Pick, Omit)
  // These are expanded to IrObjectType at compile time for concrete types
  if (isExpandableUtilityType(typeName) && node.typeArguments?.length) {
    const expanded = expandUtilityType(node, typeName, binding, convertType);
    if (expanded) return expanded;
    // Fall through to referenceType if can't expand (e.g., type parameter)
  }

  // tsbindgen's `CLROf<T>` is a conditional type used to coerce ergonomic primitives
  // into their CLR nominal types in generic positions. For deterministic IR typing,
  // we treat it as an identity wrapper and rely on the TypeSystem's primitive-to-nominal
  // normalization (and alias table) to unify primitives with System.* TypeIds.
  if (typeName === "CLROf" && node.typeArguments?.length === 1) {
    const inner = node.typeArguments[0];
    return inner ? convertType(inner, binding) : { kind: "unknownType" };
  }

  // `thisarg<T>` is a TS-only marker used to declare C# extension method receivers.
  // For IR typing it must erase to the underlying T so call resolution and generic
  // inference operate on the real receiver type.
  if (typeName === "thisarg" && node.typeArguments?.length === 1) {
    const inner = node.typeArguments[0];
    return inner ? convertType(inner, binding) : { kind: "unknownType" };
  }

  // `field<T>` is a TS-only marker used to force C# field emission for class members.
  // For IR typing it must erase to the underlying T.
  if (typeName === "field" && node.typeArguments?.length === 1) {
    const inner = node.typeArguments[0];
    return inner ? convertType(inner, binding) : { kind: "unknownType" };
  }

  // `Rewrap<TReceiver, TNewShape>` is a TS-only helper used by generated extension method
  // surfaces to keep extension scopes sticky across fluent chains.
  //
  // For IR typing / runtime shape, it MUST erase to the new shape. We intentionally do not
  // attempt to interpret the `TReceiver` argument here (it is often `this`, which is not a
  // resolvable CLR type in IR conversion).
  if (typeName === "Rewrap" && node.typeArguments?.length === 2) {
    const newShape = node.typeArguments[1];
    return newShape ? convertType(newShape, binding) : { kind: "unknownType" };
  }

  // Handle parameter passing modifiers: out<T>, ref<T>, inref<T>
  // These are type aliases that should NOT be resolved - we preserve them
  // so the emitter can detect `as out<T>` casts and emit the correct C# prefix.
  if (
    (typeName === "out" || typeName === "ref" || typeName === "inref") &&
    node.typeArguments &&
    node.typeArguments.length === 1
  ) {
    // Safe: we checked length === 1 above
    const innerTypeArg = node.typeArguments[0];
    if (!innerTypeArg) {
      return { kind: "anyType" };
    }
    return {
      kind: "referenceType",
      name: typeName,
      typeArguments: [convertType(innerTypeArg, binding)],
    };
  }

  // DETERMINISTIC: Check if this is a type parameter or type alias using Binding
  const declId = binding.resolveTypeReference(node);
  if (declId) {
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    if (declInfo) {
      // Check for type parameter declaration (class type params, method type params, etc.)
      // CRITICAL: Check the AST node directly - do NOT rely on declInfo.kind.
      // Binding's DeclKind may not label TypeParameterDeclaration as "parameter".
      const declNode = (declInfo.typeDeclNode ?? declInfo.declNode) as
        | ts.Declaration
        | undefined;
      if (declNode && ts.isTypeParameterDeclaration(declNode)) {
        return { kind: "typeParameterType", name: typeName };
      }

      // tsbindgen-generated extension method helpers are exported as `ExtensionMethods`
      // from facade modules, then imported with a local alias:
      //   import type { ExtensionMethods as __TsonicExt_Linq } from "@tsonic/dotnet/System.Linq.js";
      //
      // In this case the DeclId resolves to the import specifier (not the underlying
      // `ExtensionMethods_<Namespace>` type alias declaration), so we must recognize
      // the imported name and erase it to the receiver shape for deterministic typing.
      if (
        declNode &&
        ts.isImportSpecifier(declNode) &&
        (declNode.propertyName ?? declNode.name).text === "ExtensionMethods" &&
        node.typeArguments?.length === 1
      ) {
        const shape = node.typeArguments[0];
        return shape ? convertType(shape, binding) : { kind: "unknownType" };
      }

      // Pure index-signature interface/type alias: treat as dictionaryType.
      const pureIndexSigDict = declNode
        ? tryConvertPureIndexSignatureToDictionary(
            declNode,
            convertType,
            binding
          )
        : undefined;
      if (pureIndexSigDict) {
        return pureIndexSigDict;
      }

      // Check for type alias to function type
      // DETERMINISTIC: Expand function type aliases so lambda contextual typing works
      // e.g., `type NumberToNumber = (x: number) => number` should be converted
      // to a functionType, not a referenceType
      if (declNode && ts.isTypeAliasDeclaration(declNode)) {
        const convertFunctionAliasBody = (
          functionTypeNode: ts.FunctionTypeNode
        ): IrType => {
          const fnType = convertFunctionType(
            functionTypeNode,
            binding,
            convertType
          );

          const aliasTypeParams = (declNode.typeParameters ?? []).map(
            (tp) => tp.name.text
          );
          const refTypeArgs = (node.typeArguments ?? []).map((t) =>
            convertType(t, binding)
          );

          if (aliasTypeParams.length > 0 && refTypeArgs.length > 0) {
            const subst = new Map<string, IrType>();
            for (
              let i = 0;
              i < Math.min(aliasTypeParams.length, refTypeArgs.length);
              i++
            ) {
              const name = aliasTypeParams[i];
              const arg = refTypeArgs[i];
              if (name && arg) subst.set(name, arg);
            }

            return normalizeExpandedAliasType(
              subst.size > 0 ? substituteIrType(fnType, subst) : fnType
            );
          }

          return normalizeExpandedAliasType(fnType);
        };

        // tsbindgen extension method wrapper types are type-only helpers.
        //
        // Example: ExtensionMethods_System_Linq<TShape> = TShape & (__Ext_* ...)
        //
        // For IR/runtime typing, this must erase to the underlying shape type:
        // - Enables member binding on the real receiver type (e.g., List<T>.count → Count)
        // - Prevents TS-only wrapper names from leaking into IR and confusing emit
        //
        // Extension method *member* discovery is handled via Binding + BindingRegistry,
        // not by treating ExtensionMethods_* as a nominal CLR type.
        if (
          declNode.name.text.startsWith("ExtensionMethods_") &&
          node.typeArguments?.length === 1
        ) {
          const shape = node.typeArguments[0];
          return shape ? convertType(shape, binding) : { kind: "unknownType" };
        }

        if (ts.isFunctionTypeNode(declNode.type)) {
          // tsbindgen emits CLR delegates as type aliases to function types in .d.ts.
          //
          // Example (generated):
          //   export type NextFunction = (control?: string) => Task;
          //
          // Airplane-grade rule: CLR delegate types are NOMINAL in C#.
          // If we eagerly expand them into IrFunctionType, we lose the delegate's
          // CLR identity and the emitter will incorrectly lower them to
          // `System.Func` / `System.Action`, breaking overload resolution and
          // delegate parameter typing.
          //
          // Keep declaration-file function aliases as NOMINAL reference types.
          //
          // Exception: first-party/source-package generated bindings are also declaration
          // files, but their exported function aliases are TS-only surface aliases with
          // no CLR identity. Those must erase to their function shapes so imported
          // callback/value aliases carry their full local alias closure across
          // source-package boundaries.
          //
          // IMPORTANT: Don't early-return here. We still want the shared
          // reference-type path at the end of this function so we pick up:
          // - Binding-followed fqName (stabilizes identity for facades/aliases)
          // - structuralMembers extraction (for TSN5110)
          //
          // delegateToFunctionType() can still recover the Invoke signature for
          // deterministic lambda typing at call sites.
          if (declNode.getSourceFile().isDeclarationFile) {
            if (
              isTsonicBindingsDeclarationFile(
                declNode.getSourceFile().fileName
              ) &&
              !declInfo.valueDeclNode
            ) {
              return convertFunctionAliasBody(declNode.type);
            }
            // Fall through to the referenceType emission at the end of this function.
          } else {
            return convertFunctionAliasBody(declNode.type);
          }
        }

        // Declaration-file type aliases are often TS-only "ergonomic" names (including
        // Tsonic source type aliases appended to generated bindings).
        //
        // These aliases have NO CLR identity and must erase to their underlying shapes
        // so emission uses CLR-backed types.
        //
        // Examples (from generated bindings):
        //   export type Ok<T> = Internal.Ok__Alias_1<T>;
        //   export type Result<T, E = string> = Ok<T> | Err<E>;
        //
        // If we keep these nominal, the emitter will try to reference a CLR type
        // named `Ok` / `Result` which does not exist, causing C# compile failures
        // in downstream projects.
        //
        // IMPORTANT: We must NOT erase:
        // - Delegate aliases (handled above)
        // - Facade conditional "arity families" (handled below)
        // - Conditional type aliases generally (unsupported in the compiler subset)
        if (
          // Only erase *type-only* declaration-file aliases.
          //
          // tsbindgen uses merged type+value symbols for CLR types:
          //   export interface DbSet_1$instance<T> { ... }
          //   export const DbSet_1: ...;
          //   export type DbSet_1<T> = DbSet_1$instance<T> & __DbSet_1$views<T>;
          //
          // These must remain NOMINAL so we don't pull synthetic helper interfaces
          // like `__DbSet_1$views` into user code (they have no CLR binding).
          //
          // By contrast, tsonic-generated bindings often include TS-only re-exports:
          //   export type Ok<T> = Internal.Ok__Alias_1<T>;
          //   export type Result<T, E = string> = Ok<T> | Err<E>;
          //
          // Those aliases have no CLR identity and must erase to their shapes.
          declNode.getSourceFile().isDeclarationFile &&
          isTsonicBindingsDeclarationFile(declNode.getSourceFile().fileName) &&
          !declInfo.valueDeclNode &&
          !ts.isConditionalTypeNode(declNode.type)
        ) {
          const expanded = expandTypeAliasBody(
            declId.id,
            declNode,
            node,
            binding,
            convertType
          );
          if (expanded) return expanded;
        }

        // User-defined type aliases are TS-only and have no CLR identity.
        //
        // For deterministic typing (especially generic inference), we must erase them to their
        // underlying shapes.
        //
        // Example (extension methods):
        //   type LinqList<T> = Linq<List<T>>;
        //   const numbers = new List<int>() as unknown as LinqList<int>;
        //   numbers.AsParallel(); // must infer TSource=int from the receiver
        //
        // Without this erasure, the receiver type becomes a non-nominal referenceType ("LinqList")
        // which prevents interface/heritage-based inference through NominalEnv.
        if (
          !declNode.getSourceFile().isDeclarationFile &&
          isSafeToEraseUserTypeAliasTarget(declNode.type) &&
          !isRecursiveUserTypeAliasDeclaration(declId.id, declNode, binding)
        ) {
          const key = declId.id;
          const typeAliasBodyCache = getTypeAliasBodyCache(binding);
          const cached = typeAliasBodyCache.get(key);

          if (cached === "in-progress") {
            // Recursive alias expansion: fall through to the referenceType path to avoid infinite recursion.
          } else {
            const expanded = expandTypeAliasBody(
              declId.id,
              declNode,
              node,
              binding,
              convertType
            );
            if (expanded) return expanded;
          }
        }

        // tsbindgen facade type families use conditional type aliases to map:
        //   Foo<T = __> → Foo (non-generic) or Foo_N<T> (generic)
        //
        // Example:
        //   export type IQueryable<T1 = __> =
        //     [T1] extends [__] ? Internal.IQueryable : Internal.IQueryable_1<T1>;
        //
        // When callers reference `Foo<T>` (including with type parameters), we must
        // deterministically lower it to the arity-qualified CLR surface type name
        // (Foo_1/Foo_2/...) so TypeSystem can resolve it nominally via metadata.
        if (
          node.typeArguments &&
          node.typeArguments.length > 0 &&
          declNode.typeParameters &&
          declNode.typeParameters.length === 1
        ) {
          const param = declNode.typeParameters[0];
          const hasTsbindgenDefaultSentinel =
            !!param &&
            !!param.default &&
            ts.isTypeReferenceNode(param.default) &&
            entityNameToText(param.default.typeName) === "__";

          if (
            hasTsbindgenDefaultSentinel &&
            ts.isConditionalTypeNode(declNode.type)
          ) {
            const expected = `${typeName}_${node.typeArguments.length}`;
            let found: string | undefined;

            const visit = (t: ts.TypeNode): void => {
              if (found) return;

              if (ts.isTypeReferenceNode(t)) {
                const raw = entityNameToText(t.typeName);
                const normalized = normalizeNamespaceAliasQualifiedName(
                  normalizeSystemInternalQualifiedName(raw)
                );
                if (normalized === expected) {
                  found = normalized;
                }
                return;
              }

              if (ts.isConditionalTypeNode(t)) {
                visit(t.trueType);
                visit(t.falseType);
                return;
              }

              if (ts.isParenthesizedTypeNode(t)) {
                visit(t.type);
              }
            };

            visit(declNode.type);

            if (found) {
              return {
                kind: "referenceType",
                name: found,
                typeArguments: node.typeArguments.map((t) =>
                  convertType(t, binding)
                ),
              };
            }
          }
        }
      }
    }
  }

  // DETERMINISTIC IR TYPING (INV-0 compliant):
  // Symbol-based type parameter check above handles all cases.
  // The getTypeAtLocation fallback has been removed for INV-0 compliance.

  // Extract structural members from declarations (AST-based)
  // This enables TSN5110 validation for object literal properties.
  const structuralMembers = extractStructuralMembersFromDeclarations(
    declId?.id,
    binding,
    convertType
  );

  // tsbindgen facade exports often re-export arity-qualified CLR types under
  // ergonomic names (e.g., `DbSet` → `DbSet_1`). Binding.resolveTypeReference()
  // already follows aliases, so use the resolved symbol name to keep IR nominal
  // identity stable for member lookup and generic substitution.
  const resolvedName = (() => {
    if (!declId) return typeName;
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    return declInfo?.fqName ?? typeName;
  })();
  const resolvedClrType = resolveSourceBindingsClrIdentity(declId, binding);

  // tsbindgen exports extension method helpers as:
  //   export type { ExtensionMethods_System_Linq as ExtensionMethods } from "./__internal/extensions/index.js";
  //
  // Call sites (and generated bindings for Tsonic source) will often import these with a local alias:
  //   import type { ExtensionMethods as __TsonicExt_Linq } from "@tsonic/dotnet/System.Linq.js";
  //
  // In that case, the TypeReference's `typeName` is the local alias (e.g. "__TsonicExt_Linq"),
  // and the earlier `declNode.name.text.startsWith("ExtensionMethods_")` erasure check won't match
  // because the DeclId points at an import specifier, not the original type-alias declaration node.
  //
  // Airplane-grade rule: these helpers are TS-only wrappers and must erase to the receiver shape
  // for deterministic IR typing / generic inference.
  if (
    (resolvedName.startsWith("ExtensionMethods_") ||
      resolvedName === "ExtensionMethods") &&
    node.typeArguments?.length === 1
  ) {
    const shape = node.typeArguments[0];
    return shape ? convertType(shape, binding) : { kind: "unknownType" };
  }

  // Reference type (user-defined or library)
  return {
    kind: "referenceType",
    name: resolvedName,
    typeArguments: node.typeArguments?.map((t) => convertType(t, binding)),
    resolvedClrType,
    structuralMembers,
  };
};
