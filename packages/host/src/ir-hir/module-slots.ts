import type {
  AsteriskToken, EntityName, ExportAssignment, ExportDeclaration, ExportSpecifier, Expression, Identifier,
  ImportAttributes, ImportClause, ImportDeclaration, ImportEqualsDeclaration, ImportSpecifier, ImportTypeNode,
  ModifierLike, ModuleDeclaration, ModuleExportName, ModuleName, ModuleReference, ModuleStructureReceipt,
  ModuleStructureSyntax, NamedExportBindings, NamedImportBindings, NamespaceExport, NamespaceExportDeclaration,
  NamespaceImport, NodeBody, Phase, SyntaxChildListField, SyntaxCopyResult, SyntaxNode, TypeNode,
} from "./contract.js";
import {
  children, heldChild, heldList, heldOptionalList, prependSlots,
} from "./child-slot-storage.js";

export function isModuleStructure<P extends Phase>(node: SyntaxNode<P>): node is ModuleStructureSyntax<P> {
  switch (node.kind) {
    case "ImportDeclaration": case "JSImportDeclaration": case "ExportDeclaration": case "ImportEqualsDeclaration":
    case "ModuleDeclaration": case "ImportType": case "ImportClause": case "ImportSpecifier": case "ExportSpecifier":
    case "NamespaceImport": case "NamespaceExport": case "NamespaceExportDeclaration":
    case "NamedImports": case "NamedExports": case "ExportAssignment": return true;
    default: return false;
  }
}

export function importDeclarationSlots<P extends Phase>(clause: () => ImportClause<P> | null, specifier: () => Expression<P>,
  attributes: () => ImportAttributes<P> | null) {
  return children<P, ImportDeclaration<P>>(["importClause", "nullable", clause], ["moduleSpecifier", "required", specifier], ["attributes", "nullable", attributes]);
}

export function exportDeclarationSlots<P extends Phase>(clause: () => NamedExportBindings<P> | null, specifier: () => Expression<P> | null,
  attributes: () => ImportAttributes<P> | null) {
  return children<P, ExportDeclaration<P>>(["exportClause", "nullable", clause], ["moduleSpecifier", "nullable", specifier], ["attributes", "nullable", attributes]);
}

export function importEqualsSlots<P extends Phase>(name: () => Identifier<P>, reference: () => ModuleReference<P>) {
  return children<P, ImportEqualsDeclaration<P>>(["name", "required", name], ["moduleReference", "required", reference]);
}

export function namespaceSlots<P extends Phase>(asterisk: () => AsteriskToken<P> | null, name: () => ModuleName<P>, body: () => NodeBody<P> | null) {
  return children<P, ModuleDeclaration<P>>(["asteriskToken", "nullable", asterisk], ["name", "required", name], ["body", "nullable", body]);
}

export function importTypeSlots<P extends Phase>(argument: () => TypeNode<P>, attributes: () => ImportAttributes<P> | null,
  qualifier: () => EntityName<P> | null) {
  return children<P, ImportTypeNode<P>>(["argument", "required", argument], ["attributes", "nullable", attributes], ["qualifier", "nullable", qualifier]);
}

export function importClauseSlots<P extends Phase>(name: () => Identifier<P> | null, bindings: () => NamedImportBindings<P> | null) {
  return children<P, ImportClause<P>>(["name", "nullable", name], ["namedBindings", "nullable", bindings]);
}

export function importExportSpecifierSlots<P extends Phase>(property: () => ModuleExportName<P> | null, name: () => ModuleExportName<P>) {
  return children<P, ExportSpecifier<P>>(["propertyName", "nullable", property], ["name", "required", name]);
}

export function namespaceNameSlots<P extends Phase>(name: () => ModuleExportName<P>) {
  return children<P, NamespaceImport<P> | NamespaceExport<P> | NamespaceExportDeclaration<P>>(["name", "required", name]);
}

export function exportAssignmentSlots<P extends Phase>(type: () => TypeNode<P> | null, expression: () => Expression<P>) {
  return children<P, ExportAssignment<P>>(["type", "nullable", type], ["expression", "required", expression]);
}

