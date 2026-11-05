import type { AstReader, Node, Type } from "@tsonic/tsts";
import { Node_Expression } from "../../source-navigation/ast.js";
import { createSourceTypeFlowRefusal } from "./refusals.js";
import type { SourceTypeFlowRefusal, SourceTypeFlowSource } from "./types.js";

export function sourceTypeFlowCallableReturns(ast: AstReader, declaration: Node): {
  readonly returned: readonly Node[];
  readonly absent: boolean;
} {
  const body = ast.body(declaration);
  const pending = body === undefined ? [] : [body];
  const returned: Node[] = [];
  let absent = false;
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (node !== body && (ast.is.IsFunctionDeclaration(node) || ast.is.IsFunctionExpression(node) ||
      ast.is.IsArrowFunction(node) || ast.is.IsMethodDeclaration(node) || ast.is.IsGetAccessorDeclaration(node) ||
      ast.is.IsSetAccessorDeclaration(node) || ast.is.IsClassDeclaration(node) || ast.is.IsClassExpression(node))) continue;
    if (node === body && !ast.is.IsBlock(node)) returned.push(node);
    else if (ast.is.IsReturnStatement(node)) {
      const expression = Node_Expression(ast, node);
      if (expression !== undefined) returned.push(expression);
      else absent = true;
    } else {
      const children = ast.children(node);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (child !== undefined) pending.push(child);
      }
    }
  }
  return { returned, absent };
}

export function sourceTypeFlowRecursiveSignatures(source: SourceTypeFlowSource,
  nodes: readonly Node[]): ReadonlyMap<Node, SourceTypeFlowRefusal> {
  const { ast, semantics } = source;
  const refusals = new Map<Node, SourceTypeFlowRefusal>();
  for (const declaration of nodes) {
    if (!(ast.is.IsFunctionDeclaration(declaration) || ast.is.IsFunctionExpression(declaration) ||
      ast.is.IsArrowFunction(declaration) || ast.is.IsMethodDeclaration(declaration)) ||
      ast.typeNode(declaration) !== undefined || ast.body(declaration) === undefined) continue;
    const queries = semantics.forNode(declaration);
    const selected = ast.is.IsFunctionExpression(declaration) || ast.is.IsArrowFunction(declaration)
      ? queries.types.expressionType(declaration) : queries.declarations.declaredValueType(declaration);
    if (selected === undefined || queries.types.callSignatures(selected).length === 0) continue;
    for (const returned of sourceTypeFlowCallableReturns(ast, declaration).returned) {
      const type = queries.types.expressionType(returned);
      if (type === undefined) continue;
      const pending: Type[] = [type];
      const seen = new Set<Type>();
      let recursive = false;
      while (pending.length > 0) {
        const current = pending.pop()!;
        if (current === selected) { recursive = true; break; }
        if (seen.has(current)) continue;
        seen.add(current);
        if (queries.types.isUnion(current) || queries.types.isIntersection(current)) {
          pending.push(...queries.types.unionOrIntersectionTypes(current));
          continue;
        }
        const symbol = queries.declarations.typeAliasSymbol(current) ?? queries.declarations.typeSymbol(current);
        const nominal = symbol !== undefined && queries.declarations.symbolDeclarations(symbol).some(node =>
          ast.is.IsTypeAliasDeclaration(node) || ast.is.IsClassDeclaration(node) || ast.is.IsInterfaceDeclaration(node));
        if (nominal || queries.types.isArrayLike(current) || queries.types.isTuple(current)) {
          pending.push(...queries.types.typeArguments(current));
          continue;
        }
        for (const signature of [...queries.types.signatureInfos(current, "call"), ...queries.types.signatureInfos(current, "construct")]) {
          if (signature.returnType !== undefined) pending.push(signature.returnType);
          pending.push(...signature.parameters.map(parameter => parameter.type));
        }
        if (!queries.types.isAny(current) && !queries.types.isUnknown(current) && !queries.types.isNumberLike(current) &&
          !queries.types.isStringLike(current) && !queries.types.isBooleanLike(current) && !queries.types.isBigIntLike(current) &&
          !queries.types.isSymbolLike(current) && !queries.types.isNullish(current) && !queries.types.isVoidLike(current)) {
          pending.push(...queries.types.propertyInfos(current).map(property => property.type));
        }
      }
      if (recursive) {
        refusals.set(declaration, Object.freeze({ ...createSourceTypeFlowRefusal("TSONIC_LOCAL_TYPE_SIGNATURE", returned, declaration),
          reason: "This unannotated callable return depends on itself. Annotate the return type." }));
        break;
      }
    }
  }
  return refusals;
}
