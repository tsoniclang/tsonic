import type { ModuleId, DefId, BodyId, TyId, LocalRef } from "../ids/contract.js";
import type { TypeParameter, BindingVector, PassingMode } from "../ir-types/contract.js";
import type { ImportTarget, HirAttribute, HirCallableEndpoint, DeclarationTarget } from "../ir-hir/contract.js";
import type { TypedBinding, TypedBindingPattern, TypedParameter, TypedBodyTemplate, TypedCallable, TypedClass, TypedHeritage, TypedInterface, TypedAlias, TypedEnum, TypedStorageDeclaration, TypedStaticBlock, TypedIndexDeclaration, TypedType, TypedPredicate, TypedTypeParameter, TypedImport, TypedImportBinding, ModuleBindingTarget, TypedModuleReference, TypedExport, TypedExportBinding, TypedExportAssignment, TypedNamespace, TypedSourceFile } from "../ir-tir/contract.js";
import type { Cursor, RecordFields, TextStep } from "./parse-values.js";
import type { TypedBindingElement } from "../ir-tir/contract.js";
import { startFieldChoice } from "./parse-values.js";
import { delimiter, choice, readBoolean, readStringChoice, openRecord, closeRecord, readModuleId, readDefinitionId, readBodyId, readTypeId, acceptText, atomicText, fieldText, nullableText, arrayText } from "./parse-values.js";
import { readTypeParameterText, readBindings } from "./parse-types.js";
import { readLocalRef } from "./parse-diagnostics.js";
import { readHirCallableEndpointText, readHirAttributeText, readDeclarationTargetText, readImportTargetText } from "./parse-core.js";

export function readTypedBindingElementText<Root>(cursor: Cursor, finish: (value: TypedBindingElement) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedBindingElement"), fields =>
    atomicText(cursor, next => startFieldChoice(next, fields, ["declaration", "role"]), first => {
      switch (first) {
        case "role":
          return atomicText(cursor, next => readStringChoice(next, ["hole"]), role =>
            atomicText(cursor, next => closeRecord(next, fields), () => acceptText({ role }, finish)));
        case "declaration":
          return readDeclarationTargetText(cursor, declaration =>
            fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storage =>
              fieldText<BodyId | null, Root>(cursor, fields, "initializer", (next, done) => nullableText(next, (next, done) => atomicText(next, readBodyId, done), done), initializer =>
                fieldText<"binding", Root>(cursor, fields, "role", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["binding"]), done), role =>
                  atomicText(cursor, next => closeRecord(next, fields), () => acceptText({ declaration, storage, initializer, role }, finish))))));
      }
    }));
}

export function readTypedBindingText<Root>(cursor: Cursor, finish: (value: TypedBinding) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedBinding"), fields =>
    fieldText<DeclarationTarget, Root>(cursor, fields, "declaration", readDeclarationTargetText, declarationValue =>
    fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storageValue =>
      fieldText<BodyId | null, Root>(cursor, fields, "initializer", (next, done) => nullableText(next, (next, done) => atomicText(next, readBodyId, done), done), initializerValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ declaration: declarationValue, storage: storageValue, initializer: initializerValue }, finish))))));
}

export function readTypedBindingPatternText<Root>(cursor: Cursor, finish: (value: TypedBindingPattern) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedBindingPattern"), fields =>
    fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storageValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ storage: storageValue }, finish))));
}

export function readTypedParameterText<Root>(cursor: Cursor, finish: (value: TypedParameter) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedParameter"), fields =>
    fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    fieldText<LocalRef, Root>(cursor, fields, "local", (next, done) => atomicText(next, readLocalRef, done), localValue =>
      fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storageValue =>
        fieldText<PassingMode, Root>(cursor, fields, "passing", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]), done), passingValue =>
          fieldText<BodyId | null, Root>(cursor, fields, "initializer", (next, done) => nullableText(next, (next, done) => atomicText(next, readBodyId, done), done), initializerValue =>
            atomicText(cursor, next => closeRecord(next, fields), () =>
                acceptText({ declaration: declarationValue, local: localValue, storage: storageValue, passing: passingValue, initializer: initializerValue }, finish))))))));
}

export function readTypedCallableText<Root>(cursor: Cursor, finish: (value: TypedCallable) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedCallable"), fields =>
    fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<readonly (TypeParameter)[], Root>(cursor, fields, "parameters", (next, done) => arrayText(next, readTypeParameterText, done), parametersValue =>
      fieldText<readonly (HirCallableEndpoint)[], Root>(cursor, fields, "signatures", (next, done) => arrayText(next, readHirCallableEndpointText, done), signaturesValue =>
        fieldText<TypedBodyTemplate | null, Root>(cursor, fields, "template", (next, done) => nullableText(next, readTypedBodyTemplateText, done), templateValue =>
          fieldText<readonly (HirAttribute)[], Root>(cursor, fields, "attributes", (next, done) => arrayText(next, readHirAttributeText, done), attributesValue =>
            atomicText(cursor, next => closeRecord(next, fields), () =>
                acceptText({ definition: definitionValue, parameters: parametersValue, signatures: signaturesValue, template: templateValue, attributes: attributesValue }, finish))))))));
}

