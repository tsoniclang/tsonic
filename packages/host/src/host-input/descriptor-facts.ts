import { readOriginalSignature, sourcePrimitiveFactKey, TypeFlagsUniqueESSymbol, type CheckedSourceProgram, type Node, type Signature, type SourceFileQueries, type Type, type TypeSignatureInfo } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputComponentPart, SourceInputEnumDeclaration, SourceInputMemberInventory, SourceInputSignature, SourceInputSignatureFacts, SourceInputSignatureShape, SourceInputTypeFacts } from "@tsonic/target-api/host";
import type { SourceInputIdentityOwner } from "./identity-owner.js";
import { createSourceInputMemberPublisher, sourceCheckedMember } from "./member-components.js";

export function createSourceDescriptorFacts(options: {
  readonly checked: CheckedSourceProgram;
  readonly identities: SourceInputIdentityOwner;
  assertNode(node: Node): void;
  extent(component: SourceInputComponent, authoredTypeNode: Node | undefined): { readonly length: bigint; readonly runtimeBase: "number" | "bigint" } | undefined;
}) {
  const { checked, identities, assertNode } = options;
  const { ast } = checked;
  const syntaxCache = new WeakMap<Node, SourceInputComponent>();
  const descriptions = new WeakMap<SourceInputComponent, SourceInputTypeFacts>();
  const memberPublishers = new WeakMap<SourceFileQueries, ReturnType<typeof createSourceInputMemberPublisher>>();
  const enums = new WeakMap<Node, SourceInputEnumDeclaration>();
  const memberInventories = new WeakMap<SourceInputComponent, SourceInputMemberInventory>();

  function queries(node: Node): SourceFileQueries {
    assertNode(node);
    const file = ast.getSourceFile(node);
    if (file === undefined) throw new Error("An original Source input component requires its exact source file.");
    return checked.getSourceFileQueries(file);
  }

  function declaration(type: Type, source: SourceFileQueries): Node | undefined {
    const { checker } = source;
    for (const symbol of [checker.getTypeAliasSymbol(type), checker.getTypeSymbol(type)]) {
      if (symbol === undefined) continue;
      for (const value of checker.getSymbolDeclarations(symbol)) {
        if (value === undefined) continue;
        assertNode(value);
        if (ast.is.IsTypeParameterDeclaration(value)) {
          if (checker.getDeclaredTypeOfSymbol(symbol) === type) return value;
        } else if (ast.is.IsClassDeclaration(value) || ast.is.IsClassExpression(value) || ast.is.IsInterfaceDeclaration(value) || ast.is.IsTypeAliasDeclaration(value) || ast.is.IsEnumDeclaration(value)) return value;
      }
    }
    return undefined;
  }

  function syntax(node: Node): SourceInputComponent {
    assertNode(node);
    const previous = syntaxCache.get(node);
    if (previous !== undefined) return previous;
    const { checker } = queries(node);
    const annotation = ast.typeNode(node);
    const symbol = checker.getSymbolAtLocation(ast.name(node) ?? node);
    const selected = ast.is.IsTypeParameterDeclaration(node) || ast.is.IsClassDeclaration(node) || ast.is.IsInterfaceDeclaration(node)
      ? checker.getDeclaredTypeOfSymbol(symbol)
      : annotation === undefined ? checker.getTypeAtLocation(node) : checker.getTypeFromTypeNode(annotation);
    const result = identities.component(node, [], selected);
    syntaxCache.set(node, result);
    return result;
  }

  function child(parent: SourceInputComponent, part: SourceInputComponentPart, type: Type | undefined): SourceInputComponent {
    identities.assertComponent(parent);
    return identities.component(parent.root, [...parent.path, part], type);
  }

  function members(component: SourceInputComponent): SourceInputMemberInventory {
    const type = identities.checkedComponent(component);
    const previous = memberInventories.get(component);
    if (previous !== undefined) return previous;
    if (type === undefined) return Object.freeze({ kind: "unavailable" });
    const source = queries(component.root);
    const { checker, typeShape: types } = source;
    let publisher = memberPublishers.get(source);
    if (publisher === undefined) {
      publisher = createSourceInputMemberPublisher({ ast, checker, types, identities, assertNode });
      memberPublishers.set(source, publisher);
    }
    const properties = types.getPropertyInfos(type).map(property => publisher(component, sourceCheckedMember(ast, checker, property, type)));
    const indexes = types.getIndexInfos(type);
    const originalIndexes = types.isArrayLike(type) ? types.getIndexInfos(types.getTypeReferenceTarget(type) ?? type) : [];
    const elementBinders: Node[] = [];
    for (const binding of types.getTypeReferenceArgumentInfos(type) ?? []) {
      if (!originalIndexes.some(index => index.keyType !== undefined && types.isNumberLike(index.keyType) && index.valueType === binding.parameter)) continue;
      const original = declaration(binding.parameter, source);
      if (original !== undefined && ast.is.IsTypeParameterDeclaration(original)) elementBinders.push(original);
    }
    if (properties.some(value => value === undefined) || indexes.some(value => value.declaration === undefined))
      return Object.freeze({ kind: "unavailable" });
    const result: SourceInputMemberInventory = Object.freeze({ kind: "available",
      members: Object.freeze(properties.filter((value): value is NonNullable<typeof value> => value !== undefined)), elementBinders: Object.freeze(elementBinders),
      indexes: Object.freeze(indexes.flatMap(value => value.declaration === undefined ? [] : [Object.freeze({
        declaration: value.declaration, readonly: value.readonly,
        key: child(component, { kind: "index-key", declaration: value.declaration }, value.keyType),
        value: child(component, { kind: "index-value", declaration: value.declaration }, value.valueType) })])) });
    memberInventories.set(component, result);
    return result;
  }

  function originalSignature(owner: Node, kind: "call" | "construct", original: Signature): SourceInputSignature {
    const shape = readOriginalSignature(original);
    const parameters = shape.declaration === undefined ? [] : ast.typeParameters(shape.declaration).filter((value): value is Node => value !== undefined);
    return identities.signature(owner, kind, original, shape.declaration, parameters);
  }

  function describeSignature(value: SourceInputSignature): SourceInputSignatureShape {
    const original = identities.checkedSignature(value);
    const shape = readOriginalSignature(original);
    return Object.freeze({ identity: value,
      target: shape.target === undefined ? undefined : originalSignature(value.owner, value.signatureKind, shape.target),
      parameters: Object.freeze(shape.parameters.map(parameter => Object.freeze({ ...parameter }))),
      receiver: shape.receiver === undefined ? undefined : Object.freeze({ ...shape.receiver }) });
  }

  function signatureComponent(signature: SourceInputSignature, part: { readonly kind: "parameter"; readonly index: number } | { readonly kind: "receiver" | "result" }): SourceInputComponent {
    const shape = describeSignature(signature);
    if (part.kind === "parameter" && (!Number.isSafeInteger(part.index) || part.index < 0 || shape.parameters[part.index]?.index !== part.index))
      throw new Error("An original signature component requires its actual original parameter ordinal.");
    if (part.kind === "receiver" && shape.receiver === undefined) throw new Error("An original signature has no receiver component.");
    return identities.component(signature.owner, [{ ...part, signature }], undefined);
  }

  function enumDeclaration(declaration: Node): SourceInputEnumDeclaration {
    assertNode(declaration);
    if (!ast.is.IsEnumDeclaration(declaration)) throw new Error("An enum input query requires an original enum declaration.");
    const previous = enums.get(declaration);
    if (previous !== undefined) return previous;
    const { checker, typeShape } = queries(declaration);
    const symbol = checker.getSymbolAtLocation(ast.name(declaration));
    if (symbol === undefined) throw new Error("A checked enum declaration requires its original symbol identity.");
    const declarations = checker.getSymbolDeclarations(symbol).filter((value): value is Node => value !== undefined && ast.is.IsEnumDeclaration(value));
    declarations.forEach(assertNode);
    const members = ast.members(declaration).map(member => {
      if (member === undefined) throw new Error("An original enum member inventory cannot contain an absent member.");
      assertNode(member);
      const observed = typeShape.getConstantValue(member);
      const constant = typeof observed === "number" ? { kind: "number" as const, value: observed }
        : typeof observed === "string" ? { kind: "string" as const, value: observed } : { kind: "unavailable" as const };
      return Object.freeze({ declaration: member, constant: Object.freeze(constant) });
    });
    const result = Object.freeze({ declarations: Object.freeze(declarations), members: Object.freeze(members) });
    enums.set(declaration, result);
    return result;
  }

  function signature(parent: SourceInputComponent, kind: "call" | "construct", value: TypeSignatureInfo): SourceInputSignatureFacts {
    const original = originalSignature(parent.root, kind, value.signature);
    return Object.freeze({ identity: original,
      receiver: value.thisParameter === undefined ? undefined : child(parent, { kind: "receiver", signature: original }, value.thisParameter.type),
      parameters: Object.freeze(value.parameters.map((parameter, index) => Object.freeze({ declaration: parameter.declaration,
        kind: parameter.parameterKind, value: child(parent, { kind: "parameter", signature: original, index }, parameter.type) }))),
      result: child(parent, { kind: "result", signature: original }, value.returnType) });
  }

  function captures(parameter: Node): readonly Node[] {
    const declaration = ast.as.AsTypeParameterDeclaration(parameter);
    const result = new Set<Node>();
    const visited = new Set<Node>();
    const pending = [declaration?.Constraint, declaration?.DefaultType].filter((value): value is Node => value !== undefined);
    while (pending.length !== 0) {
      const node = pending.pop()!;
      if (visited.has(node)) continue;
      visited.add(node);
      const source = queries(node);
      if (ast.is.IsIdentifier(node)) {
        const symbol = source.checker.getSymbolAtLocation(node);
        for (const value of source.checker.getSymbolDeclarations(symbol)) if (value !== undefined && ast.is.IsTypeParameterDeclaration(value) && value !== parameter) {
          let owner = ast.parent(value);
          let nested = false;
          while (owner !== undefined && owner !== parameter) {
            if (owner === declaration?.Constraint || owner === declaration?.DefaultType) { nested = true; break; }
            owner = ast.parent(owner);
          }
          if (!nested) result.add(value);
        }
      }
      ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
    }
    return Object.freeze([...result]);
  }

  function describe(component: SourceInputComponent): SourceInputTypeFacts {
    identities.assertComponent(component);
    const previous = descriptions.get(component);
    if (previous !== undefined) return previous;
    const source = queries(component.root);
    const { checker, typeShape: types } = source;
    const type = identities.checkedComponent(component);
    const last = component.path.at(-1);
    const signatureShape = last?.kind === "parameter" || last?.kind === "receiver" || last?.kind === "result"
      ? describeSignature(last.signature) : undefined;
    const selectedDeclaration = last?.kind === "member" ? last.declaration
      : last?.kind === "parameter" ? signatureShape?.parameters[last.index]?.declaration
      : last?.kind === "receiver" ? signatureShape?.receiver?.declaration
      : last?.kind === "result" ? signatureShape?.identity.declaration
      : component.path.length === 0 && (ast.is.IsVariableDeclaration(component.root) || ast.is.IsParameter(component.root) || ast.is.IsPropertyDeclaration(component.root) || ast.is.IsPropertySignatureDeclaration(component.root)) ? component.root : undefined;
    const annotation = selectedDeclaration === undefined ? undefined : ast.typeNode(selectedDeclaration);
    const authoredTypeNode = annotation ?? (component.path.length === 0 && selectedDeclaration === undefined ? component.root : undefined);
    const primitive = checked.sourceFacts.getFact(component.root, sourcePrimitiveFactKey) ??
      (type === undefined ? undefined : checked.sourceFacts.getFact(type, sourcePrimitiveFactKey));
    let literal: SourceInputTypeFacts["literal"];
    if (type !== undefined) {
      const text = types.getStringLiteralTypeValue(type);
      const numeric = types.getNumericLiteralTypeValue(type);
      const boolean = types.getBooleanLiteralTypeValue(type);
      literal = text !== undefined ? { kind: "string", value: text } : boolean !== undefined ? { kind: "boolean", value: boolean }
        : typeof numeric === "bigint" ? { kind: "bigint", value: numeric } : typeof numeric === "number" ? { kind: "number", value: numeric } : undefined;
      if ((type.flags & TypeFlagsUniqueESSymbol) !== 0) {
        const original = checker.getPrimarySymbolDeclaration(checker.getTypeSymbol(type));
        if (original !== undefined) { assertNode(original); literal = { kind: "symbol", declaration: original }; }
      }
    }
    const named = type === undefined ? undefined : declaration(type, source);
    const defining = named !== undefined && (component.root === named || ast.typeNode(named) === component.root);
    const common = { component, authoredTypeNode, declaration: selectedDeclaration, literal, primitive,
      definitionOwner: defining && named !== undefined && !ast.is.IsTypeParameterDeclaration(named) && !ast.is.IsEnumDeclaration(named) ? named : undefined };
    let result: SourceInputTypeFacts;
    if (named !== undefined && ast.is.IsEnumDeclaration(named)) {
      result = { ...common, kind: "enum", declaration: named };
    } else if (named !== undefined && ast.is.IsTypeParameterDeclaration(named)) {
      const owner = ast.parent(named);
      if (owner === undefined) throw new Error("An original generic binder must retain its declaration owner.");
      const parameters = ast.typeParameters(owner);
      const index = parameters.indexOf(named);
      if (index < 0) throw new Error("An original generic binder must occur in its owner's binder vector.");
      const original = ast.as.AsTypeParameterDeclaration(named);
      result = { ...common, kind: "parameter", parameter: named, owner, index, captures: captures(named),
        constraint: original?.Constraint === undefined ? undefined : syntax(original.Constraint),
        defaultType: original?.DefaultType === undefined ? undefined : syntax(original.DefaultType) };
    } else if (type === undefined || selectedDeclaration !== undefined && annotation === undefined &&
      !(last?.kind === "member" && (ast.is.IsMethodDeclaration(selectedDeclaration) || ast.is.IsMethodSignatureDeclaration(selectedDeclaration)))) {
      result = { ...common, kind: "unavailable", reason: "missing-original-component" };
    } else if (primitive !== undefined) {
      const scalar = primitive.runtimeBase === "number" || primitive.runtimeBase === "bigint" || primitive.runtimeBase === "boolean" || primitive.runtimeBase === "string" ? primitive.runtimeBase : "object";
      result = { ...common, kind: "scalar", scalar };
    } else if (named !== undefined && !defining && !types.getConstructSignatures(type).some(value => value !== undefined)) {
      const application = types.getTypeAliasApplication(type);
      const reference = types.getTypeReferenceArgumentInfos(type);
      const arguments_ = application?.declaration === named ? application.bindings.map(value => ({ parameter: value.parameter, argument: value.argument, declaration: value.declaration }))
        : reference?.map(value => ({ ...value, declaration: declaration(value.parameter, source) }));
      const parameters = arguments_?.map(value => value.declaration);
      if (parameters?.some(value => value === undefined)) result = { ...common, kind: "unavailable", reason: "unsupported-checked-structure" };
      else {
        const parameterNodes = parameters?.filter((value): value is Node => value !== undefined) ?? ast.typeParameters(named).filter((value): value is Node => value !== undefined);
        const argumentTypes = arguments_?.map(value => value.argument) ?? parameterNodes.map(value => identities.checkedComponent(syntax(value)));
        const definitionNode = ast.typeNode(named) ?? named;
        result = { ...common, kind: "declared", declaration: named, parameters: Object.freeze(parameterNodes),
          arguments: Object.freeze(argumentTypes.map((value, index) => child(component, { kind: "type-argument", declaration: named, index }, value))),
          definition: syntax(definitionNode), extent: options.extent(component, authoredTypeNode) };
      }
    } else if (types.isAny(type) || types.isUnknown(type) || types.isNever(type) || types.isNullish(type) || types.isVoidLike(type) || types.isNumberLike(type) || types.isBigIntLike(type) || types.isBooleanLike(type) || types.isStringLike(type) || types.isSymbolLike(type) || types.isNonPrimitive(type)) {
      result = { ...common, kind: "scalar", scalar: types.isAny(type) ? "any" : types.isUnknown(type) ? "unknown" : types.isNever(type) ? "never"
        : types.isNullish(type) ? "absence" : types.isVoidLike(type) ? "void" : types.isNumberLike(type) ? "number" : types.isBigIntLike(type) ? "bigint"
        : types.isBooleanLike(type) ? "boolean" : types.isStringLike(type) ? "string" : types.isSymbolLike(type) ? "symbol" : "object" };
    } else if (types.isUnion(type)) {
      const originalMembers = authoredTypeNode !== undefined && ast.is.IsUnionTypeNode(authoredTypeNode) ? ast.children(authoredTypeNode).filter((value): value is Node => value !== undefined) : undefined;
      result = { ...common, kind: "union", members: Object.freeze(originalMembers === undefined
        ? types.getUnionOrIntersectionTypes(type).filter((value): value is Type => value !== undefined).map((value, index) => child(component, { kind: "union-member", index }, value))
        : originalMembers.map(syntax)) };
    } else if (types.isTuple(type)) {
      result = { ...common, kind: "tuple", readonly: types.getIndexInfos(type).some(value => value.readonly),
        elements: Object.freeze(types.getTupleElementInfos(type).map((value, index) => Object.freeze({ declaration: value.declaration,
          kind: value.elementKind === "variadic" ? "rest" : value.elementKind,
          value: child(component, { kind: "tuple-element", index }, value.type) }))) };
    } else if (types.isArrayLike(type)) {
      const indexes = types.getIndexInfos(type).filter(value => value.keyType !== undefined && types.isNumberLike(value.keyType));
      result = indexes.length !== 1 ? { ...common, kind: "unavailable", reason: "unsupported-checked-structure" }
        : { ...common, kind: "array", readonly: indexes[0]!.readonly, element: child(component, { kind: "element" }, indexes[0]!.valueType) };
    } else {
      const inventory = members(component);
      if (inventory.kind === "unavailable") result = { ...common, kind: "unavailable", reason: "unsupported-checked-structure" };
      else result = { ...common, kind: "structure", members: inventory.members, indexes: inventory.indexes,
        calls: Object.freeze(types.getSignatureInfos(type, "call").map(value => signature(component, "call", value))),
        constructs: Object.freeze(types.getSignatureInfos(type, "construct").map(value => signature(component, "construct", value))) };
    }
    const selected = Object.freeze(result);
    descriptions.set(component, selected);
    return selected;
  }

  return Object.freeze({ syntax, describe, members, describeSignature, signatureComponent, enumDeclaration, originalSignature, queries });
}
