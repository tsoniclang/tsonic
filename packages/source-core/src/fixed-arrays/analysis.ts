import {
  sourceMarkerFactKey,
} from "@tsonic/tsts";
import type {
  ExtensionEvidence,
  Node,
  SourceAnalysisContext,
} from "@tsonic/tsts";
import {
  tsonicFixedArrayFactKey,
} from "./facts.js";
import {
  tsonicCoreSourceExtensionId,
} from "../identity.js";
import {
  forEachTsonicSourceFile,
} from "../analysis/context.js";
import {
  readSourceFact,
  visitPostOrder,
} from "../analysis/source-call.js";
import { selectTsonicFixedArray } from "./selection.js";

const fixedArrayEvidence = Object.freeze<readonly ExtensionEvidence[]>([{
  message: "source-core fixed-array type",
}]);

export function analyzeTsonicFixedArrayTypes(context: SourceAnalysisContext): void {
  forEachTsonicSourceFile(context, (sourceContext): void => {
    visitPostOrder(sourceContext.sourceFile, sourceContext, (node): void => {
      if (!sourceContext.ast.is.IsTypeReferenceNode(node)) {
        return;
      }
      const marker = readSourceFact(sourceContext, node, sourceMarkerFactKey);
      if (marker?.kind !== "type-marker" || marker.marker !== "fixed-array") {
        return;
      }
      const typeArguments = sourceContext.ast.typeArguments(node);
      const sourceType = sourceContext.checker.getTypeFromTypeNode(node);
      const selected = sourceType === undefined ? undefined : selectTsonicFixedArray(
        sourceType,
        sourceContext,
        { getFact: (subject, key) => readSourceFact(sourceContext, subject, key) },
        { authoredTypeNode: node },
      );
      if (selected?.kind !== "selected") {
        const lengthType = typeArguments[1] ?? node;
        sourceContext.diagnostics.append({
          extensionId: tsonicCoreSourceExtensionId,
          extensionCode: "SOURCE_CORE_FIXED_ARRAY_LENGTH_NOT_LITERAL",
          numericCode: 9901160,
          publicCode: "TSONIC_SOURCE_CORE_9901160",
          category: "error",
          message: selected?.reason ?? "FixedArray requires its exact resolved provider type and type arguments.",
          nodeOrSpan: lengthType,
          evidence: fixedArrayEvidence,
          identity: fixedArrayDiagnosticIdentity(lengthType, sourceContext.ast),
        });
        return;
      }
      const fact = selected.fact;
      sourceContext.facts.set(node, tsonicFixedArrayFactKey, fact, fixedArrayEvidence);
      const typeName = sourceContext.ast.as.AsTypeReferenceNode(node)?.TypeName;
      if (typeName !== undefined) {
        sourceContext.facts.set(typeName, tsonicFixedArrayFactKey, fact, fixedArrayEvidence);
      }
    });
  });
}

function fixedArrayDiagnosticIdentity(
  node: Node,
  ast: SourceAnalysisContext["source"]["ast"],
): string {
  const sourceFile = ast.getSourceFile(node);
  return [
    "source-core-fixed-array-length",
    ast.getPath(sourceFile),
    ast.pos(node),
    ast.end(node),
  ].join(":");
}
