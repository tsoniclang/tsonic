import type { DefId, NodeId, SigId, TyId } from "../ids/contract.js";
import type * as Hir from "../ir-hir/contract.js";
import { iterateChildrenOfSyntax } from "../ir-hir/index.js";
import type { LiteralTypeValue, MemberKey, TypeParameter } from "../ir-types/contract.js";
import { isGroup17 as isTypeNode } from "./syntax-capture.js";
import type { RawNumericLiteral } from "./contract.js";
import { numericTypeSpelling } from "./syntax-support.js";
import type { ConversionResult } from "./type-conversion.js";

type Syntax = Hir.SyntaxPhase;
type Checked = Hir.CheckedPhase;

export interface DeclarationLowering {
  readonly core: (node: NodeId) => Hir.HirCoreCapture;
  readonly definitions: ReadonlyMap<NodeId, DefId>;
  readonly resolution: (node: NodeId) => ConversionResult<Hir.HirResolution>;
  readonly memory: (node: NodeId) => Hir.CapturedFact<Hir.HirMemoryLayoutCapture | Hir.HirMemoryFieldCapture | null>;
  readonly checkedType: (node: Hir.TypeNode<Syntax>, inferParameters: readonly NodeId[]) => ConversionResult<Hir.CapturedFact<TyId>>;
  readonly numericLiteral: (type: Hir.CapturedFact<TyId>, spelling: RawNumericLiteral, kind: "number" | "bigint") =>
    ConversionResult<Extract<LiteralTypeValue, { readonly kind: "number" | "bigint" }>>;
  readonly numericOperand: (node: Hir.NumericLiteral<Syntax> | Hir.BigIntLiteral<Syntax>) => ConversionResult<Hir.CapturedFact<TyId>>;
  readonly signature: (node: NodeId) => ConversionResult<SigId>;
  readonly expression: (node: Hir.Expression<Syntax>) => Hir.Expression<Checked>;
  readonly prepareNameExpression: (node: Hir.SyntaxNode<Syntax>, owner: DefId, typeOf: TypeReader) => ConversionResult<void>;
  readonly property: (node: Hir.ComputedPropertyName<Syntax>) => ConversionResult<Hir.CapturedFact<MemberKey>>;
}

function header(node: Hir.NodeHeader): Hir.NodeHeader {
  return { id: node.id, origin: node.origin, parent: node.parent, flags: node.flags, loc: node.loc };
}

function fail(form: string): never {
  throw new TypeError(`front: checked declaration conversion is not implemented: ${form}`);
}

function token<Kind extends Hir.TokenSyntaxKind>(node: Hir.Token<Syntax, Kind>): Hir.Token<Checked, Kind> {
  return { ...header(node), kind: node.kind, tsonic: null };
}

export function lowerCheckedModifiers(source: Hir.ModifierList<Syntax> | null): Hir.ModifierList<Checked> | null {
  return source === null ? null : { loc: source.loc, nodes: source.nodes.map(node => {
    if (node.kind === "Decorator") return fail("decorated declaration");
    return { ...node, tsonic: null };
  }) };
}

export function declarationName(context: DeclarationLowering, node: Hir.Identifier<Syntax>, declaration: DefId): Hir.Identifier<Checked> {
  return { ...header(node), kind: "Identifier", text: node.text,
    tsonic: { core: context.core(node.id), role: "declaration-name", declaration: { kind: "definition", definition: declaration } } };
}

function definitionOf(context: DeclarationLowering, node: NodeId): DefId {
  return context.definitions.get(node) ?? fail("a declaration must retain its actual F1 identity");
}

export type TypeReader = (node: Hir.TypeNode<Syntax>, owner: DefId) => ConversionResult<Hir.TypeNode<Checked>>;

function presentType(node: Hir.TypeNode<Checked>): TyId {
  const fact = node.tsonic.type;
  return fact.kind === "available" ? fact.value : fail("a type parameter requires its actual available checked annotation");
}

