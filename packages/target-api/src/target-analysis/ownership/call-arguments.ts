import type { Node } from "@tsonic/tsts";
import type { SourceAnalysisProgram } from "../analysis-program.js";
import { sourceCallArgumentCorrespondences, type SourceCallArgumentCorrespondence } from "../../source-navigation/callable-arguments.js";

/** Argument-to-parameter rows of the navigation call witness at `call`, memoized per query (keyed by the call Node). */
export function createSourceCallArgumentCorrespondenceQuery(source: Pick<SourceAnalysisProgram, "ast" | "navigation">) {
  const correspondences = new Map<Node, readonly SourceCallArgumentCorrespondence[] | undefined>();
  return (call: Node): readonly SourceCallArgumentCorrespondence[] | undefined => {
    if (!correspondences.has(call)) correspondences.set(call,
      sourceCallArgumentCorrespondences({ ast: source.ast, navigation: source.navigation }, call));
    return correspondences.get(call);
  };
}
