import type { Diagnostic, Result } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, DefId } from "../ids/contract.js";
import type { BodyInstance } from "../ir-types/contract.js";
import type { CheckedPhase, Expression, FunctionDeclaration, ParameterDeclaration, SourceFile, Statement, VariableDeclaration } from "../ir-hir/contract.js";
import type { TirBody, TirFormalInitializer, TirModuleRoot, TirModuleStatement, TirReadyCallable, TypedBodyTemplate, TypedParameter, TypedPhase } from "../ir-tir/contract.js";
import { typePublicationRefusalOf } from "../ir-types/index.js";
import type { AttachFormalDefault, ElaborateDeps, ElaborationCause, ElaborationChild, ElaborationNoResult } from "./contract.js";
import { callableTypeHeader, declarationAlias, declarationFunction, declarationInterface, declarationModifiers as modifiers, declarationName as name, declarationType as annotation } from "./declarations.js";
import { elaborateExport, elaborateImport, moduleLinkRefusal } from "./imports.js";

function defect(message: string): never {
  return throwInvariant({ owner: "elaborate", query: null, origin: null, message });
}

const templateOf = (body: TirBody): TypedBodyTemplate => ({ body: body.body, lexicalBindings: body.lexicalBindings, dependence: body.dependence });

export const attachFormalDefault: AttachFormalDefault = (deps, formal, unopened, ready) => {
  if (formal.initializer !== unopened) return defect("A required default may be attached to its actual checked slot only once.");
  const root = ready.root;
  if (root.kind === "SourceFile" || root.kind === "Block" || ready.owner !== formal.tsonic.declaration
    || ready.body !== formal.tsonic.initializer || root.id !== unopened.root.id || root.parent !== formal.id
    || ready.completion !== formal.tsonic.storage || deps.signatureOf(ready.signature).result !== ready.completion)
    return defect("A completed formal initializer must retain its checked owner, expression and selected result.");
  const owned: { initializer: TirFormalInitializer } = formal;
  owned.initializer = { kind: "ready-default", root };
  return { kind: "ok", value: undefined, diagnostics: [] };
};

export function elaborateParameter<State>(deps: ElaborateDeps<State>, node: ParameterDeclaration<CheckedPhase>, body: BodyId, selected: TypedParameter,
  initializer: ParameterDeclaration<TypedPhase>["initializer"]): Result<ParameterDeclaration<TypedPhase> & {
    initializer: ParameterDeclaration<TypedPhase>["initializer"];
  }> {
  if (node.name.kind !== "Identifier" || node.name.tsonic.role !== "declaration-name"
    || node.name.tsonic.declaration.kind !== "local") return defect("not elaborated yet: a nonlocal parameter declaration.");
  const local = node.name.tsonic.declaration.local;
  if (selected.local === null || local.body !== body || local.body !== selected.local.body || local.local !== selected.local.local)
    return defect("A parameter has no actual typed-body local association.");
  if (node.initializer === null ? initializer.kind !== "none" || selected.initializer !== null
    : initializer.kind === "none" || initializer.root.id !== node.initializer.id || initializer.root.parent !== node.id || selected.initializer === null)
    return defect("A parameter retains exactly its separately completed initializer syntax.");
  const type = annotation(deps, node.type);
  if (type.kind === "refused") return type;
  return { kind: "ok", diagnostics: [], value: { ...node, modifiers: modifiers(node.modifiers),
    dotDotDotToken: node.dotDotDotToken === null ? null : { ...node.dotDotDotToken, tsonic: null },
    questionToken: node.questionToken === null ? null : { ...node.questionToken, tsonic: null },
    name: name(node.name, selected.storage), type: type.value, initializer, tsonic: selected } };
}

