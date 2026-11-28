import {
  throwInvariant,
} from "../diag/index.js";
import type {
  CaseClause, ChildrenOfSyntax, DefaultClause, DefaultInitializerOwner, IterateChildrenOfSyntax, IterateSyntaxChildEdges,
  IterateSyntaxChildSlots, OrdinarySyntaxPhase, Phase, PrepareSyntaxStructure, RetainedSyntaxNode,
  SyntaxChild, SyntaxChildListField, SyntaxChildSlot, SyntaxNode, NodeList, Expression, CallExpression,
} from "./contract.js";
import {
  children, emptyChildren, missingStructure, prependSlots, sameSlot,
} from "./child-slot-storage.js";
import {
  blockFields, binaryFields, prepareBlockStructure, prepareBinaryStructure, isSingleExpressionSyntax,
  singleExpressionSlots, prepareSingleExpression, returnSlots, prepareReturnStructure, isControlSyntax,
  testedStatementSlots, forSlots, forInOrOfSlots, jumpSlots, switchSlots, caseClauseSlots, trySlots, catchSlots,
  labeledSlots, prepareControl, unarySlots, prepareUnary, annotatedExpressionSlots, prepareAnnotatedExpression,
  conditionalSlots, prepareConditional, ifSlots, prepareIf, propertySlots, elementSlots, prepareProperty,
  prepareElement, arraySlots, objectSlots, prepareArray, prepareObject, variableStatementSlots,
  prepareVariableStatement, variableDeclarationSlots, prepareVariableDeclaration, variableListSlots,
  prepareVariableList, bindingPatternSlots, prepareBindingPattern, bindingElementSlots, prepareBindingElement,
  applicationSlots, prepareApplicationStructure,
} from "./control-slots.js";
import {
  isTypeStructure, wrappedTypeSlots, arrayTypeSlots, conditionalTypeSlots, indexedTypeSlots, namedTypeSlots,
  literalTypeSlots, inferTypeSlots, namedTupleSlots, typePredicateSlots, importAttributeSlots, mappedTypeSlots,
  typeParameterSlots, templateHeadSlots, templateTypeSpanSlots, rawSignatureSlots, prepareTypeStructure,
} from "./type-slots.js";
import {
  isExpressionStructure, qualifiedNameSlots, yieldSlots, arrowSlots, metaPropertySlots, templateSpanSlots,
  taggedTemplateSlots, propertyAssignmentSlots, initializerSlots, shorthandSlots, assertionSlots,
  expressionArgumentsSlots, syntheticReferenceSlots, decoratorSlots, prepareExpressionStructure,
} from "./expression-slots.js";
import {
  isModuleStructure, importDeclarationSlots, exportDeclarationSlots, importEqualsSlots, namespaceSlots,
  importTypeSlots, importClauseSlots, importExportSpecifierSlots, namespaceNameSlots, exportAssignmentSlots,
  prepareModuleStructure,
} from "./module-slots.js";
import {
  isJsxStructure, jsxElementSlots, jsxFragmentSlots, jsxNameSlots, jsxTagSlots, jsxOpeningSlots, jsxAttributeSlots,
  jsxExpressionSlots, prepareJsxStructure,
} from "./jsx-slots.js";
import {
  isDocumentationStructure, docReferenceSlots, docLinkSlots, docTagSlots, docTypeSlots, docOptionalTypeSlots,
  docTemplateSlots, docSeeSlots, docHeritageSlots, docImportSlots, docCallbackSlots, docTypedefSlots,
  docParameterSlots, prepareDocumentationStructure,
} from "./documentation-slots.js";
import {
  isDeclarationStructure, declarationSlots, classNameSlots, declarationNameSlots, aliasTypeSlots, enumMemberSlots,
  memberNameSlots, memberAsteriskSlots, memberBodySlots, propertyMemberSlots, staticBlockSlots, prepareDeclaration,
} from "./declaration-slots.js";
import {
  iterateSourceFileHeaderSlots, prepareSourceFileStructure, iterateParameterHeaderSlots, prepareParameterStructure,
  iterateFunctionHeaderSlots, prepareFunctionStructure,
} from "./header-slots.js";
export type { SyntaxChildSlot } from "./contract.js";
export { iterateFunctionHeaderSlots, iterateParameterHeaderSlots, iterateSourceFileHeaderSlots, prepareFunctionHeader, prepareSourceFileHeader } from "./header-slots.js";

