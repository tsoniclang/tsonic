import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../source-semantics/types.js";
import { Node_Expression, sourceEnclosingCallable } from "../source-navigation/index.js";
import type { SourceStorageQueries } from "./source-storage/model/types.js";

export interface SourceConstructorResultIssue {
  readonly code: "TSONIC_CONSTRUCTOR_RESULT_NOT_SUPPORTED" | "TSONIC_CONSTRUCTOR_RESULT_NOT_PROVEN";
  readonly category: "error";
  readonly source: "tsonic";
  readonly sourceNode?: Node;
  readonly message: string;
}

export function analyzeSourceConstructorResults(
  source: TargetSourceProgram,
  storage: SourceStorageQueries,
): readonly SourceConstructorResultIssue[] {
  const issues: SourceConstructorResultIssue[] = [];
  const unproven = (reason: string, sourceNode?: Node): void => {
    issues.push(Object.freeze({ code: "TSONIC_CONSTRUCTOR_RESULT_NOT_PROVEN", category: "error",
      source: "tsonic", sourceNode, message: `Constructor result receiver identity is not proven: ${reason}` }));
  };
  if (storage.source !== source) {
    unproven("Source storage belongs to a different checked source program.");
    return Object.freeze(issues);
  }
  const failure = storage.failureReason();
  if (failure !== undefined) {
    unproven(failure);
    return Object.freeze(issues);
  }
  const { ast } = source;
  for (const statement of storage.nodes) {
    if (!ast.is.IsReturnStatement(statement)) continue;
    const declaration = sourceEnclosingCallable(ast.parent(statement), ast);
    if (declaration === undefined || !ast.is.IsConstructorDeclaration(declaration) || ast.body(declaration) === undefined) continue;
    const expression = Node_Expression(ast, statement);
    if (expression === undefined) continue;
    const receiver = storage.subject(declaration, "receiver");
    if (receiver.kind === "unresolved") {
      unproven(receiver.reason, expression);
      continue;
    }
    const returned = storage.subjectFor(expression);
    if (returned.kind === "unresolved") {
      unproven(returned.reason, expression);
      continue;
    }
    const context = storage.bindingsForDeclaration(declaration);
    if (context.kind === "unresolved") {
      unproven(context.reason, expression);
      continue;
    }
    const boundaries = [receiver.subject];
    const expected = storage.boundValueFrontierFor(receiver.subject, context.bindings, boundaries);
    if (expected.kind === "unresolved") {
      unproven(expected.reason, expression);
      continue;
    }
    const selected = storage.boundValueFrontierFor(returned.subject, context.bindings, boundaries);
    if (selected.kind === "unresolved") {
      unproven(selected.reason, expression);
      continue;
    }
    if (expected.frontier.length === 0 || expected.frontier.some(value => value.kind !== "boundary" || value.subject !== receiver.subject)) {
      unproven("The actual constructor receiver has no completed identity frontier.", expression);
      continue;
    }
    const sameReceiver = (value: typeof selected.frontier[number]): boolean => value.kind === "boundary" &&
      value.subject === receiver.subject && expected.frontier.some(receiver => receiver.subject === value.subject && receiver.bindings === value.bindings);
    if (selected.frontier.length !== 0 && selected.frontier.every(sameReceiver)) continue;
    let reason: string | undefined;
    for (const value of selected.frontier) {
      if (sameReceiver(value)) continue;
      const domain = storage.storageProducersFor(value.subject, value.bindings);
      if (domain.kind === "unresolved") { reason = domain.reason; break; }
      if (domain.kind === "open") {
        reason = `The returned value has an open source storage domain: ${[...new Set(domain.boundaries.map(boundary => boundary.kind))].join(", ")}.`;
        break;
      }
    }
    if (reason !== undefined) {
      unproven(reason, expression);
      continue;
    }
    issues.push(Object.freeze({ code: "TSONIC_CONSTRUCTOR_RESULT_NOT_SUPPORTED", category: "error", source: "tsonic",
      sourceNode: expression, message: "A constructor that returns an object other than its receiver is not supported." }));
  }
  return Object.freeze(issues);
}