function callable<State>(deps: ElaborateDeps<State>, node: FunctionDeclaration<CheckedPhase>, body: TirBody): Result<TirReadyCallable> {
  const checked = node.tsonic;
  if (body.body !== checked.body || body.owner !== checked.definition || body.root.kind !== "Block")
    return defect("A module function requires its actual completed callable body.");
  if (node.name === null) return defect("not elaborated yet: an unnamed module callable.");
  const [endpoint] = checked.signatures;
  if (checked.signatures.length !== 1 || endpoint?.body !== body.body || endpoint.declaration !== checked.definition || endpoint.role !== "api-body")
    return defect("not elaborated yet: a separate advertised or unrelated callable endpoint.");
  const signature = deps.signatureOf(body.signature);
  if (signature.declaration !== checked.definition || signature.result !== body.completion)
    return defect("The typed body must retain its actual placed signature and completion.");
  if (node.parameters.nodes.length !== body.params.length)
    return defect("The selected callable header must retain exactly its actual parameter inventory.");
  const header = callableTypeHeader(deps, node);
  if (header.kind === "refused") return header;
  return { kind: "ok", diagnostics: [], value: { ...node, ...header.value, name: name(node.name, null), modifiers: modifiers(node.modifiers),
    parameters: { ...node.parameters, nodes: node.parameters.nodes.map((item, index) => {
      const selected = body.params[index];
      if (selected === undefined || selected.id !== item.id || selected.parent !== item.parent)
        return defect("The selected callable must reuse its actual typed parameter occurrences.");
      return selected;
    }) },
    asteriskToken: node.asteriskToken === null ? null : { ...node.asteriskToken, tsonic: null }, body: body.root,
    tsonic: { definition: checked.definition, parameters: checked.parameters, signatures: checked.signatures,
      template: templateOf(body), attributes: checked.attributes } } };
}

export function elaborateVariable<State>(deps: ElaborateDeps<State>, node: VariableDeclaration<CheckedPhase>,
  bodies: ReadonlyMap<BodyId, TirBody>, definition: DefId): Result<VariableDeclaration<TypedPhase>> {
  const checked = node.tsonic;
  if (node.name.kind !== "Identifier" || checked.declaration.kind === "definition" && checked.declaration.definition !== definition)
    return defect("A variable requires its actual checked declaration and identifier.");
  const type = annotation(deps, node.type);
  if (type.kind === "refused") return type;
  if (checked.declaredType.kind !== "available") return defect("A module variable requires its actual checked annotation availability.");
  const body = checked.initializer === null ? null : bodies.get(checked.initializer)
    ?? defect("A module variable requires its actual completed initializer execution.");
  let initializer: Expression<TypedPhase> | null = null;
  if (body !== null) {
    const root = body.root;
    if (body.owner !== definition || root.kind === "Block" || root.kind === "SourceFile"
      || root.id !== node.initializer?.id || root.parent !== node.id || deps.signatureOf(body.signature).result !== body.completion)
      return defect("The completed variable initializer must retain its actual declaration, expression and execution result.");
    initializer = root;
  }
  if ((node.initializer === null) !== (initializer === null))
    return defect("A module variable retains exactly its separately completed initializer syntax.");
  const storage = checked.declaredType.value ?? body?.completion
    ?? defect("A variable without an annotation or initializer requires its actual inferred storage producer.");
  if (body !== null && body.completion !== storage)
    return defect("The completed initializer and actual variable storage disagree.");
  return { kind: "ok", diagnostics: [], value: { ...node, name: name(node.name, storage), type: type.value, initializer,
    exclamationToken: node.exclamationToken === null ? null : { ...node.exclamationToken, tsonic: null },
    tsonic: { declaration: checked.declaration, storage, initializer: checked.initializer } } };
}

export function isInlineModuleStatement(statement: Statement<CheckedPhase>): boolean {
  return statement.kind === "ExpressionStatement" || statement.kind === "ThrowStatement" || statement.kind === "EmptyStatement"
    || statement.kind === "VariableStatement" || statement.kind === "Block" || statement.kind === "IfStatement" || statement.kind === "LabeledStatement"
    || statement.kind === "WhileStatement" || statement.kind === "DoStatement" || statement.kind === "ForStatement"
    || statement.kind === "SwitchStatement";
}