function lowerAnnotations(context: DeclarationLowering, root: Hir.SyntaxNode<Syntax>, owner: DefId): ConversionResult<TypeReader> {
  const completed = new Map<NodeId, Hir.TypeNode<Checked>>();
  const binders = new Map<NodeId, NodeId[]>();
  const child = (node: Hir.TypeNode<Syntax>): Hir.TypeNode<Checked> => completed.get(node.id)
    ?? fail("a type child must complete before its containing annotation");
  const typeOf: TypeReader = node => ({ kind: "complete", value: child(node) });
  const enter = (node: Hir.SyntaxNode<Syntax>, parent: DefId, nameExpression: boolean, pattern: NodeId | null) => ({ node, nameExpression, pattern, parent,
    owner: context.definitions.get(node.id) ?? parent, children: iterateChildrenOfSyntax(node) });
  const pending = [enter(root, owner, false, null)];
  for (let frame = pending.pop(); frame !== undefined; frame = pending.pop()) {
    const node = frame.node;
    const next = frame.children.next();
    if (!next.done) {
      const nextNode = next.value;
      const nameExpression = (node.kind === "PropertySignature" || node.kind === "MethodSignature")
          && node.name === nextNode && nextNode.kind === "ComputedPropertyName"
        || frame.nameExpression && !isTypeNode(nextNode)
          && (node.kind !== "ComputedPropertyName" || node.expression === nextNode)
          && (node.kind !== "PropertyAccessExpression" || node.name !== nextNode)
          && (node.kind !== "PropertyAssignment" || node.initializer === nextNode);
      const pattern = node.kind === "ConditionalType" && node.extendsType === nextNode ? node.id : frame.pattern;
      pending.push(frame, enter(nextNode, frame.owner, nameExpression, pattern));
      continue;
    }
    if (frame.nameExpression) {
      const ready = context.prepareNameExpression(node, frame.owner, typeOf);
      if (ready.kind !== "complete") return ready;
      continue;
    }
    if (!isTypeNode(node)) continue;
    if (node.kind === "TemplateLiteralTypeSpan") {
      const type = child(node.type);
      completed.set(node.id, { ...header(node), kind: node.kind, type, literal: { ...node.literal, tsonic: null },
        tsonic: { ...type.tsonic, core: context.core(node.id) } });
      continue;
    }
    const type = context.checkedType(node, binders.get(node.id) ?? []);
    if (type.kind !== "complete") return type;
    const tsonic: Hir.CheckedType = { core: context.core(node.id), type: type.value, referencedDefinitions: [] };
    let result: Hir.TypeNode<Checked>;
    switch (node.kind) {
      case "NumberKeyword": case "StringKeyword": case "BooleanKeyword": case "BigIntKeyword": case "SymbolKeyword":
      case "AnyKeyword": case "UnknownKeyword": case "NeverKeyword": case "ObjectKeyword": case "UndefinedKeyword": case "VoidKeyword": case "ThisType":
        result = { ...header(node), kind: node.kind, tsonic }; break;
      case "UnionType": case "IntersectionType":
        result = { ...header(node), kind: node.kind, types: { loc: node.types.loc, nodes: node.types.nodes.map(child) }, tsonic }; break;
      case "ParenthesizedType": case "OptionalType":
        result = { ...header(node), kind: node.kind, type: child(node.type), tsonic }; break;
      case "ArrayType": result = { ...header(node), kind: node.kind, elementType: child(node.elementType), tsonic }; break;
      case "FunctionType": case "ConstructorType": {
        const owner = definitionOf(context, node.id);
        const binders = typeParameters(context, node.typeParameters, owner, typeOf);
        if (binders.kind !== "complete") return binders;
        const formals = lowerCheckedParameters(context, node.parameters, owner, typeOf);
        if (formals.kind !== "complete") return formals;
        result = { ...header(node), kind: node.kind, modifiers: lowerCheckedModifiers(node.modifiers), typeParameters: binders.value,
          parameters: formals.value, type: node.type === null ? null : child(node.type),
          fullSignature: node.fullSignature === null ? null : child(node.fullSignature),
          tsonic: { ...tsonic, parent: frame.parent, attributes: [], memory: context.memory(node.id), definition: owner } };
        break;
      }
      case "LiteralType": {
        const literal = node.literal;
        const core = context.core(literal.id);
        if (literal.kind === "StringLiteral" || literal.kind === "NoSubstitutionTemplateLiteral") {
          result = { ...header(node), kind: node.kind, tsonic,
            literal: { ...literal, tsonic: { core, role: "type-literal", type: type.value, literal: { kind: "string", value: literal.text } } } };
        } else if (literal.kind === "NullKeyword" || literal.kind === "TrueKeyword" || literal.kind === "FalseKeyword") {
          result = { ...header(node), kind: node.kind, tsonic,
            literal: { ...literal, tsonic: { core, role: "type-literal", type: type.value,
              literal: literal.kind === "NullKeyword" ? { kind: "absence" } : { kind: "boolean", value: literal.kind === "TrueKeyword" } } } };
        } else if (literal.kind === "NumericLiteral" || literal.kind === "BigIntLiteral") {
          const exact = context.numericLiteral(type.value, { token: literal.text, origin: literal.origin },
            literal.kind === "NumericLiteral" ? "number" : "bigint");
          if (exact.kind !== "complete") return exact;
          result = { ...header(node), kind: node.kind, tsonic,
            literal: { ...literal, tsonic: { core, role: "type-literal", type: type.value, literal: exact.value } } };
        } else if (literal.kind === "PrefixUnaryExpression" && literal.operator === "MinusToken" &&
          (literal.operand.kind === "NumericLiteral" || literal.operand.kind === "BigIntLiteral")) {
          const spelling = numericTypeSpelling(literal) ?? fail("a signed literal annotation requires its actual authored spelling");
          const kind = literal.operand.kind === "NumericLiteral" ? "number" : "bigint";
          const signed = context.numericLiteral(type.value, spelling, kind);
          if (signed.kind !== "complete") return signed;
          const operand = context.numericOperand(literal.operand);
          if (operand.kind !== "complete") return operand;
          const magnitude = context.numericLiteral(operand.value, { token: literal.operand.text, origin: literal.operand.origin }, kind);
          if (magnitude.kind !== "complete") return magnitude;
          result = { ...header(node), kind: node.kind, tsonic, literal: { ...literal,
            operand: { ...literal.operand, tsonic: { core: context.core(literal.operand.id), role: "type-literal",
              type: operand.value, literal: magnitude.value } },
            tsonic: { core, role: "type-literal", type: type.value, literal: signed.value } } };
        } else return fail(`${node.kind} ${literal.kind}`);
        break;
      }
      case "TupleType":
        result = { ...header(node), kind: node.kind, elements: { loc: node.elements.loc, nodes: node.elements.nodes.map(child) }, tsonic }; break;
      case "TypeOperator":
        result = { ...header(node), kind: node.kind, operator: node.operator, type: child(node.type), tsonic }; break;
      case "IndexedAccessType":
        result = { ...header(node), kind: node.kind, objectType: child(node.objectType), indexType: child(node.indexType), tsonic }; break;
      case "ConditionalType":
        result = { ...header(node), kind: node.kind, checkType: child(node.checkType), extendsType: child(node.extendsType),
          trueType: child(node.trueType), falseType: child(node.falseType), tsonic }; break;
      case "InferType": {
        if (frame.pattern === null && type.value.kind === "available") return fail("an inference parameter outside its actual extends pattern");
        if (frame.pattern !== null) {
          const selected = binders.get(frame.pattern);
          if (selected === undefined) binders.set(frame.pattern, [node.typeParameter.id]);
          else selected.push(node.typeParameter.id);
        }
        const binder = typeParameter(context, node.typeParameter, frame.owner, typeOf);
        if (binder.kind !== "complete") return binder;
        result = { ...header(node), kind: node.kind, typeParameter: binder.value, tsonic };
        break;
      }
      case "TemplateLiteralType":
        result = { ...header(node), kind: node.kind, head: { ...node.head, tsonic: null }, templateSpans: { ...node.templateSpans,
          nodes: node.templateSpans.nodes.map(span => {
            const selected = child(span);
            return selected.kind === "TemplateLiteralTypeSpan" ? selected : fail("template type span");
          }) }, tsonic }; break;
      case "TypeLiteral": {
        const members = typeElements(context, node.members.nodes, frame.owner, typeOf);
        if (members.kind !== "complete") return members;
        result = { ...header(node), kind: node.kind, members: { loc: node.members.loc, nodes: members.value }, tsonic }; break;
      }
      case "TypeReference": {
        const name = node.typeName;
        if (name.kind !== "Identifier") return fail("qualified type reference");
        const resolved = context.resolution(name.id);
        if (resolved.kind !== "complete") return resolved;
        const resolution = resolved.value;
        result = { ...header(node), kind: node.kind,
          typeName: { ...header(name), kind: "Identifier", text: name.text, tsonic: { core: context.core(name.id), role: "type-name", resolution } },
          typeArguments: node.typeArguments === null ? null : { loc: node.typeArguments.loc, nodes: node.typeArguments.nodes.map(child) },
          tsonic: { ...tsonic, referencedDefinitions: resolution.kind === "declarations" ? resolution.definitions : [] } };
        break;
      }
      case "TypeQuery": {
        const name = node.exprName;
        if (name.kind !== "Identifier" || node.typeArguments !== null) return fail("qualified or applied type query");
        const resolved = context.resolution(name.id);
        if (resolved.kind !== "complete") return resolved;
        const resolution = resolved.value;
        result = { ...header(node), kind: node.kind, typeArguments: null,
          exprName: { ...header(name), kind: "Identifier", text: name.text, tsonic: { core: context.core(name.id), role: "type-name", resolution } },
          tsonic: { ...tsonic, referencedDefinitions: resolution.kind === "declarations" ? resolution.definitions : [] } };
        break;
      }
      default: return fail(node.kind);
    }
    completed.set(node.id, result);
  }
  return { kind: "complete", value: typeOf };
}

