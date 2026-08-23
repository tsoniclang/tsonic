import type {
  ProviderDeclarationModel,
  ProviderExportDeclaration,
  ProviderImportDeclaration,
  ProviderMemberDeclaration,
  ProviderParameterDeclaration,
  ProviderSignatureDeclaration,
  ProviderTypeExpression,
  SourceDeclarationProvider,
  SourceSemanticsModule,
} from "@tsonic/tsts";
import {
  createSourceSemanticsVirtualModuleProvider,
} from "@tsonic/source-core/extension";
import {
  jsLangModule,
  jsSourceSemanticsIdentity,
  jsTypesModule,
} from "../identities/source.js";
import { jsSourceSemanticsModules } from "./source-modules.js";

const jsStringType: ProviderTypeExpression = Object.freeze({
  kind: "provider-ref",
  moduleSpecifier: jsTypesModule,
  exportName: jsSourceSemanticsIdentity.typeExport,
});
const nativeStringType: ProviderTypeExpression = Object.freeze({ kind: "string" });
const numberType: ProviderTypeExpression = Object.freeze({ kind: "number" });
const booleanType: ProviderTypeExpression = Object.freeze({ kind: "boolean" });
const undefinedType: ProviderTypeExpression = Object.freeze({ kind: "undefined" });
const jsStringOrUndefinedType: ProviderTypeExpression = Object.freeze({
  kind: "union",
  types: [jsStringType, undefinedType],
});
const regExpType: ProviderTypeExpression = sourceGlobal("RegExp");
const jsRegExpExecArrayType: ProviderTypeExpression = sourceGlobal("JsRegExpExecArray");
const jsRegExpMatchArrayType: ProviderTypeExpression = sourceGlobal("JsRegExpMatchArray");
const jsRegExpReplaceCallbackType: ProviderTypeExpression = sourceGlobal("JsRegExpReplaceCallback");
const jsRegExpMatchArrayOrNullType: ProviderTypeExpression = union(
  jsRegExpMatchArrayType,
  Object.freeze({ kind: "literal", value: null }),
);
const jsRegExpStringIteratorType: ProviderTypeExpression = sourceGlobal(
  "JsRegExpStringIterator",
  [jsRegExpExecArrayType],
);
const jsStringArrayType: ProviderTypeExpression = Object.freeze({
  kind: "array",
  elementType: jsStringType,
});

export function createJsSourceVirtualModulesProvider(): SourceDeclarationProvider {
  return createSourceSemanticsVirtualModuleProvider({
    id: jsSourceSemanticsIdentity.providerId,
    version: jsSourceSemanticsIdentity.providerVersion,
    displayName: "Tsonic JavaScript source semantics",
    virtualDirectory: "js-source",
    modules: jsSourceSemanticsModules(),
    importsForModule: jsProviderImportsForModule,
    exportsForModule: jsProviderExportsForModule,
    evidenceMessage:
      "The selected JavaScript surface supplies explicit JavaScript string semantics.",
    diagnostics: {
      unowned: {
        extensionCode: "JS_SOURCE_MODULE_UNOWNED",
        numericCode: 9400001,
      },
      declarationMissing: {
        extensionCode: "JS_SOURCE_MODULE_DECLARATION_MISSING",
        numericCode: 9400002,
      },
    },
  });
}

function jsProviderImportsForModule(
  module: SourceSemanticsModule,
): readonly ProviderImportDeclaration[] {
  return module.moduleSpecifier === jsLangModule
    ? [Object.freeze({
        moduleSpecifier: jsTypesModule,
        typeOnly: true,
        namedImports: [Object.freeze({
          exportedName: jsSourceSemanticsIdentity.typeExport,
          kind: "type" as const,
        })],
      })]
    : [];
}

function jsProviderExportsForModule(
  module: SourceSemanticsModule,
): ProviderDeclarationModel["exports"] {
  switch (module.moduleSpecifier) {
    case jsTypesModule:
      return [jsStringDeclaration()];
    case jsLangModule:
      return [jsStringConversionDeclaration()];
    default:
      throw new Error(
        `JavaScript source provider cannot render unowned module '${module.moduleSpecifier}'.`,
      );
  }
}