export function elaborateModuleSyntax<State>(deps: ElaborateDeps<State>, root: SourceFile<CheckedPhase>,
  children: ReadonlyMap<BodyId, ElaborationChild>, instance: BodyInstance,
  typing: ElaborationNoResult | { readonly kind: "ready"; readonly template: TypedBodyTemplate;
    readonly statementOf: (statement: Statement<CheckedPhase>) => Statement<TypedPhase> | ElaborationNoResult },
): Result<TirModuleRoot> | ElaborationNoResult {
  const statements: TirModuleStatement[] = [];
  let diagnostics: [Diagnostic, ...Diagnostic[]] | null = null;
  const causes: ElaborationCause[] = typing.kind === "no-result" ? [...typing.causes] : [];
  const append = (earned: readonly Diagnostic[]): void => {
    for (const diagnostic of earned) {
      if (diagnostics === null) diagnostics = [diagnostic];
      else diagnostics.push(diagnostic);
    }
  };
  for (const statement of root.statements.nodes) {
    const cut = deps.cuts.syntax(statement);
    if (cut !== null) { causes.push({ kind: "form", cut }); continue; }
    if (isInlineModuleStatement(statement)) {
      if (typing.kind === "no-result") continue;
      const selected = typing.statementOf(statement);
      if (selected.kind === "no-result") {
        causes.push(...selected.causes);
        append(selected.diagnostics);
      } else {
        if (selected.kind === "FunctionDeclaration") return defect("An executable module statement cannot supply a callable declaration.");
        statements.push({ kind: "ready-statement", node: selected });
      }
      continue;
    }
    let selected: Result<Extract<TirModuleStatement, { kind: "ready-statement" }>["node"]>;
    switch (statement.kind) {
      case "ImportDeclaration": case "ExportDeclaration": {
        const refusal = moduleLinkRefusal(deps, statement);
        if (refusal === null) {
          statements.push({ kind: "ready-statement", node: statement.kind === "ExportDeclaration" ? elaborateExport(statement) : elaborateImport(statement) });
          continue;
        }
        selected = { kind: "refused", diagnostics: refusal };
        break;
      }
      case "FunctionDeclaration": {
        if (statement.body === null) { selected = declarationFunction(deps, statement); break; }
        const body = statement.tsonic.body;
        const child = body === null ? undefined : children.get(body);
        if (child === undefined) return defect("A module function requires its actual child attempt.");
        if ("kind" in child && child.kind === "checked") {
          if (child.body.root !== statement.body || child.body.owner !== statement.tsonic.definition)
            return defect("An unopened callable must retain its actual checked declaration and body.");
          const index = statements.length;
          const unopened = { kind: "checked-declaration", node: statement } satisfies TirModuleStatement;
          statements.push(unopened);
          const retained = child.onRequired(ready => {
            if (statements[index] !== unopened) return defect("A required callable can be attached to its actual unopened slot only once.");
            const header = callable(deps, statement, ready);
            if (header.kind === "refused") return header;
            statements[index] = { kind: "ready-callable", node: header.value };
            return { kind: "ok", diagnostics: header.diagnostics, value: undefined };
          });
          if (retained.kind === "refused") return retained;
          continue;
        }
        if ("kind" in child) {
          causes.push(...child.causes);
          continue;
        }
        const ready = callable(deps, statement, child);
        if (ready.kind === "ok") {
          statements.push({ kind: "ready-callable", node: ready.value });
          continue;
        }
        selected = ready;
        break;
      }
      case "InterfaceDeclaration": selected = declarationInterface(deps, statement); break;
      case "TypeAliasDeclaration": selected = declarationAlias(deps, statement); break;
      default: return defect(`not elaborated yet: module statement ${statement.kind}.`);
    }
    if (selected.kind === "refused") {
      if (typePublicationRefusalOf(deps.typeWork) !== null)
        return { kind: "refused", diagnostics: diagnostics === null ? selected.diagnostics : [...diagnostics, ...selected.diagnostics] };
      append(selected.diagnostics);
      continue;
    }
    statements.push({ kind: "ready-statement", node: selected.value });
  }
  const [cause, ...others] = causes;
  if (cause !== undefined) return { kind: "no-result", instance, causes: [cause, ...others], diagnostics: diagnostics ?? [] };
  if (diagnostics !== null) return { kind: "refused", diagnostics };
  if (typing.kind !== "ready") return defect("A complete module requires its actual ready typing.");
  return { kind: "ok", diagnostics: [], value: { ...root, statements: { ...root.statements, nodes: statements },
    endOfFileToken: { ...root.endOfFileToken, tsonic: null },
    tsonic: { module: root.origin.module, template: typing.template } } };
}
