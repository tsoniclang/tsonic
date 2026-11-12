import { constructBindingPattern, constructImportDeclaration } from "./text-syntax-construction.js";
import { lazyReader, literalReader, nullableReader, sequenceReader } from "./text-construction.js";
import type { TirRecordCodec } from "./text-layouts.js";
import type {
  TypedBinding, TypedBindingElement, TypedBindingPattern, TypedControlTransfer, TypedExport, TypedExportAssignment, TypedExportBinding, TypedImport, TypedImportBinding, TypedIteration, TypedNamespace, TypedParameter, TypedPhase, TypedStorageDeclaration, TypedVariableList
} from "./contract.js";
import type {
  Origin
} from "../ids/contract.js";
import type {
  BindingElement, BindingPattern, BreakStatement, CaseBlock, CaseClause, CaseOrDefaultClause, CatchClause, ClassElement, ContinueStatement, DebuggerStatement, DefaultClause, DoStatement, EmptyStatement, ExportAssignment, ExportDeclaration, ExportSpecifier, ExpressionStatement, ForInStatement, ForOfStatement, ForStatement, HeritageClause, IfStatement, ImportAttribute, ImportAttributes, ImportClause, ImportDeclaration, ImportEqualsDeclaration, ImportSpecifier, LabeledStatement, MissingDeclaration, ModifierList, ModuleBlock, ModuleDeclaration, NamedExports, NamedImports, NamespaceExport, NamespaceExportDeclaration, NamespaceImport, NodeList, NotEmittedStatement, ParameterDeclaration, PropertyDeclaration, ReturnStatement, SemicolonClassElement, Statement, SwitchStatement, TextRange, ThrowStatement, TryStatement, VariableDeclaration, VariableDeclarationList, VariableStatement, WhileStatement, WithStatement
} from "../ir-hir/contract.js";
import type { TirTextKernel, TirTypedRecordWork } from "./text-layouts.js";
import { scalarWork, syntaxReference, nullableWork, sequenceWork } from "./text-layouts.js";

export interface SyntaxStatementsTextReads {
  readonly work_L_ExportSpecifier_: TirRecordCodec<NodeList<ExportSpecifier<TypedPhase>>>;
  readonly work_L_ImportAttribute_: TirRecordCodec<NodeList<ImportAttribute<TypedPhase>>>;
  readonly work_L_ImportSpecifier_: TirRecordCodec<NodeList<ImportSpecifier<TypedPhase>>>;
  readonly work_ModifierList: TirRecordCodec<ModifierList<TypedPhase>>;
  readonly work_Origin: TirRecordCodec<Origin>;
  readonly work_TextRange: TirRecordCodec<TextRange>;
  readonly work_TypedBinding: TirRecordCodec<TypedBinding>;
  readonly work_TypedBindingElement: TirRecordCodec<TypedBindingElement>;
  readonly work_TypedBindingPattern: TirRecordCodec<TypedBindingPattern>;
  readonly work_TypedControlTransfer: TirRecordCodec<TypedControlTransfer>;
  readonly work_TypedExport: TirRecordCodec<TypedExport>;
  readonly work_TypedExportAssignment: TirRecordCodec<TypedExportAssignment>;
  readonly work_TypedExportBinding: TirRecordCodec<TypedExportBinding>;
  readonly work_TypedImport: TirRecordCodec<TypedImport>;
  readonly work_TypedImportBinding: TirRecordCodec<TypedImportBinding>;
  readonly work_TypedIteration: TirRecordCodec<TypedIteration>;
  readonly work_TypedNamespace: TirRecordCodec<TypedNamespace>;
  readonly work_TypedParameter: TirRecordCodec<TypedParameter>;
  readonly work_TypedStorageDeclaration: TirRecordCodec<TypedStorageDeclaration>;
  readonly work_TypedVariableList: TirRecordCodec<TypedVariableList>;
}

