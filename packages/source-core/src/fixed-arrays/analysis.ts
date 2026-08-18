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
      if (typeArguments.length !== 2) {
        return;
      }
      const elementType = typeArguments[0];
      const lengthType = typeArguments[1];
      if (elementType === undefined || lengthType === undefined) {
        return;
      }
      const length = fixedArrayLength(lengthType, sourceContext.ast);
      if (length === undefined) {
        sourceContext.diagnostics.append({
          extensionId: tsonicCoreSourceExtensionId,
          extensionCode: "SOURCE_CORE_FIXED_ARRAY_LENGTH_NOT_LITERAL",
          numericCode: 9901160,
          publicCode: "TSONIC_SOURCE_CORE_9901160",
          category: "error",
          message: "FixedArray<T, N> requires N to be one exact non-negative safe integer literal type.",
          nodeOrSpan: lengthType,
          evidence: fixedArrayEvidence,
          identity: fixedArrayDiagnosticIdentity(lengthType, sourceContext.ast),
        });
        return;
      }
      const fact = Object.freeze({ elementType, length });
      sourceContext.facts.set(node, tsonicFixedArrayFactKey, fact, fixedArrayEvidence);
      const typeName = sourceContext.ast.as.AsTypeReferenceNode(node)?.TypeName;
      if (typeName !== undefined) {
        sourceContext.facts.set(typeName, tsonicFixedArrayFactKey, fact, fixedArrayEvidence);
      }
    });
  });
}

function fixedArrayLength(
  typeNode: Node,
  ast: SourceAnalysisContext["source"]["ast"],
): number | undefined {
  if (!ast.is.IsLiteralTypeNode(typeNode)) {
    return undefined;
  }
  const literal = ast.as.AsLiteralTypeNode(typeNode)?.Literal;
  if (literal === undefined || !ast.is.IsNumericLiteral(literal)) {
    return undefined;
  }
  const value = Number(ast.text(literal).split("_").join(""));
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
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
