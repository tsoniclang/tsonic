import type { PlainTokenKind, SyntaxNode, Token } from "../ir-hir/contract.js";
import type { TypedPhase } from "../ir-tir/contract.js";
import type { TextParseResult } from "../diag/contract.js";
import type { ModuleBodies } from "./contract.js";
import type { Cursor, LexicalFault, TextStep } from "./parse-values.js";
import { atomicText, choice, delimiter, evaluateText, fieldText, invalid, readNull, whitespace } from "./parse-values.js";
import type { SyntaxDependency, SyntaxReadPorts, SyntaxValue } from "./parse-syntax-values.js";
import { finishSyntaxRecord, readSyntaxRecord, readSyntaxWire } from "./parse-syntax-values.js";
import { createSyntaxReadPorts } from "./parse-syntax-references.js";

type SyntaxBuilder = () => void;

interface SyntaxDefinition {
  readonly position: number;
  readonly kind: SyntaxNode<TypedPhase>["kind"];
  readonly dependencies: readonly SyntaxDependency[];
  readonly construct: SyntaxBuilder;
}

type SyntaxOrder =
  | { readonly kind: "cyclic"; readonly closing: SyntaxDependency }
  | { readonly kind: "ordered"; readonly definitions: readonly SyntaxDefinition[] };


function earlierFault<Fault extends LexicalFault>(current: Fault | null, candidate: Fault): Fault {
  return current === null || candidate.offset < current.offset ? candidate : current;
}


function orderSyntax(definitions: ReadonlyMap<number, SyntaxDefinition>, through: number, buildOrder: boolean): SyntaxOrder {
  const states = new Map<number, "active" | "complete">();
  const ordered: SyntaxDefinition[] = [];
  type Work = { readonly kind: "enter" | "leave"; readonly definition: SyntaxDefinition }
    | { readonly kind: "edge"; readonly dependency: SyntaxDependency };
  for (const root of definitions.values()) {
    const work: Work[] = [{ kind: "enter", definition: root }];
    let task = work.pop();
    while (task !== undefined) {
      switch (task.kind) {
        case "edge": {
          const dependency = task.dependency;
          if (dependency.offset <= through) {
            const target = definitions.get(dependency.position);
            if (target !== undefined) {
              const state = states.get(target.position);
              if (state === "active") return { kind: "cyclic", closing: dependency };
              if (state !== "complete") work.push({ kind: "enter", definition: target });
            }
          }
          break;
        }
        case "leave":
          states.set(task.definition.position, "complete");
          if (buildOrder) ordered.push(task.definition);
          break;
        case "enter": {
          const definition = task.definition;
          if (states.get(definition.position) !== "complete") {
            states.set(definition.position, "active");
            work.push({ kind: "leave", definition });
            for (const dependency of [...definition.dependencies].reverse()) work.push({ kind: "edge", dependency });
          }
          break;
        }
      }
      task = work.pop();
    }
  }
  return { kind: "ordered", definitions: ordered };
}

function firstCycleFault(definitions: ReadonlyMap<number, SyntaxDefinition>, closing: SyntaxDependency): LexicalFault {
  const ordered: SyntaxDependency[] = [];
  for (const definition of definitions.values()) for (const dependency of definition.dependencies) ordered.push(dependency);
  let lower = 0;
  let upper = ordered.length - 1;
  let answer = ordered.reduce((latest, dependency) => dependency.offset > latest.offset ? dependency : latest, closing);
  while (lower <= upper) {
    const middle = lower + Math.floor((upper - lower) / 2);
    let position = 0;
    for (const dependency of ordered) {
      if (position === middle) {
        if (orderSyntax(definitions, dependency.offset, false).kind === "cyclic") {
          answer = dependency;
          upper = middle - 1;
        }
        else lower = middle + 1;
        break;
      }
      position += 1;
    }
  }
  return { offset: answer.offset, expected: ["acyclic syntax reference"] };
}

function referenceFaults(definitions: ReadonlyMap<number, SyntaxDefinition>, dependencies: readonly SyntaxDependency[]): LexicalFault | null {
  let fault: LexicalFault | null = null;
  for (const dependency of dependencies) {
    const target = definitions.get(dependency.position);
    if (target === undefined) fault = earlierFault(fault, { offset: dependency.offset, expected: ["declared syntax node"] });
    else if (!dependency.kinds.includes(target.kind)) fault = earlierFault(fault, { offset: dependency.offset, expected: dependency.expected });
  }
  return fault;
}


function readSyntaxTail(
  cursor: Cursor,
  ports: SyntaxReadPorts,
  nodes: Map<number, SyntaxNode<TypedPhase>>,
  roots: readonly SyntaxDependency[],
  selectDependencies: (dependencies: SyntaxDependency[]) => void,
): TextParseResult<readonly SyntaxDefinition[]> {
  const definitions = new Map<number, SyntaxDefinition>();
  while (cursor.offset < cursor.text.length) {
    const gap = cursor.offset;
    whitespace(cursor);
    if (cursor.offset === cursor.text.length) break;
    if (!cursor.text.substring(gap, cursor.offset).includes("\n")) return invalid(cursor, gap, ["newline"]);
    const wire = readSyntaxWire(cursor);
    if (wire.kind === "invalid-text") return wire;
    if (definitions.has(wire.value.position)) return invalid(cursor, wire.value.offset, ["unique syntax binding"]);
    const equals = delimiter(cursor, "=");
    if (equals.kind === "invalid-text") return equals;
    const kind = choice(cursor, syntaxKinds);
    if (kind.kind === "invalid-text") return kind;
    const dependencies: SyntaxDependency[] = [];
    selectDependencies(dependencies);
    const parsed = evaluateText(readSyntaxDefinition(cursor, ports, kind.value, value => ({
      kind: "complete", result: { kind: "parsed", value },
    })));
    if (parsed.kind === "invalid-text") return parsed;
    const plan = parsed.value;
    const construct: SyntaxBuilder = () => {
      nodes.set(wire.value.position, plan.resolve());
    };
    definitions.set(wire.value.position, { position: wire.value.position, kind: kind.value, dependencies, construct });
  }
  let fault = referenceFaults(definitions, roots);
  for (const definition of definitions.values()) {
    const reference = referenceFaults(definitions, definition.dependencies);
    if (reference !== null) fault = earlierFault(fault, reference);
  }
  const ordered = orderSyntax(definitions, Infinity, true);
  if (ordered.kind === "cyclic") {
    const winner = earlierFault(fault, firstCycleFault(definitions, ordered.closing));
    return invalid(cursor, winner.offset, winner.expected);
  }
  if (fault !== null) return invalid(cursor, fault.offset, fault.expected);
  return { kind: "parsed", value: ordered.definitions };
}

