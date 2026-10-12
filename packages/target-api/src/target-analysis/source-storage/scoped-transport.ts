import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceStorageStore } from "./stored-values.js";
import type { SourceStorageStoredProjection } from "./store-projections.js";
import type { SourceStorageCallEffect } from "./types.js";
import type { createSourceStorageExecutionRegions } from "./execution-regions.js";
import type { createSourceStorageMemberFlow } from "./member-flow.js";
import type { createSourceStorageContextInputs } from "./context-inputs.js";
import type { createSourceStorageGuardedValues } from "./guarded-values.js";
import type { SourceStorageContextLocation } from "./context-locations.js";
import type { SourceStorageBudget } from "./resource-budget.js";

export interface SourceStorageScopedTransport {
  readonly subject: SourceStorageSubjectQuery;
  readonly invocationTargets: ReadonlyMap<Node, SourceStorageSubject>;
  readonly invocationEffects: ReadonlyMap<Node, SourceStorageCallEffect>;
  readonly invocationDeclarations: ReadonlyMap<Node, Node>;
  readonly invocations: ReadonlySet<Node>;
  readonly accessorTargets: ReadonlyMap<Node, readonly Node[]>;
  readonly sourceFiles: readonly SourceFile[];
  readonly regions: ReturnType<typeof createSourceStorageExecutionRegions>;
  readonly memberFlow: ReturnType<typeof createSourceStorageMemberFlow>;
  readonly guardedValues: ReturnType<typeof createSourceStorageGuardedValues>;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
  readonly contextualInputs: ReturnType<typeof createSourceStorageContextInputs>;
  contextLocation(subject: SourceStorageSubject): SourceStorageContextLocation | undefined;
  storedValuesFor(subject: SourceStorageSubject): readonly SourceStorageStoredProjection[] | undefined;
  storesIn(region: Node): Iterable<SourceStorageStore> | undefined;
  invocationImplementations(invocation: Node): ReadonlySet<Node>;
  memberAccessorsFor(declaration: Node): ReadonlySet<Node> | undefined;
  isOpaque(invocation: Node): boolean;
}

export function sourceStorageTransparentInput(subject: SourceStorageSubject, ast: AstReader,
  transport: Pick<SourceStorageScopedTransport, "incomingFor">): SourceStorageSubject | undefined {
  if (subject.kind !== "value") return undefined;
  const parents = transport.incomingFor(subject);
  const input = parents.size === 1 ? parents.values().next().value : undefined;
  if (input?.kind === "input" && input.node === subject.node) return input;
  return ast.is.IsVariableDeclaration(subject.node) && ast.variableDeclarationKind(subject.node) === "const" ? input : undefined;
}

export function sourceStorageBindingInput(subject: SourceStorageSubject, ast: AstReader,
  transport: Pick<SourceStorageScopedTransport, "incomingFor" | "guardedValues">,
  budget: SourceStorageBudget): SourceStorageSubject | undefined {
  const transparent = sourceStorageTransparentInput(subject, ast, transport);
  if (transparent !== undefined) return transparent;
  return budget.withRows(rows => {
    let current = subject;
    let first: SourceStorageSubject | undefined;
    const visited = new Set<SourceStorageSubject>();
    while (current.kind === "value") {
      if (!budget.step()) return undefined;
      if (visited.has(current)) {
        budget.reject("Source storage binding aliases require an acyclic exact input."); return undefined;
      }
      if (!rows.add(1)) return undefined;
      visited.add(current);
      let input = sourceStorageTransparentInput(current, ast, transport);
      if (input === undefined) {
        if (!ast.is.IsIdentifier(current.node) && ast.kindName(current.node) !== "KindThisKeyword" ||
          transport.guardedValues.appliesTo(current.node) !== false) return undefined;
        const inputs = transport.incomingFor(current);
        input = inputs.size === 1 ? inputs.values().next().value : undefined;
      }
      if (input === undefined) return undefined;
      first ??= input;
      current = input;
    }
    return current.kind === "input" || current.kind === "receiver" ? first : undefined;
  });
}
