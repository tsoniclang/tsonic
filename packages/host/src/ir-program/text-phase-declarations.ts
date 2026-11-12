import type { TypedBinding, TypedBindingPattern, TypedParameter, TypedCallable, TypedClass, TypedHeritage, TypedInterface, TypedAlias, TypedStorageDeclaration, TypedEnum, TypedImport, TypedModuleReference, TypedImportBinding, TypedExportAssignment, TypedExportBinding, TypedIndexDeclaration, TypedStaticBlock, TypedType, TypedPredicate, TypedSourceFile, TypedNamespace, TypedExport, TypedTypeParameter, TypedBodyTemplate, ModuleBindingTarget } from "../ir-tir/contract.js";
import type { TextWork } from "./text-values.js";
import type { TypedBindingElement } from "../ir-tir/contract.js";
import { token, text, numericIdentity, identity, field, record, sequence, deferred, boolean, textLocalRef } from "./text-values.js";
import { textDeclarationTarget, textHirCallableEndpoint, textHirAttribute, textImportTarget } from "./text-core.js";
import { textTypeParameter, textBindingVector } from "./text-types.js";

export function textTypedBindingElement(value: TypedBindingElement): TextWork {
  return deferred(value, () => {
    switch (value.role) {
      case "binding": return record("TypedBindingElement", [
        field("declaration", textDeclarationTarget(value.declaration)),
        field("storage", numericIdentity("t", value.storage)),
        field("initializer", value.initializer === null ? token("null") : identity("body", value.initializer)),
        field("role", text(value.role)),
      ]);
      case "hole": return record("TypedBindingElement", [field("role", text(value.role))]);
    }
  });
}

export function textTypedBinding(value: TypedBinding): TextWork {
  return deferred(value, () => {
    return record("TypedBinding", [
      field("declaration", textDeclarationTarget(value.declaration)),
      field("storage", numericIdentity("t", value.storage)),
      field("initializer", (value.initializer === null ? token("null") : identity("body", value.initializer))),
    ]);
  });
}

export function textTypedBindingPattern(value: TypedBindingPattern): TextWork {
  return deferred(value, () => {
    return record("TypedBindingPattern", [
      field("storage", numericIdentity("t", value.storage)),
    ]);
  });
}

export function textTypedParameter(value: TypedParameter): TextWork {
  return deferred(value, () => {
    return record("TypedParameter", [
      field("declaration", identity("def", value.declaration)),
      field("local", textLocalRef(value.local)),
      field("storage", numericIdentity("t", value.storage)),
      field("passing", text(value.passing)),
      field("initializer", (value.initializer === null ? token("null") : identity("body", value.initializer))),
    ]);
  });
}

export function textTypedCallable(value: TypedCallable): TextWork {
  return deferred(value, () => {
    return record("TypedCallable", [
      field("definition", identity("def", value.definition)),
      field("parameters", sequence(value.parameters, entry0 => textTypeParameter(entry0))),
      field("signatures", sequence(value.signatures, entry0 => textHirCallableEndpoint(entry0))),
      field("template", (value.template === null ? token("null") : textTypedBodyTemplate(value.template))),
      field("attributes", sequence(value.attributes, entry0 => textHirAttribute(entry0))),
    ]);
  });
}

export function textTypedClass(value: TypedClass): TextWork {
  return deferred(value, () => {
    return record("TypedClass", [
      field("definition", identity("def", value.definition)),
      field("parameters", sequence(value.parameters, entry0 => textTypeParameter(entry0))),
      field("type", numericIdentity("t", value.type)),
      field("heritage", sequence(value.heritage, entry0 => numericIdentity("t", entry0))),
      field("members", sequence(value.members, entry0 => identity("def", entry0))),
      field("attributes", sequence(value.attributes, entry0 => textHirAttribute(entry0))),
    ]);
  });
}

export function textTypedHeritage(value: TypedHeritage): TextWork {
  return deferred(value, () => {
    return record("TypedHeritage", [
      field("types", sequence(value.types, entry0 => numericIdentity("t", entry0))),
    ]);
  });
}

export function textTypedInterface(value: TypedInterface): TextWork {
  return deferred(value, () => {
    return record("TypedInterface", [
      field("definition", identity("def", value.definition)),
      field("parameters", sequence(value.parameters, entry0 => textTypeParameter(entry0))),
      field("type", numericIdentity("t", value.type)),
      field("members", sequence(value.members, entry0 => identity("def", entry0))),
    ]);
  });
}

export function textTypedAlias(value: TypedAlias): TextWork {
  return deferred(value, () => {
    return record("TypedAlias", [
      field("definition", identity("def", value.definition)),
      field("parameters", sequence(value.parameters, entry0 => textTypeParameter(entry0))),
      field("type", numericIdentity("t", value.type)),
    ]);
  });
}

