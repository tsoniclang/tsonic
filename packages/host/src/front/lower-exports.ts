import { throwInvariant } from "../diag/index.js";
import type { DefId, NodeId, SourceNodeRef } from "../ids/contract.js";
import type * as Hir from "../ir-hir/contract.js";

interface ExportInputs {
  readonly core: (node: NodeId) => Hir.HirCoreCapture;
  readonly memory: (node: NodeId) => Hir.CapturedFact<Hir.HirMemoryLayoutCapture | Hir.HirMemoryFieldCapture | null>;
  readonly definition: (node: NodeId) => DefId;
  readonly binding: (node: NodeId) => SourceNodeRef;
  readonly target: (node: NodeId) => Hir.CapturedFact<Hir.ImportTarget>;
}

function fail(message: string): never {
  return throwInvariant({ owner: "front", query: null, origin: null, message });
}

function name(inputs: ExportInputs, source: Hir.ModuleExportName<Hir.SyntaxPhase>, binding: SourceNodeRef,
  definition: DefId | null): Hir.ModuleExportName<Hir.CheckedPhase> {
  const core = inputs.core(source.id);
  if (source.kind === "Identifier") return { ...source, tsonic: definition === null
    ? { core, role: "binding-name", binding }
    : { core, role: "declaration-name", declaration: { kind: "definition", definition } } };
  return { ...source, tsonic: definition === null
    ? { core, role: "export-name", binding }
    : { core, role: "declaration-name", declaration: { kind: "definition", definition } } };
}

function specifier(inputs: ExportInputs, source: Hir.ExportSpecifier<Hir.SyntaxPhase>): Hir.ExportSpecifier<Hir.CheckedPhase> {
  const binding = inputs.binding(source.id);
  return { ...source, name: name(inputs, source.name, binding, null),
    propertyName: source.propertyName === null ? null : name(inputs, source.propertyName, binding, null),
    tsonic: { core: inputs.core(source.id), binding } };
}

function clause(inputs: ExportInputs, source: Hir.NamedExportBindings<Hir.SyntaxPhase>, owner: DefId): Hir.NamedExportBindings<Hir.CheckedPhase> {
  if (source.kind === "NamedExports") return { ...source,
    elements: { ...source.elements, nodes: source.elements.nodes.map(element => specifier(inputs, element)) }, tsonic: null };
  const binding = inputs.binding(source.id);
  const definition = inputs.definition(source.id);
  return { ...source, name: name(inputs, source.name, binding, definition),
    tsonic: { core: inputs.core(source.id), parent: owner, attributes: [], memory: inputs.memory(source.id), definition, binding } };
}

export function lowerExportDeclaration(inputs: ExportInputs, source: Hir.ExportDeclaration<Hir.SyntaxPhase>, owner: DefId): Hir.ExportDeclaration<Hir.CheckedPhase> {
  if (source.attributes !== null) return fail("An export with unwritten attributes passed the frontier check.");
  const module = source.moduleSpecifier;
  if (module !== null && module.kind !== "StringLiteral") return fail("An export with an unwritten module expression passed the frontier check.");
  const target: Hir.CapturedFact<Hir.ImportTarget | null> = module === null ? { kind: "available", value: null } : inputs.target(module.id);
  return { ...source,
    modifiers: source.modifiers === null ? null : { ...source.modifiers, nodes: source.modifiers.nodes.map(modifier => {
      if (modifier.kind !== "ExportKeyword") return fail("An export with an unwritten modifier passed the frontier check.");
      return { ...modifier, tsonic: null };
    }) },
    exportClause: source.exportClause === null ? null : clause(inputs, source.exportClause, owner),
    moduleSpecifier: module === null ? null : { ...module, tsonic: { core: inputs.core(module.id), role: "module-specifier", target: inputs.target(module.id) } },
    attributes: null, tsonic: { core: inputs.core(source.id), target } };
}
