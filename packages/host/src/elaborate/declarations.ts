import type { Diagnostic, Result } from "../diag/contract.js";
import type { DefId, NodeId, TyId } from "../ids/contract.js";
import type * as Hir from "../ir-hir/contract.js";
import { iterateChildrenOfSyntax } from "../ir-hir/index.js";
import type { SignatureParameter, TypeInterner } from "../ir-types/contract.js";
import { admitTypePublicationStep, internType, internTypeGraph, readType, refuseTypeConstruction, viewTypes } from "../ir-types/index.js";
import type { DeclarationNameExpression, TypedPhase } from "../ir-tir/contract.js";
import type { ElaborateDeps } from "./contract.js";
import { throwInvariant } from "../diag/index.js";

type Checked = Hir.CheckedPhase;

function fail(message: string): never {
  return throwInvariant({ owner: "elaborate", query: null, origin: null, message });
}

function verifyNumericSingleton(types: TypeInterner, type: TyId, evidence: Hir.CheckedLiteral | Hir.CheckedUnary): void {
  if (evidence.role !== "type-literal" || evidence.type.kind !== "available" || evidence.type.value !== type || evidence.literal.kind !== "number")
    return fail("A numeric annotation requires its actual checked type-literal endpoint.");
  const checked = readType(types, type);
  if (checked.kind !== "literal" || checked.value.kind !== "number")
    return fail("A numeric annotation requires its exact selected singleton.");
  const value = evidence.literal.value;
  const actual = checked.value.value;
  if (value.numerator !== actual.numerator || value.denominator !== actual.denominator || value.negativeZero !== actual.negativeZero)
    return fail("A numeric annotation must agree with its exact selected singleton.");
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

interface DeclarationProjection {
  readonly typeOf: (node: Hir.TypeNode<Checked>) => Hir.TypeNode<TypedPhase>;
  readonly memberOf: (node: Hir.TypeElement<Checked>) => Hir.TypeElement<TypedPhase>;
}

function isTypeNode(node: Hir.SyntaxNode<Checked>): node is Hir.TypeNode<Checked> {
  return node.tsonic !== null && "referencedDefinitions" in node.tsonic;
}

function projectDeclaration<State>(deps: ElaborateDeps<State>, roots: readonly Hir.SyntaxNode<Checked>[]): Result<DeclarationProjection> {
  const completed = new Map<NodeId, Hir.TypeNode<TypedPhase>>();
  const members = new Map<NodeId, Hir.TypeElement<TypedPhase>>();
  const enter = (node: Hir.SyntaxNode<Checked>) => {
    if (node.kind === "GetAccessor" || node.kind === "SetAccessor") accessorBoundary(node);
    return { node, children: iterateChildrenOfSyntax(node) };
  };
  const pending: ReturnType<typeof enter>[] = [];
  let rootIndex = 0;
  const take = () => {
    const frame = pending.pop();
    if (frame !== undefined) return frame;
    const root = roots[rootIndex++];
    return root === undefined ? undefined : enter(root);
  };
  const child = (node: Hir.TypeNode<Checked>): Hir.TypeNode<TypedPhase> => completed.get(node.id)
    ?? fail("A declaration annotation requires its completed actual type child.");
  const memberOf = (node: Hir.TypeElement<Checked>): Hir.TypeElement<TypedPhase> => members.get(node.id)
    ?? fail("A declaration retains its actual completed typed member.");
  const read: TypeReader = node => node === null ? null : child(node);
  for (let frame = take(); frame !== undefined; frame = take()) {
    const node = frame.node;
    if (isTypeNode(node) && node.tsonic.type.kind === "unavailable") {
      if (node.tsonic.type.reason !== "checker-error")
        return fail("A declaration annotation requires its actual captured type or original error.");
      let diagnostics: [Diagnostic, ...Diagnostic[]] | null = null;
      for (const cause of node.tsonic.type.causes) {
        if (cause.kind !== "diagnostic" || cause.diagnostic.kind !== "checker")
          return fail("A failed annotation needs its actual original checker diagnostic identity.");
        const { module, index } = cause.diagnostic.diagnostic;
        const diagnostic = deps.checkerDiagnosticsOf(module)[index];
        if (diagnostic?.severity !== "error") return fail("A failed annotation must name its actual published checker error.");
        if (diagnostics === null) diagnostics = [diagnostic];
        else diagnostics.push(diagnostic);
      }
      return { kind: "refused", diagnostics: diagnostics ?? fail("A failed annotation needs at least one original cause.") };
    }
    const next = frame.children.next();
    if (!next.done) {
      pending.push(frame, enter(next.value));
      continue;
    }
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
      case "ParenthesizedType": case "OptionalType":
        result = { ...node, type: child(node.type), tsonic }; break;
      case "ArrayType": {
        const elementType = child(node.elementType);
        const selected = readType(deps.types, tsonic.type);
        if (selected.kind !== "declared" || selected.facet !== "instance" || selected.arguments.length !== 1
          || elementType.tsonic === null || !("type" in elementType.tsonic) || selected.arguments[0] !== elementType.tsonic.type)
          return fail("An array annotation requires its actual selected declaration and element type.");
        result = { ...node, elementType, tsonic };
        break;
      }
      case "TupleType":
        result = { ...node, tsonic, elements: { ...node.elements, nodes: node.elements.nodes.map(child) } }; break;
      case "ThisType":
        if (readType(deps.types, tsonic.type).kind !== "self")
          return fail("A declaration self type requires its actual checked owner.");
        result = { ...node, tsonic }; break;
      case "TypeOperator": {
        const operand = child(node.type);
        if (node.operator === "UniqueKeyword") {
          const selected = readType(deps.types, tsonic.type);
          if (node.type.kind !== "SymbolKeyword" || selected.kind !== "literal" || selected.value.kind !== "unique-symbol")
            return fail("A unique symbol annotation requires its actual declaration-owned singleton.");
          const base = readType(deps.types, selected.base);
          if (base.kind !== "intrinsic" || base.intrinsic !== "symbol")
            return fail("A unique symbol annotation requires its actual symbol base.");
        } else if (node.operator !== "KeyOfKeyword") {
          if (node.operator !== "ReadonlyKeyword" || operand.kind !== "TupleType" && operand.kind !== "ArrayType")
            return fail("A declaration type operator requires its actual supported typed operand.");
          if (operand.kind === "ArrayType") {
            if (operand.tsonic.type !== tsonic.type)
              return fail("A readonly array annotation requires its actual checked operand type.");
          } else {
            const selected = readType(deps.types, tsonic.type);
            if (selected.kind !== "tuple" || !selected.readonly)
              return fail("A readonly tuple annotation requires its actual selected readonly type.");
          }
        }
        result = { ...node, type: operand, tsonic };
        break;
      }
      case "IndexedAccessType":
        result = { ...node, objectType: child(node.objectType), indexType: child(node.indexType), tsonic }; break;
      case "ConditionalType":
        result = { ...node, checkType: child(node.checkType), extendsType: child(node.extendsType),
          trueType: child(node.trueType), falseType: child(node.falseType), tsonic }; break;
      case "InferType": {
        const typeParameter = declarationParameter(node.typeParameter, read);
        const selected = readType(deps.types, tsonic.type);
        if (selected.kind !== "param" || selected.parameter !== typeParameter.tsonic.parameter.declaration)
          return fail("An inference annotation requires its actual checked parameter type.");
        result = { ...node, typeParameter, tsonic };
        break;
      }
      case "TemplateLiteralTypeSpan": {
        const type = child(node.type);
        if (type.tsonic === null || !("type" in type.tsonic) || type.tsonic.type !== tsonic.type)
          return fail("A template type span needs its actual checked operand.");
        result = { ...node, type, literal: { ...node.literal, tsonic: null }, tsonic }; break;
      }
      case "TemplateLiteralType": {
        const selected = readType(deps.types, tsonic.type);
        const stringLiteral = (type: ReturnType<typeof readType>) => type.kind === "literal" && type.value.kind === "string";
        if (!stringLiteral(selected) && (selected.kind !== "union" || selected.members.length === 0
          || !selected.members.every(member => stringLiteral(readType(deps.types, member)))))
          return fail("A template type needs its actual finite checked string result.");
        result = { ...node, head: { ...node.head, tsonic: null },
          templateSpans: { ...node.templateSpans, nodes: node.templateSpans.nodes.map(span => {
          const selectedSpan = child(span);
          return selectedSpan.kind === "TemplateLiteralTypeSpan" ? selectedSpan : fail("A template type needs its actual typed span.");
        }) }, tsonic };
        break;
      }
      case "LiteralType": {
        const literal = node.literal;
        if (literal.kind === "PrefixUnaryExpression" && literal.operator === "MinusToken" && literal.operand.kind === "NumericLiteral") {
          verifyNumericSingleton(deps.types, tsonic.type, literal.tsonic);
          const operand = literal.operand;
          const endpoint = operand.tsonic;
          if (endpoint.role !== "type-literal" || endpoint.type.kind !== "available")
            return fail("A negative annotation requires its actual numeric operand.");
          const type = endpoint.type.value;
          verifyNumericSingleton(deps.types, type, endpoint);
          result = { ...node, tsonic, literal: { ...literal, tsonic: { role: "type-literal", type: tsonic.type },
            operand: { ...operand, tsonic: { role: "type-literal", type } } } };
          break;
        }
        if (literal.kind === "NumericLiteral") {
          verifyNumericSingleton(deps.types, tsonic.type, literal.tsonic);
          result = { ...node, tsonic, literal: { ...literal, tsonic: { role: "type-literal", type: tsonic.type } } };
          break;
        }
        if (literal.kind !== "NullKeyword" && literal.kind !== "TrueKeyword" && literal.kind !== "FalseKeyword"
          && literal.kind !== "StringLiteral" && literal.kind !== "NoSubstitutionTemplateLiteral")
          return fail("A literal annotation requires its actual supported typed token.");
        if (literal.tsonic.role !== "type-literal" || literal.tsonic.type.kind !== "available" || literal.tsonic.type.value !== tsonic.type)
          return fail("A literal annotation requires its actual checked literal and type.");
        const selected = readType(deps.types, tsonic.type);
        const value = literal.tsonic.literal;
        if (literal.kind === "NullKeyword") {
          if (value.kind !== "absence" || selected.kind !== "intrinsic" || selected.intrinsic !== "absence")
            return fail("A null annotation must retain the single native absence type.");
        } else {
          if (selected.kind !== "literal") return fail("A singleton annotation must retain its exact selected literal type.");
          const base = readType(deps.types, selected.base);
          if (literal.kind === "StringLiteral" || literal.kind === "NoSubstitutionTemplateLiteral") {
            if (value.kind !== "string" || selected.value.kind !== "string" || value.value !== literal.text
              || selected.value.value !== literal.text || base.kind !== "string")
              return fail("A string annotation must retain its actual checker payload and base.");
          } else {
            const expected = literal.kind === "TrueKeyword";
            if (value.kind !== "boolean" || selected.value.kind !== "boolean" || value.value !== expected
              || selected.value.value !== expected || base.kind !== "primitive" || base.primitive !== "bool")
              return fail("A Boolean annotation must retain its actual checker payload and base.");
          }
        }
        result = { ...node, tsonic, literal: { ...literal, tsonic: { role: "type-literal", type: tsonic.type } } };
        break;
      }
      case "TypeLiteral": result = { ...node,
        members: { ...node.members, nodes: node.members.nodes.map(memberOf) }, tsonic }; break;
      case "TypeReference": case "TypeQuery": {
        const checkedName = node.kind === "TypeReference" ? node.typeName : node.exprName;
        if (checkedName.kind !== "Identifier" || checkedName.tsonic.role !== "type-name")
          return fail("A declaration type requires its actual checked type-name projection.");
        const name: Hir.Identifier<TypedPhase> = { ...checkedName, tsonic: { role: "type-name", type: tsonic.type, declarations: tsonic.declarations } };
        if (node.kind === "TypeQuery") {
          if (node.typeArguments !== null) return fail("An applied type query requires its actual typed argument placement.");
          result = { ...node, exprName: name, typeArguments: null, tsonic };
        } else result = { ...node, typeName: name, typeArguments: node.typeArguments === null ? null
          : { ...node.typeArguments, nodes: node.typeArguments.nodes.map(child) }, tsonic };
        break;
      }
      default: return fail(`Declaration annotation ${node.kind} requires its actual typed projection.`);
    }
    completed.set(node.id, result);
  }
  return { kind: "ok", diagnostics: [], value: { typeOf: child, memberOf } };
}

