import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../source-semantics/index.js";
import { Node_Expression, Node_Initializer, sourceEnclosingCallable } from "../../source-navigation/index.js";
import { createSourceErrorLocalInvalidationQuery } from "./error-invalidation.js";
import type { SourceErrorCheckedValue, SourceErrorConstruction, SourceErrorDeclarationProtocol, SourceErrorDeclarationQueries,
  SourceErrorDeclarationSelection, SourceErrorDeclaredSlot, SourceErrorFieldUse, SourceErrorMutation, SourceErrorParameterUse,
  SourceErrorScalarSlot } from "./protocol.js";

export function createSourceErrorDeclarationQuery(
  source: TargetSourceProgram,
  protocol: SourceErrorDeclarationProtocol,
): SourceErrorDeclarationQueries {
  const { ast, navigation, semantics } = source;
  const domain = new Set(navigation.nodesForFiles(source.sourceFiles.filter(semantics.includes)));
  const fields = new Map<Node, SourceErrorDeclaredSlot>();
  const constructors = new Map<Node, SourceErrorDeclaredSlot>();
  const mutators = new Map<Node, SourceErrorScalarSlot[]>();
  let failure: string | undefined;
  const owns = (node: Node): boolean => {
    const file = domain.has(node) ? ast.getSourceFile(node) : undefined;
    return file !== undefined && semantics.includes(file);
  };
  const rejected = (reason: string) => Object.freeze({ kind: "unresolved" as const, reason });
  const absent = Object.freeze({ kind: "not-applicable" as const });
  const selected = <Value>(value: Value): SourceErrorDeclarationSelection<Value> => Object.freeze({ kind: "resolved", value });
  const validate = (slot: SourceErrorDeclaredSlot, construction: boolean): boolean => {
    if (slot === undefined || slot === null || !owns(slot.declaration) || slot.component?.declaration !== slot.declaration) return false;
    const queries = semantics.forNode(slot.declaration);
    const type = construction ? queries.types.declarationSignatureInfo(slot.declaration)?.returnType
      : queries.declarations.declaredValueType(slot.declaration);
    return type !== undefined && type === slot.component.selectedType &&
      (slot.component.authoredTypeNode === undefined || slot.component.authoredTypeNode === ast.typeNode(slot.declaration));
  };
  const install = (slots: readonly SourceErrorDeclaredSlot[], destination: Map<Node, SourceErrorDeclaredSlot>, construction: boolean): void => {
    for (const slot of slots) {
      if (!validate(slot, construction) || destination.has(slot.declaration)) {
        failure ??= "An Error declaration requires a unique checked declaration and its original type component.";
        continue;
      }
      destination.set(slot.declaration, slot);
    }
  };
  if (protocol === undefined || protocol === null || !Array.isArray(protocol.fields) ||
      !Array.isArray(protocol.constructors) || !Array.isArray(protocol.scalarMutators)) {
    failure = "An Error declaration protocol requires checked field, constructor and scalar-slot inventories.";
  } else {
    install(protocol.fields, fields, false);
    install(protocol.constructors, constructors, true);
    for (const slot of protocol.scalarMutators) {
      const slots = mutators.get(slot?.signatureDeclaration) ?? [];
      const parameter = slot !== undefined && slot !== null && owns(slot.signatureDeclaration) && Number.isSafeInteger(slot.parameterIndex) &&
          slot.parameterIndex >= 0 ? ast.parameters(slot.signatureDeclaration)[slot.parameterIndex] : undefined;
      if (parameter === undefined || parameter !== slot.parameterDeclaration || !ast.is.IsParameterDeclaration(parameter) ||
          ast.as.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined ||
          !validate({ declaration: parameter, component: slot.component }, false) ||
          slots.some(previous => previous.parameterIndex === slot.parameterIndex) || !Array.isArray(slot.fields) ||
          slot.fields.length === 0 || new Set(slot.fields).size !== slot.fields.length ||
          slot.fields.some((field: Node) => !fields.has(field))) {
        failure ??= "An Error mutator requires its exact checked scalar signature slot, type and field declarations.";
        continue;
      }
      slots.push(slot);
      mutators.set(slot.signatureDeclaration, slots);
    }
  }
  const parameterSlot = (node: Node) => {
    if (!owns(node) || !ast.is.IsParameterDeclaration(node)) return undefined;
    const owner = ast.parent(node);
    if (owner === undefined) return undefined;
    const queries = semantics.forNode(owner);
    const signature = queries.types.declarationSignatureInfo(owner);
    const matches = signature?.parameters.flatMap((slot, index) => slot.declaration === node ? [{ slot, index }] : []) ?? [];
    const match = matches.length === 1 ? matches[0] : undefined;
    if (signature === undefined || match === undefined || match.slot.type === undefined || match.slot.sourceSymbol === undefined ||
      queries.declarations.signatureParameters(signature.signature)[match.index] !== match.slot.sourceSymbol ||
      queries.declarations.primarySymbolDeclaration(match.slot.sourceSymbol) !== node) return undefined;
    return Object.freeze({ ...match, owner });
  };
  const checkedValue = (node: Node): SourceErrorCheckedValue | undefined => {
    if (!owns(node)) return undefined;
    const queries = semantics.forNode(node);
    const selectedType = ast.is.IsParameterDeclaration(node)
      ? parameterSlot(node)?.slot.type : queries.types.expressionType(node);
    if (selectedType === undefined) return undefined;
    const declaration = ast.is.IsParameterDeclaration(node) ? node : navigation.sourceReferenceFor(node)?.declaration;
    return Object.freeze({ node, component: Object.freeze({ selectedType,
      ...(declaration === undefined ? {} : { declaration }) }) });
  };
  const selectConstructor: SourceErrorDeclarationQueries["constructorFor"] = node => {
    if (failure !== undefined) return rejected(failure);
    if (!owns(node)) return rejected("An Error construction requires an original checked source expression.");
    const queries = semantics.forNode(node);
    const call = queries.operations.call(node);
    const signature = call === undefined ? undefined : queries.declarations.signatureDeclaration(call.selectedSignature);
    if (signature === undefined || !constructors.has(signature)) return absent;
    const result = checkedValue(node);
    if (call === undefined || result === undefined) return rejected("A selected Error constructor requires its checked result component.");
    const value: SourceErrorConstruction = Object.freeze({ node, signatureDeclaration: signature, selection: call, result });
    return selected(value);
  };
  const constructorFacts = new Map<Node, ReturnType<SourceErrorDeclarationQueries["constructorFor"]>>();
  const constructorFor: SourceErrorDeclarationQueries["constructorFor"] = node => {
    const cached = constructorFacts.get(node);
    if (cached !== undefined) return cached;
    const fact = selectConstructor(node);
    constructorFacts.set(node, fact);
    return fact;
  };
  const fieldCache = new Map<Node, SourceErrorDeclarationSelection<SourceErrorFieldUse>>();
  const fieldFor: SourceErrorDeclarationQueries["fieldFor"] = node => {
    if (failure !== undefined) return rejected(failure);
    if (!owns(node)) return rejected("An Error field requires an original checked property expression.");
    const cached = fieldCache.get(node);
    if (cached !== undefined) return cached;
    const property = semantics.forNode(node).operations.propertyAccess(node);
    const declaration = property?.selectedWriteDeclaration ?? property?.selectedDeclaration;
    const receiver = property === undefined ? undefined : checkedValue(property.receiver.expression);
    const result = declaration === undefined || !fields.has(declaration) ? absent
      : property === undefined || receiver === undefined ? rejected("A selected Error field requires its exact checked receiver component.")
      : selected<SourceErrorFieldUse>(Object.freeze({ node, receiver, memberDeclaration: declaration,
          selection: property, accessMode: property.accessMode }));
    fieldCache.set(node, result);
    return result;
  };
  const selectMutation: SourceErrorDeclarationQueries["mutationFor"] = node => {
    if (failure !== undefined) return rejected(failure);
    if (!owns(node)) return rejected("An Error mutation requires an original checked source expression.");
    const field = fieldFor(node);
    if (field.kind === "unresolved") return field;
    if (field.kind === "resolved" && field.value.accessMode !== "read")
      return selected(Object.freeze([Object.freeze({ kind: "field" as const, field: field.value })]));
    const queries = semantics.forNode(node);
    const call = queries.operations.call(node);
    const signature = call === undefined ? undefined : queries.declarations.signatureDeclaration(call.selectedSignature);
    const slots = signature === undefined ? undefined : mutators.get(signature);
    if (slots === undefined || call === undefined) return absent;
    const mutations: SourceErrorMutation[] = [];
    for (const slot of slots) {
      const bindings = call.sourceArgumentBindings.filter(binding => binding.sourceParameterIndex === slot.parameterIndex);
      const binding = bindings.length === 1 ? bindings[0] : undefined;
      const argument = binding?.sourceForm === "value" && binding.sourceParameterForm === "parameter"
        ? call.sourceArguments[binding.sourceArgumentIndex] : undefined;
      const parameter = call.sourceSelectedSignatureParameters[slot.parameterIndex];
      const checked = argument === undefined ? undefined : checkedValue(argument.expression);
      if (checked === undefined || parameter?.parameterDeclaration !== slot.parameterDeclaration || parameter.rest === true ||
          parameter.selectedType === undefined)
        return rejected("An Error mutation requires its original selected signature, instantiated scalar slot and argument.");
      mutations.push(Object.freeze({ kind: "scalar", scalar: Object.freeze({ node, selection: call,
        slot: Object.freeze({ ...slot, component: Object.freeze({ ...slot.component, selectedType: parameter.selectedType }) }),
        argument: checked }) }));
    }
    return selected(Object.freeze(mutations));
  };
  const mutationFacts = new Map<Node, ReturnType<SourceErrorDeclarationQueries["mutationFor"]>>();
  const mutationFor: SourceErrorDeclarationQueries["mutationFor"] = node => {
    const cached = mutationFacts.get(node);
    if (cached !== undefined) return cached;
    const fact = selectMutation(node);
    mutationFacts.set(node, fact);
    return fact;
  };
  const parameters = new Map<Node, SourceErrorDeclarationSelection<SourceErrorParameterUse>>();
  const parameterFor: SourceErrorDeclarationQueries["parameterFor"] = parameter => {
    if (failure !== undefined) return rejected(failure);
    if (!owns(parameter) || !ast.is.IsParameterDeclaration(parameter))
      return rejected("An Error formal requires its original checked parameter declaration.");
    const cached = parameters.get(parameter);
    if (cached !== undefined) return cached;
    const declaration = ast.parent(parameter);
    const body = declaration === undefined ? undefined : ast.body(declaration);
    const value = checkedValue(parameter);
    const selectedSlot = parameterSlot(parameter);
    if (declaration === undefined || value === undefined || selectedSlot === undefined)
      return rejected("An Error formal requires its checked declaration, symbol and selected type component.");
    const uses: Node[] = [];
    const observes = (binding: Node, current: import("@tsonic/tsts").Symbol, depth: number): boolean => {
      if (body === undefined) return false;
      for (const reference of navigation.referencesWithin(current, body)) {
        uses.push(reference);
        if (sourceEnclosingCallable(reference, ast) !== declaration) return false;
        let expression = reference;
        let parent = ast.parent(expression);
        while (parent !== undefined && (ast.is.IsParenthesizedExpression(parent) || ast.is.IsAsExpression(parent) ||
          ast.is.IsNonNullExpression(parent) || ast.is.IsSatisfiesExpression(parent))) {
          expression = parent;
          parent = ast.parent(expression);
        }
        const field = parent === undefined ? absent : fieldFor(parent);
        if (field.kind === "resolved" && field.value.receiver.node === expression && field.value.accessMode === "read") continue;
        if (depth === 0 && parent !== undefined && ast.is.IsVariableDeclaration(parent) &&
            ast.variableDeclarationKind(parent) === "const" && Node_Initializer(ast, parent) === expression) {
          const alias = navigation.declarationSymbol(parent, ast.getSourceFile(parent)!);
          if (alias !== undefined && observes(parent, alias, 1)) continue;
        }
        const use = navigation.declarationUses(binding).find(use => use.reference === reference);
        if (use?.role === "type-only" || use?.role === "comparison" || use?.role === "condition") continue;
        return false;
      }
      return true;
    };
    const pattern = ast.name(parameter);
    const bindingReads = (): boolean => {
      if (pattern === undefined || !ast.is.IsObjectBindingPattern(pattern)) return true;
      const queries = semantics.forNode(parameter);
      const properties = queries.types.propertyInfos(selectedSlot.slot.type);
      for (const node of ast.elements(pattern)) {
        if (node === undefined || !ast.is.IsBindingElement(node)) return false;
        const element = ast.as.AsBindingElement(node);
        const name = element?.PropertyName ?? element?.name;
        if (element === undefined || name === undefined || element.DotDotDotToken !== undefined) return false;
        const computed = ast.is.IsComputedPropertyName(name) ? semantics.forNode(name).propertyNames.get(name) : undefined;
        const text = ast.is.IsIdentifier(name) || ast.is.IsStringLiteral(name) ? ast.text(name)
          : computed?.kind === "resolved" ? computed.name : undefined;
        const members = properties.filter(member => member.name === text);
        const member = members.length === 1 ? members[0] : undefined;
        if (member === undefined) return false;
        const declarations = new Set([...queries.declarations.symbolDeclarations(member.symbol),
          ...member.rootSymbols.flatMap(symbol => queries.declarations.symbolDeclarations(symbol))]);
        if ([...declarations].filter(declaration => fields.has(declaration)).length !== 1) return false;
        uses.push(node);
      }
      return true;
    };
    const access = body !== undefined && bindingReads() && observes(parameter, selectedSlot.slot.sourceSymbol, 0) ? "read-only" : "writable";
    const result = selected<SourceErrorParameterUse>(Object.freeze({ parameter: value, declaration, access,
      uses: Object.freeze(uses) }));
    parameters.set(parameter, result);
    return result;
  };
  return Object.freeze({ constructorFor, fieldFor, mutationFor, parameterFor,
    invalidationFor: createSourceErrorLocalInvalidationQuery(source, fieldFor, mutationFor, owns) });
}
