import {
  throwInvariant,
} from "../diag/index.js";
import type {
  AsteriskToken, Block, BlockOrExpression, ClassDeclaration, ClassElement, ClassExpression,
  ClassStaticBlockDeclaration, ConstructorDeclaration, DeclarationStructureReceipt, DeclarationStructureSyntax,
  EnumDeclaration, EnumMember, ExclamationToken, Expression, ExpressionWithTypeArguments, GetAccessorDeclaration,
  HeritageClause, Identifier, InterfaceDeclaration, MethodDeclaration, MethodSignatureDeclaration, ModifierLike,
  Phase, PropertyDeclaration, PropertyName, PropertySignatureDeclaration, QuestionToken, SetAccessorDeclaration,
  Statement, SyntaxChildListField, SyntaxChildSlot, SyntaxCopyResult, SyntaxNode, TypeAliasDeclaration,
  TypeElement, TypeNode, TypeParameterDeclaration,
} from "./contract.js";
import {
  missingStructure, children, heldChild, heldList, heldOptionalList, prependSlots,
} from "./child-slot-storage.js";
import {
  prepareSignatureStructure,
} from "./type-slots.js";

export function isDeclarationStructure<P extends Phase>(node: SyntaxNode<P>): node is DeclarationStructureSyntax<P> {
  switch (node.kind) {
    case "ClassDeclaration": case "ClassExpression": case "InterfaceDeclaration": case "HeritageClause":
    case "TypeAliasDeclaration": case "JSTypeAliasDeclaration": case "EnumDeclaration": case "EnumMember":
    case "ModuleBlock": case "MissingDeclaration": case "CallSignature": case "ConstructSignature": case "Constructor":
    case "GetAccessor": case "SetAccessor": case "IndexSignature": case "MethodSignature": case "MethodDeclaration":
    case "PropertySignature": case "PropertyDeclaration": case "ClassStaticBlockDeclaration": case "JSDocSignature": return true;
    default: return false;
  }
}

type ClassSyntax<P extends Phase> = ClassDeclaration<P> | ClassExpression<P>;

export function* declarationSlots<P extends Phase>(modifiers: () => Iterable<SyntaxChildSlot<P>>,
  name: () => Iterable<SyntaxChildSlot<P>>, ...rest: readonly (() => Iterable<SyntaxChildSlot<P>>)[]): Generator<SyntaxChildSlot<P>> {
  yield* modifiers();
  yield* name();
  for (const slots of rest) yield* slots();
}

export function classNameSlots<P extends Phase>(name: () => Identifier<P> | null) {
  return children<P, ClassSyntax<P>>(["name", "nullable", name]);
}

export function declarationNameSlots<P extends Phase>(name: () => Identifier<P>) {
  return children<P, InterfaceDeclaration<P> | TypeAliasDeclaration<P> | EnumDeclaration<P>>(["name", "required", name]);
}

export function aliasTypeSlots<P extends Phase>(type: () => TypeNode<P>) {
  return children<P, TypeAliasDeclaration<P>>(["type", "required", type]);
}

export function enumMemberSlots<P extends Phase>(name: () => PropertyName<P>, postfix: () => QuestionToken<P> | ExclamationToken<P> | null,
  initializer: () => Expression<P> | null) {
  return children<P, EnumMember<P>>(["name", "required", name], ["postfixToken", "nullable", postfix], ["initializer", "nullable", initializer]);
}

type MethodSyntax<P extends Phase> = MethodDeclaration<P> | GetAccessorDeclaration<P> | SetAccessorDeclaration<P>;
type NamedMemberSyntax<P extends Phase> = MethodSyntax<P> | MethodSignatureDeclaration<P> | PropertyDeclaration<P> | PropertySignatureDeclaration<P>;

export function memberNameSlots<P extends Phase>(name: () => PropertyName<P>, postfix: () => QuestionToken<P> | ExclamationToken<P> | null) {
  return children<P, NamedMemberSyntax<P>>(["name", "required", name], ["postfixToken", "nullable", postfix]);
}

export function memberAsteriskSlots<P extends Phase>(asterisk: () => AsteriskToken<P> | null) {
  return children<P, MethodSyntax<P> | ConstructorDeclaration<P>>(["asteriskToken", "nullable", asterisk]);
}

