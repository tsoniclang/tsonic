import type { LocalId, TyId } from "../ids/contract.js";
import type {
  CapturedFact, CheckedClosure, CheckedContentImage, CheckedEnum, CheckedEnumMember, CheckedExport, CheckedExportAssignment, CheckedExportBinding, CheckedImport, CheckedModule,
  CheckedNamespace, CheckedNamespaceExport, CheckedProperty, CheckedStaticBlock, CheckedAggregate, CheckedApplication, CheckedBinary, CheckedBinding, CheckedBindingList, CheckedCallable,
  CheckedClass, CheckedClassExpression, CheckedDeclarationFacts, CheckedExpression, CheckedInstantiation, CheckedIteration,
  CheckedKeyword, CheckedLiteral, CheckedMember, CheckedName, CheckedPhase, CheckedProjection, CheckedProtocol, CheckedType,
  CheckedTypeAlias, CheckedTypeParameter, CheckedUnary, CheckedValue, CheckedVariable, CopyCheckedContent, CopyCheckedModule, HirApplication,
  HirArgument, HirBody, HirCandidate, HirCandidateList, HirCheckerViews, HirCoreCarrier, HirDiagnosticRoot, HirHeritage,
  HirLocal, HirMemoryFieldCapture, HirMemoryGeometryCapture, HirMemoryLayoutCapture, HirObservationCapture,
  HirProtocolFact, HirStoragePlace, ProjectCheckedContent, ProofObligation, SyntaxCopyResult, SyntaxForest, SyntaxImage, SyntaxPhaseCopy, SyntaxRootSlot, SyntaxWalkAdmission,
} from "./contract.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import { copied, holdSyntaxPayload } from "./copy-node.js";
import { createSyntaxCopyState } from "./copy-syntax.js";
import { createSyntaxForest } from "./walk.js";

const missingEvidence: InvariantFailure = { owner: "ir-hir", query: null, origin: null,
  message: "A checked projection must have complete dense evidence and use its actual admitted roots." };

function following<Before, After, Stop>(result: SyntaxCopyResult<Before, Stop>,
  next: (value: Before) => SyntaxCopyResult<After, Stop>,
): SyntaxCopyResult<After, Stop> {
  return result.kind === "refused" ? result : next(result.value);
}