export function lowerCheckedType(context: DeclarationLowering, root: Hir.TypeNode<Syntax>, owner: DefId): ConversionResult<Hir.TypeNode<Checked>> {
  const annotations = lowerAnnotations(context, root, owner);
  return annotations.kind === "complete" ? annotations.value(root, owner) : annotations;
}

export function propertyName(context: DeclarationLowering, node: Hir.PropertyName<Syntax>, declaration: DefId): ConversionResult<Hir.PropertyName<Checked>> {
  if (node.kind === "Identifier") return { kind: "complete", value: declarationName(context, node, declaration) };
  if (node.kind === "ComputedPropertyName") {
    const key = context.property(node);
    if (key.kind !== "complete") return key;
    return { kind: "complete", value: { ...header(node), kind: node.kind,
      expression: context.expression(node.expression), tsonic: { core: context.core(node.id), key: key.value,
        origins: { kind: "unavailable", reason: "not-provided", causes: [] } } } };
  }
  if (node.kind === "StringLiteral" || node.kind === "NumericLiteral") return { kind: "complete", value: { ...header(node), kind: node.kind, text: node.text, tokenFlags: node.tokenFlags,
    tsonic: { core: context.core(node.id), role: "declaration-name", declaration: { kind: "definition", definition: declaration } } } };
  return fail(node.kind);
}