export function prepareModuleStructure<P extends Phase, Stop>(node: ModuleStructureSyntax<P>, ordinal: number,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<ModuleStructureReceipt<P>, Stop> {
  switch (node.kind) {
    case "ImportType": {
      const rawArguments = node.typeArguments;
      const stop = rawArguments === null ? null : admitList("typeArguments");
      if (stop !== null) return { kind: "refused", stop };
      const args = heldOptionalList<P, TypeNode<P>>("typeArguments", rawArguments);
      const argument = heldChild(() => node.argument);
      const attributes = heldChild(() => node.attributes);
      const qualifier = heldChild(() => node.qualifier);
      return { kind: "copied", value: { kind: "import-type", ordinal,
        slots: prependSlots<P>(importTypeSlots<P>(argument.pull, attributes.pull, qualifier.pull), args.slots()),
        argument: argument.read, attributes: attributes.read, qualifier: qualifier.read, args: args.finish } };
    }
    case "ImportClause": {
      const name = heldChild(() => node.name);
      const bindings = heldChild(() => node.namedBindings);
      return { kind: "copied", value: { kind: "import-clause", ordinal, slots: importClauseSlots<P>(name.pull, bindings.pull), name: name.read, bindings: bindings.read } };
    }
    case "ImportSpecifier": case "ExportSpecifier": {
      if (node.kind === "ImportSpecifier") {
        const property = heldChild(() => node.propertyName);
        const name = heldChild(() => node.name);
        return { kind: "copied", value: { kind: "import-specifier", ordinal, slots: importExportSpecifierSlots<P>(property.pull, name.pull),
          property: property.read, name: name.read } };
      }
      const property = heldChild(() => node.propertyName);
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "export-specifier", ordinal, slots: importExportSpecifierSlots<P>(property.pull, name.pull),
        property: property.read, name: name.read } };
    }
    case "NamespaceImport": {
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "namespace-import", ordinal, slots: namespaceNameSlots<P>(name.pull), name: name.read } };
    }
    case "NamespaceExport": {
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "namespace-export", ordinal, slots: namespaceNameSlots<P>(name.pull), name: name.read } };
    }
    case "NamedImports": {
      const stop = admitList("elements");
      if (stop !== null) return { kind: "refused", stop };
      const elements = heldList<P, ImportSpecifier<P>>("elements", () => node.elements);
      return { kind: "copied", value: { kind: "named-imports", ordinal, slots: elements.slots(), elements: elements.finish } };
    }
    case "NamedExports": {
      const stop = admitList("elements");
      if (stop !== null) return { kind: "refused", stop };
      const elements = heldList<P, ExportSpecifier<P>>("elements", () => node.elements);
      return { kind: "copied", value: { kind: "named-exports", ordinal, slots: elements.slots(), elements: elements.finish } };
    }
  }
  const rawModifiers = node.modifiers;
  const stop = rawModifiers === null ? null : admitList("modifiers");
  if (stop !== null) return { kind: "refused", stop };
  const modifiers = heldOptionalList<P, ModifierLike<P>>("modifiers", rawModifiers);
  switch (node.kind) {
    case "ImportDeclaration": case "JSImportDeclaration": {
      const clause = heldChild(() => node.importClause);
      const specifier = heldChild(() => node.moduleSpecifier);
      const attributes = heldChild(() => node.attributes);
      return { kind: "copied", value: { kind: "import-declaration", ordinal, modifiers: modifiers.finish,
        slots: prependSlots<P>(modifiers.slots(), importDeclarationSlots<P>(clause.pull, specifier.pull, attributes.pull)),
        clause: clause.read, specifier: specifier.read, attributes: attributes.read } };
    }
    case "ExportDeclaration": {
      const clause = heldChild(() => node.exportClause);
      const specifier = heldChild(() => node.moduleSpecifier);
      const attributes = heldChild(() => node.attributes);
      return { kind: "copied", value: { kind: "export-declaration", ordinal, modifiers: modifiers.finish,
        slots: prependSlots<P>(modifiers.slots(), exportDeclarationSlots<P>(clause.pull, specifier.pull, attributes.pull)),
        clause: clause.read, specifier: specifier.read, attributes: attributes.read } };
    }
    case "ImportEqualsDeclaration": {
      const name = heldChild(() => node.name);
      const reference = heldChild(() => node.moduleReference);
      return { kind: "copied", value: { kind: "import-equals", ordinal, modifiers: modifiers.finish,
        slots: prependSlots<P>(modifiers.slots(), importEqualsSlots<P>(name.pull, reference.pull)), name: name.read, reference: reference.read } };
    }
    case "ModuleDeclaration": {
      const asterisk = heldChild(() => node.asteriskToken);
      const name = heldChild(() => node.name);
      const body = heldChild(() => node.body);
      return { kind: "copied", value: { kind: "namespace", ordinal, modifiers: modifiers.finish,
        slots: prependSlots<P>(modifiers.slots(), namespaceSlots<P>(asterisk.pull, name.pull, body.pull)), asterisk: asterisk.read, name: name.read, body: body.read } };
    }
    case "NamespaceExportDeclaration": {
      const name = heldChild(() => node.name);
      return { kind: "copied", value: { kind: "namespace-export-declaration", ordinal, modifiers: modifiers.finish,
        slots: prependSlots<P>(modifiers.slots(), namespaceNameSlots<P>(name.pull)), name: name.read } };
    }
    case "ExportAssignment": {
      const type = heldChild(() => node.type);
      const expression = heldChild(() => node.expression);
      return { kind: "copied", value: { kind: "export-assignment", ordinal, modifiers: modifiers.finish,
        slots: prependSlots<P>(modifiers.slots(), exportAssignmentSlots<P>(type.pull, expression.pull)), type: type.read, expression: expression.read } };
    }
  }
}