export const prepareSyntaxStructure: PrepareSyntaxStructure = <P extends Phase, Stop>(
  node: SyntaxNode<P>, ordinal: number, reserve: (node: RetainedSyntaxNode<P>) => Stop | null,
  admitList: (node: RetainedSyntaxNode<P>, field: SyntaxChildListField) => Stop | null,
) => {
  if (isTypeStructure<P>(node)) {
    const stop = reserve(node);
    return stop === null ? prepareTypeStructure<P, Stop>(node, ordinal, field => admitList(node, field)) : { kind: "refused", stop };
  }
  if (isExpressionStructure<P>(node)) {
    const stop = reserve(node);
    return stop === null ? prepareExpressionStructure<P, Stop>(node, ordinal, field => admitList(node, field)) : { kind: "refused", stop };
  }
  if (isModuleStructure<P>(node)) {
    const stop = reserve(node);
    return stop === null ? prepareModuleStructure<P, Stop>(node, ordinal, field => admitList(node, field)) : { kind: "refused", stop };
  }
  if (isJsxStructure<P>(node)) {
    const stop = reserve(node);
    return stop === null ? prepareJsxStructure<P, Stop>(node, ordinal, field => admitList(node, field)) : { kind: "refused", stop };
  }
  if (isDocumentationStructure<P>(node)) {
    const stop = reserve(node);
    return stop === null ? prepareDocumentationStructure<P, Stop>(node, ordinal, field => admitList(node, field)) : { kind: "refused", stop };
  }
  if (isDeclarationStructure<P>(node)) {
    const stop = reserve(node);
    return stop === null ? prepareDeclaration<P, Stop>(node, ordinal, field => admitList(node, field)) : { kind: "refused", stop };
  }
  if (node.kind !== "Block" && node.kind !== "BinaryExpression" && node.kind !== "ReturnStatement" &&
      node.kind !== "CallExpression" && node.kind !== "NewExpression" && node.kind !== "Parameter" &&
      node.kind !== "SourceFile" && node.kind !== "FunctionDeclaration" && node.kind !== "FunctionExpression" &&
      node.kind !== "PrefixUnaryExpression" && node.kind !== "PostfixUnaryExpression" && node.kind !== "AsExpression" &&
      node.kind !== "SatisfiesExpression" && node.kind !== "ConditionalExpression" && node.kind !== "IfStatement" &&
      node.kind !== "PropertyAccessExpression" && node.kind !== "ElementAccessExpression" &&
      node.kind !== "ArrayLiteralExpression" && node.kind !== "ObjectLiteralExpression" &&
      node.kind !== "VariableStatement" && node.kind !== "VariableDeclaration" && node.kind !== "VariableDeclarationList" &&
      node.kind !== "ObjectBindingPattern" && node.kind !== "ArrayBindingPattern" && node.kind !== "BindingElement" &&
      !isControlSyntax<P>(node) && !isSingleExpressionSyntax<P>(node))
    return { kind: "copied", value: null };
  const stop = reserve(node);
  if (stop !== null) return { kind: "refused", stop };
  if (node.kind === "Block") return { kind: "copied", value: prepareBlockStructure<P>(node, ordinal) };
  if (node.kind === "ReturnStatement") return { kind: "copied", value: prepareReturnStructure<P>(node, ordinal) };
  if (node.kind === "BinaryExpression") return prepareBinaryStructure<P, Stop>(node, ordinal, () => admitList(node, "modifiers"));
  if (node.kind === "CallExpression" || node.kind === "NewExpression")
    return prepareApplicationStructure<P, Stop>(node, ordinal, field => admitList(node, field));
  if (node.kind === "Parameter") return prepareParameterStructure<P, Stop>(node, ordinal, () => admitList(node, "modifiers"));
  if (node.kind === "SourceFile") {
    const listStop = admitList(node, "statements");
    return listStop === null ? { kind: "copied", value: prepareSourceFileStructure<P>(node, ordinal) } : { kind: "refused", stop: listStop };
  }
  if (node.kind === "FunctionDeclaration" || node.kind === "FunctionExpression")
    return prepareFunctionStructure<P, Stop>(node, ordinal, field => admitList(node, field));
  if (node.kind === "PrefixUnaryExpression" || node.kind === "PostfixUnaryExpression") return { kind: "copied", value: prepareUnary<P>(node, ordinal) };
  if (node.kind === "AsExpression" || node.kind === "SatisfiesExpression") return { kind: "copied", value: prepareAnnotatedExpression<P>(node, ordinal) };
  if (node.kind === "ConditionalExpression") return { kind: "copied", value: prepareConditional<P>(node, ordinal) };
  if (node.kind === "IfStatement") return { kind: "copied", value: prepareIf<P>(node, ordinal) };
  if (node.kind === "PropertyAccessExpression") return { kind: "copied", value: prepareProperty<P>(node, ordinal) };
  if (node.kind === "ElementAccessExpression") return { kind: "copied", value: prepareElement<P>(node, ordinal) };
  if (node.kind === "ArrayLiteralExpression") {
    const list = admitList(node, "elements");
    return list === null ? { kind: "copied", value: prepareArray<P>(node, ordinal) } : { kind: "refused", stop: list };
  }
  if (node.kind === "ObjectLiteralExpression") {
    const list = admitList(node, "properties");
    return list === null ? { kind: "copied", value: prepareObject<P>(node, ordinal) } : { kind: "refused", stop: list };
  }
  if (node.kind === "VariableStatement") return prepareVariableStatement<P, Stop>(node, ordinal, () => admitList(node, "modifiers"));
  if (node.kind === "VariableDeclaration") return { kind: "copied", value: prepareVariableDeclaration<P>(node, ordinal) };
  if (node.kind === "VariableDeclarationList") {
    const list = admitList(node, "declarations");
    return list === null ? { kind: "copied", value: prepareVariableList<P>(node, ordinal) } : { kind: "refused", stop: list };
  }
  if (node.kind === "ObjectBindingPattern" || node.kind === "ArrayBindingPattern") {
    const list = admitList(node, "elements");
    return list === null ? { kind: "copied", value: prepareBindingPattern<P>(node, ordinal) } : { kind: "refused", stop: list };
  }
  if (node.kind === "BindingElement") return { kind: "copied", value: prepareBindingElement<P>(node, ordinal) };
  if (isControlSyntax<P>(node)) return prepareControl<P, Stop>(node, ordinal, field => admitList(node, field));
  if (!isSingleExpressionSyntax<P>(node)) return throwInvariant(missingStructure);
  return { kind: "copied", value: prepareSingleExpression<P>(node, ordinal) };
};

