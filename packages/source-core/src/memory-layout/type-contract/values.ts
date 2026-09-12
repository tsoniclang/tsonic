import { fieldFactKey, pointerFactKey, pointerOperationFactKey } from "@tsonic/tsts";
import type { Node, ResolvedSourceCallInfo, Symbol } from "@tsonic/tsts";
import type { TsonicSourceFileAnalysisContext } from "../../analysis/context.js";
import { readSourceFact } from "../../analysis/source-call.js";
import { pointerFlowCallableBoundary, pointerFlowOperand } from "../../pointers/backing/source-forms.js";
import type { MemoryTypeDomain, MemoryTypeDomains } from "./domains.js";
import { tsonicPointerViewFactKey } from "../../pointers/views/facts.js";

interface ValueFrame {
  readonly call: ResolvedSourceCallInfo;
  readonly parent: ValueFrame | undefined;
}

export function createMemoryValueDomains(
  context: TsonicSourceFileAnalysisContext,
  domains: MemoryTypeDomains,
  selectedValue: (node: Node) => MemoryTypeDomain | undefined,
): (expression: Node) => MemoryTypeDomain | undefined {
  const { ast, checker, typeShape } = context;

  return expression => {
    const active = new Set<Node>();
    let visited = 0;

    function unite(values: readonly (MemoryTypeDomain | undefined)[]): MemoryTypeDomain | undefined {
      return values.length === 0 || values.some(value => value === undefined) ? undefined
        : domains.union(values.filter(value => value !== undefined));
    }

    function declaration(node: Node, frame: ValueFrame | undefined, owner?: MemoryTypeDomain): MemoryTypeDomain | undefined {
      const field = readSourceFact(context, node, fieldFactKey);
      const annotation = ast.typeNode(node) ?? field?.type;
      if (annotation !== undefined) {
        const domain = owner === undefined ? domains.authored(annotation) : domains.member(annotation, owner);
        if (domain !== undefined) return domain;
        if (!ast.is.IsParameterDeclaration(node)) return undefined;
      }
      if (ast.is.IsParameterDeclaration(node) && frame !== undefined) {
        const parameter = frame.call.sourceSelectedSignatureParameters.find(candidate => candidate.parameterDeclaration === node);
        const bindings = parameter === undefined ? [] : frame.call.sourceArgumentBindings.filter(binding => binding.sourceParameterIndex === parameter.parameterIndex);
        if (bindings.length === 1 && bindings[0]?.sourceForm === "value") {
          const argument = frame.call.sourceArguments[bindings[0].sourceArgumentIndex];
          if (argument !== undefined && !typeShape.isNullish(argument.type)) return visit(argument.expression, frame.parent);
        }
      }
      if (ast.is.IsShorthandPropertyAssignment(node)) return visit(ast.name(node), frame);
      const initializer = ast.is.IsVariableDeclaration(node) ? ast.as.AsVariableDeclaration(node)?.Initializer
        : ast.is.IsParameterDeclaration(node) ? ast.as.AsParameterDeclaration(node)?.Initializer
          : ast.is.IsPropertyAssignment(node) ? ast.as.AsPropertyAssignment(node)?.Initializer
            : ast.is.IsPropertyDeclaration(node) ? ast.as.AsPropertyDeclaration(node)?.Initializer : undefined;
      return visit(initializer, frame);
    }

    function returns(selected: ResolvedSourceCallInfo, frame: ValueFrame | undefined): MemoryTypeDomain | undefined {
      const target = checker.getSignatureDeclaration(selected.selectedSignature);
      if (target === undefined) return undefined;
      const annotation = ast.typeNode(target);
      if (annotation !== undefined) {
        const bindings = new Map<Symbol, MemoryTypeDomain>();
        const parameters = new Set<Symbol>();
        for (const argument of selected.sourceSelectedMethodTypeArguments ?? []) {
          const symbol = checker.getTypeSymbol(argument.typeParameter);
          if (symbol === undefined) return undefined;
          parameters.add(symbol);
          if (argument.explicitTypeNode !== undefined) {
            const domain = domains.authored(argument.explicitTypeNode);
            if (domain === undefined) return undefined;
            bindings.set(symbol, domain);
          }
        }
        for (const binding of selected.sourceArgumentBindings) {
          const parameter = selected.sourceSelectedSignatureParameters[binding.sourceParameterIndex];
          const argument = selected.sourceArguments[binding.sourceArgumentIndex];
          if (parameter?.authoredTypeNode === undefined || argument === undefined || binding.sourceForm !== "value") continue;
          const pointer = readSourceFact(context, parameter.authoredTypeNode, pointerFactKey);
          const typeNode = pointer?.pointee ?? parameter.authoredTypeNode;
          const name = ast.is.IsTypeReferenceNode(typeNode) ? ast.as.AsTypeReferenceNode(typeNode)?.TypeName : undefined;
          const symbol = name === undefined ? undefined : checker.getSymbolAtLocation(name);
          if (symbol === undefined || !parameters.has(symbol)) continue;
          const value = visit(argument.expression, frame);
          const domain = pointer === undefined ? value : value === undefined ? undefined : domains.pointee(value);
          if (domain === undefined || bindings.has(symbol) && !domains.equivalent(bindings.get(symbol)!, domain)) return undefined;
          bindings.set(symbol, domain);
        }
        const result = domains.instantiated(annotation, bindings);
        if (result !== undefined || parameters.size === 0) return result;
      }
      const body = ast.body(target);
      if (body === undefined) return undefined;
      const inner = { call: selected, parent: frame };
      if (!ast.is.IsBlock(body)) return visit(body, inner);
      const values: (MemoryTypeDomain | undefined)[] = [];
      const pending = [body];
      while (pending.length !== 0) {
        if (++visited > 131072) return undefined;
        const statement = pending.pop()!;
        if (ast.is.IsReturnStatement(statement)) {
          const value = ast.as.AsReturnStatement(statement)?.Expression;
          if (value !== undefined) values.push(visit(value, inner));
        } else if (!pointerFlowCallableBoundary(ast, statement)) {
          ast.forEachChild(statement, child => { if (child !== undefined) pending.push(child); });
        }
      }
      const resultTypes = typeShape.isUnion(selected.sourceResultType)
        ? typeShape.getUnionOrIntersectionTypes(selected.sourceResultType) : [selected.sourceResultType];
      for (const type of resultTypes) if (type !== undefined && typeShape.isNullish(type)) values.push(domains.selected(type));
      return unite(values);
    }

    function visit(node: Node | undefined, frame: ValueFrame | undefined): MemoryTypeDomain | undefined {
      if (node === undefined || ++visited > 131072 || active.size >= 128 || active.has(node)) return undefined;
      active.add(node);
      try {
        const sourceType = checker.getTypeAtLocation(node);
        if (sourceType !== undefined && typeShape.isNullish(sourceType)) return domains.selected(sourceType);
        if (ast.is.IsAsExpression(node) || ast.is.IsTypeAssertion(node)) {
          const annotation = ast.typeNode(node);
          return annotation === undefined ? undefined : domains.authored(annotation);
        }
        const operand = pointerFlowOperand(ast, node);
        if (operand !== undefined) return visit(operand, frame);
        if (ast.is.IsConditionalExpression(node)) {
          const conditional = ast.as.AsConditionalExpression(node);
          return unite([visit(conditional?.WhenTrue, frame), visit(conditional?.WhenFalse, frame)]);
        }
        if (ast.is.IsCallExpression(node)) {
          const selected = checker.getResolvedCallInfo(node);
          if (selected?.outcome !== "applicable") return undefined;
          const view = readSourceFact(context, node, tsonicPointerViewFactKey);
          if (view !== undefined && view.call === node) {
            const callbackType = checker.getTypeAtLocation(view.readExpression);
            const signatures = callbackType === undefined ? [] : typeShape.getCallSignatures(callbackType);
            const declaration = signatures.length === 1 ? checker.getSignatureDeclaration(signatures[0]) : undefined;
            const annotation = view.explicitPointeeTypeNode ?? ast.typeNode(declaration);
            const pointee = annotation === undefined ? domains.selected(view.pointeeType) : domains.authored(annotation);
            if (pointee === undefined) return undefined;
            const pointer = domains.pointer(pointee);
            const resultTypes = typeShape.isUnion(selected.sourceResultType)
              ? typeShape.getUnionOrIntersectionTypes(selected.sourceResultType) : [selected.sourceResultType];
            return unite([pointer, ...resultTypes.filter(type => type !== undefined && typeShape.isNullish(type))
              .map(type => type === undefined ? undefined : domains.selected(type))]);
          }
          const pointer = readSourceFact(context, node, pointerOperationFactKey);
          if (pointer !== undefined && pointer.call === node) {
            const annotation = pointer.explicitPointeeTypeNode;
            const loaded = pointer.operation === "load" ? visit(pointer.pointerExpression, frame) : undefined;
            const pointee = annotation !== undefined ? domains.authored(annotation)
              : pointer.operation === "address-of" ? visit(pointer.storageExpression, frame)
                : pointer.operation === "allocate" ? visit(pointer.initialExpression, frame)
                  : loaded === undefined ? undefined : domains.pointee(loaded);
            if (pointee === undefined) return undefined;
            if (pointer.operation === "load") return pointee;
            return pointer.operation === "address-of" || pointer.operation === "allocate" ||
              pointer.operation === "bind-pointer" || pointer.operation === "project-pointer" ? domains.pointer(pointee) : undefined;
          }
          const memory = selectedValue(node);
          if (memory !== undefined) {
            const types = typeShape.isUnion(selected.sourceResultType)
              ? typeShape.getUnionOrIntersectionTypes(selected.sourceResultType) : [selected.sourceResultType];
            return unite([memory, ...types.filter(type => type !== undefined && typeShape.isNullish(type))
              .map(type => type === undefined ? undefined : domains.selected(type))]);
          }
          return returns(selected, frame);
        }
        if (ast.is.IsElementAccessExpression(node)) {
          const selected = checker.getResolvedElementAccessInfo(node);
          if (selected === undefined) return undefined;
          const receiver = visit(selected.receiver.expression, frame);
          if (selected.selectedDeclaration !== undefined && !ast.is.IsIndexSignatureDeclaration(selected.selectedDeclaration)) {
            return declaration(selected.selectedDeclaration, frame, receiver);
          }
          return receiver === undefined ? undefined : domains.indexed(receiver, selected.receiver.type);
        }
        const storage = checker.getResolvedStorageInfo(node);
        if (storage?.declaration !== undefined) {
          const property = ast.is.IsPropertyAccessExpression(node) ? checker.getResolvedPropertyAccessInfo(node) : undefined;
          const receiver = property === undefined ? undefined : visit(property.receiver.expression, frame);
          return declaration(storage.declaration, frame, receiver);
        }
        return sourceType === undefined ? undefined : domains.selected(sourceType);
      } finally {
        active.delete(node);
      }
    }

    return visit(expression, undefined);
  };
}
