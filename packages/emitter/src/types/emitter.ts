/**
 * Type emission main dispatcher
 *
 * Pipeline: IR type → CSharpTypeAst → printType → C# text
 *
 * `emitTypeAst` is the sole entry point, returning typed AST nodes.
 * Callers use `printType()` from the printer when they need text.
 */

import { IrType, stableIrTypeKey } from "@tsonic/frontend";
import { EmitterContext } from "../types.js";
import { emitPrimitiveType } from "./primitives.js";
import { emitReferenceType } from "./references.js";
import { emitArrayType } from "./arrays.js";
import { emitTupleType } from "./tuples.js";
import { emitFunctionType } from "./functions.js";
import { emitObjectType } from "./objects.js";
import { emitDictionaryType } from "./dictionaries.js";
import { emitUnionType } from "./unions.js";
import { emitIntersectionType } from "./intersections.js";
import { emitLiteralType } from "./literals.js";
import type { CSharpTypeAst } from "../core/format/backend-ast/types.js";
import { identifierType } from "../core/format/backend-ast/builders.js";
import { escapeCSharpIdentifier } from "../emitter-types/index.js";
import { resolveTypeAlias } from "../core/semantic/type-resolution.js";

const RECURSIVE_TYPE_FALLBACK_AST: CSharpTypeAst = {
  kind: "predefinedType",
  keyword: "object",
};
const POLYMORPHIC_THIS_MARKER = "__tsonic_polymorphic_this";

const getDeclaringTypeParameterAsts = (
  context: EmitterContext
): readonly CSharpTypeAst[] =>
  (context.declaringTypeParameterNames ?? []).map((name) =>
    identifierType(context.declaringTypeParameterNameMap?.get(name) ?? name)
  );

function tryEmitRuntimeUnionCarrierReferenceTypeAst(
  type: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] | undefined {
  if (type.kind !== "referenceType") {
    return undefined;
  }

  const resolvedAlias = resolveTypeAlias(type, context, {
    preserveObjectTypeAliases: true,
  });
  if (
    resolvedAlias.kind !== "unionType" ||
    !resolvedAlias.runtimeCarrierFamilyKey ||
    !resolvedAlias.runtimeCarrierName ||
    !resolvedAlias.runtimeCarrierNamespace
  ) {
    return undefined;
  }

  const typeArgumentTypes =
    type.typeArguments && type.typeArguments.length > 0
      ? type.typeArguments
      : resolvedAlias.runtimeCarrierTypeArguments;
  if (!typeArgumentTypes || typeArgumentTypes.length === 0) {
    return [
      identifierType(
        `global::${resolvedAlias.runtimeCarrierNamespace}.${resolvedAlias.runtimeCarrierName}`
      ),
      context,
    ];
  }

  const typeArguments: CSharpTypeAst[] = [];
  let currentContext = context;
  for (const typeArgument of typeArgumentTypes) {
    const [typeArgumentAst, nextContext] = emitTypeAst(
      typeArgument,
      currentContext
    );
    typeArguments.push(typeArgumentAst);
    currentContext = nextContext;
  }

  return [
    identifierType(
      `global::${resolvedAlias.runtimeCarrierNamespace}.${resolvedAlias.runtimeCarrierName}`,
      typeArguments
    ),
    currentContext,
  ];
}

