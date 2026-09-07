import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import type {
  Node,
  ProviderSignatureDeclaration,
  ProviderTypeParameterDeclaration,
  ProviderTypeExpression,
  ReadonlySourceFactResolver,
} from "@tsonic/tsts";

export type SourceProviderSignatureSelection =
  | { readonly kind: "available"; readonly signature: ProviderSignatureDeclaration;
      readonly typeParameters: readonly SourceProviderTypeParameterSelection[] }
  | { readonly kind: "invalid"; readonly reason: string };

export interface SourceProviderTypeParameterSelection {
  readonly scope: "export" | "signature";
  readonly ownerId: string;
  readonly index: number;
  readonly parameter: ProviderTypeParameterDeclaration;
}

export function selectSourceProviderSignature(
  facts: ReadonlySourceFactResolver,
  declaration: Node | undefined,
): SourceProviderSignatureSelection | undefined {
  const identity = facts.getFact(declaration, providerVirtualDeclarationFactKey);
  if (identity === undefined) return undefined;
  const invalid = (reason: string): SourceProviderSignatureSelection =>
    Object.freeze({ kind: "invalid", reason });
  if (identity.exportId === undefined || identity.signatureId === undefined) {
    return invalid("The selected provider callable has no exact export/signature identity.");
  }
  const document = facts.getVirtualDeclarationDocument(identity.artifactFileName);
  if (document === undefined || document.provider.id !== identity.providerId ||
      document.provider.version !== identity.providerVersion ||
      document.moduleSpecifier !== identity.moduleSpecifier ||
      document.providerModuleId !== identity.providerModuleId) {
    return invalid("The selected provider callable does not match its retained declaration document.");
  }
  const exports = document.declarationModel.exports.filter(value => value.id === identity.exportId);
  if (exports.length !== 1) return invalid("The selected provider export identity is missing or ambiguous.");
  const exported = exports[0]!;
  const members = identity.memberId === undefined ? [] :
    (exported.members ?? []).filter(value => value.id === identity.memberId);
  if (identity.memberId !== undefined && (members.length !== 1 ||
      (identity.memberStatic !== undefined && (members[0]!.static === true) !== identity.memberStatic))) {
    return invalid("The selected provider member identity is missing, ambiguous or contradictory.");
  }
  const selected = identity.memberId === undefined ? exported : members[0]!;
  const signatures: Extract<SourceProviderSignatureSelection, { kind: "available" }>[] = [];
  const seen = new Set<ProviderTypeExpression>();
  let visits = 0;
  let exceeded = false;
  type ParameterScope = ReadonlyMap<string, SourceProviderTypeParameterSelection>;
  const extendScope = (parent: ParameterScope, scope: SourceProviderTypeParameterSelection["scope"],
    ownerId: string, parameters: readonly ProviderTypeParameterDeclaration[] = []): ParameterScope => {
    const result = new Map(parent);
    for (const [index, parameter] of parameters.entries()) {
      result.set(parameter.name, Object.freeze({ scope, ownerId, index, parameter }));
    }
    return result;
  };
  const visitType = (type: ProviderTypeExpression | undefined, depth: number, scope: ParameterScope): void => {
    if (type === undefined || seen.has(type) || exceeded) return;
    if (depth > 128 || ++visits > 131_072) { exceeded = true; return; }
    seen.add(type);
    switch (type.kind) {
      case "function":
        visitSignature(type, depth + 1, scope);
        break;
      case "array": visitType(type.elementType, depth + 1, scope); break;
      case "tuple": type.elementTypes.forEach(value => visitType(value, depth + 1, scope)); break;
      case "union":
      case "intersection": type.types.forEach(value => visitType(value, depth + 1, scope)); break;
      case "provider-ref":
      case "source-global": type.typeArguments?.forEach(value => visitType(value, depth + 1, scope)); break;
    }
  };
  const visitSignature = (signature: ProviderSignatureDeclaration, depth: number, parent: ParameterScope): void => {
    const scope = extendScope(parent, "signature", signature.id, signature.typeParameters);
    if (signature.id === identity.signatureId) signatures.push(Object.freeze({ kind: "available", signature,
      typeParameters: Object.freeze([...scope.values()]) }));
    signature.parameters.forEach(parameter => {
      visitType(parameter.type, depth + 1, scope);
      visitType(parameter.defaultType, depth + 1, scope);
    });
    visitType(signature.returnType, depth + 1, scope);
    signature.typeParameters?.forEach(parameter => {
      parameter.constraints?.forEach(type => visitType(type, depth + 1, scope));
      visitType(parameter.defaultType, depth + 1, scope);
    });
  };
  const scope = extendScope(new Map(), "export", exported.id, exported.typeParameters);
  const memberScope = identity.memberId === undefined || members[0]?.static === true || exported.kind === "namespace"
    ? new Map() : scope;
  selected.signatures?.forEach(signature => visitSignature(signature, 0, memberScope));
  visitType(selected.type, 0, identity.memberId === undefined ? scope : memberScope);
  if (exceeded) return invalid("The selected provider callable exceeds the retained type traversal budget.");
  return signatures.length === 1
    ? signatures[0]!
    : invalid("The selected provider signature identity is missing or ambiguous.");
}
