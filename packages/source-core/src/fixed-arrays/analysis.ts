import {
  sourceMarkerFactKey,
} from "@tsonic/tsts";
import type {
  ExtensionEvidence,
  ExtensionFactResolution,
  ExtensionFactResolverContext,
  ExtensionFactSubject,
  Node,
  SourceAnalysisContext,
} from "@tsonic/tsts";
import { isAstNode } from "@tsonic/target-api/source";
import {
  tsonicFixedArrayFactKey,
} from "./facts.js";
import type { TsonicFixedArrayFact } from "./facts.js";
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
      if (!sourceContext.ast.is.IsTypeReferenceNode(node)) return;
      const fact = sourceContext.factResolver.resolve(node, tsonicFixedArrayFactKey);
      if (fact === undefined) return;
      const typeName = sourceContext.ast.as.AsTypeReferenceNode(node)?.TypeName;
      if (typeName !== undefined) {
        sourceContext.facts.set(typeName, tsonicFixedArrayFactKey, fact, fixedArrayEvidence);
      }
    });
  });
}

export function resolveTsonicFixedArrayType(
  subject: ExtensionFactSubject,
  context: ExtensionFactResolverContext,
): ExtensionFactResolution<TsonicFixedArrayFact> | undefined {
  const { ast } = context.source;
  if (!isAstNode(ast, subject) || !ast.is.IsTypeReferenceNode(subject)) return undefined;
  const marker = readSourceFact(context, subject, sourceMarkerFactKey);
  if (marker?.kind !== "type-marker" || marker.marker !== "fixed-array") return undefined;
  const source = context.source.getSourceFileQueries(ast.getSourceFile(subject));
  const sourceType = source.checker.getTypeFromTypeNode(subject);
  const selected = sourceType === undefined ? undefined : selectTsonicFixedArray(
    sourceType, source,
    { getFact: (node, key) => readSourceFact(context, node, key) },
    { authoredTypeNode: subject },
  );
  if (selected?.kind === "selected") return { value: selected.fact, evidence: fixedArrayEvidence };
  const lengthType = ast.typeArguments(subject)[1] ?? subject;
  context.diagnostics.append({
    extensionId: tsonicCoreSourceExtensionId,
    extensionCode: "SOURCE_CORE_FIXED_ARRAY_LENGTH_NOT_LITERAL",
    numericCode: 9901160,
    publicCode: "TSONIC_SOURCE_CORE_9901160",
    category: "error",
    message: selected?.reason ?? "FixedArray requires its exact resolved provider type and type arguments.",
    nodeOrSpan: lengthType,
    evidence: fixedArrayEvidence,
    identity: fixedArrayDiagnosticIdentity(lengthType, ast),
  });
  return undefined;
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
