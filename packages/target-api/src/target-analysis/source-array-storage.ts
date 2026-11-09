import type { Node } from "@tsonic/tsts";
import type { SourceMemberUse } from "../source-model/member-use.js";
import type { SourceClosedArrayStorage, SourceMemoryQueries } from "../source-model/memory.js";
import type { SourceStorageQueries } from "../source-model/program.js";
import type { SourceStorageBindings } from "../source-model/storage.js";
import { sourceTransparentExpressionOperand } from "../source-navigation/ast.js";
import type { SourceStorageBudget } from "./source-storage/model/resource-budget.js";

export function createSourceClosedArrayStorageQueries(input: {
  readonly storage: SourceStorageQueries;
  readonly budget: SourceStorageBudget;
}): SourceMemoryQueries["closedArrayStorage"] {
  const { storage, budget } = input;
  const { source } = storage;
  const { ast, facts } = source;
  const retained = new WeakMap<Node, WeakMap<SourceStorageBindings, SourceClosedArrayStorage>>();
  const resolved = (value: SourceClosedArrayStorage) => Object.freeze({ kind: "resolved" as const, value });
  const unproven = (reason: string) => resolved(Object.freeze({ kind: "unproven" as const, reason }));
  function owner(node: Node): Node | undefined {
    for (let parent = ast.parent(node); parent !== undefined; parent = ast.parent(parent)) {
      if (!budget.step()) return undefined;
      if (facts.navigation.callableRoles(parent).signature || ast.is.IsClassDeclaration(parent) || ast.is.IsClassExpression(parent)) return parent;
    }
    return undefined;
  }
  function outer(node: Node): { readonly value: Node; readonly parent: Node | undefined } {
    for (;;) {
      const parent = ast.parent(node);
      if (parent === undefined || sourceTransparentExpressionOperand(ast, parent) !== node) return { value: node, parent };
      if (!budget.step()) return { value: node, parent: undefined };
      node = parent;
    }
  }
  const resolve: SourceMemoryQueries["closedArrayStorage"]["resolve"] = (occurrence, bindings) => budget.withRows(rows => {
    facts.navigation.callableRoles(occurrence);
    const valid = storage.contextKeyFor([], bindings);
    if (valid.kind !== "resolved") return valid;
    const previous = retained.get(occurrence)?.get(bindings);
    if (previous !== undefined) return resolved(previous);
    if (!ast.is.IsElementAccessExpression(occurrence)) return unproven("Native element storage requires an exact nonoptional local array access.");
    const selected = facts.objects.use(occurrence);
    if (selected.kind === "refused") return selected;
    const callable = owner(occurrence);
    if (selected.value.optionalChain || selected.value.chainContinuation || callable === undefined)
      return unproven("Native element storage requires an exact nonoptional local array access.");
    const subject = storage.subjectFor(selected.value.receiver.occurrence);
    if (subject.kind !== "resolved") return subject;
    const origins = storage.closedOriginsFor(subject.subject, bindings);
    if (origins.kind === "unresolved" || origins.kind === "refused") return origins;
    if (origins.kind === "open") return unproven("Native array storage requires its complete closed original storage domain.");
    const literals = new Set<Node>();
    for (const origin of origins.origins) {
      if (!budget.step() || !rows.add(1)) return Object.freeze({ kind: "unresolved", reason: budget.failure()! });
      if (origin.subject.kind !== "value" || origin.subject.projection.length !== 0 || !ast.is.IsArrayLiteralExpression(origin.subject.node) ||
        owner(origin.subject.node) !== callable) return unproven("Native array storage requires dense, non-spread local literal origins.");
      for (const element of ast.elements(origin.subject.node)) {
        if (!budget.step()) return Object.freeze({ kind: "unresolved", reason: budget.failure()! });
        if (element === undefined || ast.is.IsOmittedExpression(element) || ast.is.IsSpreadElement(element))
          return unproven("Native array storage requires dense, non-spread literal origins.");
      }
      literals.add(origin.subject.node);
    }
    const declarations = new Set<Node>();
    const references = new Set<Node>();
    const elements = new Map<Node, SourceMemberUse>([[occurrence, selected.value]]);
    const pending = [selected.value.receiver.occurrence];
    const visited = new Set<Node>();
    while (pending.length !== 0) {
      if (!budget.step() || !rows.add(1)) return Object.freeze({ kind: "unresolved", reason: budget.failure()! });
      const node = pending.pop()!;
      if (visited.has(node)) continue;
      visited.add(node);
      if (owner(node) !== callable) return unproven("Native array storage cannot cross an unproved callable boundary.");
      const operand = sourceTransparentExpressionOperand(ast, node);
      if (operand !== undefined) { pending.push(operand); continue; }
      if (ast.is.IsIdentifier(node)) {
        const declaration = facts.navigation.sourceReferenceFor(node)?.declaration;
        if (declaration === undefined) return unproven("Native array alias lacks an exact declaration.");
        references.add(node); pending.push(declaration); continue;
      }
      if (ast.is.IsArrayLiteralExpression(node)) {
        if (!literals.has(node)) return unproven("Native array aliases must retain the same canonical closed origin domain.");
        continue;
      }
      if (!ast.is.IsVariableDeclaration(node) || !ast.is.IsIdentifier(ast.name(node)))
        return unproven("Native array storage requires plain initialized local bindings.");
      const initializer = ast.as.AsVariableDeclaration(node)?.Initializer;
      const statement = ast.parent(ast.parent(node));
      const uses = facts.navigation.declarationUseSummary(node);
      if (initializer === undefined || uses.exported || !ast.is.IsVariableStatement(statement) || !ast.is.IsBlock(ast.parent(statement)))
        return unproven("Native array storage requires initialized block-local bindings.");
      declarations.add(node); pending.push(initializer);
      for (const use of uses.uses) {
        if (!budget.step() || !rows.add(1)) return Object.freeze({ kind: "unresolved", reason: budget.failure()! });
        if (use.kind === "type-only" || use.kind === "source-linkage") continue;
        if (owner(use.reference) !== callable) return unproven("Native array storage has an unproved capture.");
        references.add(use.reference);
        const { value, parent } = outer(use.reference);
        if (parent !== undefined && ast.is.IsVariableDeclaration(parent) && ast.as.AsVariableDeclaration(parent)?.Initializer === value) {
          pending.push(parent); continue;
        }
        if (parent !== undefined && ast.is.IsBinaryExpression(parent)) {
          const operation = facts.values.operation(parent);
          if (operation.kind === "refused") return operation;
          if (operation.value.kind === "assignment") {
            if (!ast.is.IsExpressionStatement(outer(parent).parent))
              return unproven("Native array replacement cannot expose an unproved assignment result.");
            const other = operation.value.target === value ? operation.value.source.occurrence
              : operation.value.source.occurrence === value ? operation.value.target : undefined;
            if (other !== undefined) { pending.push(other); continue; }
          }
        }
        if (parent === undefined || !ast.is.IsElementAccessExpression(parent))
          return unproven("Native array storage has an unproved escape, property operation, deletion or resize.");
        const element = facts.objects.use(parent);
        if (element.kind === "refused") return element;
        const result = facts.navigation.expressionResultDisposition(parent);
        let callCallee = false;
        if (ast.is.IsCallExpression(result.use) || ast.is.IsNewExpression(result.use)) {
          const application = facts.applications.application(result.use);
          if (application.kind === "refused") return application;
          callCallee = application.value.callee.occurrence === outer(parent).value;
        }
        if (element.value.receiver.occurrence !== value || element.value.optionalChain || element.value.chainContinuation ||
          callCallee || ast.is.IsDeleteExpression(outer(parent).parent))
          return unproven("Native array storage has an unproved escape, property operation, deletion or resize.");
        elements.set(parent, element.value);
      }
    }
    if (literals.size === 0 || declarations.size === 0) return unproven("Native array storage has no initialized local allocation.");
    const result: SourceClosedArrayStorage = Object.freeze({ kind: "closed", declarations: Object.freeze([...declarations]),
      references: Object.freeze([...references]), literals: Object.freeze([...literals]), elements: Object.freeze([...elements.values()]) });
    let byBindings = retained.get(occurrence);
    if (byBindings === undefined) { byBindings = new WeakMap(); retained.set(occurrence, byBindings); }
    byBindings.set(bindings, result);
    return resolved(result);
  });
  return Object.freeze({ resolve });
}
