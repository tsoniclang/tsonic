import type { AstReader, Node } from "@tsonic/tsts";
import { sourceTypeDescriptorStructure, sourceTypeDescriptorUnion, type SourceTypeDescriptorUnions } from "./terms.js";
import type { SourceTypeDescriptor } from "./types.js";

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
      const index = binders.findIndex(binder => ast.text(ast.name(binder)) === text);
      if (index >= 0) return index;
    }
  }
  return undefined;
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
