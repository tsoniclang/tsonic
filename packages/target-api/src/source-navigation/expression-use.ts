import type { AstReader, Node } from "@tsonic/tsts";
import { sourceNodesEqual } from "./identity.js";
import { sourceTransparentExpressionOperand } from "./ast.js";
import type { SourceProgramNavigation } from "./types.js";

export function sourceExpressionSelectsOperandValue(ast: AstReader, expression: Node, operand: Node): boolean {
  if (ast.is.IsConditionalExpression(expression)) {
    const conditional = ast.as.AsConditionalExpression(expression);
    return sourceNodesEqual(ast, conditional?.WhenTrue, operand) ||
      sourceNodesEqual(ast, conditional?.WhenFalse, operand);
  }
  if (!ast.is.IsBinaryExpression(expression)) return false;
  const binary = ast.as.AsBinaryExpression(expression);
  const operator = ast.operatorKindName(expression);
  if (operator === "KindCommaToken") return sourceNodesEqual(ast, binary?.Right, operand);
  return (operator === "KindQuestionQuestionToken" || operator === "KindAmpersandAmpersandToken" ||
    operator === "KindBarBarToken") &&
    (sourceNodesEqual(ast, binary?.Left, operand) || sourceNodesEqual(ast, binary?.Right, operand));
}

export type SourceExpressionResultDisposition =
  | { readonly kind: "discarded"; readonly use: Node }
  | { readonly kind: "stored"; readonly use: Node }
  | { readonly kind: "returned"; readonly use: Node }
  | { readonly kind: "consumed"; readonly use: Node }
  | { readonly kind: "awaited-in-scope"; readonly use: Node; readonly completionReturned: boolean }
  | { readonly kind: "passed"; readonly use: Node; readonly invocation: Node; readonly argument: Node };

