import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceAwaitedArms } from "../../public/source/facts.js";
import { sourceTypeDescriptorsEqual, sourceTypeDescriptorStructure, sourceTypeDescriptorUnion, type SourceTypeDescriptorUnions } from "./terms.js";
import type { SourceProgramNavigation } from "../../source-navigation/types.js";
import type { SourceClosedSum, SourceSumIdentity, SourceTypeDescriptor } from "./types.js";

// Awaited payloads from declarations only (R3): no checker awaited type is read. A thenable declaration names its
// payload binder in its own `then` member: `then(onfulfilled?: ((value: T) => ...) | null)` makes `T` the payload.
// The rule is the one TypeScript's awaited type applies, restated over authored declaration syntax.

function unwrapTypeSyntax(ast: AstReader, type: Node | undefined): readonly Node[] {
  if (type === undefined) return [];
  if (ast.is.IsUnionTypeNode(type)) {
    return ast.children(type).flatMap(member => member === undefined ? [] : unwrapTypeSyntax(ast, member));
  }
  if (ast.kindName(type) === "KindParenthesizedType") return unwrapTypeSyntax(ast, ast.children(type)[0]);
  return [type];
}

/** The payload binder position of a thenable class or interface declaration; undefined when it is not thenable. */
export function sourceThenablePayloadBinder(ast: AstReader, declaration: Node): number | undefined {
  if (!(ast.is.IsInterfaceDeclaration(declaration) || ast.is.IsClassDeclaration(declaration))) return undefined;
  const binders = ast.typeParameters(declaration).filter((parameter): parameter is Node => parameter !== undefined);
  for (const member of ast.members(declaration)) {
    if (member === undefined || !(ast.is.IsMethodSignatureDeclaration(member) || ast.is.IsMethodDeclaration(member))) continue;
    const name = ast.name(member);
    if (name === undefined || ast.text(name) !== "then") continue;
    const callback = ast.parameters(member)[0];
    for (const arm of unwrapTypeSyntax(ast, callback === undefined ? undefined : ast.typeNode(callback))) {
      if (!ast.is.IsFunctionTypeNode(arm)) continue;
      const value = ast.parameters(arm)[0];
      const valueType = value === undefined ? undefined : ast.typeNode(value);
      if (valueType === undefined || !ast.is.IsTypeReferenceNode(valueType) || ast.typeArguments(valueType).length !== 0) continue;
      const reference = ast.children(valueType)[0];
      const text = reference === undefined ? undefined : ast.text(reference);
      // Lexical binder resolution (R6): a type parameter of the callback arm or of the `then` member with this name
      // shadows the declaration's binder, so the reference then names no declaration binder.
      const shadowed = [arm, member].some(owner => ast.typeParameters(owner).some(parameter =>
        parameter !== undefined && ast.text(ast.name(parameter)) === text));
      if (shadowed) continue;
      const index = binders.findIndex(binder => ast.text(ast.name(binder)) === text);
      if (index >= 0) return index;
    }
  }
  return undefined;
}

/**
 * The authored payload type argument of an async callable's return annotation (`Promise<T>` -> `T`, through
 * parentheses, parameterless aliases and nested thenables, as `await` unwraps): the type-argument node at the
 * thenable declaration's payload binder (sourceThenablePayloadBinder). Declaration and authored-syntax input only (R3).
 * undefined: the annotation is not a thenable reference (e.g. a union), or the reference names no declaration.
 */
export function sourceTypeFlowAuthoredAwaitedArgument(ast: AstReader, navigation: Pick<SourceProgramNavigation, "sourceReferenceFor">,
  annotation: Node): Node | undefined {
  const visited = new Set<Node>();
  let payload: Node | undefined;
  let node: Node | undefined = annotation;
  while (node !== undefined && !visited.has(node)) {
    visited.add(node);
    if (ast.is.IsParenthesizedTypeNode(node)) { node = ast.as.AsParenthesizedTypeNode(node)?.Type; continue; }
    if (!ast.is.IsTypeReferenceNode(node)) return payload;
    const declaration = navigation.sourceReferenceFor(ast.as.AsTypeReferenceNode(node)?.TypeName)?.declaration;
    if (declaration === undefined) return payload;
    const index = sourceThenablePayloadBinder(ast, declaration);
    if (index !== undefined) {
      const argument = ast.typeArguments(node)[index];
      if (argument === undefined) return undefined;
      payload = argument;
      node = argument;
      continue;
    }
    if (!ast.is.IsTypeAliasDeclaration(declaration) || ast.typeParameters(declaration).length !== 0) return payload;
    node = ast.typeNode(declaration);
  }
  return payload;
}

