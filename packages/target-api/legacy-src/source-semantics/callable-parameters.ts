import type { AstReader, TypeSignatureParameterInfo } from "@tsonic/tsts";
import type { SourceCallableParameterEvidence } from "./types.js";

export function sourceCallableParameterEvidence(
  parameter: TypeSignatureParameterInfo,
  ast: AstReader,
): SourceCallableParameterEvidence {
  const omissionKind = parameter.parameterKind === "rest"
    ? "rest"
    : parameter.declaration !== undefined &&
        ast.is.IsParameterDeclaration(parameter.declaration) &&
        ast.as.AsParameterDeclaration(parameter.declaration)?.Initializer !== undefined
      ? "initializer"
      : parameter.acceptsOmission ? "undefined" : "required";
  return Object.freeze({ ...parameter, omissionKind });
}