export function memberBodySlots<P extends Phase>(body: () => BlockOrExpression<P> | null) {
  return children<P, MethodSyntax<P> | ConstructorDeclaration<P>>(["body", "nullable", body]);
}

export function propertyMemberSlots<P extends Phase>(type: () => TypeNode<P> | null, initializer: () => Expression<P> | null) {
  return children<P, PropertyDeclaration<P> | PropertySignatureDeclaration<P>>(["type", "nullable", type], ["initializer", "nullable", initializer]);
}

export function staticBlockSlots<P extends Phase>(body: () => Block<P>) {
  return children<P, ClassStaticBlockDeclaration<P>>(["body", "required", body]);
}

export function prepareDeclaration<P extends Phase, Stop>(node: DeclarationStructureSyntax<P>, ordinal: number,
  admitList: (field: SyntaxChildListField) => Stop | null): SyntaxCopyResult<DeclarationStructureReceipt<P>, Stop> {
  switch (node.kind) {
    case "ModuleBlock": {
      const stop = admitList("statements");
      if (stop !== null) return { kind: "refused", stop };
      const statements = heldList<P, Statement<P>>("statements", () => node.statements);
      return { kind: "copied", value: { kind: "module-block", ordinal, slots: statements.slots(), statements: statements.finish } };
    }
    case "HeritageClause": {
      const stop = admitList("types");
      if (stop !== null) return { kind: "refused", stop };
      const types = heldList<P, ExpressionWithTypeArguments<P>>("types", () => node.types);
      return { kind: "copied", value: { kind: "heritage", ordinal, slots: types.slots(), types: types.finish } };
    }
    case "CallSignature": case "ConstructSignature": case "JSDocSignature": {
      const signature = prepareSignatureStructure<P, Stop>(node, admitList);
      return signature.kind === "refused" ? signature : { kind: "copied", value: { kind: "bare-signature", ordinal, ...signature.value } };
    }
  }
  const rawModifiers = node.modifiers;
  if (rawModifiers !== null) {
    const stop = admitList("modifiers");
    if (stop !== null) return { kind: "refused", stop };
  }
  const modifiers = heldOptionalList<P, ModifierLike<P>>("modifiers", rawModifiers);
  if (node.kind === "IndexSignature" || node.kind === "Constructor" || node.kind === "MethodSignature" ||
    node.kind === "MethodDeclaration" || node.kind === "GetAccessor" || node.kind === "SetAccessor") {
    const signature = prepareSignatureStructure<P, Stop>(node, admitList);
    if (signature.kind === "refused") return signature;
    if (node.kind === "IndexSignature") return { kind: "copied", value: { kind: "modified-signature", ordinal,
      ...signature.value, modifiers: modifiers.finish, slots: prependSlots<P>(modifiers.slots(), signature.value.slots) } };
    if (node.kind === "Constructor") {
      const asterisk = heldChild(() => node.asteriskToken);
      const body = heldChild(() => node.body);
      return { kind: "copied", value: { kind: "constructor", ordinal, ...signature.value, modifiers: modifiers.finish,
        slots: declarationSlots<P>(modifiers.slots, () => signature.value.slots, () => memberAsteriskSlots<P>(asterisk.pull), () => memberBodySlots<P>(body.pull)),
        asterisk: asterisk.read, body: body.read } };
    }
    const name = heldChild(() => node.name);
    const postfix = heldChild(() => node.postfixToken);
    const member = () => memberNameSlots<P>(name.pull, postfix.pull);
    if (node.kind === "MethodSignature") return { kind: "copied", value: { kind: "method-signature", ordinal,
      ...signature.value, modifiers: modifiers.finish, slots: declarationSlots<P>(modifiers.slots, member, () => signature.value.slots),
      name: name.read, postfix: postfix.read } };
    const asterisk = heldChild(() => node.asteriskToken);
    const body = heldChild(() => node.body);
    return { kind: "copied", value: { kind: "method", ordinal, ...signature.value, modifiers: modifiers.finish,
      slots: declarationSlots<P>(modifiers.slots, () => memberAsteriskSlots<P>(asterisk.pull), member, () => signature.value.slots, () => memberBodySlots<P>(body.pull)),
      name: name.read, postfix: postfix.read, asterisk: asterisk.read, body: body.read } };
  }
  if (node.kind === "PropertySignature" || node.kind === "PropertyDeclaration") {
    const name = heldChild(() => node.name);
    const postfix = heldChild(() => node.postfixToken);
    const type = heldChild(() => node.type);
    const initializer = heldChild(() => node.initializer);
    return { kind: "copied", value: { kind: "property-member", ordinal, modifiers: modifiers.finish,
      slots: declarationSlots<P>(modifiers.slots, () => memberNameSlots<P>(name.pull, postfix.pull), () => propertyMemberSlots<P>(type.pull, initializer.pull)),
      name: name.read, postfix: postfix.read, type: type.read, initializer: initializer.read } };
  }
  if (node.kind === "ClassStaticBlockDeclaration") {
    const body = heldChild(() => node.body);
    return { kind: "copied", value: { kind: "static-block", ordinal, modifiers: modifiers.finish,
      slots: prependSlots<P>(modifiers.slots(), staticBlockSlots<P>(body.pull)), body: body.read } };
  }
  if (node.kind === "MissingDeclaration")
    return { kind: "copied", value: { kind: "missing-declaration", ordinal, slots: modifiers.slots(), modifiers: modifiers.finish } };
  if (node.kind === "EnumMember") {
    const name = heldChild(() => node.name);
    const postfix = heldChild(() => node.postfixToken);
    const initializer = heldChild(() => node.initializer);
    return { kind: "copied", value: { kind: "enum-member", ordinal,
      slots: declarationSlots<P>(modifiers.slots, () => enumMemberSlots<P>(name.pull, postfix.pull, initializer.pull)),
      modifiers: modifiers.finish, name: name.read, postfix: postfix.read, initializer: initializer.read } };
  }
  if (node.kind === "EnumDeclaration") {
    const stop = admitList("members");
    if (stop !== null) return { kind: "refused", stop };
    const name = heldChild(() => node.name);
    const members = heldList<P, EnumMember<P>>("members", () => node.members);
    return { kind: "copied", value: { kind: "enum", ordinal,
      slots: declarationSlots<P>(modifiers.slots, () => declarationNameSlots<P>(name.pull), members.slots),
      modifiers: modifiers.finish, name: name.read, members: members.finish } };
  }
  const rawParameters = node.typeParameters;
  if (rawParameters !== null) {
    const stop = admitList("typeParameters");
    if (stop !== null) return { kind: "refused", stop };
  }
  const typeParameters = heldOptionalList<P, TypeParameterDeclaration<P>>("typeParameters", rawParameters);
  const common = { ordinal, modifiers: modifiers.finish, typeParameters: typeParameters.finish };
  if (node.kind === "TypeAliasDeclaration" || node.kind === "JSTypeAliasDeclaration") {
    const name = heldChild(() => node.name);
    const type = heldChild(() => node.type);
    return { kind: "copied", value: { ...common, kind: "type-alias",
      slots: declarationSlots<P>(modifiers.slots, () => declarationNameSlots<P>(name.pull), typeParameters.slots, () => aliasTypeSlots<P>(type.pull)),
      name: name.read, type: type.read } };
  }
  if (node.kind !== "ClassDeclaration" && node.kind !== "ClassExpression" && node.kind !== "InterfaceDeclaration")
    return throwInvariant(missingStructure);
  const rawHeritage = node.heritageClauses;
  if (rawHeritage !== null) {
    const stop = admitList("heritageClauses");
    if (stop !== null) return { kind: "refused", stop };
  }
  const stop = admitList("members");
  if (stop !== null) return { kind: "refused", stop };
  const heritage = heldOptionalList<P, HeritageClause<P>>("heritageClauses", rawHeritage);
  const aggregate = { ...common, heritageClauses: heritage.finish };
  if (node.kind === "InterfaceDeclaration") {
    const name = heldChild(() => node.name);
    const members = heldList<P, TypeElement<P>>("members", () => node.members);
    return { kind: "copied", value: { ...aggregate, kind: "interface",
      slots: declarationSlots<P>(modifiers.slots, () => declarationNameSlots<P>(name.pull), typeParameters.slots, heritage.slots, members.slots),
      name: name.read, members: members.finish } };
  }
  const name = heldChild(() => node.name);
  const members = heldList<P, ClassElement<P>>("members", () => node.members);
  return { kind: "copied", value: { ...aggregate, kind: "class",
    slots: declarationSlots<P>(modifiers.slots, () => classNameSlots<P>(name.pull), typeParameters.slots, heritage.slots, members.slots),
    name: name.read, members: members.finish } };
}
