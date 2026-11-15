import type { DefId, NodeId, SigId, TyId } from "../ids/contract.js";
import type * as Hir from "../ir-hir/contract.js";
import { iterateChildrenOfSyntax } from "../ir-hir/index.js";
import type { MemberKey, TypeParameter } from "../ir-types/contract.js";
import { isGroup17 as isTypeNode } from "./syntax-capture.js";

type Syntax = Hir.SyntaxPhase;
type Checked = Hir.CheckedPhase;

export interface DeclarationLowering {
  readonly core: (node: NodeId) => Hir.HirCoreCapture;
  readonly definition: (node: NodeId) => DefId;
  readonly resolution: (node: NodeId) => Hir.HirResolution;
  readonly memory: (node: NodeId) => Hir.CapturedFact<Hir.HirMemoryLayoutCapture | Hir.HirMemoryFieldCapture | null>;
  readonly checkedType: (node: NodeId) => TyId;
  readonly signature: (node: NodeId) => SigId;
  readonly expression: (node: Hir.Expression<Syntax>) => Hir.Expression<Checked>;
  readonly property: (node: NodeId) => Hir.CapturedFact<MemberKey>;
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

function declarationName(context: DeclarationLowering, node: Hir.Identifier<Syntax>, declaration: DefId): Hir.Identifier<Checked> {
  return { ...header(node), kind: "Identifier", text: node.text,
    tsonic: { core: context.core(node.id), role: "declaration-name", declaration: { kind: "definition", definition: declaration } } };
}

export function lowerCheckedType(context: DeclarationLowering, root: Hir.TypeNode<Syntax>): Hir.TypeNode<Checked> {
  const completed = new Map<NodeId, Hir.TypeNode<Checked>>();
  const pending: { readonly node: Hir.TypeNode<Syntax>; readonly ready: boolean }[] = [{ node: root, ready: false }];
  const child = (node: Hir.TypeNode<Syntax>): Hir.TypeNode<Checked> => completed.get(node.id)
    ?? fail("a type child must complete before its containing annotation");
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const node = next.node;
    if (!next.ready) {
      pending.push({ node, ready: true });
      const children: Hir.TypeNode<Syntax>[] = [];
      for (const value of iterateChildrenOfSyntax(node))
        if (isTypeNode(value)) children.push(value);
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const value = children[index];
        if (value === undefined) return fail("a captured type child inventory is dense");
        pending.push({ node: value, ready: false });
      }
      continue;
    }
    const type = context.checkedType(node.id);
    const tsonic: Hir.CheckedType = { core: context.core(node.id), type: { kind: "available", value: type }, referencedDefinitions: [] };
    let result: Hir.TypeNode<Checked>;
    switch (node.kind) {
      case "NumberKeyword": case "StringKeyword": case "BooleanKeyword": case "BigIntKeyword": case "SymbolKeyword":
      case "AnyKeyword": case "UnknownKeyword": case "NeverKeyword": case "ObjectKeyword": case "UndefinedKeyword": case "VoidKeyword":
        result = { ...header(node), kind: node.kind, tsonic }; break;
      case "UnionType": case "IntersectionType":
        result = { ...header(node), kind: node.kind, types: { loc: node.types.loc, nodes: node.types.nodes.map(child) }, tsonic }; break;
      case "ParenthesizedType": result = { ...header(node), kind: node.kind, type: child(node.type), tsonic }; break;
      case "ArrayType": result = { ...header(node), kind: node.kind, elementType: child(node.elementType), tsonic }; break;
      case "TypeReference": {
        const name = node.typeName;
        if (name.kind !== "Identifier") return fail("qualified type reference");
        const resolution = context.resolution(name.id);
        result = { ...header(node), kind: node.kind,
          typeName: { ...header(name), kind: "Identifier", text: name.text, tsonic: { core: context.core(name.id), role: "type-name", resolution } },
          typeArguments: node.typeArguments === null ? null : { loc: node.typeArguments.loc, nodes: node.typeArguments.nodes.map(child) },
          tsonic: { ...tsonic, referencedDefinitions: resolution.kind === "declarations" ? resolution.definitions : [] } };
        break;
      }
      default: return fail(node.kind);
    }
    completed.set(node.id, result);
  }
  return child(root);
}

function propertyName(context: DeclarationLowering, node: Hir.PropertyName<Syntax>, declaration: DefId): Hir.PropertyName<Checked> {
  if (node.kind === "Identifier") return declarationName(context, node, declaration);
  if (node.kind === "ComputedPropertyName") return { ...header(node), kind: node.kind,
    expression: context.expression(node.expression), tsonic: { core: context.core(node.id), key: context.property(node.id),
      origins: { kind: "unavailable", reason: "not-provided", causes: [] } } };
  if (node.kind === "StringLiteral") return { ...header(node), kind: node.kind, text: node.text, tokenFlags: node.tokenFlags,
    tsonic: { core: context.core(node.id), role: "declaration-name", declaration: { kind: "definition", definition: declaration } } };
  return fail(node.kind);
}

function facts(context: DeclarationLowering, node: Hir.NodeHeader, owner: DefId): Hir.CheckedDeclarationFacts {
  return { core: context.core(node.id), parent: owner, attributes: [], memory: context.memory(node.id) };
}

