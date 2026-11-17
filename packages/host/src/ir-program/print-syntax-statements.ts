import type { EmptyStatement, IfStatement, DoStatement, WhileStatement, ForStatement, ForInStatement, ForOfStatement, BreakStatement, ContinueStatement, ReturnStatement, WithStatement, SwitchStatement, CaseBlock, CaseClause, DefaultClause, ThrowStatement, TryStatement, CatchClause, DebuggerStatement, LabeledStatement, ExpressionStatement, Block, VariableStatement, VariableDeclaration, VariableDeclarationList, BindingPattern, ParameterDeclaration, BindingElement, MissingDeclaration, FunctionDeclaration, ClassDeclaration, ClassExpression, HeritageClause, InterfaceDeclaration, TypeAliasDeclaration, EnumMember, EnumDeclaration, ModuleBlock, NotEmittedStatement, NotEmittedTypeElement, CallSignatureDeclaration, ConstructSignatureDeclaration, ConstructorDeclaration, GetAccessorDeclaration, SetAccessorDeclaration, IndexSignatureDeclaration, MethodSignatureDeclaration, MethodDeclaration, PropertySignatureDeclaration, PropertyDeclaration, SemicolonClassElement, ClassStaticBlockDeclaration } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import { textTypedBindingElement } from "./text-phase-declarations.js";
import type { SyntaxTextContext, TextWork } from "./text-values.js";
import { textSyntaxHeader, field, record, token, text, boolean, textNodeList } from "./text-values.js";
import { textTypedIteration, textTypedControlTransfer, textTypedVariableList, textTypedClassValue } from "./text-phase.js";
import { textTypedBinding, textTypedBindingPattern, textTypedParameter, textTypedCallable, textTypedClass, textTypedHeritage, textTypedInterface, textTypedAlias, textTypedStorageDeclaration, textTypedEnum, textTypedIndexDeclaration, textTypedStaticBlock } from "./text-phase-declarations.js";

export function printEmptyStatement(node: EmptyStatement<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tsonic", token("null")),
  ]);
}

export function printIfStatement(node: IfStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("thenStatement", context.reference(node.thenStatement)),
    field("elseStatement", (node.elseStatement === null ? token("null") : context.reference(node.elseStatement))),
    field("tsonic", token("null")),
  ]);
}

export function printDoStatement(node: DoStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("statement", context.reference(node.statement)),
    field("expression", context.reference(node.expression)),
    field("tsonic", token("null")),
  ]);
}

export function printWhileStatement(node: WhileStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("statement", context.reference(node.statement)),
    field("expression", context.reference(node.expression)),
    field("tsonic", token("null")),
  ]);
}

export function printForStatement(node: ForStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("statement", context.reference(node.statement)),
    field("initializer", (node.initializer === null ? token("null") : context.reference(node.initializer))),
    field("condition", (node.condition === null ? token("null") : context.reference(node.condition))),
    field("incrementor", (node.incrementor === null ? token("null") : context.reference(node.incrementor))),
    field("tsonic", token("null")),
  ]);
}

export function printForInStatement(node: ForInStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("awaitModifier", token("null")),
    field("initializer", context.reference(node.initializer)),
    field("expression", context.reference(node.expression)),
    field("statement", context.reference(node.statement)),
    field("tsonic", textTypedIteration(node.tsonic)),
  ]);
}

export function printForOfStatement(node: ForOfStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("awaitModifier", (node.awaitModifier === null ? token("null") : context.reference(node.awaitModifier))),
    field("initializer", context.reference(node.initializer)),
    field("expression", context.reference(node.expression)),
    field("statement", context.reference(node.statement)),
    field("tsonic", textTypedIteration(node.tsonic)),
  ]);
}

export function printBreakStatement(node: BreakStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("label", (node.label === null ? token("null") : context.reference(node.label))),
    field("tsonic", textTypedControlTransfer(node.tsonic)),
  ]);
}

export function printContinueStatement(node: ContinueStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("label", (node.label === null ? token("null") : context.reference(node.label))),
    field("tsonic", textTypedControlTransfer(node.tsonic)),
  ]);
}

export function printReturnStatement(node: ReturnStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", (node.expression === null ? token("null") : context.reference(node.expression))),
    field("tsonic", token("null")),
  ]);
}

export function printWithStatement(node: WithStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("statement", context.reference(node.statement)),
    field("tsonic", token("null")),
  ]);
}

export function printSwitchStatement(node: SwitchStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("caseBlock", context.reference(node.caseBlock)),
    field("tsonic", token("null")),
  ]);
}

export function printCaseBlock(node: CaseBlock<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("clauses", textNodeList(node.clauses, context)),
    field("tsonic", token("null")),
  ]);
}

export function printCaseClause(node: CaseClause<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("statements", textNodeList(node.statements, context)),
    field("tsonic", token("null")),
  ]);
}

export function printDefaultClause(node: DefaultClause<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", token("null")),
    field("statements", textNodeList(node.statements, context)),
    field("tsonic", token("null")),
  ]);
}

