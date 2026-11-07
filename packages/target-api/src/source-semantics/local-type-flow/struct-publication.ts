import { fieldFactKey, structFactKey, type Node } from "@tsonic/tsts";
import { Node_Initializer } from "../../source-model/ast.js";
import { sourceLiteralMemberCorrespondence } from "./literal-publication.js";
import { sourceTypeDescriptorMemberOriginsEqual } from "./member-origins.js";
import type { SourceEffectiveTypeOutcome, SourceLiteralMemberCorrespondence, SourceTypeDescriptor,
  SourceTypeFlowAnalysisContext } from "./types.js";

export function sourceStructMemberCorrespondence(context: SourceTypeFlowAnalysisContext, node: Node,
  type: SourceTypeDescriptor): readonly SourceLiteralMemberCorrespondence[] | undefined {
  const { ast, sourceFacts } = context.source;
  const fact = sourceFacts.getFact(node, structFactKey);
  if (fact?.valueType !== true || fact.fields === undefined) return undefined;
  const call = ast.is.IsCallExpression(node) ? node
    : ast.is.IsVariableDeclaration(node) || ast.is.IsPropertyDeclaration(node) ? Node_Initializer(ast, node) : undefined;
  if (call === undefined || !ast.is.IsCallExpression(call)) return undefined;
  const selected = sourceFacts.getFact(call, structFactKey);
  const fields = selected?.fields;
  const literal = ast.arguments(call)[0];
  if (selected?.valueType !== true || fields === undefined || fields.length !== fact.fields.length ||
    fields.some((field, index) => field.type !== fact.fields?.[index]?.type) ||
    literal === undefined || !ast.is.IsObjectLiteralExpression(literal)) return undefined;
  const properties = ast.properties(literal);
  if (properties.length !== fields.length) return undefined;
  const ordered: Node[] = [];
  for (const field of fields) {
    const fieldCall = ast.parent(field.type);
    const property = fieldCall === undefined ? undefined : ast.parent(fieldCall);
    if (fieldCall === undefined || !ast.is.IsCallExpression(fieldCall) || ast.typeArguments(fieldCall)[0] !== field.type ||
      property === undefined || !ast.is.IsPropertyAssignment(property) || Node_Initializer(ast, property) !== fieldCall ||
      !properties.includes(property) || ordered.includes(property) ||
      sourceFacts.getFact(fieldCall, fieldFactKey)?.type !== field.type ||
      sourceFacts.getFact(property, fieldFactKey)?.type !== field.type) return undefined;
    ordered.push(property);
  }
  // The destination is the struct value at `node`: its member selection is a host-input witness (R3).
  const correspondence = sourceLiteralMemberCorrespondence(context, literal, type, { destinationAt: node });
  if (correspondence === undefined) return undefined;
  const result: SourceLiteralMemberCorrespondence[] = [];
  for (const property of ordered) {
    const matches = correspondence.filter(pair => pair.property === property);
    if (matches.length !== 1 || result.some(pair => sourceTypeDescriptorMemberOriginsEqual(pair.origin, matches[0]!.origin))) {
      return undefined;
    }
    result.push(matches[0]!);
  }
  return Object.freeze(result);
}

export function publishSourceStructMemberCorrespondence(context: SourceTypeFlowAnalysisContext, nodes: readonly Node[],
  outcomes: WeakMap<Node, SourceEffectiveTypeOutcome>): void {
  for (const node of nodes) {
    const outcome = outcomes.get(node);
    if (outcome === undefined || outcome.kind === "refused" || outcome.provenance.occurrence !== node) continue;
    const memberCorrespondence = sourceStructMemberCorrespondence(context, node, outcome.type);
    if (memberCorrespondence !== undefined) outcomes.set(node, Object.freeze({ ...outcome, memberCorrespondence }));
  }
}
