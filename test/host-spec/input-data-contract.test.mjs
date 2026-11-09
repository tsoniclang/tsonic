import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { orderedDomain } from "./runner/assertions.mjs";
import { withSpecProject } from "./runner/project.mjs";
import { inspectHostStructure } from "../architecture/tooling/host-gates.mjs";
import { buildTypeScriptModuleGraph } from "../architecture/tooling/module-graph.mjs";
import { stronglyConnectedComponents } from "../architecture/tooling/strongly-connected-components.mjs";
import { readArchitectureTypeScript } from "../architecture/tooling/typescript-source.mjs";
import { compileHostModuleInIsolation } from "../scripts/host-isolated.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const model = "packages/host/src/model/";
const port = resolve(repository, model, "contract.ts");
const compiler = resolve(repository, "node_modules/.bin/tsgo");
const strict = ["--ignoreConfig", "--strict", "--noUncheckedIndexedAccess", "--exactOptionalPropertyTypes",
  "--skipLibCheck", "false", "--noEmitOnError", "--module", "nodenext", "--target", "es2020", "--types", "node"];
let compilerCalls = 0;

const expected = Object.freeze([
  [
    "foundation-data.ts",
    [
      "ProgramIdentity",
      "Identity",
      "Original",
      "SourceSite",
      "Presence<T>",
      "DiagnosticEvidence",
      "Diagnostic",
      "ResourceLimit",
      "ResourceDomain",
      "ResourceUsage",
      "CompilerResourceLimitFailure",
      "ContextInvariantCode",
      "QueryChainEntry",
      "ContextInvariantFailure",
      "IntegerFormat",
      "IntegerRange",
      "DataResult<T>",
      "AlgebraKey<T>",
      "KeyDomain<T>",
      "AlgebraWork",
      "ModelAlgebra"
    ]
  ],
  [
    "library-data.ts",
    [
      "SourcePrimitive",
      "PassingMode",
      "WellKnownSymbol",
      "LibraryPropertyName",
      "LibraryTypeParameter",
      "LibraryType",
      "LibraryParameter",
      "LibrarySignature",
      "LibraryMember",
      "LibraryDeclaration",
      "LibraryImport",
      "LibraryModuleIdentity",
      "LibraryExportIdentity",
      "LibraryRole",
      "LibraryModule",
      "LibraryText",
      "SourceLibrary"
    ]
  ],
  [
    "syntax-data.ts",
    [
      "SyntaxKind",
      "SyntaxRole",
      "SyntaxChild",
      "SyntaxObservation"
    ]
  ],
  [
    "input-data.ts",
    [
      "InputObservation<T>",
      "ObservedKey",
      "ObservedLiteral",
      "ObservedComponentStep",
      "ObservedComponent",
      "ObservedParameter",
      "ObservedSignature",
      "ObservedMemberOrigin",
      "ObservedMember",
      "ObservedIndex",
      "ObservedMemberInventory",
      "ObservedType",
      "ObservedTypeArgument",
      "ObservedCallValue",
      "ObservedApplication",
      "ObservedAuthoredArgument",
      "ObservedArgumentBinding",
      "ObservedInferenceContribution",
      "ObservedDiagnosticCoverage",
      "ObservedConstraint",
      "ObservedCallCandidate",
      "ObservedCallSelection",
      "ObservedCallableAssociation",
      "ObservedProviderDeclaration"
    ]
  ],
  [
    "core-input-data.ts",
    [
      "ObservedDataLayout",
      "ObservedMemorySource",
      "ObservedLayout",
      "ObservedMemoryField",
      "ObservedMemoryMetadata",
      "ObservedFieldBinding",
      "ObservedRecordBinding",
      "ObservedLayoutQuery",
      "ObservedPointerType",
      "ObservedIntegerOperand",
      "ObservedAddressInteger",
      "ObservedPointerOperation",
      "ObservedFieldMarker",
      "ObservedMarkers",
      "ObservedAttribute",
      "ObservedSafetySelection",
      "ObservedSafety",
      "CoreInputObservation"
    ]
  ],
  [
    "original-input-data.ts",
    [
      "OriginalRole",
      "OriginalRecord",
      "ObservedReference",
      "ObservedModuleLink",
      "ObservedModule",
      "ObservedImplementation",
      "ObservedHeritageEdge",
      "ObservedConstructor",
      "ObservedEnum",
      "ObservedPropertyName",
      "ObservedIndexSelection",
      "ObservedMemberArm",
      "ObservedMemberUse",
      "ObservedIteratorWitness",
      "ObservedAtomicIteration",
      "ObservedIterationMechanism",
      "ObservedProtocol"
    ]
  ],
  [
    "program-input-data.ts",
    [
      "SourceFileInput",
      "SourceDeclarationPolicy",
      "SourceSafetyProviderInput",
      "SourceModuleOwnership",
      "SourceProfileInput",
      "SourceCheckRequest",
      "SourceDocument",
      "ObservedDiagnostic",
      "SourceProgramInput",
      "SourceCheckResult",
      "OriginalSelection",
      "OriginalObservationInput",
      "SyntaxObservationInput",
      "ComponentSelection",
      "ComponentObservationInput",
      "ApplicationSelection",
      "ApplicationObservationInput",
      "MemberSelection",
      "MemberObservationInput",
      "ExtensionObservationInput"
    ]
  ],
  [
    "input-answer-data.ts",
    [
      "OriginalObservation",
      "ComponentObservation",
      "ApplicationObservation",
      "MemberObservation",
      "ExtensionObservation"
    ]
  ]
]);

const primitives = ["bool", "char", "int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64",
  "native-int", "native-uint", "float16", "float32", "float64", "decimal", "int128", "uint128"];
const symbols = ["asyncDispose", "asyncIterator", "dispose", "hasInstance", "isConcatSpreadable", "iterator",
  "match", "matchAll", "replace", "search", "species", "split", "toPrimitive", "toStringTag", "unscopables"];
