import type {
  Node,
  TypeTupleElementInfo,
} from "@tsonic/tsts";
import type {
  SourceContextualTupleLiteralSelection,
  SourceFileSemantics,
} from "./types.js";

export function selectSourceContextualTupleLiteral(
  semantics: SourceFileSemantics,
  node: Node,
  presentElementCount: number,
): SourceContextualTupleLiteralSelection {
  if (!Number.isSafeInteger(presentElementCount) || presentElementCount < 0) {
    throw new Error(
      "Contextual tuple-literal selection requires a non-negative safe present-element count.",
    );
  }
  const contextual = semantics.selectContextualValueType(node);
  if (contextual.kind !== "selected" || !semantics.isTuple(contextual.type)) {
    return { kind: "unavailable" };
  }
  const elements = semantics.getTupleElementInfos(contextual.type);
  if (
    presentElementCount > elements.length ||
    elements.some((element) =>
      element.elementKind !== "required" && element.elementKind !== "optional"
    )
  ) {
    return { kind: "unavailable" };
  }
  const omittedOptionalElementIndexes = elements.flatMap((element, index) =>
    index >= presentElementCount && element.elementKind === "optional"
      ? [index]
      : []
  );
  if (
    omittedOptionalElementIndexes.length !==
      elements.length - presentElementCount
  ) {
    return { kind: "unavailable" };
  }
  return Object.freeze({
    kind: "selected",
    type: contextual.type,
    elements: Object.freeze(elements.slice()) as readonly TypeTupleElementInfo[],
    omittedOptionalElementIndexes: Object.freeze(
      omittedOptionalElementIndexes,
    ),
  });
}