const withTypeEmissionGuard = (
  type: IrType,
  context: EmitterContext,
  emit: (guardedContext: EmitterContext) => [CSharpTypeAst, EmitterContext]
): [CSharpTypeAst, EmitterContext] => {
  const key = stableIrTypeKey(type);
  if (context.activeTypeEmissionKeys?.has(key)) {
    const runtimeCarrierReference = tryEmitRuntimeUnionCarrierReferenceTypeAst(
      type,
      context
    );
    if (runtimeCarrierReference) {
      return runtimeCarrierReference;
    }

    return [RECURSIVE_TYPE_FALLBACK_AST, context];
  }

  const activeTypeEmissionKeys = new Set(context.activeTypeEmissionKeys ?? []);
  activeTypeEmissionKeys.add(key);

  const [emittedTypeAst, nextContext] = emit({
    ...context,
    activeTypeEmissionKeys,
  });

  if (nextContext.activeTypeEmissionKeys === context.activeTypeEmissionKeys) {
    return [emittedTypeAst, nextContext];
  }

  return [
    emittedTypeAst,
    {
      ...nextContext,
      activeTypeEmissionKeys: context.activeTypeEmissionKeys,
    },
  ];
};

const buildEmitterIceContext = (context: EmitterContext): string => {
  const parts: string[] = [];
  const moduleFilePath = context.options.currentModuleFilePath;
  if (moduleFilePath) {
    parts.push(`module=${moduleFilePath}`);
  }
  if (context.declaringTypeName) {
    parts.push(`declaringType=${context.declaringTypeName}`);
  }
  if (context.className) {
    parts.push(`class=${context.className}`);
  }
  if (parts.length === 0) {
    return "";
  }
  return ` (${parts.join(", ")})`;
};

/**
 * Emit a CSharpTypeAst from an IR type (primary dispatcher)
 */
export const emitTypeAst = (
  type: IrType,
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] =>
  withTypeEmissionGuard(type, context, (guardedContext) => {
    switch (type.kind) {
      case "primitiveType":
        return emitPrimitiveType(type, guardedContext);

      case "referenceType":
        return emitReferenceType(type, guardedContext);

      case "typeParameterType":
        if (
          type.name === POLYMORPHIC_THIS_MARKER &&
          guardedContext.declaringTypeName
        ) {
          const declaringTypeName =
            guardedContext.className ??
            escapeCSharpIdentifier(guardedContext.declaringTypeName);
          const declaringTypeParameterAsts =
            getDeclaringTypeParameterAsts(guardedContext);
          return [
            identifierType(
              declaringTypeName,
              declaringTypeParameterAsts.length > 0
                ? declaringTypeParameterAsts
                : undefined
            ),
            guardedContext,
          ];
        }
        // Type parameters emit as their mapped name (e.g., A -> TA) when needed to avoid
        // CLR naming collisions with members after namingPolicy transforms.
        return [
          {
            kind: "identifierType",
            name:
              guardedContext.typeParameterNameMap?.get(type.name) ?? type.name,
          },
          guardedContext,
        ];

      case "arrayType":
        return emitArrayType(type, guardedContext);

      case "tupleType":
        return emitTupleType(type, guardedContext);

      case "functionType":
        return emitFunctionType(type, guardedContext);

      case "objectType":
        return emitObjectType(type, guardedContext);

      case "dictionaryType":
        return emitDictionaryType(type, guardedContext);

      case "unionType":
        return emitUnionType(type, guardedContext);

      case "intersectionType":
        return emitIntersectionType(type, guardedContext);

      case "literalType":
        return emitLiteralType(type, guardedContext);

      case "anyType":
        // ICE: Frontend validation (TSN7401) should have caught this.
        throw new Error(
          "ICE: 'any' type reached emitter - validation missed TSN7401"
        );

      case "unknownType":
        throw new Error(
          "ICE: 'unknown' type reached emitter - validated programs must erase overload stubs and reject unknown elsewhere" +
            buildEmitterIceContext(guardedContext)
        );

      case "voidType":
        return [{ kind: "predefinedType", keyword: "void" }, guardedContext];

      case "neverType":
        return [{ kind: "predefinedType", keyword: "void" }, guardedContext];

      default: {
        // ICE: All IR types should be handled explicitly
        const exhaustiveCheck: never = type;
        throw new Error(
          `ICE: Unhandled IR type kind: ${(exhaustiveCheck as IrType).kind}`
        );
      }
    }
  });