function checkedProjector<Stop>(project: CheckedProjection<Stop>) {
  function admit<Value>(work: number, records: number, build: () => SyntaxCopyResult<Value, Stop>): SyntaxCopyResult<Value, Stop> {
    const stop = project.admit(work, records);
    return stop === null ? build() : { kind: "refused", stop };
  }

  function captured<Value>(field: CapturedFact<Value>,
    map: (value: Value) => SyntaxCopyResult<Value, Stop>,
  ): SyntaxCopyResult<CapturedFact<Value>, Stop> {
    return admit<CapturedFact<Value>>(1, 0, () => {
      if (field.kind === "unavailable") return copied(field);
      return admit(1, 1, () => following(map(field.value), value => copied({ kind: "available", value })));
    });
  }

  function vector<In, Out>(values: readonly In[], map: (row: In) => SyntaxCopyResult<Out, Stop>): SyntaxCopyResult<readonly Out[], Stop> {
    return admit(1, 1, () => {
      const result: Out[] = [];
      const length = values.length;
      for (let index = 0; index < length; index += 1) {
        const row = admit(1, 0, () => map(requirePresent(values[index], missingEvidence)));
        if (row.kind === "refused") return row;
        result.push(row.value);
      }
      return copied(result);
    });
  }

  function optional<Value>(map: (value: Value) => SyntaxCopyResult<Value, Stop>):
    (value: Value | null) => SyntaxCopyResult<Value | null, Stop> {
    return value => value === null ? copied(null) : map(value);
  }

  const optionalType = optional(project.type);
  const optionalSignature = optional(project.signature);

  function views(row: HirCheckerViews): SyntaxCopyResult<HirCheckerViews, Stop> {
    return admit(3, 1, () => following(captured(row.read, project.type), read =>
      following(captured(row.declared, optionalType), declared =>
        following(captured(row.contextual, optionalType), contextual => copied({ read, declared, contextual })))));
  }

  function storage(row: HirStoragePlace): SyntaxCopyResult<HirStoragePlace, Stop> {
    return admit(4, 1, () => following(captured(row.read, project.type), read =>
      following(captured(row.write, optionalType), write => copied({ base: row.base, step: row.step, read, write }))));
  }

  function geometry(row: HirMemoryGeometryCapture): SyntaxCopyResult<HirMemoryGeometryCapture, Stop> {
    return admit(9, 1, () => following(captured(row.source, project.type), source => copied({
      source, dataLayoutExpression: row.dataLayoutExpression, dataLayout: row.dataLayout,
      byteSizeExpression: row.byteSizeExpression, byteSize: row.byteSize, byteAlignmentExpression: row.byteAlignmentExpression,
      byteAlignment: row.byteAlignment, strideExpression: row.strideExpression, stride: row.stride,
    })));
  }

  function memory(row: HirMemoryLayoutCapture | HirMemoryFieldCapture): SyntaxCopyResult<HirMemoryLayoutCapture | HirMemoryFieldCapture, Stop> {
    return admit<HirMemoryLayoutCapture | HirMemoryFieldCapture>(1, 0, () => {
      switch (row.kind) {
        case "data-layout": return admit(6, 1, () => following(captured(row.bindings, project.bindings), bindings => copied({
          kind: "data-layout", occurrence: row.occurrence, bindings, declaration: row.declaration, fingerprint: row.fingerprint,
          byteOrder: row.byteOrder, addressWidth: row.addressWidth,
        })));
        case "value": return admit(5, 1, () => following(captured(row.bindings, project.bindings), bindings =>
          following(geometry(row.geometry), ready => copied({
            kind: "value", occurrence: row.occurrence, bindings, geometry: ready, fieldExpressions: row.fieldExpressions, fields: row.fields,
          }))));
        case "array": return admit(8, 1, () => following(captured(row.bindings, project.bindings), bindings =>
          following(geometry(row.geometry), ready => copied({
            kind: "array", occurrence: row.occurrence, bindings, geometry: ready, extentExpression: row.extentExpression,
            length: row.length, runtimeBase: row.runtimeBase, elementExpression: row.elementExpression, element: row.element,
          }))));
        case "field": return admit(16, 1, () => following(captured(row.bindings, project.bindings), bindings =>
          following(captured(row.source, project.type), source => following(captured(row.value, project.type), value => copied({
            kind: "field", occurrence: row.occurrence, bindings, source, selector: row.selector, selection: row.selection,
            key: row.key, origins: row.origins, selectedDeclarations: row.selectedDeclarations, primary: row.primary, value,
            fieldLayoutExpression: row.fieldLayoutExpression, fieldLayout: row.fieldLayout,
            byteOffsetExpression: row.byteOffsetExpression, byteOffset: row.byteOffset,
            byteAlignmentExpression: row.byteAlignmentExpression, byteAlignment: row.byteAlignment,
          })))));
      }
    });
  }

  function observation(row: HirObservationCapture): SyntaxCopyResult<HirObservationCapture, Stop> {
    return admit(9, 1, () => following(captured(row.bindings, project.bindings), bindings =>
      following(captured(row.result, project.type), result => copied({
        occurrence: row.occurrence, operation: row.operation, bindings, operand: row.operand, layout: row.layout,
        selector: row.selector, field: row.field, result, value: row.value,
      }))));
  }

  function valueFields(row: CheckedValue): SyntaxCopyResult<CheckedValue, Stop> {
    return admit(4, 1, () => following(views(row.views), views =>
      following(captured(row.place, optional(storage)), place =>
        following(captured(row.memory, optional(memory)), memory =>
          following(captured(row.observation, optional(observation)), observation => copied({ views, place, memory, observation }))))));
  }

  function carrier<Value extends HirCoreCarrier>(fields: number): (row: Value) => SyntaxCopyResult<Value, Stop> {
    return row => admit(fields, 1, () => following(project.core(row.core), core => copied({ ...row, core })));
  }

  function expression<Value extends CheckedExpression>(fields: number): (row: Value) => SyntaxCopyResult<Value, Stop> {
    return row => admit(fields, 1, () => following(project.core(row.core), core =>
      following(valueFields(row), ready => copied({ ...row, ...ready, core }))));
  }

  function name(row: CheckedName): SyntaxCopyResult<CheckedName, Stop> {
    return admit(1, 0, () => {
      switch (row.role) {
        case "value": return valueRole(row, 4);
        case "shorthand-value": return valueRole(row, 5);
        case "assignment-target": return admit(7, 1, () => following(project.core(row.core), core =>
          following(views(row.views), views => following(captured(row.place, storage), place => copied({ ...row, core, views, place })))));
        case "property-name": case "enum-qualifier": return carrier<CheckedName>(4)(row);
        default: return carrier<CheckedName>(3)(row);
      }
    });
  }

  function valueRole<Value extends HirCoreCarrier & { readonly value: CheckedValue }>(row: Value, fields: number): SyntaxCopyResult<Value, Stop> {
    return admit(fields + 2, 1, () => following(project.core(row.core), core =>
      following(valueFields(row.value), value => copied({ ...row, core, value }))));
  }

  function typeRole<Value extends HirCoreCarrier & { readonly type: CapturedFact<TyId> }>(row: Value, fields: number): SyntaxCopyResult<Value, Stop> {
    return admit(fields + 2, 1, () => following(project.core(row.core), core =>
      following(captured(row.type, project.type), type => copied({ ...row, core, type }))));
  }

  function literal(row: CheckedLiteral): SyntaxCopyResult<CheckedLiteral, Stop> {
    return admit(1, 0, () => {
      switch (row.role) {
        case "value": return valueRole(row, 4);
        case "type-literal": return typeRole(row, 4);
        case "property-name": return carrier<CheckedLiteral>(4)(row);
        default: return carrier<CheckedLiteral>(3)(row);
      }
    });
  }

  function keyword(row: CheckedKeyword): SyntaxCopyResult<CheckedKeyword, Stop> {
    return admit<CheckedKeyword>(1, 0, () => row.role === "value" ? valueRole(row, 3) : typeRole(row, 4));
  }

  function targetRole<Value extends HirCoreCarrier & {
    readonly value: CheckedValue; readonly target: CapturedFact<HirStoragePlace>;
  }>(row: Value): SyntaxCopyResult<Value, Stop> {
    return admit(7, 1, () => following(project.core(row.core), core =>
      following(valueFields(row.value), value => following(captured(row.target, storage), target => copied({ ...row, core, value, target })))));
  }

  function binary(row: CheckedBinary): SyntaxCopyResult<CheckedBinary, Stop> {
    return admit<CheckedBinary>(1, 0, () => row.role === "assignment" ? targetRole(row) : valueRole(row, 3));
  }

  function unary(row: CheckedUnary): SyntaxCopyResult<CheckedUnary, Stop> {
    return admit<CheckedUnary>(1, 0, () => {
      switch (row.role) {
        case "value": return valueRole(row, 3);
        case "update": return targetRole(row);
        case "type-literal": return typeRole(row, 4);
      }
    });
  }

  function instantiation(row: CheckedInstantiation): SyntaxCopyResult<CheckedInstantiation, Stop> {
    return admit<CheckedInstantiation>(1, 0, () => row.role === "value" ? valueRole(row, 3) : typeRole(row, 4));
  }

  function aggregate(row: CheckedAggregate): SyntaxCopyResult<CheckedAggregate, Stop> {
    return admit<CheckedAggregate>(1, 0, () => row.role === "value" ? valueRole(row, 3) : admit(5, 1, () =>
      following(project.core(row.core), core => following(views(row.views), views => copied({ role: "assignment-pattern", core, views })))));
  }

  function application(row: HirApplication): SyntaxCopyResult<HirApplication, Stop> {
    return admit(6, 1, () => following(vector(row.arguments, argument => admit<HirArgument>(1, 0, () => {
      if (argument.kind === "value") return copied(argument);
      return admit(2, 1, () => following(captured(argument.tuple, optional(tuple => vector(tuple, project.type))),
        tuple => copied({ kind: "spread", expression: argument.expression, tuple })));
    })), args => following(vector(row.typeArguments, project.type), typeArguments =>
      following(captured(row.resolvedSignature, optionalSignature), resolvedSignature => copied({
        kind: row.kind, receiver: row.receiver, arguments: args, typeArguments, candidates: row.candidates, resolvedSignature,
      })))));
  }

  function applicationValue(row: CheckedApplication): SyntaxCopyResult<CheckedApplication, Stop> {
    return admit(2, 1, () => following(project.core(row.core), core => following(valueFields(row), ready =>
      following(captured(row.application, application), application => copied({ ...ready, core, application })))));
  }

  function member(row: CheckedMember): SyntaxCopyResult<CheckedMember, Stop> {
    return admit(4, 1, () => following(project.core(row.core), core => {
      if (row.role === "enum-member") return following(valueFields(row.value), value =>
        copied({ role: "enum-member", core, value, selectedMember: row.selectedMember }));
      return following(captured(row.accessor, optional(application)), (accessor): SyntaxCopyResult<CheckedMember, Stop> => {
        const origins = row.origins;
        switch (row.role) {
          case "value": return admit(1, 0, () => following(valueFields(row.value), value =>
            copied({ role: "value", core, accessor, origins, value })));
          case "assignment-target": return admit(3, 0, () => following(views(row.views), views =>
            following(captured(row.place, storage), place =>
              copied({ role: "assignment-target", core, accessor, origins, views, place, access: row.access }))));
        }
      });
    }));
  }

  function protocol(row: HirProtocolFact): SyntaxCopyResult<HirProtocolFact, Stop> {
    return admit<HirProtocolFact>(1, 0, () => {
      switch (row.kind) {
        case "iterate":
        case "spread": return admit(10, 1, () =>
          following(project.type(row.iterator), iterator => following(project.type(row.element), element =>
            following(project.type(row.completion), completion => following(project.type(row.sent), sent =>
              following(project.signature(row.next), next => following(optionalSignature(row.finish), finish =>
                following(optionalSignature(row.fail), fail => copied({
                  kind: row.kind, asynchronous: row.asynchronous, subject: row.subject,
                  iterator, element, completion, sent, next, finish, fail,
                })))))))));
        case "await": return admit(2, 1, () => following(project.type(row.completion), completion => copied({
          kind: "await", subject: row.subject, completion,
        })));
        case "yield":
        case "delegate": return admit(5, 1, () => following(project.type(row.yielded), yielded =>
          following(project.type(row.sent), sent => following(project.type(row.completion), completion =>
            copied({ kind: row.kind, subject: row.subject, yielded, sent, completion })))));
        case "dispose": return admit(3, 1, () => following(project.signature(row.signature), signature =>
          copied({ kind: "dispose", subject: row.subject, asynchronous: row.asynchronous, signature })));
      }
    });
  }

  function protocolValue(row: CheckedProtocol): SyntaxCopyResult<CheckedProtocol, Stop> {
    return admit(2, 1, () => following(project.core(row.core), core => following(valueFields(row), ready =>
      following(captured(row.protocol, protocol), protocol => copied({ ...ready, core, protocol })))));
  }

  function typeSyntax(row: CheckedType): SyntaxCopyResult<CheckedType, Stop> {
    return admit(3, 1, () => following(project.core(row.core), core =>
      following(captured(row.type, project.type), type => copied({ core, type, referencedDefinitions: row.referencedDefinitions }))));
  }

  function declarationPart(row: CheckedDeclarationFacts) {
    return admit(4, 1, () => following(project.core(row.core), core =>
      following(captured(row.memory, optional(memory)), memory => copied({ core, memory, parent: row.parent, attributes: row.attributes }))));
  }

  function declaration<Value extends CheckedDeclarationFacts>(fields: number): (row: Value) => SyntaxCopyResult<Value, Stop> {
    return row => admit(fields, 1, () => following(declarationPart(row), ready => copied({ ...row, ...ready })));
  }

  function callable(row: CheckedCallable): SyntaxCopyResult<CheckedCallable, Stop> {
    return admit(4, 1, () => following(declarationPart(row), ready =>
      following(vector(row.parameters, project.parameter), parameters =>
        following(vector(row.signatures, endpoint => admit(4, 1, () =>
          following(project.signature(endpoint.signature), signature => copied({
            declaration: endpoint.declaration, role: endpoint.role, body: endpoint.body, signature,
          })))), signatures => copied({ ...ready, definition: row.definition, body: row.body, parameters, signatures })))));
  }

  function heritage(entry: HirHeritage): SyntaxCopyResult<HirHeritage, Stop> {
    return admit(2, 1, () => following(project.type(entry.type), type => copied({ role: entry.role, type })));
  }

  function classFields(row: CheckedClass) {
    return admit(4, 1, () => following(vector(row.parameters, project.parameter), parameters =>
      following(vector(row.heritage, heritage), heritage => copied({
        definition: row.definition, members: row.members, parameters, heritage,
      }))));
  }

  function classDeclaration(row: CheckedClass): SyntaxCopyResult<CheckedClass, Stop> {
    return admit(0, 1, () => following(declarationPart(row), common =>
      following(classFields(row), specific => copied({ ...common, ...specific }))));
  }

  function classExpression(row: CheckedClassExpression): SyntaxCopyResult<CheckedClassExpression, Stop> {
    return admit(2, 1, () => following(project.core(row.core), core => following(valueFields(row), common =>
      following(classFields(row), specific => copied({ ...common, ...specific, core, parent: row.parent, attributes: row.attributes })))));
  }

  function typeAlias(row: CheckedTypeAlias): SyntaxCopyResult<CheckedTypeAlias, Stop> {
    return admit(3, 1, () => following(declarationPart(row), ready =>
      following(vector(row.parameters, project.parameter), parameters =>
        following(captured(row.type, project.type), type => copied({ ...ready, definition: row.definition, parameters, type })))));
  }

  function variableFields<Value>(row: CheckedVariable, fields: number, complete: (value: CheckedVariable) => Value): SyntaxCopyResult<Value, Stop> {
    return admit(fields, 1, () => following(declarationPart(row), ready =>
      following(captured(row.declaredType, optionalType), declaredType => {
        const bound = row.inferredTypeBound;
        return following(optional((fact: NonNullable<CheckedVariable["inferredTypeBound"]>) => captured(fact, value =>
          typeof value === "number" ? project.type(value) : admit(3, 1, () => following(project.type(value.type), type =>
            following(optional((sources: readonly LocalId[]) =>
              vector(sources, copied))(value.sources), sources => copied({ type, alias: value.alias, sources }))))))(bound), inferredTypeBound =>
          copied(complete({ ...ready, declaration: row.declaration, declaredType, inferredTypeBound, initializer: row.initializer })));
      })));
  }
  const variable = (row: CheckedVariable) => variableFields(row, 4, value => value);
  const enumMember = (row: CheckedEnumMember) => variableFields(row, 5, value => ({ ...value, valueSource: row.valueSource }));

  function binding(row: CheckedBinding): SyntaxCopyResult<CheckedBinding, Stop> {
    return admit(3, 1, () => following(project.core(row.core), core =>
      following(captured(row.declaredType, optionalType), declaredType => copied({ core, declaration: row.declaration, declaredType }))));
  }

  function bindingList(row: CheckedBindingList): SyntaxCopyResult<CheckedBindingList, Stop> {
    return admit(2, 1, () => following(project.core(row.core), core =>
      following(vector(row.disposal, item => captured(item, protocol)), disposal => copied({ core, disposal }))));
  }

  function iteration(row: CheckedIteration): SyntaxCopyResult<CheckedIteration, Stop> {
    return admit(2, 1, () => following(project.core(row.core), core =>
      following(captured(row.protocol, optional(protocol)), protocol => copied({ core, protocol }))));
  }

  function typeParameter(row: CheckedTypeParameter): SyntaxCopyResult<CheckedTypeParameter, Stop> {
    return admit(2, 1, () => following(declarationPart(row), ready =>
      following(project.parameter(row.parameter), parameter => copied({ ...ready, definition: row.definition, parameter }))));
  }

  function local(row: HirLocal): SyntaxCopyResult<HirLocal, Stop> {
    return admit(7, 1, () => following(captured(row.checkerSlot, project.type), checkerSlot => copied({
      id: row.id, declaration: row.declaration, name: row.name, role: row.role, checkerSlot,
      capturedFrom: row.capturedFrom, mutable: row.mutable,
    })));
  }

  function candidate(row: HirCandidate): SyntaxCopyResult<HirCandidate, Stop> {
    return admit(6, 1, () => following(captured(row.appliedSignature, project.signature), appliedSignature =>
      following(captured(row.bindings, project.bindings), bindings =>
        following(vector(row.contributions, contribution => admit(5, 1, () =>
          following(project.component(contribution.component), component =>
            following(captured(contribution.type, project.type), type => copied({
              parameter: contribution.parameter, role: contribution.role, source: contribution.source, component, type,
            }))))), contributions => copied({
          ordinal: row.ordinal, declaration: row.declaration, appliedSignature, bindings,
          conditionalFailure: row.conditionalFailure, contributions,
        })))));
  }

  function candidateList(row: HirCandidateList): SyntaxCopyResult<HirCandidateList, Stop> {
    return admit(2, 1, () => following(vector(row.candidates, candidate), candidates => copied({ id: row.id, candidates })));
  }

  function body(row: HirBody, image: SyntaxImage<CheckedPhase>): SyntaxCopyResult<HirBody, Stop> {
    return admit(11, 1, () => following(vector(row.locals, local), locals =>
      following(vector(row.candidateLists, candidateList), candidateLists => copied({
        body: row.body, owner: row.owner, params: row.params, locals,
        root: requirePresent(image.bodyRootOf(row.root) ?? undefined, missingEvidence),
        captures: row.captures, scopes: row.scopes, asynchronous: row.asynchronous, generator: row.generator,
        candidateLists, nestedBodies: row.nestedBodies,
      }))));
  }

  function obligation(row: ProofObligation): SyntaxCopyResult<ProofObligation, Stop> {
    return admit<ProofObligation>(1, 0, () => {
      if (row.kind !== "write-fit") return copied(row);
      return admit(5, 1, () => following(project.type(row.destinationType), destinationType => copied({
        kind: "write-fit", ordinal: row.ordinal, occurrence: row.occurrence, value: row.value,
        destination: row.destination, destinationType,
      })));
    });
  }

  function diagnosticRoot(row: HirDiagnosticRoot): SyntaxCopyResult<HirDiagnosticRoot, Stop> {
    return admit(3, 1, () => following(vector(row.obligations, obligation), obligations => copied({
      diagnostic: row.diagnostic, owner: row.owner, obligations,
    })));
  }

  function ready<Value>(project: (value: Value) => SyntaxCopyResult<Value, Stop>) {
    return (value: Value) => following(project(value), value => holdSyntaxPayload<Value, null>(value));
  }

  const phase: SyntaxPhaseCopy<CheckedPhase, Stop, null> = {
    ArrayLiteralExpression: ready(aggregate),
    ArrayTypeNode: ready(typeSyntax),
    ArrowFunction: ready(expression<CheckedClosure>(7)),
    AsExpression: ready(expression<CheckedExpression>(5)),
    AwaitExpression: ready(protocolValue),
    BigIntLiteral: ready(literal),
    BinaryExpression: ready(binary),
    BindingElement: ready(binding),
    BindingPattern: ready(binding),
    CallExpression: ready(applicationValue),
    CallSignatureDeclaration: ready(callable),
    CaseClause: holdSyntaxPayload,
    ClassDeclaration: ready(classDeclaration),
    ClassExpression: ready(classExpression),
    ClassStaticBlockDeclaration: ready(declaration<CheckedStaticBlock>(6)),
    ComputedPropertyName: ready(carrier<CheckedProperty>(3)),
    ConditionalExpression: ready(expression<CheckedExpression>(5)),
    ConditionalTypeNode: ready(typeSyntax),
    ConstructSignatureDeclaration: ready(callable),
    ConstructorDeclaration: ready(callable),
    ConstructorTypeNode: ready(typeSyntax),
    Decorator: ready(copied),
    DeleteExpression: ready(expression<CheckedExpression>(5)),
    ElementAccessExpression: ready(member),
    EnumDeclaration: ready(declaration<CheckedEnum>(7)),
    EnumMember: ready(enumMember),
    ExportAssignment: ready(declaration<CheckedExportAssignment>(5)),
    ExportDeclaration: ready(carrier<CheckedExport>(2)),
    ExportSpecifier: ready(carrier<CheckedExportBinding>(2)),
    ExpressionWithTypeArguments: ready(instantiation),
    ForInOrOfStatement: ready(iteration),
    FunctionDeclaration: ready(callable),
    FunctionExpression: ready(expression<CheckedClosure>(7)),
    FunctionTypeNode: ready(typeSyntax),
    GetAccessorDeclaration: ready(callable),
    HeritageClause: ready(copied),
    Identifier: ready(name),
    ImportAttribute: ready(carrier<CheckedProperty>(3)),
    ImportClause: ready(carrier<CheckedImport>(3)),
    ImportDeclaration: ready(carrier<CheckedImport>(3)),
    ImportEqualsDeclaration: ready(carrier<CheckedImport>(3)),
    ImportSpecifier: ready(carrier<CheckedImport>(3)),
    ImportTypeNode: ready(typeSyntax),
    IndexSignatureDeclaration: ready(callable),
    IndexedAccessTypeNode: ready(typeSyntax),
    InferTypeNode: ready(typeSyntax),
    InterfaceDeclaration: ready(classDeclaration),
    IntersectionTypeNode: ready(typeSyntax),
    JSDocAllType: ready(typeSyntax),
    JSDocNameReference: ready(typeSyntax),
    JSDocNonNullableType: ready(typeSyntax),
    JSDocNullableType: ready(typeSyntax),
    JSDocOptionalType: ready(typeSyntax),
    JSDocSignature: ready(typeSyntax),
    JSDocTypeExpression: ready(typeSyntax),
    JSDocTypeLiteral: ready(typeSyntax),
    JSDocVariadicType: ready(typeSyntax),
    JsxAttributes: ready(expression<CheckedExpression>(5)),
    JsxClosingFragment: ready(expression<CheckedExpression>(5)),
    JsxElement: ready(expression<CheckedExpression>(5)),
    JsxExpression: ready(expression<CheckedExpression>(5)),
    JsxFragment: ready(expression<CheckedExpression>(5)),
    JsxNamespacedName: ready(expression<CheckedExpression>(5)),
    JsxOpeningElement: ready(expression<CheckedExpression>(5)),
    JsxOpeningFragment: ready(expression<CheckedExpression>(5)),
    JsxSelfClosingElement: ready(expression<CheckedExpression>(5)),
    JsxText: ready(expression<CheckedExpression>(5)),
    KeywordExpression: ready(keyword),
    KeywordTypeNode: ready(typeSyntax),
    LiteralTypeNode: ready(typeSyntax),
    MappedTypeNode: ready(typeSyntax),
    MetaProperty: ready(expression<CheckedExpression>(5)),
    MethodDeclaration: ready(callable),
    MethodSignatureDeclaration: ready(callable),
    ModuleDeclaration: ready(declaration<CheckedNamespace>(6)),
    NamedTupleMember: ready(typeSyntax),
    NamespaceExport: ready(declaration<CheckedNamespaceExport>(6)),
    NamespaceExportDeclaration: ready(carrier<CheckedExportBinding>(2)),
    NamespaceImport: ready(carrier<CheckedImport>(3)),
    NewExpression: ready(applicationValue),
    NoSubstitutionTemplateLiteral: ready(literal),
    NonNullExpression: ready(expression<CheckedExpression>(5)),
    NumericLiteral: ready(literal),
    ObjectLiteralExpression: ready(aggregate),
    OmittedExpression: ready(expression<CheckedExpression>(5)),
    OptionalTypeNode: ready(typeSyntax),
    ParameterDeclaration: ready(variable),
    ParenthesizedExpression: ready(expression<CheckedExpression>(5)),
    ParenthesizedTypeNode: ready(typeSyntax),
    PartiallyEmittedExpression: ready(expression<CheckedExpression>(5)),
    PostfixUnaryExpression: ready(unary),
    PrefixUnaryExpression: ready(unary),
    PrivateIdentifier: ready(name),
    PropertyAccessExpression: ready(member),
    PropertyAssignment: ready(carrier<CheckedProperty>(3)),
    PropertyDeclaration: ready(variable),
    PropertySignatureDeclaration: ready(variable),
    QualifiedName: ready(name),
    RegularExpressionLiteral: ready(expression<CheckedExpression>(5)),
    RestTypeNode: ready(typeSyntax),
    SatisfiesExpression: ready(expression<CheckedExpression>(5)),
    SetAccessorDeclaration: ready(callable),
    ShorthandPropertyAssignment: ready(carrier<CheckedProperty>(3)),
    SourceFile: ready(declaration<CheckedModule>(6)),
    SpreadAssignment: ready(copied),
    SpreadElement: ready(protocolValue),
    StringLiteral: ready(literal),
    SyntheticReferenceExpression: ready(expression<CheckedExpression>(5)),
    TaggedTemplateExpression: ready(applicationValue),
    TemplateExpression: ready(expression<CheckedExpression>(5)),
    TemplateLiteralTypeNode: ready(typeSyntax),
    TemplateLiteralTypeSpan: ready(typeSyntax),
    ThisTypeNode: ready(typeSyntax),
    TupleTypeNode: ready(typeSyntax),
    TypeAliasDeclaration: ready(typeAlias),
    TypeAssertion: ready(expression<CheckedExpression>(5)),
    TypeLiteralNode: ready(typeSyntax),
    TypeOfExpression: ready(expression<CheckedExpression>(5)),
    TypeOperatorNode: ready(typeSyntax),
    TypeParameterDeclaration: ready(typeParameter),
    TypePredicateNode: ready(typeSyntax),
    TypeQueryNode: ready(typeSyntax),
    TypeReferenceNode: ready(typeSyntax),
    UnionTypeNode: ready(typeSyntax),
    VariableDeclaration: ready(variable),
    VariableDeclarationList: ready(bindingList),
    VoidExpression: ready(expression<CheckedExpression>(5)),
    YieldExpression: ready(protocolValue),
  };

  return { phase, admit, vector, body, diagnosticRoot };
}

