/**
 * Interface declaration converter
 */

import {
  getTstsDeclaredTypeNode,
  getTstsHeritageClauseDetails,
  getTstsMemberNodes,
  getTstsNodeNameText,
  getTstsParameters,
  getTstsTypeArguments,
  getTstsTypeParameterNodes,
  TstsSyntax,
  type TstsNode,
} from "@tsonic/tsts";
import {
  IrInterfaceDeclaration,
  IrInterfaceMember,
  IrTypeAliasDeclaration,
  IrFunctionType,
  IrType,
} from "../../../types.js";
import {
  hasExportModifier,
  hasReadonlyModifier,
  convertTypeParameters,
  convertParameters,
  definedTstsNodes,
} from "../helpers.js";
import type { ProgramContext } from "../../../program-context.js";
import { tryResolveDeterministicPropertyName } from "../../../syntax/property-names.js";
import {
  heritageWrapperSemanticsFactKey,
  isHeritageInterfaceErasure,
  isSourceTypeKind,
  sourceTypeSemanticsFactKey,
} from "../../../../source-frontend/index.js";

/**
 * Convert interface member
 */
export const convertInterfaceMember = (
  node: TstsNode,
  ctx: ProgramContext
): IrInterfaceMember | null => {
  if (TstsSyntax.IsPropertySignatureDeclaration(node) && getTstsDeclaredTypeNode(node)) {
    const memberName = tryResolveDeterministicPropertyName(
      TstsSyntax.Node_Name(node)
    );
    if (!memberName) return null;
    const typeNode = getTstsDeclaredTypeNode(node);
    if (!typeNode) return null;
    return {
      kind: "propertySignature",
      name: memberName,
      type: ctx.typeSystem.typeFromSyntax(
        ctx.binding.captureTypeSyntax(typeNode)
      ),
      isOptional: TstsSyntax.Node_QuestionToken(node) !== undefined,
      isReadonly: hasReadonlyModifier(node),
    };
  }

  if (TstsSyntax.IsMethodSignatureDeclaration(node)) {
    const memberName = tryResolveDeterministicPropertyName(
      TstsSyntax.Node_Name(node)
    );
    if (!memberName) return null;
    const returnTypeNode = getTstsDeclaredTypeNode(node);
    return {
      kind: "methodSignature",
      name: memberName,
      typeParameters: convertTypeParameters(
        definedTstsNodes(getTstsTypeParameterNodes(node)),
        ctx
      ),
      parameters: convertParameters(definedTstsNodes(getTstsParameters(node)), ctx),
      returnType: returnTypeNode
        ? ctx.typeSystem.typeFromSyntax(
            ctx.binding.captureTypeSyntax(returnTypeNode)
          )
        : undefined,
    };
  }

  return null;
};

const isStructMarker = (
  typeRef: TstsNode,
  ctx: ProgramContext
): boolean =>
  isSourceTypeKind(
    ctx.sourceSemantics.getFact(typeRef, sourceTypeSemanticsFactKey),
    "struct"
  );

/**
 * Unwrap `Interface<T>` in heritage clauses.
 *
 * Nominal native target interface brands add internal `__tsonic_iface_*` members. We provide
 * `Interface<IFoo>` (from @tsonic/core/lang) to strip those at the TS layer.
 *
 * For IR + target emission, we want the underlying native target interface `IFoo`.
 */
const unwrapInterfaceHeritageType = (
  typeRef: TstsNode,
  ctx: ProgramContext
): TstsNode => {
  if (
    isHeritageInterfaceErasure(
      ctx.sourceSemantics.getFact(typeRef, heritageWrapperSemanticsFactKey)
    ) &&
    definedTstsNodes(getTstsTypeArguments(typeRef)).length === 1
  ) {
    const only = definedTstsNodes(getTstsTypeArguments(typeRef))[0];
    if (only) return only;
  }

  return typeRef;
};

/**
 * Check if an interface has only index signatures (no property/method members).
 * Returns the dictionary type info if so, undefined otherwise.
 *
 * This handles interfaces like:
 *   interface NumberIndexed { [key: number]: string; }
 *
 * These should be lowered to type aliases for Dictionary<K, V>.
 */
const extractIndexSignatureOnlyInterface = (
  node: TstsNode,
  ctx: ProgramContext
): { keyType: IrType; valueType: IrType } | undefined => {
  const members = definedTstsNodes(getTstsMemberNodes(node));

  // Must have exactly one member
  if (members.length !== 1) {
    return undefined;
  }

  const member = members[0];
  if (!member || !TstsSyntax.IsIndexSignatureDeclaration(member)) {
    return undefined;
  }

  // Extract key type from the index signature parameter
  const param = definedTstsNodes(getTstsParameters(member))[0];
  const paramType = param ? getTstsDeclaredTypeNode(param) : undefined;
  if (!param || !paramType) {
    return undefined;
  }

  const keyType = ctx.typeSystem.typeFromSyntax(
    ctx.binding.captureTypeSyntax(paramType)
  );

  // Only allow string or number keys (enforced by TSN7413)
  if (
    keyType.kind !== "primitiveType" ||
    (keyType.name !== "string" && keyType.name !== "number")
  ) {
    return undefined;
  }

  // Extract value type
  const memberType = getTstsDeclaredTypeNode(member);
  if (!memberType) {
    return undefined;
  }

  const valueType = ctx.typeSystem.typeFromSyntax(
    ctx.binding.captureTypeSyntax(memberType)
  );

  return { keyType, valueType };
};