export function parseSyntaxDocument(
  cursor: Cursor,
  readHeader: (ports: SyntaxReadPorts) => TextStep<SyntaxValue<ModuleBodies>>,
): TextParseResult<ModuleBodies> {
  const nodes = new Map<number, SyntaxNode<TypedPhase>>();
  const roots: SyntaxDependency[] = [];
  let dependencies = roots;
  const ports = createSyntaxReadPorts(nodes, dependency => dependencies.push(dependency));
  const header = evaluateText(readHeader(ports));
  if (header.kind === "invalid-text") return header;
  const tail = readSyntaxTail(cursor, ports, nodes, roots, next => { dependencies = next; });
  if (tail.kind === "invalid-text") return tail;
  for (const definition of tail.value) definition.construct();
  return { kind: "parsed", value: header.value.resolve() };
}

function readPlainTokenSyntax<Root>(
  cursor: Cursor,
  kind: PlainTokenKind,
  finish: (value: SyntaxValue<Token<TypedPhase>>) => TextStep<Root>,
): TextStep<Root> {
  return readSyntaxRecord(cursor, (fields, header) =>
    fieldText<null, Root>(cursor, fields, "tsonic", (next, done) => atomicText(next, readNull, done), tsonic =>
      finishSyntaxRecord<Token<TypedPhase>, Root>(cursor, fields, {
        resolve: () => ({ ...header, kind, tsonic }),
      }, finish)));
}

import { readEmptyStatementSyntax, readIfStatementSyntax, readDoStatementSyntax, readWhileStatementSyntax, readForStatementSyntax, readForInStatementSyntax, readForOfStatementSyntax, readBreakStatementSyntax, readContinueStatementSyntax, readReturnStatementSyntax, readWithStatementSyntax, readSwitchStatementSyntax, readCaseBlockSyntax, readCaseClauseSyntax, readDefaultClauseSyntax, readThrowStatementSyntax, readTryStatementSyntax, readCatchClauseSyntax, readDebuggerStatementSyntax, readLabeledStatementSyntax, readExpressionStatementSyntax, readBlockSyntax, readVariableStatementSyntax, readVariableDeclarationSyntax, readVariableDeclarationListSyntax, readBindingPatternSyntax, readParameterDeclarationSyntax, readBindingElementSyntax, readMissingDeclarationSyntax, readFunctionDeclarationSyntax, readClassDeclarationSyntax, readClassExpressionSyntax, readHeritageClauseSyntax, readInterfaceDeclarationSyntax, readTypeAliasDeclarationSyntax, readEnumMemberSyntax, readEnumDeclarationSyntax, readModuleBlockSyntax, readNotEmittedStatementSyntax, readNotEmittedTypeElementSyntax, readCallSignatureDeclarationSyntax, readConstructSignatureDeclarationSyntax, readConstructorDeclarationSyntax, readGetAccessorDeclarationSyntax, readSetAccessorDeclarationSyntax, readIndexSignatureDeclarationSyntax, readMethodSignatureDeclarationSyntax, readMethodDeclarationSyntax, readPropertySignatureDeclarationSyntax, readPropertyDeclarationSyntax, readSemicolonClassElementSyntax, readClassStaticBlockDeclarationSyntax } from "./parse-syntax-statements.js";
import { readIdentifierSyntax, readPrivateIdentifierSyntax, readQualifiedNameSyntax, readComputedPropertyNameSyntax, readDecoratorSyntax, readOmittedExpressionSyntax, readKeywordExpressionSyntax, readStringLiteralSyntax, readNumericLiteralSyntax, readBigIntLiteralSyntax, readRegularExpressionLiteralSyntax, readNoSubstitutionTemplateLiteralSyntax, readBinaryExpressionSyntax, readPrefixUnaryExpressionSyntax, readPostfixUnaryExpressionSyntax, readYieldExpressionSyntax, readArrowFunctionSyntax, readFunctionExpressionSyntax, readAsExpressionSyntax, readSatisfiesExpressionSyntax, readConditionalExpressionSyntax, readPropertyAccessExpressionSyntax, readElementAccessExpressionSyntax, readCallExpressionSyntax, readNewExpressionSyntax, readMetaPropertySyntax, readNonNullExpressionSyntax, readSpreadElementSyntax, readTemplateExpressionSyntax, readTemplateSpanSyntax, readTaggedTemplateExpressionSyntax, readParenthesizedExpressionSyntax, readArrayLiteralExpressionSyntax, readObjectLiteralExpressionSyntax, readSpreadAssignmentSyntax, readPropertyAssignmentSyntax, readShorthandPropertyAssignmentSyntax, readDeleteExpressionSyntax, readTypeOfExpressionSyntax, readVoidExpressionSyntax, readAwaitExpressionSyntax, readTypeAssertionSyntax, readExpressionWithTypeArgumentsSyntax, readTemplateHeadSyntax, readTemplateMiddleSyntax, readTemplateTailSyntax, readPartiallyEmittedExpressionSyntax, readSyntheticReferenceExpressionSyntax } from "./parse-syntax-expressions.js";
import { readKeywordTypeNodeSyntax, readUnionTypeNodeSyntax, readIntersectionTypeNodeSyntax, readConditionalTypeNodeSyntax, readTypeOperatorNodeSyntax, readInferTypeNodeSyntax, readArrayTypeNodeSyntax, readIndexedAccessTypeNodeSyntax, readTypeReferenceNodeSyntax, readLiteralTypeNodeSyntax, readThisTypeNodeSyntax, readTypePredicateNodeSyntax, readImportAttributeSyntax, readImportAttributesSyntax, readTypeQueryNodeSyntax, readMappedTypeNodeSyntax, readTypeLiteralNodeSyntax, readTupleTypeNodeSyntax, readNamedTupleMemberSyntax, readOptionalTypeNodeSyntax, readRestTypeNodeSyntax, readParenthesizedTypeNodeSyntax, readFunctionTypeNodeSyntax, readConstructorTypeNodeSyntax, readTemplateLiteralTypeNodeSyntax, readTemplateLiteralTypeSpanSyntax, readTypeParameterDeclarationSyntax } from "./parse-syntax-types.js";
import { readImportDeclarationSyntax, readExternalModuleReferenceSyntax, readNamespaceImportSyntax, readNamedImportsSyntax, readExportAssignmentSyntax, readNamespaceExportDeclarationSyntax, readNamespaceExportSyntax, readNamedExportsSyntax, readExportSpecifierSyntax, readJsxElementSyntax, readJsxAttributesSyntax, readJsxNamespacedNameSyntax, readJsxOpeningElementSyntax, readJsxSelfClosingElementSyntax, readJsxFragmentSyntax, readJsxOpeningFragmentSyntax, readJsxClosingFragmentSyntax, readJsxAttributeSyntax, readJsxSpreadAttributeSyntax, readJsxClosingElementSyntax, readJsxExpressionSyntax, readJsxTextSyntax, readSyntaxListSyntax, readSourceFileSyntax, readModuleDeclarationSyntax, readImportEqualsDeclarationSyntax, readExportDeclarationSyntax, readImportTypeNodeSyntax, readImportClauseSyntax, readImportSpecifierSyntax } from "./parse-syntax-auxiliary.js";
import { readJSDocSyntax, readJSDocTypeExpressionSyntax, readJSDocNonNullableTypeSyntax, readJSDocNullableTypeSyntax, readJSDocAllTypeSyntax, readJSDocVariadicTypeSyntax, readJSDocOptionalTypeSyntax, readJSDocTypeTagSyntax, readJSDocUnknownTagSyntax, readJSDocTemplateTagSyntax, readJSDocReturnTagSyntax, readJSDocPublicTagSyntax, readJSDocPrivateTagSyntax, readJSDocProtectedTagSyntax, readJSDocReadonlyTagSyntax, readJSDocOverrideTagSyntax, readJSDocDeprecatedTagSyntax, readJSDocSeeTagSyntax, readJSDocImplementsTagSyntax, readJSDocAugmentsTagSyntax, readJSDocSatisfiesTagSyntax, readJSDocThrowsTagSyntax, readJSDocThisTagSyntax, readJSDocImportTagSyntax, readJSDocCallbackTagSyntax, readJSDocOverloadTagSyntax, readJSDocTypedefTagSyntax, readJSDocSignatureSyntax, readJSDocNameReferenceSyntax, readJSDocTextSyntax, readJSDocLinkSyntax, readJSDocLinkPlainSyntax, readJSDocLinkCodeSyntax, readJSDocTypeLiteralSyntax, readJSDocParameterOrPropertyTagSyntax } from "./parse-syntax-jsdoc.js";