export function textTypedStorageDeclaration(value: TypedStorageDeclaration): TextWork {
  return deferred(value, () => {
    return record("TypedStorageDeclaration", [
      field("definition", identity("def", value.definition)),
      field("storage", numericIdentity("t", value.storage)),
      field("initializer", (value.initializer === null ? token("null") : identity("body", value.initializer))),
      field("attributes", sequence(value.attributes, entry0 => textHirAttribute(entry0))),
    ]);
  });
}

export function textTypedEnum(value: TypedEnum): TextWork {
  return deferred(value, () => {
    return record("TypedEnum", [
      field("definition", identity("def", value.definition)),
      field("type", numericIdentity("t", value.type)),
      field("members", sequence(value.members, entry0 => identity("def", entry0))),
    ]);
  });
}

export function textTypedImport(value: TypedImport): TextWork {
  return deferred(value, () => {
    return record("TypedImport", [
      field("definition", identity("def", value.definition)),
      field("target", textImportTarget(value.target)),
    ]);
  });
}

export function textTypedModuleReference(value: TypedModuleReference): TextWork {
  return deferred(value, () => {
    return record("TypedModuleReference", [
      field("target", textImportTarget(value.target)),
    ]);
  });
}

export function textTypedImportBinding(value: TypedImportBinding): TextWork {
  return deferred(value, () => {
    return record("TypedImportBinding", [
      field("definition", identity("def", value.definition)),
      field("imported", textModuleBindingTarget(value.imported)),
    ]);
  });
}

export function textTypedExportAssignment(value: TypedExportAssignment): TextWork {
  return deferred(value, () => {
    return record("TypedExportAssignment", [
      field("definition", identity("def", value.definition)),
      field("type", numericIdentity("t", value.type)),
    ]);
  });
}

export function textTypedExportBinding(value: TypedExportBinding): TextWork {
  return deferred(value, () => {
    return record("TypedExportBinding", [
      field("definition", identity("def", value.definition)),
      field("exported", textModuleBindingTarget(value.exported)),
    ]);
  });
}

export function textTypedIndexDeclaration(value: TypedIndexDeclaration): TextWork {
  return deferred(value, () => {
    return record("TypedIndexDeclaration", [
      field("definition", identity("def", value.definition)),
      field("key", numericIdentity("t", value.key)),
      field("read", numericIdentity("t", value.read)),
      field("write", (value.write === null ? token("null") : numericIdentity("t", value.write))),
    ]);
  });
}

export function textTypedStaticBlock(value: TypedStaticBlock): TextWork {
  return deferred(value, () => {
    return record("TypedStaticBlock", [
      field("template", textTypedBodyTemplate(value.template)),
    ]);
  });
}

export function textTypedType(value: TypedType): TextWork {
  return deferred(value, () => {
    return record("TypedType", [
      field("type", numericIdentity("t", value.type)),
      field("declarations", sequence(value.declarations, entry0 => identity("def", entry0))),
    ]);
  });
}

export function textTypedPredicate(value: TypedPredicate): TextWork {
  return deferred(value, () => {
    return record("TypedPredicate", [
      field("parameter", identity("def", value.parameter)),
      field("narrowed", (value.narrowed === null ? token("null") : numericIdentity("t", value.narrowed))),
      field("asserts", boolean(value.asserts)),
    ]);
  });
}

export function textTypedSourceFile(value: TypedSourceFile): TextWork {
  return deferred(value, () => {
    return record("TypedSourceFile", [
      field("module", identity("mod", value.module)),
      field("template", (value.template === null ? token("null") : textTypedBodyTemplate(value.template))),
    ]);
  });
}

export function textTypedNamespace(value: TypedNamespace): TextWork {
  return deferred(value, () => {
    return record("TypedNamespace", [
      field("definition", identity("def", value.definition)),
      field("type", numericIdentity("t", value.type)),
      field("template", (value.template === null ? token("null") : textTypedBodyTemplate(value.template))),
    ]);
  });
}

export function textTypedExport(value: TypedExport): TextWork {
  return deferred(value, () => {
    return record("TypedExport", [
      field("definition", identity("def", value.definition)),
      field("target", (value.target === null ? token("null") : textImportTarget(value.target))),
    ]);
  });
}

export function textTypedTypeParameter(value: TypedTypeParameter): TextWork {
  return deferred(value, () => {
    return record("TypedTypeParameter", [
      field("parameter", textTypeParameter(value.parameter)),
    ]);
  });
}

export function textTypedBodyTemplate(value: TypedBodyTemplate): TextWork {
  return deferred(value, () => {
    return record("TypedBodyTemplate", [
      field("body", identity("body", value.body)),
      field("lexicalBindings", textBindingVector(value.lexicalBindings)),
      field("dependence", text(value.dependence)),
    ]);
  });
}

export function textModuleBindingTarget(value: ModuleBindingTarget): TextWork {
  return deferred(value, () => {
    switch (value.kind) {
      case "definition":
        return record(value.kind, [
      field("definition", identity("def", value.definition)),
    ]);
      case "module":
        return record(value.kind, [
      field("target", textImportTarget(value.target)),
    ]);
    }
  });
}