export function readTypedClassText<Root>(cursor: Cursor, finish: (value: TypedClass) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedClass"), fields =>
    fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<readonly (TypeParameter)[], Root>(cursor, fields, "parameters", (next, done) => arrayText(next, readTypeParameterText, done), parametersValue =>
      fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
        fieldText<readonly (TyId)[], Root>(cursor, fields, "heritage", (next, done) => arrayText(next, (next, done) => atomicText(next, readTypeId, done), done), heritageValue =>
          fieldText<readonly (DefId)[], Root>(cursor, fields, "members", (next, done) => arrayText(next, (next, done) => atomicText(next, readDefinitionId, done), done), membersValue =>
            fieldText<readonly (HirAttribute)[], Root>(cursor, fields, "attributes", (next, done) => arrayText(next, readHirAttributeText, done), attributesValue =>
              atomicText(cursor, next => closeRecord(next, fields), () =>
                  acceptText({ definition: definitionValue, parameters: parametersValue, type: typeValue, heritage: heritageValue, members: membersValue, attributes: attributesValue }, finish)))))))));
}

export function readTypedHeritageText<Root>(cursor: Cursor, finish: (value: TypedHeritage) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedHeritage"), fields =>
    fieldText<readonly (TyId)[], Root>(cursor, fields, "types", (next, done) => arrayText(next, (next, done) => atomicText(next, readTypeId, done), done), typesValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ types: typesValue }, finish))));
}

export function readTypedInterfaceText<Root>(cursor: Cursor, finish: (value: TypedInterface) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedInterface"), fields =>
    fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<readonly (TypeParameter)[], Root>(cursor, fields, "parameters", (next, done) => arrayText(next, readTypeParameterText, done), parametersValue =>
      fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
        fieldText<readonly (DefId)[], Root>(cursor, fields, "members", (next, done) => arrayText(next, (next, done) => atomicText(next, readDefinitionId, done), done), membersValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ definition: definitionValue, parameters: parametersValue, type: typeValue, members: membersValue }, finish)))))));
}

export function readTypedAliasText<Root>(cursor: Cursor, finish: (value: TypedAlias) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedAlias"), fields =>
    fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<readonly (TypeParameter)[], Root>(cursor, fields, "parameters", (next, done) => arrayText(next, readTypeParameterText, done), parametersValue =>
      fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ definition: definitionValue, parameters: parametersValue, type: typeValue }, finish))))));
}

export function readTypedStorageDeclarationText<Root>(cursor: Cursor, finish: (value: TypedStorageDeclaration) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedStorageDeclaration"), fields =>
    fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<TyId, Root>(cursor, fields, "storage", (next, done) => atomicText(next, readTypeId, done), storageValue =>
      fieldText<BodyId | null, Root>(cursor, fields, "initializer", (next, done) => nullableText(next, (next, done) => atomicText(next, readBodyId, done), done), initializerValue =>
        fieldText<readonly (HirAttribute)[], Root>(cursor, fields, "attributes", (next, done) => arrayText(next, readHirAttributeText, done), attributesValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ definition: definitionValue, storage: storageValue, initializer: initializerValue, attributes: attributesValue }, finish)))))));
}

export function readTypedEnumText<Root>(cursor: Cursor, finish: (value: TypedEnum) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedEnum"), fields =>
    fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
      fieldText<readonly (DefId)[], Root>(cursor, fields, "members", (next, done) => arrayText(next, (next, done) => atomicText(next, readDefinitionId, done), done), membersValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ definition: definitionValue, type: typeValue, members: membersValue }, finish))))));
}

export function readTypedImportText<Root>(cursor: Cursor, finish: (value: TypedImport) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedImport"), fields =>
    fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<ImportTarget, Root>(cursor, fields, "target", readImportTargetText, targetValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ definition: definitionValue, target: targetValue }, finish)))));
}

export function readTypedModuleReferenceText<Root>(cursor: Cursor, finish: (value: TypedModuleReference) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedModuleReference"), fields =>
    fieldText<ImportTarget, Root>(cursor, fields, "target", readImportTargetText, targetValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ target: targetValue }, finish))));
}

export function readTypedImportBindingText<Root>(cursor: Cursor, finish: (value: TypedImportBinding) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedImportBinding"), fields =>
    fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<ModuleBindingTarget, Root>(cursor, fields, "imported", readModuleBindingTargetText, importedValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ definition: definitionValue, imported: importedValue }, finish)))));
}

export function readTypedExportAssignmentText<Root>(cursor: Cursor, finish: (value: TypedExportAssignment) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedExportAssignment"), fields =>
    fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ definition: definitionValue, type: typeValue }, finish)))));
}

