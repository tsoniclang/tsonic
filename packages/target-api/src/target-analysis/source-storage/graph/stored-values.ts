import type { AstReader, Node, Type } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { Node_Expression, Node_Initializer } from "../../../source-navigation/ast.js";
import { sourceCallableValueParameters } from "../../../source-navigation/callable-parameters.js";
import { sourceBindingHasMutableExposure } from "../../../source-navigation/binding-mutation-exposure.js";
import { forEachSourceImmediateEvaluationChild } from "../../../source-navigation/immediate-evaluation.js";
import { sourceBindingWriteAtReference } from "../../../source-navigation/references-usage.js";
import { sourceClassFieldHasStorage, sourceParameterIsProperty } from "../../../source-navigation/class-members.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import { sourceStorageFormalOwner } from "../model/subjects.js";
import { sourcePresentStorageType, sourceStorageAccessDeclarations, sourceStorageIsScalarType,
  sourceStorageSubjectType } from "../model/components.js";
import type { SourceStorageInvocationInputQuery } from "./invocation-inputs.js";
import type { createSourceStorageGraphQueries } from "./graph-queries.js";
import type { SourceStorageFormalMemberWriteDemandSelection, SourceStorageUnresolved,
  SourceStorageWriteOccurrence, SourceStorageWrittenValue } from "../model/types.js";
import type { SourceBindingWriteValue } from "../../../source-navigation/types.js";
import type { SourceStorageWriteProjection } from "../model/projections.js";

export interface SourceStorageWrite {
  readonly reference: Node;
  readonly operation: Node;
  readonly kind: "initialization" | "mutation";
  readonly value?: SourceStorageSubject;
  readonly values: readonly SourceStorageWrittenValue[];
  readonly reason?: string;
  readonly birth?: NonNullable<SourceStorageWriteProjection["birth"]>;
  readonly destination?: "binding" | "member" | "element" | "pointer";
}