export function sourceExpressionResultDisposition(
  ast: AstReader,
  expression: Node,
): SourceExpressionResultDisposition {
  let current = expression;
  const visited = new Set<Node>();
  for (;;) {
    if (visited.has(current) || visited.size >= 262_144) {
      throw new Error("Expression result use exceeded its finite acyclic source boundary.");
    }
    visited.add(current);
    const parent = ast.parent(current);
    if (parent === undefined) {
      return Object.freeze({ kind: "consumed", use: current });
    }
    if (sourceNodesEqual(ast, sourceTransparentExpressionOperand(ast, parent), current)) {
      current = parent;
      continue;
    }
    if (ast.is.IsExpressionStatement(parent)) {
      return Object.freeze({ kind: sourceNodesEqual(ast,
        ast.as.AsExpressionStatement(parent)?.Expression, current) ? "discarded" : "consumed", use: parent });
    }
    if (ast.is.IsVoidExpression(parent)) {
      return Object.freeze({ kind: sourceNodesEqual(ast,
        ast.as.AsVoidExpression(parent)?.Expression, current) ? "discarded" : "consumed", use: parent });
    }
    if (ast.is.IsAwaitExpression(parent) &&
      sourceNodesEqual(ast, ast.as.AsAwaitExpression(parent)?.Expression, current)) {
      let completion = parent;
      while (true) {
        const owner = ast.parent(completion);
        if (owner === undefined || !sourceNodesEqual(ast, sourceTransparentExpressionOperand(ast, owner), completion)) break;
        if (visited.has(owner) || visited.size >= 262_144) {
          throw new Error("Expression result use exceeded its finite acyclic source boundary.");
        }
        visited.add(owner);
        completion = owner;
      }
      const owner = ast.parent(completion);
      return Object.freeze({ kind: "awaited-in-scope", use: parent,
        completionReturned: owner !== undefined && ast.is.IsReturnStatement(owner) &&
          sourceNodesEqual(ast, ast.as.AsReturnStatement(owner)?.Expression, completion) });
    }
    if (ast.is.IsReturnStatement(parent) &&
      sourceNodesEqual(ast, ast.as.AsReturnStatement(parent)?.Expression, current) ||
      ast.is.IsArrowFunction(parent) && sourceNodesEqual(ast, ast.body(parent), current)) {
      return Object.freeze({ kind: "returned", use: parent });
    }
    if (ast.is.IsVariableDeclaration(parent) &&
      sourceNodesEqual(ast, ast.as.AsVariableDeclaration(parent)?.Initializer, current) ||
      ast.is.IsPropertyDeclaration(parent) &&
      sourceNodesEqual(ast, ast.as.AsPropertyDeclaration(parent)?.Initializer, current) ||
      ast.is.IsPropertyAssignment(parent) &&
      sourceNodesEqual(ast, ast.as.AsPropertyAssignment(parent)?.Initializer, current) ||
      ast.is.IsBindingElement(parent) &&
      sourceNodesEqual(ast, ast.as.AsBindingElement(parent)?.Initializer, current) ||
      ast.is.IsArrayLiteralExpression(parent) || ast.is.IsSpreadElement(parent) ||
      ast.is.IsSpreadAssignment(parent) || ast.is.IsYieldExpression(parent) || ast.is.IsExportAssignment(parent)) {
      return Object.freeze({ kind: "stored", use: parent });
    }
    if ((ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) &&
      ast.arguments(parent).some(argument => sourceNodesEqual(ast, argument, current))) {
      return Object.freeze({ kind: "passed", use: parent, invocation: parent, argument: current });
    }
    if (ast.is.IsConditionalExpression(parent) && sourceExpressionSelectsOperandValue(ast, parent, current)) {
      current = parent;
      continue;
    }
    if (ast.is.IsBinaryExpression(parent)) {
      const binary = ast.as.AsBinaryExpression(parent);
      const operator = ast.operatorKindName(parent);
      if (operator === "KindEqualsToken" && sourceNodesEqual(ast, binary?.Right, current)) {
        return Object.freeze({ kind: "stored", use: parent });
      }
      if (operator === "KindCommaToken" && sourceNodesEqual(ast, binary?.Left, current)) {
        return Object.freeze({ kind: "discarded", use: parent });
      }
      if ((operator === "KindCommaToken" || operator === "KindQuestionQuestionToken" ||
        operator === "KindAmpersandAmpersandToken" || operator === "KindBarBarToken") &&
        sourceNodesEqual(ast, binary?.Right, current) || operator === "KindQuestionQuestionToken" &&
        sourceNodesEqual(ast, binary?.Left, current)) {
        current = parent;
        continue;
      }
      return Object.freeze({ kind: "consumed", use: parent });
    }
    if (ast.is.IsForStatement(parent)) {
      const statement = ast.as.AsForStatement(parent);
      return Object.freeze({ kind: sourceNodesEqual(ast, statement?.Initializer, current) ||
        sourceNodesEqual(ast, statement?.Incrementor, current) ? "discarded" : "consumed", use: parent });
    }
    return Object.freeze({ kind: "consumed", use: parent });
  }
}

export function sourceExpressionResultUse(ast: AstReader, expression: Node): "consumed" | "discarded" {
  return sourceExpressionResultDisposition(ast, expression).kind === "discarded" ? "discarded" : "consumed";
}

export function sourceCallableDefinitionIsDiscarded(
  declaration: Node,
  ast: AstReader,
  navigation: Pick<SourceProgramNavigation, "expressionValueFlow">,
): boolean {
  const visited = new Set<Node>();
  for (let current: Node | undefined = declaration; current !== undefined; current = ast.parent(current)) {
    if (visited.has(current) || visited.size >= 262_144) {
      throw new Error("Callable creation demand exceeded its finite acyclic source boundary.");
    }
    visited.add(current);
    if (ast.is.IsArrowFunction(current) || ast.is.IsFunctionExpression(current)) {
      const disposition = sourceExpressionResultDisposition(ast, current);
      if (disposition.kind === "discarded") return true;
      if (disposition.kind !== "stored") continue;
      const flow = navigation.expressionValueFlow(current);
      if (!flow.escapes && !flow.memberWritten && !flow.receiverUsed && !flow.identityCompared &&
        flow.aliasDeclarations.length !== 0 && flow.uses.every(use => use.kind === "type-only" ||
          use.role === "storage" || use.kind !== "direct-call" && use.role !== "write" &&
          sourceExpressionResultDisposition(ast, use.reference).kind === "discarded")) return true;
    }
  }
  return false;
}

export type SourceValueInputSlot =
  | { readonly kind: "effect" | "initializer" | "return" | "thrown" | "condition" | "default" | "receiver" | "callee" | "key" }
  | { readonly kind: "operand"; readonly position: "only" | "left" | "right" }
  | { readonly kind: "branch"; readonly branch: "true" | "false" }
  | { readonly kind: "element" | "member" | "span" | "case"; readonly index: number };

