import type { CheckedSourceProgram, Node, Symbol, Type } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputTypeFacts, SourceInputMemberUse, SourceInputMemberUseArm,
  SourceInputMemberUseSelection } from "@tsonic/target-api/host";
import type { SourceInputIdentityOwner } from "./identity-owner.js";
import type { SourceIndexSelection } from "@tsonic/target-api/source";
import { createSourceInputMemberPublisher, sourceCheckedMember } from "./member-components.js";

export function createSourceMemberUseInput(input: {
  readonly checked: CheckedSourceProgram;
  readonly identities: SourceInputIdentityOwner;
  readonly assertNode: (node: Node) => void;
  readonly syntax: (node: Node) => SourceInputComponent;
  readonly describe: (component: SourceInputComponent) => SourceInputTypeFacts;
}): (occurrence: Node) => SourceInputMemberUseSelection {
  const { checked, identities, assertNode, syntax, describe } = input;
  const { ast } = checked;
  const retained = new WeakMap<Node, SourceInputMemberUseSelection>();
  const unavailable = (reason: Extract<SourceInputMemberUseSelection, { readonly kind: "unavailable" }>["reason"]):
    SourceInputMemberUseSelection => Object.freeze({ kind: "unavailable", reason });
  return occurrence => {
    assertNode(occurrence);
    const existing = retained.get(occurrence);
    if (existing !== undefined) return existing;
    const file = ast.getSourceFile(occurrence);
    if (file === undefined) throw new Error("A member use requires its original checked source file.");
    const queries = checked.getSourceFileQueries(file);
    const { checker, typeShape: types } = queries;
    const selected = ast.is.IsPropertyAccessExpression(occurrence) ? checker.getResolvedPropertyAccessInfo(occurrence)
      : ast.is.IsElementAccessExpression(occurrence) ? checker.getResolvedElementAccessInfo(occurrence) : undefined;
    if (selected === undefined) return unavailable("not-a-member-use");
    if (selected.expression !== occurrence) throw new Error("Member selection must retain its exact original occurrence.");
    assertNode(selected.receiver.expression);
    const originalReceiver = syntax(selected.receiver.expression);
    identities.assertComponent(originalReceiver);
    const receiver = identities.component(originalReceiver.root, originalReceiver.path, selected.receiver.type);
    const roots = new Set<Symbol>(selected.selectedSymbol === undefined ? [] : [selected.selectedSymbol,
      ...checker.getRootSymbols(selected.selectedSymbol).filter((symbol): symbol is Symbol => symbol !== undefined)]);
    const allTypes = types.isUnion(selected.receiver.type) ? types.getUnionOrIntersectionTypes(selected.receiver.type) : [selected.receiver.type];
    if (allTypes.some(type => type === undefined)) return unavailable("missing-selected-member");
    const publish = createSourceInputMemberPublisher({ ast, checker, types, identities, assertNode });
    const arms: SourceInputMemberUseArm[] = [];
    const selectedDeclarations = new Set<Node>();
    const readDeclarations = new Set<Node>();
    const writeDeclarations = new Set<Node>();
    for (let index = 0; index < allTypes.length; index += 1) {
      const type: Type = allTypes[index]!;
      if (types.isNullish(type)) continue;
      const arm = allTypes.length === 1 ? receiver : identities.component(receiver.root,
        [...receiver.path, { kind: "union-member", index }], type);
      const properties = types.getPropertyInfos(type).filter(property =>
        [property.symbol, ...property.rootSymbols].some(symbol => roots.has(symbol)));
      if (properties.length === 0 && "argument" in selected) {
        const indexed = types.selectIndexedAccess(type, selected.argument.type);
        if (indexed?.kind !== "resolved" || indexed.members.length === 0) return unavailable("missing-selected-member");
        const indexes = indexed.members.filter(member => member.kind === "index");
        const declarations = Object.freeze([...new Set(indexes.flatMap(member => member.index.declaration === undefined
          ? member.index.components.filter((declaration): declaration is Node => declaration !== undefined) : [member.index.declaration]))]);
        for (const declaration of declarations) assertNode(declaration);
        const readonly = indexed.members.some(member => member.kind === "index" ? member.index.readonly : member.property.readonly);
        const tupleIndex = selected.selectedElementIndex;
        const receiverFacts = describe(arm);
        const selection: SourceIndexSelection = receiverFacts.kind === "tuple" && tupleIndex !== undefined
          ? Object.freeze({ kind: "tuple-element", index: tupleIndex, declarations })
          : receiverFacts.kind === "array" ? Object.freeze({ kind: "array-element", declarations })
          : receiverFacts.kind === "scalar" && receiverFacts.scalar === "string" ? Object.freeze({ kind: "string-character", declarations })
          : Object.freeze({ kind: "index-signature", declarations });
        if (selection.kind === "index-signature" && declarations.length === 0) return unavailable("inconsistent-original-origins");
        const part = selection.kind === "tuple-element" ? { kind: "tuple-element" as const, index: selection.index }
          : selection.kind === "array-element" || selection.kind === "string-character" ? { kind: "element" as const }
          : declarations.length === 1 ? { kind: "index-value" as const, declaration: declarations[0]! } : undefined;
        if (part === undefined) return unavailable("inconsistent-original-origins");
        const read = selected.accessMode === "read" || selected.accessMode === "read-write"
          ? identities.component(arm.root, [...arm.path, part], indexed.readType) : undefined;
        const write = selected.accessMode === "write" || selected.accessMode === "read-write"
          ? identities.component(arm.root, [...arm.path, part], indexed.writeType) : undefined;
        arms.push(Object.freeze({ kind: "index", receiver: arm, selection, readonly,
          key: syntax(selected.argument.expression), read, write }));
        for (const declaration of declarations) {
          selectedDeclarations.add(declaration);
          if (read !== undefined) readDeclarations.add(declaration);
          if (write !== undefined) writeDeclarations.add(declaration);
        }
        continue;
      }
      if (properties.length !== 1) return unavailable("inconsistent-original-origins");
      const member = publish(arm, sourceCheckedMember(ast, checker, properties[0]!, type));
      if (member === undefined || member.declarations.length === 0) return unavailable("inconsistent-original-origins");
      const reads = Object.freeze(member.declarations.filter(declaration => !ast.is.IsSetAccessorDeclaration(declaration)));
      const writes = Object.freeze(member.declarations.filter(declaration => !ast.is.IsGetAccessorDeclaration(declaration)));
      for (const declaration of member.declarations) selectedDeclarations.add(declaration);
      if (selected.accessMode === "read" || selected.accessMode === "read-write") for (const declaration of reads) readDeclarations.add(declaration);
      if (selected.accessMode === "write" || selected.accessMode === "read-write") for (const declaration of writes) writeDeclarations.add(declaration);
      arms.push(Object.freeze({ kind: "member", member, readDeclarations: reads, writeDeclarations: writes }));
    }
    if (arms.length === 0 || selected.selectedDeclaration !== undefined && !selectedDeclarations.has(selected.selectedDeclaration))
      return unavailable("inconsistent-original-origins");
    const read = selected.accessMode === "read" || selected.accessMode === "read-write"
      ? identities.component(occurrence, [], selected.sourceReadType) : undefined;
    const write = selected.accessMode === "write" || selected.accessMode === "read-write"
      ? identities.component(occurrence, [], selected.sourceWriteType) : undefined;
    const result: SourceInputMemberUse = Object.freeze({ kind: "member", occurrence,
      receiver: Object.freeze({ occurrence: selected.receiver.expression, value: originalReceiver }),
      access: selected.accessMode, callCallee: selected.callCallee, optionalChain: selected.optionalChain,
      selectedDeclarations: Object.freeze([...selectedDeclarations]), readDeclarations: Object.freeze([...readDeclarations]),
      writeDeclarations: Object.freeze([...writeDeclarations]), read, write, arms: Object.freeze(arms) });
    retained.set(occurrence, result);
    return result;
  };
}
