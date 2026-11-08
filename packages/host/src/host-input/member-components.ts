import type { AstReader, Node, Type, TypeCheckerQueries, TypePropertyInfo, TypeShapeQueries } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputComponentPart, SourceInputCorrespondenceMember } from "@tsonic/target-api/host";
import type { SourceLiteralKey } from "@tsonic/target-api/source";
import type { SourceInputIdentityOwner } from "./identity-owner.js";

export interface SourceStructuralMember {
  readonly receiverType: Type;
  readonly property: TypePropertyInfo;
  readonly declarations: readonly Node[];
  readonly getters: readonly Node[];
  readonly setters: readonly Node[];
  readonly read: "property" | "accessor" | "method" | "unavailable";
  readonly key: SourceLiteralKey | undefined;
}

export function sourceCheckedMember(ast: AstReader, checker: TypeCheckerQueries,
  property: TypePropertyInfo, receiverType: Type): SourceStructuralMember {
  const symbols = [property.symbol, ...property.rootSymbols];
  const declarations = Object.freeze([...new Set(symbols.flatMap(symbol => checker.getSymbolDeclarations(symbol))
    .filter((node): node is Node => node !== undefined))]);
  const getters = Object.freeze(declarations.filter(ast.is.IsGetAccessorDeclaration));
  const setters = Object.freeze(declarations.filter(ast.is.IsSetAccessorDeclaration));
  let key: SourceLiteralKey | undefined = Object.freeze({ kind: "name", name: property.name });
  for (const declaration of declarations) {
    const name = ast.name(declaration);
    if (name === undefined || !ast.is.IsComputedPropertyName(name)) continue;
    const selected = checker.getEffectivePropertyName(name);
    if (selected?.kind !== "unique-symbol") continue;
    const known = checker.getResolvedWellKnownSymbolInfo(name);
    const origin = known?.wellKnownDeclaration ?? checker.getPrimarySymbolDeclaration(checker.getTypeSymbol(selected.type));
    if (origin === undefined || key?.kind === "symbol" && key.declaration !== origin) {
      key = undefined;
      break;
    }
    key = Object.freeze({ kind: "symbol", declaration: origin });
  }
  return Object.freeze({ receiverType,
    property: Object.freeze({ ...property, rootSymbols: Object.freeze([...property.rootSymbols]) }),
    declarations, getters, setters, key,
    read: getters.length > 0 ? "accessor" : setters.length > 0 ? "unavailable"
      : declarations.some(node => ast.is.IsMethodDeclaration(node) || ast.is.IsMethodSignatureDeclaration(node)) ? "method" : "property" });
}

export function createSourceInputMemberPublisher(input: {
  readonly ast: AstReader;
  readonly checker: TypeCheckerQueries;
  readonly types: TypeShapeQueries;
  readonly identities: SourceInputIdentityOwner;
  readonly assertNode: (node: Node) => void;
}): (receiver: SourceInputComponent, selected: SourceStructuralMember) => SourceInputCorrespondenceMember | undefined {
  const { ast, checker, types, identities, assertNode } = input;
  const members = new WeakMap<SourceInputComponent, WeakMap<SourceStructuralMember, SourceInputCorrespondenceMember>>();
  const signaturePart = (receiver: SourceInputComponent, declaration: Node,
    role: "read" | "write"): SourceInputComponentPart | undefined => {
    const selected = types.getDeclarationSignatureInfo(declaration);
    if (selected === undefined) return undefined;
    const parameters = ast.typeParameters(declaration).filter((node): node is Node => node !== undefined);
    const signature = identities.signature(receiver.root, "call", selected.signature, declaration, parameters);
    return role === "read" ? Object.freeze({ kind: "result", signature })
      : Object.freeze({ kind: "parameter", signature, index: 0 });
  };
  return (receiver, selected) => {
    identities.assertComponent(receiver);
    let byMember = members.get(receiver);
    const existing = byMember?.get(selected);
    if (existing !== undefined) return existing;
    if (selected.key === undefined) return undefined;
    if (selected.key.kind === "symbol") assertNode(selected.key.declaration);
    for (const declaration of selected.declarations) assertNode(declaration);
    const primary = checker.getPrimarySymbolDeclaration(selected.property.symbol);
    const ordinary = primary !== undefined && selected.declarations.includes(primary) ? primary
      : selected.declarations.length === 1 ? selected.declarations[0] : undefined;
    const readDeclaration = selected.read === "accessor"
      ? selected.getters.length === 1 ? selected.getters[0] : undefined : ordinary;
    const writeDeclaration = selected.setters.length > 0
      ? selected.setters.length === 1 ? selected.setters[0] : undefined
      : selected.getters.length === 0 ? ordinary : undefined;
    let read: SourceInputComponent | undefined;
    let write: SourceInputComponent | undefined;
    if (selected.read !== "unavailable") {
      if (readDeclaration === undefined) return undefined;
      const part = selected.read === "accessor" ? signaturePart(receiver, readDeclaration, "read") : undefined;
      if (selected.read === "accessor" && part === undefined) return undefined;
      read = identities.component(receiver.root, [...receiver.path,
        { kind: "member", declaration: readDeclaration, access: "read" }, ...(part === undefined ? [] : [part])], selected.property.type);
    }
    if (!selected.property.readonly && writeDeclaration !== undefined) {
      const terminal = checker.getWriteTypeOfSymbol(selected.property.symbol);
      if (terminal === undefined) return undefined;
      const part = selected.setters.length > 0 ? signaturePart(receiver, writeDeclaration, "write") : undefined;
      if (selected.setters.length > 0 && part === undefined) return undefined;
      write = identities.component(receiver.root, [...receiver.path,
        { kind: "member", declaration: writeDeclaration, access: "write" }, ...(part === undefined ? [] : [part])], terminal);
    }
    const result: SourceInputCorrespondenceMember = Object.freeze({ receiver, key: selected.key, name: selected.property.name,
      declarations: selected.declarations, getters: selected.getters, setters: selected.setters,
      optional: selected.property.optional, readonly: selected.property.readonly,
      readKind: selected.read, read, write });
    if (byMember === undefined) { byMember = new WeakMap(); members.set(receiver, byMember); }
    byMember.set(selected, result);
    return result;
  };
}
