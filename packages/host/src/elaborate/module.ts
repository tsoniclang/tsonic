import type { Result } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { BodyId, LocalId, TyId } from "../ids/contract.js";
import type { CheckedPhase, FunctionDeclaration, Identifier, ModifierList, ParameterDeclaration, SourceFile, Statement, TypeNode } from "../ir-hir/contract.js";
import type { BodyTyping } from "../ir-infer/contract.js";
import type { TirBody, TirParam, TypedBodyTemplate, TypedPhase } from "../ir-tir/contract.js";
import type { ElaborateDeps, ElaborateInput } from "./contract.js";

function defect(message: string): never {
  return throwInvariant({ owner: "elaborate", query: null, origin: null, message });
}

const templateOf = (body: TirBody): TypedBodyTemplate => ({ body: body.body, lexicalBindings: body.lexicalBindings, dependence: body.dependence });

function modifiers(input: ModifierList<CheckedPhase> | null): ModifierList<TypedPhase> | null {
  return input === null ? null : { ...input, nodes: input.nodes.map(node => {
    if (node.kind === "Decorator") return defect("not elaborated yet: a declaration decorator.");
    return { ...node, tsonic: null };
  }) };
}

function annotation(node: TypeNode<CheckedPhase> | null): TypeNode<TypedPhase> | null {
  if (node === null) return null;
  switch (node.kind) {
    case "NumberKeyword": case "BooleanKeyword": case "StringKeyword": case "AnyKeyword": case "UnknownKeyword":
    case "NeverKeyword": case "VoidKeyword":
      if (node.tsonic.type.kind !== "available") return defect("not elaborated yet: an unavailable declaration type.");
      return { ...node, tsonic: { type: node.tsonic.type.value, declarations: node.tsonic.referencedDefinitions } };
    default: return defect(`not elaborated yet: declaration type ${node.kind}.`);
  }
}

function name(node: Identifier<CheckedPhase>, storage: TyId | null): Identifier<TypedPhase> {
  if (node.tsonic.role !== "declaration-name") return defect("A declaration name does not retain its actual declaration target.");
  return { ...node, tsonic: { role: "declaration-name", declaration: node.tsonic.declaration, storage } };
}

function parameter(node: ParameterDeclaration<CheckedPhase>, body: TirBody, parameters: ReadonlyMap<LocalId, TirParam>): ParameterDeclaration<TypedPhase> {
  if (node.name.kind !== "Identifier" || node.name.tsonic.role !== "declaration-name"
    || node.name.tsonic.declaration.kind !== "local") return defect("not elaborated yet: a nonlocal parameter declaration.");
  const local = node.name.tsonic.declaration.local;
  const row = parameters.get(local.local);
  if (local.body !== body.body || row === undefined) return defect("A parameter has no actual typed-body row.");
  if (node.initializer !== null) return defect("not elaborated yet: parameter initializer syntax.");
  return { ...node, modifiers: modifiers(node.modifiers),
    dotDotDotToken: node.dotDotDotToken === null ? null : { ...node.dotDotDotToken, tsonic: null },
    questionToken: node.questionToken === null ? null : { ...node.questionToken, tsonic: null },
    name: name(node.name, row.storage), type: annotation(node.type), initializer: null,
    tsonic: { declaration: row.declaration, local, storage: row.storage, passing: row.passing, initializer: row.initializer } };
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
  const parameters = new Map(body.params.map(row => [row.local, row]));
  return { ...node, name: name(node.name, null), modifiers: modifiers(node.modifiers), typeParameters: null,
    parameters: { ...node.parameters, nodes: node.parameters.nodes.map(item => parameter(item, body, parameters)) },
    type: annotation(node.type), fullSignature: annotation(node.fullSignature),
    asteriskToken: node.asteriskToken === null ? null : { ...node.asteriskToken, tsonic: null }, body: body.root,
    tsonic: { definition: checked.definition, parameters: checked.parameters, signatures: checked.signatures,
      template: templateOf(body), attributes: checked.attributes } };
}

export function elaborateModuleBody(deps: ElaborateDeps, input: ElaborateInput, root: SourceFile<CheckedPhase>, typing: BodyTyping): Result<TirBody> {
  const { body, instance, solution, constraints } = input;
  const children = new Map<BodyId, TirBody>();
  for (const child of input.nestedBodies) {
    if (children.has(child.body) || child.bindings.kind !== "parametric")
      return defect("The module requires one canonical parametric subtree per direct nested body.");
    children.set(child.body, child);
  }
  if (children.size !== body.nestedBodies.length || body.nestedBodies.some(nested => !children.has(nested)))
    return defect("The completed nested bodies must be exactly the module's actual direct body inventory.");
  if (body.locals.length !== 0 || body.params.length !== 0 || body.captures.length !== 0
    || constraints.constraints.length !== 0 || solution.constraints.length !== 0 || solution.variables.length !== 0)
    return defect("not elaborated yet: executable module values or storage.");
  const statements: Statement<TypedPhase>[] = root.statements.nodes.map(statement => {
    if (statement.kind !== "FunctionDeclaration") return defect(`not elaborated yet: module statement ${statement.kind}.`);
    return callable(deps, statement, children);
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