function facts(context: DeclarationLowering, node: Hir.NodeHeader, owner: DefId): Hir.CheckedDeclarationFacts {
  return { core: context.core(node.id), parent: owner, attributes: [], memory: context.memory(node.id) };
}

function bodylessBinding(context: DeclarationLowering, node: Hir.ParameterDeclaration<Syntax>, declaration: DefId): Hir.BindingName<Checked> {
  const name = node.name;
  if (name.kind === "Identifier") return declarationName(context, name, declaration);
  if (name.kind !== "ArrayBindingPattern" || node.dotDotDotToken === null) return fail("bodyless parameter pattern");
  const elements: Hir.BindingElement<Checked>[] = [];
  for (const element of name.elements.nodes) {
    if (element.dotDotDotToken !== null || element.propertyName !== null || element.initializer !== null
      || element.name !== null && element.name.kind !== "Identifier") return fail("bodyless rest binding element");
    const bound = element.name === null ? null : definitionOf(context, element.id);
    elements.push({ ...header(element), kind: "BindingElement", dotDotDotToken: null, propertyName: null,
      name: element.name !== null && bound !== null ? declarationName(context, element.name, bound) : null,
      initializer: null, tsonic: { core: context.core(element.id), declaredType: { kind: "available", value: null },
        declaration: bound === null ? null : { kind: "definition", definition: bound } } });
  }
  return { ...header(name), kind: "ArrayBindingPattern", elements: { loc: name.elements.loc, nodes: elements },
    tsonic: { core: context.core(name.id), declaredType: { kind: "available", value: null }, declaration: null } };
}