const convertCallSignatureType = (
  node: TstsNode,
  ctx: ProgramContext
): IrFunctionType | undefined => {
  if (getTstsTypeParameterNodes(node).length > 0) {
    return undefined;
  }

  const returnTypeNode = getTstsDeclaredTypeNode(node);
  return {
    kind: "functionType",
    parameters: convertParameters(definedTstsNodes(getTstsParameters(node)), ctx),
    returnType: returnTypeNode
      ? ctx.typeSystem.typeFromSyntax(ctx.binding.captureTypeSyntax(returnTypeNode))
      : { kind: "voidType" },
  };
};

const extractCallableInterfaceOnlyType = (
  node: TstsNode,
  ctx: ProgramContext
): IrType | undefined => {
  if (getTstsTypeParameterNodes(node).length > 0) {
    return undefined;
  }
  if (getTstsHeritageClauseDetails(node).length > 0) {
    return undefined;
  }
  const members = definedTstsNodes(getTstsMemberNodes(node));
  if (members.length === 0) {
    return undefined;
  }
  if (!members.every((member) => TstsSyntax.IsCallSignatureDeclaration(member))) {
    return undefined;
  }

  const signatures: IrFunctionType[] = [];
  for (const member of members) {
    if (!TstsSyntax.IsCallSignatureDeclaration(member)) {
      return undefined;
    }
    const signature = convertCallSignatureType(member, ctx);
    if (!signature) {
      return undefined;
    }
    signatures.push(signature);
  }

  if (signatures.length === 0) {
    return undefined;
  }

  if (signatures.length === 1) {
    return signatures[0];
  }

  return {
    kind: "intersectionType",
    types: signatures,
  };
};

/**
 * Convert interface declaration
 * Returns a type alias for index-signature-only interfaces (lowered to Dictionary).
 */
export const convertInterfaceDeclaration = (
  node: TstsNode,
  ctx: ProgramContext
): IrInterfaceDeclaration | IrTypeAliasDeclaration | null => {
  // Check for index-signature-only interface → lower to type alias for dictionary
  const dictInfo = extractIndexSignatureOnlyInterface(node, ctx);
  if (dictInfo) {
    return {
      kind: "typeAliasDeclaration",
      name: getTstsNodeNameText(node) ?? "_",
      typeParameters: convertTypeParameters(
        definedTstsNodes(getTstsTypeParameterNodes(node)),
        ctx
      ),
      type: {
        kind: "dictionaryType",
        keyType: dictInfo.keyType,
        valueType: dictInfo.valueType,
      },
      isExported: hasExportModifier(node),
      isStruct: false,
    };
  }

  const callableType = extractCallableInterfaceOnlyType(node, ctx);
  if (callableType) {
    return {
      kind: "typeAliasDeclaration",
      name: getTstsNodeNameText(node) ?? "_",
      typeParameters: [],
      type: callableType,
      isExported: hasExportModifier(node),
      isStruct: false,
    };
  }
  // Detect source-proven struct marker in extends clause.
  let isStruct =
    isSourceTypeKind(
      ctx.sourceSemantics.getFact(node, sourceTypeSemanticsFactKey),
      "struct"
    );
  const extendsClause = getTstsHeritageClauseDetails(node).find(
    (h) => h.kind === "extends"
  );
  const extendsTypes =
    extendsClause?.types
      .filter((t): t is TstsNode => t !== undefined)
      .filter((t) => {
        if (isStructMarker(t, ctx)) {
          isStruct = true;
          return false; // Remove marker from extends
        }
        return true;
      })
      .map((t) =>
        ctx.typeSystem.typeFromSyntax(
          ctx.binding.captureTypeSyntax(unwrapInterfaceHeritageType(t, ctx))
        )
      ) ?? [];

  const allMembers = definedTstsNodes(getTstsMemberNodes(node))
    .map((m) => convertInterfaceMember(m, ctx))
    .filter((m): m is IrInterfaceMember => m !== null);

  // Filter out __brand property if this is a struct
  const finalMembers = isStruct
    ? allMembers.filter(
        (m) => m.kind !== "propertySignature" || m.name !== "__brand"
      )
    : allMembers;

  return {
    kind: "interfaceDeclaration",
    name: getTstsNodeNameText(node) ?? "_",
    typeParameters: convertTypeParameters(
      definedTstsNodes(getTstsTypeParameterNodes(node)),
      ctx
    ),
    extends: extendsTypes,
    members: finalMembers,
    isExported: hasExportModifier(node),
    isStruct,
  };
};
