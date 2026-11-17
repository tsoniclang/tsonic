import type { DefId, NodeId, TyId } from "../ids/contract.js";
import type * as Hir from "../ir-hir/contract.js";
import { iterateChildrenOfSyntax } from "../ir-hir/index.js";
import type { SignatureParameter } from "../ir-types/contract.js";
import { internType } from "../ir-types/index.js";
import type { DeclarationNameExpression, TypedPhase } from "../ir-tir/contract.js";
import type { ElaborateDeps } from "./contract.js";
import { throwInvariant } from "../diag/index.js";

type Checked = Hir.CheckedPhase;

function fail(message: string): never {
  return throwInvariant({ owner: "elaborate", query: null, origin: null, message });
}

export function declarationModifiers(input: Hir.ModifierList<Checked> | null): Hir.ModifierList<TypedPhase> | null {
  return input === null ? null : { ...input, nodes: input.nodes.map(node => {
    if (node.kind === "Decorator") return fail("A declaration decorator requires its actual selected application.");
    return { ...node, tsonic: null };
  }) };
}

export function declarationName(node: Hir.Identifier<Checked>, storage: TyId | null): Hir.Identifier<TypedPhase> {
  if (node.tsonic.role !== "declaration-name") return fail("A declaration name requires its actual checked declaration target.");
  return { ...node, tsonic: { role: "declaration-name", declaration: node.tsonic.declaration, storage } };
}

type TypeReader = (node: Hir.TypeNode<Checked> | null) => Hir.TypeNode<TypedPhase> | null;

function isTypeNode(node: Hir.SyntaxNode<Checked>): node is Hir.TypeNode<Checked> {
  return node.tsonic !== null && "referencedDefinitions" in node.tsonic;
}

export function declarationType(deps: ElaborateDeps, root: Hir.TypeNode<Checked> | null): Hir.TypeNode<TypedPhase> | null {
  if (root === null) return null;
  const completed = new Map<NodeId, Hir.TypeNode<TypedPhase>>();
  const members = new Map<NodeId, Hir.TypeElement<TypedPhase>>();
  const enter = (node: Hir.SyntaxNode<Checked>) => {
    if (node.kind === "GetAccessor" || node.kind === "SetAccessor") accessorBoundary(node);
    return { node, children: iterateChildrenOfSyntax(node) };
  };
  const pending = [enter(root)];
  const child = (node: Hir.TypeNode<Checked>): Hir.TypeNode<TypedPhase> => completed.get(node.id)
    ?? fail("A declaration annotation requires its completed actual type child.");
  const read: TypeReader = node => node === null ? null : child(node);
  for (let frame = pending.pop(); frame !== undefined; frame = pending.pop()) {
    const next = frame.children.next();
    if (!next.done) {
      pending.push(frame, enter(next.value));
      continue;
    }
    const node = frame.node;
    if (node.kind === "PropertySignature" || node.kind === "MethodSignature" || node.kind === "CallSignature"
      || node.kind === "ConstructSignature" || node.kind === "IndexSignature" || node.kind === "GetAccessor" || node.kind === "SetAccessor") {
      members.set(node.id, typeElement(deps, node, read));
      continue;
    }
    if (!isTypeNode(node)) continue;
    if (node.tsonic.type.kind !== "available") return fail("A declaration annotation requires its actual captured type or original error.");
    const tsonic = { type: node.tsonic.type.value, declarations: node.tsonic.referencedDefinitions };
    let result: Hir.TypeNode<TypedPhase>;
    switch (node.kind) {
      case "NumberKeyword": case "BooleanKeyword": case "StringKeyword": case "BigIntKeyword": case "SymbolKeyword":
      case "AnyKeyword": case "UnknownKeyword": case "NeverKeyword": case "VoidKeyword": case "UndefinedKeyword": case "ObjectKeyword":
        result = { ...node, tsonic }; break;
      case "UnionType": case "IntersectionType":
        result = { ...node, types: { ...node.types, nodes: node.types.nodes.map(child) }, tsonic }; break;
      case "ParenthesizedType": result = { ...node, type: child(node.type), tsonic }; break;
      case "ArrayType": result = { ...node, elementType: child(node.elementType), tsonic }; break;
      case "TypeLiteral": result = { ...node,
        members: { ...node.members, nodes: node.members.nodes.map(member => members.get(member.id)
          ?? fail("A type literal retains its actual completed typed member.")) }, tsonic }; break;
      case "TypeReference": {
        if (node.typeName.kind !== "Identifier" || node.typeName.tsonic.role !== "type-name")
          return fail("A qualified declaration type requires its actual checked type-name projection.");
        result = { ...node, typeName: { ...node.typeName, tsonic: { role: "type-name", type: tsonic.type,
          declarations: tsonic.declarations } }, typeArguments: node.typeArguments === null ? null
            : { ...node.typeArguments, nodes: node.typeArguments.nodes.map(child) }, tsonic };
        break;
      }
      default: return fail(`Declaration annotation ${node.kind} requires its actual typed projection.`);
    }
    completed.set(node.id, result);
  }
  return child(root);
}