export function declarationType<State>(deps: ElaborateDeps<State>, root: Hir.TypeNode<Checked> | null): Result<Hir.TypeNode<TypedPhase> | null> {
  if (root === null) return { kind: "ok", diagnostics: [], value: null };
  const projected = projectDeclaration(deps, [root]);
  return projected.kind === "refused" ? projected : { kind: "ok", diagnostics: [], value: projected.value.typeOf(root) };
}

function declarationParameter(node: Hir.TypeParameterDeclaration<Checked>, read: TypeReader): Hir.TypeParameterDeclaration<TypedPhase> {
  if (node.expression !== null) return fail("A type parameter expression requires its actual typed producer.");
  return { ...node, modifiers: declarationModifiers(node.modifiers), name: declarationName(node.name, null), expression: null,
    constraint: read(node.constraint), defaultType: read(node.defaultType),
    tsonic: { parameter: node.tsonic.parameter } };
}

function typeParameters(input: Hir.TypeParameterList<Checked> | null, read: TypeReader): Hir.TypeParameterList<TypedPhase> | null {
  return input === null ? null : { ...input, nodes: input.nodes.map(node => declarationParameter(node, read)) };
}

export function callableTypeHeader<State>(deps: ElaborateDeps<State>, node: Hir.FunctionDeclaration<Checked>):
  Result<Pick<Hir.FunctionDeclaration<TypedPhase>, "typeParameters" | "type" | "fullSignature">> {
  const roots: Hir.TypeNode<Checked>[] = [];
  if (node.typeParameters !== null) for (const parameter of node.typeParameters.nodes) {
    if (parameter.constraint !== null) roots.push(parameter.constraint);
    if (parameter.defaultType !== null) roots.push(parameter.defaultType);
  }
  if (node.type !== null) roots.push(node.type);
  if (node.fullSignature !== null) roots.push(node.fullSignature);
  const projected = projectDeclaration(deps, roots);
  if (projected.kind === "refused") return projected;
  const read: TypeReader = annotation => annotation === null ? null : projected.value.typeOf(annotation);
  return { kind: "ok", diagnostics: [], value: {
    typeParameters: typeParameters(node.typeParameters, read), type: read(node.type), fullSignature: read(node.fullSignature),
  } };
}