const dataFiles = [model + "contract.ts", ...expected.map(([file]) => model + file)].sort();
const names = expected.flatMap(([, entries]) => entries.map(name => name.replace("<T>", "")));
const types = expected.flatMap(([, entries]) => entries);
const domains = [
  ["Model.ContextInvariantCode", ["INVALID_CONTEXT_INPUT","CONTEXT_CLOSED","DUPLICATE_QUESTION","MISSING_PROVIDER","DUPLICATE_PROVIDER","REGISTRATION_SEALED","REGISTRATION_UNSEALED","FOREIGN_QUESTION","INVALID_QUESTION_KEY","INVALID_RESOURCE_SCOPE","QUESTION_CYCLE","AUTHENTICATION_REENTRANCY"]],
  ["Model.Presence<string>['kind']", ["none","present"]],
  ["Model.Diagnostic['category']", ["error","warning","message"]],
  ["Model.IntegerFormat['signedness']", ["signed","unsigned"]],
  ["Model.DataResult<string>['kind']", ["valid","invalid"]],
  ["Extract<Model.DataResult<string>,{kind:'invalid'}>['code']", ["INVALID_INTEGER_FORMAT","INVALID_INTEGER_VALUE","INVALID_KEY_DOMAIN"]],
  ["Model.AlgebraKey<Model.Original>['kind']", ["name","symbol"]],
  ["Model.KeyDomain<Model.Original>['kind']", ["empty","finite","names","symbols","all"]],
  ["Model.PassingMode", ["by-value","byref-readonly","byref-readwrite","byref-writeonly-must-init","borrow-shared","borrow-mut","move"]],
  ["Exclude<Model.LibraryPropertyName,string>['kind']", ["identifier","string-literal","number-literal","well-known-symbol"]],
  ["Model.LibraryType['kind']", ["any","unknown","void","never","undefined","boolean","string","number","bigint","object","source-primitive","source-global","type-parameter","array","tuple","union","intersection","function","literal","bigint-literal","provider-ref"]],
  ["Model.LibraryTypeParameter['variance']", ["in","out","invariant"]],
  ["Model.LibrarySignature['accessibility']", ["public","protected","protected-internal"]],
  ["Model.LibraryMember['kind']", ["method","constructor","property","field","indexer"]],
  ["Model.LibraryDeclaration['kind']", ["type","value","namespace","function","class","interface","enum"]],
  ["Model.LibraryDeclaration['exportKind']", ["named","default"]],
  ["Model.LibraryImport['namedImports'][number]['kind']", ["type","value","namespace"]],
  ["Model.InputObservation<string>['kind']", ["observed","unavailable"]],
  ["Extract<Model.InputObservation<string>,{kind:'unavailable'}>['reason']", ["unvisited","missing-original-component","incomplete-association","unsupported-checked-structure"]],
  ["Model.ObservedKey['kind']", ["name","symbol"]],
  ["Model.ObservedLiteral['kind']", ["boolean","string","number","bigint","symbol"]],
  ["Model.ObservedComponentStep['kind']", ["class-value","element","optional-value","member","class-prototype","mapped-member","parameter","receiver","result","type-argument","union-member","tuple-element","argument-place","parameter-place","index-key","index-value","argument-tail","parameter-tail","tuple-slice","signature-tail"]],
  ["Extract<Model.ObservedComponentStep,{kind:'member'}>['access']", ["read","write"]],
  ["Model.ObservedParameter['kind']", ["required","optional","rest"]],
  ["Model.ObservedSignature['kind']", ["call","construct"]],
  ["Present<Model.ObservedSignature['composition']>['kind']", ["union","intersection"]],
  ["Model.ObservedMemberOrigin['kind']", ["declaration","class-prototype","mapped"]],
  ["Model.ObservedMember['readKind']", ["property","accessor","method","class-prototype","mapped","unavailable"]],
  ["Model.ObservedType['kind']", ["scalar","parameter","enum","declared","union","intersection","array","tuple","structure"]],
  ["Extract<Model.ObservedType,{kind:'scalar'}>['scalar']", ["number","bigint","boolean","string","symbol","absence","void","any","unknown","object","never"]],
  ["Present<Model.ObservedType['definitionFacet']>", ["instance","value"]],
  ["Present<Model.ObservedType['primitive']>['runtimeBase']", ["number","bigint","boolean","string","object"]],
  ["Model.ObservedCallValue['role']", ["value","type"]],
  ["Model.ObservedApplication['kind']", ["call","construct"]],
  ["Model.ObservedAuthoredArgument['form']", ["value","spread"]],
  ["Model.ObservedArgumentBinding['sourceForm']", ["value","spread-element","spread-sequence"]],
  ["Model.ObservedArgumentBinding['parameterForm']", ["parameter","rest-element","rest-sequence"]],
  ["Model.ObservedInferenceContribution['origin']['kind']", ["argument","argument-tail","receiver","contextual-result"]],
  ["Model.ObservedDiagnosticCoverage['kind']", ["unavailable","complete"]],
  ["Extract<Model.ObservedDiagnosticCoverage,{kind:'complete'}>['obligations'][number]['kind']", ["applicability","backing"]],
  ["Extract<Model.ObservedDiagnosticCoverage,{kind:'complete'}>['purpose']['kind']", ["alternative-applicability","other"]],
  ["Model.ObservedConstraint['kind']", ["operator","index","write-fit"]],
  ["Model.ObservedCallSelection['kind']", ["applicable","conditional-candidates","untyped"]],
  ["Model.ObservedDataLayout['byteOrder']", ["little","big"]],
  ["Model.ObservedMemorySource['kind']", ["binding","result"]],
  ["Model.ObservedLayout['kind']", ["value","array"]],
  ["Model.ObservedMemoryMetadata['kind']", ["data-layout","memory-layout","memory-field"]],
  ["Model.ObservedLayoutQuery['operation']", ["size","alignment","stride","field-offset"]],
  ["Model.ObservedPointerType['kind']", ["raw-address","typed-location","native-pointer","function-pointer"]],
  ["Extract<Model.ObservedPointerType,{kind:'typed-location'}>['mutability']", ["readonly","readwrite","unspecified"]],
  ["Model.ObservedIntegerOperand['runtimeBase']", ["number","bigint"]],
  ["Model.ObservedIntegerOperand['signedness']", ["signed","unsigned"]],
  ["Model.ObservedAddressInteger['runtimeBase']", ["number","bigint"]],
  ["Model.ObservedAddressInteger['signedness']", ["unsigned"]],
  ["Model.ObservedPointerOperation['family']", ["typed-location","native-pointer","raw-address","raw-memory","keep-alive"]],
  ["Extract<Model.ObservedPointerOperation,{family:'typed-location'}>['operation']", ["address-of","allocate","load","store","equal-pointer","hash-pointer","bind-pointer","project-pointer","view"]],
  ["Extract<Model.ObservedPointerOperation,{family:'native-pointer'}>['operation']", ["load","store","offset"]],
  ["Extract<Model.ObservedPointerOperation,{family:'raw-address'}>['operation']", ["bind-raw-pointer","equal-raw-pointer","hash-raw-pointer"]],
  ["Extract<Model.ObservedPointerOperation,{family:'raw-memory'}>['operation']", ["to-raw","reinterpret","byte-offset","raw-to-address-integer","address-integer-to-raw"]],
  ["Extract<Model.ObservedPointerOperation,{family:'typed-location',exportName:string}>['selection']", ["applicable","conditional-candidates","untyped","unvisited"]],
  ["Extract<Model.ObservedPointerOperation,{family:'typed-location',exportName:string}>['pointee']", ["available","unvisited","not-applicable","missing"]],
  ["Model.ObservedAttribute['kind']", ["builder-state","application"]],
  ["Present<Model.ObservedAttribute['applicationMemberKind']>", ["property","method"]],
  ["Present<Model.ObservedAttribute['applicationPlacement']>", ["declaration","constructor"]],
  ["Model.ObservedSafetySelection['kind']", ["selected","unavailable"]],
  ["Extract<Model.ObservedSafetySelection,{kind:'unavailable'}>['reason']", ["function-shape","receiver","member-evidence"]],
  ["Model.ObservedSafety['family']", ["unsafe-context","safety"]],
  ["Extract<Model.ObservedSafety,{family:'unsafe-context'}>['operation']", ["expression","remaining-block"]],
  ["Extract<Model.ObservedSafety,{family:'safety'}>['operation']", ["root","select-member","placement","apply"]],
  ["Extract<Model.ObservedSafety,{operation:'root'}>['form']", ["type","value"]],
  ["Extract<Model.ObservedSafety,{operation:'select-member'}>['memberKind']", ["indexer","method","property"]],
  ["Extract<Model.ObservedSafety,{operation:'placement'}>['placement']", ["declaration","constructor","getter","setter"]],
  ["Extract<Model.ObservedSafety,{operation:'apply'}>['contract']", ["requires-unsafe","safe"]],
  ["Present<Observed<Model.CoreInputObservation['argumentPassing']>>['role']", ["declaration","argument"]],
  ["Present<Observed<Model.CoreInputObservation['flowState']>>", ["moved","borrowed-shared","borrowed-mut"]],
  ["Model.OriginalRole", ["document","syntax","component","signature","application","diagnostic","type-parameter"]],
  ["Model.ObservedReference['meaning']", ["value","type","namespace"]],
  ["Model.ObservedModuleLink['kind']", ["import","export"]],
  ["Model.ObservedModuleLink['resolution']['kind']", ["project","non-project","unresolved"]],
  ["Model.ObservedImplementation['kind']", ["selected","unrelated"]],
  ["Model.ObservedHeritageEdge['kind']", ["extends","implements"]],
  ["Model.ObservedConstructor['witness']", ["implicit","declared"]],
  ["Observed<Model.ObservedEnum['members'][number]['constant']>['kind']", ["number","string"]],
  ["Model.ObservedIndexSelection['kind']", ["array-element","index-signature","tuple-element","string-character"]],
  ["Model.ObservedMemberArm['kind']", ["member","index"]],
  ["Model.ObservedMemberUse['access']", ["read","write","read-write","delete"]],
  ["Model.ObservedAtomicIteration['kind']", ["synchronous-iterator-protocol","asynchronous-iterator-protocol","synchronous-iterator-adapted-to-async","array-like-index","array-like-index-adapted-to-async","string-code-unit-index","string-code-unit-index-adapted-to-async","untyped-dynamic-iteration"]],
  ["Model.ObservedIterationMechanism['kind']", ["synchronous-iterator-protocol","asynchronous-iterator-protocol","synchronous-iterator-adapted-to-async","array-like-index","array-like-index-adapted-to-async","string-code-unit-index","string-code-unit-index-adapted-to-async","untyped-dynamic-iteration","union","property-key-enumeration"]],
  ["Model.ObservedProtocol['kind']", ["iteration","generator","yield","resource-management","callable-completion","flow-conditions"]],
  ["Extract<Model.ObservedProtocol,{kind:'iteration'}>['form']", ["for-in","for-of","for-await-of","spread"]],
  ["Extract<Model.ObservedProtocol,{kind:'generator'}>['form']", ["sync","async"]],
  ["Extract<Model.ObservedProtocol,{kind:'yield'}>['form']", ["value","delegate"]],
  ["Extract<Model.ObservedProtocol,{kind:'resource-management'}>['form']", ["using","await using"]],
  ["Extract<Model.ObservedProtocol,{kind:'resource-management'}>['acquisition']['kind']", ["initializer","iteration"]],
  ["Extract<Model.ObservedProtocol,{kind:'resource-management'}>['disposal']['kind']", ["selected","untyped-dynamic","unavailable"]],
  ["Model.SourceFileInput['role']", ["project","installed-declaration","profile-declaration","package-manifest"]],
  ["Model.SourceDeclarationPolicy['installedDeclarations']", ["none","package-contract"]],
  ["Model.SourceCheckResult['kind']", ["checked","invalid-input"]],
  ["Model.OriginalSelection['kind']", ["record","document","reference","module","implementation","member-contracts","member-dispatch","heritage","constructors","callable-association","enum","provider"]],
  ["Extract<Model.OriginalSelection,{kind:'reference'}>['meaning']", ["source","project"]],
  ["Model.ComponentSelection['kind']", ["syntax","describe","class-facets","signature","declaration-signature","signature-component"]],
  ["Extract<Model.ComponentSelection,{kind:'signature-component'}>['part']['kind']", ["parameter","receiver","result"]],
  ["Model.ApplicationSelection['kind']", ["invocation","constraints"]],
  ["Model.MemberSelection['kind']", ["inventory","use","property-name"]],
  ["Model.ExtensionObservationInput['family']", ["core","iteration","generator","yield","resource-management","callable-completion","flow-conditions"]],
  ["Model.OriginalObservation['kind']", ["record","document","reference","module","implementation","member-contracts","member-dispatch","heritage","constructors","callable-association","enum","provider"]],
  ["Extract<Model.OriginalObservation,{kind:'heritage'}>['relation']['kind']", ["related","unrelated"]],
  ["Model.ComponentObservation['kind']", ["syntax","describe","class-facets","signature","declaration-signature","signature-component"]],
  ["Model.ApplicationObservation['kind']", ["invocation","constraints"]],
  ["Model.MemberObservation['kind']", ["inventory","use","property-name"]],
  ["Model.ExtensionObservation['kind']", ["core","protocol"]],
];

