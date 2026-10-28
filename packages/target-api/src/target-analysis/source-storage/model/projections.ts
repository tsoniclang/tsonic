import type { Node, SourceFile } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { IsTypeSyntaxNode, Node_Expression } from "../../../source-navigation/index.js";
import { sourceIndexedStorageProjection, sourcePresentStorageType, sourceStorageComponents, sourceStorageSubjectType, sourceStorageDynamicMemberKey } from "./components.js";
import type { SourceStorageProjection, SourceStorageSubject, SourceStorageSubjectQuery } from "./subjects.js";
import { sourceStorageIsDataMember, sourceStorageIsMethodMember, sourceStorageProjectionPath } from "./subjects.js";
import type { SourceBindingWriteValue } from "../../../source-navigation/types.js";

export interface SourceStorageWriteProjection {
  readonly subjects: readonly SourceStorageSubject[];
  readonly birth?: readonly {
    readonly origin: SourceStorageSubject;
    readonly destination: SourceStorageSubject;
  }[];
}

export function createSourceStorageProjectionFlow(
  source: TargetSourceProgram,
  step: () => boolean,
  subject: SourceStorageSubjectQuery,
  subjectFor: (node: Node | undefined) => SourceStorageSubject | undefined,
  locationFor: (node: Node | undefined) => SourceStorageSubject | undefined,
  connect: (origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined) => void,
  unresolved: (subject: SourceStorageSubject, reason: string) => void,
  sourceFileFor: (subject: SourceStorageSubject) => SourceFile | undefined,
) {
  const { ast, semantics } = source;
  const project = (owner: SourceStorageSubject | undefined, component: SourceStorageProjection):
    SourceStorageSubject | undefined => owner === undefined ? undefined
      : subject(owner.node, owner.kind, [...owner.projection, component]);
  const indexed = (node: Node, location = false): SourceStorageSubject | undefined => {
    const queries = semantics.forNode(node);
    const property = ast.is.IsPropertyAccessExpression(node) ? queries.operations.propertyAccess(node) : undefined;
    const element = ast.is.IsElementAccessExpression(node) ? queries.operations.elementAccess(node) : undefined;
    const access = property ?? element;
    const component = element === undefined ? undefined
      : sourceIndexedStorageProjection(element.receiver.type, element.argument.expression, queries, ast);
    const declaration = access?.selectedDeclaration;
    if (component === undefined && declaration !== undefined && (sourceStorageIsDataMember(declaration, ast) ||
      sourceStorageIsMethodMember(declaration, ast) || ast.is.IsGetAccessorDeclaration(declaration) || ast.is.IsSetAccessorDeclaration(declaration)))
      return subject(node);
    if (component === undefined && sourceStorageDynamicMemberKey(source, node) !== undefined)
      return subject(node);
    const value = component === undefined ? subject(node)
      : project((location ? locationFor : subjectFor)(access?.receiver.expression), component);
    if (value !== undefined && component === undefined)
      unresolved(value, "An indexed value has no exact checked storage component.");
    return value;
  };
  const patternComponent = (originalOwner: SourceStorageSubject, reference: Node): SourceStorageWriteProjection | undefined => {
    const pattern = ast.parent(reference);
    if (pattern === undefined) return undefined;
    const queries = semantics.forNode(reference);
    const binding = ast.is.IsBindingElement(reference) ? ast.as.AsBindingElement(reference) : undefined;
    const rawType = sourceStorageSubjectType(source, originalOwner, sourceFileFor(originalOwner));
    const ownerType = rawType === undefined ? undefined : sourcePresentStorageType(rawType, queries) ?? rawType;
    if (ast.is.IsObjectBindingPattern(pattern) && binding?.DotDotDotToken !== undefined) {
      const value = subject(reference);
      const resultType = value === undefined ? undefined : sourceStorageSubjectType(source, value, sourceFileFor(value));
      const members = ownerType === undefined || resultType === undefined ? undefined
        : queries.types.structuralMembers(ownerType, resultType, "read");
      if (value === undefined || members?.kind !== "available") return undefined;
      const birth: NonNullable<SourceStorageWriteProjection["birth"]>[number][] = [];
      for (const member of members.members) {
        if (!step() || member.kind !== "present" ||
          member.source.read !== "property" && member.source.read !== "method" ||
          member.destination.read !== "property" && member.destination.read !== "method") return undefined;
        for (const original of member.source.declarations) {
          if (!step()) return undefined;
          for (const destination of member.destination.declarations) {
            if (!step()) return undefined;
            const origin = project(originalOwner, { kind: member.source.read === "method" ? "method-value" : "member", declaration: original });
            const target = project(value, { kind: member.destination.read === "method" ? "method-value" : "member", declaration: destination });
            if (origin === undefined || target === undefined) return undefined;
            connect(origin, target);
            birth.push(Object.freeze({ origin, destination: target }));
          }
        }
      }
      return Object.freeze({ subjects: Object.freeze([value]), birth: Object.freeze(birth) });
    }
    if (ast.is.IsObjectBindingPattern(pattern) || ast.is.IsObjectLiteralExpression(pattern)) {
      const name = binding?.PropertyName ?? ast.name(reference);
      const selected = name === undefined ? undefined : queries.operations.propertyName(name);
      const properties = ownerType === undefined || selected === undefined ? undefined : queries.types.propertyInfos(ownerType)
        .filter(property => property.name === selected.name);
      const declarations = properties?.flatMap(property => [...new Set([property.symbol, ...property.rootSymbols]
        .flatMap(symbol => queries.declarations.symbolDeclarations(symbol)))]).filter(declaration =>
        sourceStorageIsDataMember(declaration, ast) || sourceStorageIsMethodMember(declaration, ast) || ast.is.IsGetAccessorDeclaration(declaration));
      if (declarations === undefined || declarations.length === 0) {
        return undefined;
      }
      const values = new Set<SourceStorageSubject>();
      for (const declaration of declarations) {
        if (!step()) return undefined;
        const value = project(originalOwner, { kind: sourceStorageIsMethodMember(declaration, ast) ? "method-value" : "member", declaration });
        if (value === undefined) return undefined;
        values.add(value);
      }
      return Object.freeze({ subjects: Object.freeze([...values]) });
    }
    if (!ast.is.IsArrayBindingPattern(pattern) && !ast.is.IsArrayLiteralExpression(pattern)) return undefined;
    const index = ast.elements(pattern).indexOf(reference);
    const component: SourceStorageProjection | undefined = ownerType === undefined || index < 0 ? undefined
      : queries.types.isTuple(ownerType) ? { kind: "tuple-element", index }
        : queries.types.isArrayLike(ownerType) ? { kind: "array-element" } : undefined;
    const rest = binding?.DotDotDotToken !== undefined || ast.is.IsSpreadElement(reference);
    if (component === undefined) return undefined;
    if (!rest) {
      const value = project(originalOwner, component);
      return value === undefined ? undefined : Object.freeze({ subjects: Object.freeze([value]) });
    }
    const value = subject(reference);
    if (value === undefined || ownerType === undefined) return undefined;
    const resultType = sourceStorageSubjectType(source, value, sourceFileFor(value));
    if (resultType === undefined) return undefined;
    const birth: NonNullable<SourceStorageWriteProjection["birth"]>[number][] = [];
    for (const original of sourceStorageComponents(ownerType, queries)) {
      if (!step()) return undefined;
      if (original.kind === "tuple-element" && original.index < index) continue;
      const origin = project(originalOwner, original);
      const destination = project(value, original.kind === "tuple-element" && queries.types.isTuple(resultType)
        ? { kind: "tuple-element", index: original.index - index } : { kind: "array-element" });
      if (origin === undefined || destination === undefined) return undefined;
      connect(origin, destination);
      birth.push(Object.freeze({ origin, destination }));
    }
    return Object.freeze({ subjects: Object.freeze([value]), birth: Object.freeze(birth) });
  };
  const binding = (reference: Node): SourceStorageSubject | undefined => {
    const pattern = ast.parent(reference);
    const owner = pattern === undefined ? undefined : ast.parent(pattern);
    if (owner === undefined || !ast.is.IsBindingElement(reference)) return undefined;
    const originalOwner = subjectFor(owner);
    const selected = originalOwner === undefined ? undefined : patternComponent(originalOwner, reference);
    if (selected?.subjects.length === 1) return selected.subjects[0];
    const value = subject(reference);
    if (value !== undefined) {
      if (selected === undefined) unresolved(value, "A source binding requires its exact checked readable storage component.");
      else for (const original of selected.subjects) connect(original, value);
    }
    return value;
  };
  const writeValue = (input: SourceBindingWriteValue): SourceStorageWriteProjection | undefined => {
    const original = subjectFor(input.expression);
    if (original === undefined) return undefined;
    let selected: readonly SourceStorageSubject[] = [original];
    let birth: SourceStorageWriteProjection["birth"];
    let offset = 0;
    if (input.kind !== "value") {
      const type = sourceStorageSubjectType(source, original, sourceFileFor(original));
      const queries = semantics.forNode(input.expression);
      if (input.kind === "iteration-key" || type === undefined) return undefined;
      const values: SourceStorageSubject[] = [];
      for (const component of sourceStorageComponents(type, queries)) {
        if (!step()) return undefined;
        const value = project(original, component);
        if (value === undefined) return undefined;
        values.push(value);
      }
      if (values.length === 0) return undefined;
      selected = values;
      offset = 1;
    }
    for (const component of input.projection.slice(offset)) {
      const values = new Set<SourceStorageSubject>();
      const components: NonNullable<SourceStorageWriteProjection["birth"]>[number][] = [];
      let created: SourceStorageSubject | undefined;
      for (const owner of selected) {
        if (!step()) return undefined;
        const projected = patternComponent(owner, component);
        if (projected === undefined) return undefined;
        for (const value of projected.subjects) values.add(value);
        if (projected.birth !== undefined) {
          const value = projected.subjects[0];
          if (value === undefined || projected.subjects.length !== 1 || created !== undefined && created !== value) return undefined;
          created = value;
          components.push(...projected.birth);
        }
      }
      selected = Object.freeze([...values]);
      birth = selected.length === 1 && selected[0] === created ? Object.freeze(components) : undefined;
    }
    return Object.freeze({ subjects: Object.freeze([...selected]), ...(birth === undefined ? {} : { birth }) });
  };
  const literal = (node: Node): void => {
    const owner = subjectFor(node);
    const queries = semantics.forNode(node);
    const type = queries.types.expressionType(node) ?? queries.types.contextualType(node)?.selectedType;
    const tuple = type !== undefined && queries.types.isTuple(type);
    let tupleIndex = 0;
    for (const element of ast.elements(node)) {
      if (!step()) break;
      if (element === undefined || ast.is.IsOmittedExpression(element)) { tupleIndex += 1; continue; }
      if (ast.is.IsSpreadElement(element)) {
        const spread = subjectFor(Node_Expression(ast, element));
        const spreadType = spread === undefined ? undefined : sourceStorageSubjectType(source, spread, sourceFileFor(spread));
        if (spreadType !== undefined && (!tuple || queries.types.isTuple(spreadType))) {
          for (const component of sourceStorageComponents(spreadType, queries)) {
            if (!step()) break;
            connect(project(spread, component), project(owner, tuple
              ? { kind: "tuple-element", index: tupleIndex++ } : { kind: "array-element" }));
          }
        } else if (owner !== undefined) unresolved(owner, "A source spread has no exact checked component transport.");
      } else connect(subjectFor(element), project(owner, tuple
        ? { kind: "tuple-element", index: tupleIndex++ } : { kind: "array-element" }));
    }
  };
  const ownerFor = (node: Node, projection?: readonly SourceStorageProjection[]): SourceStorageSubject | undefined => {
    const file = ast.getSourceFile(node);
    if (file === undefined || !semantics.includes(file)) return undefined;
    const syntaxProjection: SourceStorageProjection[] = [];
    for (let remaining = 2_048; IsTypeSyntaxNode(ast, node); remaining -= 1) {
      if (remaining === 0 || !step()) return undefined;
      const parent = ast.parent(node);
      if (parent === undefined) break;
      if (ast.is.IsArrayTypeNode(parent)) syntaxProjection.unshift({ kind: "array-element" });
      if (ast.is.IsTupleTypeNode(parent)) {
        const index = ast.elements(parent).indexOf(node);
        if (index >= 0) syntaxProjection.unshift({ kind: "tuple-element", index });
      }
      node = parent;
    }
    const owner = ast.body(node) === undefined ? subjectFor(node) : subject(node, "return");
    const components = sourceStorageProjectionPath(projection === undefined ? syntaxProjection : projection);
    return owner === undefined || components === undefined ? undefined
      : subject(owner.node, owner.kind, [...owner.projection, ...components]);
  };
  return Object.freeze({ indexed, binding, writeValue, literal, ownerFor });
}
