import { throwInvariant } from "../diag/index.js";
import type { NodeId, SourceNodeRef } from "../ids/contract.js";
import type * as Hir from "../ir-hir/contract.js";

interface ImportInputs {
  readonly core: (node: NodeId) => Hir.HirCoreCapture;
  readonly binding: (node: NodeId) => SourceNodeRef;
  readonly target: (node: NodeId) => Hir.CapturedFact<Hir.ImportTarget>;
}

function fail(message: string): never {
  return throwInvariant({ owner: "front", query: null, origin: null, message });
}

function identifier(inputs: ImportInputs, source: Hir.Identifier<Hir.SyntaxPhase>,
  binding: SourceNodeRef): Hir.Identifier<Hir.CheckedPhase> {
  return { ...source, tsonic: { core: inputs.core(source.id), role: "binding-name", binding } };
}

function specifier(inputs: ImportInputs, source: Hir.ImportSpecifier<Hir.SyntaxPhase>,
  target: Hir.CapturedFact<Hir.ImportTarget>): Hir.ImportSpecifier<Hir.CheckedPhase> {
  const binding = inputs.binding(source.id);
  const property = source.propertyName;
  return { ...source, name: identifier(inputs, source.name, binding),
    propertyName: property === null ? null : property.kind === "Identifier" ? identifier(inputs, property, binding)
      : { ...property, tsonic: { core: inputs.core(property.id), role: "export-name", binding } },
    tsonic: { core: inputs.core(source.id), target, bindings: [binding] } };
}

function clause(inputs: ImportInputs, source: Hir.ImportClause<Hir.SyntaxPhase>,
  target: Hir.CapturedFact<Hir.ImportTarget>): Hir.ImportClause<Hir.CheckedPhase> {
  const binding = source.name === null ? null : inputs.binding(source.id);
  const named = source.namedBindings;
  const namedBindings: Hir.NamedImportBindings<Hir.CheckedPhase> | null = named === null ? null
    : named.kind === "NamedImports" ? { ...named,
      elements: { ...named.elements, nodes: named.elements.nodes.map(element => specifier(inputs, element, target)) }, tsonic: null }
    : namespace(inputs, named, target);
  return { ...source,
    name: source.name === null ? null : identifier(inputs, source.name, binding ?? fail("A default import lost its actual binding occurrence.")),
    namedBindings, tsonic: { core: inputs.core(source.id), target, bindings: binding === null ? [] : [binding] } };
}

function namespace(inputs: ImportInputs, source: Hir.NamespaceImport<Hir.SyntaxPhase>,
  target: Hir.CapturedFact<Hir.ImportTarget>): Hir.NamespaceImport<Hir.CheckedPhase> {
  const binding = inputs.binding(source.id);
  return { ...source, name: identifier(inputs, source.name, binding),
    tsonic: { core: inputs.core(source.id), target, bindings: [binding] } };
}

export function lowerImportDeclaration(inputs: ImportInputs,
  source: Hir.ImportDeclaration<Hir.SyntaxPhase>): Hir.ImportDeclaration<Hir.CheckedPhase> {
  if (source.attributes !== null || source.modifiers !== null || source.moduleSpecifier.kind !== "StringLiteral")
    return fail("An import of an unwritten form passed the frontier check.");
  const target = inputs.target(source.moduleSpecifier.id);
  const importClause = source.importClause === null ? null : clause(inputs, source.importClause, target);
  const bindings: SourceNodeRef[] = [];
  if (importClause !== null) {
    bindings.push(...importClause.tsonic.bindings);
    const named = importClause.namedBindings;
    if (named?.kind === "NamedImports") for (const element of named.elements.nodes) bindings.push(...element.tsonic.bindings);
    else if (named !== null) bindings.push(...named.tsonic.bindings);
  }
  return { ...source, modifiers: null, attributes: null, importClause,
    moduleSpecifier: { ...source.moduleSpecifier, tsonic: { core: inputs.core(source.moduleSpecifier.id), role: "module-specifier", target } },
    tsonic: { core: inputs.core(source.id), target, bindings } };
}