const syntaxKinds = ["KindUnknown","KindEndOfFile","KindSingleLineCommentTrivia","KindMultiLineCommentTrivia","KindNewLineTrivia","KindWhitespaceTrivia","KindConflictMarkerTrivia","KindNonTextFileMarkerTrivia","KindNumericLiteral","KindBigIntLiteral","KindStringLiteral","KindJsxText","KindJsxTextAllWhiteSpaces","KindRegularExpressionLiteral","KindNoSubstitutionTemplateLiteral","KindTemplateHead","KindTemplateMiddle","KindTemplateTail","KindOpenBraceToken","KindCloseBraceToken","KindOpenParenToken","KindCloseParenToken","KindOpenBracketToken","KindCloseBracketToken","KindDotToken","KindDotDotDotToken","KindSemicolonToken","KindCommaToken","KindQuestionDotToken","KindLessThanToken","KindLessThanSlashToken","KindGreaterThanToken","KindLessThanEqualsToken","KindGreaterThanEqualsToken","KindEqualsEqualsToken","KindExclamationEqualsToken","KindEqualsEqualsEqualsToken","KindExclamationEqualsEqualsToken","KindEqualsGreaterThanToken","KindPlusToken","KindMinusToken","KindAsteriskToken","KindAsteriskAsteriskToken","KindSlashToken","KindPercentToken","KindPlusPlusToken","KindMinusMinusToken","KindLessThanLessThanToken","KindGreaterThanGreaterThanToken","KindGreaterThanGreaterThanGreaterThanToken","KindAmpersandToken","KindBarToken","KindCaretToken","KindExclamationToken","KindTildeToken","KindAmpersandAmpersandToken","KindBarBarToken","KindQuestionToken","KindColonToken","KindAtToken","KindQuestionQuestionToken","KindBacktickToken","KindHashToken","KindEqualsToken","KindPlusEqualsToken","KindMinusEqualsToken","KindAsteriskEqualsToken","KindAsteriskAsteriskEqualsToken","KindSlashEqualsToken","KindPercentEqualsToken","KindLessThanLessThanEqualsToken","KindGreaterThanGreaterThanEqualsToken","KindGreaterThanGreaterThanGreaterThanEqualsToken","KindAmpersandEqualsToken","KindBarEqualsToken","KindBarBarEqualsToken","KindAmpersandAmpersandEqualsToken","KindQuestionQuestionEqualsToken","KindCaretEqualsToken","KindIdentifier","KindPrivateIdentifier","KindJSDocCommentTextToken","KindBreakKeyword","KindCaseKeyword","KindCatchKeyword","KindClassKeyword","KindConstKeyword","KindContinueKeyword","KindDebuggerKeyword","KindDefaultKeyword","KindDeleteKeyword","KindDoKeyword","KindElseKeyword","KindEnumKeyword","KindExportKeyword","KindExtendsKeyword","KindFalseKeyword","KindFinallyKeyword","KindForKeyword","KindFunctionKeyword","KindIfKeyword","KindImportKeyword","KindInKeyword","KindInstanceOfKeyword","KindNewKeyword","KindNullKeyword","KindReturnKeyword","KindSuperKeyword","KindSwitchKeyword","KindThisKeyword","KindThrowKeyword","KindTrueKeyword","KindTryKeyword","KindTypeOfKeyword","KindVarKeyword","KindVoidKeyword","KindWhileKeyword","KindWithKeyword","KindImplementsKeyword","KindInterfaceKeyword","KindLetKeyword","KindPackageKeyword","KindPrivateKeyword","KindProtectedKeyword","KindPublicKeyword","KindStaticKeyword","KindYieldKeyword","KindAbstractKeyword","KindAccessorKeyword","KindAsKeyword","KindAssertsKeyword","KindAssertKeyword","KindAnyKeyword","KindAsyncKeyword","KindAwaitKeyword","KindBooleanKeyword","KindConstructorKeyword","KindDeclareKeyword","KindGetKeyword","KindImmediateKeyword","KindInferKeyword","KindIntrinsicKeyword","KindIsKeyword","KindKeyOfKeyword","KindModuleKeyword","KindNamespaceKeyword","KindNeverKeyword","KindOutKeyword","KindReadonlyKeyword","KindRequireKeyword","KindNumberKeyword","KindObjectKeyword","KindSatisfiesKeyword","KindSetKeyword","KindStringKeyword","KindSymbolKeyword","KindTypeKeyword","KindUndefinedKeyword","KindUniqueKeyword","KindUnknownKeyword","KindUsingKeyword","KindFromKeyword","KindGlobalKeyword","KindBigIntKeyword","KindOverrideKeyword","KindOfKeyword","KindDeferKeyword","KindQualifiedName","KindComputedPropertyName","KindTypeParameter","KindParameter","KindDecorator","KindPropertySignature","KindPropertyDeclaration","KindMethodSignature","KindMethodDeclaration","KindClassStaticBlockDeclaration","KindConstructor","KindGetAccessor","KindSetAccessor","KindCallSignature","KindConstructSignature","KindIndexSignature","KindTypePredicate","KindTypeReference","KindFunctionType","KindConstructorType","KindTypeQuery","KindTypeLiteral","KindArrayType","KindTupleType","KindOptionalType","KindRestType","KindUnionType","KindIntersectionType","KindConditionalType","KindInferType","KindParenthesizedType","KindThisType","KindTypeOperator","KindIndexedAccessType","KindMappedType","KindLiteralType","KindNamedTupleMember","KindTemplateLiteralType","KindTemplateLiteralTypeSpan","KindImportType","KindObjectBindingPattern","KindArrayBindingPattern","KindBindingElement","KindArrayLiteralExpression","KindObjectLiteralExpression","KindPropertyAccessExpression","KindElementAccessExpression","KindCallExpression","KindNewExpression","KindTaggedTemplateExpression","KindTypeAssertionExpression","KindParenthesizedExpression","KindFunctionExpression","KindArrowFunction","KindDeleteExpression","KindTypeOfExpression","KindVoidExpression","KindAwaitExpression","KindPrefixUnaryExpression","KindPostfixUnaryExpression","KindBinaryExpression","KindConditionalExpression","KindTemplateExpression","KindYieldExpression","KindSpreadElement","KindClassExpression","KindOmittedExpression","KindExpressionWithTypeArguments","KindAsExpression","KindNonNullExpression","KindMetaProperty","KindSyntheticExpression","KindSatisfiesExpression","KindTemplateSpan","KindSemicolonClassElement","KindBlock","KindEmptyStatement","KindVariableStatement","KindExpressionStatement","KindIfStatement","KindDoStatement","KindWhileStatement","KindForStatement","KindForInStatement","KindForOfStatement","KindContinueStatement","KindBreakStatement","KindReturnStatement","KindWithStatement","KindSwitchStatement","KindLabeledStatement","KindThrowStatement","KindTryStatement","KindDebuggerStatement","KindVariableDeclaration","KindVariableDeclarationList","KindFunctionDeclaration","KindClassDeclaration","KindInterfaceDeclaration","KindTypeAliasDeclaration","KindEnumDeclaration","KindModuleDeclaration","KindModuleBlock","KindCaseBlock","KindNamespaceExportDeclaration","KindImportEqualsDeclaration","KindImportDeclaration","KindImportClause","KindNamespaceImport","KindNamedImports","KindImportSpecifier","KindExportAssignment","KindExportDeclaration","KindNamedExports","KindNamespaceExport","KindExportSpecifier","KindMissingDeclaration","KindExternalModuleReference","KindJsxElement","KindJsxSelfClosingElement","KindJsxOpeningElement","KindJsxClosingElement","KindJsxFragment","KindJsxOpeningFragment","KindJsxClosingFragment","KindJsxAttribute","KindJsxAttributes","KindJsxSpreadAttribute","KindJsxExpression","KindJsxNamespacedName","KindCaseClause","KindDefaultClause","KindHeritageClause","KindCatchClause","KindImportAttributes","KindImportAttribute","KindPropertyAssignment","KindShorthandPropertyAssignment","KindSpreadAssignment","KindEnumMember","KindSourceFile","KindJSDocTypeExpression","KindJSDocNameReference","KindJSDocAllType","KindJSDocNullableType","KindJSDocNonNullableType","KindJSDocOptionalType","KindJSDocVariadicType","KindJSDoc","KindJSDocText","KindJSDocTypeLiteral","KindJSDocSignature","KindJSDocLink","KindJSDocLinkCode","KindJSDocLinkPlain","KindJSDocUnknownTag","KindJSDocAugmentsTag","KindJSDocImplementsTag","KindJSDocDeprecatedTag","KindJSDocPublicTag","KindJSDocPrivateTag","KindJSDocProtectedTag","KindJSDocReadonlyTag","KindJSDocOverrideTag","KindJSDocCallbackTag","KindJSDocOverloadTag","KindJSDocParameterTag","KindJSDocReturnTag","KindJSDocThisTag","KindJSDocTypeTag","KindJSDocTemplateTag","KindJSDocTypedefTag","KindJSDocSeeTag","KindJSDocPropertyTag","KindJSDocThrowsTag","KindJSDocSatisfiesTag","KindJSDocImportTag","KindSyntaxList","KindJSTypeAliasDeclaration","KindJSImportDeclaration","KindNotEmittedStatement","KindPartiallyEmittedExpression","KindSyntheticReferenceExpression","KindNotEmittedTypeElement"];
const syntaxRoles = ["name","property-name","expression","receiver","left","right","operator","condition","when-true","when-false","argument","type-argument","parameter","type-parameter","type","constraint","default-type","initializer","body","statement","member","element","property","binding","rest","decorator","modifier","heritage","clause","case","catch","finally","incrementor","then","else","label","module-specifier","import-clause","import-binding","export-clause","export-binding","attribute","qualifier","template-head","template-span","template-tail","jsx-tag","jsx-attribute","jsx-child","type-member","check-type","extends-type","true-type","false-type","object-type","index-type","name-type","assertion","token","documentation"];
const readonlyRecords = [["ProgramIdentity","kind"],["Identity","programIdentity"],["Original","kind"],["SourceSite","original"],["Presence<Model.Original>","kind"],["DiagnosticEvidence","name"],["Diagnostic","category"],["ResourceLimit","dimension"],["ResourceDomain","name"],["ResourceUsage","domain"],["CompilerResourceLimitFailure","kind"],["QueryChainEntry","owner"],["ContextInvariantFailure","code"],["IntegerFormat","signedness"],["IntegerRange","minimum"],["DataResult<Model.Original>","kind"],["AlgebraKey<Model.Original>","kind"],["KeyDomain<Model.Original>","kind"],["ModelAlgebra","integerBounds"],["LibraryPropertyName","kind"],["LibraryTypeParameter","name"],["LibraryType","kind"],["LibraryParameter","name"],["LibrarySignature","id"],["LibraryMember","id"],["LibraryDeclaration","id"],["LibraryImport","moduleSpecifier"],["LibraryModuleIdentity","providerId"],["LibraryExportIdentity","module"],["LibraryRole","identity"],["LibraryModule","identity"],["LibraryText","fileName"],["SourceLibrary","id"],["SyntaxChild","role"],["SyntaxObservation","original"],["InputObservation<Model.Original>","kind"],["ObservedKey","kind"],["ObservedLiteral","kind"],["ObservedComponentStep","kind"],["ObservedComponent","identity"],["ObservedParameter","declaration"],["ObservedSignature","identity"],["ObservedMemberOrigin","kind"],["ObservedMember","key"],["ObservedIndex","declaration"],["ObservedMemberInventory","component"],["ObservedType","component"],["ObservedTypeArgument","parameter"],["ObservedCallValue","occurrence"],["ObservedApplication","identity"],["ObservedAuthoredArgument","occurrence"],["ObservedArgumentBinding","sourceArgument"],["ObservedInferenceContribution","declaration"],["ObservedDiagnosticCoverage","kind"],["ObservedConstraint","site"],["ObservedCallCandidate","identity"],["ObservedCallSelection","invocation"],["ObservedCallableAssociation","declaration"],["ObservedProviderDeclaration","original"],["ObservedDataLayout","identity"],["ObservedMemorySource","kind"],["ObservedLayout","identity"],["ObservedMemoryField","identity"],["ObservedMemoryMetadata","kind"],["ObservedFieldBinding","occurrence"],["ObservedRecordBinding","occurrence"],["ObservedLayoutQuery","occurrence"],["ObservedPointerType","kind"],["ObservedIntegerOperand","runtimeBase"],["ObservedAddressInteger","width"],["ObservedPointerOperation","family"],["ObservedFieldMarker","name"],["ObservedMarkers","struct"],["ObservedAttribute","occurrence"],["ObservedSafetySelection","kind"],["ObservedSafety","occurrence"],["CoreInputObservation","original"],["OriginalRecord","original"],["ObservedReference","meaning"],["ObservedModuleLink","document"],["ObservedModule","document"],["ObservedImplementation","kind"],["ObservedHeritageEdge","kind"],["ObservedConstructor","declaration"],["ObservedEnum","declarations"],["ObservedPropertyName","original"],["ObservedIndexSelection","kind"],["ObservedMemberArm","kind"],["ObservedMemberUse","occurrence"],["ObservedIteratorWitness","declarations"],["ObservedAtomicIteration","source"],["ObservedIterationMechanism","kind"],["ObservedProtocol","kind"],["SourceFileInput","path"],["SourceDeclarationPolicy","bundledLibraries"],["SourceSafetyProviderInput","providerId"],["SourceModuleOwnership","specifierPrefix"],["SourceProfileInput","id"],["SourceCheckRequest","currentDirectory"],["SourceDocument","original"],["ObservedDiagnostic","original"],["SourceProgramInput","programIdentity"],["SourceCheckResult","kind"],["OriginalSelection","kind"],["OriginalObservationInput","input"],["SyntaxObservationInput","input"],["ComponentSelection","kind"],["ComponentObservationInput","input"],["ApplicationSelection","kind"],["ApplicationObservationInput","input"],["MemberSelection","kind"],["MemberObservationInput","input"],["ExtensionObservationInput","input"],["OriginalObservation","kind"],["ComponentObservation","kind"],["ApplicationObservation","kind"],["MemberObservation","kind"],["ExtensionObservation","kind"]];

