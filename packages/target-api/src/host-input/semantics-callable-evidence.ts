// host-input/semantics-callable-evidence: the checker's single call signature of a callable type, as parameter and
// result evidence for the descriptor reader (host-input/descriptors.ts). Replaces the deleted standard-transformation
// selector; only this callable evidence had a Host-internal reader.
import type { AstReader, Node, Type, TypeSignatureInfo, TypeSignatureParameterInfo } from "@tsonic/tsts";
import type {
  SourceCallableParameterEvidence, SourceCallableTypeEvidence, SourceFinalTypeQueries, SourceSelectedDeclarationQueries,
  SourceTypeComponentEvidence,
} from "./semantics-types.js";

export function selectSourceCallableTypeEvidence(
  type: Type,
  types: Pick<SourceFinalTypeQueries, "signatureInfos"> & Pick<SourceSelectedDeclarationQueries, "signatureDeclaration">,
  ast: AstReader,
): SourceCallableTypeEvidence | undefined {
  const signatures = types.signatureInfos(type, "call");
  const signature = signatures.length === 1 ? signatures[0] : undefined;
  if (signature === undefined) return undefined;
  const result = signatureResultEvidence(signature, types, ast);
  return result === undefined ? undefined : Object.freeze({
    parameters: Object.freeze(signature.parameters.map(parameter => sourceCallableParameterEvidence(parameter, ast))),
    result,
  });
}

/** How a call may omit the parameter: required, omissible as undefined, defaulted by an initializer, or rest. */
export function sourceCallableParameterEvidence(
  parameter: TypeSignatureParameterInfo,
  ast: AstReader,
): SourceCallableParameterEvidence {
  const omissionKind = parameter.parameterKind === "rest" ? "rest"
    : parameter.declaration !== undefined && ast.is.IsParameterDeclaration(parameter.declaration) &&
        ast.as.AsParameterDeclaration(parameter.declaration)?.Initializer !== undefined ? "initializer"
    : parameter.acceptsOmission ? "undefined" : "required";
  return Object.freeze({ ...parameter, omissionKind });
}

function signatureResultEvidence(
  signature: TypeSignatureInfo,
  types: Pick<SourceSelectedDeclarationQueries, "signatureDeclaration">,
  ast: AstReader,
): SourceTypeComponentEvidence | undefined {
  const selectedType = signature.returnType;
  if (selectedType === undefined) return undefined;
  const declaration = types.signatureDeclaration(signature.signature);
  const authoredTypeNode: Node | undefined = declaration === undefined ? undefined : ast.typeNode(declaration);
  return Object.freeze({
    selectedType,
    ...(declaration === undefined ? {} : { declaration }),
    ...(authoredTypeNode === undefined ? {} : { authoredTypeNode }),
  });
}
