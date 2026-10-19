import { providerVirtualDeclarationFactKey } from "@tsonic/tsts";
import type { Node, ProviderTypeExpression } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "../../analysis/context.js";
import { readSourceFact } from "../../analysis/source-call.js";

export function memoryProviderFieldType(
  context: TsonicSourceFileAnalysisContext,
  annotation: Node,
): { readonly type: ProviderTypeExpression | undefined } | undefined {
  const declaration = context.ast.parent(annotation);
  if (!context.ast.is.IsPropertySignatureDeclaration(declaration) && !context.ast.is.IsPropertyDeclaration(declaration)) return undefined;
  const identity = readSourceFact(context, declaration, providerVirtualDeclarationFactKey);
  if (identity === undefined) return undefined;
  const invalid = { type: undefined };
  if (identity.exportId === undefined || identity.memberId === undefined) return invalid;
  const document = context.factResolver.getVirtualDeclarationDocument(identity.artifactFileName);
  if (document === undefined || document.provider.id !== identity.providerId ||
      document.provider.version !== identity.providerVersion || document.moduleSpecifier !== identity.moduleSpecifier ||
      document.providerModuleId !== identity.providerModuleId) return invalid;
  const matchingExports = document.declarationModel.exports.filter(value => value.id === identity.exportId);
  if (matchingExports.length !== 1) return invalid;
  const members = matchingExports[0]!.members?.filter(value => value.id === identity.memberId) ?? [];
  if (members.length !== 1 || members[0]!.kind !== "property" ||
      identity.memberStatic !== undefined && identity.memberStatic !== (members[0]!.static === true)) return invalid;
  return { type: members[0]!.type };
}