const positiveBody = `
declare const original: Model.Original;
declare const signature: Model.Original;
declare const component: Model.Original;
declare const programIdentity: Model.ProgramIdentity;
declare const identity: Model.Identity;
declare const sourceInput: Model.SourceProgramInput;
declare const syntax: Model.SyntaxObservation;
declare const observedType: Model.ObservedType;
declare const observedSignature: Model.ObservedSignature;
declare const member: Model.ObservedMember;
declare const inventory: Model.ObservedMemberInventory;
declare const call: Model.ObservedCallSelection;
declare const constructor: Model.ObservedConstructor;
declare const association: Model.ObservedCallableAssociation;
declare const protocol: Model.ObservedProtocol;
declare const core: Model.CoreInputObservation;
declare const library: Model.LibraryModule;
declare const layout: Model.ObservedDataLayout;
const none = {kind:'none'} as const;
const observed = {kind:'observed',value:original} as const;
const unavailable: Model.InputObservation<Model.Original> = {kind:'unavailable',reason:'unvisited',diagnostics:[original]};
const originalRecord: Model.OriginalRecord = {original,role:'component',document:none,start:none,length:none};
const syntaxInput: Model.SyntaxObservationInput = {input:sourceInput,original};
const originalInputs: readonly Model.OriginalObservationInput[] = [
 {input:sourceInput,selection:{kind:'record',original}},
 {input:sourceInput,selection:{kind:'document',path:'/source.ts'}},
 {input:sourceInput,selection:{kind:'reference',original,meaning:'source'}},
 {input:sourceInput,selection:{kind:'reference',original,meaning:'project'}},
 {input:sourceInput,selection:{kind:'module',document:original}},
 {input:sourceInput,selection:{kind:'implementation',declaration:original,contract:none}},
 {input:sourceInput,selection:{kind:'member-contracts',declaration:original}},
 {input:sourceInput,selection:{kind:'member-dispatch',declaration:original}},
 {input:sourceInput,selection:{kind:'heritage',declaration:original,target:none}},
 {input:sourceInput,selection:{kind:'constructors',declaration:original}},
 {input:sourceInput,selection:{kind:'callable-association',declaration:original}},
 {input:sourceInput,selection:{kind:'enum',declaration:original}},
 {input:sourceInput,selection:{kind:'provider',original}},
];
const componentInputs: readonly Model.ComponentObservationInput[] = [
 {input:sourceInput,selection:{kind:'syntax',original}},
 {input:sourceInput,selection:{kind:'describe',component}},
 {input:sourceInput,selection:{kind:'class-facets',declaration:original}},
 {input:sourceInput,selection:{kind:'signature',signature}},
 {input:sourceInput,selection:{kind:'declaration-signature',declaration:original}},
 {input:sourceInput,selection:{kind:'signature-component',signature,root:original,part:{kind:'parameter',index:0}}},
 {input:sourceInput,selection:{kind:'signature-component',signature,root:original,part:{kind:'receiver'}}},
 {input:sourceInput,selection:{kind:'signature-component',signature,root:original,part:{kind:'result'}}},
];
const applicationInputs: readonly Model.ApplicationObservationInput[] = [
 {input:sourceInput,selection:{kind:'invocation',invocation:original}},
 {input:sourceInput,selection:{kind:'constraints',occurrence:original}},
];
const memberInputs: readonly Model.MemberObservationInput[] = [
 {input:sourceInput,selection:{kind:'inventory',component}},
 {input:sourceInput,selection:{kind:'use',occurrence:original}},
 {input:sourceInput,selection:{kind:'property-name',occurrence:original}},
];
const extensionInputs: readonly Model.ExtensionObservationInput[] = [
 {input:sourceInput,original,family:'core'}, {input:sourceInput,original,family:'iteration'},
 {input:sourceInput,original,family:'generator'}, {input:sourceInput,original,family:'yield'},
 {input:sourceInput,original,family:'resource-management'},
 {input:sourceInput,original,family:'callable-completion'}, {input:sourceInput,original,family:'flow-conditions'},
];
const originalAnswers: readonly Model.OriginalObservation[] = [
 {kind:'record',record:originalRecord}, {kind:'document',document:none}, {kind:'reference',reference:none},
 {kind:'module',module:{document:original,links:[],exports:[]}},
 {kind:'implementation',implementation:{kind:'unrelated'}},
 {kind:'member-contracts',declaration:original,contracts:[signature]},
 {kind:'member-dispatch',declaration:original,dispatch:{kind:'present',value:{overridesBase:true,hasDerivedOverride:false}}},
 {kind:'heritage',relation:{kind:'unrelated'}}, {kind:'heritage',relation:{kind:'related',edges:[]}},
 {kind:'constructors',constructors:constructor}, {kind:'callable-association',association},
 {kind:'enum',enumeration:{declarations:[original],members:[]}}, {kind:'provider',provider:none},
];
const componentAnswers: readonly Model.ComponentObservation[] = [
 {kind:'syntax',component:{identity:component,root:original,path:[]}},
 {kind:'describe',type:observedType}, {kind:'class-facets',instance:component,value:original},
 {kind:'signature',signature:observedSignature}, {kind:'declaration-signature',signature:none},
 {kind:'signature-component',component:{identity:component,root:original,path:[{kind:'result',signature}]}},
];
const applicationAnswers: readonly Model.ApplicationObservation[] = [
 {kind:'invocation',selection:call}, {kind:'constraints',constraints:[]},
];
const memberAnswers: readonly Model.MemberObservation[] = [
 {kind:'inventory',inventory}, {kind:'use',use:none},
 {kind:'property-name',name:{original,selected:none,numericIndex:false,symbol:none}},
];
const extensionAnswers: readonly Model.ExtensionObservation[] = [
 {kind:'core',observation:core}, {kind:'protocol',observation:{kind:'present',value:protocol}},
 {kind:'protocol',observation:none},
];
const check: Model.SourceCheckRequest = {
 currentDirectory:'/',projectRoot:'/',entryPoint:'/source.ts',rootFiles:['/source.ts'],caseSensitive:true,
 files:[{path:'/source.ts',text:'export {};',role:'project',owner:none}],declarations:[library],
 declarationPolicy:{bundledLibraries:[],installedDeclarations:'package-contract'},
 moduleOwnership:[{specifierPrefix:'provider',providerId:none,message:none}],requiredProviderModules:[],
 profile:{id:'profile',libraries:[],declarationOwners:[]},dataLayouts:[layout],safetyProviders:[],
};
const checked: Model.SourceCheckResult = {kind:'checked',input:sourceInput};
const invalid: Model.SourceCheckResult = {kind:'invalid-input',diagnostics:[]};
const syntaxAnswer: Model.InputObservation<Model.SyntaxObservation> = {kind:'observed',value:syntax};
const paths: readonly Model.ObservedComponentStep[] = [
 {kind:'class-value'}, {kind:'element'}, {kind:'optional-value'}, {kind:'member',declaration:original,access:'read'},
 {kind:'class-prototype',declaration:original},
 {kind:'mapped-member',declaration:original,source:component,key:{kind:'symbol',original},access:'write'},
 {kind:'parameter',signature,index:0}, {kind:'receiver',signature}, {kind:'result',signature},
 {kind:'type-argument',declaration:original,index:0}, {kind:'union-member',index:0},
 {kind:'tuple-element',index:0}, {kind:'argument-place',index:0}, {kind:'parameter-place',index:0},
 {kind:'index-key',declaration:original}, {kind:'index-value',declaration:original},
 {kind:'argument-tail',start:0}, {kind:'parameter-tail',start:0},
 {kind:'tuple-slice',start:0,endCount:1,readonly:true},
 {kind:'signature-tail',signature,start:0,readonly:true},
];
const strings: Model.ObservedIndexSelection = {kind:'string-character',receiver:component,read:component};
const prototype: Model.ObservedMemberOrigin = {kind:'class-prototype',declaration:original,facet:'value'};
const mapped: Model.ObservedMemberOrigin = {kind:'mapped',declaration:original,source:component,key:{kind:'name',name:'x'},access:'write'};
const body: Model.ObservedCallableAssociation = {declaration:original,advertised:[signature],body:observed,
 classParameters:{kind:'observed',value:[original]},advertisedParameters:[{signature,parameters:{kind:'observed',value:[component]}}],
 bodyParameters:{kind:'unavailable',reason:'incomplete-association',diagnostics:[]},
 captures:{kind:'observed',value:[component]}};
const coverage: Model.ObservedDiagnosticCoverage = {kind:'complete',root:original,
 obligations:[{kind:'backing',diagnostic:original,application:none}],
 purpose:{kind:'alternative-applicability',invocation:original,notes:[original]}};
const field: Model.ObservedMemoryField = {identity:original,owner:{kind:'binding',application:original,
 declaration:original,component},value:{kind:'result',application:original,path:paths,component},
 selector:original,selection:original,primary:none,selectedDeclarations:[original],layout:original,
 byteOffset:9007199254740993n,byteAlignment:8n};
const array: Model.ObservedLayout = {kind:'array',identity:original,occurrence:original,source:field.value,
 dataLayout:layout,byteSize:0n,byteAlignment:1n,stride:0n,extent:{length:9007199254740993n,runtimeBase:'bigint'},
 element:original};
const observation: Model.ObservedLayoutQuery = {operation:'field-offset',occurrence:original,source:field.owner,
 layoutExpression:original,layout:original,selector:original,selection:original,primary:none,selectedDeclarations:[original]};
const address32: Model.ObservedAddressInteger = {width:32,runtimeBase:'number',signedness:'unsigned'};
const address64: Model.ObservedAddressInteger = {width:64,runtimeBase:'bigint',signedness:'unsigned'};
const primitive: Model.LibraryType = {kind:'source-primitive',name:'int64'};
const recipes: readonly Model.LibraryType[] = [
 {kind:'any'}, {kind:'unknown'}, {kind:'void'}, {kind:'never'}, {kind:'undefined'}, {kind:'boolean'},
 {kind:'string'}, {kind:'number'}, {kind:'bigint'}, {kind:'object'}, primitive,
 {kind:'source-global',name:'Array',typeArguments:[primitive]}, {kind:'type-parameter',name:'T'},
 {kind:'array',elementType:primitive}, {kind:'tuple',elementTypes:[primitive]},
 {kind:'union',types:[primitive]}, {kind:'intersection',types:[primitive]},
 {kind:'function',id:'f',parameters:[],returnType:primitive,typeParameters:[]},
 {kind:'literal',value:null}, {kind:'literal',value:1}, {kind:'literal',value:true},
 {kind:'literal',value:'x'}, {kind:'bigint-literal',value:'9007199254740993'},
 {kind:'provider-ref',moduleSpecifier:'provider',exportName:'Value',localName:none,namespaceImport:none,typeArguments:[]},
];
const pointerOperations: readonly Model.ObservedPointerOperation[] = [
 ...(['address-of','allocate','load','store','equal-pointer','hash-pointer','bind-pointer','project-pointer'] as const)
  .map(operation => ({family:'typed-location' as const,operation,exportName:'authored-id',arguments:[original],
   typeArguments:[component],selection:'applicable' as const,pointee:'available' as const})),
 {family:'typed-location',operation:'view',pointer:original,read:original,write:original,optional:true},
 {family:'native-pointer',operation:'load',pointer:original},
 {family:'native-pointer',operation:'store',pointer:original,value:original},
 {family:'native-pointer',operation:'offset',pointer:original,offset:original},
 {family:'raw-address',operation:'bind-raw-pointer',identity:original},
 {family:'raw-address',operation:'equal-raw-pointer',left:original,right:original},
 {family:'raw-address',operation:'hash-raw-pointer',pointer:original},
 {family:'raw-memory',operation:'to-raw',pointer:original,layout:original},
 {family:'raw-memory',operation:'reinterpret',raw:original,layout:original},
 {family:'raw-memory',operation:'byte-offset',raw:original,offset:original,
  integer:{runtimeBase:'bigint',signedness:'signed',width:128},dataLayout:original},
 {family:'raw-memory',operation:'raw-to-address-integer',raw:original,integer:address64,dataLayout:original},
 {family:'raw-memory',operation:'address-integer-to-raw',address:original,integer:address32,dataLayout:original},
 {family:'keep-alive',operation:'keep-alive',value:original},
];
const safetyBase = {occurrence:original,provider:layout.identity};
const safety: readonly Model.ObservedSafety[] = [
 {...safetyBase,family:'unsafe-context',operation:'expression',expression:original},
 {...safetyBase,family:'unsafe-context',operation:'remaining-block',firstDirectStatement:true},
 {...safetyBase,family:'safety',operation:'root',form:'type',target:none},
 {...safetyBase,family:'safety',operation:'root',form:'value',target:{kind:'present',value:original}},
 {...safetyBase,family:'safety',operation:'select-member',predecessor:none,memberKind:'property',
  selection:{kind:'selected',expression:original,declaration:none,declarations:[original]}},
 {...safetyBase,family:'safety',operation:'select-member',predecessor:none,memberKind:'indexer',
  selection:{kind:'unavailable',reason:'function-shape'}},
 {...safetyBase,family:'safety',operation:'placement',predecessor:none,placement:'getter'},
 {...safetyBase,family:'safety',operation:'apply',predecessor:none,contract:'requires-unsafe'},
];
const iterator: Model.ObservedIteratorWitness = {declarations:[original],receiver:component,member,signatures:[signature]};
const mechanisms: readonly Model.ObservedIterationMechanism[] = [
 {source:component,kind:'synchronous-iterator-protocol',witness:iterator},
 {source:component,kind:'asynchronous-iterator-protocol',witness:iterator},
 {source:component,kind:'synchronous-iterator-adapted-to-async',witness:iterator},
 {source:component,kind:'array-like-index',declarations:[original]},
 {source:component,kind:'array-like-index-adapted-to-async',declarations:[original]},
 {source:component,kind:'string-code-unit-index'}, {source:component,kind:'string-code-unit-index-adapted-to-async'},
 {source:component,kind:'untyped-dynamic-iteration'}, {kind:'union',alternatives:[]}, {kind:'property-key-enumeration'},
];
const protocols: readonly Model.ObservedProtocol[] = [
 {kind:'iteration',occurrence:original,operand:original,form:'for-await-of',mechanism:none},
 {kind:'generator',declaration:original,form:'async',signature,resultDeclaration:none,returnTypeBinding:none},
 {kind:'yield',occurrence:original,generator:original,form:'value',operand:none,mechanism:none},
 {kind:'resource-management',declaration:original,form:'await using',
  acquisition:{kind:'initializer',expression:original},disposal:{kind:'untyped-dynamic'}},
 {kind:'resource-management',declaration:original,form:'using',
  acquisition:{kind:'iteration',statement:original},disposal:{kind:'selected',alternatives:[
   {kind:'sync',declarations:[original],signatures:[signature]},
   {kind:'async',declarations:[original],signatures:[signature]}]}},
 {kind:'resource-management',declaration:original,form:'using',
  acquisition:{kind:'initializer',expression:original},disposal:{kind:'unavailable'}},
 {kind:'callable-completion',declaration:original,canFallThrough:true},
 {kind:'flow-conditions',reference:original,conditions:[{expression:original,assumed:false,assignments:[original]}]},
];
const constraints: readonly Model.ObservedConstraint[] = [
 {kind:'operator',site:original,diagnostic:original,rootDiagnostic:original,rootCoverage:coverage,
  application:none,operation:original,left:component,right:component},
 {kind:'index',site:original,diagnostic:original,rootDiagnostic:original,rootCoverage:coverage,
  application:none,access:original,receiver:component,index:component},
 {kind:'write-fit',site:original,diagnostic:original,rootDiagnostic:original,rootCoverage:coverage,
  application:none,source:component,destination:component},
];
const signatureRecord: Model.ObservedSignature = {identity:signature,target:none,owner:none,declaration:none,
 kind:'call',typeParameters:{kind:'observed',value:[original]},receiver:{kind:'present',value:component},
 parameters:[{declaration:none,kind:'required',component},{declaration:none,kind:'optional',component},
  {declaration:none,kind:'rest',component}],result:component,
 composition:{kind:'present',value:{kind:'intersection',signatures:[signature]}}};
const argumentBinding: Model.ObservedArgumentBinding = {sourceArgument:original,sourceArgumentIndex:0,
 effectiveArgument:original,effectiveArgumentIndex:0,sourceForm:'spread-element',spreadElementIndex:{kind:'present',value:0},
 parameterIndex:0,parameterForm:'rest-element',source:observed,destination:unavailable};
const applicationRecord: Model.ObservedApplication = {identity:original,invocation:original,kind:'call',signature,
 callee:{occurrence:original,component,role:'value'},receiver:none,
 class:{kind:'present',value:{declaration:original,arguments:[{parameter:original,declaration:none,
  argument:observed,explicitTypeNode:none,defaultTypeNode:none}]}},signatureArguments:[]};
const candidate: Model.ObservedCallCandidate = {identity:original,application:applicationRecord,
 sourceArguments:[{occurrence:original,expression:original,form:'spread',component:observed}],
 arguments:{kind:'observed',value:[argumentBinding]},
 inferenceContributions:{kind:'observed',value:[{declaration:none,
  origin:{kind:'argument-tail',subject:original,effectiveArgumentIndex:0,parameterIndex:0},source:component,formal:component}]},
 constraints,diagnostics:[original],diagnosticCoverage:[coverage]};
const selections: readonly Model.ObservedCallSelection[] = [
 {kind:'applicable',invocation:original,declarationOrder:{kind:'observed',value:[signature]},
  selection:candidate,result:component,parameters:signatureRecord.parameters},
 {kind:'conditional-candidates',invocation:original,declarationOrder:{kind:'observed',value:[signature]},
  candidates:[candidate],diagnostics:[original]},
 {kind:'untyped',invocation:original,declarationOrder:unavailable,diagnostics:[original]},
];
const use: Model.ObservedMemberUse = {occurrence:original,receiver:{occurrence:original,component},key:none,
 access:'read-write',callCallee:false,optionalChain:true,chainContinuation:true,selectedDeclaration:none,
 selectedDeclarations:[original],readDeclarations:[original],writeDeclarations:[original],
 read:{kind:'present',value:component},write:{kind:'present',value:component},arms:[
  {kind:'member',receiver:component,member,readDeclarations:[original],writeDeclarations:[original]},
  {kind:'index',receiver:component,selection:strings,key:component,
   read:{kind:'present',value:component},write:none,readonly:true}]};
const typeBase = {component:{identity:component,root:original,path:paths},authoredTypeNode:none,declaration:none,
 definitionOwner:none,definitionFacet:none,definitionParameters:{kind:'observed' as const,value:[original]},
 literal:none,primitive:none};
const typeRecords = [
 {...typeBase,kind:'scalar',scalar:'void'},
 {...typeBase,kind:'parameter',parameter:original,owner:original,index:0,
  captures:{kind:'observed',value:[component]},constraint:none,defaultType:none},
 {...typeBase,kind:'enum',declaration:{kind:'present',value:original}},
 {...typeBase,kind:'declared',declaration:{kind:'present',value:original},facet:'value',
  parameters:[original],arguments:[component],definition:none,
  extent:{kind:'observed',value:{kind:'present',value:{length:9007199254740993n,runtimeBase:'bigint'}}}},
 {...typeBase,kind:'union',members:[component]}, {...typeBase,kind:'intersection',members:[component]},
 {...typeBase,kind:'array',readonly:true,element:component},
 {...typeBase,kind:'tuple',readonly:true,elements:[{declaration:none,kind:'rest',component}]},
 {...typeBase,kind:'structure',inventory},
] as const satisfies readonly Model.ObservedType[];
const completeTypeKinds: readonly ['scalar','parameter','enum','declared','union','intersection','array','tuple','structure']
 = [typeRecords[0].kind,typeRecords[1].kind,typeRecords[2].kind,typeRecords[3].kind,typeRecords[4].kind,
  typeRecords[5].kind,typeRecords[6].kind,typeRecords[7].kind,typeRecords[8].kind];
const completeTypeCount: 9 = typeRecords.length;
const snapshot: Model.SourceProgramInput = {programIdentity,identity,entryPoint:original,roots:[original],
 documents:[{original,path:'/source.ts',text:'export {};',declarationFile:false,project:true,profileOwner:none,provider:none}],
 profile:check.profile,libraries:[],providers:[library.identity],diagnostics:[]};
declare const context: Port.Context;
declare const originalQuestion: Port.Question<Model.OriginalObservationInput,Model.InputObservation<Model.OriginalObservation>>;
declare const syntaxQuestion: Port.Question<Model.SyntaxObservationInput,Model.InputObservation<Model.SyntaxObservation>>;
declare const componentQuestion: Port.Question<Model.ComponentObservationInput,Model.InputObservation<Model.ComponentObservation>>;
declare const applicationQuestion: Port.Question<Model.ApplicationObservationInput,Model.InputObservation<Model.ApplicationObservation>>;
declare const memberQuestion: Port.Question<Model.MemberObservationInput,Model.InputObservation<Model.MemberObservation>>;
declare const extensionQuestion: Port.Question<Model.ExtensionObservationInput,Model.InputObservation<Model.ExtensionObservation>>;
declare const originalInput: Model.OriginalObservationInput;
declare const componentInput: Model.ComponentObservationInput;
declare const applicationInput: Model.ApplicationObservationInput;
declare const memberInput: Model.MemberObservationInput;
declare const extensionInput: Model.ExtensionObservationInput;
const originalResult: Model.InputObservation<Model.OriginalObservation> = context.query(originalQuestion,originalInput);
const syntaxResult: Model.InputObservation<Model.SyntaxObservation> = context.query(syntaxQuestion,syntaxInput);
const componentResult: Model.InputObservation<Model.ComponentObservation> = context.query(componentQuestion,componentInput);
const applicationResult: Model.InputObservation<Model.ApplicationObservation> = context.query(applicationQuestion,applicationInput);
const memberResult: Model.InputObservation<Model.MemberObservation> = context.query(memberQuestion,memberInput);
const extensionResult: Model.InputObservation<Model.ExtensionObservation> = context.query(extensionQuestion,extensionInput);
`;

