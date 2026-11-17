import type { Result } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, DefId } from "../ids/contract.js";
import type { CheckedPhase, Expression, FunctionDeclaration, ParameterDeclaration, SourceFile, Statement, VariableDeclaration } from "../ir-hir/contract.js";
import type { BodyTyping } from "../ir-infer/contract.js";
import type { TirBody, TypedBodyTemplate, TypedParameter, TypedPhase } from "../ir-tir/contract.js";
import type { ElaborateDeps, ElaborateInput } from "./contract.js";
import { artifactBindingsKey } from "../ir-types/index.js";
import { declarationAlias, declarationInterface, declarationModifiers as modifiers, declarationName as name, declarationType as annotation } from "./declarations.js";
import { elaborateExport, elaborateImport } from "./imports.js";

function defect(message: string): never {
  return throwInvariant({ owner: "elaborate", query: null, origin: null, message });
}

const templateOf = (body: TirBody): TypedBodyTemplate => ({ body: body.body, lexicalBindings: body.lexicalBindings, dependence: body.dependence });

export function elaborateParameter(deps: ElaborateDeps, node: ParameterDeclaration<CheckedPhase>, body: BodyId, selected: TypedParameter,
  initializer: Expression<TypedPhase> | null): ParameterDeclaration<TypedPhase> {
  if (node.name.kind !== "Identifier" || node.name.tsonic.role !== "declaration-name"
    || node.name.tsonic.declaration.kind !== "local") return defect("not elaborated yet: a nonlocal parameter declaration.");
  const local = node.name.tsonic.declaration.local;
  if (selected.local === null || local.body !== body || local.body !== selected.local.body || local.local !== selected.local.local)
    return defect("A parameter has no actual typed-body local association.");
  if (node.initializer === null ? initializer !== null || selected.initializer !== null
    : initializer === null || initializer.id !== node.initializer.id || initializer.parent !== node.id || selected.initializer === null)
    return defect("A parameter retains exactly its separately completed initializer syntax.");
  return { ...node, modifiers: modifiers(node.modifiers),
    dotDotDotToken: node.dotDotDotToken === null ? null : { ...node.dotDotDotToken, tsonic: null },
    questionToken: node.questionToken === null ? null : { ...node.questionToken, tsonic: null },
    name: name(node.name, selected.storage), type: annotation(deps, node.type), initializer, tsonic: selected };
}

function callable(deps: ElaborateDeps, node: FunctionDeclaration<CheckedPhase>, bodies: ReadonlyMap<BodyId, TirBody>): FunctionDeclaration<TypedPhase> {
  const checked = node.tsonic;
  const body = checked.body === null ? undefined : bodies.get(checked.body);
  if (body === undefined || body.owner !== checked.definition || body.root.kind !== "Block")
    return defect("A module function requires its actual completed callable body.");
  if (node.typeParameters !== null && node.typeParameters.nodes.length !== 0)
    return defect("not elaborated yet: a generic module callable declaration.");
  if (node.name === null) return defect("not elaborated yet: an unnamed module callable.");
  for (const endpoint of checked.signatures) {
    if (endpoint.body !== body.body || endpoint.signature !== body.signature)
      return defect("not elaborated yet: a separate advertised or changed callable endpoint.");
  }
  const signature = deps.signatureOf(body.signature);
  if (signature.declaration !== checked.definition) return defect("The typed body signature belongs to another declaration.");
  if (node.parameters.nodes.length !== body.params.length)
    return defect("The selected callable header must retain exactly its actual parameter inventory.");
  return { ...node, name: name(node.name, null), modifiers: modifiers(node.modifiers), typeParameters: null,
    parameters: { ...node.parameters, nodes: node.parameters.nodes.map((item, index) => {
      const selected = body.params[index];
      if (selected === undefined || selected.id !== item.id || selected.parent !== item.parent)
        return defect("The selected callable must reuse its actual typed parameter occurrences.");
      return selected;
    }) },
    type: annotation(deps, node.type), fullSignature: annotation(deps, node.fullSignature),
    asteriskToken: node.asteriskToken === null ? null : { ...node.asteriskToken, tsonic: null }, body: body.root,
    tsonic: { definition: checked.definition, parameters: checked.parameters, signatures: checked.signatures,
      template: templateOf(body), attributes: checked.attributes } };
}

