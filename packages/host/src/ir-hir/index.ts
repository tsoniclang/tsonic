import type { BinaryOperatorOf, CallableEndpointKey, CheckedGroupingFrontierOf, CheckedParameterHeadersOf, ChildrenOfSyntax, CompoundAssignmentOperatorOf, HasOverloadEndpoints, IndexSyntaxTree, IterateChildrenOfSyntax, IterateSyntaxChildEdges, OrderPragmaArguments, ParseHir, PrefixOperatorOf, PrintHir, SelectedEndpointRoleFaults, ShortCircuitOperatorOf, VerifyHir, WalkSyntaxForest, WalkSyntaxTree } from "./contract.js";
import { childrenOfSyntax as children, iterateChildrenOfSyntax as iterateChildren, iterateSyntaxChildEdges as iterateEdges } from "./children.js";
import type { IterateFunctionHeaderSlots, IterateParameterHeaderSlots, IterateSourceFileHeaderSlots, IterateSyntaxChildSlots,
  PrepareFunctionHeader, PrepareSourceFileHeader, PrepareSyntaxArgumentList, PrepareSyntaxStructure } from "./contract.js";
import { iterateFunctionHeaderSlots as functionSlots, iterateParameterHeaderSlots as parameterSlots,
  iterateSourceFileHeaderSlots as sourceFileSlots, iterateSyntaxChildSlots as childSlots,
  prepareFunctionHeader as functionShape, prepareSourceFileHeader as sourceFileShape, prepareSyntaxStructure as structure } from "./children.js";
import { checkedContextualTupleAssertionOf as contextualTupleAssertion, indexSyntaxTree as index, unparenthesizedExpression as unparenthesized,
  walkSyntaxForest as walkForest, walkSyntaxTree as walk } from "./walk.js";
import { prepareSyntaxArgumentList as argumentList } from "./control-slots.js";
import type { CheckedContextualTupleAssertionOf, UnparenthesizedExpression } from "./contract.js";
import type { CopyCheckedContent, CopyCheckedModule, CopySyntaxForest, PrepareSyntaxCopy, ProjectCheckedContent } from "./contract.js";
import { copySyntaxForest as copyForest, prepareSyntaxCopy as prepareCopy } from "./copy-syntax.js";
import { copyCheckedContent as copyContent, copyCheckedModule as copyModule, projectCheckedContent as projectContent } from "./checked-phase-copy.js";
import type { DeriveDeclarationScopes } from "./contract.js";
import { deriveDeclarationScopes as declarationScopes } from "./declaration-scopes.js";
import type { ParseCheckedDeclarations, PrintCheckedDeclarations } from "./contract.js";
import { parseCheckedDeclarations as parseChecked, parseHir as parse } from "./parse.js";
import { printCheckedDeclarations as printChecked, printHir as print } from "./print.js";
import { binaryOperatorOf as operatorOf, compoundAssignmentOperatorOf as compoundOf, prefixOperatorOf as prefixOf, shortCircuitOperatorOf as shortCircuitOf, verifyHir as verify } from "./verify.js";
import { orderPragmaArguments as orderPragmas } from "./pragmas.js";
import { callableEndpointKey as endpointKey, checkedParameterHeadersOf as parameterHeaders, hasOverloadEndpoints as overloadEndpoints, selectedEndpointRoleFaults as roleFaults } from "./endpoints.js";
import type { CreateModuleBindingViews, IsModuleBindingKind, IsTypeOnlyExportStar, ResolveModuleBinding, ResolveModuleExport } from "./contract.js";
import { createModuleBindingViews as bindingViews, isModuleBindingKind as bindingKind, isTypeOnlyExportStar as typeOnlyExportStar, resolveModuleBinding as resolveBinding, resolveModuleExport as resolveExport } from "./bindings.js";
import type { CheckedBindingKeyOf, CheckedMemberStorageOf, CheckedReferenceArgumentViewOf, CheckedSourceBindingFieldOf, CheckedSourceObjectHoldingOf, CheckedSourceObjectFieldsOf, CheckedVariableStorageOf, ReadWriteRootStorageOf, WritableRootStorageOf } from "./contract.js";
import { checkedBindingKeyOf as bindingKey, checkedMemberStorageOf as memberStorage, checkedReferenceArgumentViewOf as referenceArgument, checkedSourceBindingFieldOf as bindingField, checkedSourceObjectHoldingOf as objectHolding, checkedSourceObjectFieldsOf as objectFields, checkedVariableStorageOf as checkedStorage,
  readWriteRootStorageOf as readWriteStorage, writableRootStorageOf as writableStorage } from "./storage.js";
import { checkedGroupingFrontierOf as groupingFrontier } from "./grouping-frontier.js";
import type { CollectInferredStorageSources } from "./contract.js";
import { collectInferredStorageSources as storageSources } from "./storage-inputs.js";
import type { CheckedLayoutConstructionOf, CheckedLayoutGeometryOperands, CheckedLayoutRoleOf, ReadLayoutDescriptor, ReadLayoutSelector, ResolveCheckedLayout, ResolveCheckedLayoutAlias } from "./contract.js";
import { checkedLayoutConstructionOf as layoutConstruction, checkedLayoutGeometryOperands as layoutGeometryOperands, checkedLayoutRoleOf as layoutRole,
  readLayoutDescriptor as layoutDescriptor, readLayoutSelector as layoutSelector, resolveCheckedLayout as layoutSource,
  resolveCheckedLayoutAlias as layoutAlias } from "./layout.js";