const negativeBody = `
declare const original: Model.Original;
declare const component: Model.Original;
declare const signature: Model.Original;
declare const sourceInput: Model.SourceProgramInput;
declare const layout: Model.ObservedDataLayout;
declare const array: Extract<Model.ObservedLayout,{kind:'array'}>;
declare const observedSignature: Model.ObservedSignature;
declare const originalRecord: Model.OriginalRecord;
declare const typeBase: Omit<Model.ObservedType,'kind'>;
declare const declaredType: Extract<Model.ObservedType,{kind:'declared'}>;
declare const none: {readonly kind:'none'};
declare const context: Port.Context;
declare const originalInput: Model.OriginalObservationInput;
declare const syntaxInput: Model.SyntaxObservationInput;
declare const componentInput: Model.ComponentObservationInput;
declare const applicationInput: Model.ApplicationObservationInput;
declare const memberInput: Model.MemberObservationInput;
declare const extensionInput: Model.ExtensionObservationInput;
declare const originalQuestion: Port.Question<Model.OriginalObservationInput,Model.InputObservation<Model.OriginalObservation>>;
declare const syntaxQuestion: Port.Question<Model.SyntaxObservationInput,Model.InputObservation<Model.SyntaxObservation>>;
declare const componentQuestion: Port.Question<Model.ComponentObservationInput,Model.InputObservation<Model.ComponentObservation>>;
declare const applicationQuestion: Port.Question<Model.ApplicationObservationInput,Model.InputObservation<Model.ApplicationObservation>>;
declare const memberQuestion: Port.Question<Model.MemberObservationInput,Model.InputObservation<Model.MemberObservation>>;
declare const extensionQuestion: Port.Question<Model.ExtensionObservationInput,Model.InputObservation<Model.ExtensionObservation>>;
`;