export function printThrowStatement(node: ThrowStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", token("null")),
  ]);
}

export function printTryStatement(node: TryStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tryBlock", context.reference(node.tryBlock)),
    field("catchClause", (node.catchClause === null ? token("null") : context.reference(node.catchClause))),
    field("finallyBlock", (node.finallyBlock === null ? token("null") : context.reference(node.finallyBlock))),
    field("tsonic", token("null")),
  ]);
}

export function printCatchClause(node: CatchClause<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("variableDeclaration", (node.variableDeclaration === null ? token("null") : context.reference(node.variableDeclaration))),
    field("block", context.reference(node.block)),
    field("tsonic", token("null")),
  ]);
}

export function printDebuggerStatement(node: DebuggerStatement<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tsonic", token("null")),
  ]);
}

export function printLabeledStatement(node: LabeledStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("label", context.reference(node.label)),
    field("statement", context.reference(node.statement)),
    field("tsonic", textTypedControlTransfer(node.tsonic)),
  ]);
}

export function printExpressionStatement(node: ExpressionStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("expression", context.reference(node.expression)),
    field("tsonic", token("null")),
  ]);
}

export function printBlock(node: Block<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("statements", textNodeList(node.statements, context)),
    field("multiLine", boolean(node.multiLine)),
    field("tsonic", token("null")),
  ]);
}

export function printVariableStatement(node: VariableStatement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("declarationList", context.reference(node.declarationList)),
    field("tsonic", token("null")),
  ]);
}

export function printVariableDeclaration(node: VariableDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("name", context.reference(node.name)),
    field("exclamationToken", (node.exclamationToken === null ? token("null") : context.reference(node.exclamationToken))),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("initializer", (node.initializer === null ? token("null") : context.reference(node.initializer))),
    field("tsonic", textTypedBinding(node.tsonic)),
  ]);
}

export function printVariableDeclarationList(node: VariableDeclarationList<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("declarations", textNodeList(node.declarations, context)),
    field("tsonic", textTypedVariableList(node.tsonic)),
  ]);
}

export function printBindingPattern(node: BindingPattern<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("elements", textNodeList(node.elements, context)),
    field("tsonic", textTypedBindingPattern(node.tsonic)),
  ]);
}

export function printParameterDeclaration(node: ParameterDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("dotDotDotToken", (node.dotDotDotToken === null ? token("null") : context.reference(node.dotDotDotToken))),
    field("name", context.reference(node.name)),
    field("questionToken", (node.questionToken === null ? token("null") : context.reference(node.questionToken))),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("initializer", (node.initializer === null ? token("null") : context.reference(node.initializer))),
    field("tsonic", textTypedParameter(node.tsonic)),
  ]);
}

export function printBindingElement(node: BindingElement<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("dotDotDotToken", (node.dotDotDotToken === null ? token("null") : context.reference(node.dotDotDotToken))),
    field("propertyName", (node.propertyName === null ? token("null") : context.reference(node.propertyName))),
    field("name", (node.name === null ? token("null") : context.reference(node.name))),
    field("initializer", (node.initializer === null ? token("null") : context.reference(node.initializer))),
    field("tsonic", textTypedBindingElement(node.tsonic)),
  ]);
}

export function printMissingDeclaration(node: MissingDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("tsonic", token("null")),
  ]);
}

export function printFunctionDeclaration(node: FunctionDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("asteriskToken", (node.asteriskToken === null ? token("null") : context.reference(node.asteriskToken))),
    field("body", (node.body === null ? token("null") : context.reference(node.body))),
    field("name", (node.name === null ? token("null") : context.reference(node.name))),
    field("tsonic", textTypedCallable(node.tsonic)),
  ]);
}

export function printClassDeclaration(node: ClassDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", (node.name === null ? token("null") : context.reference(node.name))),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("heritageClauses", (node.heritageClauses === null ? token("null") : textNodeList(node.heritageClauses, context))),
    field("members", textNodeList(node.members, context)),
    field("tsonic", textTypedClass(node.tsonic)),
  ]);
}

export function printClassExpression(node: ClassExpression<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", (node.name === null ? token("null") : context.reference(node.name))),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("heritageClauses", (node.heritageClauses === null ? token("null") : textNodeList(node.heritageClauses, context))),
    field("members", textNodeList(node.members, context)),
    field("tsonic", textTypedClassValue(node.tsonic)),
  ]);
}

export function printHeritageClause(node: HeritageClause<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("token", text(node.token)),
    field("types", textNodeList(node.types, context)),
    field("tsonic", textTypedHeritage(node.tsonic)),
  ]);
}

export function printInterfaceDeclaration(node: InterfaceDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("heritageClauses", (node.heritageClauses === null ? token("null") : textNodeList(node.heritageClauses, context))),
    field("members", textNodeList(node.members, context)),
    field("tsonic", textTypedInterface(node.tsonic)),
  ]);
}