export function lowerCheckedParameters(context: DeclarationLowering, source: Hir.ParameterList<Syntax>, owner: DefId,
  typeOf: TypeReader): ConversionResult<Hir.ParameterList<Checked>> {
  const nodes: Hir.ParameterDeclaration<Checked>[] = [];
  for (const node of source.nodes) {
    if (node.initializer !== null) return fail("bodyless parameter initializer");
    const declaration = definitionOf(context, node.id);
    const type = node.type === null ? null : typeOf(node.type, declaration);
    if (type !== null && type.kind !== "complete") return type;
    nodes.push({ ...header(node), kind: "Parameter", modifiers: lowerCheckedModifiers(node.modifiers),
      dotDotDotToken: node.dotDotDotToken === null ? null : token(node.dotDotDotToken),
      name: bodylessBinding(context, node, declaration), questionToken: node.questionToken === null ? null : token(node.questionToken),
      type: type === null ? null : type.value, initializer: null,
      tsonic: { ...facts(context, node, owner), declaration: { kind: "definition", definition: declaration },
        declaredType: type === null ? { kind: "available", value: null } : type.value.tsonic.type, inferredTypeBound: null, initializer: null } });
  }
  return { kind: "complete", value: { loc: source.loc, nodes } };
}

function typeParameter(context: DeclarationLowering, node: Hir.TypeParameterDeclaration<Syntax>,
  owner: DefId, typeOf: TypeReader): ConversionResult<Hir.TypeParameterDeclaration<Checked>> {
  if (node.expression !== null) return fail("a type parameter with an expression");
  const declaration = definitionOf(context, node.id);
  const constraint = node.constraint === null ? null : typeOf(node.constraint, declaration);
  if (constraint !== null && constraint.kind !== "complete") return constraint;
  const defaultType = node.defaultType === null ? null : typeOf(node.defaultType, declaration);
  if (defaultType !== null && defaultType.kind !== "complete") return defaultType;
  const parameter: TypeParameter = { declaration,
    constraint: constraint === null ? null : presentType(constraint.value),
    default: defaultType === null ? null : presentType(defaultType.value) };
  return { kind: "complete", value: { ...header(node), kind: "TypeParameter", modifiers: lowerCheckedModifiers(node.modifiers),
    name: declarationName(context, node.name, declaration), expression: null,
    constraint: constraint === null ? null : constraint.value, defaultType: defaultType === null ? null : defaultType.value,
    tsonic: { ...facts(context, node, owner), definition: declaration, parameter } } };
}