export function createSourceStorageFormalMemberWrites(
  source: TargetSourceProgram,
  budget: SourceStorageBudget,
  graph: ReturnType<typeof createSourceStorageGraphQueries>,
  queries: {
    readonly nodes: readonly Node[];
    readonly invocations: Iterable<Node>;
    readonly invocationInputs: SourceStorageInvocationInputQuery;
    readonly subject: SourceStorageSubjectQuery;
    subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
    inputsFor(subject: SourceStorageSubject): ReadonlySet<SourceStorageSubject> | undefined;
    implementationsFor(invocation: Node): { readonly nodes: ReadonlySet<Node>; readonly exact: boolean } | undefined;
    unresolvedFor(invocation: Node): string | undefined;
  },
) {
  const { ast, navigation, semantics } = source;
  const rows = budget.createRows();
  const formals = new Map<SourceStorageSubject, { readonly declaration: Node; readonly parameter: Node; readonly type: Type }>();
  const owners = new Map<Node, readonly SourceStorageSubject[]>();
  const seeds = new Map<SourceStorageSubject, Set<Node | string>>();
  const forwards = new Map<SourceStorageSubject, Map<SourceStorageSubject, string | undefined>>();
  const published = new Map<SourceStorageSubject, SourceStorageFormalMemberWriteDemandSelection>();
  let complete = false;
  const unresolved = (reason: string): SourceStorageUnresolved => Object.freeze({ kind: "unresolved", reason });
  const add = (formal: SourceStorageSubject, value: Node | string): void => {
    const values = seeds.get(formal);
    if (values?.has(value) || !rows.add(values === undefined ? 2 : 1)) return;
    const selected = values ?? new Set<Node | string>();
    selected.add(value);
    seeds.set(formal, selected);
  };
  const forward = (input: SourceStorageSubject, formal: SourceStorageSubject, reason: string | undefined): void => {
    const relations = forwards.get(input);
    if (relations?.has(formal) === true) {
      if (relations.get(formal) === undefined && reason !== undefined) relations.set(formal, reason);
      return;
    }
    if (!rows.add(relations === undefined ? 2 : 1)) return;
    const selected = relations ?? new Map<SourceStorageSubject, string | undefined>();
    selected.set(formal, reason);
    forwards.set(input, selected);
  };
  for (const declaration of queries.nodes) {
    if (!budget.step()) break;
    if (ast.body(declaration) === undefined || !ast.is.IsFunctionDeclaration(declaration) &&
      !ast.is.IsFunctionExpression(declaration) && !ast.is.IsArrowFunction(declaration) &&
      !ast.is.IsMethodDeclaration(declaration) && !ast.is.IsConstructorDeclaration(declaration) &&
      !ast.is.IsGetAccessorDeclaration(declaration) && !ast.is.IsSetAccessorDeclaration(declaration)) continue;
    const parameters = sourceCallableValueParameters(ast, declaration, semantics.forNode(declaration), { kind: "declaration" });
    if (parameters === undefined || !rows.add(1)) continue;
    const selected: SourceStorageSubject[] = [];
    for (const parameter of parameters) {
      if (!budget.step()) break;
      const subject = queries.subject(parameter, "input");
      const type = subject === undefined ? undefined : sourceStorageSubjectType(source, subject);
      if (subject === undefined || type === undefined || !rows.add(2)) continue;
      formals.set(subject, { declaration, parameter, type });
      selected.push(subject);
    }
    if (selected.length === parameters.length) owners.set(declaration, Object.freeze(selected));
  }
  const stable = (reference: Node): boolean => {
    const binding = navigation.referenceFor(reference);
    if (binding === undefined) return false;
    const summary = navigation.declarationUseSummary(binding.declaration);
    if (summary.exported && ast.is.IsVariableDeclaration(binding.declaration) &&
      ast.variableDeclarationKind(binding.declaration) !== "const" ||
      sourceBindingHasMutableExposure(source, summary, budget.step)) return false;
    if (!summary.bindingWritten) return true;
    if (summary.uses.some(use => use.captured && use.role === "write" && !use.throughMember)) return false;
    const preserved = (node: Node): boolean => budget.step() && navigation.bindingWritesWithin(binding.symbol, node).length === 0;
    const contains = (node: Node, child: Node): boolean => {
      for (let current: Node | undefined = child; current !== undefined && budget.step(); current = ast.parent(current))
        if (current === node) return true;
      return false;
    };
    const parameter = ast.is.IsParameterDeclaration(binding.declaration);
    const owner = parameter ? ast.parent(binding.declaration) : undefined;
    if (owner !== undefined) for (const input of owners.get(owner) ?? []) {
      const initializer = Node_Initializer(ast, input.node);
      if (initializer !== undefined && !preserved(initializer)) return false;
    }
    let current = reference;
    while (budget.step()) {
      const parent = ast.parent(current);
      if (parent === undefined || ast.is.IsWhileStatement(parent) || ast.is.IsDoStatement(parent) ||
        ast.is.IsForStatement(parent) || ast.is.IsForInStatement(parent) || ast.is.IsForOfStatement(parent)) return false;
      if (ast.is.IsBlock(parent)) {
        let initialized = parameter && owner !== undefined && ast.body(owner) === parent;
        for (const statement of ast.statements(parent)) {
          if (!budget.step() || statement === undefined) return false;
          if (statement === current) {
            if (initialized || !parameter && contains(statement, binding.declaration)) return true;
            break;
          }
          if (!parameter && contains(statement, binding.declaration)) initialized = true;
          if (initialized && !preserved(statement)) return false;
        }
      }
      if (ast.is.IsFunctionDeclaration(parent) || ast.is.IsFunctionExpression(parent) || ast.is.IsArrowFunction(parent) ||
        ast.is.IsMethodDeclaration(parent) || ast.is.IsConstructorDeclaration(parent) ||
        ast.is.IsGetAccessorDeclaration(parent) || ast.is.IsSetAccessorDeclaration(parent)) return false;
      let reached = false;
      let unchanged = true;
      forEachSourceImmediateEvaluationChild(ast, parent, child => {
        if (child === current) reached = true;
        else if (!reached && unchanged) unchanged = preserved(child);
      });
      if (!reached || !unchanged) return false;
      current = parent;
    }
    return false;
  };
  const parameterFor = (expression: Node): SourceStorageSubject | SourceStorageUnresolved | undefined => budget.withRows(temporary => {
    const visited = new Set<Node>();
    let current = expression;
    while (budget.step()) {
      const file = ast.getSourceFile(current);
      if (file === undefined || !semantics.includes(file)) return unresolved("Member-write receivers require their original checked source binding.");
      if (visited.has(current) || !temporary.add(1)) return unresolved(budget.failure() ?? "Member-write aliases require an acyclic checked initializer chain.");
      visited.add(current);
      if (ast.is.IsParenthesizedExpression(current) || ast.is.IsAsExpression(current) || ast.is.IsSatisfiesExpression(current) ||
        ast.is.IsNonNullExpression(current) || ast.is.IsTypeAssertion(current)) {
        const inner = Node_Expression(ast, current);
        if (inner === undefined) return unresolved("Member-write aliases require their exact source operand.");
        current = inner;
        continue;
      }
      if (ast.is.IsObjectLiteralExpression(current) || ast.is.IsArrayLiteralExpression(current) || ast.is.IsNewExpression(current) ||
        ast.is.IsFunctionExpression(current) || ast.is.IsArrowFunction(current)) return undefined;
      if (!ast.is.IsIdentifier(current)) {
        const type = semantics.forFile(file).types.expressionType(current);
        if (type !== undefined && (sourceStorageIsScalarType(type, semantics.forFile(file)) ||
          semantics.forFile(file).types.isNullish(type) || semantics.forFile(file).types.isVoidLike(type))) return undefined;
        return unresolved("Member-write demand requires a parameter binding or a qualified local alias, not an element, property or call result.");
      }
      const reference = navigation.referenceFor(current);
      if (reference === undefined || !stable(current)) return unresolved("Member-write demand has no parameter/local-alias proof without intervening reassignment or mutable exposure.");
      const declaration = reference.declaration;
      if (ast.is.IsParameterDeclaration(declaration)) {
        const formal = queries.subject(declaration, "input");
        return formal !== undefined && formals.has(formal) && sourceStorageFormalOwner(formal, source) === ast.parent(declaration)
          ? formal : unresolved("Member-write demand requires the actual implementation's checked value parameter.");
      }
      if (!ast.is.IsVariableDeclaration(declaration) ||
        ast.variableDeclarationKind(declaration) !== "const" && ast.variableDeclarationKind(declaration) !== "let")
        return unresolved("Member-write demand requires an original parameter or local const/let declaration.");
      const initializer = Node_Initializer(ast, declaration);
      if (initializer === undefined) return unresolved("Member-write aliases require an original checked initializer.");
      current = initializer;
    }
    return unresolved(budget.failure() ?? "Member-write alias proof did not complete.");
  });
  const affected = (expression: Node): readonly SourceStorageSubject[] | undefined => budget.withRows(temporary => {
    const subject = queries.subjectFor(expression);
    if (subject === undefined || !temporary.add(1)) return undefined;
    const pending = [subject];
    const visited = new Set<SourceStorageSubject>();
    const selected = new Set<SourceStorageSubject>();
    while (pending.length !== 0) {
      if (!budget.step()) return undefined;
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      if (!temporary.add(1)) return undefined;
      visited.add(current);
      if (current.kind === "input" || current.kind === "receiver") {
        const root = queries.subject(current.node, current.kind);
        if (root !== undefined && formals.has(root) && !selected.has(root)) {
          if (!temporary.add(1)) return undefined;
          selected.add(root);
        }
        continue;
      }
      const inputs = queries.inputsFor(current);
      if (inputs === undefined) return undefined;
      for (const input of inputs) {
        if (!budget.step() || !temporary.add(1)) return undefined;
        pending.push(input);
      }
    }
    return Object.freeze([...selected]);
  });
  const inputsFor = (expression: Node): {
    readonly inputs: readonly SourceStorageSubject[];
    readonly reason?: string;
  } => {
    const selected = parameterFor(expression);
    const consumer = semantics.forNode(expression);
    const type = selected?.kind === "input" ? formals.get(selected)?.type : consumer.types.expressionType(expression);
    if (type !== undefined && (sourceStorageIsScalarType(type, consumer) ||
      consumer.types.isNullish(type) || consumer.types.isVoidLike(type))) return { inputs: [] };
    if (selected?.kind === "input") return { inputs: [selected] };
    if (selected !== undefined && selected.kind !== "unresolved") {
      budget.reject("Formal member-write aliases require the exact checked input subject.");
      return { inputs: [] };
    }
    const inputs = affected(expression);
    if (inputs === undefined) budget.reject("Formal member-write uncertainty requires its complete checked input correlation.");
    return { inputs: inputs ?? [], reason: selected?.reason ?? (inputs?.length === 0 ? undefined
      : "Member-write demand cannot treat an aggregate or captured value as an unqualified parameter binding.") };
  };
  const membersFor = (formal: SourceStorageSubject, from: Type, member: Node): readonly Node[] | undefined => {
    const selected = formals.get(formal);
    if (selected === undefined || !budget.step()) return undefined;
    const consumer = semantics.forNode(selected.parameter);
    const presentFormal = sourcePresentStorageType(selected.type, consumer);
    const presentFrom = sourcePresentStorageType(from, consumer);
    if (presentFormal === undefined || presentFrom === undefined) return undefined;
    const relation = consumer.types.structuralMember(presentFormal, presentFrom, member);
    return relation?.kind === "present" && relation.source.declarations.length !== 0 ? relation.source.declarations : undefined;
  };
  const recordWrite = (write: SourceStorageWriteOccurrence): SourceStorageWriteOccurrence => {
    if (write.kind !== "mutation" || write.destination !== "member" && write.destination !== "element" || !budget.step()) return write;
    const selected = ast.is.IsPropertyAccessExpression(write.reference) ? semantics.forNode(write.reference).operations.propertyAccess(write.reference)
      : ast.is.IsElementAccessExpression(write.reference) ? semantics.forNode(write.reference).operations.elementAccess(write.reference) : undefined;
    const members = sourceStorageAccessDeclarations(source, write.reference, "write");
    if (write.destination === "element" && (members === undefined || members.length === 0) ||
      members !== undefined && members.length !== 0 && members.every(ast.is.IsSetAccessorDeclaration)) return write;
    if (selected === undefined) {
      budget.reject("Formal member-write demand requires its exact checked selected receiver.");
      return write;
    }
    const formal = parameterFor(selected.receiver.expression);
    let reason = write.reason ?? (formal?.kind === "unresolved" ? formal.reason : undefined);
    if (formal?.kind === "input") {
      if (members === undefined || members.length === 0) reason = "Member-write demand requires its exact selected source member declaration.";
      for (const member of members ?? []) {
        const mapped = membersFor(formal, selected.receiver.type, member);
        if (mapped === undefined) { reason ??= "Member-write demand has no exact checked formal/member correspondence."; continue; }
        for (const declaration of mapped) add(formal, declaration);
      }
      if (reason !== undefined) add(formal, reason);
    } else if (reason !== undefined) {
      const shared = members?.some(member => ast.is.IsPropertySignatureDeclaration(member) || ast.is.IsMethodSignatureDeclaration(member)) === true;
      if (!shared) return write;
      const inputs = affected(selected.receiver.expression);
      if (inputs === undefined) budget.reject("Formal member-write uncertainty requires its complete checked receiver correlation.");
      for (const input of inputs ?? []) add(input, reason);
    }
    return reason === undefined || formal === undefined ? write : Object.freeze({ ...write, reason: write.reason ?? reason });
  };
  const publish = (): void => {
    if (complete) throw new Error("Formal member-write demands publish exactly once.");
    for (const formal of formals.keys()) {
      if (!budget.step()) break;
      const initializer = Node_Initializer(ast, formal.node);
      if (initializer === undefined) continue;
      const actual = inputsFor(initializer);
      for (const input of actual.inputs) forward(input, formal, actual.reason);
    }
    for (const invocation of queries.invocations) {
      if (!budget.step()) break;
      const call = semantics.forNode(invocation).operations.call(invocation);
      const implementations = queries.implementationsFor(invocation);
      const assignment = ast.parent(invocation);
      const setter = assignment !== undefined && ast.is.IsBinaryExpression(assignment) &&
        ast.operatorKindName(assignment) === "KindEqualsToken" ? ast.as.AsBinaryExpression(assignment) : undefined;
      const supplied = call?.sourceArguments.map(argument => argument.expression)
        ?? (ast.is.IsCallExpression(invocation) ? ast.as.AsCallExpression(invocation)?.Arguments?.Nodes
          : ast.is.IsNewExpression(invocation) ? ast.as.AsNewExpression(invocation)?.Arguments?.Nodes
            : setter?.Left === invocation && setter.Right !== undefined ? [setter.Right] : []);
      const markUnresolved = (reason: string): void => {
        for (const expression of supplied ?? []) {
          if (!budget.step()) break;
          if (expression === undefined) continue;
          const actual = ast.is.IsSpreadElement(expression) ? Node_Expression(ast, expression) : expression;
          if (actual !== undefined) for (const input of inputsFor(actual).inputs) add(input, reason);
        }
      };
      const reason = queries.unresolvedFor(invocation);
      if (reason !== undefined || implementations?.exact !== true || implementations.nodes.size === 0 ||
        [...implementations.nodes].some(declaration => !budget.step() || ast.body(declaration) === undefined)) {
        markUnresolved(reason ?? "Member-write demand cannot prove an unknown or bodyless callee's effects.");
        continue;
      }
      for (const declaration of implementations.nodes) {
        if (!budget.step()) break;
        const parameters = owners.get(declaration);
        if (parameters === undefined) {
          markUnresolved("Member-write demand requires the actual implementation's complete checked value-parameter vector.");
          continue;
        }
        for (const formal of parameters) {
          if (!budget.step()) break;
          const bound = queries.invocationInputs(formal, declaration, invocation);
          for (const supplied of [...bound.subjects, ...(bound.calleeSubjects ?? [])]) {
            if (!budget.step()) break;
            if (supplied === formal) {
              if (!bound.omitted) markUnresolved("Member-write demand has no exact selected signature-to-implementation input correspondence.");
              continue;
            }
            const actual = inputsFor(supplied.node);
            for (const input of actual.inputs) forward(input, formal, actual.reason ?? (supplied.projection.length !== 0
              ? "Member-write demand cannot turn a projected or rest input into an unqualified parameter binding." : undefined));
          }
        }
      }
    }
    const demands = graph.fixedPoint<SourceStorageSubject, Node | string>((formal, _read, emit, forward) => {
      for (const value of seeds.get(formal) ?? []) if (!budget.step() || !emit(value)) return false;
      for (const [input, reason] of forwards.get(formal) ?? []) {
        const selected = formals.get(input);
        if (selected === undefined || !forward(input, value => {
          if (typeof value === "string") return [{ kind: "value", value }];
          if (reason !== undefined) return [{ kind: "value", value: reason }];
          const members = membersFor(formal, selected.type, value);
          return members === undefined ? [{ kind: "value", value: "Member-write demand has no exact checked forwarded member correspondence." }]
            : members.map(member => ({ kind: "value", value: member }));
        })) return false;
      }
      return budget.failure() === undefined;
    }, "formal-member-write-demands");
    for (const formal of formals.keys()) {
      if (!budget.step()) break;
      const values = demands(formal);
      let reason = budget.failure();
      const members: Node[] = [];
      for (const value of values ?? []) {
        if (!budget.step()) break;
        if (typeof value === "string") reason ??= value;
        else members.push(value);
      }
      if (values === undefined) reason ??= "Member-write demand has no completed finite source relation.";
      if (!rows.add(1 + members.length)) break;
      published.set(formal, reason === undefined ? Object.freeze({ kind: "complete", members: Object.freeze(members) }) : unresolved(reason));
    }
    complete = true;
  };
  return Object.freeze({ recordWrite, publish,
    get(declaration: Node, parameter: Node): SourceStorageFormalMemberWriteDemandSelection {
      if (!complete || budget.failure() !== undefined) return unresolved(budget.failure() ?? "Formal member-write demand is not published.");
      const formal = owners.get(declaration)?.find(subject => subject.node === parameter);
      return formal === undefined ? unresolved("Formal member-write demand requires the identical checked implementation and value parameter.")
        : published.get(formal) ?? unresolved("Formal member-write demand has no completed checked parameter evidence.");
    },
  });
}