export interface SourceValueInput {
  readonly owner: Node;
  readonly expression: Node;
  readonly slot: SourceValueInputSlot;
}

function sourceValueInput(owner: Node, expression: Node | undefined, slot: SourceValueInputSlot): readonly SourceValueInput[] {
  return expression === undefined ? [] : [Object.freeze({ owner, expression, slot: Object.freeze(slot) })];
}

export function sourceConstructValueInputs(ast: AstReader, owner: Node): readonly SourceValueInput[] {
  const use = (expression: Node | undefined, slot: SourceValueInputSlot) => sourceValueInput(owner, expression, slot);
  if (ast.is.IsExpressionStatement(owner)) return use(ast.as.AsExpressionStatement(owner)?.Expression, { kind: "effect" });
  if (ast.is.IsReturnStatement(owner)) return use(ast.as.AsReturnStatement(owner)?.Expression, { kind: "return" });
  if (ast.is.IsThrowStatement(owner)) return use(ast.as.AsThrowStatement(owner)?.Expression, { kind: "thrown" });
  if (ast.is.IsVariableDeclaration(owner)) return use(ast.as.AsVariableDeclaration(owner)?.Initializer, { kind: "initializer" });
  if (ast.is.IsBindingElement(owner)) return use(ast.as.AsBindingElement(owner)?.Initializer, { kind: "default" });
  if (ast.is.IsParameterDeclaration(owner)) return use(ast.as.AsParameterDeclaration(owner)?.Initializer, { kind: "default" });
  if (ast.is.IsEnumMember(owner)) return use(ast.as.AsEnumMember(owner)?.Initializer, { kind: "initializer" });
  if (ast.is.IsIfStatement(owner)) return use(ast.as.AsIfStatement(owner)?.Expression, { kind: "condition" });
  if (ast.is.IsWhileStatement(owner)) return use(ast.as.AsWhileStatement(owner)?.Expression, { kind: "condition" });
  if (ast.is.IsDoStatement(owner)) return use(ast.as.AsDoStatement(owner)?.Expression, { kind: "condition" });
  if (ast.is.IsForOfStatement(owner) || ast.is.IsForInStatement(owner)) return use(ast.as.AsForInOrOfStatement(owner)?.Expression, { kind: "operand", position: "only" });
  if (ast.is.IsForStatement(owner)) {
    const statement = ast.as.AsForStatement(owner);
    const initializer = statement?.Initializer;
    return [...(initializer === undefined || ast.is.IsVariableDeclarationList(initializer) ? [] : use(initializer, { kind: "initializer" })),
      ...use(statement?.Condition, { kind: "condition" }), ...use(statement?.Incrementor, { kind: "effect" })];
  }
  if (ast.is.IsSwitchStatement(owner)) {
    const statement = ast.as.AsSwitchStatement(owner);
    const clauses = statement?.CaseBlock === undefined ? [] : ast.children(statement.CaseBlock);
    return [...use(statement?.Expression, { kind: "condition" }), ...clauses.flatMap((clause, index) =>
      clause === undefined || !ast.is.IsCaseClause(clause) ? [] : use(ast.as.AsCaseOrDefaultClause(clause)?.Expression, { kind: "case", index }))];
  }
  if (ast.is.IsExportAssignment(owner)) {
    const assignment = ast.as.AsExportAssignment(owner);
    return assignment?.IsExportEquals === false ? use(assignment.Expression, { kind: "initializer" }) : [];
  }
  if (ast.is.IsArrowFunction(owner)) {
    const body = ast.body(owner);
    return body === undefined || ast.is.IsBlock(body) ? [] : use(body, { kind: "return" });
  }
  return [];
}