function propertyName(node: Hir.PropertyName<Checked>): Hir.PropertyName<TypedPhase> {
  if (node.kind === "Identifier") return declarationName(node, null);
  if ((node.kind === "StringLiteral" || node.kind === "NumericLiteral") && node.tsonic.role === "declaration-name")
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
      if (node.kind === "PropertyAccessExpression" || node.kind === "ParenthesizedExpression" || node.kind === "NonNullExpression")
        pending.push({ node: node.expression, build: false });
      if (node.kind === "CallExpression") {
        for (let index = node.arguments.nodes.length - 1; index >= 0; index--) {
          const argument = node.arguments.nodes[index];
          if (argument === undefined) return fail("A declaration-name call retains every actual written argument.");
          pending.push({ node: argument, build: false });
        }
        pending.push({ node: node.expression, build: false });
      }
      continue;
    }
    switch (node.kind) {
      case "Identifier": case "StringLiteral": case "NoSubstitutionTemplateLiteral": case "NumericLiteral":
        completed.set(node.id, { ...node, tsonic }); break;
      case "ParenthesizedExpression": case "NonNullExpression":
        completed.set(node.id, { ...node, expression: child(node.expression), tsonic }); break;
      case "PropertyAccessExpression":
        completed.set(node.id, { ...node, expression: child(node.expression), name: { ...node.name, tsonic },
          questionDotToken: node.questionDotToken === null ? null : { ...node.questionDotToken, tsonic: null }, tsonic }); break;
      case "CallExpression":
        if (node.tsonic.application.kind !== "unavailable" || node.tsonic.application.reason !== "not-provided"
          || node.tsonic.application.causes.length !== 0)
          return fail("A declaration-name call must not retain a selected or deferred invocation.");
        if (node.typeArguments !== null) return fail("Typed syntax inside a declaration-name call requires its nonexecuting projection.");
        completed.set(node.id, { ...node, expression: child(node.expression), typeArguments: null,
          questionDotToken: node.questionDotToken === null ? null : { ...node.questionDotToken, tsonic: null },
          arguments: { ...node.arguments, nodes: node.arguments.nodes.map(child) }, tsonic }); break;
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
    name: declarationName(node.name, parameter.type), type: read(node.type), initializer: { kind: "none" },
    tsonic: { declaration: checked.declaration.definition, local: null, storage: parameter.type, passing: parameter.passing,
      initializer: null, role: parameter.kind } };
}