export const collectInferredStorageSources: CollectInferredStorageSources = storageSources;
export const checkedLayoutRoleOf: CheckedLayoutRoleOf = layoutRole;
export const checkedLayoutConstructionOf: CheckedLayoutConstructionOf = layoutConstruction;
export const checkedLayoutGeometryOperands: CheckedLayoutGeometryOperands = layoutGeometryOperands;
export const readLayoutDescriptor: ReadLayoutDescriptor = layoutDescriptor;
export const readLayoutSelector: ReadLayoutSelector = layoutSelector;
export const resolveCheckedLayout: ResolveCheckedLayout = layoutSource;
export const resolveCheckedLayoutAlias: ResolveCheckedLayoutAlias = layoutAlias;

export const resolveModuleBinding: ResolveModuleBinding = resolveBinding;
export const isModuleBindingKind: IsModuleBindingKind = bindingKind;
export const isTypeOnlyExportStar: IsTypeOnlyExportStar = typeOnlyExportStar;
export const createModuleBindingViews: CreateModuleBindingViews = bindingViews;
export const resolveModuleExport: ResolveModuleExport = resolveExport;
export const writableRootStorageOf: WritableRootStorageOf = writableStorage;
export const readWriteRootStorageOf: ReadWriteRootStorageOf = readWriteStorage;
export const checkedVariableStorageOf: CheckedVariableStorageOf = checkedStorage;
export const checkedMemberStorageOf: CheckedMemberStorageOf = memberStorage;
export const checkedReferenceArgumentViewOf: CheckedReferenceArgumentViewOf = referenceArgument;
export const checkedSourceObjectHoldingOf: CheckedSourceObjectHoldingOf = objectHolding;
export const checkedSourceObjectFieldsOf: CheckedSourceObjectFieldsOf = objectFields;
export const checkedSourceBindingFieldOf: CheckedSourceBindingFieldOf = bindingField;
export const checkedBindingKeyOf: CheckedBindingKeyOf = bindingKey;
export const checkedParameterHeadersOf: CheckedParameterHeadersOf = parameterHeaders;
export const checkedGroupingFrontierOf: CheckedGroupingFrontierOf = groupingFrontier;

export const childrenOfSyntax: ChildrenOfSyntax = children;
export const iterateChildrenOfSyntax: IterateChildrenOfSyntax = iterateChildren;
export const iterateSyntaxChildEdges: IterateSyntaxChildEdges = iterateEdges;
export const iterateSyntaxChildSlots: IterateSyntaxChildSlots = childSlots;
export const iterateFunctionHeaderSlots: IterateFunctionHeaderSlots = functionSlots;
export const iterateParameterHeaderSlots: IterateParameterHeaderSlots = parameterSlots;
export const iterateSourceFileHeaderSlots: IterateSourceFileHeaderSlots = sourceFileSlots;
export const prepareSyntaxStructure: PrepareSyntaxStructure = structure;
export const prepareSyntaxArgumentList: PrepareSyntaxArgumentList = argumentList;
export const prepareFunctionHeader: PrepareFunctionHeader = functionShape;
export const prepareSourceFileHeader: PrepareSourceFileHeader = sourceFileShape;
export const indexSyntaxTree: IndexSyntaxTree = index;
export const walkSyntaxTree: WalkSyntaxTree = walk;
export const walkSyntaxForest: WalkSyntaxForest = walkForest;
export const copySyntaxForest: CopySyntaxForest = copyForest;
export const prepareSyntaxCopy: PrepareSyntaxCopy = prepareCopy;
export const copyCheckedModule: CopyCheckedModule = copyModule;
export const copyCheckedContent: CopyCheckedContent = copyContent;
export const projectCheckedContent: ProjectCheckedContent = projectContent;
export const unparenthesizedExpression: UnparenthesizedExpression = unparenthesized;
export const checkedContextualTupleAssertionOf: CheckedContextualTupleAssertionOf = contextualTupleAssertion;
export const parseHir: ParseHir = parse;
export const printHir: PrintHir = print;
export const parseCheckedDeclarations: ParseCheckedDeclarations = parseChecked;
export const printCheckedDeclarations: PrintCheckedDeclarations = printChecked;
export const verifyHir: VerifyHir = verify;
export const deriveDeclarationScopes: DeriveDeclarationScopes = declarationScopes;
export const binaryOperatorOf: BinaryOperatorOf = operatorOf;
export const compoundAssignmentOperatorOf: CompoundAssignmentOperatorOf = compoundOf;
export const prefixOperatorOf: PrefixOperatorOf = prefixOf;
export const shortCircuitOperatorOf: ShortCircuitOperatorOf = shortCircuitOf;
export const orderPragmaArguments: OrderPragmaArguments = orderPragmas;
export const callableEndpointKey: CallableEndpointKey = endpointKey;
export const hasOverloadEndpoints: HasOverloadEndpoints = overloadEndpoints;
export const selectedEndpointRoleFaults: SelectedEndpointRoleFaults = roleFaults;