const syntaxKinds: readonly SyntaxNode<TypedPhase>["kind"][] = (["Unknown","EndOfFile","SingleLineCommentTrivia","MultiLineCommentTrivia","NewLineTrivia","WhitespaceTrivia","ConflictMarkerTrivia","NonTextFileMarkerTrivia","JsxTextAllWhiteSpaces","OpenBraceToken","CloseBraceToken","OpenParenToken","CloseParenToken","OpenBracketToken","CloseBracketToken","DotToken","DotDotDotToken","SemicolonToken","CommaToken","QuestionDotToken","LessThanToken","LessThanSlashToken","GreaterThanToken","LessThanEqualsToken","GreaterThanEqualsToken","EqualsEqualsToken","ExclamationEqualsToken","EqualsEqualsEqualsToken","ExclamationEqualsEqualsToken","EqualsGreaterThanToken","PlusToken","MinusToken","AsteriskToken","AsteriskAsteriskToken","SlashToken","PercentToken","PlusPlusToken","MinusMinusToken","LessThanLessThanToken","GreaterThanGreaterThanToken","GreaterThanGreaterThanGreaterThanToken","AmpersandToken","BarToken","CaretToken","ExclamationToken","TildeToken","AmpersandAmpersandToken","BarBarToken","QuestionToken","ColonToken","AtToken","QuestionQuestionToken","BacktickToken","HashToken","EqualsToken","PlusEqualsToken","MinusEqualsToken","AsteriskEqualsToken","AsteriskAsteriskEqualsToken","SlashEqualsToken","PercentEqualsToken","LessThanLessThanEqualsToken","GreaterThanGreaterThanEqualsToken","GreaterThanGreaterThanGreaterThanEqualsToken","AmpersandEqualsToken","BarEqualsToken","BarBarEqualsToken","AmpersandAmpersandEqualsToken","QuestionQuestionEqualsToken","CaretEqualsToken","JSDocCommentTextToken","BreakKeyword","CaseKeyword","CatchKeyword","ClassKeyword","ConstKeyword","ContinueKeyword","DebuggerKeyword","DefaultKeyword","DeleteKeyword","DoKeyword","ElseKeyword","EnumKeyword","ExportKeyword","ExtendsKeyword","FinallyKeyword","ForKeyword","FunctionKeyword","IfKeyword","InKeyword","InstanceOfKeyword","NewKeyword","ReturnKeyword","SwitchKeyword","ThrowKeyword","TryKeyword","TypeOfKeyword","VarKeyword","WhileKeyword","WithKeyword","ImplementsKeyword","InterfaceKeyword","LetKeyword","PackageKeyword","PrivateKeyword","ProtectedKeyword","PublicKeyword","StaticKeyword","YieldKeyword","AbstractKeyword","AccessorKeyword","AsKeyword","AssertsKeyword","AssertKeyword","AsyncKeyword","AwaitKeyword","ConstructorKeyword","DeclareKeyword","GetKeyword","ImmediateKeyword","InferKeyword","IsKeyword","KeyOfKeyword","ModuleKeyword","NamespaceKeyword","OutKeyword","ReadonlyKeyword","RequireKeyword","SatisfiesKeyword","SetKeyword","TypeKeyword","UniqueKeyword","UsingKeyword","FromKeyword","GlobalKeyword","OverrideKeyword","OfKeyword","DeferKeyword","Identifier","PrivateIdentifier","QualifiedName","ComputedPropertyName","Decorator","EmptyStatement","IfStatement","DoStatement","WhileStatement","ForStatement","ForInStatement","ForOfStatement","BreakStatement","ContinueStatement","ReturnStatement","WithStatement","SwitchStatement","CaseBlock","CaseClause","DefaultClause","ThrowStatement","TryStatement","CatchClause","DebuggerStatement","LabeledStatement","ExpressionStatement","Block","VariableStatement","VariableDeclaration","VariableDeclarationList","ObjectBindingPattern","ArrayBindingPattern","Parameter","BindingElement","MissingDeclaration","FunctionDeclaration","ClassDeclaration","ClassExpression","HeritageClause","InterfaceDeclaration","TypeAliasDeclaration","JSTypeAliasDeclaration","EnumMember","EnumDeclaration","ModuleBlock","NotEmittedStatement","NotEmittedTypeElement","ImportDeclaration","JSImportDeclaration","ExternalModuleReference","NamespaceImport","NamedImports","ExportAssignment","NamespaceExportDeclaration","NamespaceExport","NamedExports","ExportSpecifier","CallSignature","ConstructSignature","Constructor","GetAccessor","SetAccessor","IndexSignature","MethodSignature","MethodDeclaration","PropertySignature","PropertyDeclaration","SemicolonClassElement","ClassStaticBlockDeclaration","OmittedExpression","NullKeyword","TrueKeyword","FalseKeyword","ThisKeyword","SuperKeyword","ImportKeyword","StringLiteral","NumericLiteral","BigIntLiteral","RegularExpressionLiteral","NoSubstitutionTemplateLiteral","BinaryExpression","PrefixUnaryExpression","PostfixUnaryExpression","YieldExpression","ArrowFunction","FunctionExpression","AsExpression","SatisfiesExpression","ConditionalExpression","PropertyAccessExpression","ElementAccessExpression","CallExpression","NewExpression","MetaProperty","NonNullExpression","SpreadElement","TemplateExpression","TemplateSpan","TaggedTemplateExpression","ParenthesizedExpression","ArrayLiteralExpression","ObjectLiteralExpression","SpreadAssignment","PropertyAssignment","ShorthandPropertyAssignment","DeleteExpression","TypeOfExpression","VoidExpression","AwaitExpression","TypeAssertionExpression","AnyKeyword","BigIntKeyword","BooleanKeyword","IntrinsicKeyword","NeverKeyword","NumberKeyword","ObjectKeyword","StringKeyword","SymbolKeyword","UndefinedKeyword","UnknownKeyword","VoidKeyword","UnionType","IntersectionType","ConditionalType","TypeOperator","InferType","ArrayType","IndexedAccessType","TypeReference","ExpressionWithTypeArguments","LiteralType","ThisType","TypePredicate","ImportAttribute","ImportAttributes","TypeQuery","MappedType","TypeLiteral","TupleType","NamedTupleMember","OptionalType","RestType","ParenthesizedType","FunctionType","ConstructorType","TemplateHead","TemplateMiddle","TemplateTail","TemplateLiteralType","TemplateLiteralTypeSpan","PartiallyEmittedExpression","JsxElement","JsxAttributes","JsxNamespacedName","JsxOpeningElement","JsxSelfClosingElement","JsxFragment","JsxOpeningFragment","JsxClosingFragment","JsxAttribute","JsxSpreadAttribute","JsxClosingElement","JsxExpression","JsxText","SyntaxList","JSDoc","JSDocTypeExpression","JSDocNonNullableType","JSDocNullableType","JSDocAllType","JSDocVariadicType","JSDocOptionalType","JSDocTypeTag","JSDocUnknownTag","JSDocTemplateTag","JSDocReturnTag","JSDocPublicTag","JSDocPrivateTag","JSDocProtectedTag","JSDocReadonlyTag","JSDocOverrideTag","JSDocDeprecatedTag","JSDocSeeTag","JSDocImplementsTag","JSDocAugmentsTag","JSDocSatisfiesTag","JSDocThrowsTag","JSDocThisTag","JSDocImportTag","JSDocCallbackTag","JSDocOverloadTag","JSDocTypedefTag","JSDocSignature","JSDocNameReference","SourceFile","ModuleDeclaration","ImportEqualsDeclaration","ExportDeclaration","ImportType","ImportClause","ImportSpecifier","JSDocText","JSDocLink","JSDocLinkPlain","JSDocLinkCode","TypeParameter","SyntheticReferenceExpression","JSDocTypeLiteral","JSDocParameterTag","JSDocPropertyTag"]);