function bodylessHeader<State>(deps: ElaborateDeps<State>, node: BodylessCallable | Hir.FunctionDeclaration<Checked>, read: TypeReader) {
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
  return { typeParameters: typeParameters(node.typeParameters, read), parameters: { ...node.parameters, nodes: parameters },
    type: read(node.type), fullSignature: read(node.fullSignature),
    tsonic: { definition: checked.definition, parameters: checked.parameters, signatures: checked.signatures,
      template: null, attributes: checked.attributes } };
}

function callable<State>(deps: ElaborateDeps<State>, node: BodylessCallable, read: TypeReader): TypedBodylessCallable {
  const common = { ...node, ...bodylessHeader(deps, node, read) };
  if (node.kind === "MethodSignature") return { ...common, kind: node.kind, name: propertyName(node.name),
    modifiers: declarationModifiers(node.modifiers), postfixToken: node.postfixToken === null ? null : { ...node.postfixToken, tsonic: null } };
  if (node.kind === "GetAccessor" || node.kind === "SetAccessor") return { ...common, kind: node.kind,
    name: propertyName(node.name), modifiers: declarationModifiers(node.modifiers),
    postfixToken: node.postfixToken === null ? null : { ...node.postfixToken, tsonic: null }, body: null, asteriskToken: null };
  return { ...common, kind: node.kind };
}

