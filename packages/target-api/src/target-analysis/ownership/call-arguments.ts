import type { TargetSourceProgram } from "../../source-model/program.js";
import type { ResolvedSourceCallInfo } from "../../source-navigation/call-info.js";
import { sourceCallArgumentCorrespondences, type SourceCallArgumentCorrespondence } from "../../source-navigation/callable-arguments.js";

export function createSourceCallArgumentCorrespondenceQuery(source: Pick<TargetSourceProgram, "ast" | "semantics">) {
  const correspondences = new Map<ResolvedSourceCallInfo, readonly SourceCallArgumentCorrespondence[] | undefined>();
  return (operation: ResolvedSourceCallInfo): readonly SourceCallArgumentCorrespondence[] | undefined => {
    if (!correspondences.has(operation)) correspondences.set(operation,
      sourceCallArgumentCorrespondences({ ast: source.ast, semantics: source.semantics.forNode(operation.call) }, operation));
    return correspondences.get(operation);
  };
}
