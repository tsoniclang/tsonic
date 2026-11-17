import type { SourceNodeRef } from "../ids/contract.js";
import type { CheckedPhase, ExportDeclaration, Identifier, ImportDeclaration, ImportSpecifier, ModuleExportName, NamedExportBindings, NamedImportBindings } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import { throwInvariant } from "../diag/index.js";

function fail(message: string): never {
  return throwInvariant({ owner: "elaborate", query: null, origin: null, message });
}

function sameBinding(left: SourceNodeRef, right: SourceNodeRef): boolean {
  return left.kind === right.kind && left.value.node === right.value.node
    && (left.kind === "item" && right.kind === "item" && left.value.owner === right.value.owner
      || left.kind === "body" && right.kind === "body" && left.value.body === right.value.body);
}

function identifier(node: Identifier<CheckedPhase>, binding: SourceNodeRef): Identifier<TypedPhase> {
  if (node.tsonic.role !== "binding-name" || !sameBinding(node.tsonic.binding, binding))
    return fail("An import name retains its actual checked binding occurrence.");
  return { ...node, tsonic: { role: "binding-name", binding } };
}

function specifier(node: ImportSpecifier<CheckedPhase>): ImportSpecifier<TypedPhase> {
  const binding = node.tsonic.bindings[0];
  if (node.tsonic.bindings.length !== 1 || binding === undefined)
    return fail("An import specifier retains its one actual checked binding occurrence.");
  const property = node.propertyName;
  if (property?.kind === "StringLiteral" && (property.tsonic.role !== "export-name" || !sameBinding(property.tsonic.binding, binding)))
    return fail("An import property name retains its actual checked binding occurrence.");
  return { ...node, name: identifier(node.name, binding), propertyName: property === null ? null
    : property.kind === "Identifier" ? identifier(property, binding)
    : { ...property, tsonic: { role: "export-name", binding } }, tsonic: { binding } };
}

export function elaborateImport(node: ImportDeclaration<CheckedPhase>): ImportDeclaration<TypedPhase> {
  if (node.modifiers !== null || node.attributes !== null || node.moduleSpecifier.kind !== "StringLiteral"
    || node.tsonic.target.kind !== "available")
    return fail("An import requires its actual checked module target and supported original syntax.");
  const target = node.tsonic.target.value;
  const clause = node.importClause;
  let namedBindings: NamedImportBindings<TypedPhase> | null = null;
  if (clause?.namedBindings !== null && clause?.namedBindings !== undefined) {
    const named = clause.namedBindings;
    if (named.kind === "NamedImports") namedBindings = { ...named,
      elements: { ...named.elements, nodes: named.elements.nodes.map(specifier) }, tsonic: null };
    else {
      const binding = named.tsonic.bindings[0];
      if (named.tsonic.bindings.length !== 1 || binding === undefined)
        return fail("A namespace import retains its one actual checked binding occurrence.");
      namedBindings = { ...named, name: identifier(named.name, binding), tsonic: { binding } };
    }
  }
  const defaultBinding = clause?.tsonic.bindings[0];
  if (clause !== null && clause.name !== null && (clause.tsonic.bindings.length !== 1 || defaultBinding === undefined))
    return fail("A default import retains its one actual checked binding occurrence.");
  return { ...node, modifiers: null, attributes: null, importClause: clause === null ? null
    : { ...clause, name: clause.name === null ? null : identifier(clause.name,
      defaultBinding ?? fail("A default import requires its checked binding occurrence.")), namedBindings,
      tsonic: clause.name === null ? null : { binding: defaultBinding ?? fail("A default import requires its checked binding occurrence.") } },
    moduleSpecifier: { ...node.moduleSpecifier, tsonic: { role: "module-specifier", target } }, tsonic: { target } };
}

function exportName(node: ModuleExportName<CheckedPhase>, binding: SourceNodeRef): ModuleExportName<TypedPhase> {
  if (node.kind === "Identifier") return identifier(node, binding);
  if (node.tsonic.role !== "export-name" || !sameBinding(node.tsonic.binding, binding))
    return fail("An export name retains its actual checked binding occurrence.");
  return { ...node, tsonic: { role: "export-name", binding } };
}

export function elaborateExport(node: ExportDeclaration<CheckedPhase>): ExportDeclaration<TypedPhase> {
  if (node.attributes !== null || node.tsonic.target.kind !== "available"
    || node.moduleSpecifier !== null && node.moduleSpecifier.kind !== "StringLiteral")
    return fail("An export requires its actual checked module target and supported original syntax.");
  const target = node.tsonic.target.value;
  if ((node.moduleSpecifier === null) !== (target === null))
    return fail("An export module target is present exactly with its actual module specifier.");
  const clause = node.exportClause;
  let exportClause: NamedExportBindings<TypedPhase> | null = null;
  if (clause?.kind === "NamedExports") exportClause = { ...clause, tsonic: null,
    elements: { ...clause.elements, nodes: clause.elements.nodes.map(element => {
      const binding = element.tsonic.binding;
      return { ...element, name: exportName(element.name, binding),
        propertyName: element.propertyName === null ? null : exportName(element.propertyName, binding), tsonic: { binding } };
    }) } };
  else if (clause !== null) {
    const definition = clause.tsonic.definition;
    const binding = clause.tsonic.binding;
    const name = clause.name;
    if (name.tsonic.role !== "declaration-name" || name.tsonic.declaration.kind !== "definition"
      || name.tsonic.declaration.definition !== definition)
      return fail("A namespace export retains its genuine checked same-node declaration.");
    exportClause = { ...clause, name: name.kind === "Identifier"
      ? { ...name, tsonic: { role: "declaration-name", declaration: name.tsonic.declaration, storage: null } }
      : { ...name, tsonic: { role: "declaration-name", declaration: name.tsonic.declaration } }, tsonic: { definition, binding } };
  }
  return { ...node, modifiers: node.modifiers === null ? null : { ...node.modifiers, nodes: node.modifiers.nodes.map(modifier => {
    if (modifier.kind !== "ExportKeyword") return fail("An export retains only its actual checked export modifiers.");
    return { ...modifier, tsonic: null };
  }) }, exportClause, attributes: null,
    moduleSpecifier: node.moduleSpecifier === null ? null : { ...node.moduleSpecifier,
      tsonic: { role: "module-specifier", target: target ?? fail("An external export requires its actual module target.") } },
    tsonic: { target } };
}