export function declarationFunction<State>(deps: ElaborateDeps<State>, node: Hir.FunctionDeclaration<Checked>): Result<Hir.FunctionDeclaration<TypedPhase> & { readonly body: null }> {
  if (node.body !== null || node.asteriskToken !== null) return fail("A bodyless function retains its actual nonexecuting declaration.");
  const projected = projectDeclaration(deps, [node]);
  if (projected.kind === "refused") return projected;
  return { kind: "ok", diagnostics: [], value: { ...node, ...bodylessHeader(deps, node, type => type === null ? null : projected.value.typeOf(type)),
    name: node.name === null ? null : declarationName(node.name, null), modifiers: declarationModifiers(node.modifiers),
    body: null, asteriskToken: null } };
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
    initializer: { kind: "none" }, questionToken: null, dotDotDotToken: null,
    tsonic: { declaration: parameter.tsonic.declaration.definition, local: null, storage: key,
      passing: null, initializer: null, role: "required" } };
  return { ...node, modifiers: declarationModifiers(node.modifiers), typeParameters: null,
    parameters: { ...node.parameters, nodes: [typed] }, type: readType(node.type), fullSignature: null,
    tsonic: { definition: checked.definition, key, read,
      write: node.modifiers?.nodes.some(modifier => modifier.kind === "ReadonlyKeyword") === true ? null : read } };
}

function typeElement<State>(deps: ElaborateDeps<State>, member: Hir.TypeElement<Checked>, read: TypeReader): Hir.TypeElement<TypedPhase> {
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

export function declarationInterface<State>(deps: ElaborateDeps<State>, node: Hir.InterfaceDeclaration<Checked>): Result<Hir.InterfaceDeclaration<TypedPhase>> {
  if (node.heritageClauses !== null) return fail("Interface heritage requires its actual selected declared type projection.");
  const projected = projectDeclaration(deps, [node]);
  if (projected.kind === "refused") return projected;
  const checked = node.tsonic;
  const unit = { query: "elaborate", key: checked.definition };
  const stop = admitTypePublicationStep(deps.typeWork, checked.parameters.length);
  if (stop !== null) return refuseTypeConstruction(deps.typeWork, stop, node.origin, unit);
  const arguments_ = checked.parameters.map(parameter => internType(deps.types, { kind: "param", parameter: parameter.declaration }));
  const table = viewTypes(deps.types);
  const result = internTypeGraph({ types: deps.types, work: deps.typeWork }, {
    typeBase: table.terms.length, signatureBase: table.signatures.length, signatures: [],
    terms: [{ kind: "declared", definition: checked.definition, facet: "instance", extent: null, arguments: arguments_ }],
  });
  if (result.kind !== "complete") return refuseTypeConstruction(deps.typeWork, result, node.origin, unit);
  const type = result.value.types[0];
  if (type === undefined) return fail("The admitted interface has one exact Types result.");
  const read: TypeReader = annotation => annotation === null ? null : projected.value.typeOf(annotation);
  return { kind: "ok", diagnostics: [], value: { ...node, name: declarationName(node.name, null), modifiers: declarationModifiers(node.modifiers),
    typeParameters: typeParameters(node.typeParameters, read), heritageClauses: null,
    members: { ...node.members, nodes: node.members.nodes.map(projected.value.memberOf) },
    tsonic: { definition: checked.definition, parameters: checked.parameters, type, members: checked.members } } };
}

export function declarationAlias<State>(deps: ElaborateDeps<State>, node: Hir.TypeAliasDeclaration<Checked>): Result<Hir.TypeAliasDeclaration<TypedPhase>> {
  const projected = projectDeclaration(deps, [node]);
  if (projected.kind === "refused") return projected;
  if (node.tsonic.type.kind !== "available") return fail("A type alias requires its actual checked type or original error.");
  return { kind: "ok", diagnostics: [], value: { ...node, name: declarationName(node.name, null), modifiers: declarationModifiers(node.modifiers),
    typeParameters: typeParameters(node.typeParameters, annotation => annotation === null ? null : projected.value.typeOf(annotation)),
    type: projected.value.typeOf(node.type),
    tsonic: { definition: node.tsonic.definition, parameters: node.tsonic.parameters, type: node.tsonic.type.value } } };
}