export const iterateChildrenOfSyntax: IterateChildrenOfSyntax = function* <PhaseType extends OrdinarySyntaxPhase<PhaseType>>(
  node: SyntaxNode<PhaseType>,
): Generator<SyntaxNode<PhaseType>, void, undefined> {
  for (const slot of iterateNullableSyntaxSlots(node)) yield slot.read();
};

export const childrenOfSyntax: ChildrenOfSyntax = <PhaseType extends OrdinarySyntaxPhase<PhaseType>>(
  node: SyntaxNode<PhaseType>,
): readonly SyntaxNode<PhaseType>[] => [...iterateChildrenOfSyntax(node)];

export function syntaxChildEdges<PhaseType extends OrdinarySyntaxPhase<PhaseType>>(
  node: SyntaxNode<PhaseType>,
): readonly SyntaxChild<PhaseType>[] {
  return [...iterateSyntaxChildEdges(node)];
}

export const iterateSyntaxChildEdges: IterateSyntaxChildEdges = function* <PhaseType extends OrdinarySyntaxPhase<PhaseType>>(
  node: SyntaxNode<PhaseType>,
): Generator<SyntaxChild<PhaseType>, void, undefined> {
  for (const slot of iterateNullableSyntaxSlots(node)) yield { node: slot.read(), fields: slot.fields };
};

export function iterateNullableSyntaxSlots<P extends OrdinarySyntaxPhase<P>>(node: SyntaxNode<P>): Iterable<SyntaxChildSlot<P>> {
  return iterateSyntaxChildSlots<P, SyntaxChildSlot<P>>(node, sameSlot, function* (parameter, field) {
    const initializer = parameter.initializer;
    if (initializer !== null) yield { fields: [field], read: () => initializer };
  }, call => children<P, { readonly arguments: NodeList<Expression<P>> }>(["arguments", "list", () => call.arguments]));
}

export const iterateSyntaxChildSlots: IterateSyntaxChildSlots = function* <P extends Phase, Slot>(node: SyntaxNode<P>,
  ordinary: (slot: SyntaxChildSlot<P>) => Slot,
  initializer: (node: DefaultInitializerOwner<P>, field: "initializer") => Iterable<Slot>,
  argumentsOf: (node: CallExpression<P>, field: "arguments") => Iterable<Slot>,
) {
  if (node.kind === "Parameter") {
    yield* iterateParameterHeaderSlots(node, ordinary, field => initializer(node, field));
  } else if (node.kind === "BindingElement") {
    for (const slot of bindingElementSlots<P>({ dotDotDotToken: () => node.dotDotDotToken, propertyName: () => node.propertyName,
      name: () => node.name })) yield ordinary(slot);
    yield* initializer(node, "initializer");
  } else if (node.kind === "CallExpression") {
    yield* applicationSlots<P, Slot>(node, value => value, value => value,
      () => children<P, typeof node>(["typeArguments", "list", () => node.typeArguments]), ordinary, () => argumentsOf(node, "arguments"));
  } else {
    for (const slot of ordinarySlots(node)) yield ordinary(slot);
  }
};

