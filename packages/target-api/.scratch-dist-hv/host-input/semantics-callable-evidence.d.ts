import type { AstReader, Type, TypeSignatureParameterInfo } from "@tsonic/tsts";
import type { SourceCallableParameterEvidence, SourceCallableTypeEvidence, SourceFinalTypeQueries, SourceSelectedDeclarationQueries } from "./semantics-types.js";
export declare function selectSourceCallableTypeEvidence(type: Type, types: Pick<SourceFinalTypeQueries, "signatureInfos"> & Pick<SourceSelectedDeclarationQueries, "signatureDeclaration">, ast: AstReader): SourceCallableTypeEvidence | undefined;
/** How a call may omit the parameter: required, omissible as undefined, defaulted by an initializer, or rest. */
export declare function sourceCallableParameterEvidence(parameter: TypeSignatureParameterInfo, ast: AstReader): SourceCallableParameterEvidence;
//# sourceMappingURL=semantics-callable-evidence.d.ts.map