function checkedContentImage<Stop>(copier: ReturnType<typeof checkedProjector<Stop>>, image: SyntaxImage<CheckedPhase>): CheckedContentImage<Stop> {
  return {
    syntax: image,
    projectModule: source => copier.admit(9, 2, () => {
      const tree = requirePresent(image.sourceFileOf(source.tree) ?? undefined, missingEvidence);
      return following(copier.vector(source.bodies, row => copier.body(row, image)), bodies =>
        following(copier.vector(source.obligations, copier.diagnosticRoot), obligations => copied({
          module: { module: source.module, tree,
            items: source.items, bodies, exports: source.exports, bindings: source.bindings, moduleLinks: source.moduleLinks,
            checkerDiagnostics: source.checkerDiagnostics, obligations },
          syntax: image,
        })));
    }),
  };
}

export const copyCheckedContent: CopyCheckedContent = <Stop>(
  forest: SyntaxForest<CheckedPhase>, project: CheckedProjection<Stop>,
): SyntaxCopyResult<CheckedContentImage<Stop>, Stop> => {
  let projector: ReturnType<typeof checkedProjector<Stop>> | undefined;
  const syntax = forest.copy<Stop, null>(() => {
    const stop = project.admit(2, 2);
    if (stop !== null) return { kind: "refused", stop };
    projector = checkedProjector(project);
    return copied(projector.phase);
  }, node => project.admit(1, 1) ?? project.syntaxNode(node), null);
  return following(syntax, image => copied(checkedContentImage(requirePresent(projector, missingEvidence), image)));
};

