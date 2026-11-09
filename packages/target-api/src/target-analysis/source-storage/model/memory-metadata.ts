import type { Node } from "@tsonic/tsts";
import type { SourceMemoryQueries, SourceMemoryMetadata, SourceMemoryMetadataDeclaration, SourceMemorySelection } from "../../../source-model/memory.js";
import type { SourceStorageQueries } from "../../../source-model/program.js";
import type { SourcePresence } from "../../../public/source/contracts.js";
import type { SourceStorageBindings } from "../../../source-model/storage.js";
import { sourceTransparentExpressionOperand } from "../../../source-navigation/ast.js";
import type { SourceMemoryMetadataProduction } from "../../source-memory-metadata.js";
import type { SourceMemoryEnvironments } from "./memory-environments.js";
import type { SourceStorageBudget } from "./resource-budget.js";

export function createSourceStorageMemoryMetadata(input: {
  readonly storage: SourceStorageQueries;
  readonly metadata: SourceMemoryMetadataProduction;
  readonly environments: SourceMemoryEnvironments;
  readonly budget: SourceStorageBudget;
}): SourceMemoryQueries["memoryMetadata"] {
  const { storage, metadata, environments, budget } = input;
  const { source } = storage;
  const { ast, facts } = source;
  const retained = new WeakMap<Node, WeakMap<SourceStorageBindings, SourcePresence<SourceMemoryMetadata>>>();
  const declarations = new WeakMap<Node, WeakMap<SourceStorageBindings, SourceMemoryMetadataDeclaration>>();
  const retainedRows = budget.createRows();
  const none = Object.freeze({ kind: "none" } as const);
  const resolved = <Value>(value: Value): SourceMemorySelection<Value> => Object.freeze({ kind: "resolved", value });
  const unresolved = (reason: string) => Object.freeze({ kind: "unresolved" as const, reason });
  const direct = (occurrence: Node, bindings: SourceStorageBindings): SourceMemorySelection<SourcePresence<SourceMemoryMetadata>> => budget.withRows(rows => {
    const seen = new Set<Node>();
    const selected = new Set<SourceMemoryMetadata>();
    let current: Node | undefined = occurrence;
    while (current !== undefined && !seen.has(current)) {
      if (!budget.step() || !rows.add(1)) return unresolved(budget.failure()!);
      seen.add(current);
      if (ast.is.IsVariableDeclaration(current) && ast.variableDeclarationKind(current) !== "const") break;
      const contexts = environments.environments(current, bindings);
      if (contexts.kind !== "resolved") return contexts;
      for (const environment of contexts.value) {
        const original = metadata.value(current, environment);
        if (original.kind !== "resolved") return original;
        if (original.value.kind === "present") {
          if (!rows.add(1)) return unresolved(budget.failure()!);
          selected.add(original.value.value);
        }
      }
      if (selected.size !== 0) break;
      const operand = sourceTransparentExpressionOperand(ast, current);
      if (operand !== undefined) current = operand;
      else if (ast.is.IsIdentifier(current)) current = facts.navigation.sourceReferenceFor(current)?.declaration;
      else if (ast.is.IsVariableDeclaration(current)) current = ast.as.AsVariableDeclaration(current)?.Initializer;
      else current = undefined;
    }
    if (selected.size > 1)
      return unresolved("Compile-time memory metadata requires one canonical value across its complete activation selection.");
    return resolved(selected.size === 0 ? none : Object.freeze({ kind: "present", value: selected.values().next().value! }));
  });
  const value: SourceMemoryQueries["memoryMetadata"]["value"] = (occurrence, bindings) => budget.withRows(rows => {
    facts.navigation.callableRoles(occurrence);
    const contexts = environments.environments(occurrence, bindings);
    if (contexts.kind !== "resolved") return contexts;
    const previous = retained.get(occurrence)?.get(bindings);
    if (previous !== undefined) return resolved(previous);
    const original = direct(occurrence, bindings);
    if (original.kind !== "resolved") return original;
    let result = original.value;
    const use = metadata.context.original.compileTimeUse(occurrence);
    if (result.kind === "none" && use.kind === "present" && use.value.role !== "selector") {
      const subject = storage.subjectFor(occurrence);
      if (subject.kind !== "resolved") return subject;
      const origins = storage.storageProducersFor(subject.subject, bindings);
      if (origins.kind === "refused" || origins.kind === "unresolved") return origins;
      if (origins.kind === "open" || origins.includesAbsence === true || origins.producers.length === 0)
        return unresolved("A compile-time memory operand requires its complete present original metadata producers.");
      const selected = new Set<SourceMemoryMetadata>();
      for (const producer of origins.producers) {
        if (!budget.step() || !rows.add(1)) return unresolved(budget.failure()!);
        if (producer.subject.kind !== "value" || producer.subject.projection.length !== 0)
          return unresolved("A compile-time memory operand requires each original unprojected metadata producer.");
        const current = direct(producer.subject.node, producer.bindings);
        if (current.kind !== "resolved") return current;
        if (current.value.kind === "none")
          return unresolved("Every compile-time memory producer must retain its own finalized original metadata.");
        selected.add(current.value.value);
      }
      if (selected.size !== 1)
        return unresolved("A compile-time memory operand requires one canonical value across all original producers and activations.");
      result = Object.freeze({ kind: "present", value: selected.values().next().value! });
    }
    if (!retainedRows.add(2)) return unresolved(budget.failure()!);
    let byBindings = retained.get(occurrence);
    if (byBindings === undefined) { byBindings = new WeakMap(); retained.set(occurrence, byBindings); }
    byBindings.set(bindings, result);
    return resolved(result);
  });
  const isCompileTimeExpression: SourceMemoryQueries["memoryMetadata"]["isCompileTimeExpression"] = occurrence => {
    facts.navigation.callableRoles(occurrence);
    const selected = metadata.context.original.compileTimeUse(occurrence);
    return resolved(selected.kind === "present");
  };
  const declaration: SourceMemoryQueries["memoryMetadata"]["declaration"] = (original, bindings) => {
    return budget.withRows(rows => {
      facts.navigation.callableRoles(original);
      if (!ast.is.IsVariableDeclaration(original)) return resolved(none);
      const selected = value(original, bindings);
      if (selected.kind !== "resolved" || selected.value.kind === "none") return selected;
      const previous = declarations.get(original)?.get(bindings);
      if (previous !== undefined) return resolved(Object.freeze({ kind: "present", value: previous }));
      const issues: { readonly node: Node; readonly reason: string }[] = [];
      for (const use of facts.navigation.declarationUses(original)) {
        if (!budget.step() || !rows.add(1)) return unresolved(budget.failure()!);
        if (use.kind === "type-only" || use.kind === "source-linkage") continue;
        let current: Node | undefined = use.reference;
        let accepted = false;
        while (current !== undefined) {
          if (!budget.step()) return unresolved(budget.failure()!);
          const compileTime = isCompileTimeExpression(current);
          if (compileTime.kind !== "resolved") return compileTime;
          if (compileTime.value) { accepted = true; break; }
          if (ast.is.IsVariableDeclaration(current)) {
            const alias = value(current, bindings);
            if (alias.kind !== "resolved") return alias;
            if (alias.value.kind === "present") { accepted = true; break; }
          }
          if (ast.is.IsCallExpression(current) || facts.navigation.callableRoles(current).signature || ast.is.IsSourceFile(current)) break;
          current = ast.parent(current);
        }
        if (!accepted) issues.push(Object.freeze({ node: use.reference,
          reason: "A finalized memory-layout descriptor is used as a runtime value rather than selected compile-time metadata." }));
      }
      if (!retainedRows.add(3 + issues.length)) return unresolved(budget.failure()!);
      const result: SourceMemoryMetadataDeclaration = Object.freeze({ value: selected.value.value, issues: Object.freeze(issues) });
      let byBindings = declarations.get(original);
      if (byBindings === undefined) { byBindings = new WeakMap(); declarations.set(original, byBindings); }
      byBindings.set(bindings, result);
      return resolved(Object.freeze({ kind: "present", value: result }));
    });
  };
  return Object.freeze({ value, declaration, isCompileTimeExpression });
}