function typeParameters(input: Hir.TypeParameterList<Checked> | null, read: TypeReader): Hir.TypeParameterList<TypedPhase> | null {
  return input === null ? null : { ...input, nodes: input.nodes.map(node => {
    if (node.expression !== null) return fail("A type parameter expression requires its actual typed producer.");
    return { ...node, modifiers: declarationModifiers(node.modifiers), name: declarationName(node.name, null), expression: null,
      constraint: read(node.constraint), defaultType: read(node.defaultType),
      tsonic: { parameter: node.tsonic.parameter } };
  }) };
}

function propertyName(node: Hir.PropertyName<Checked>): Hir.PropertyName<TypedPhase> {
  if (node.kind === "Identifier") return declarationName(node, null);
  if (node.kind === "StringLiteral" && node.tsonic.role === "declaration-name")
    return { ...node, tsonic: { role: "declaration-name", declaration: node.tsonic.declaration } };
  if (node.kind === "ComputedPropertyName") return { ...node,
    expression: nameExpression(node.expression), tsonic: { kind: "declaration", key: node.tsonic.key } };
  return fail(`The actual ${node.kind} declaration name requires its typed non-executing key-expression projection.`);
}

function nameExpression(root: Hir.Expression<Checked>): Hir.Expression<TypedPhase> {
  const completed = new Map<NodeId, Hir.Expression<TypedPhase>>();
  const pending: { readonly node: Hir.Expression<Checked>; readonly build: boolean }[] = [{ node: root, build: false }];
  const child = (node: Hir.Expression<Checked>): Hir.Expression<TypedPhase> => completed.get(node.id)
    ?? fail("A nonexecuting declaration name retains its actual completed syntax child.");
  const tsonic: DeclarationNameExpression = { role: "declaration-name-expression" };
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const node = next.node;
    if (!next.build) {
      pending.push({ node, build: true });
      if (node.kind === "PropertyAccessExpression") pending.push({ node: node.expression, build: false });
      continue;
    }
    switch (node.kind) {
      case "Identifier": case "StringLiteral": case "NumericLiteral":
        completed.set(node.id, { ...node, tsonic }); break;
      case "PropertyAccessExpression":
        completed.set(node.id, { ...node, expression: child(node.expression), name: { ...node.name, tsonic },
          questionDotToken: node.questionDotToken === null ? null : { ...node.questionDotToken, tsonic: null }, tsonic }); break;
      default: return fail(`Nonexecuting declaration-name syntax ${node.kind} requires its actual phase projection.`);
    }
  }
  return child(root);
}

type BodylessCallable = Hir.CallSignatureDeclaration<Checked> | Hir.ConstructSignatureDeclaration<Checked>
  | Hir.MethodSignatureDeclaration<Checked> | Hir.GetAccessorDeclaration<Checked> | Hir.SetAccessorDeclaration<Checked>;
type TypedBodylessCallable = Hir.CallSignatureDeclaration<TypedPhase> | Hir.ConstructSignatureDeclaration<TypedPhase>
  | Hir.MethodSignatureDeclaration<TypedPhase> | Hir.GetAccessorDeclaration<TypedPhase> | Hir.SetAccessorDeclaration<TypedPhase>;

function accessorBoundary(node: Hir.GetAccessorDeclaration<Checked> | Hir.SetAccessorDeclaration<Checked>): void {
  if (node.body !== null || node.asteriskToken !== null)
    return fail("A declaration accessor retains its actual nonexecuting body boundary.");
}