export function readTypedExportBindingText<Root>(cursor: Cursor, finish: (value: TypedExportBinding) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedExportBinding"), fields =>
    fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<ModuleBindingTarget, Root>(cursor, fields, "exported", readModuleBindingTargetText, exportedValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ definition: definitionValue, exported: exportedValue }, finish)))));
}

export function readTypedIndexDeclarationText<Root>(cursor: Cursor, finish: (value: TypedIndexDeclaration) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedIndexDeclaration"), fields =>
    fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<TyId, Root>(cursor, fields, "key", (next, done) => atomicText(next, readTypeId, done), keyValue =>
      fieldText<TyId, Root>(cursor, fields, "read", (next, done) => atomicText(next, readTypeId, done), readValue =>
        fieldText<TyId | null, Root>(cursor, fields, "write", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), writeValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ definition: definitionValue, key: keyValue, read: readValue, write: writeValue }, finish)))))));
}

export function readTypedStaticBlockText<Root>(cursor: Cursor, finish: (value: TypedStaticBlock) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedStaticBlock"), fields =>
    fieldText<TypedBodyTemplate, Root>(cursor, fields, "template", readTypedBodyTemplateText, templateValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ template: templateValue }, finish))));
}

export function readTypedTypeText<Root>(cursor: Cursor, finish: (value: TypedType) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedType"), fields =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    fieldText<readonly (DefId)[], Root>(cursor, fields, "declarations", (next, done) => arrayText(next, (next, done) => atomicText(next, readDefinitionId, done), done), declarationsValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ type: typeValue, declarations: declarationsValue }, finish)))));
}

export function readTypedPredicateText<Root>(cursor: Cursor, finish: (value: TypedPredicate) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedPredicate"), fields =>
    fieldText<DefId, Root>(cursor, fields, "parameter", (next, done) => atomicText(next, readDefinitionId, done), parameterValue =>
    fieldText<TyId | null, Root>(cursor, fields, "narrowed", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), narrowedValue =>
      fieldText<boolean, Root>(cursor, fields, "asserts", (next, done) => atomicText(next, readBoolean, done), assertsValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ parameter: parameterValue, narrowed: narrowedValue, asserts: assertsValue }, finish))))));
}

export function readTypedSourceFileText<Root>(cursor: Cursor, finish: (value: TypedSourceFile) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedSourceFile"), fields =>
    fieldText<ModuleId, Root>(cursor, fields, "module", (next, done) => atomicText(next, readModuleId, done), moduleValue =>
    fieldText<TypedBodyTemplate | null, Root>(cursor, fields, "template", (next, done) => nullableText(next, readTypedBodyTemplateText, done), templateValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ module: moduleValue, template: templateValue }, finish)))));
}

export function readTypedNamespaceText<Root>(cursor: Cursor, finish: (value: TypedNamespace) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedNamespace"), fields =>
    fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
      fieldText<TypedBodyTemplate | null, Root>(cursor, fields, "template", (next, done) => nullableText(next, readTypedBodyTemplateText, done), templateValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ definition: definitionValue, type: typeValue, template: templateValue }, finish))))));
}

export function readTypedExportText<Root>(cursor: Cursor, finish: (value: TypedExport) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedExport"), fields =>
    fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    fieldText<ImportTarget | null, Root>(cursor, fields, "target", (next, done) => nullableText(next, readImportTargetText, done), targetValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ definition: definitionValue, target: targetValue }, finish)))));
}

export function readTypedTypeParameterText<Root>(cursor: Cursor, finish: (value: TypedTypeParameter) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedTypeParameter"), fields =>
    fieldText<TypeParameter, Root>(cursor, fields, "parameter", readTypeParameterText, parameterValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ parameter: parameterValue }, finish))));
}

export function readTypedBodyTemplateText<Root>(cursor: Cursor, finish: (value: TypedBodyTemplate) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypedBodyTemplate"), fields =>
    fieldText<BodyId, Root>(cursor, fields, "body", (next, done) => atomicText(next, readBodyId, done), bodyValue =>
    fieldText<BindingVector, Root>(cursor, fields, "lexicalBindings", (next, done) => atomicText(next, readBindings, done), lexicalBindingsValue =>
      fieldText<"parametric" | "binding-dependent", Root>(cursor, fields, "dependence", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["parametric","binding-dependent"]), done), dependenceValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ body: bodyValue, lexicalBindings: lexicalBindingsValue, dependence: dependenceValue }, finish))))));
}

export function readModuleBindingTargetText<Root>(cursor: Cursor, finish: (value: ModuleBindingTarget) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["definition","module"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "definition":
          return fieldText<DefId, Root>(cursor, fields, "definition", (next, done) => atomicText(next, readDefinitionId, done), definitionValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, definition: definitionValue }, finish)));
        case "module":
          return fieldText<ImportTarget, Root>(cursor, fields, "target", readImportTargetText, targetValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, target: targetValue }, finish)));
      }
    }));
}