function readSyntaxDefinition<Root>(cursor: Cursor, ports: SyntaxReadPorts, kind: SyntaxNode<TypedPhase>["kind"], finish: (value: SyntaxValue<SyntaxNode<TypedPhase>>) => TextStep<Root>): TextStep<Root> {
  switch (kind) {
    case "Unknown": case "EndOfFile": case "SingleLineCommentTrivia": case "MultiLineCommentTrivia":
    case "NewLineTrivia": case "WhitespaceTrivia": case "ConflictMarkerTrivia": case "NonTextFileMarkerTrivia":
    case "JsxTextAllWhiteSpaces": case "OpenBraceToken": case "CloseBraceToken": case "OpenParenToken":
    case "CloseParenToken": case "OpenBracketToken": case "CloseBracketToken": case "DotToken":
    case "DotDotDotToken": case "SemicolonToken": case "CommaToken": case "QuestionDotToken":
    case "LessThanToken": case "LessThanSlashToken": case "GreaterThanToken": case "LessThanEqualsToken":
    case "GreaterThanEqualsToken": case "EqualsEqualsToken": case "ExclamationEqualsToken": case "EqualsEqualsEqualsToken":
    case "ExclamationEqualsEqualsToken": case "EqualsGreaterThanToken": case "PlusToken": case "MinusToken":
    case "AsteriskToken": case "AsteriskAsteriskToken": case "SlashToken": case "PercentToken":
    case "PlusPlusToken": case "MinusMinusToken": case "LessThanLessThanToken": case "GreaterThanGreaterThanToken":
    case "GreaterThanGreaterThanGreaterThanToken": case "AmpersandToken": case "BarToken": case "CaretToken":
    case "ExclamationToken": case "TildeToken": case "AmpersandAmpersandToken": case "BarBarToken":
    case "QuestionToken": case "ColonToken": case "AtToken": case "QuestionQuestionToken":
    case "BacktickToken": case "HashToken": case "EqualsToken": case "PlusEqualsToken":
    case "MinusEqualsToken": case "AsteriskEqualsToken": case "AsteriskAsteriskEqualsToken": case "SlashEqualsToken":
    case "PercentEqualsToken": case "LessThanLessThanEqualsToken": case "GreaterThanGreaterThanEqualsToken": case "GreaterThanGreaterThanGreaterThanEqualsToken":
    case "AmpersandEqualsToken": case "BarEqualsToken": case "BarBarEqualsToken": case "AmpersandAmpersandEqualsToken":
    case "QuestionQuestionEqualsToken": case "CaretEqualsToken": case "JSDocCommentTextToken": case "BreakKeyword":
    case "CaseKeyword": case "CatchKeyword": case "ClassKeyword": case "ConstKeyword":
    case "ContinueKeyword": case "DebuggerKeyword": case "DefaultKeyword": case "DeleteKeyword":
    case "DoKeyword": case "ElseKeyword": case "EnumKeyword": case "ExportKeyword":
    case "ExtendsKeyword": case "FinallyKeyword": case "ForKeyword": case "FunctionKeyword":
    case "IfKeyword": case "InKeyword": case "InstanceOfKeyword": case "NewKeyword":
    case "ReturnKeyword": case "SwitchKeyword": case "ThrowKeyword": case "TryKeyword":
    case "TypeOfKeyword": case "VarKeyword": case "WhileKeyword": case "WithKeyword":
    case "ImplementsKeyword": case "InterfaceKeyword": case "LetKeyword": case "PackageKeyword":
    case "PrivateKeyword": case "ProtectedKeyword": case "PublicKeyword": case "StaticKeyword":
    case "YieldKeyword": case "AbstractKeyword": case "AccessorKeyword": case "AsKeyword":
    case "AssertsKeyword": case "AssertKeyword": case "AsyncKeyword": case "AwaitKeyword":
    case "ConstructorKeyword": case "DeclareKeyword": case "GetKeyword": case "ImmediateKeyword":
    case "InferKeyword": case "IsKeyword": case "KeyOfKeyword": case "ModuleKeyword":
    case "NamespaceKeyword": case "OutKeyword": case "ReadonlyKeyword": case "RequireKeyword":
    case "SatisfiesKeyword": case "SetKeyword": case "TypeKeyword": case "UniqueKeyword":
    case "UsingKeyword": case "FromKeyword": case "GlobalKeyword": case "OverrideKeyword":
    case "OfKeyword": case "DeferKeyword":
      return readPlainTokenSyntax(cursor, kind, finish);
    case "Identifier": return readIdentifierSyntax(cursor, ports, kind, finish);
    case "PrivateIdentifier": return readPrivateIdentifierSyntax(cursor, ports, kind, finish);
    case "QualifiedName": return readQualifiedNameSyntax(cursor, ports, kind, finish);
    case "ComputedPropertyName": return readComputedPropertyNameSyntax(cursor, ports, kind, finish);
    case "Decorator": return readDecoratorSyntax(cursor, ports, kind, finish);
    case "EmptyStatement": return readEmptyStatementSyntax(cursor, ports, kind, finish);
    case "IfStatement": return readIfStatementSyntax(cursor, ports, kind, finish);
    case "DoStatement": return readDoStatementSyntax(cursor, ports, kind, finish);
    case "WhileStatement": return readWhileStatementSyntax(cursor, ports, kind, finish);
    case "ForStatement": return readForStatementSyntax(cursor, ports, kind, finish);
    case "ForInStatement": return readForInStatementSyntax(cursor, ports, kind, finish);
    case "ForOfStatement": return readForOfStatementSyntax(cursor, ports, kind, finish);
    case "BreakStatement": return readBreakStatementSyntax(cursor, ports, kind, finish);
    case "ContinueStatement": return readContinueStatementSyntax(cursor, ports, kind, finish);
    case "ReturnStatement": return readReturnStatementSyntax(cursor, ports, kind, finish);
    case "WithStatement": return readWithStatementSyntax(cursor, ports, kind, finish);
    case "SwitchStatement": return readSwitchStatementSyntax(cursor, ports, kind, finish);
    case "CaseBlock": return readCaseBlockSyntax(cursor, ports, kind, finish);
    case "CaseClause": return readCaseClauseSyntax(cursor, ports, kind, finish);
    case "DefaultClause": return readDefaultClauseSyntax(cursor, ports, kind, finish);
    case "ThrowStatement": return readThrowStatementSyntax(cursor, ports, kind, finish);
    case "TryStatement": return readTryStatementSyntax(cursor, ports, kind, finish);
    case "CatchClause": return readCatchClauseSyntax(cursor, ports, kind, finish);
    case "DebuggerStatement": return readDebuggerStatementSyntax(cursor, ports, kind, finish);
    case "LabeledStatement": return readLabeledStatementSyntax(cursor, ports, kind, finish);
    case "ExpressionStatement": return readExpressionStatementSyntax(cursor, ports, kind, finish);
    case "Block": return readBlockSyntax(cursor, ports, kind, finish);
    case "VariableStatement": return readVariableStatementSyntax(cursor, ports, kind, finish);
    case "VariableDeclaration": return readVariableDeclarationSyntax(cursor, ports, kind, finish);
    case "VariableDeclarationList": return readVariableDeclarationListSyntax(cursor, ports, kind, finish);
    case "ObjectBindingPattern": case "ArrayBindingPattern": return readBindingPatternSyntax(cursor, ports, kind, finish);
    case "Parameter": return readParameterDeclarationSyntax(cursor, ports, kind, finish);
    case "BindingElement": return readBindingElementSyntax(cursor, ports, kind, finish);
    case "MissingDeclaration": return readMissingDeclarationSyntax(cursor, ports, kind, finish);
    case "FunctionDeclaration": return readFunctionDeclarationSyntax(cursor, ports, kind, finish);
    case "ClassDeclaration": return readClassDeclarationSyntax(cursor, ports, kind, finish);
    case "ClassExpression": return readClassExpressionSyntax(cursor, ports, kind, finish);
    case "HeritageClause": return readHeritageClauseSyntax(cursor, ports, kind, finish);
    case "InterfaceDeclaration": return readInterfaceDeclarationSyntax(cursor, ports, kind, finish);
    case "TypeAliasDeclaration": case "JSTypeAliasDeclaration": return readTypeAliasDeclarationSyntax(cursor, ports, kind, finish);
    case "EnumMember": return readEnumMemberSyntax(cursor, ports, kind, finish);
    case "EnumDeclaration": return readEnumDeclarationSyntax(cursor, ports, kind, finish);
    case "ModuleBlock": return readModuleBlockSyntax(cursor, ports, kind, finish);
    case "NotEmittedStatement": return readNotEmittedStatementSyntax(cursor, ports, kind, finish);
    case "NotEmittedTypeElement": return readNotEmittedTypeElementSyntax(cursor, ports, kind, finish);
    case "ImportDeclaration": case "JSImportDeclaration": return readImportDeclarationSyntax(cursor, ports, kind, finish);
    case "ExternalModuleReference": return readExternalModuleReferenceSyntax(cursor, ports, kind, finish);
    case "NamespaceImport": return readNamespaceImportSyntax(cursor, ports, kind, finish);
    case "NamedImports": return readNamedImportsSyntax(cursor, ports, kind, finish);
    case "ExportAssignment": return readExportAssignmentSyntax(cursor, ports, kind, finish);
    case "NamespaceExportDeclaration": return readNamespaceExportDeclarationSyntax(cursor, ports, kind, finish);
    case "NamespaceExport": return readNamespaceExportSyntax(cursor, ports, kind, finish);
    case "NamedExports": return readNamedExportsSyntax(cursor, ports, kind, finish);
    case "ExportSpecifier": return readExportSpecifierSyntax(cursor, ports, kind, finish);
    case "CallSignature": return readCallSignatureDeclarationSyntax(cursor, ports, kind, finish);
    case "ConstructSignature": return readConstructSignatureDeclarationSyntax(cursor, ports, kind, finish);
    case "Constructor": return readConstructorDeclarationSyntax(cursor, ports, kind, finish);
    case "GetAccessor": return readGetAccessorDeclarationSyntax(cursor, ports, kind, finish);
    case "SetAccessor": return readSetAccessorDeclarationSyntax(cursor, ports, kind, finish);
    case "IndexSignature": return readIndexSignatureDeclarationSyntax(cursor, ports, kind, finish);
    case "MethodSignature": return readMethodSignatureDeclarationSyntax(cursor, ports, kind, finish);
    case "MethodDeclaration": return readMethodDeclarationSyntax(cursor, ports, kind, finish);
    case "PropertySignature": return readPropertySignatureDeclarationSyntax(cursor, ports, kind, finish);
    case "PropertyDeclaration": return readPropertyDeclarationSyntax(cursor, ports, kind, finish);
    case "SemicolonClassElement": return readSemicolonClassElementSyntax(cursor, ports, kind, finish);
    case "ClassStaticBlockDeclaration": return readClassStaticBlockDeclarationSyntax(cursor, ports, kind, finish);
    case "OmittedExpression": return readOmittedExpressionSyntax(cursor, ports, kind, finish);
    case "NullKeyword": case "TrueKeyword": case "FalseKeyword": case "ThisKeyword": case "SuperKeyword": case "ImportKeyword": return readKeywordExpressionSyntax(cursor, ports, kind, finish);
    case "StringLiteral": return readStringLiteralSyntax(cursor, ports, kind, finish);
    case "NumericLiteral": return readNumericLiteralSyntax(cursor, ports, kind, finish);
    case "BigIntLiteral": return readBigIntLiteralSyntax(cursor, ports, kind, finish);
    case "RegularExpressionLiteral": return readRegularExpressionLiteralSyntax(cursor, ports, kind, finish);
    case "NoSubstitutionTemplateLiteral": return readNoSubstitutionTemplateLiteralSyntax(cursor, ports, kind, finish);
    case "BinaryExpression": return readBinaryExpressionSyntax(cursor, ports, kind, finish);
    case "PrefixUnaryExpression": return readPrefixUnaryExpressionSyntax(cursor, ports, kind, finish);
    case "PostfixUnaryExpression": return readPostfixUnaryExpressionSyntax(cursor, ports, kind, finish);
    case "YieldExpression": return readYieldExpressionSyntax(cursor, ports, kind, finish);
    case "ArrowFunction": return readArrowFunctionSyntax(cursor, ports, kind, finish);
    case "FunctionExpression": return readFunctionExpressionSyntax(cursor, ports, kind, finish);
    case "AsExpression": return readAsExpressionSyntax(cursor, ports, kind, finish);
    case "SatisfiesExpression": return readSatisfiesExpressionSyntax(cursor, ports, kind, finish);
    case "ConditionalExpression": return readConditionalExpressionSyntax(cursor, ports, kind, finish);
    case "PropertyAccessExpression": return readPropertyAccessExpressionSyntax(cursor, ports, kind, finish);
    case "ElementAccessExpression": return readElementAccessExpressionSyntax(cursor, ports, kind, finish);
    case "CallExpression": return readCallExpressionSyntax(cursor, ports, kind, finish);
    case "NewExpression": return readNewExpressionSyntax(cursor, ports, kind, finish);
    case "MetaProperty": return readMetaPropertySyntax(cursor, ports, kind, finish);
    case "NonNullExpression": return readNonNullExpressionSyntax(cursor, ports, kind, finish);
    case "SpreadElement": return readSpreadElementSyntax(cursor, ports, kind, finish);
    case "TemplateExpression": return readTemplateExpressionSyntax(cursor, ports, kind, finish);
    case "TemplateSpan": return readTemplateSpanSyntax(cursor, ports, kind, finish);
    case "TaggedTemplateExpression": return readTaggedTemplateExpressionSyntax(cursor, ports, kind, finish);
    case "ParenthesizedExpression": return readParenthesizedExpressionSyntax(cursor, ports, kind, finish);
    case "ArrayLiteralExpression": return readArrayLiteralExpressionSyntax(cursor, ports, kind, finish);
    case "ObjectLiteralExpression": return readObjectLiteralExpressionSyntax(cursor, ports, kind, finish);
    case "SpreadAssignment": return readSpreadAssignmentSyntax(cursor, ports, kind, finish);
    case "PropertyAssignment": return readPropertyAssignmentSyntax(cursor, ports, kind, finish);
    case "ShorthandPropertyAssignment": return readShorthandPropertyAssignmentSyntax(cursor, ports, kind, finish);
    case "DeleteExpression": return readDeleteExpressionSyntax(cursor, ports, kind, finish);
    case "TypeOfExpression": return readTypeOfExpressionSyntax(cursor, ports, kind, finish);
    case "VoidExpression": return readVoidExpressionSyntax(cursor, ports, kind, finish);
    case "AwaitExpression": return readAwaitExpressionSyntax(cursor, ports, kind, finish);
    case "TypeAssertionExpression": return readTypeAssertionSyntax(cursor, ports, kind, finish);
    case "AnyKeyword": case "BigIntKeyword": case "BooleanKeyword": case "IntrinsicKeyword": case "NeverKeyword": case "NumberKeyword": case "ObjectKeyword": case "StringKeyword": case "SymbolKeyword": case "UndefinedKeyword": case "UnknownKeyword": case "VoidKeyword": return readKeywordTypeNodeSyntax(cursor, ports, kind, finish);
    case "UnionType": return readUnionTypeNodeSyntax(cursor, ports, kind, finish);
    case "IntersectionType": return readIntersectionTypeNodeSyntax(cursor, ports, kind, finish);
    case "ConditionalType": return readConditionalTypeNodeSyntax(cursor, ports, kind, finish);
    case "TypeOperator": return readTypeOperatorNodeSyntax(cursor, ports, kind, finish);
    case "InferType": return readInferTypeNodeSyntax(cursor, ports, kind, finish);
    case "ArrayType": return readArrayTypeNodeSyntax(cursor, ports, kind, finish);
    case "IndexedAccessType": return readIndexedAccessTypeNodeSyntax(cursor, ports, kind, finish);
    case "TypeReference": return readTypeReferenceNodeSyntax(cursor, ports, kind, finish);
    case "ExpressionWithTypeArguments": return readExpressionWithTypeArgumentsSyntax(cursor, ports, kind, finish);
    case "LiteralType": return readLiteralTypeNodeSyntax(cursor, ports, kind, finish);
    case "ThisType": return readThisTypeNodeSyntax(cursor, ports, kind, finish);
    case "TypePredicate": return readTypePredicateNodeSyntax(cursor, ports, kind, finish);
    case "ImportAttribute": return readImportAttributeSyntax(cursor, ports, kind, finish);
    case "ImportAttributes": return readImportAttributesSyntax(cursor, ports, kind, finish);
    case "TypeQuery": return readTypeQueryNodeSyntax(cursor, ports, kind, finish);
    case "MappedType": return readMappedTypeNodeSyntax(cursor, ports, kind, finish);
    case "TypeLiteral": return readTypeLiteralNodeSyntax(cursor, ports, kind, finish);
    case "TupleType": return readTupleTypeNodeSyntax(cursor, ports, kind, finish);
    case "NamedTupleMember": return readNamedTupleMemberSyntax(cursor, ports, kind, finish);
    case "OptionalType": return readOptionalTypeNodeSyntax(cursor, ports, kind, finish);
    case "RestType": return readRestTypeNodeSyntax(cursor, ports, kind, finish);
    case "ParenthesizedType": return readParenthesizedTypeNodeSyntax(cursor, ports, kind, finish);
    case "FunctionType": return readFunctionTypeNodeSyntax(cursor, ports, kind, finish);
    case "ConstructorType": return readConstructorTypeNodeSyntax(cursor, ports, kind, finish);
    case "TemplateHead": return readTemplateHeadSyntax(cursor, ports, kind, finish);
    case "TemplateMiddle": return readTemplateMiddleSyntax(cursor, ports, kind, finish);
    case "TemplateTail": return readTemplateTailSyntax(cursor, ports, kind, finish);
    case "TemplateLiteralType": return readTemplateLiteralTypeNodeSyntax(cursor, ports, kind, finish);
    case "TemplateLiteralTypeSpan": return readTemplateLiteralTypeSpanSyntax(cursor, ports, kind, finish);
    case "PartiallyEmittedExpression": return readPartiallyEmittedExpressionSyntax(cursor, ports, kind, finish);
    case "JsxElement": return readJsxElementSyntax(cursor, ports, kind, finish);
    case "JsxAttributes": return readJsxAttributesSyntax(cursor, ports, kind, finish);
    case "JsxNamespacedName": return readJsxNamespacedNameSyntax(cursor, ports, kind, finish);
    case "JsxOpeningElement": return readJsxOpeningElementSyntax(cursor, ports, kind, finish);
    case "JsxSelfClosingElement": return readJsxSelfClosingElementSyntax(cursor, ports, kind, finish);
    case "JsxFragment": return readJsxFragmentSyntax(cursor, ports, kind, finish);
    case "JsxOpeningFragment": return readJsxOpeningFragmentSyntax(cursor, ports, kind, finish);
    case "JsxClosingFragment": return readJsxClosingFragmentSyntax(cursor, ports, kind, finish);
    case "JsxAttribute": return readJsxAttributeSyntax(cursor, ports, kind, finish);
    case "JsxSpreadAttribute": return readJsxSpreadAttributeSyntax(cursor, ports, kind, finish);
    case "JsxClosingElement": return readJsxClosingElementSyntax(cursor, ports, kind, finish);
    case "JsxExpression": return readJsxExpressionSyntax(cursor, ports, kind, finish);
    case "JsxText": return readJsxTextSyntax(cursor, ports, kind, finish);
    case "SyntaxList": return readSyntaxListSyntax(cursor, ports, kind, finish);
    case "JSDoc": return readJSDocSyntax(cursor, ports, kind, finish);
    case "JSDocTypeExpression": return readJSDocTypeExpressionSyntax(cursor, ports, kind, finish);
    case "JSDocNonNullableType": return readJSDocNonNullableTypeSyntax(cursor, ports, kind, finish);
    case "JSDocNullableType": return readJSDocNullableTypeSyntax(cursor, ports, kind, finish);
    case "JSDocAllType": return readJSDocAllTypeSyntax(cursor, ports, kind, finish);
    case "JSDocVariadicType": return readJSDocVariadicTypeSyntax(cursor, ports, kind, finish);
    case "JSDocOptionalType": return readJSDocOptionalTypeSyntax(cursor, ports, kind, finish);
    case "JSDocTypeTag": return readJSDocTypeTagSyntax(cursor, ports, kind, finish);
    case "JSDocUnknownTag": return readJSDocUnknownTagSyntax(cursor, ports, kind, finish);
    case "JSDocTemplateTag": return readJSDocTemplateTagSyntax(cursor, ports, kind, finish);
    case "JSDocReturnTag": return readJSDocReturnTagSyntax(cursor, ports, kind, finish);
    case "JSDocPublicTag": return readJSDocPublicTagSyntax(cursor, ports, kind, finish);
    case "JSDocPrivateTag": return readJSDocPrivateTagSyntax(cursor, ports, kind, finish);
    case "JSDocProtectedTag": return readJSDocProtectedTagSyntax(cursor, ports, kind, finish);
    case "JSDocReadonlyTag": return readJSDocReadonlyTagSyntax(cursor, ports, kind, finish);
    case "JSDocOverrideTag": return readJSDocOverrideTagSyntax(cursor, ports, kind, finish);
    case "JSDocDeprecatedTag": return readJSDocDeprecatedTagSyntax(cursor, ports, kind, finish);
    case "JSDocSeeTag": return readJSDocSeeTagSyntax(cursor, ports, kind, finish);
    case "JSDocImplementsTag": return readJSDocImplementsTagSyntax(cursor, ports, kind, finish);
    case "JSDocAugmentsTag": return readJSDocAugmentsTagSyntax(cursor, ports, kind, finish);
    case "JSDocSatisfiesTag": return readJSDocSatisfiesTagSyntax(cursor, ports, kind, finish);
    case "JSDocThrowsTag": return readJSDocThrowsTagSyntax(cursor, ports, kind, finish);
    case "JSDocThisTag": return readJSDocThisTagSyntax(cursor, ports, kind, finish);
    case "JSDocImportTag": return readJSDocImportTagSyntax(cursor, ports, kind, finish);
    case "JSDocCallbackTag": return readJSDocCallbackTagSyntax(cursor, ports, kind, finish);
    case "JSDocOverloadTag": return readJSDocOverloadTagSyntax(cursor, ports, kind, finish);
    case "JSDocTypedefTag": return readJSDocTypedefTagSyntax(cursor, ports, kind, finish);
    case "JSDocSignature": return readJSDocSignatureSyntax(cursor, ports, kind, finish);
    case "JSDocNameReference": return readJSDocNameReferenceSyntax(cursor, ports, kind, finish);
    case "SourceFile": return readSourceFileSyntax(cursor, ports, kind, finish);
    case "ModuleDeclaration": return readModuleDeclarationSyntax(cursor, ports, kind, finish);
    case "ImportEqualsDeclaration": return readImportEqualsDeclarationSyntax(cursor, ports, kind, finish);
    case "ExportDeclaration": return readExportDeclarationSyntax(cursor, ports, kind, finish);
    case "ImportType": return readImportTypeNodeSyntax(cursor, ports, kind, finish);
    case "ImportClause": return readImportClauseSyntax(cursor, ports, kind, finish);
    case "ImportSpecifier": return readImportSpecifierSyntax(cursor, ports, kind, finish);
    case "JSDocText": return readJSDocTextSyntax(cursor, ports, kind, finish);
    case "JSDocLink": return readJSDocLinkSyntax(cursor, ports, kind, finish);
    case "JSDocLinkPlain": return readJSDocLinkPlainSyntax(cursor, ports, kind, finish);
    case "JSDocLinkCode": return readJSDocLinkCodeSyntax(cursor, ports, kind, finish);
    case "TypeParameter": return readTypeParameterDeclarationSyntax(cursor, ports, kind, finish);
    case "SyntheticReferenceExpression": return readSyntheticReferenceExpressionSyntax(cursor, ports, kind, finish);
    case "JSDocTypeLiteral": return readJSDocTypeLiteralSyntax(cursor, ports, kind, finish);
    case "JSDocParameterTag": case "JSDocPropertyTag": return readJSDocParameterOrPropertyTagSyntax(cursor, ports, kind, finish);
  }
}