export function printTypeAliasDeclaration(node: TypeAliasDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("type", context.reference(node.type)),
    field("tsonic", textTypedAlias(node.tsonic)),
  ]);
}

export function printEnumMember(node: EnumMember<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("postfixToken", (node.postfixToken === null ? token("null") : context.reference(node.postfixToken))),
    field("initializer", (node.initializer === null ? token("null") : context.reference(node.initializer))),
    field("tsonic", textTypedStorageDeclaration(node.tsonic)),
  ]);
}

export function printEnumDeclaration(node: EnumDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("members", textNodeList(node.members, context)),
    field("tsonic", textTypedEnum(node.tsonic)),
  ]);
}

export function printModuleBlock(node: ModuleBlock<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("statements", textNodeList(node.statements, context)),
    field("tsonic", token("null")),
  ]);
}

export function printNotEmittedStatement(node: NotEmittedStatement<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tsonic", token("null")),
  ]);
}

export function printNotEmittedTypeElement(node: NotEmittedTypeElement<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tsonic", token("null")),
  ]);
}

export function printCallSignatureDeclaration(node: CallSignatureDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("tsonic", textTypedCallable(node.tsonic)),
  ]);
}

export function printConstructSignatureDeclaration(node: ConstructSignatureDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("tsonic", textTypedCallable(node.tsonic)),
  ]);
}

export function printConstructorDeclaration(node: ConstructorDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("asteriskToken", (node.asteriskToken === null ? token("null") : context.reference(node.asteriskToken))),
    field("body", (node.body === null ? token("null") : context.reference(node.body))),
    field("tsonic", textTypedCallable(node.tsonic)),
  ]);
}

export function printGetAccessorDeclaration(node: GetAccessorDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("postfixToken", (node.postfixToken === null ? token("null") : context.reference(node.postfixToken))),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("asteriskToken", (node.asteriskToken === null ? token("null") : context.reference(node.asteriskToken))),
    field("body", (node.body === null ? token("null") : context.reference(node.body))),
    field("tsonic", textTypedCallable(node.tsonic)),
  ]);
}

export function printSetAccessorDeclaration(node: SetAccessorDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("postfixToken", (node.postfixToken === null ? token("null") : context.reference(node.postfixToken))),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("asteriskToken", (node.asteriskToken === null ? token("null") : context.reference(node.asteriskToken))),
    field("body", (node.body === null ? token("null") : context.reference(node.body))),
    field("tsonic", textTypedCallable(node.tsonic)),
  ]);
}

export function printIndexSignatureDeclaration(node: IndexSignatureDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("tsonic", textTypedIndexDeclaration(node.tsonic)),
  ]);
}

export function printMethodSignatureDeclaration(node: MethodSignatureDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("postfixToken", (node.postfixToken === null ? token("null") : context.reference(node.postfixToken))),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("tsonic", textTypedCallable(node.tsonic)),
  ]);
}

export function printMethodDeclaration(node: MethodDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("postfixToken", (node.postfixToken === null ? token("null") : context.reference(node.postfixToken))),
    field("typeParameters", (node.typeParameters === null ? token("null") : textNodeList(node.typeParameters, context))),
    field("parameters", textNodeList(node.parameters, context)),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("fullSignature", (node.fullSignature === null ? token("null") : context.reference(node.fullSignature))),
    field("asteriskToken", (node.asteriskToken === null ? token("null") : context.reference(node.asteriskToken))),
    field("body", (node.body === null ? token("null") : context.reference(node.body))),
    field("tsonic", textTypedCallable(node.tsonic)),
  ]);
}

export function printPropertySignatureDeclaration(node: PropertySignatureDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("postfixToken", (node.postfixToken === null ? token("null") : context.reference(node.postfixToken))),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("initializer", (node.initializer === null ? token("null") : context.reference(node.initializer))),
    field("tsonic", textTypedStorageDeclaration(node.tsonic)),
  ]);
}

export function printPropertyDeclaration(node: PropertyDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("name", context.reference(node.name)),
    field("postfixToken", (node.postfixToken === null ? token("null") : context.reference(node.postfixToken))),
    field("type", (node.type === null ? token("null") : context.reference(node.type))),
    field("initializer", (node.initializer === null ? token("null") : context.reference(node.initializer))),
    field("tsonic", textTypedStorageDeclaration(node.tsonic)),
  ]);
}

export function printSemicolonClassElement(node: SemicolonClassElement<TypedPhase>, _context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("tsonic", token("null")),
  ]);
}

export function printClassStaticBlockDeclaration(node: ClassStaticBlockDeclaration<TypedPhase>, context: SyntaxTextContext): TextWork {
  return record(node.kind, [
    ...textSyntaxHeader(node),
    field("modifiers", (node.modifiers === null ? token("null") : textNodeList(node.modifiers, context, "ModifierList"))),
    field("body", context.reference(node.body)),
    field("tsonic", textTypedStaticBlock(node.tsonic)),
  ]);
}