function formal(node: Hir.ParameterDeclaration<Checked>, owner: DefId, parameter: SignatureParameter, read: TypeReader): Hir.ParameterDeclaration<TypedPhase> {
  const checked = node.tsonic;
  if (checked.parent !== owner || checked.declaration.kind !== "definition" || checked.declaredType.kind !== "available"
    || checked.declaredType.value === null || checked.initializer !== null || node.initializer !== null
    || node.name.kind !== "Identifier" || parameter.declaration !== checked.declaration.definition || parameter.initializer !== null)
    return fail("A bodyless formal requires its genuine checked definition and selected signature slot, without an execution local.");
  return { ...node, modifiers: declarationModifiers(node.modifiers),
    dotDotDotToken: node.dotDotDotToken === null ? null : { ...node.dotDotDotToken, tsonic: null },
    questionToken: node.questionToken === null ? null : { ...node.questionToken, tsonic: null },
    name: declarationName(node.name, parameter.type), type: read(node.type), initializer: null,
    tsonic: { declaration: checked.declaration.definition, local: null, storage: parameter.type, passing: parameter.passing,
      initializer: null, role: parameter.kind } };
}

function callable(deps: ElaborateDeps, node: BodylessCallable, read: TypeReader): TypedBodylessCallable {
  const checked = node.tsonic;
  if (checked.body !== null || checked.signatures.length === 0)
    return fail("A bodyless callable requires its actual ready checked endpoint inventory.");
  if (node.kind === "GetAccessor" || node.kind === "SetAccessor") accessorBoundary(node);
  const signatures = checked.signatures.map(endpoint => {
    const signature = deps.signatureOf(endpoint.signature);
    if (signature.id !== endpoint.signature || endpoint.declaration !== checked.definition || endpoint.body !== null
      || signature.declaration !== checked.definition || signature.receiver !== null
      || signature.parameters.length !== node.parameters.nodes.length)
      return fail("The bodyless callable endpoint must retain its actual formal and receiver inventory.");
    return signature;
  });
  const parameters = node.parameters.nodes.map((parameter, index) => {
    let selected: SignatureParameter | null = null;
    for (const signature of signatures) {
      const candidate = signature.parameters[index];
      if (candidate === undefined)
        return fail("The bodyless callable endpoint must retain its actual formal and receiver inventory.");
      if (selected !== null && (selected.type !== candidate.type || selected.kind !== candidate.kind
        || selected.passing !== candidate.passing || selected.acceptsOmission !== candidate.acceptsOmission
        || selected.initializer !== candidate.initializer))
        return fail("Genuine endpoints disagree on the bodyless formal selection.");
      selected = candidate;
    }
    return formal(parameter, checked.definition, selected ?? fail("A formal has no selected endpoint slot."), read);
  });
  const common = { ...node, typeParameters: typeParameters(node.typeParameters, read), parameters: { ...node.parameters, nodes: parameters },
    type: read(node.type), fullSignature: read(node.fullSignature),
    tsonic: { definition: checked.definition, parameters: checked.parameters, signatures: checked.signatures,
      template: null, attributes: checked.attributes } };
  if (node.kind === "MethodSignature") return { ...common, kind: node.kind, name: propertyName(node.name),
    modifiers: declarationModifiers(node.modifiers), postfixToken: node.postfixToken === null ? null : { ...node.postfixToken, tsonic: null } };
  if (node.kind === "GetAccessor" || node.kind === "SetAccessor") return { ...common, kind: node.kind,
    name: propertyName(node.name), modifiers: declarationModifiers(node.modifiers),
    postfixToken: node.postfixToken === null ? null : { ...node.postfixToken, tsonic: null }, body: null, asteriskToken: null };
  return { ...common, kind: node.kind };
}

