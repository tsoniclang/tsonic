import type { AstReader, Node, SourceFile } from "@tsonic/tsts";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import type { SourceStorageStore } from "./stored-values.js";
import type { SourceStorageCallEffect } from "./types.js";
import type { createSourceStorageExecutionRegions } from "./execution-regions.js";
import type { createSourceStorageMemberFlow } from "./member-flow.js";
import type { createSourceStorageContextInputs } from "./context-inputs.js";

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
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  incomingFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject>;
  readonly contextualInputs: ReturnType<typeof createSourceStorageContextInputs>;
  contextLocation(subject: SourceStorageSubject): boolean;
  storedValuesFor(subject: SourceStorageSubject): Iterable<SourceStorageStore> | undefined;
  storesIn(region: Node): Iterable<SourceStorageStore> | undefined;
  invocationImplementations(invocation: Node): ReadonlySet<Node>;
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