function ordinarySlots<PhaseType extends Phase>(
  node: Exclude<SyntaxNode<PhaseType>, { readonly kind: "Parameter" | "BindingElement" | "CallExpression" }>,
): Iterable<SyntaxChildSlot<PhaseType>> {
  if (isSingleExpressionSyntax<PhaseType>(node)) return singleExpressionSlots<PhaseType>(node, child => child);
  switch (node.kind) {
    case "QualifiedName":
      return qualifiedNameSlots<PhaseType>(() => node.left, () => node.right);
    case "Decorator":
      return decoratorSlots<PhaseType>(() => node.expression);
    case "ReturnStatement":
      return returnSlots<PhaseType>(node, child => child);
    case "IfStatement":
      return ifSlots<PhaseType>(() => node.expression, () => node.thenStatement, () => node.elseStatement);
    case "DoStatement":
    case "WhileStatement":
    case "WithStatement":
      return testedStatementSlots<PhaseType>(node.kind === "DoStatement", () => node.statement, () => node.expression);
    case "ForStatement":
      return forSlots<PhaseType>(() => node.initializer, () => node.condition, () => node.incrementor, () => node.statement);
    case "ForInStatement":
    case "ForOfStatement":
      return forInOrOfSlots<PhaseType>(() => node.awaitModifier, () => node.initializer, () => node.expression, () => node.statement);
    case "BreakStatement":
    case "ContinueStatement":
      return jumpSlots<PhaseType>(() => node.label);
    case "SwitchStatement":
      return switchSlots<PhaseType>(() => node.expression, () => node.caseBlock);
    case "CaseBlock":
      return children<PhaseType, typeof node>(["clauses", "list", () => node.clauses]);
    case "CaseClause":
    case "DefaultClause":
      return caseClauseSlots<PhaseType>(node, () => undefined,
        () => children<PhaseType, CaseClause<PhaseType> | DefaultClause<PhaseType>>(["statements", "list", () => node.statements]));
    case "TryStatement":
      return trySlots<PhaseType>(() => node.tryBlock, () => node.catchClause, () => node.finallyBlock);
    case "CatchClause":
      return catchSlots<PhaseType>(() => node.variableDeclaration, () => node.block);
    case "LabeledStatement":
      return labeledSlots<PhaseType>(() => node.label, () => node.statement);
    case "Block":
      return blockFields<PhaseType>(node, (field, list) => children<PhaseType, typeof node>([field, "list", () => list]));
    case "ModuleBlock":
      return children<PhaseType, typeof node>(["statements", "list", () => node.statements]);
    case "VariableStatement":
      return variableStatementSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => node.declarationList);
    case "VariableDeclaration":
      return variableDeclarationSlots<PhaseType>({ name: () => node.name, exclamationToken: () => node.exclamationToken,
        type: () => node.type, initializer: () => node.initializer });
    case "VariableDeclarationList":
      return variableListSlots<PhaseType>(node, (field, list) => children<PhaseType, typeof node>([field, "list", () => list]));
    case "ObjectBindingPattern":
    case "ArrayBindingPattern":
      return bindingPatternSlots<PhaseType>(node, (field, list) => children<PhaseType, typeof node>([field, "list", () => list]));
    case "MissingDeclaration":
      return children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]);
    case "FunctionDeclaration":
    case "FunctionExpression":
      return iterateFunctionHeaderSlots(node, sameSlot<PhaseType>,
        field => children<PhaseType, typeof node>([field, "list", () => node.parameters]),
        field => children<PhaseType, typeof node>([field, "nullable", () => node.body]));
    case "ClassDeclaration":
    case "ClassExpression":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => classNameSlots<PhaseType>(() => node.name),
        () => children<PhaseType, typeof node>(["typeParameters", "list", () => node.typeParameters], ["heritageClauses", "list", () => node.heritageClauses],
          ["members", "list", () => node.members]));
    case "InterfaceDeclaration":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => declarationNameSlots<PhaseType>(() => node.name),
        () => children<PhaseType, typeof node>(["typeParameters", "list", () => node.typeParameters], ["heritageClauses", "list", () => node.heritageClauses],
          ["members", "list", () => node.members]));
    case "HeritageClause":
      return children<PhaseType, typeof node>(["types", "list", () => node.types]);
    case "TypeAliasDeclaration":
    case "JSTypeAliasDeclaration":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => declarationNameSlots<PhaseType>(() => node.name),
        () => children<PhaseType, typeof node>(["typeParameters", "list", () => node.typeParameters]),
        () => aliasTypeSlots<PhaseType>(() => node.type));
    case "EnumMember":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => enumMemberSlots<PhaseType>(() => node.name, () => node.postfixToken, () => node.initializer));
    case "EnumDeclaration":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => declarationNameSlots<PhaseType>(() => node.name),
        () => children<PhaseType, typeof node>(["members", "list", () => node.members]));
    case "ImportDeclaration":
    case "JSImportDeclaration":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        importDeclarationSlots<PhaseType>(() => node.importClause, () => node.moduleSpecifier, () => node.attributes));
    case "NamespaceImport":
    case "NamespaceExport":
      return namespaceNameSlots<PhaseType>(() => node.name);
    case "JSDocNameReference":
      return docReferenceSlots<PhaseType>(() => node.name);
    case "JSDocLink":
    case "JSDocLinkPlain":
    case "JSDocLinkCode":
      return docLinkSlots<PhaseType>(() => node.name);
    case "NamedImports":
    case "NamedExports":
      return children<PhaseType, typeof node>(["elements", "list", () => node.elements]);
    case "ExportAssignment":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        exportAssignmentSlots<PhaseType>(() => node.type, () => node.expression));
    case "NamespaceExportDeclaration":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), namespaceNameSlots<PhaseType>(() => node.name));
    case "ExportSpecifier":
    case "ImportSpecifier":
      return importExportSpecifierSlots<PhaseType>(() => node.propertyName, () => node.name);
    case "CallSignature":
    case "ConstructSignature":
    case "JSDocSignature":
      return rawSignatureSlots<PhaseType>(node);
    case "FunctionType": case "ConstructorType": case "IndexSignature":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), rawSignatureSlots<PhaseType>(node));
    case "Constructor":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), () => rawSignatureSlots<PhaseType>(node),
        () => memberAsteriskSlots<PhaseType>(() => node.asteriskToken), () => memberBodySlots<PhaseType>(() => node.body));
    case "GetAccessor":
    case "SetAccessor":
    case "MethodDeclaration":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), () => memberAsteriskSlots<PhaseType>(() => node.asteriskToken),
        () => memberNameSlots<PhaseType>(() => node.name, () => node.postfixToken), () => rawSignatureSlots<PhaseType>(node), () => memberBodySlots<PhaseType>(() => node.body));
    case "MethodSignature":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => memberNameSlots<PhaseType>(() => node.name, () => node.postfixToken), () => rawSignatureSlots<PhaseType>(node));
    case "PropertySignature":
    case "PropertyDeclaration":
      return declarationSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => memberNameSlots<PhaseType>(() => node.name, () => node.postfixToken), () => propertyMemberSlots<PhaseType>(() => node.type, () => node.initializer));
    case "PropertyAssignment":
      return propertyAssignmentSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => node.name, () => node.postfixToken, () => node.type, initializerSlots<PhaseType>(() => node.initializer));
    case "ClassStaticBlockDeclaration":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), staticBlockSlots<PhaseType>(() => node.body));
    case "BinaryExpression":
      return binaryFields<PhaseType>(node, () => node.modifiers, {
        modifiers: (field, list) => children<PhaseType, typeof node>([field, "list", () => list]),
        left: value => value, right: value => value, type: value => value, operator: value => value,
      });
    case "PrefixUnaryExpression":
    case "PostfixUnaryExpression":
      return unarySlots<PhaseType>(() => node.operand);
    case "YieldExpression":
      return yieldSlots<PhaseType>(() => node.asteriskToken, () => node.expression);
    case "ArrowFunction":
      return arrowSlots<PhaseType>(prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), rawSignatureSlots<PhaseType>(node)),
      () => node.asteriskToken, () => node.equalsGreaterThanToken, () => node.body);
    case "AsExpression":
    case "SatisfiesExpression":
      return annotatedExpressionSlots<PhaseType>(() => node.expression, () => node.type);
    case "ConditionalExpression":
      return conditionalSlots<PhaseType>({ condition: () => node.condition, question: () => node.questionToken, whenTrue: () => node.whenTrue,
        colon: () => node.colonToken, whenFalse: () => node.whenFalse });
    case "PropertyAccessExpression":
      return propertySlots<PhaseType>({ expression: () => node.expression, questionDotToken: () => node.questionDotToken }, () => node.name);
    case "ElementAccessExpression":
      return elementSlots<PhaseType>({ expression: () => node.expression, questionDotToken: () => node.questionDotToken }, () => node.argumentExpression);
    case "NewExpression":
      return applicationSlots<PhaseType, SyntaxChildSlot<PhaseType>>(node, value => value, value => value,
        () => children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]),
        sameSlot, () => children<PhaseType, typeof node>(["arguments", "list", () => node.arguments]));
    case "MetaProperty":
      return metaPropertySlots<PhaseType>(() => node.name);
    case "TemplateExpression":
    case "TemplateLiteralType":
      return templateHeadSlots<PhaseType>(() => node.head, () => children<PhaseType, typeof node>(["templateSpans", "list", () => node.templateSpans]));
    case "TemplateSpan":
      return templateSpanSlots<PhaseType>(() => node.expression, () => node.literal);
    case "TaggedTemplateExpression":
      return taggedTemplateSlots<PhaseType>(() => node.tag, () => node.questionDotToken,
        () => children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]), () => node.template);
    case "ArrayLiteralExpression":
      return arraySlots<PhaseType>(node, (field, list) => children<PhaseType, typeof node>([field, "list", () => list]));
    case "ObjectLiteralExpression":
      return objectSlots<PhaseType>(node, (field, list) => children<PhaseType, typeof node>([field, "list", () => list]));
    case "ShorthandPropertyAssignment":
      return propertyAssignmentSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        () => node.name, () => node.postfixToken, () => node.type, shorthandSlots<PhaseType>(() => node.equalsToken, () => node.objectAssignmentInitializer));
    case "TypeAssertionExpression":
      return assertionSlots<PhaseType>(() => node.type, () => node.expression);
    case "UnionType":
    case "IntersectionType":
      return children<PhaseType, typeof node>(["types", "list", () => node.types]);
    case "ConditionalType":
      return conditionalTypeSlots<PhaseType>(() => node.checkType, () => node.extendsType, () => node.trueType, () => node.falseType);
    case "JSDocTypeExpression":
    case "JSDocNonNullableType":
    case "JSDocNullableType":
    case "JSDocVariadicType":
    case "JSDocOptionalType":
    case "TypeOperator":
    case "OptionalType":
    case "RestType":
    case "ParenthesizedType":
      return wrappedTypeSlots<PhaseType>(() => node.type);
    case "InferType":
      return inferTypeSlots<PhaseType>(() => node.typeParameter);
    case "ArrayType":
      return arrayTypeSlots<PhaseType>(() => node.elementType);
    case "IndexedAccessType":
      return indexedTypeSlots<PhaseType>(() => node.objectType, () => node.indexType);
    case "TypeReference":
      return namedTypeSlots<PhaseType>("typeName", () => node.typeName,
        () => children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]));
    case "ExpressionWithTypeArguments":
      return expressionArgumentsSlots<PhaseType>(() => node.expression, () => children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]));
    case "LiteralType":
      return literalTypeSlots<PhaseType>(() => node.literal);
    case "TypePredicate":
      return typePredicateSlots<PhaseType>(() => node.assertsModifier, () => node.parameterName, () => node.type);
    case "ImportAttribute":
      return importAttributeSlots<PhaseType>(() => node.name, () => node.value);
    case "ImportAttributes":
      return children<PhaseType, typeof node>(["attributes", "list", () => node.attributes]);
    case "TypeQuery":
      return namedTypeSlots<PhaseType>("exprName", () => node.exprName,
        () => children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]));
    case "MappedType":
      return mappedTypeSlots<PhaseType>(() => node.readonlyToken, () => node.typeParameter, () => node.nameType, () => node.questionToken,
        () => node.type, () => children<PhaseType, typeof node>(["members", "list", () => node.members]));
    case "TypeLiteral":
      return children<PhaseType, typeof node>(["members", "list", () => node.members]);
    case "TupleType":
      return children<PhaseType, typeof node>(["elements", "list", () => node.elements]);
    case "NamedTupleMember":
      return namedTupleSlots<PhaseType>(() => node.dotDotDotToken, () => node.name, () => node.questionToken, () => node.type);
    case "TemplateLiteralTypeSpan":
      return templateTypeSpanSlots<PhaseType>(() => node.type, () => node.literal);
    case "JsxElement":
      return jsxElementSlots<PhaseType>(() => node.openingElement, () => children<PhaseType, typeof node>(["children", "list", () => node.children]), () => node.closingElement);
    case "JsxAttributes":
      return children<PhaseType, typeof node>(["properties", "list", () => node.properties]);
    case "JsxNamespacedName":
      return jsxNameSlots<PhaseType>(() => node.namespace, () => node.name);
    case "JsxOpeningElement":
    case "JsxSelfClosingElement":
      return jsxOpeningSlots<PhaseType>(() => node.tagName, () => children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]), () => node.attributes);
    case "JsxFragment":
      return jsxFragmentSlots<PhaseType>(() => node.openingFragment, () => children<PhaseType, typeof node>(["children", "list", () => node.children]), () => node.closingFragment);
    case "JsxAttribute":
      return jsxAttributeSlots<PhaseType>(() => node.name, () => node.initializer);
    case "JsxClosingElement":
      return jsxTagSlots<PhaseType>(() => node.tagName);
    case "JsxExpression":
      return jsxExpressionSlots<PhaseType>(() => node.dotDotDotToken, () => node.expression);
    case "SyntaxList":
      return children<PhaseType, typeof node>(["children", "array", () => node.children]);
    case "JSDoc":
      return children<PhaseType, typeof node>(["comment", "list", () => node.comment], ["tags", "list", () => node.tags]);
    case "JSDocTypeTag":
    case "JSDocSatisfiesTag":
    case "JSDocThisTag":
    case "JSDocOverloadTag":
      return docTagSlots<PhaseType>(() => node.tagName, docTypeSlots<PhaseType>(() => node.typeExpression),
        () => children<PhaseType, typeof node>(["comment", "list", () => node.comment]));
    case "JSDocReturnTag":
    case "JSDocThrowsTag":
      return docTagSlots<PhaseType>(() => node.tagName, docOptionalTypeSlots<PhaseType>(() => node.typeExpression),
        () => children<PhaseType, typeof node>(["comment", "list", () => node.comment]));
    case "JSDocUnknownTag":
    case "JSDocPublicTag":
    case "JSDocPrivateTag":
    case "JSDocProtectedTag":
    case "JSDocReadonlyTag":
    case "JSDocOverrideTag":
    case "JSDocDeprecatedTag":
      return docTagSlots<PhaseType>(() => node.tagName, [], () => children<PhaseType, typeof node>(["comment", "list", () => node.comment]));
    case "JSDocSeeTag":
      return docTagSlots<PhaseType>(() => node.tagName, docSeeSlots<PhaseType>(() => node.nameExpression),
        () => children<PhaseType, typeof node>(["comment", "list", () => node.comment]));
    case "JSDocTemplateTag":
      return docTagSlots<PhaseType>(() => node.tagName, docTemplateSlots<PhaseType>(() => node.constraint,
        () => children<PhaseType, typeof node>(["typeParameters", "list", () => node.typeParameters])),
      () => children<PhaseType, typeof node>(["comment", "list", () => node.comment]));
    case "JSDocImplementsTag":
    case "JSDocAugmentsTag":
      return docTagSlots<PhaseType>(() => node.tagName, docHeritageSlots<PhaseType>(() => node.className),
        () => children<PhaseType, typeof node>(["comment", "list", () => node.comment]));
    case "JSDocImportTag":
      return docTagSlots<PhaseType>(() => node.tagName, docImportSlots<PhaseType>(() => node.importClause, () => node.moduleSpecifier, () => node.attributes),
        () => children<PhaseType, typeof node>(["comment", "list", () => node.comment]));
    case "JSDocCallbackTag":
      return docTagSlots<PhaseType>(() => node.tagName, docCallbackSlots<PhaseType>(() => node.typeExpression, () => node.name),
        () => children<PhaseType, typeof node>(["comment", "list", () => node.comment]));
    case "JSDocTypedefTag":
      return docTagSlots<PhaseType>(() => node.tagName, docTypedefSlots<PhaseType>(() => node.typeExpression, () => node.name),
        () => children<PhaseType, typeof node>(["comment", "list", () => node.comment]));
    case "SourceFile":
      return iterateSourceFileHeaderSlots(node, sameSlot<PhaseType>, field => children<PhaseType, typeof node>([field, "list", () => node.statements]));
    case "ModuleDeclaration":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        namespaceSlots<PhaseType>(() => node.asteriskToken, () => node.name, () => node.body));
    case "ImportEqualsDeclaration":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        importEqualsSlots<PhaseType>(() => node.name, () => node.moduleReference));
    case "ExportDeclaration":
      return prependSlots<PhaseType>(children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]),
        exportDeclarationSlots<PhaseType>(() => node.exportClause, () => node.moduleSpecifier, () => node.attributes));
    case "ImportType":
      return prependSlots<PhaseType>(importTypeSlots<PhaseType>(() => node.argument, () => node.attributes, () => node.qualifier),
        children<PhaseType, typeof node>(["typeArguments", "list", () => node.typeArguments]));
    case "ImportClause":
      return importClauseSlots<PhaseType>(() => node.name, () => node.namedBindings);
    case "TypeParameter":
      return typeParameterSlots<PhaseType>(() => children<PhaseType, typeof node>(["modifiers", "list", () => node.modifiers]), () => node.name,
        () => node.constraint, () => node.expression, () => node.defaultType);
    case "SyntheticReferenceExpression":
      return syntheticReferenceSlots<PhaseType>(() => node.expression, () => node.thisArg);
    case "JSDocTypeLiteral":
      return children<PhaseType, typeof node>(["jsDocPropertyTags", "array", () => node.jsDocPropertyTags]);
    case "JSDocParameterTag":
    case "JSDocPropertyTag":
      return docTagSlots<PhaseType>(() => node.tagName, docParameterSlots<PhaseType>(() => node.name, () => node.typeExpression),
        () => children<PhaseType, typeof node>(["comment", "list", () => node.comment]));
    case "AnyKeyword":
    case "BigIntKeyword":
    case "BooleanKeyword":
    case "IntrinsicKeyword":
    case "NeverKeyword":
    case "NumberKeyword":
    case "ObjectKeyword":
    case "StringKeyword":
    case "SymbolKeyword":
    case "UndefinedKeyword":
    case "UnknownKeyword":
    case "VoidKeyword":
    case "NullKeyword":
    case "TrueKeyword":
    case "FalseKeyword":
    case "ThisKeyword":
    case "SuperKeyword":
    case "ImportKeyword":
    case "Unknown":
    case "EndOfFile":
    case "SingleLineCommentTrivia":
    case "MultiLineCommentTrivia":
    case "NewLineTrivia":
    case "WhitespaceTrivia":
    case "ConflictMarkerTrivia":
    case "NonTextFileMarkerTrivia":
    case "JsxTextAllWhiteSpaces":
    case "OpenBraceToken":
    case "CloseBraceToken":
    case "OpenParenToken":
    case "CloseParenToken":
    case "OpenBracketToken":
    case "CloseBracketToken":
    case "DotToken":
    case "DotDotDotToken":
    case "SemicolonToken":
    case "CommaToken":
    case "QuestionDotToken":
    case "LessThanToken":
    case "LessThanSlashToken":
    case "GreaterThanToken":
    case "LessThanEqualsToken":
    case "GreaterThanEqualsToken":
    case "EqualsEqualsToken":
    case "ExclamationEqualsToken":
    case "EqualsEqualsEqualsToken":
    case "ExclamationEqualsEqualsToken":
    case "EqualsGreaterThanToken":
    case "PlusToken":
    case "MinusToken":
    case "AsteriskToken":
    case "AsteriskAsteriskToken":
    case "SlashToken":
    case "PercentToken":
    case "PlusPlusToken":
    case "MinusMinusToken":
    case "LessThanLessThanToken":
    case "GreaterThanGreaterThanToken":
    case "GreaterThanGreaterThanGreaterThanToken":
    case "AmpersandToken":
    case "BarToken":
    case "CaretToken":
    case "ExclamationToken":
    case "TildeToken":
    case "AmpersandAmpersandToken":
    case "BarBarToken":
    case "QuestionToken":
    case "ColonToken":
    case "AtToken":
    case "QuestionQuestionToken":
    case "BacktickToken":
    case "HashToken":
    case "EqualsToken":
    case "PlusEqualsToken":
    case "MinusEqualsToken":
    case "AsteriskEqualsToken":
    case "AsteriskAsteriskEqualsToken":
    case "SlashEqualsToken":
    case "PercentEqualsToken":
    case "LessThanLessThanEqualsToken":
    case "GreaterThanGreaterThanEqualsToken":
    case "GreaterThanGreaterThanGreaterThanEqualsToken":
    case "AmpersandEqualsToken":
    case "BarEqualsToken":
    case "BarBarEqualsToken":
    case "AmpersandAmpersandEqualsToken":
    case "QuestionQuestionEqualsToken":
    case "CaretEqualsToken":
    case "JSDocCommentTextToken":
    case "BreakKeyword":
    case "CaseKeyword":
    case "CatchKeyword":
    case "ClassKeyword":
    case "ConstKeyword":
    case "ContinueKeyword":
    case "DebuggerKeyword":
    case "DefaultKeyword":
    case "DeleteKeyword":
    case "DoKeyword":
    case "ElseKeyword":
    case "EnumKeyword":
    case "ExportKeyword":
    case "ExtendsKeyword":
    case "FinallyKeyword":
    case "ForKeyword":
    case "FunctionKeyword":
    case "IfKeyword":
    case "InKeyword":
    case "InstanceOfKeyword":
    case "NewKeyword":
    case "ReturnKeyword":
    case "SwitchKeyword":
    case "ThrowKeyword":
    case "TryKeyword":
    case "TypeOfKeyword":
    case "VarKeyword":
    case "WhileKeyword":
    case "WithKeyword":
    case "ImplementsKeyword":
    case "InterfaceKeyword":
    case "LetKeyword":
    case "PackageKeyword":
    case "PrivateKeyword":
    case "ProtectedKeyword":
    case "PublicKeyword":
    case "StaticKeyword":
    case "YieldKeyword":
    case "AbstractKeyword":
    case "AccessorKeyword":
    case "AsKeyword":
    case "AssertsKeyword":
    case "AssertKeyword":
    case "AsyncKeyword":
    case "AwaitKeyword":
    case "ConstructorKeyword":
    case "DeclareKeyword":
    case "GetKeyword":
    case "ImmediateKeyword":
    case "InferKeyword":
    case "IsKeyword":
    case "KeyOfKeyword":
    case "ModuleKeyword":
    case "NamespaceKeyword":
    case "OutKeyword":
    case "ReadonlyKeyword":
    case "RequireKeyword":
    case "SatisfiesKeyword":
    case "SetKeyword":
    case "TypeKeyword":
    case "UniqueKeyword":
    case "UsingKeyword":
    case "FromKeyword":
    case "GlobalKeyword":
    case "OverrideKeyword":
    case "OfKeyword":
    case "DeferKeyword":
    case "Identifier":
    case "PrivateIdentifier":
    case "EmptyStatement":
    case "DebuggerStatement":
    case "NotEmittedStatement":
    case "NotEmittedTypeElement":
    case "SemicolonClassElement":
    case "OmittedExpression":
    case "ExcludedExpression":
    case "StringLiteral":
    case "NumericLiteral":
    case "BigIntLiteral":
    case "RegularExpressionLiteral":
    case "NoSubstitutionTemplateLiteral":
    case "ThisType":
    case "TemplateHead":
    case "TemplateMiddle":
    case "TemplateTail":
    case "JsxText":
    case "JsxOpeningFragment":
    case "JsxClosingFragment":
    case "JSDocAllType":
    case "JSDocText":
      return emptyChildren;
  }
}