export function typeParameters(context: DeclarationLowering, source: Hir.TypeParameterList<Syntax> | null,
  owner: DefId, typeOf: TypeReader): ConversionResult<Hir.TypeParameterList<Checked> | null> {
  if (source === null) return { kind: "complete", value: null };
  const nodes: Hir.TypeParameterDeclaration<Checked>[] = [];
  for (const node of source.nodes) {
    const selected = typeParameter(context, node, owner, typeOf);
    if (selected.kind !== "complete") return selected;
    nodes.push(selected.value);
  }
  return { kind: "complete", value: { loc: source.loc, nodes } };
}

type BodylessCallable = Extract<Hir.SyntaxNode<Syntax>, { readonly kind: "FunctionDeclaration" | "CallSignature" | "ConstructSignature"
  | "MethodSignature" | "IndexSignature" | "GetAccessor" | "SetAccessor" }>;

interface CheckedCallableHeader {
  readonly typeParameters: Hir.TypeParameterList<Checked> | null;
  readonly parameters: Hir.ParameterList<Checked>;
  readonly type: Hir.TypeNode<Checked> | null;
  readonly fullSignature: null;
  readonly tsonic: Hir.CheckedCallable;
}

function bodylessCallableHeader(context: DeclarationLowering, node: BodylessCallable, owner: DefId,
  declaration: DefId, typeOf: TypeReader): ConversionResult<CheckedCallableHeader> {
  if (node.fullSignature !== null) return fail("full signature annotation");
  const own = typeParameters(context, node.typeParameters, declaration, typeOf);
  if (own.kind !== "complete") return own;
  const signature = node.kind === "IndexSignature" ? null : context.signature(node.id);
  if (signature !== null && signature.kind !== "complete") return signature;
  const formal = lowerCheckedParameters(context, node.parameters, declaration, typeOf);
  if (formal.kind !== "complete") return formal;
  const type = node.type === null ? null : typeOf(node.type, declaration);
  if (type !== null && type.kind !== "complete") return type;
  return { kind: "complete", value: { typeParameters: own.value, parameters: formal.value, type: type === null ? null : type.value,
    fullSignature: null, tsonic: { ...facts(context, node, owner), definition: declaration,
      parameters: own.value?.nodes.map(parameter => parameter.tsonic.parameter) ?? [], body: null,
      signatures: signature === null ? [] : [{ declaration, role: "api-signature", signature: signature.value, body: null }] } } };
}

export function lowerCheckedBodylessFunction(context: DeclarationLowering, node: Hir.FunctionDeclaration<Syntax>, owner: DefId):
  ConversionResult<Hir.FunctionDeclaration<Checked>> {
  if (node.body !== null || node.asteriskToken !== null || node.name === null) return fail("bodyless function header");
  const declaration = definitionOf(context, node.id);
  const callable = bodylessCallableHeader(context, node, owner, declaration, (type, typeOwner) => lowerCheckedType(context, type, typeOwner));
  if (callable.kind !== "complete") return callable;
  return { kind: "complete", value: { ...header(node), kind: node.kind, ...callable.value,
    modifiers: lowerCheckedModifiers(node.modifiers), name: declarationName(context, node.name, declaration),
    body: null, asteriskToken: null } };
}