function parameters(context: DeclarationLowering, source: Hir.ParameterList<Syntax>, owner: DefId): Hir.ParameterList<Checked> {
  return { loc: source.loc, nodes: source.nodes.map(node => {
    if (node.name.kind !== "Identifier" || node.initializer !== null) return fail("bodyless parameter pattern or initializer");
    const declaration = context.definition(node.id);
    return { ...header(node), kind: "Parameter", modifiers: lowerCheckedModifiers(node.modifiers),
      dotDotDotToken: node.dotDotDotToken === null ? null : token(node.dotDotDotToken),
      name: declarationName(context, node.name, declaration), questionToken: node.questionToken === null ? null : token(node.questionToken),
      type: node.type === null ? null : lowerCheckedType(context, node.type), initializer: null,
      tsonic: { ...facts(context, node, owner), declaration: { kind: "definition", definition: declaration },
        declaredType: { kind: "available", value: node.type === null ? null : context.checkedType(node.type.id) }, initializer: null } };
  }) };
}

function typeParameters(context: DeclarationLowering, source: Hir.TypeParameterList<Syntax> | null,
  owner: DefId): Hir.TypeParameterList<Checked> | null {
  return source === null ? null : { loc: source.loc, nodes: source.nodes.map((node, index) => {
    if (node.expression !== null) return fail("a type parameter with an expression");
    const declaration = context.definition(node.id);
    const parameter: TypeParameter = { identity: { owner, index }, declaration,
      constraint: node.constraint === null ? null : context.checkedType(node.constraint.id),
      default: node.defaultType === null ? null : context.checkedType(node.defaultType.id) };
    return { ...header(node), kind: "TypeParameter", modifiers: lowerCheckedModifiers(node.modifiers),
      name: declarationName(context, node.name, declaration), expression: null,
      constraint: node.constraint === null ? null : lowerCheckedType(context, node.constraint),
      defaultType: node.defaultType === null ? null : lowerCheckedType(context, node.defaultType),
      tsonic: { ...facts(context, node, owner), definition: declaration, parameter } };
  }) };
}

export function lowerCheckedInterface(context: DeclarationLowering, source: Hir.InterfaceDeclaration<Syntax>, owner: DefId): Hir.InterfaceDeclaration<Checked> {
  if (source.heritageClauses !== null) return fail("interface heritage");
  const definition = context.definition(source.id);
  const formals = typeParameters(context, source.typeParameters, definition);
  const members: Hir.TypeElement<Checked>[] = source.members.nodes.map(node => {
    const declaration = context.definition(node.id);
    if (node.kind === "PropertySignature") {
      if (node.initializer !== null) return fail("property signature initializer");
      return { ...header(node), kind: node.kind, modifiers: lowerCheckedModifiers(node.modifiers),
        name: propertyName(context, node.name, declaration), postfixToken: node.postfixToken === null ? null : token(node.postfixToken),
        type: node.type === null ? null : lowerCheckedType(context, node.type), initializer: null,
        tsonic: { ...facts(context, node, definition), declaration: { kind: "definition", definition: declaration },
          declaredType: { kind: "available", value: node.type === null ? null : context.checkedType(node.type.id) }, initializer: null } };
    }
    if (node.kind !== "CallSignature" && node.kind !== "ConstructSignature" && node.kind !== "MethodSignature" && node.kind !== "IndexSignature")
      return fail(node.kind);
    if (node.fullSignature !== null) return fail("full signature annotation");
    const own = typeParameters(context, node.typeParameters, declaration);
    const tsonic: Hir.CheckedCallable = { ...facts(context, node, definition), definition: declaration,
      parameters: own?.nodes.map(parameter => parameter.tsonic.parameter) ?? [], body: null,
      signatures: node.kind === "IndexSignature" ? [] : [{ declaration, role: "api-signature", signature: context.signature(node.id), body: null }] };
    const common = { ...header(node), typeParameters: own, parameters: parameters(context, node.parameters, declaration),
      type: node.type === null ? null : lowerCheckedType(context, node.type), fullSignature: null, tsonic };
    switch (node.kind) {
      case "CallSignature": case "ConstructSignature": return { ...common, kind: node.kind };
      case "IndexSignature": return { ...common, kind: node.kind, modifiers: lowerCheckedModifiers(node.modifiers) };
      case "MethodSignature": return { ...common, kind: node.kind, modifiers: lowerCheckedModifiers(node.modifiers),
        name: propertyName(context, node.name, declaration), postfixToken: node.postfixToken === null ? null : token(node.postfixToken) };
    }
  });
  return { ...header(source), kind: "InterfaceDeclaration", name: declarationName(context, source.name, definition),
    modifiers: lowerCheckedModifiers(source.modifiers), typeParameters: formals, heritageClauses: null, members: { loc: source.members.loc, nodes: members },
    tsonic: { ...facts(context, source, owner), definition, parameters: formals?.nodes.map(parameter => parameter.tsonic.parameter) ?? [],
      heritage: [], members: source.members.nodes.map(node => context.definition(node.id)) } };
}