export interface SyntaxStatementsTextModel {
  readonly work_EmptyStatement: (value: EmptyStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_IfStatement: (value: IfStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_DoStatement: (value: DoStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_WhileStatement: (value: WhileStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_ForStatement: (value: ForStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_ForInStatement: (value: ForInStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_ForOfStatement: (value: ForOfStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_BreakStatement: (value: BreakStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_ContinueStatement: (value: ContinueStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_ReturnStatement: (value: ReturnStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_WithStatement: (value: WithStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_SwitchStatement: (value: SwitchStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_CaseBlock: (value: CaseBlock<TypedPhase>) => TirTypedRecordWork;
  readonly work_CaseClause: (value: CaseClause<TypedPhase>) => TirTypedRecordWork;
  readonly work_DefaultClause: (value: DefaultClause<TypedPhase>) => TirTypedRecordWork;
  readonly work_ThrowStatement: (value: ThrowStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_TryStatement: (value: TryStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_CatchClause: (value: CatchClause<TypedPhase>) => TirTypedRecordWork;
  readonly work_DebuggerStatement: (value: DebuggerStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_LabeledStatement: (value: LabeledStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_ExpressionStatement: (value: ExpressionStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_VariableStatement: (value: VariableStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_VariableDeclaration: (value: VariableDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_VariableDeclarationList: (value: VariableDeclarationList<TypedPhase>) => TirTypedRecordWork;
  readonly work_BindingPattern: (value: BindingPattern<TypedPhase>) => TirTypedRecordWork;
  readonly work_ParameterDeclaration: (value: ParameterDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_BindingElement: (value: BindingElement<TypedPhase>) => TirTypedRecordWork;
  readonly work_MissingDeclaration: (value: MissingDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_ModuleBlock: (value: ModuleBlock<TypedPhase>) => TirTypedRecordWork;
  readonly work_NotEmittedStatement: (value: NotEmittedStatement<TypedPhase>) => TirTypedRecordWork;
  readonly work_ImportDeclaration: (value: ImportDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_NamespaceImport: (value: NamespaceImport<TypedPhase>) => TirTypedRecordWork;
  readonly work_NamedImports: (value: NamedImports<TypedPhase>) => TirTypedRecordWork;
  readonly work_ExportAssignment: (value: ExportAssignment<TypedPhase>) => TirTypedRecordWork;
  readonly work_NamespaceExportDeclaration: (value: NamespaceExportDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_NamespaceExport: (value: NamespaceExport<TypedPhase>) => TirTypedRecordWork;
  readonly work_NamedExports: (value: NamedExports<TypedPhase>) => TirTypedRecordWork;
  readonly work_ExportSpecifier: (value: ExportSpecifier<TypedPhase>) => TirTypedRecordWork;
  readonly work_PropertyDeclaration: (value: PropertyDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_SemicolonClassElement: (value: SemicolonClassElement<TypedPhase>) => TirTypedRecordWork;
  readonly work_ImportAttribute: (value: ImportAttribute<TypedPhase>) => TirTypedRecordWork;
  readonly work_ImportAttributes: (value: ImportAttributes<TypedPhase>) => TirTypedRecordWork;
  readonly work_ModuleDeclaration: (value: ModuleDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_ImportEqualsDeclaration: (value: ImportEqualsDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_ExportDeclaration: (value: ExportDeclaration<TypedPhase>) => TirTypedRecordWork;
  readonly work_ImportClause: (value: ImportClause<TypedPhase>) => TirTypedRecordWork;
  readonly work_ImportSpecifier: (value: ImportSpecifier<TypedPhase>) => TirTypedRecordWork;
  readonly work_L_CaseOrDefaultClause_: TirRecordCodec<NodeList<CaseOrDefaultClause<TypedPhase>>>;
  readonly work_L_Statement_: TirRecordCodec<NodeList<Statement<TypedPhase>>>;
  readonly work_L_VariableDeclaration_: TirRecordCodec<NodeList<VariableDeclaration<TypedPhase>>>;
  readonly work_L_BindingElement_: TirRecordCodec<NodeList<BindingElement<TypedPhase>>>;
  readonly work_L_ParameterDeclaration_: TirRecordCodec<NodeList<ParameterDeclaration<TypedPhase>>>;
  readonly work_L_HeritageClause_: TirRecordCodec<NodeList<HeritageClause<TypedPhase>>>;
  readonly work_L_ClassElement_: TirRecordCodec<NodeList<ClassElement<TypedPhase>>>;
}

export const createSyntaxStatementsText = (kernel: TirTextKernel, read: SyntaxStatementsTextReads): SyntaxStatementsTextModel => {
  const { defineRecord, defineSyntaxRecord, syntaxReads, booleanReader, nullReader } = kernel;
  const work_EmptyStatement: (value: EmptyStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<EmptyStatement<TypedPhase>>("EmptyStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'EmptyStatement", literalReader<(EmptyStatement<TypedPhase>)["kind"]>("'EmptyStatement", ["EmptyStatement"]))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_IfStatement: (value: IfStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<IfStatement<TypedPhase>>("IfStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'IfStatement", literalReader<(IfStatement<TypedPhase>)["kind"]>("'IfStatement", ["IfStatement"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("thenStatement", "$Statement", value => syntaxReference("$Statement", value.thenStatement), syntaxReads.Statement)
    .field("elseStatement", "?$Statement", value => nullableWork(value.elseStatement, actual => syntaxReference("$Statement", actual)), nullableReader(syntaxReads.Statement))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_thenStatement, field_elseStatement, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, thenStatement: field_thenStatement, elseStatement: field_elseStatement,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_DoStatement: (value: DoStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<DoStatement<TypedPhase>>("DoStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'DoStatement", literalReader<(DoStatement<TypedPhase>)["kind"]>("'DoStatement", ["DoStatement"]))
    .field("statement", "$Statement", value => syntaxReference("$Statement", value.statement), syntaxReads.Statement)
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_statement, field_expression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, statement: field_statement, expression: field_expression, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_WhileStatement: (value: WhileStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<WhileStatement<TypedPhase>>("WhileStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'WhileStatement", literalReader<(WhileStatement<TypedPhase>)["kind"]>("'WhileStatement", ["WhileStatement"]))
    .field("statement", "$Statement", value => syntaxReference("$Statement", value.statement), syntaxReads.Statement)
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_statement, field_expression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, statement: field_statement, expression: field_expression, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_ForStatement: (value: ForStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ForStatement<TypedPhase>>("ForStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ForStatement", literalReader<(ForStatement<TypedPhase>)["kind"]>("'ForStatement", ["ForStatement"]))
    .field("statement", "$Statement", value => syntaxReference("$Statement", value.statement), syntaxReads.Statement)
    .field("initializer", "?$ForInitializer", value => nullableWork(value.initializer, actual => syntaxReference("$ForInitializer", actual)), nullableReader(syntaxReads.ForInitializer))
    .field("condition", "?$Expression", value => nullableWork(value.condition, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("incrementor", "?$Expression", value => nullableWork(value.incrementor, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_statement, field_initializer, field_condition, field_incrementor, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, statement: field_statement, initializer: field_initializer, condition: field_condition,
      incrementor: field_incrementor, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_ForInStatement: (value: ForInStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ForInStatement<TypedPhase>>("ForInStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ForInStatement", literalReader<(ForInStatement<TypedPhase>)["kind"]>("'ForInStatement", ["ForInStatement"]))
    .field("awaitModifier", "null", value => scalarWork("null", value.awaitModifier), nullReader)
    .field("initializer", "$ForInitializer", value => syntaxReference("$ForInitializer", value.initializer), syntaxReads.ForInitializer)
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("statement", "$Statement", value => syntaxReference("$Statement", value.statement), syntaxReads.Statement)
    .field("tsonic", "TypedIteration", value => read.work_TypedIteration(value.tsonic), lazyReader(() => read.work_TypedIteration.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_awaitModifier, field_initializer, field_expression, field_statement, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, awaitModifier: field_awaitModifier, initializer: field_initializer, expression: field_expression,
      statement: field_statement, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_ForOfStatement: (value: ForOfStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ForOfStatement<TypedPhase>>("ForOfStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ForOfStatement", literalReader<(ForOfStatement<TypedPhase>)["kind"]>("'ForOfStatement", ["ForOfStatement"]))
    .field("awaitModifier", "?$AwaitKeyword", value => nullableWork(value.awaitModifier, actual => syntaxReference("$AwaitKeyword", actual)), nullableReader(syntaxReads.AwaitKeyword))
    .field("initializer", "$ForInitializer", value => syntaxReference("$ForInitializer", value.initializer), syntaxReads.ForInitializer)
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("statement", "$Statement", value => syntaxReference("$Statement", value.statement), syntaxReads.Statement)
    .field("tsonic", "TypedIteration", value => read.work_TypedIteration(value.tsonic), lazyReader(() => read.work_TypedIteration.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_awaitModifier, field_initializer, field_expression, field_statement, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, awaitModifier: field_awaitModifier, initializer: field_initializer, expression: field_expression,
      statement: field_statement, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_BreakStatement: (value: BreakStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<BreakStatement<TypedPhase>>("BreakStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'BreakStatement", literalReader<(BreakStatement<TypedPhase>)["kind"]>("'BreakStatement", ["BreakStatement"]))
    .field("label", "?$Identifier", value => nullableWork(value.label, actual => syntaxReference("$Identifier", actual)), nullableReader(syntaxReads.Identifier))
    .field("tsonic", "TypedControlTransfer", value => read.work_TypedControlTransfer(value.tsonic), lazyReader(() => read.work_TypedControlTransfer.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_label, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, label: field_label, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ContinueStatement: (value: ContinueStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ContinueStatement<TypedPhase>>("ContinueStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ContinueStatement", literalReader<(ContinueStatement<TypedPhase>)["kind"]>("'ContinueStatement", ["ContinueStatement"]))
    .field("label", "?$Identifier", value => nullableWork(value.label, actual => syntaxReference("$Identifier", actual)), nullableReader(syntaxReads.Identifier))
    .field("tsonic", "TypedControlTransfer", value => read.work_TypedControlTransfer(value.tsonic), lazyReader(() => read.work_TypedControlTransfer.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_label, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, label: field_label, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ReturnStatement: (value: ReturnStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ReturnStatement<TypedPhase>>("ReturnStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ReturnStatement", literalReader<(ReturnStatement<TypedPhase>)["kind"]>("'ReturnStatement", ["ReturnStatement"]))
    .field("expression", "?$Expression", value => nullableWork(value.expression, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_WithStatement: (value: WithStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<WithStatement<TypedPhase>>("WithStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'WithStatement", literalReader<(WithStatement<TypedPhase>)["kind"]>("'WithStatement", ["WithStatement"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("statement", "$Statement", value => syntaxReference("$Statement", value.statement), syntaxReads.Statement)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_statement, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, statement: field_statement, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_SwitchStatement: (value: SwitchStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<SwitchStatement<TypedPhase>>("SwitchStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'SwitchStatement", literalReader<(SwitchStatement<TypedPhase>)["kind"]>("'SwitchStatement", ["SwitchStatement"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("caseBlock", "$CaseBlock", value => syntaxReference("$CaseBlock", value.caseBlock), syntaxReads.CaseBlock)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_caseBlock, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, caseBlock: field_caseBlock, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_CaseBlock: (value: CaseBlock<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<CaseBlock<TypedPhase>>("CaseBlock", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'CaseBlock", literalReader<(CaseBlock<TypedPhase>)["kind"]>("'CaseBlock", ["CaseBlock"]))
    .field("clauses", "L<CaseOrDefaultClause>", value => work_L_CaseOrDefaultClause_(value.clauses), lazyReader(() => work_L_CaseOrDefaultClause_.reader))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_clauses, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, clauses: field_clauses, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_CaseClause: (value: CaseClause<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<CaseClause<TypedPhase>>("CaseClause", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'CaseClause", literalReader<(CaseClause<TypedPhase>)["kind"]>("'CaseClause", ["CaseClause"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("statements", "L<Statement>", value => work_L_Statement_(value.statements), lazyReader(() => work_L_Statement_.reader))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_statements, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, statements: field_statements, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_DefaultClause: (value: DefaultClause<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<DefaultClause<TypedPhase>>("DefaultClause", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'DefaultClause", literalReader<(DefaultClause<TypedPhase>)["kind"]>("'DefaultClause", ["DefaultClause"]))
    .field("expression", "null", value => scalarWork("null", value.expression), nullReader)
    .field("statements", "L<Statement>", value => work_L_Statement_(value.statements), lazyReader(() => work_L_Statement_.reader))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_statements, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, statements: field_statements, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_ThrowStatement: (value: ThrowStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ThrowStatement<TypedPhase>>("ThrowStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ThrowStatement", literalReader<(ThrowStatement<TypedPhase>)["kind"]>("'ThrowStatement", ["ThrowStatement"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_TryStatement: (value: TryStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<TryStatement<TypedPhase>>("TryStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'TryStatement", literalReader<(TryStatement<TypedPhase>)["kind"]>("'TryStatement", ["TryStatement"]))
    .field("tryBlock", "$Block", value => syntaxReference("$Block", value.tryBlock), syntaxReads.Block)
    .field("catchClause", "?$CatchClause", value => nullableWork(value.catchClause, actual => syntaxReference("$CatchClause", actual)), nullableReader(syntaxReads.CatchClause))
    .field("finallyBlock", "?$Block", value => nullableWork(value.finallyBlock, actual => syntaxReference("$Block", actual)), nullableReader(syntaxReads.Block))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tryBlock, field_catchClause, field_finallyBlock, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tryBlock: field_tryBlock, catchClause: field_catchClause, finallyBlock: field_finallyBlock,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_CatchClause: (value: CatchClause<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<CatchClause<TypedPhase>>("CatchClause", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'CatchClause", literalReader<(CatchClause<TypedPhase>)["kind"]>("'CatchClause", ["CatchClause"]))
    .field("variableDeclaration", "?$VariableDeclaration", value => nullableWork(value.variableDeclaration, actual => syntaxReference("$VariableDeclaration", actual)), nullableReader(syntaxReads.VariableDeclaration))
    .field("block", "$Block", value => syntaxReference("$Block", value.block), syntaxReads.Block)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_variableDeclaration, field_block, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, variableDeclaration: field_variableDeclaration, block: field_block, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_DebuggerStatement: (value: DebuggerStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<DebuggerStatement<TypedPhase>>("DebuggerStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'DebuggerStatement", literalReader<(DebuggerStatement<TypedPhase>)["kind"]>("'DebuggerStatement", ["DebuggerStatement"]))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_LabeledStatement: (value: LabeledStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<LabeledStatement<TypedPhase>>("LabeledStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'LabeledStatement", literalReader<(LabeledStatement<TypedPhase>)["kind"]>("'LabeledStatement", ["LabeledStatement"]))
    .field("label", "$Identifier", value => syntaxReference("$Identifier", value.label), syntaxReads.Identifier)
    .field("statement", "$Statement", value => syntaxReference("$Statement", value.statement), syntaxReads.Statement)
    .field("tsonic", "TypedControlTransfer", value => read.work_TypedControlTransfer(value.tsonic), lazyReader(() => read.work_TypedControlTransfer.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_label, field_statement, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, label: field_label, statement: field_statement, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_ExpressionStatement: (value: ExpressionStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ExpressionStatement<TypedPhase>>("ExpressionStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ExpressionStatement", literalReader<(ExpressionStatement<TypedPhase>)["kind"]>("'ExpressionStatement", ["ExpressionStatement"]))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_expression, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_VariableStatement: (value: VariableStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<VariableStatement<TypedPhase>>("VariableStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'VariableStatement", literalReader<(VariableStatement<TypedPhase>)["kind"]>("'VariableStatement", ["VariableStatement"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("declarationList", "$VariableDeclarationList", value => syntaxReference("$VariableDeclarationList", value.declarationList), syntaxReads.VariableDeclarationList)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_declarationList, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, declarationList: field_declarationList, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_VariableDeclaration: (value: VariableDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<VariableDeclaration<TypedPhase>>("VariableDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'VariableDeclaration", literalReader<(VariableDeclaration<TypedPhase>)["kind"]>("'VariableDeclaration", ["VariableDeclaration"]))
    .field("name", "$BindingName", value => syntaxReference("$BindingName", value.name), syntaxReads.BindingName)
    .field("exclamationToken", "?$ExclamationToken", value => nullableWork(value.exclamationToken, actual => syntaxReference("$ExclamationToken", actual)), nullableReader(syntaxReads.ExclamationToken))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("initializer", "?$Expression", value => nullableWork(value.initializer, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("tsonic", "TypedBinding", value => read.work_TypedBinding(value.tsonic), lazyReader(() => read.work_TypedBinding.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_name, field_exclamationToken, field_type, field_initializer, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, name: field_name, exclamationToken: field_exclamationToken, type: field_type,
      initializer: field_initializer, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_VariableDeclarationList: (value: VariableDeclarationList<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<VariableDeclarationList<TypedPhase>>("VariableDeclarationList", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'VariableDeclarationList", literalReader<(VariableDeclarationList<TypedPhase>)["kind"]>("'VariableDeclarationList", ["VariableDeclarationList"]))
    .field("declarations", "L<VariableDeclaration>", value => work_L_VariableDeclaration_(value.declarations), lazyReader(() => work_L_VariableDeclaration_.reader))
    .field("tsonic", "TypedVariableList", value => read.work_TypedVariableList(value.tsonic), lazyReader(() => read.work_TypedVariableList.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_declarations, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, declarations: field_declarations, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_BindingPattern: (value: BindingPattern<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<BindingPattern<TypedPhase>>("BindingPattern", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "BindingPatternKind", literalReader<(BindingPattern<TypedPhase>)["kind"]>("BindingPatternKind", ["ObjectBindingPattern","ArrayBindingPattern"]))
    .field("elements", "L<BindingElement>", value => work_L_BindingElement_(value.elements), lazyReader(() => work_L_BindingElement_.reader))
    .field("tsonic", "TypedBindingPattern", value => read.work_TypedBindingPattern(value.tsonic), lazyReader(() => read.work_TypedBindingPattern.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_elements, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, elements: field_elements, tsonic: field_tsonic }), constructBindingPattern));
  const work_ParameterDeclaration: (value: ParameterDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ParameterDeclaration<TypedPhase>>("ParameterDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'Parameter", literalReader<(ParameterDeclaration<TypedPhase>)["kind"]>("'Parameter", ["Parameter"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("dotDotDotToken", "?$DotDotDotToken", value => nullableWork(value.dotDotDotToken, actual => syntaxReference("$DotDotDotToken", actual)), nullableReader(syntaxReads.DotDotDotToken))
    .field("name", "$BindingName", value => syntaxReference("$BindingName", value.name), syntaxReads.BindingName)
    .field("questionToken", "?$QuestionToken", value => nullableWork(value.questionToken, actual => syntaxReference("$QuestionToken", actual)), nullableReader(syntaxReads.QuestionToken))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("initializer", "?$Expression", value => nullableWork(value.initializer, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("tsonic", "TypedParameter", value => read.work_TypedParameter(value.tsonic), lazyReader(() => read.work_TypedParameter.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_dotDotDotToken, field_name, field_questionToken, field_type, field_initializer, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, dotDotDotToken: field_dotDotDotToken, name: field_name,
      questionToken: field_questionToken, type: field_type, initializer: field_initializer, tsonic: field_tsonic }), (kind,
      make) => ({ kind, value: make(kind),
    })));
  const work_BindingElement: (value: BindingElement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<BindingElement<TypedPhase>>("BindingElement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'BindingElement", literalReader<(BindingElement<TypedPhase>)["kind"]>("'BindingElement", ["BindingElement"]))
    .field("dotDotDotToken", "?$DotDotDotToken", value => nullableWork(value.dotDotDotToken, actual => syntaxReference("$DotDotDotToken", actual)), nullableReader(syntaxReads.DotDotDotToken))
    .field("propertyName", "?$PropertyName", value => nullableWork(value.propertyName, actual => syntaxReference("$PropertyName", actual)), nullableReader(syntaxReads.PropertyName))
    .field("name", "?$BindingName", value => nullableWork(value.name, actual => syntaxReference("$BindingName", actual)), nullableReader(syntaxReads.BindingName))
    .field("initializer", "?$Expression", value => nullableWork(value.initializer, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("tsonic", "TypedBindingElement", value => read.work_TypedBindingElement(value.tsonic), lazyReader(() => read.work_TypedBindingElement.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_dotDotDotToken, field_propertyName, field_name, field_initializer, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, dotDotDotToken: field_dotDotDotToken, propertyName: field_propertyName, name: field_name,
      initializer: field_initializer, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_MissingDeclaration: (value: MissingDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<MissingDeclaration<TypedPhase>>("MissingDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'MissingDeclaration", literalReader<(MissingDeclaration<TypedPhase>)["kind"]>("'MissingDeclaration", ["MissingDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ModuleBlock: (value: ModuleBlock<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ModuleBlock<TypedPhase>>("ModuleBlock", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ModuleBlock", literalReader<(ModuleBlock<TypedPhase>)["kind"]>("'ModuleBlock", ["ModuleBlock"]))
    .field("statements", "L<Statement>", value => work_L_Statement_(value.statements), lazyReader(() => work_L_Statement_.reader))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_statements, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, statements: field_statements, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_NotEmittedStatement: (value: NotEmittedStatement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<NotEmittedStatement<TypedPhase>>("NotEmittedStatement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'NotEmittedStatement", literalReader<(NotEmittedStatement<TypedPhase>)["kind"]>("'NotEmittedStatement", ["NotEmittedStatement"]))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ImportDeclaration: (value: ImportDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ImportDeclaration<TypedPhase>>("ImportDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "ImportDeclarationKind", literalReader<(ImportDeclaration<TypedPhase>)["kind"]>("ImportDeclarationKind", ["ImportDeclaration","JSImportDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("importClause", "?$ImportClause", value => nullableWork(value.importClause, actual => syntaxReference("$ImportClause", actual)), nullableReader(syntaxReads.ImportClause))
    .field("moduleSpecifier", "$Expression", value => syntaxReference("$Expression", value.moduleSpecifier), syntaxReads.Expression)
    .field("attributes", "?$ImportAttributes", value => nullableWork(value.attributes, actual => syntaxReference("$ImportAttributes", actual)), nullableReader(syntaxReads.ImportAttributes))
    .field("tsonic", "TypedImport", value => read.work_TypedImport(value.tsonic), lazyReader(() => read.work_TypedImport.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_importClause, field_moduleSpecifier, field_attributes, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, importClause: field_importClause, moduleSpecifier: field_moduleSpecifier,
      attributes: field_attributes, tsonic: field_tsonic,
    }), constructImportDeclaration));
  const work_NamespaceImport: (value: NamespaceImport<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<NamespaceImport<TypedPhase>>("NamespaceImport", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'NamespaceImport", literalReader<(NamespaceImport<TypedPhase>)["kind"]>("'NamespaceImport", ["NamespaceImport"]))
    .field("name", "$Identifier", value => syntaxReference("$Identifier", value.name), syntaxReads.Identifier)
    .field("tsonic", "TypedImportBinding", value => read.work_TypedImportBinding(value.tsonic), lazyReader(() => read.work_TypedImportBinding.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_name, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, name: field_name, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_NamedImports: (value: NamedImports<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<NamedImports<TypedPhase>>("NamedImports", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'NamedImports", literalReader<(NamedImports<TypedPhase>)["kind"]>("'NamedImports", ["NamedImports"]))
    .field("elements", "L<ImportSpecifier>", value => read.work_L_ImportSpecifier_(value.elements), lazyReader(() => read.work_L_ImportSpecifier_.reader))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_elements, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, elements: field_elements, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ExportAssignment: (value: ExportAssignment<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ExportAssignment<TypedPhase>>("ExportAssignment", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ExportAssignment", literalReader<(ExportAssignment<TypedPhase>)["kind"]>("'ExportAssignment", ["ExportAssignment"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("isExportEquals", "boolean", value => scalarWork("boolean", value.isExportEquals), booleanReader)
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("expression", "$Expression", value => syntaxReference("$Expression", value.expression), syntaxReads.Expression)
    .field("tsonic", "TypedExportAssignment", value => read.work_TypedExportAssignment(value.tsonic), lazyReader(() => read.work_TypedExportAssignment.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_isExportEquals, field_type, field_expression, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, isExportEquals: field_isExportEquals, type: field_type,
      expression: field_expression, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_NamespaceExportDeclaration: (value: NamespaceExportDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<NamespaceExportDeclaration<TypedPhase>>("NamespaceExportDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'NamespaceExportDeclaration", literalReader<(NamespaceExportDeclaration<TypedPhase>)["kind"]>("'NamespaceExportDeclaration", ["NamespaceExportDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$Identifier", value => syntaxReference("$Identifier", value.name), syntaxReads.Identifier)
    .field("tsonic", "TypedExportBinding", value => read.work_TypedExportBinding(value.tsonic), lazyReader(() => read.work_TypedExportBinding.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_NamespaceExport: (value: NamespaceExport<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<NamespaceExport<TypedPhase>>("NamespaceExport", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'NamespaceExport", literalReader<(NamespaceExport<TypedPhase>)["kind"]>("'NamespaceExport", ["NamespaceExport"]))
    .field("name", "$ModuleExportName", value => syntaxReference("$ModuleExportName", value.name), syntaxReads.ModuleExportName)
    .field("tsonic", "TypedExportBinding", value => read.work_TypedExportBinding(value.tsonic), lazyReader(() => read.work_TypedExportBinding.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_name, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, name: field_name, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_NamedExports: (value: NamedExports<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<NamedExports<TypedPhase>>("NamedExports", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'NamedExports", literalReader<(NamedExports<TypedPhase>)["kind"]>("'NamedExports", ["NamedExports"]))
    .field("elements", "L<ExportSpecifier>", value => read.work_L_ExportSpecifier_(value.elements), lazyReader(() => read.work_L_ExportSpecifier_.reader))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_elements, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, elements: field_elements, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ExportSpecifier: (value: ExportSpecifier<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ExportSpecifier<TypedPhase>>("ExportSpecifier", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ExportSpecifier", literalReader<(ExportSpecifier<TypedPhase>)["kind"]>("'ExportSpecifier", ["ExportSpecifier"]))
    .field("isTypeOnly", "boolean", value => scalarWork("boolean", value.isTypeOnly), booleanReader)
    .field("propertyName", "?$ModuleExportName", value => nullableWork(value.propertyName, actual => syntaxReference("$ModuleExportName", actual)), nullableReader(syntaxReads.ModuleExportName))
    .field("name", "$ModuleExportName", value => syntaxReference("$ModuleExportName", value.name), syntaxReads.ModuleExportName)
    .field("tsonic", "TypedExportBinding", value => read.work_TypedExportBinding(value.tsonic), lazyReader(() => read.work_TypedExportBinding.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_isTypeOnly, field_propertyName, field_name, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, isTypeOnly: field_isTypeOnly, propertyName: field_propertyName, name: field_name,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_PropertyDeclaration: (value: PropertyDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<PropertyDeclaration<TypedPhase>>("PropertyDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'PropertyDeclaration", literalReader<(PropertyDeclaration<TypedPhase>)["kind"]>("'PropertyDeclaration", ["PropertyDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("name", "$PropertyName", value => syntaxReference("$PropertyName", value.name), syntaxReads.PropertyName)
    .field("postfixToken", "?$PostfixToken", value => nullableWork(value.postfixToken, actual => syntaxReference("$PostfixToken", actual)), nullableReader(syntaxReads.PostfixToken))
    .field("type", "?$TypeNode", value => nullableWork(value.type, actual => syntaxReference("$TypeNode", actual)), nullableReader(syntaxReads.TypeNode))
    .field("initializer", "?$Expression", value => nullableWork(value.initializer, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("tsonic", "TypedStorageDeclaration", value => read.work_TypedStorageDeclaration(value.tsonic), lazyReader(() => read.work_TypedStorageDeclaration.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_name, field_postfixToken, field_type, field_initializer, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, name: field_name, postfixToken: field_postfixToken, type: field_type,
      initializer: field_initializer, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_SemicolonClassElement: (value: SemicolonClassElement<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<SemicolonClassElement<TypedPhase>>("SemicolonClassElement", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'SemicolonClassElement", literalReader<(SemicolonClassElement<TypedPhase>)["kind"]>("'SemicolonClassElement", ["SemicolonClassElement"]))
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ImportAttribute: (value: ImportAttribute<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ImportAttribute<TypedPhase>>("ImportAttribute", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ImportAttribute", literalReader<(ImportAttribute<TypedPhase>)["kind"]>("'ImportAttribute", ["ImportAttribute"]))
    .field("name", "$ImportAttributeName", value => syntaxReference("$ImportAttributeName", value.name), syntaxReads.ImportAttributeName)
    .field("value", "$Expression", value => syntaxReference("$Expression", value.value), syntaxReads.Expression)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_name, field_value, field_tsonic) => ({ id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, name: field_name, value: field_value, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind) })));
  const work_ImportAttributes: (value: ImportAttributes<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ImportAttributes<TypedPhase>>("ImportAttributes", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ImportAttributes", literalReader<(ImportAttributes<TypedPhase>)["kind"]>("'ImportAttributes", ["ImportAttributes"]))
    .field("token", "ImportAttributeToken", value => scalarWork("ImportAttributeToken", value.token), literalReader<(ImportAttributes<TypedPhase>)["token"]>("ImportAttributeToken", ["WithKeyword","AssertKeyword"]))
    .field("attributes", "L<ImportAttribute>", value => read.work_L_ImportAttribute_(value.attributes), lazyReader(() => read.work_L_ImportAttribute_.reader))
    .field("multiLine", "boolean", value => scalarWork("boolean", value.multiLine), booleanReader)
    .field("tsonic", "null", value => scalarWork("null", value.tsonic), nullReader)
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_token, field_attributes, field_multiLine, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, token: field_token, attributes: field_attributes, multiLine: field_multiLine,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_ModuleDeclaration: (value: ModuleDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ModuleDeclaration<TypedPhase>>("ModuleDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ModuleDeclaration", literalReader<(ModuleDeclaration<TypedPhase>)["kind"]>("'ModuleDeclaration", ["ModuleDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("asteriskToken", "?$AsteriskToken", value => nullableWork(value.asteriskToken, actual => syntaxReference("$AsteriskToken", actual)), nullableReader(syntaxReads.AsteriskToken))
    .field("body", "?$NodeBody", value => nullableWork(value.body, actual => syntaxReference("$NodeBody", actual)), nullableReader(syntaxReads.NodeBody))
    .field("keyword", "ModuleKeyword", value => scalarWork("ModuleKeyword", value.keyword), literalReader<(ModuleDeclaration<TypedPhase>)["keyword"]>("ModuleKeyword", ["ModuleKeyword","NamespaceKeyword"]))
    .field("name", "$ModuleName", value => syntaxReference("$ModuleName", value.name), syntaxReads.ModuleName)
    .field("tsonic", "TypedNamespace", value => read.work_TypedNamespace(value.tsonic), lazyReader(() => read.work_TypedNamespace.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_asteriskToken, field_body, field_keyword, field_name, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, asteriskToken: field_asteriskToken, body: field_body,
      keyword: field_keyword, name: field_name, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_ImportEqualsDeclaration: (value: ImportEqualsDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ImportEqualsDeclaration<TypedPhase>>("ImportEqualsDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ImportEqualsDeclaration", literalReader<(ImportEqualsDeclaration<TypedPhase>)["kind"]>("'ImportEqualsDeclaration", ["ImportEqualsDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("isTypeOnly", "boolean", value => scalarWork("boolean", value.isTypeOnly), booleanReader)
    .field("name", "$Identifier", value => syntaxReference("$Identifier", value.name), syntaxReads.Identifier)
    .field("moduleReference", "$ModuleReference", value => syntaxReference("$ModuleReference", value.moduleReference), syntaxReads.ModuleReference)
    .field("tsonic", "TypedImportBinding", value => read.work_TypedImportBinding(value.tsonic), lazyReader(() => read.work_TypedImportBinding.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_isTypeOnly, field_name, field_moduleReference, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, isTypeOnly: field_isTypeOnly, name: field_name,
      moduleReference: field_moduleReference, tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_ExportDeclaration: (value: ExportDeclaration<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ExportDeclaration<TypedPhase>>("ExportDeclaration", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ExportDeclaration", literalReader<(ExportDeclaration<TypedPhase>)["kind"]>("'ExportDeclaration", ["ExportDeclaration"]))
    .field("modifiers", "?ModifierList", value => nullableWork(value.modifiers, actual => read.work_ModifierList(actual)), nullableReader(lazyReader(() => read.work_ModifierList.reader)))
    .field("isTypeOnly", "boolean", value => scalarWork("boolean", value.isTypeOnly), booleanReader)
    .field("exportClause", "?$NamedExportBindings", value => nullableWork(value.exportClause, actual => syntaxReference("$NamedExportBindings", actual)), nullableReader(syntaxReads.NamedExportBindings))
    .field("moduleSpecifier", "?$Expression", value => nullableWork(value.moduleSpecifier, actual => syntaxReference("$Expression", actual)), nullableReader(syntaxReads.Expression))
    .field("attributes", "?$ImportAttributes", value => nullableWork(value.attributes, actual => syntaxReference("$ImportAttributes", actual)), nullableReader(syntaxReads.ImportAttributes))
    .field("tsonic", "TypedExport", value => read.work_TypedExport(value.tsonic), lazyReader(() => read.work_TypedExport.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_modifiers, field_isTypeOnly, field_exportClause, field_moduleSpecifier, field_attributes, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, modifiers: field_modifiers, isTypeOnly: field_isTypeOnly, exportClause: field_exportClause,
      moduleSpecifier: field_moduleSpecifier, attributes: field_attributes, tsonic: field_tsonic }), (kind, make) => ({ kind,
      value: make(kind),
    })));
  const work_ImportClause: (value: ImportClause<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ImportClause<TypedPhase>>("ImportClause", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ImportClause", literalReader<(ImportClause<TypedPhase>)["kind"]>("'ImportClause", ["ImportClause"]))
    .field("phaseModifier", "?ImportPhaseModifier", value => nullableWork(value.phaseModifier, actual => scalarWork("ImportPhaseModifier", actual)), nullableReader(literalReader<NonNullable<(ImportClause<TypedPhase>)["phaseModifier"]>>("ImportPhaseModifier", ["TypeKeyword","DeferKeyword"])))
    .field("name", "?$Identifier", value => nullableWork(value.name, actual => syntaxReference("$Identifier", actual)), nullableReader(syntaxReads.Identifier))
    .field("namedBindings", "?$NamedImportBindings", value => nullableWork(value.namedBindings, actual => syntaxReference("$NamedImportBindings", actual)), nullableReader(syntaxReads.NamedImportBindings))
    .field("tsonic", "TypedImportBinding", value => read.work_TypedImportBinding(value.tsonic), lazyReader(() => read.work_TypedImportBinding.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_phaseModifier, field_name, field_namedBindings, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, phaseModifier: field_phaseModifier, name: field_name, namedBindings: field_namedBindings,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_ImportSpecifier: (value: ImportSpecifier<TypedPhase>) => TirTypedRecordWork = defineSyntaxRecord<ImportSpecifier<TypedPhase>>("ImportSpecifier", null, value => value.kind, value => value, null, fields => fields
    .syntaxHeader(read.work_Origin, read.work_TextRange)
    .syntaxKind("kind", "'ImportSpecifier", literalReader<(ImportSpecifier<TypedPhase>)["kind"]>("'ImportSpecifier", ["ImportSpecifier"]))
    .field("isTypeOnly", "boolean", value => scalarWork("boolean", value.isTypeOnly), booleanReader)
    .field("propertyName", "?$ModuleExportName", value => nullableWork(value.propertyName, actual => syntaxReference("$ModuleExportName", actual)), nullableReader(syntaxReads.ModuleExportName))
    .field("name", "$Identifier", value => syntaxReference("$Identifier", value.name), syntaxReads.Identifier)
    .field("tsonic", "TypedImportBinding", value => read.work_TypedImportBinding(value.tsonic), lazyReader(() => read.work_TypedImportBinding.reader))
    .finishSyntax((syntaxKind, field_id, field_origin, field_parent, field_flags, field_loc, field_isTypeOnly, field_propertyName, field_name, field_tsonic) => ({
      id: field_id, origin: field_origin, parent: field_parent, flags: field_flags, loc: field_loc, kind: syntaxKind, isTypeOnly: field_isTypeOnly, propertyName: field_propertyName, name: field_name,
      tsonic: field_tsonic }), (kind, make) => ({ kind, value: make(kind),
    })));
  const work_L_CaseOrDefaultClause_: TirRecordCodec<NodeList<CaseOrDefaultClause<TypedPhase>>> = defineRecord<NodeList<CaseOrDefaultClause<TypedPhase>>>("L<CaseOrDefaultClause>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$CaseOrDefaultClause]", value => sequenceWork("[$CaseOrDefaultClause]", value.nodes, actual => syntaxReference("$CaseOrDefaultClause", actual)), sequenceReader("[$CaseOrDefaultClause]", syntaxReads.CaseOrDefaultClause))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_Statement_: TirRecordCodec<NodeList<Statement<TypedPhase>>> = defineRecord<NodeList<Statement<TypedPhase>>>("L<Statement>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$Statement]", value => sequenceWork("[$Statement]", value.nodes, actual => syntaxReference("$Statement", actual)), sequenceReader("[$Statement]", syntaxReads.Statement))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_VariableDeclaration_: TirRecordCodec<NodeList<VariableDeclaration<TypedPhase>>> = defineRecord<NodeList<VariableDeclaration<TypedPhase>>>("L<VariableDeclaration>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$VariableDeclaration]", value => sequenceWork("[$VariableDeclaration]", value.nodes, actual => syntaxReference("$VariableDeclaration", actual)), sequenceReader("[$VariableDeclaration]", syntaxReads.VariableDeclaration))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_BindingElement_: TirRecordCodec<NodeList<BindingElement<TypedPhase>>> = defineRecord<NodeList<BindingElement<TypedPhase>>>("L<BindingElement>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$BindingElement]", value => sequenceWork("[$BindingElement]", value.nodes, actual => syntaxReference("$BindingElement", actual)), sequenceReader("[$BindingElement]", syntaxReads.BindingElement))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_ParameterDeclaration_: TirRecordCodec<NodeList<ParameterDeclaration<TypedPhase>>> = defineRecord<NodeList<ParameterDeclaration<TypedPhase>>>("L<ParameterDeclaration>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$ParameterDeclaration]", value => sequenceWork("[$ParameterDeclaration]", value.nodes, actual => syntaxReference("$ParameterDeclaration", actual)), sequenceReader("[$ParameterDeclaration]", syntaxReads.ParameterDeclaration))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_HeritageClause_: TirRecordCodec<NodeList<HeritageClause<TypedPhase>>> = defineRecord<NodeList<HeritageClause<TypedPhase>>>("L<HeritageClause>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$HeritageClause]", value => sequenceWork("[$HeritageClause]", value.nodes, actual => syntaxReference("$HeritageClause", actual)), sequenceReader("[$HeritageClause]", syntaxReads.HeritageClause))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  const work_L_ClassElement_: TirRecordCodec<NodeList<ClassElement<TypedPhase>>> = defineRecord<NodeList<ClassElement<TypedPhase>>>("L<ClassElement>", "NodeList", null, "NodeList", null, null, fields => fields
    .field("loc", "TextRange", value => read.work_TextRange(value.loc), lazyReader(() => read.work_TextRange.reader))
    .field("nodes", "[$ClassElement]", value => sequenceWork("[$ClassElement]", value.nodes, actual => syntaxReference("$ClassElement", actual)), sequenceReader("[$ClassElement]", syntaxReads.ClassElement))
    .finish((field_loc, field_nodes) => ({ loc: field_loc, nodes: field_nodes })));
  return { work_EmptyStatement, work_IfStatement, work_DoStatement, work_WhileStatement, work_ForStatement, work_ForInStatement, work_ForOfStatement, work_BreakStatement, work_ContinueStatement, work_ReturnStatement, work_WithStatement, work_SwitchStatement, work_CaseBlock, work_CaseClause, work_DefaultClause, work_ThrowStatement, work_TryStatement, work_CatchClause, work_DebuggerStatement, work_LabeledStatement, work_ExpressionStatement, work_VariableStatement, work_VariableDeclaration, work_VariableDeclarationList, work_BindingPattern, work_ParameterDeclaration, work_BindingElement, work_MissingDeclaration, work_ModuleBlock, work_NotEmittedStatement, work_ImportDeclaration, work_NamespaceImport, work_NamedImports, work_ExportAssignment, work_NamespaceExportDeclaration, work_NamespaceExport, work_NamedExports, work_ExportSpecifier, work_PropertyDeclaration, work_SemicolonClassElement, work_ImportAttribute, work_ImportAttributes, work_ModuleDeclaration, work_ImportEqualsDeclaration, work_ExportDeclaration, work_ImportClause, work_ImportSpecifier, work_L_CaseOrDefaultClause_, work_L_Statement_, work_L_VariableDeclaration_, work_L_BindingElement_, work_L_ParameterDeclaration_, work_L_HeritageClause_, work_L_ClassElement_ };
};