export const projectCheckedContent: ProjectCheckedContent = <Stop, SupplyStop>(
  candidate: Iterable<SyntaxRootSlot<CheckedPhase>> | null, walk: SyntaxWalkAdmission<CheckedPhase, Stop>,
  project: CheckedProjection<Stop>, independent: (candidate: SyntaxImage<CheckedPhase> | null) =>
    SyntaxCopyResult<Iterable<SyntaxRootSlot<CheckedPhase>> | null, Stop | SupplyStop>,
): SyntaxCopyResult<CheckedContentImage<Stop> | null, Stop | SupplyStop> => {
  let forest: ReturnType<typeof createSyntaxForest<CheckedPhase, Stop>> | undefined;
  let projector: ReturnType<typeof checkedProjector<Stop>> | undefined;
  let copy: ReturnType<typeof createSyntaxCopyState<CheckedPhase, Stop, null>> | undefined;
  let settled = 0;
  let built = 0;
  const refuse = (stop: Stop): SyntaxCopyResult<never, Stop> => ({ kind: "refused", stop });
  const append = (roots: Iterable<SyntaxRootSlot<CheckedPhase>>): Stop | null => {
    if (forest === undefined) {
      const setup = project.admit(1, 1);
      if (setup !== null) return setup;
      forest = createSyntaxForest<CheckedPhase, Stop>(walk);
    }
    const walked = forest.append(roots);
    if (walked !== null) return walked;
    if (copy === undefined) {
      const setup = project.admit(2, 2);
      if (setup !== null) return setup;
      projector = checkedProjector(project);
      const originals = forest;
      copy = createSyntaxCopyState<CheckedPhase, Stop, null>(projector.phase,
        node => project.admit(1, 1) ?? (originals.hasStructure(node) ? null : project.syntaxNode(node)), originals);
    }
    for (; settled < forest.nodes.length; settled += 1) {
      const stopped = copy.prepare(requirePresent(forest.nodes[settled], missingEvidence), settled);
      if (stopped !== null) return stopped;
    }
    const order = forest.postorder;
    function* suffix() {
      for (; built < order.length; built += 1) yield requirePresent(order[built], missingEvidence);
    }
    copy.materialize(suffix(), null);
    return null;
  };
  const stopped = candidate === null ? null : append(candidate);
  if (stopped !== null) return refuse(stopped);
  const endOfCandidate = settled;
  const prefix = candidate === null ? null : requirePresent(copy, missingEvidence).imageThrough(endOfCandidate);
  const remaining = independent(prefix);
  if (remaining.kind === "refused") return remaining;
  const stoppedAfterEvidence = remaining.value === null ? null : append(remaining.value);
  if (stoppedAfterEvidence !== null) return refuse(stoppedAfterEvidence);
  if (candidate === null && remaining.value === null) return copied(null);
  if (prefix !== null && settled === endOfCandidate) return copied(checkedContentImage(requirePresent(projector, missingEvidence), prefix));
  if (prefix !== null) {
    const reserve = project.admit(1, 1);
    if (reserve !== null) return refuse(reserve);
  }
  const complete = requirePresent(copy, missingEvidence).imageThrough(settled);
  return copied(checkedContentImage(requirePresent(projector, missingEvidence), complete));
};

export const copyCheckedModule: CopyCheckedModule = (source, forest, project) =>
  following(copyCheckedContent(forest, project), image => image.projectModule(source));