function indexDeclaration(node: Hir.IndexSignatureDeclaration<Checked>, readType: TypeReader): Hir.IndexSignatureDeclaration<TypedPhase> {
  const checked = node.tsonic;
  const parameter = node.parameters.nodes[0];
  if (checked.body !== null || checked.signatures.length !== 0 || node.parameters.nodes.length !== 1 || parameter === undefined
    || parameter.tsonic.parent !== checked.definition || parameter.tsonic.declaration.kind !== "definition"
    || parameter.tsonic.declaredType.kind !== "available" || parameter.tsonic.declaredType.value === null
    || parameter.name.kind !== "Identifier" || parameter.initializer !== null || parameter.tsonic.initializer !== null
    || parameter.questionToken !== null || parameter.dotDotDotToken !== null || node.type === null || node.typeParameters !== null
    || node.fullSignature !== null || node.type.tsonic.type.kind !== "available")
    return fail("An index declaration requires its actual single noncallable key formal and checked read type.");
  const key = parameter.tsonic.declaredType.value;
  const read = node.type.tsonic.type.value;
  const typed: Hir.ParameterDeclaration<TypedPhase> = { ...parameter, name: declarationName(parameter.name, key),
    type: readType(parameter.type), modifiers: declarationModifiers(parameter.modifiers),
    initializer: null, questionToken: null, dotDotDotToken: null,
    tsonic: { declaration: parameter.tsonic.declaration.definition, local: null, storage: key,
      passing: null, initializer: null, role: "required" } };
  return { ...node, modifiers: declarationModifiers(node.modifiers), typeParameters: null,
    parameters: { ...node.parameters, nodes: [typed] }, type: readType(node.type), fullSignature: null,
    tsonic: { definition: checked.definition, key, read,
      write: node.modifiers?.nodes.some(modifier => modifier.kind === "ReadonlyKeyword") === true ? null : read } };
}

function typeElement(deps: ElaborateDeps, member: Hir.TypeElement<Checked>, read: TypeReader): Hir.TypeElement<TypedPhase> {
    if (member.kind === "PropertySignature") {
      const phase = member.tsonic;
      if (phase.declaration.kind !== "definition" || phase.declaredType.kind !== "available" || phase.declaredType.value === null
        || phase.initializer !== null || member.initializer !== null)
        return fail("A property declaration requires its actual ready storage type and initializer boundary.");
      return { ...member, name: propertyName(member.name), type: read(member.type), initializer: null,
        modifiers: declarationModifiers(member.modifiers), postfixToken: member.postfixToken === null ? null : { ...member.postfixToken, tsonic: null },
        tsonic: { definition: phase.declaration.definition, storage: phase.declaredType.value, initializer: null, attributes: phase.attributes } };
    }
    if (member.kind === "CallSignature" || member.kind === "ConstructSignature" || member.kind === "MethodSignature"
      || member.kind === "GetAccessor" || member.kind === "SetAccessor") return callable(deps, member, read);
    if (member.kind === "IndexSignature") return indexDeclaration(member, read);
    return fail(`The ${member.kind} declaration requires its actual typed key and passing producer.`);
}

export function declarationInterface(deps: ElaborateDeps, node: Hir.InterfaceDeclaration<Checked>): Hir.InterfaceDeclaration<TypedPhase> {
  if (node.heritageClauses !== null) return fail("Interface heritage requires its actual selected declared type projection.");
  const checked = node.tsonic;
  const type = internType(deps.types, { kind: "declared", definition: checked.definition, facet: "instance", extent: null,
    arguments: checked.parameters.map(parameter => internType(deps.types, { kind: "param", parameter: parameter.declaration })) });
  const read: TypeReader = annotation => declarationType(deps, annotation);
  const members = node.members.nodes.map(member => typeElement(deps, member, read));
  return { ...node, name: declarationName(node.name, null), modifiers: declarationModifiers(node.modifiers),
    typeParameters: typeParameters(node.typeParameters, read), heritageClauses: null, members: { ...node.members, nodes: members },
    tsonic: { definition: checked.definition, parameters: checked.parameters, type, members: checked.members } };
}

export function declarationAlias(deps: ElaborateDeps, node: Hir.TypeAliasDeclaration<Checked>): Hir.TypeAliasDeclaration<TypedPhase> {
  if (node.tsonic.type.kind !== "available") return fail("A type alias requires its actual checked type or original error.");
  return { ...node, name: declarationName(node.name, null), modifiers: declarationModifiers(node.modifiers),
    typeParameters: typeParameters(node.typeParameters, annotation => declarationType(deps, annotation)), type: declarationType(deps, node.type)
      ?? fail("A type alias has its genuine authored type annotation."),
    tsonic: { definition: node.tsonic.definition, parameters: node.tsonic.parameters, type: node.tsonic.type.value } };
}