function compile(argumentsToAdd) {
  const result = spawnSync(compiler, [...strict, ...argumentsToAdd], {
    cwd: repository, encoding: "utf8", timeout: 45_000, maxBuffer: 1_048_576,
  });
  compilerCalls += 1;
  writeFileSync(resolve(repository, ".temp/input-data-compiler-" + process.pid + "-" + compilerCalls + ".log"),
    JSON.stringify({arguments:argumentsToAdd,status:result.status,signal:result.signal}) + "\n"
      + result.stdout + result.stderr, "utf8");
  assert.equal(result.error === undefined && result.signal === null, true, "strict pinned compiler terminated");
  assert.equal(result.stderr, "", "no compiler launcher or internal error");
  return result;
}

function prelude(modelPort = port, contextPort = resolve(repository, "packages/host/src/context/contract.ts")) {
  return "import type * as Model from " + JSON.stringify(modelPort) + ";\n"
    + "import type * as Port from " + JSON.stringify(contextPort) + ";\n"
    + "type Same<Left,Right> = [Left] extends [Right] ? [Right] extends [Left] ? true : false : false;\n"
    + "type Present<Value> = Value extends {readonly kind:'present'; readonly value:infer Output} ? Output : never;\n"
    + "type Observed<Value> = Value extends {readonly kind:'observed'; readonly value:infer Output} ? Output : never;\n";
}