/**
 * The awaited payload of a value whose Host descriptor is `described`: a thenable arm contributes its payload binder's
 * argument, a non-thenable arm is its own payload, absence stays absence. undefined: an arm is a structural thenable
 * (a shape with a `then` member), whose payload has no declaration rule.
 */
export function sourceTypeDescriptorAwaitedPayload(ast: AstReader, unions: SourceTypeDescriptorUnions,
  described: SourceTypeDescriptor): SourceTypeDescriptor | undefined {
  const arms: SourceTypeDescriptor[] = [];
  let absent = false;
  const pending: SourceTypeDescriptor[] = [described];
  while (pending.length > 0) {
    const selected = pending.shift()!;
    if (selected.kind === "union") { pending.unshift(...selected.types); continue; }
    if (selected.kind === "optional") { absent = true; pending.unshift(selected.value); continue; }
    if (selected.kind === "intrinsic" && selected.intrinsic === "absence") { absent = true; continue; }
    arms.push(selected);
  }
  const payloads: SourceTypeDescriptor[] = [];
  for (const arm of arms) {
    if (arm.kind === "declared") {
      const index = sourceThenablePayloadBinder(ast, arm.declaration);
      if (index !== undefined) {
        const payload = arm.typeArguments[index];
        if (payload === undefined) return undefined;
        // A nested thenable payload (Promise<Promise<T>>) is awaited recursively, as `await` does.
        const nested = sourceTypeDescriptorAwaitedPayload(ast, unions, payload);
        if (nested === undefined) return undefined;
        payloads.push(nested);
        continue;
      }
    }
    const structure = sourceTypeDescriptorStructure(arm);
    if (structure.kind === "shape" && structure.members.some(member => member.name === "then")) return undefined;
    payloads.push(arm);
  }
  if (absent) payloads.push({ kind: "intrinsic", intrinsic: "absence" });
  if (payloads.length === 1 && !absent) return payloads[0];
  return sourceTypeDescriptorUnion(unions, payloads);
}

/**
 * The awaited-arm relation (public SourceAwaitedArms) of an awaited value whose operand Host descriptor is `operand` and
 * whose awaited Host result is `awaited`: for each present operand arm, its awaited payload (the declaration rule above)
 * and the awaited-sum arm each payload arm resolves to, by descriptor identity (absence resolves to the absence arm).
 * undefined when the awaited result is not a closed sum, or a payload has no declaration rule (a structural thenable,
 * which `values.awaited` refuses).
 */
export function sourceTypeFlowAwaitedArms(ast: AstReader, unions: SourceTypeDescriptorUnions,
  sumOf: (type: SourceTypeDescriptor) => SourceClosedSum | undefined, use: Node, operand: SourceTypeDescriptor,
  awaited: SourceTypeDescriptor): SourceAwaitedArms | undefined {
  const awaitedSum = sumOf(awaited);
  if (awaitedSum === undefined) return undefined;
  const absence = (type: SourceTypeDescriptor): boolean => type.kind === "intrinsic" && type.intrinsic === "absence";
  const awaitedArm = (type: SourceTypeDescriptor): number => {
    const index = absence(type) ? awaitedSum.arms.findIndex(arm => absence(arm.type))
      : awaitedSum.arms.findIndex(arm => sourceTypeDescriptorsEqual(arm.type, type));
    if (index < 0) throw new Error("An awaited payload arm must be an arm of the awaited Source sum.");
    return index;
  };
  const operandSum = sumOf(operand);
  const operandArms = operandSum === undefined ? [{ type: operand }] : operandSum.arms;
  const arms: { readonly arm: number; readonly payload?: SourceSumIdentity; readonly mapping: readonly number[] }[] = [];
  for (const [index, arm] of operandArms.entries()) {
    if (absence(arm.type)) continue;
    const payload = sourceTypeDescriptorAwaitedPayload(ast, unions, arm.type);
    if (payload === undefined) return undefined;
    const payloadSum = sumOf(payload);
    const mapping = payloadSum === undefined ? [awaitedArm(payload)] : payloadSum.arms.map(selected => awaitedArm(selected.type));
    arms.push(Object.freeze({ arm: index, ...(payloadSum === undefined ? {} : { payload: payloadSum.identity }),
      mapping: Object.freeze(mapping) }));
  }
  return Object.freeze({ use, ...(operandSum === undefined ? {} : { operand: operandSum.identity }), awaited: awaitedSum.identity,
    arms: Object.freeze(arms) });
}