export function sourceExpressionValueInputs(ast: AstReader, owner: Node): readonly SourceValueInput[] | undefined {
  const use = (expression: Node | undefined, slot: SourceValueInputSlot) => sourceValueInput(owner, expression, slot);
  const transparent = sourceTransparentExpressionOperand(ast, owner);
  if (transparent !== undefined) return use(transparent, { kind: "operand", position: "only" });
  if (ast.is.IsConditionalExpression(owner)) {
    const value = ast.as.AsConditionalExpression(owner);
    return [...use(value?.Condition, { kind: "condition" }), ...use(value?.WhenTrue, { kind: "branch", branch: "true" }),
      ...use(value?.WhenFalse, { kind: "branch", branch: "false" })];
  }
  if (ast.is.IsBinaryExpression(owner)) {
    const value = ast.as.AsBinaryExpression(owner);
    return [...use(value?.Left, { kind: "operand", position: "left" }), ...use(value?.Right, { kind: "operand", position: "right" })];
  }
  if (ast.is.IsPrefixUnaryExpression(owner)) return use(ast.as.AsPrefixUnaryExpression(owner)?.Operand, { kind: "operand", position: "only" });
  if (ast.is.IsPostfixUnaryExpression(owner)) return use(ast.as.AsPostfixUnaryExpression(owner)?.Operand, { kind: "operand", position: "only" });
  if (ast.is.IsAwaitExpression(owner)) return use(ast.as.AsAwaitExpression(owner)?.Expression, { kind: "operand", position: "only" });
  if (ast.is.IsYieldExpression(owner)) return use(ast.as.AsYieldExpression(owner)?.Expression, { kind: "operand", position: "only" });
  if (ast.is.IsTypeOfExpression(owner)) return use(ast.as.AsTypeOfExpression(owner)?.Expression, { kind: "operand", position: "only" });
  if (ast.is.IsVoidExpression(owner)) return use(ast.as.AsVoidExpression(owner)?.Expression, { kind: "effect" });
  if (ast.is.IsDeleteExpression(owner)) return use(ast.as.AsDeleteExpression(owner)?.Expression, { kind: "operand", position: "only" });
  if (ast.is.IsSpreadElement(owner)) return use(ast.as.AsSpreadElement(owner)?.Expression, { kind: "operand", position: "only" });
  if (ast.is.IsPropertyAccessExpression(owner)) return use(ast.as.AsPropertyAccessExpression(owner)?.Expression, { kind: "receiver" });
  if (ast.is.IsElementAccessExpression(owner)) {
    const value = ast.as.AsElementAccessExpression(owner);
    return [...use(value?.Expression, { kind: "receiver" }), ...use(value?.ArgumentExpression, { kind: "key" })];
  }
  if (ast.is.IsArrayLiteralExpression(owner)) return ast.children(owner).flatMap((element, index) =>
    element === undefined || ast.is.IsOmittedExpression(element) ? []
      : use(ast.is.IsSpreadElement(element) ? ast.as.AsSpreadElement(element)?.Expression : element, { kind: "element", index }));
  if (ast.is.IsObjectLiteralExpression(owner)) return ast.children(owner).flatMap((member, index) => member === undefined ? []
    : ast.is.IsPropertyAssignment(member) ? use(ast.as.AsPropertyAssignment(member)?.Initializer, { kind: "member", index })
    : ast.is.IsShorthandPropertyAssignment(member) ? use(ast.name(member), { kind: "member", index })
    : ast.is.IsSpreadAssignment(member) ? use(ast.as.AsSpreadAssignment(member)?.Expression, { kind: "member", index }) : []);
  if (ast.is.IsTemplateExpression(owner)) return (ast.as.AsTemplateExpression(owner)?.TemplateSpans?.Nodes ?? []).flatMap((span, index) =>
    span === undefined ? [] : use(ast.as.AsTemplateSpan(span)?.Expression, { kind: "span", index }));
  if (ast.is.IsCallExpression(owner) || ast.is.IsNewExpression(owner)) return [];
  if (ast.is.IsArrowFunction(owner) || ast.is.IsFunctionExpression(owner) || ast.is.IsClassExpression(owner)) return [];
  return sourceValueLeafKinds.has(ast.kindName(owner)) ? [] : undefined;
}

const sourceValueLeafKinds: ReadonlySet<string> = new Set([
  "KindIdentifier", "KindPrivateIdentifier", "KindThisKeyword", "KindSuperKeyword", "KindNumericLiteral", "KindBigIntLiteral",
  "KindStringLiteral", "KindNoSubstitutionTemplateLiteral", "KindTrueKeyword", "KindFalseKeyword", "KindNullKeyword",
  "KindRegularExpressionLiteral", "KindOmittedExpression", "KindMetaProperty",
]);