function typeElements(context: DeclarationLowering, source: readonly Hir.TypeElement<Syntax>[], owner: DefId,
  typeOf: TypeReader): ConversionResult<readonly Hir.TypeElement<Checked>[]> {
  const elements: Hir.TypeElement<Checked>[] = [];
  for (const node of source) {
    const declaration = definitionOf(context, node.id);
    if (node.kind === "PropertySignature") {
      if (node.initializer !== null) return fail("property signature initializer");
      const type = node.type === null ? null : typeOf(node.type, declaration);
      if (type !== null && type.kind !== "complete") return type;
      const name = propertyName(context, node.name, declaration);
      if (name.kind !== "complete") return name;
      elements.push({ ...header(node), kind: node.kind, modifiers: lowerCheckedModifiers(node.modifiers),
        name: name.value, postfixToken: node.postfixToken === null ? null : token(node.postfixToken),
        type: type === null ? null : type.value, initializer: null,
        tsonic: { ...facts(context, node, owner), declaration: { kind: "definition", definition: declaration },
          declaredType: type === null ? { kind: "available", value: null } : type.value.tsonic.type, inferredTypeBound: null, initializer: null } });
      continue;
    }
    if (node.kind !== "CallSignature" && node.kind !== "ConstructSignature" && node.kind !== "MethodSignature" && node.kind !== "IndexSignature"
      && node.kind !== "GetAccessor" && node.kind !== "SetAccessor")
      return fail(node.kind);
    if ((node.kind === "GetAccessor" || node.kind === "SetAccessor") && (node.body !== null || node.asteriskToken !== null))
      return fail("an accessor with an execution body or generator marker");
    const callable = bodylessCallableHeader(context, node, owner, declaration, typeOf);
    if (callable.kind !== "complete") return callable;
    const common = { ...header(node), ...callable.value };
    switch (node.kind) {
      case "CallSignature": case "ConstructSignature": elements.push({ ...common, kind: node.kind }); break;
      case "IndexSignature": elements.push({ ...common, kind: node.kind, modifiers: lowerCheckedModifiers(node.modifiers) }); break;
      case "MethodSignature": case "GetAccessor": case "SetAccessor": {
        const name = propertyName(context, node.name, declaration);
        if (name.kind !== "complete") return name;
        const selected = { ...common, modifiers: lowerCheckedModifiers(node.modifiers), name: name.value,
          postfixToken: node.postfixToken === null ? null : token(node.postfixToken) };
        if (node.kind === "MethodSignature") elements.push({ ...selected, kind: node.kind });
        else elements.push({ ...selected, kind: node.kind, body: null, asteriskToken: null });
        break;
      }
    }
  }
  return { kind: "complete", value: elements };
}

export function lowerCheckedInterface(context: DeclarationLowering, source: Hir.InterfaceDeclaration<Syntax>, owner: DefId): ConversionResult<Hir.InterfaceDeclaration<Checked>> {
  if (source.heritageClauses !== null) return fail("interface heritage");
  const definition = definitionOf(context, source.id);
  const annotations = lowerAnnotations(context, source, owner);
  if (annotations.kind !== "complete") return annotations;
  const typeOf = annotations.value;
  const formals = typeParameters(context, source.typeParameters, definition, typeOf);
  if (formals.kind !== "complete") return formals;
  const members = typeElements(context, source.members.nodes, definition, typeOf);
  if (members.kind !== "complete") return members;
  return { kind: "complete", value: { ...header(source), kind: "InterfaceDeclaration", name: declarationName(context, source.name, definition),
    modifiers: lowerCheckedModifiers(source.modifiers), typeParameters: formals.value, heritageClauses: null,
    members: { loc: source.members.loc, nodes: members.value },
    tsonic: { ...facts(context, source, owner), definition, parameters: formals.value?.nodes.map(parameter => parameter.tsonic.parameter) ?? [],
      heritage: [], members: source.members.nodes.map(node => definitionOf(context, node.id)) } } };
}

export function lowerCheckedAlias(context: DeclarationLowering, source: Hir.TypeAliasDeclaration<Syntax>,
  owner: DefId): ConversionResult<Hir.TypeAliasDeclaration<Checked>> {
  const definition = definitionOf(context, source.id);
  const typeOf: TypeReader = (node, owner) => lowerCheckedType(context, node, owner);
  const formals = typeParameters(context, source.typeParameters, definition, typeOf);
  if (formals.kind !== "complete") return formals;
  const type = lowerCheckedType(context, source.type, definition);
  if (type.kind !== "complete") return type;
  return { kind: "complete", value: { ...header(source), kind: source.kind, modifiers: lowerCheckedModifiers(source.modifiers),
    name: declarationName(context, source.name, definition), typeParameters: formals.value,
    type: type.value,
    tsonic: { ...facts(context, source, owner), definition,
      parameters: formals.value?.nodes.map(parameter => parameter.tsonic.parameter) ?? [],
      type: type.value.tsonic.type } } };
}