export function elaborateVariable(deps: ElaborateDeps, node: VariableDeclaration<CheckedPhase>,
  bodies: ReadonlyMap<BodyId, TirBody>, definition: DefId): VariableDeclaration<TypedPhase> {
  const checked = node.tsonic;
  if (node.name.kind !== "Identifier" || checked.declaration.kind === "definition" && checked.declaration.definition !== definition)
    return defect("A variable requires its actual checked declaration and identifier.");
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
  return { ...node, name: name(node.name, storage), type: annotation(deps, node.type), initializer,
    exclamationToken: node.exclamationToken === null ? null : { ...node.exclamationToken, tsonic: null },
    tsonic: { declaration: checked.declaration, storage, initializer: checked.initializer } };
}

export function elaborateModuleBody(deps: ElaborateDeps, input: ElaborateInput, root: SourceFile<CheckedPhase>, typing: BodyTyping): Result<TirBody> {
  const { body, instance, solution, constraints } = input;
  const children = new Map<BodyId, TirBody>();
  for (const child of input.nestedBodies) {
    if (children.has(child.body) || artifactBindingsKey(child.bindings) !== artifactBindingsKey(instance.bindings))
      return defect("The module requires one canonical subtree per direct nested body under the same actual bindings.");
    children.set(child.body, child);
  }
  if (children.size !== body.nestedBodies.length || body.nestedBodies.some(nested => !children.has(nested)))
    return defect("The completed nested bodies must be exactly the module's actual direct body inventory.");
  if (body.locals.length !== 0 || body.params.length !== 0 || body.captures.length !== 0
    || constraints.constraints.length !== 0 || solution.constraints.length !== 0 || solution.variables.length !== 0)
    return defect("not elaborated yet: executable module values or storage.");
  const statements: Statement<TypedPhase>[] = root.statements.nodes.map(statement => {
    if (statement.kind === "ImportDeclaration") return elaborateImport(statement);
    if (statement.kind === "ExportDeclaration") return elaborateExport(statement);
    if (statement.kind === "FunctionDeclaration") return callable(deps, statement, children);
    if (statement.kind === "InterfaceDeclaration") return declarationInterface(deps, statement);
    if (statement.kind === "TypeAliasDeclaration") return declarationAlias(deps, statement);
    if (statement.kind === "VariableStatement") return { ...statement, modifiers: modifiers(statement.modifiers),
      declarationList: { ...statement.declarationList,
        declarations: { ...statement.declarationList.declarations,
          nodes: statement.declarationList.declarations.nodes.map(declaration => {
            if (declaration.tsonic.declaration.kind !== "definition") return defect("A module variable retains its actual definition target.");
            return elaborateVariable(deps, declaration, children, declaration.tsonic.declaration.definition);
          }) },
        tsonic: { role: "ordinary" } }, tsonic: null };
    return defect(`not elaborated yet: module statement ${statement.kind}.`);
  });
  const lexicalBindings = { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] };
  const typed: SourceFile<TypedPhase> = { ...root, statements: { ...root.statements, nodes: statements },
    endOfFileToken: { ...root.endOfFileToken, tsonic: null },
    tsonic: { module: root.origin.module, template: { body: body.body,
      lexicalBindings, dependence: "parametric" } } };
  return { kind: "ok", diagnostics: [], value: { body: body.body, owner: body.owner, bindings: instance.bindings,
    lexicalBindings,
    dependence: "parametric", signature: typing.signature, completion: typing.completion, yielded: typing.yielded, sent: typing.sent,
    root: typed, params: [], locals: [], nestedBodies: body.nestedBodies, captures: [], scopes: body.scopes, evidence: [],
    asynchronous: body.asynchronous, generator: body.generator } };
}