function positive(modelPort = port, contextPort) {
  const references = types.map(type => "Model." + type.replace("<T>", "<Model.Original>"));
  const checks = domains.map(([type, values], index) => "const domain" + index + ": Same<" + type + ","
    + values.map(value => JSON.stringify(value)).join(" | ") + "> = true;");
  checks.push("const primitiveDomain: Same<Model.SourcePrimitive," + primitives.map(value => JSON.stringify(value)).join(" | ") + "> = true;");
  checks.push("const symbolDomain: Same<Model.WellKnownSymbol," + symbols.map(value => JSON.stringify(value)).join(" | ") + "> = true;");
  checks.push("const syntaxDomain: Same<Model.SyntaxKind," + syntaxKinds.map(value => JSON.stringify(value)).join(" | ") + "> = true;");
  checks.push("const roleDomain: Same<Model.SyntaxRole," + syntaxRoles.map(value => JSON.stringify(value)).join(" | ") + "> = true;");
  checks.push("const layoutWidths: Same<Model.ObservedDataLayout['addressWidth'],32 | 64> = true;");
  checks.push("const integerWidths: Same<Model.ObservedIntegerOperand['width'],8 | 16 | 32 | 64 | 128> = true;");
  checks.push("const addressWidths: Same<Model.ObservedAddressInteger['width'],32 | 64> = true;");
  return prelude(modelPort, contextPort) + "type AllExports = readonly [" + references.join(",") + "];\n"
    + checks.join("\n") + "\n" + positiveBody;
}

test("the independently expected complete126 exports, generic arities and closed domains precede every compiler case", async () => {
  orderedDomain(expected.map(([, entries]) => entries.length), [21, 17, 4, 24, 18, 17, 20, 5], Object.is,
    "exact agreed per-leaf export cardinalities");
  assert.equal(names.length, 126);
  assert.equal(new Set(names).size, 126);
  assert.equal(types.filter(type => type.endsWith("<T>")).length, 5);
  assert.equal(primitives.length, 18);
  assert.equal(symbols.length, 15);
  assert.equal(syntaxKinds.length, 351, "pinned literal data domain, not a grammar capability");
  assert.equal(syntaxRoles.length, 60);
  assert.equal(readonlyRecords.length, 118);
  const source = new Map(await Promise.all(dataFiles.map(async file =>
    [file, await readFile(resolve(repository, file), "utf8")])));
  const checked = readArchitectureTypeScript(source);
  for (const [file, entries] of [...expected, ["contract.ts", types]]) {
    const path = "/architecture/" + model + file;
    const node = checked.sourceFiles.find(node => checked.ast.getFileName(node) === path);
    assert.equal(node !== undefined, true, file + ": actual checked source");
    const checker = checked.getSourceFileQueries(node).checker;
    const symbol = checker.getSymbolAtLocation(node);
    assert.equal(symbol !== undefined, true, file + ": actual module symbol");
    const exports = checker.getExportsOfModule(symbol);
    orderedDomain(exports.map(value => checker.getSymbolName(value)).sort(),
      entries.map(name => name.replace("<T>", "")).sort(), Object.is, file + ": complete actual exports");
    if (file !== "contract.ts") for (const expectedType of entries) {
      const name = expectedType.replace("<T>", "");
      const exported = exports.find(value => checker.getSymbolName(value) === name);
      const declarations = checker.getSymbolDeclarations(exported);
      assert.equal(declarations.length, 1, name + ": one defining owner declaration");
      assert.equal(checked.ast.getSourceFile(declarations[0]) === node, true, name + ": no forwarded definition");
      assert.equal(["KindInterfaceDeclaration", "KindTypeAliasDeclaration"].includes(
        checked.ast.kindName(declarations[0])), true, name + ": actual admitted type declaration");
      assert.equal(checked.ast.typeParameters(declarations[0]).length, expectedType.endsWith("<T>") ? 1 : 0,
        name + ": exact generic arity, including no extra defaulted binders");
    }
  }
  await withSpecProject([{path:"positive.mts",text:positive()}], project => {
    const result = compile(["--noEmit", resolve(project.root, "positive.mts")]);
    assert.equal(result.status, 0, result.stdout.slice(0, 16_384));
    assert.equal(result.stdout, "");
  });
});

test("every actual generic boundary, readonly record family and malformed factual channel is rejected precisely", async () => {
  const cases = types.map(type => ({
    name: "arity-" + type.replace("<T>", ""),
    code: type.endsWith("<T>") ? 2314 : 2315,
    text: "type Invalid = Model." + (type.endsWith("<T>") ? type.replace("<T>", "") : type + "<never>") + ";",
  }));
  assert.equal(cases.length, 126, "one independent actual type-arity negative per exported name");
  for (const [type, field] of readonlyRecords) {
    const actual = type === "LibraryPropertyName" ? "Exclude<Model.LibraryPropertyName,string>" : "Model." + type;
    cases.push({name:"readonly-" + type.replace("<Model.Original>", ""),code:2540,
      text:"declare const record: " + actual + "; record." + field + " = record." + field + ";"});
  }
  const malformed = [
    ["wrong-family",2322,"const invalid: Model.ExtensionObservationInput = {input:sourceInput,original,family:'invocation'};"],
    ["wrong-primitive",2322,"const invalid: Model.SourcePrimitive = 'int53';"],
    ["wrong-symbol",2322,"const invalid: Model.WellKnownSymbol = 'same-spelling-local';"],
    ["wrong-address-pair",2322,"const invalid: Model.ObservedAddressInteger = {width:32,runtimeBase:'bigint',signedness:'unsigned'};"],
    ["wrong-layout-width",2322,"const invalid: Model.ObservedDataLayout = {...layout,addressWidth:16};"],
    ["wrong-layout-size",2322,"const invalid: Model.ObservedLayout = {...array,byteSize:9007199254740993};"],
    ["wrong-member-origin",2322,"const invalid: Model.ObservedMemberOrigin = {kind:'mapped',declaration:original,source:component,key:{kind:'name',name:'x'},access:'invoke'};"],
    ["wrong-component-root",2322,"const invalid: Model.ObservedComponent = {identity:component,root:'source.ts',path:[]};"],
    ["missing-signature-bindings",2741,"declare const missing: Omit<Model.ObservedSignature,'typeParameters'>; const invalid: Model.ObservedSignature = missing;"],
    ["missing-body-bindings",2741,"declare const missing: Omit<Model.ObservedCallableAssociation,'bodyParameters'>; const invalid: Model.ObservedCallableAssociation = missing;"],
    ["missing-field-group",2741,"declare const missing: Omit<Model.ObservedMemoryField,'selectedDeclarations'>; const invalid: Model.ObservedMemoryField = missing;"],
    ["missing-environment-input",2741,"declare const missing: Omit<Model.SourceCheckRequest,'profile'>; const invalid: Model.SourceCheckRequest = missing;"],
    ["missing-safety-input",2741,"declare const missing: Omit<Model.SourceCheckRequest,'safetyProviders'>; const invalid: Model.SourceCheckRequest = missing;"],
    ["missing-diagnostic-roots",2741,"declare const missing: Omit<Model.ObservedCallCandidate,'diagnosticCoverage'>; const invalid: Model.ObservedCallCandidate = missing;"],
    ["missing-signature-root",2322,"const invalid: Model.ComponentSelection = {kind:'signature-component',signature,part:{kind:'result'}};"],
    ["missing-string-receiver",2322,"const invalid: Model.ObservedIndexSelection = {kind:'string-character',read:component};"],
    ["unavailable-needs-diagnostics",2322,"const invalid: Model.InputObservation<Model.Original> = {kind:'unavailable',reason:'unvisited'};"],
    ["wrong-observed-channel",2322,"const invalid: Model.InputObservation<Model.Original> = {kind:'pending',dependencies:[original]};"],
    ["syntax-answer-family",2322,"const invalid: Model.ComponentObservation = {kind:'syntax',component:original};"],
    ["unknown-syntax-kind",2322,"const invalid: Model.SyntaxKind = 'KindInventedNode';"],
    ["range-alias-not-kind",2322,"const invalid: Model.SyntaxKind = 'KindFirstStatement';"],
    ["wrong-syntax-role",2322,"const invalid: Model.SyntaxRole = 'native-layout';"],
    ["wrong-answer-tag",2322,"const invalid: Model.ApplicationObservation = {kind:'signature',signature:observedSignature};"],
    ["wrong-answer-payload",2322,"const invalid: Model.MemberObservation = {kind:'use',use:{kind:'present',value:original}};"],
    ["wrong-selection-projection",2322,"const invalid: Model.ComponentSelection = {kind:'signature-component',signature,root:original,part:{kind:'tuple-element',index:0}};"],
    ["frozen-d1-has-no-site",2339,"originalRecord.site;"],
    ["no-source-evidence",2305,"import type {Evidence} from " + JSON.stringify(port) + ";"],
    ["no-source-answer",2305,"import type {SourceAnswer} from " + JSON.stringify(port) + ";"],
    ["no-producer-bag",2339,"sourceInput.ast;"],
    ["no-discharge-callback",2339,"sourceInput.discharge;"],
    ["enum-bare-declaration",2322,"const invalid: Model.ObservedType = {...typeBase,kind:'enum',declaration:original};"],
    ["declared-bare-declaration",2322,"const invalid: Model.ObservedType = {...declaredType,declaration:original};"],
    ["enum-absent-declaration",2322,"const invalid: Model.ObservedType = {...typeBase,kind:'enum',declaration:none};"],
    ["declared-absent-declaration",2322,"const invalid: Model.ObservedType = {...declaredType,declaration:none};"],
  ];
  for (const [name, code, text] of malformed) cases.push({name,code,text});
  for (const [name, type, field] of [
    ["component-path","Model.ObservedComponent","path"], ["signature-formals","Model.ObservedSignature","parameters"],
    ["member-origins","Model.ObservedMember","origins"], ["member-declarations","Model.ObservedMember","declarations"],
    ["field-declarations","Model.ObservedMemoryField","selectedDeclarations"], ["program-roots","Model.SourceProgramInput","roots"],
    ["syntax-children","Model.SyntaxObservation","children"], ["candidate-constraints","Model.ObservedCallCandidate","constraints"],
    ["record-bindings","Model.ObservedRecordBinding","fields"], ["library-declarations","Model.SourceLibrary","declarations"],
  ]) cases.push({name:"readonly-vector-" + name,code:2339,
    text:"declare const record: " + type + "; record." + field + ".push();"});
  for (const [name, question, wrong] of [
    ["original","originalQuestion","componentInput"], ["syntax","syntaxQuestion","applicationInput"],
    ["component","componentQuestion","applicationInput"], ["application","applicationQuestion","memberInput"],
    ["member","memberQuestion","extensionInput"], ["extension","extensionQuestion","syntaxInput"],
  ]) cases.push({name:"question-" + name,code:2345,text:"context.query(" + question + "," + wrong + ");"});
  for (const [name, question, input, answer] of [
    ["original","originalQuestion","originalInput","SyntaxObservation"],
    ["syntax","syntaxQuestion","syntaxInput","ComponentObservation"],
    ["component","componentQuestion","componentInput","ApplicationObservation"],
    ["application","applicationQuestion","applicationInput","MemberObservation"],
    ["member","memberQuestion","memberInput","ExtensionObservation"],
    ["extension","extensionQuestion","extensionInput","OriginalObservation"],
  ]) cases.push({name:"question-result-" + name,code:2322,text:"const actual = context.query(" + question + ","
    + input + "); const invalid: Model.InputObservation<Model." + answer + "> = actual;"});
  assert.equal(cases.length, 300, "complete126 arities+118 readonly+34 malformed+10 vectors+12 question opposites");
  const fileNames = cases.map(entry => entry.name + ".mts");
  assert.equal(new Set(fileNames).size, cases.length, "distinct complete negative program domain");
  await withSpecProject(cases.map(entry => ({path:entry.name + ".mts",text:prelude() + negativeBody + entry.text})),
    async project => {
      const result = compile(["--noEmit", ...fileNames.map(file => resolve(project.root, file))]);
      await writeFile(resolve(repository, ".temp/input-data-negatives.log"), result.stdout, "utf8");
      assert.equal(result.status, 1, "actual strict compiler rejects the complete invalid programs");
      const diagnostics = [...result.stdout.matchAll(/^(.*)\(\d+,\d+\): error TS(\d+):/gmu)]
        .map(match => [basename(match[1]), Number(match[2])]);
      assert.equal((result.stdout.match(/\berror TS\d+:/gu) ?? []).length, cases.length,
        "every diagnostic, including any unexpected global/source error");
      orderedDomain(diagnostics.map(([file]) => file).sort(), fileNames.slice().sort(), Object.is,
        "every expected and only expected negative program");
      const mismatches = cases.flatMap(entry => {
        const actual = diagnostics.filter(([file]) => file === entry.name + ".mts").map(([,code]) => code);
        return actual.length === 1 && actual[0] === entry.code ? []
          : [entry.name + ": expected " + entry.code + ", actual [" + actual.join(",") + "]"];
      });
      assert.equal(mismatches.length, 0, mismatches.join("\n"));
    });
});

