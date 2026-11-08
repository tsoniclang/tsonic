import type { Node } from "@tsonic/tsts";
import { analyzeSourceLiteralValues } from "../literal-values.js";
import type { SourceLiteralValue } from "../../source-model/literals/value.js";
import type { SourceTypeFlowAnalysisContext, SourceTypeFlowSource } from "./types.js";
import type { SourceDescriptorProductionHooks } from "../descriptor-contracts.js";
import { sourcePrimitiveOperatorLiteralFits } from "./operator-decisions.js";
import { sourceTypeFlowTypeSyntax, sourceTypeFlowValueSyntax } from "./value-syntax.js";
import { createSourceLiteralDomainQueries } from "./literal-domains.js";
import { sourceApplicationStaticReceiver } from "./application-references.js";
import type { SourceObjectProductionQueries } from "../../host-input/program-input.js";

export type SourceTypeFlowProducers = Pick<SourceTypeFlowAnalysisContext,
  "declared" | "value" | "place" | "destination" | "application" | "operation" | "callableReturn"> & {
  readonly hooks: SourceDescriptorProductionHooks;
  readonly syntaxValue: SourceTypeFlowAnalysisContext["value"];
  readonly memberDestination: SourceObjectProductionQueries["memberDestination"];
  readonly memberValue: SourceObjectProductionQueries["memberValue"];
};

export function createSourceTypeFlowAnalysisContext(source: SourceTypeFlowSource,
  producers: SourceTypeFlowProducers): SourceTypeFlowAnalysisContext {
  const { ast, input } = source;
  const nodes: Node[] = [];
  const values: Node[] = [];
  const orders = new WeakMap<Node, number>();
  const pending: { readonly node: Node; readonly typeOnly: boolean; readonly runtime: boolean }[] =
    [...source.sourceFiles].reverse().map(node => ({ node, typeOnly: false, runtime: !node.IsDeclarationFile }));
  const seen = new Set<Node>();
  const staticReceivers = new Set<Node>();
  for (const node of source.navigation.nodesForFiles(source.sourceFiles)) {
    if (!ast.is.IsCallExpression(node) && !ast.is.IsNewExpression(node)) continue;
    const selection = input.application(node);
    const candidates = selection.kind === "applicable" ? [selection.selection] : selection.kind === "conditional-candidates" ? selection.candidates : [];
    if (candidates.length === 0 || !candidates.every(candidate => sourceApplicationStaticReceiver(source, candidate.application) !== undefined)) continue;
    for (const candidate of candidates) if (candidate.application.receiver !== undefined) staticReceivers.add(candidate.application.receiver.occurrence);
  }
  while (pending.length > 0) {
    const entry = pending.pop()!;
    const { node } = entry;
    if (seen.has(node)) throw new Error("A Source syntax inventory must be a tree of original occurrences.");
    seen.add(node);
    input.assertNode(node);
    const typeOnly = entry.typeOnly || sourceTypeFlowTypeSyntax(ast, node);
    orders.set(node, nodes.length);
    nodes.push(node);
    if (entry.runtime && !typeOnly && !staticReceivers.has(node) && (sourceTypeFlowValueSyntax(ast, node) || ast.is.IsFunctionDeclaration(node))) values.push(node);
    const children = ast.children(node);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      const child = children[index];
      if (child !== undefined) pending.push({ node: child, typeOnly, runtime: entry.runtime });
    }
  }
  const literals = analyzeSourceLiteralValues(ast, source.sourceFiles).literalValue;
  const reader = source.createDescriptorReader(producers.hooks);
  const domains = createSourceLiteralDomainQueries({ ast, input, builder: source.descriptorBuilder,
    value: node => producers.value(node, []), syntaxValue: node => producers.syntaxValue(node, []) });
  const propertyName = source.createPropertyNameQuery(domains);
  const objects = source.createObjects({ place: producers.place, value: producers.value, declared: producers.declared,
    memberDestination: producers.memberDestination, memberValue: producers.memberValue });
  return Object.freeze({ source, reader, objects, nodes: Object.freeze(nodes), values: Object.freeze(values),
    ...producers, literal: (node: Node) => literals.get(node), propertyName,
    order(node: Node) {
      input.assertNode(node);
      const preorder = orders.get(node);
      if (preorder === undefined) throw new Error("A Source graph ordering question requires its enrolled original node.");
      return Object.freeze({ start: preorder, preorder });
    },
  });
}

export type SourceTypeFlowNumericLiteralDecision =
  | { readonly kind: "resolved"; readonly primitive: "int64" | "float64" }
  | { readonly kind: "refused"; readonly reason: string };

export function sourceTypeFlowNumericLiteralKind(literal: SourceLiteralValue): SourceTypeFlowNumericLiteralDecision {
  const numeric = literal.numeric;
  if (numeric?.kind === "checked-float64" || numeric?.kind === "authored" && /[.eE]/u.test(numeric.token.decimalText)) {
    return Object.freeze({ kind: "resolved", primitive: "float64" });
  }
  if (sourcePrimitiveOperatorLiteralFits(literal, "int64")) return Object.freeze({ kind: "resolved", primitive: "int64" });
  return Object.freeze({ kind: "refused",
    reason: "An unbound integer literal is outside the exact 'int64' range. Annotate it with an exact native type or use bigint." });
}