function jsStringDeclaration(): ProviderExportDeclaration {
  return Object.freeze({
    id: jsSourceSemanticsIdentity.typeExport,
    name: jsSourceSemanticsIdentity.typeExport,
    kind: "interface",
    members: [
      readonlyProperty("__tsonicJsStringIdentity", { kind: "never" }),
      readonlyProperty("length", numberType),
      indexer(jsStringType),
      method("at", [parameter("index", numberType)], jsStringOrUndefinedType),
      method("charAt", [parameter("index", numberType)], jsStringType),
      method("charCodeAt", [parameter("index", numberType)], numberType),
      method("codePointAt", [parameter("pos", numberType)], union(numberType, undefinedType)),
      method("concat", [restParameter("strings", jsStringType)], jsStringType),
      method("endsWith", [
        parameter("searchString", jsStringType),
        optionalParameter("endPosition", numberType),
      ], booleanType),
      method("includes", [
        parameter("searchString", jsStringType),
        optionalParameter("position", numberType),
      ], booleanType),
      method("indexOf", [
        parameter("searchString", jsStringType),
        optionalParameter("position", numberType),
      ], numberType),
      method("lastIndexOf", [
        parameter("searchString", jsStringType),
        optionalParameter("position", numberType),
      ], numberType),
      method("normalize", [optionalParameter("form", nativeStringType)], jsStringType),
      method("padEnd", [
        parameter("maxLength", numberType),
        optionalParameter("fillString", jsStringType),
      ], jsStringType),
      method("padStart", [
        parameter("maxLength", numberType),
        optionalParameter("fillString", jsStringType),
      ], jsStringType),
      method("repeat", [parameter("count", numberType)], jsStringType),
      method("slice", [
        optionalParameter("start", numberType),
        optionalParameter("end", numberType),
      ], jsStringType),
      method("startsWith", [
        parameter("searchString", jsStringType),
        optionalParameter("position", numberType),
      ], booleanType),
      method("substring", [
        parameter("start", numberType),
        optionalParameter("end", numberType),
      ], jsStringType),
      method("substr", [
        parameter("from", numberType),
        optionalParameter("length", numberType),
      ], jsStringType),
      method("toLowerCase", [], jsStringType),
      method("toUpperCase", [], jsStringType),
      method("trim", [], jsStringType),
      method("trimEnd", [], jsStringType),
      method("trimStart", [], jsStringType),
      method("toString", [], jsStringType),
      method("valueOf", [], jsStringType),
      method("isWellFormed", [], booleanType),
      method("toWellFormed", [], nativeStringType),
      method("match", [parameter("regexp", regExpType)], jsRegExpMatchArrayOrNullType),
      method("matchAll", [parameter("regexp", regExpType)], jsRegExpStringIteratorType),
      overloadedMethod("replace", [
        signature("replace(searchValue,replaceValue)", [
          parameter("searchValue", union(jsStringType, regExpType)),
          parameter("replaceValue", jsStringType),
        ], jsStringType),
        signature("replace(searchValue,replacer)", [
          parameter("searchValue", union(jsStringType, regExpType)),
          parameter("replacer", jsRegExpReplaceCallbackType),
        ], jsStringType),
      ]),
      overloadedMethod("replaceAll", [
        signature("replaceAll(searchValue,replaceValue)", [
          parameter("searchValue", union(jsStringType, regExpType)),
          parameter("replaceValue", jsStringType),
        ], jsStringType),
        signature("replaceAll(searchValue,replacer)", [
          parameter("searchValue", union(jsStringType, regExpType)),
          parameter("replacer", jsRegExpReplaceCallbackType),
        ], jsStringType),
      ]),
      method("search", [parameter("regexp", regExpType)], numberType),
      method("split", [
        parameter("separator", union(jsStringType, regExpType)),
        optionalParameter("limit", numberType),
      ], jsStringArrayType),
    ],
  });
}

function jsStringConversionDeclaration(): ProviderExportDeclaration {
  return Object.freeze({
    id: jsSourceSemanticsIdentity.conversionExport,
    name: jsSourceSemanticsIdentity.conversionExport,
    kind: "function",
    signatures: [Object.freeze({
      id: jsSourceSemanticsIdentity.conversionSignatureId,
      parameters: [parameter("value", nativeStringType)],
      returnType: jsStringType,
    })],
  });
}

function readonlyProperty(
  name: string,
  type: ProviderTypeExpression,
): ProviderMemberDeclaration {
  return Object.freeze({ id: name, name, kind: "property", readonly: true, type });
}

function indexer(type: ProviderTypeExpression): ProviderMemberDeclaration {
  return Object.freeze({
    id: "index",
    name: "index",
    kind: "indexer",
    readonly: true,
    signatures: [Object.freeze({
      id: "index(index)",
      parameters: [parameter("index", numberType)],
      returnType: type,
    })],
  });
}

function method(
  name: string,
  parameters: readonly ProviderParameterDeclaration[],
  returnType: ProviderTypeExpression,
): ProviderMemberDeclaration {
  const signature: ProviderSignatureDeclaration = Object.freeze({
    id: `${name}(${parameters.map((parameterValue) => parameterValue.name).join(",")})`,
    parameters,
    returnType,
  });
  return Object.freeze({
    id: name,
    name,
    kind: "method",
    signatures: [signature],
  });
}

function overloadedMethod(
  name: string,
  signatures: readonly ProviderSignatureDeclaration[],
): ProviderMemberDeclaration {
  return Object.freeze({
    id: name,
    name,
    kind: "method",
    signatures,
  });
}

function signature(
  id: string,
  parameters: readonly ProviderParameterDeclaration[],
  returnType: ProviderTypeExpression,
): ProviderSignatureDeclaration {
  return Object.freeze({
    id,
    parameters,
    returnType,
  });
}

function parameter(
  name: string,
  type: ProviderTypeExpression,
): ProviderParameterDeclaration {
  return Object.freeze({ name, type });
}

function optionalParameter(
  name: string,
  type: ProviderTypeExpression,
): ProviderParameterDeclaration {
  return Object.freeze({ name, type, optional: true });
}

function restParameter(
  name: string,
  elementType: ProviderTypeExpression,
): ProviderParameterDeclaration {
  return Object.freeze({
    name,
    type: { kind: "array" as const, elementType },
    rest: true,
  });
}

function union(
  ...types: readonly ProviderTypeExpression[]
): ProviderTypeExpression {
  return Object.freeze({ kind: "union", types });
}

function sourceGlobal(
  name: string,
  typeArguments?: readonly ProviderTypeExpression[],
): ProviderTypeExpression {
  return Object.freeze({
    kind: "source-global",
    name,
    ...(typeArguments === undefined
      ? {}
      : { typeArguments }),
  });
}