test("the complete type-only literal graph has exact lower edges and rejects an actual root back-import", async () => {
  const sources = new Map(await Promise.all(dataFiles.map(async file =>
    [file, await readFile(resolve(repository, file), "utf8")])));
  const dependencies = [
    ["contract.ts",expected.map(([file]) => file)], ["foundation-data.ts",[]],
    ["library-data.ts",["foundation-data.ts"]], ["syntax-data.ts",["foundation-data.ts"]],
    ["input-data.ts",["foundation-data.ts","library-data.ts"]],
    ["core-input-data.ts",["foundation-data.ts","input-data.ts","library-data.ts"]],
    ["original-input-data.ts",["foundation-data.ts","input-data.ts","library-data.ts"]],
    ["program-input-data.ts",["core-input-data.ts","foundation-data.ts","library-data.ts"]],
    ["input-answer-data.ts",["core-input-data.ts","foundation-data.ts","input-data.ts","original-input-data.ts","program-input-data.ts"]],
  ];
  const expectedEdges = dependencies.flatMap(([file, targets]) =>
    targets.map(target => model + file + " -> " + model + target)).sort();
  const edges = buildTypeScriptModuleGraph(sources);
  orderedDomain(edges.map(edge => edge.source + " -> " + edge.target).sort(), expectedEdges, Object.is,
    "complete literal imports AND exports including all erased edges");
  assert.equal(edges.every(edge => edge.kind === "relative" && !edge.unresolved), true);
  orderedDomain(stronglyConnectedComponents(sources.keys(),edges).filter(component => component.length > 1),
    [], Object.is, "the complete actual data graph is acyclic");
  const findings = inspectHostStructure({root:repository,files:dataFiles,declarationFiles:[]});
  orderedDomain(findings, [], Object.is, "all current source data/port structural gates");
  const opposite = new Map(sources);
  opposite.set(model + "foundation-data.ts", sources.get(model + "foundation-data.ts")
    + '\nexport type { SourceDocument } from "./contract.js";\n');
  const cycles = stronglyConnectedComponents(opposite.keys(),buildTypeScriptModuleGraph(opposite))
    .filter(component => component.length > 1);
  assert.equal(cycles.length, 1, "the actual added erased root edge must make a cycle");
  assert.equal(cycles[0].includes(model + "contract.ts") && cycles[0].includes(model + "foundation-data.ts"), true);
  const peer = "packages/host/src/ingress/contract.ts";
  await withSpecProject([...sources].map(([path,text]) => ({path,text})).concat([{path:peer,
    text:'import type {Original} from "../model/foundation-data.js"; export interface Observation {readonly original:Original;}'}]),
    project => {
      const rejected = inspectHostStructure({root:project.root,files:project.files,declarationFiles:[]});
      orderedDomain(rejected.map(finding => finding.gate), ["contract-imports"], Object.is,
        "private leaf peer import is a real architecture rejection, not an unresolved compiler fiction");
    });
});

test("the entire listed Model declaration closure is freshly emitted, gated and consumed without source redirects", async () => {
  await withSpecProject([], async project => {
    const output = resolve(project.root, "declarations");
    const result = compile(["--declaration","--emitDeclarationOnly","--rootDir",
      repository,"--outDir",output,...dataFiles.map(file => resolve(repository,file)),
      resolve(repository,"packages/host/src/context/contract.ts")]);
    assert.equal(result.status, 0, result.stdout.slice(0,16_384));
    const expectedDeclarations = dataFiles.map(file => file.replace(/\.ts$/u,".d.ts"))
      .concat(["packages/host/src/context/contract.d.ts"]).sort();
    orderedDomain((await readdir(output,{recursive:true})).filter(file => file.endsWith(".d.ts")).sort(),
      expectedDeclarations,Object.is,"all and only freshly checked declaration files");
    const findings = inspectHostStructure({root:output,files:expectedDeclarations,declarationFiles:expectedDeclarations});
    orderedDomain(findings,[],Object.is,"structural gates on the entire real emitted declaration closure");
    const consumer = resolve(project.root,"consumer.mts");
    await writeFile(consumer,positive(resolve(output,model,"contract.js"),resolve(output,"packages/host/src/context/contract.js")),"utf8");
    const consumed = compile(["--noEmit","--listFiles",consumer]);
    assert.equal(consumed.status,0,consumed.stdout.slice(0,16_384));
    orderedDomain(consumed.stdout.split(/\r?\n/u).filter(file => file.startsWith(output)).sort(),
      expectedDeclarations.map(file => resolve(output,file)).sort(),Object.is,"the consumer loads EVERY emitted dependency");
    assert.equal(consumed.stdout.includes(resolve(repository,"packages/host/src/")),false,
      "no dependency implementation or original .ts data redirects");
  });
});

test("the whole actual Model owner including unchanged pure algebra isolates against no peer implementations", async () => {
  const sourceFiles = [...dataFiles,model + "register.ts"].sort();
  orderedDomain((await readdir(resolve(repository,model))).filter(file => file.endsWith(".ts")).sort(),
    sourceFiles.map(file => basename(file)).sort(),Object.is,"complete actual Model production domain");
  const result = await compileHostModuleInIsolation({root:repository,module:"model",sourceFiles,
    dependencyContracts:[],outputDirectory:".temp/input-data-model-isolation"});
  await writeFile(resolve(repository,".temp/input-data-isolation-" + process.pid + ".log"),result.log,"utf8");
  assert.equal(result.kind,"passed",result.log.slice(-16_384));
  assert.equal((result.log.match(/strict compiler exit=0/gu) ?? []).length,1,
    "the actual whole independent owner compiled, not a fake dependency check");
});