export interface SourceStorageStore extends SourceStorageWrite {
  readonly storage: SourceStorageSubject;
  readonly region: Node;
  readonly receiver?: SourceStorageSubject;
  readonly destination: "binding" | "member" | "element" | "pointer";
}

export function createSourceStorageStoredValues(
  ast: AstReader,
  budget: SourceStorageBudget,
  regionFor: (node: Node) => Node | undefined,
  receiverFor: (node: Node) => SourceStorageSubject | undefined,
) {
  const locations = new Map<SourceStorageSubject, Map<Node, SourceStorageStore>>();
  const regions = new Map<Node, Set<SourceStorageStore>>();
  const occurrences = new Map<Node, {
    readonly store: SourceStorageStore;
    readonly destinations: Set<SourceStorageSubject>;
    published: SourceStorageWriteOccurrence | undefined;
  }>();
  const rows = budget.createRows();
  let published = false;
  const record = (storage: SourceStorageSubject | undefined, write: SourceStorageWrite): void => {
    const kind = write.kind;
    if (storage === undefined || storage.kind !== "value" && storage.kind !== "member" || !budget.step()) return;
    if (published) throw new Error("Source store occurrences cannot change after their final publication.");
    const originalProjection = write.values[0]?.source?.projection;
    if (write.birth !== undefined && (kind !== "initialization" || write.value !== storage ||
      !ast.is.IsBindingElement(storage.node) || ast.as.AsBindingElement(storage.node)?.DotDotDotToken === undefined ||
      ast.name(storage.node) !== write.reference || write.values.length !== 1 || write.values[0]!.reason !== undefined ||
      write.values[0]!.subjects.length !== 1 || write.values[0]!.subjects[0] !== storage ||
      originalProjection?.[originalProjection.length - 1] !== storage.node || write.birth.some(component => !budget.step() ||
        component.destination.node !== storage.node || component.destination.kind !== storage.kind ||
        component.destination.projection.length === 0))) {
      budget.reject("An original source rest birth requires its exact checked initialization and projected producer.");
      return;
    }
    let selected = locations.get(storage);
    if (kind === "initialization") {
      const declaration = storage.node;
      if (storage.projection.length !== 0) return;
      if (ast.getSourceFile(declaration)?.IsDeclarationFile) return;
      if (!ast.is.IsVariableDeclaration(declaration) && !ast.is.IsBindingElement(declaration) && !sourceClassFieldHasStorage(ast, declaration) &&
        !ast.is.IsPropertyAssignment(declaration) && !ast.is.IsShorthandPropertyAssignment(declaration) &&
        !sourceParameterIsProperty(ast, declaration)) return;
      let lexical: Node | undefined = ast.is.IsVariableDeclaration(declaration) ? ast.parent(declaration) : declaration;
      if (lexical !== undefined && ast.is.IsVariableDeclarationList(lexical)) lexical = ast.parent(lexical);
      for (let owner: Node | undefined = lexical; owner !== undefined && !ast.is.IsSourceFile(owner); owner = ast.parent(owner)) {
        if (!budget.step()) return;
        if (ast.hasModifierKind(owner, "ambient")) return;
      }
    }
    const previous = occurrences.get(write.reference);
    if (previous !== undefined) {
      if (previous.store.storage !== storage || previous.store.operation !== write.operation || previous.store.kind !== kind ||
        previous.store.value !== write.value || previous.store.reason !== write.reason ||
        (previous.store.birth === undefined) !== (write.birth === undefined) || previous.store.birth?.length !== write.birth?.length ||
        previous.store.birth?.some((component, index) => !budget.step() || component.origin !== write.birth![index]!.origin ||
          component.destination !== write.birth![index]!.destination) ||
        previous.store.values.length !== write.values.length ||
        previous.store.values.some((value, index) => {
          const selected = write.values[index]!;
          return value.reason !== selected.reason || value.subjects.length !== selected.subjects.length ||
            value.subjects.some((subject, position) => subject !== selected.subjects[position]) ||
            value.source?.kind !== selected.source?.kind || value.source?.expression !== selected.source?.expression ||
            value.source?.projection.length !== selected.source?.projection.length ||
            value.source?.projection.some((part, position) => part !== selected.source?.projection[position]);
        }))
        budget.reject("Source storage stores require one exact checked occurrence owner.");
      return;
    }
    const region = regionFor(write.reference);
    if (region === undefined) {
      budget.reject("Source storage stores require their exact checked execution region.");
      return;
    }
    const receiver = kind === "mutation" ? receiverFor(write.reference) : undefined;
    if (budget.failure() !== undefined) return;
    const regional = regions.get(region);
    const declarationName = kind === "initialization" ? ast.name(storage.node) : undefined;
    const alias = declarationName !== undefined && ast.is.IsIdentifier(declarationName) && declarationName !== write.reference
      ? declarationName : undefined;
    if (!rows.add(6 + (write.birth === undefined ? 0 : 1 + 3 * write.birth.length) + write.values.reduce((total, value) => total + 1 + value.subjects.length, 0) +
      (selected === undefined ? 1 : 0) + (regional === undefined ? 1 : 0) + (alias === undefined ? 0 : 1))) return;
    const destination = write.destination ?? (kind === "initialization"
      ? ast.is.IsVariableDeclaration(storage.node) || ast.is.IsBindingElement(storage.node) ? "binding" : "member"
      : receiver === undefined ? "binding" : storage.projection.length === 0 ? "member" : "element");
    const store = Object.freeze({ ...write, storage, region, receiver, kind, destination });
    selected ??= new Map<Node, SourceStorageStore>();
    const retained = regional ?? new Set<SourceStorageStore>();
    retained.add(store);
    regions.set(region, retained);
    selected.set(write.reference, store);
    locations.set(storage, selected);
    const occurrence = { store, destinations: new Set([storage]), published: undefined };
    occurrences.set(write.reference, occurrence);
    if (alias !== undefined) occurrences.set(alias, occurrence);
  };
  const writeFor = (reference: Node, valueFor: (input: SourceBindingWriteValue) => SourceStorageWriteProjection | undefined,
    aggregate: (values: readonly SourceStorageSubject[]) => SourceStorageSubject | undefined): SourceStorageWrite | undefined => {
    const write = sourceBindingWriteAtReference(ast, reference);
    if (write === undefined) return undefined;
    const declaration = ast.parent(reference);
    const initialization = write.kind === "initialization" || write.kind === "iteration" && declaration !== undefined &&
      ast.name(declaration) === reference && (ast.is.IsVariableDeclaration(declaration) || ast.is.IsBindingElement(declaration));
    let birth: SourceStorageWriteProjection["birth"];
    const values = write.values.map(source => {
      const selected = valueFor(source);
      birth = selected?.birth;
      return Object.freeze({ source, subjects: Object.freeze([...(selected?.subjects ?? [])]), reason: selected === undefined
        ? "Source storage writes require their exact checked original value producer, iteration element and component projection." : undefined });
    });
    const value = aggregate(values.flatMap(value => value.subjects));
    const originalProjection = values[0]?.source.projection;
    const originalBirth = initialization && values.length === 1 && values[0]!.reason === undefined &&
      value?.node === originalProjection?.[originalProjection.length - 1] ? birth : undefined;
    return Object.freeze({ reference, operation: write.operation,
      kind: initialization ? "initialization" : "mutation",
      value, values: Object.freeze(values), ...(originalBirth === undefined ? {} : { birth: originalBirth }),
      reason: values.find(value => value.reason !== undefined)?.reason });
  };
  const recordWrite = (storage: SourceStorageSubject | undefined, write: ReturnType<typeof writeFor>): void => {
    if (write !== undefined) record(storage, write);
  };
  const storesFor = (storage: SourceStorageSubject): Iterable<SourceStorageStore> | undefined => locations.get(storage)?.values();
  const physicalStoresFor = (storage: SourceStorageSubject): Iterable<SourceStorageStore> | undefined => {
    const stores = locations.get(storage);
    if (stores === undefined) return undefined;
    let destination: SourceStorageStore["destination"] | undefined = storage.kind === "value" && storage.projection.length === 0 &&
      (ast.is.IsVariableDeclaration(storage.node) || ast.is.IsBindingElement(storage.node)) ? "binding" : undefined;
    for (const store of stores.values()) {
      if (!budget.step()) return undefined;
      if (destination !== undefined) break;
      if (store.kind === "initialization" && store.storage === storage) { destination = store.destination; break; }
    }
    if (destination === undefined) return undefined;
    return { *[Symbol.iterator]() {
      for (const store of stores.values()) {
        if (!budget.step()) return;
        if (store.destination === destination || store.destination === "pointer") yield store;
      }
    } };
  };
  const inputsFor = (storage: SourceStorageSubject): Iterable<SourceStorageSubject> | undefined => {
    const stores = physicalStoresFor(storage);
    if (stores === undefined) return undefined;
    return { *[Symbol.iterator]() {
      for (const store of stores) if (store.value !== undefined) yield store.value;
    } };
  };
  return Object.freeze({
    initialize(storage: SourceStorageSubject | undefined, occurrence: Node, value?: SourceStorageSubject): void {
      const source: SourceBindingWriteValue | undefined = value === undefined || value.kind === "input" ? undefined
        : Object.freeze({ kind: "value", expression: occurrence, projection: Object.freeze([]) });
      if (storage !== undefined) record(storage, { reference: occurrence, operation: storage.node, value, kind: "initialization",
        values: Object.freeze(value === undefined ? [] : [Object.freeze({ source, subjects: Object.freeze([value]), reason: undefined })]) });
    },
    recordWrite, writeFor, storesFor, inputsFor,
    bind(storage: SourceStorageSubject | undefined, occurrence: Node): void {
      if (storage === undefined || !budget.step()) return;
      if (published) throw new Error("Source store destinations cannot change after their final publication.");
      const selectedOccurrence = occurrences.get(occurrence);
      if (selectedOccurrence === undefined) {
        budget.reject("Source storage physical locations require their original checked store occurrence.");
        return;
      }
      const selected = locations.get(storage);
      if (selected?.has(occurrence)) return;
      if (!rows.add(selected === undefined ? 3 : 2)) return;
      const retained = selected ?? new Map<Node, SourceStorageStore>();
      retained.set(occurrence, selectedOccurrence.store);
      locations.set(storage, retained);
      selectedOccurrence.destinations.add(storage);
    },
    publish(select: (write: SourceStorageWriteOccurrence) => SourceStorageWriteOccurrence): void {
      if (typeof select !== "function") throw new Error("Source store publication requires its original write selector.");
      if (published) throw new Error("Source store occurrences publish exactly once.");
      let cost = 0;
      for (const [reference, occurrence] of occurrences) {
        if (!budget.step()) { published = true; return; }
        if (reference !== occurrence.store.reference) continue;
        cost += 1 + occurrence.destinations.size;
      }
      if (cost > 0 && !rows.add(cost)) { published = true; return; }
      for (const [reference, occurrence] of occurrences) {
        if (reference !== occurrence.store.reference) continue;
        const store = occurrence.store;
        occurrence.published = select(Object.freeze({ reference: store.reference, operation: store.operation, region: store.region,
          kind: store.kind, destination: store.destination, receiver: store.receiver, value: store.value, values: store.values, reason: store.reason,
          destinations: Object.freeze([...occurrence.destinations]) }));
      }
      published = true;
    },
    writeAt(reference: Node): SourceStorageWriteOccurrence | undefined {
      if (!published) throw new Error("Source store occurrence lookup requires completed publication.");
      return budget.failure() === undefined ? occurrences.get(reference)?.published : undefined;
    },
    storesIn: (region: Node): Iterable<SourceStorageStore> | undefined => regions.get(region)?.values(),
    unresolvedFor(storage: SourceStorageSubject): string | undefined {
      for (const store of physicalStoresFor(storage) ?? []) {
        if (!budget.step()) return budget.failure();
        if (store.reason !== undefined) return store.reason;
      }
      return undefined;
    },
  });
}
