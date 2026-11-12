import { constructTypeAliasDeclaration } from "./text-syntax-construction.js";
import { lazyReader, literalReader, nullableReader, sequenceReader } from "./text-construction.js";
import { unionRecord } from "./text-layouts.js";
import type { TirRecordCodec } from "./text-layouts.js";
import type {
  ConversionDecision, ModuleBindingTarget, TirDemand, TirProtocol, TypedAlias, TypedBinding, TypedBindingElement, TypedBindingPattern, TypedBodyTemplate, TypedCallable, TypedClass, TypedClassValue, TypedClosure, TypedEnum, TypedExport, TypedExportAssignment, TypedExportBinding, TypedHeritage, TypedImport, TypedImportBinding, TypedIndexDeclaration, TypedInterface, TypedModuleReference, TypedNamespace, TypedParameter, TypedPhase, TypedPredicate, TypedSourceFile, TypedStaticBlock, TypedStorageDeclaration, TypedType, TypedTypeParameter, TypedVariableList
} from "./contract.js";
import type {
  BindingVector, TypeParameter
} from "../ir-types/contract.js";
import type {
  LocalRef, Origin
} from "../ids/contract.js";
import type {
  ClassDeclaration, ClassElement, ClassExpression, DeclarationTarget, EnumDeclaration, EnumMember, ExpressionWithTypeArguments, HeritageClause, HirAttribute, HirCallableEndpoint, ImportTarget, InterfaceDeclaration, ModifierList, NodeList, TextRange, TypeAliasDeclaration, TypeElement, TypeParameterDeclaration
} from "../ir-hir/contract.js";
import type {
  RefinementDecision, RuleOutcome
} from "../ir-infer/contract.js";
import type { TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { scalarWork, referenceWork, syntaxReference, nullableWork, sequenceWork } from "./text-layouts.js";

export interface PhaseDeclarationsTextReads {
  readonly work_BindingVector: TirRecordCodec<BindingVector>;
  readonly work_ConversionDecision: TirRecordCodec<ConversionDecision>;
  readonly work_DeclarationTarget: TirRecordCodec<DeclarationTarget>;
  readonly work_HirAttribute: TirRecordCodec<HirAttribute>;
  readonly work_HirCallableEndpoint: TirRecordCodec<HirCallableEndpoint>;
  readonly work_ImportTarget: TirRecordCodec<ImportTarget>;
  readonly work_L_ClassElement_: TirRecordCodec<NodeList<ClassElement<TypedPhase>>>;
  readonly work_L_EnumMember_: TirRecordCodec<NodeList<EnumMember<TypedPhase>>>;
  readonly work_L_ExpressionWithTypeArguments_: TirRecordCodec<NodeList<ExpressionWithTypeArguments<TypedPhase>>>;
  readonly work_L_HeritageClause_: TirRecordCodec<NodeList<HeritageClause<TypedPhase>>>;
  readonly work_L_TypeElement_: TirRecordCodec<NodeList<TypeElement<TypedPhase>>>;
  readonly work_L_TypeParameterDeclaration_: TirRecordCodec<NodeList<TypeParameterDeclaration<TypedPhase>>>;
  readonly work_LocalRef: TirRecordCodec<LocalRef>;
  readonly work_ModifierList: TirRecordCodec<ModifierList<TypedPhase>>;
  readonly work_ModuleBindingTarget: TirRecordCodec<ModuleBindingTarget>;
  readonly work_O_TirProtocol_: TirRecordCodec<RuleOutcome<TirProtocol>>;
  readonly work_Origin: TirRecordCodec<Origin>;
  readonly work_RefinementDecision: TirRecordCodec<RefinementDecision>;
  readonly work_TextRange: TirRecordCodec<TextRange>;
  readonly work_TirDemand: TirRecordCodec<TirDemand>;
  readonly work_TypeParameter: TirRecordCodec<TypeParameter>;
}

export interface PhaseDeclarationsTextModel {
  readonly work_TypedBinding: TirRecordCodec<TypedBinding>;
  readonly work_TypedBindingElement: TirRecordCodec<TypedBindingElement>;
  readonly work_TypedBindingPattern: TirRecordCodec<TypedBindingPattern>;
  readonly work_TypedParameter: TirRecordCodec<TypedParameter>;
  readonly work_TypedVariableList_ordinary: TirRecordCodec<TypedVariableList & { readonly role: "ordinary" }>;
  readonly work_TypedVariableList_using: TirRecordCodec<TypedVariableList & { readonly role: "using" }>;
  readonly work_TypedBodyTemplate: TirRecordCodec<TypedBodyTemplate>;
  readonly work_TypedCallable: TirRecordCodec<TypedCallable>;
  readonly work_TypedClosure: TirRecordCodec<TypedClosure>;
  readonly work_TypedClass: TirRecordCodec<TypedClass>;
  readonly work_TypedClassValue: TirRecordCodec<TypedClassValue>;
  readonly work_TypedHeritage: TirRecordCodec<TypedHeritage>;
  readonly work_TypedInterface: TirRecordCodec<TypedInterface>;
  readonly work_TypedAlias: TirRecordCodec<TypedAlias>;
  readonly work_TypedEnum: TirRecordCodec<TypedEnum>;
  readonly work_TypedStorageDeclaration: TirRecordCodec<TypedStorageDeclaration>;
  readonly work_TypedStaticBlock: TirRecordCodec<TypedStaticBlock>;
  readonly work_TypedIndexDeclaration: TirRecordCodec<TypedIndexDeclaration>;
  readonly work_TypedType: TirRecordCodec<TypedType>;
  readonly work_TypedPredicate: TirRecordCodec<TypedPredicate>;
  readonly work_TypedTypeParameter: TirRecordCodec<TypedTypeParameter>;
  readonly work_TypedImport: TirRecordCodec<TypedImport>;
  readonly work_TypedImportBinding: TirRecordCodec<TypedImportBinding>;
  readonly work_TypedModuleReference: TirRecordCodec<TypedModuleReference>;
  readonly work_TypedExport: TirRecordCodec<TypedExport>;
  readonly work_TypedExportBinding: TirRecordCodec<TypedExportBinding>;
  readonly work_TypedExportAssignment: TirRecordCodec<TypedExportAssignment>;
  readonly work_TypedNamespace: TirRecordCodec<TypedNamespace>;
  readonly work_TypedSourceFile: TirRecordCodec<TypedSourceFile>;
  readonly work_ClassDeclaration: (value: ClassDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_ClassExpression: (value: ClassExpression<TypedPhase>) => TirTypedRecordWork;
  readonly work_HeritageClause: (value: HeritageClause<TypedPhase>) => TirTypedRecordWork;
  readonly work_InterfaceDeclaration: (value: InterfaceDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_TypeAliasDeclaration: (value: TypeAliasDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_EnumMember: (value: EnumMember<TypedPhase>) => TirTypedRecordWork;
  readonly work_EnumDeclaration: (value: EnumDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_TypedVariableList: TirRecordCodec<TypedVariableList>;
}

export const createPhaseDeclarationsText = (kernel: TirTextKernel, read: PhaseDeclarationsTextReads): PhaseDeclarationsTextModel => {
  const { defineRecord, defineSyntaxRecord, syntaxReads, bodyReader, booleanReader, definitionReader, moduleReader, numberReader, typeReader } = kernel;
  const work_TypedBinding: TirRecordCodec<TypedBinding> = defineRecord<TypedBinding>("TypedBinding", "TypedBinding", null, "TypedBinding", null, null, fields => fields
    .field("declaration", "DeclarationTarget", value => read.work_DeclarationTarget.write(value.declaration), lazyReader(() => read.work_DeclarationTarget.reader))
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .field("initializer", "?body", value => nullableWork(value.initializer, actual => scalarWork("body", actual)), nullableReader(bodyReader))
    .finish((field_declaration, field_storage, field_initializer) => ({ declaration: field_declaration, storage: field_storage, initializer: field_initializer })));
  const bindingElement: TirRecordCodec<TypedBindingElement & { readonly role: "binding" }> = defineRecord<TypedBindingElement & { readonly role: "binding" }>("TypedBindingElement@binding", "TypedBindingElement", { field: "role", value: "binding" }, "TypedBindingElement", null, null, fields => fields
    .field("declaration", "DeclarationTarget", value => read.work_DeclarationTarget.write(value.declaration), lazyReader(() => read.work_DeclarationTarget.reader))
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .field("initializer", "?body", value => nullableWork(value.initializer, actual => scalarWork("body", actual)), nullableReader(bodyReader))
    .field("role", "'binding", value => scalarWork("'binding", value.role), literalReader<(TypedBindingElement & { readonly role: "binding" })["role"]>("'binding", ["binding"]))
    .finish((field_declaration, field_storage, field_initializer, field_role) => ({ declaration: field_declaration, storage: field_storage, initializer: field_initializer, role: field_role })));
  const holeElement: TirRecordCodec<TypedBindingElement & { readonly role: "hole" }> = defineRecord<TypedBindingElement & { readonly role: "hole" }>("TypedBindingElement@hole", "TypedBindingElement", { field: "role", value: "hole" }, "TypedBindingElement", null, null, fields => fields
    .field("role", "'hole", value => scalarWork("'hole", value.role), literalReader<(TypedBindingElement & { readonly role: "hole" })["role"]>("'hole", ["hole"]))
    .finish((field_role) => ({ role: field_role })));
  const work_TypedBindingElement: TirRecordCodec<TypedBindingElement> = unionRecord<TypedBindingElement>("TypedBindingElement", (value: TypedBindingElement): TirTypedRecordWork => {
    switch (value.role) {
      case "binding": return bindingElement.write(value);
      case "hole": return holeElement.write(value);
    }
  }, () => [bindingElement.reader, holeElement.reader]);
  const work_TypedBindingPattern: TirRecordCodec<TypedBindingPattern> = defineRecord<TypedBindingPattern>("TypedBindingPattern", "TypedBindingPattern", null, "TypedBindingPattern", null, null, fields => fields
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .finish((field_storage) => ({ storage: field_storage })));
  const work_TypedParameter: TirRecordCodec<TypedParameter> = defineRecord<TypedParameter>("TypedParameter", "TypedParameter", null, "TypedParameter", null, null, fields => fields
    .field("declaration", "def", value => referenceWork("def", value.declaration), definitionReader)
    .field("local", "LocalRef", value => read.work_LocalRef.write(value.local), lazyReader(() => read.work_LocalRef.reader))
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .field("passing", "PassingMode", value => scalarWork("PassingMode", value.passing), literalReader<(TypedParameter)["passing"]>("PassingMode", ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]))
    .field("initializer", "?body", value => nullableWork(value.initializer, actual => scalarWork("body", actual)), nullableReader(bodyReader))
    .finish((field_declaration, field_local, field_storage, field_passing, field_initializer) => ({
      declaration: field_declaration, local: field_local, storage: field_storage, passing: field_passing,
      initializer: field_initializer,
    })));
  const work_TypedVariableList_ordinary: TirRecordCodec<TypedVariableList & { readonly role: "ordinary" }> = defineRecord<TypedVariableList & { readonly role: "ordinary" }>("TypedVariableList@ordinary", "TypedVariableList", { field: "role", value: "ordinary" }, "TypedVariableList", null, null, fields => fields
    .field("role", "'ordinary", value => scalarWork("'ordinary", value.role), literalReader<(TypedVariableList & { readonly role: "ordinary" })["role"]>("'ordinary", ["ordinary"]))
    .finish((field_role) => ({ role: field_role })));
  const work_TypedVariableList_using: TirRecordCodec<TypedVariableList & { readonly role: "using" }> = defineRecord<TypedVariableList & { readonly role: "using" }>("TypedVariableList@using", "TypedVariableList", { field: "role", value: "using" }, "TypedVariableList", null, null, fields => fields
    .field("role", "'using", value => scalarWork("'using", value.role), literalReader<(TypedVariableList & { readonly role: "using" })["role"]>("'using", ["using"]))
    .field("asynchronous", "boolean", value => scalarWork("boolean", value.asynchronous), booleanReader)
    .field("protocols", "[O<TirProtocol>]", value => sequenceWork("[O<TirProtocol>]", value.protocols, actual => read.work_O_TirProtocol_.write(actual)), sequenceReader("[O<TirProtocol>]", lazyReader(() => read.work_O_TirProtocol_.reader)))
    .finish((field_role, field_asynchronous, field_protocols) => ({ role: field_role, asynchronous: field_asynchronous, protocols: field_protocols })));
  const work_TypedBodyTemplate: TirRecordCodec<TypedBodyTemplate> = defineRecord<TypedBodyTemplate>("TypedBodyTemplate", "TypedBodyTemplate", null, "TypedBodyTemplate", null, null, fields => fields
    .field("body", "body", value => scalarWork("body", value.body), bodyReader)
    .field("lexicalBindings", "BindingVector", value => read.work_BindingVector.write(value.lexicalBindings), lazyReader(() => read.work_BindingVector.reader))
    .field("dependence", "Dependence", value => scalarWork("Dependence", value.dependence), literalReader<(TypedBodyTemplate)["dependence"]>("Dependence", ["parametric","binding-dependent"]))
    .finish((field_body, field_lexicalBindings, field_dependence) => ({ body: field_body, lexicalBindings: field_lexicalBindings, dependence: field_dependence })));
  const work_TypedCallable: TirRecordCodec<TypedCallable> = defineRecord<TypedCallable>("TypedCallable", "TypedCallable", null, "TypedCallable", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("parameters", "[TypeParameter]", value => sequenceWork("[TypeParameter]", value.parameters, actual => read.work_TypeParameter.write(actual)), sequenceReader("[TypeParameter]", lazyReader(() => read.work_TypeParameter.reader)))
    .field("signatures", "[HirCallableEndpoint]", value => sequenceWork("[HirCallableEndpoint]", value.signatures, actual => read.work_HirCallableEndpoint.write(actual)), sequenceReader("[HirCallableEndpoint]", lazyReader(() => read.work_HirCallableEndpoint.reader)))
    .field("template", "?TypedBodyTemplate", value => nullableWork(value.template, actual => work_TypedBodyTemplate.write(actual)), nullableReader(lazyReader(() => work_TypedBodyTemplate.reader)))
    .field("attributes", "[HirAttribute]", value => sequenceWork("[HirAttribute]", value.attributes, actual => read.work_HirAttribute.write(actual)), sequenceReader("[HirAttribute]", lazyReader(() => read.work_HirAttribute.reader)))
    .finish((field_definition, field_parameters, field_signatures, field_template, field_attributes) => ({
      definition: field_definition, parameters: field_parameters, signatures: field_signatures, template: field_template,
      attributes: field_attributes,
    })));
  const work_TypedClosure: TirRecordCodec<TypedClosure> = defineRecord<TypedClosure>("TypedClosure", "TypedClosure", null, "TypedClosure", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("callable", "TypedCallable", value => work_TypedCallable.write(value.callable), lazyReader(() => work_TypedCallable.reader))
    .field("captures", "[LocalRef]", value => sequenceWork("[LocalRef]", value.captures, actual => read.work_LocalRef.write(actual)), sequenceReader("[LocalRef]", lazyReader(() => read.work_LocalRef.reader)))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_callable, field_captures) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, callable: field_callable, captures: field_captures,
    })));
  const work_TypedClass: TirRecordCodec<TypedClass> = defineRecord<TypedClass>("TypedClass", "TypedClass", null, "TypedClass", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("parameters", "[TypeParameter]", value => sequenceWork("[TypeParameter]", value.parameters, actual => read.work_TypeParameter.write(actual)), sequenceReader("[TypeParameter]", lazyReader(() => read.work_TypeParameter.reader)))
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("heritage", "[t]", value => sequenceWork("[t]", value.heritage, actual => referenceWork("t", actual)), sequenceReader("[t]", typeReader))
    .field("members", "[def]", value => sequenceWork("[def]", value.members, actual => referenceWork("def", actual)), sequenceReader("[def]", definitionReader))
    .field("attributes", "[HirAttribute]", value => sequenceWork("[HirAttribute]", value.attributes, actual => read.work_HirAttribute.write(actual)), sequenceReader("[HirAttribute]", lazyReader(() => read.work_HirAttribute.reader)))
    .finish((field_definition, field_parameters, field_type, field_heritage, field_members, field_attributes) => ({
      definition: field_definition, parameters: field_parameters, type: field_type, heritage: field_heritage, members: field_members,
      attributes: field_attributes,
    })));
  const work_TypedClassValue: TirRecordCodec<TypedClassValue> = defineRecord<TypedClassValue>("TypedClassValue", "TypedClassValue", null, "TypedClassValue", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("convertedType", "t", value => referenceWork("t", value.convertedType), typeReader)
    .field("conversion", "ConversionDecision", value => read.work_ConversionDecision.write(value.conversion), lazyReader(() => read.work_ConversionDecision.reader))
    .field("narrowing", "?RefinementDecision", value => nullableWork(value.narrowing, actual => read.work_RefinementDecision.write(actual)), nullableReader(lazyReader(() => read.work_RefinementDecision.reader)))
    .field("evidenceIndex", "?number", value => nullableWork(value.evidenceIndex, actual => scalarWork("number", actual)), nullableReader(numberReader))
    .field("demand", "TirDemand", value => read.work_TirDemand.write(value.demand), lazyReader(() => read.work_TirDemand.reader))
    .field("declaration", "TypedClass", value => work_TypedClass.write(value.declaration), lazyReader(() => work_TypedClass.reader))
    .finish((field_type, field_convertedType, field_conversion, field_narrowing, field_evidenceIndex, field_demand, field_declaration) => ({
      type: field_type, convertedType: field_convertedType, conversion: field_conversion, narrowing: field_narrowing,
      evidenceIndex: field_evidenceIndex, demand: field_demand, declaration: field_declaration,
    })));
  const work_TypedHeritage: TirRecordCodec<TypedHeritage> = defineRecord<TypedHeritage>("TypedHeritage", "TypedHeritage", null, "TypedHeritage", null, null, fields => fields
    .field("types", "[t]", value => sequenceWork("[t]", value.types, actual => referenceWork("t", actual)), sequenceReader("[t]", typeReader))
    .finish((field_types) => ({ types: field_types })));
  const work_TypedInterface: TirRecordCodec<TypedInterface> = defineRecord<TypedInterface>("TypedInterface", "TypedInterface", null, "TypedInterface", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("parameters", "[TypeParameter]", value => sequenceWork("[TypeParameter]", value.parameters, actual => read.work_TypeParameter.write(actual)), sequenceReader("[TypeParameter]", lazyReader(() => read.work_TypeParameter.reader)))
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("members", "[def]", value => sequenceWork("[def]", value.members, actual => referenceWork("def", actual)), sequenceReader("[def]", definitionReader))
    .finish((field_definition, field_parameters, field_type, field_members) => ({ definition: field_definition, parameters: field_parameters, type: field_type, members: field_members })));
  const work_TypedAlias: TirRecordCodec<TypedAlias> = defineRecord<TypedAlias>("TypedAlias", "TypedAlias", null, "TypedAlias", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("parameters", "[TypeParameter]", value => sequenceWork("[TypeParameter]", value.parameters, actual => read.work_TypeParameter.write(actual)), sequenceReader("[TypeParameter]", lazyReader(() => read.work_TypeParameter.reader)))
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .finish((field_definition, field_parameters, field_type) => ({ definition: field_definition, parameters: field_parameters, type: field_type })));
  const work_TypedEnum: TirRecordCodec<TypedEnum> = defineRecord<TypedEnum>("TypedEnum", "TypedEnum", null, "TypedEnum", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("members", "[def]", value => sequenceWork("[def]", value.members, actual => referenceWork("def", actual)), sequenceReader("[def]", definitionReader))
    .finish((field_definition, field_type, field_members) => ({ definition: field_definition, type: field_type, members: field_members })));
  const work_TypedStorageDeclaration: TirRecordCodec<TypedStorageDeclaration> = defineRecord<TypedStorageDeclaration>("TypedStorageDeclaration", "TypedStorageDeclaration", null, "TypedStorageDeclaration", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("storage", "t", value => referenceWork("t", value.storage), typeReader)
    .field("initializer", "?body", value => nullableWork(value.initializer, actual => scalarWork("body", actual)), nullableReader(bodyReader))
    .field("attributes", "[HirAttribute]", value => sequenceWork("[HirAttribute]", value.attributes, actual => read.work_HirAttribute.write(actual)), sequenceReader("[HirAttribute]", lazyReader(() => read.work_HirAttribute.reader)))
    .finish((field_definition, field_storage, field_initializer, field_attributes) => ({ definition: field_definition, storage: field_storage, initializer: field_initializer, attributes: field_attributes })));
  const work_TypedStaticBlock: TirRecordCodec<TypedStaticBlock> = defineRecord<TypedStaticBlock>("TypedStaticBlock", "TypedStaticBlock", null, "TypedStaticBlock", null, null, fields => fields
    .field("template", "TypedBodyTemplate", value => work_TypedBodyTemplate.write(value.template), lazyReader(() => work_TypedBodyTemplate.reader))
    .finish((field_template) => ({ template: field_template })));
  const work_TypedIndexDeclaration: TirRecordCodec<TypedIndexDeclaration> = defineRecord<TypedIndexDeclaration>("TypedIndexDeclaration", "TypedIndexDeclaration", null, "TypedIndexDeclaration", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("key", "t", value => referenceWork("t", value.key), typeReader)
    .field("read", "t", value => referenceWork("t", value.read), typeReader)
    .field("write", "?t", value => nullableWork(value.write, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .finish((field_definition, field_key, field_read, field_write) => ({ definition: field_definition, key: field_key, read: field_read, write: field_write })));
  const work_TypedType: TirRecordCodec<TypedType> = defineRecord<TypedType>("TypedType", "TypedType", null, "TypedType", null, null, fields => fields
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("declarations", "[def]", value => sequenceWork("[def]", value.declarations, actual => referenceWork("def", actual)), sequenceReader("[def]", definitionReader))
    .finish((field_type, field_declarations) => ({ type: field_type, declarations: field_declarations })));
  const work_TypedPredicate: TirRecordCodec<TypedPredicate> = defineRecord<TypedPredicate>("TypedPredicate", "TypedPredicate", null, "TypedPredicate", null, null, fields => fields
    .field("parameter", "def", value => referenceWork("def", value.parameter), definitionReader)
    .field("narrowed", "?t", value => nullableWork(value.narrowed, actual => referenceWork("t", actual)), nullableReader(typeReader))
    .field("asserts", "boolean", value => scalarWork("boolean", value.asserts), booleanReader)
    .finish((field_parameter, field_narrowed, field_asserts) => ({ parameter: field_parameter, narrowed: field_narrowed, asserts: field_asserts })));
  const work_TypedTypeParameter: TirRecordCodec<TypedTypeParameter> = defineRecord<TypedTypeParameter>("TypedTypeParameter", "TypedTypeParameter", null, "TypedTypeParameter", null, null, fields => fields
    .field("parameter", "TypeParameter", value => read.work_TypeParameter.write(value.parameter), lazyReader(() => read.work_TypeParameter.reader))
    .finish((field_parameter) => ({ parameter: field_parameter })));
  const work_TypedImport: TirRecordCodec<TypedImport> = defineRecord<TypedImport>("TypedImport", "TypedImport", null, "TypedImport", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("target", "ImportTarget", value => read.work_ImportTarget.write(value.target), lazyReader(() => read.work_ImportTarget.reader))
    .finish((field_definition, field_target) => ({ definition: field_definition, target: field_target })));
  const work_TypedImportBinding: TirRecordCodec<TypedImportBinding> = defineRecord<TypedImportBinding>("TypedImportBinding", "TypedImportBinding", null, "TypedImportBinding", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("imported", "ModuleBindingTarget", value => read.work_ModuleBindingTarget.write(value.imported), lazyReader(() => read.work_ModuleBindingTarget.reader))
    .finish((field_definition, field_imported) => ({ definition: field_definition, imported: field_imported })));
  const work_TypedModuleReference: TirRecordCodec<TypedModuleReference> = defineRecord<TypedModuleReference>("TypedModuleReference", "TypedModuleReference", null, "TypedModuleReference", null, null, fields => fields
    .field("target", "ImportTarget", value => read.work_ImportTarget.write(value.target), lazyReader(() => read.work_ImportTarget.reader))
    .finish((field_target) => ({ target: field_target })));
  const work_TypedExport: TirRecordCodec<TypedExport> = defineRecord<TypedExport>("TypedExport", "TypedExport", null, "TypedExport", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("target", "?ImportTarget", value => nullableWork(value.target, actual => read.work_ImportTarget.write(actual)), nullableReader(lazyReader(() => read.work_ImportTarget.reader)))
    .finish((field_definition, field_target) => ({ definition: field_definition, target: field_target })));
  const work_TypedExportBinding: TirRecordCodec<TypedExportBinding> = defineRecord<TypedExportBinding>("TypedExportBinding", "TypedExportBinding", null, "TypedExportBinding", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("exported", "ModuleBindingTarget", value => read.work_ModuleBindingTarget.write(value.exported), lazyReader(() => read.work_ModuleBindingTarget.reader))
    .finish((field_definition, field_exported) => ({ definition: field_definition, exported: field_exported })));
  const work_TypedExportAssignment: TirRecordCodec<TypedExportAssignment> = defineRecord<TypedExportAssignment>("TypedExportAssignment", "TypedExportAssignment", null, "TypedExportAssignment", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .finish((field_definition, field_type) => ({ definition: field_definition, type: field_type })));
  const work_TypedNamespace: TirRecordCodec<TypedNamespace> = defineRecord<TypedNamespace>("TypedNamespace", "TypedNamespace", null, "TypedNamespace", null, null, fields => fields
    .field("definition", "def", value => referenceWork("def", value.definition), definitionReader)
    .field("type", "t", value => referenceWork("t", value.type), typeReader)
    .field("template", "?TypedBodyTemplate", value => nullableWork(value.template, actual => work_TypedBodyTemplate.write(actual)), nullableReader(lazyReader(() => work_TypedBodyTemplate.reader)))
    .finish((field_definition, field_type, field_template) => ({ definition: field_definition, type: field_type, template: field_template })));
  const work_TypedSourceFile: TirRecordCodec<TypedSourceFile> = defineRecord<TypedSourceFile>("TypedSourceFile", "TypedSourceFile", null, "TypedSourceFile", null, null, fields => fields
    .field("module", "mod", value => scalarWork("mod", value.module), moduleReader)
    .field("template", "?TypedBodyTemplate", value => nullableWork(value.template, actual => work_TypedBodyTemplate.write(actual)), nullableReader(lazyReader(() => work_TypedBodyTemplate.reader)))
    .finish((field_module, field_template) => ({ module: field_module, template: field_template })));
  const work_ClassDeclaration: (value: ClassDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ClassDeclaration<TypedPhase>>("ClassDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ClassDeclaration", literalReader<(ClassDeclaration<TypedPhase>)["kind"]>("'ClassDeclaration", ["ClassDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "?$Identifier", value => nullableWork(value.name, actual => syntaxReference("$Identifier", actual)), nullableReader(syntaxReads.Identifier))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => read.work_L_TypeParameterDeclaration_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeParameterDeclaration_.reader)))
    .field("heritageClauses", "?L<HeritageClause>", value => nullableWork(value.heritageClauses, actual => read.work_L_HeritageClause_.write(actual)), nullableReader(lazyReader(() => read.work_L_HeritageClause_.reader)))
    .field("members", "L<ClassElement>", value => read.work_L_ClassElement_.write(value.members), lazyReader(() => read.work_L_ClassElement_.reader))
    .field("tsonic", "TypedClass", value => work_TypedClass.write(value.tsonic), lazyReader(() => work_TypedClass.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_typeParameters, field_heritageClauses, field_members, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, typeParameters: field_typeParameters,
      heritageClauses: field_heritageClauses, members: field_members, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_ClassExpression: (value: ClassExpression<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ClassExpression<TypedPhase>>("ClassExpression", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ClassExpression", literalReader<(ClassExpression<TypedPhase>)["kind"]>("'ClassExpression", ["ClassExpression"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "?$Identifier", value => nullableWork(value.name, actual => syntaxReference("$Identifier", actual)), nullableReader(syntaxReads.Identifier))
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => read.work_L_TypeParameterDeclaration_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeParameterDeclaration_.reader)))
    .field("heritageClauses", "?L<HeritageClause>", value => nullableWork(value.heritageClauses, actual => read.work_L_HeritageClause_.write(actual)), nullableReader(lazyReader(() => read.work_L_HeritageClause_.reader)))
    .field("members", "L<ClassElement>", value => read.work_L_ClassElement_.write(value.members), lazyReader(() => read.work_L_ClassElement_.reader))
    .field("tsonic", "TypedClassValue", value => work_TypedClassValue.write(value.tsonic), lazyReader(() => work_TypedClassValue.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_typeParameters, field_heritageClauses, field_members, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, typeParameters: field_typeParameters,
      heritageClauses: field_heritageClauses, members: field_members, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_HeritageClause: (value: HeritageClause<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<HeritageClause<TypedPhase>>("HeritageClause", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'HeritageClause", literalReader<(HeritageClause<TypedPhase>)["kind"]>("'HeritageClause", ["HeritageClause"]))
    .field("token", "HeritageToken", value => scalarWork("HeritageToken", value.token), literalReader<(HeritageClause<TypedPhase>)["token"]>("HeritageToken", ["ExtendsKeyword","ImplementsKeyword"]))
    .field("types", "L<ExpressionWithTypeArguments>", value => read.work_L_ExpressionWithTypeArguments_.write(value.types), lazyReader(() => read.work_L_ExpressionWithTypeArguments_.reader))
    .field("tsonic", "TypedHeritage", value => work_TypedHeritage.write(value.tsonic), lazyReader(() => work_TypedHeritage.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_token, field_types, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, token: field_token, types: field_types, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_InterfaceDeclaration: (value: InterfaceDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<InterfaceDeclaration<TypedPhase>>("InterfaceDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'InterfaceDeclaration", literalReader<(InterfaceDeclaration<TypedPhase>)["kind"]>("'InterfaceDeclaration", ["InterfaceDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$Identifier", value => syntaxReference("$Identifier", value.name), syntaxReads.Identifier)
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => read.work_L_TypeParameterDeclaration_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeParameterDeclaration_.reader)))
    .field("heritageClauses", "?L<HeritageClause>", value => nullableWork(value.heritageClauses, actual => read.work_L_HeritageClause_.write(actual)), nullableReader(lazyReader(() => read.work_L_HeritageClause_.reader)))
    .field("members", "L<TypeElement>", value => read.work_L_TypeElement_.write(value.members), lazyReader(() => read.work_L_TypeElement_.reader))
    .field("tsonic", "TypedInterface", value => work_TypedInterface.write(value.tsonic), lazyReader(() => work_TypedInterface.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_typeParameters, field_heritageClauses, field_members, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, typeParameters: field_typeParameters,
      heritageClauses: field_heritageClauses, members: field_members, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_TypeAliasDeclaration: (value: TypeAliasDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TypeAliasDeclaration<TypedPhase>>("TypeAliasDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "TypeAliasKind", literalReader<(TypeAliasDeclaration<TypedPhase>)["kind"]>("TypeAliasKind", ["TypeAliasDeclaration","JSTypeAliasDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$Identifier", value => syntaxReference("$Identifier", value.name), syntaxReads.Identifier)
    .field("typeParameters", "?L<TypeParameterDeclaration>", value => nullableWork(value.typeParameters, actual => read.work_L_TypeParameterDeclaration_.write(actual)), nullableReader(lazyReader(() => read.work_L_TypeParameterDeclaration_.reader)))
    .field("type", "$TypeNode", value => syntaxReference("$TypeNode", value.type), syntaxReads.TypeNode)
    .field("tsonic", "TypedAlias", value => work_TypedAlias.write(value.tsonic), lazyReader(() => work_TypedAlias.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_typeParameters, field_type, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, typeParameters: field_typeParameters, type: field_type,
      tsonic: field_tsonic,
    }), constructTypeAliasDeclaration));
  const work_EnumMember: (value: EnumMember<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<EnumMember<TypedPhase>>("EnumMember", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'EnumMember", literalReader<(EnumMember<TypedPhase>)["kind"]>("'EnumMember", ["EnumMember"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$PropertyName", value => syntaxReference("$PropertyName", value.name), syntaxReads.PropertyName)
    .field("postfixToken", "?$PostfixToken", value => nullableWork(value.postfixToken, actual => syntaxReference("$PostfixToken", actual)), nullableReader(syntaxReads.PostfixToken))
    .field("initializer", "?$Expression", value => nullableWork(value.initializer, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("tsonic", "TypedStorageDeclaration", value => work_TypedStorageDeclaration.write(value.tsonic), lazyReader(() => work_TypedStorageDeclaration.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_initializer, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, postfixToken: field_postfixToken,
      initializer: field_initializer, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_EnumDeclaration: (value: EnumDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<EnumDeclaration<TypedPhase>>("EnumDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'EnumDeclaration", literalReader<(EnumDeclaration<TypedPhase>)["kind"]>("'EnumDeclaration", ["EnumDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList.write(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$Identifier", value => syntaxReference("$Identifier", value.name), syntaxReads.Identifier)
    .field("members", "L<EnumMember>", value => read.work_L_EnumMember_.write(value.members), lazyReader(() => read.work_L_EnumMember_.reader))
    .field("tsonic", "TypedEnum", value => work_TypedEnum.write(value.tsonic), lazyReader(() => work_TypedEnum.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_members, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, members: field_members, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_TypedVariableList: TirRecordCodec<TypedVariableList> = unionRecord<TypedVariableList>("TypedVariableList", (value: TypedVariableList): TirTypedRecordWork => {
    switch (value.role) {
      case "ordinary": return work_TypedVariableList_ordinary.write(value);
      case "using": return work_TypedVariableList_using.write(value);
    }
  }, () => [work_TypedVariableList_ordinary.reader, work_TypedVariableList_using.reader]);
  return { work_TypedBindingElement, work_TypedBinding, work_TypedBindingPattern, work_TypedParameter, work_TypedVariableList_ordinary, work_TypedVariableList_using, work_TypedBodyTemplate, work_TypedCallable, work_TypedClosure, work_TypedClass, work_TypedClassValue, work_TypedHeritage, work_TypedInterface, work_TypedAlias, work_TypedEnum, work_TypedStorageDeclaration, work_TypedStaticBlock, work_TypedIndexDeclaration, work_TypedType, work_TypedPredicate, work_TypedTypeParameter, work_TypedImport, work_TypedImportBinding, work_TypedModuleReference, work_TypedExport, work_TypedExportBinding, work_TypedExportAssignment, work_TypedNamespace, work_TypedSourceFile, work_ClassDeclaration, work_ClassExpression, work_HeritageClause, work_InterfaceDeclaration, work_TypeAliasDeclaration, work_EnumMember, work_EnumDeclaration, work_TypedVariableList };
};
