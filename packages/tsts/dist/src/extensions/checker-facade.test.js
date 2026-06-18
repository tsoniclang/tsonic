import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { Node_Expression, Node_Parameters, Node_Type, } from "../internal/ast/ast.js";
import { Node_Name } from "../internal/ast/spine.js";
import { KindArrowFunction, KindCallExpression, KindParameter, KindPropertyAccessExpression, } from "../internal/ast/generated/kinds.js";
import { SymbolFlagsValue } from "../internal/ast/symbolflags.js";
import { FlagsNone } from "../internal/nodebuilder/types.js";
import { createCompilerSourceProgram } from "../services/source-program.js";
import { getTstsIdentifierText, visitTstsSubtree, } from "./ast-helpers.js";
const repoTempRoot = path.join(process.cwd(), ".temp", "tsts-checker-facade");
const must = (value, message) => {
    if (value === undefined) {
        throw new Error(message);
    }
    return value;
};
const visitSourceFile = (sourceFile, visit) => {
    for (const statement of must(sourceFile.Statements, "source file statements were not initialized").Nodes) {
        visitTstsSubtree(statement, visit);
    }
};
const createTempSourceFile = (sourceText) => {
    fs.mkdirSync(repoTempRoot, { recursive: true });
    const projectRoot = fs.mkdtempSync(path.join(repoTempRoot, "case-"));
    const filePath = path.join(projectRoot, "index.ts");
    fs.writeFileSync(filePath, sourceText);
    return { projectRoot, filePath };
};
const collectSemanticSnapshot = (sourceText) => {
    const { projectRoot, filePath } = createTempSourceFile(sourceText);
    let snapshot;
    const extension = {
        id: "semantic-query-contract",
        afterCheckSourceFile: (context) => {
            snapshot = readSemanticSnapshot(context);
        },
    };
    const program = createCompilerSourceProgram([filePath], {
        projectRoot,
        compilerOptions: {
            strict: true,
        },
        extensions: [extension],
        runSemanticChecks: true,
    });
    assert.deepEqual(program.diagnostics, []);
    assert.deepEqual(program.extensionDiagnostics, []);
    return must(snapshot, "semantic query extension did not run");
};
const readSemanticSnapshot = (context) => {
    const valueUseTypes = [];
    let declaredValueParameter;
    let declaredValueName;
    let maybeName;
    let userName;
    let recordName;
    let numericRecordName;
    let namesName;
    let tupleName;
    let boxName;
    let narrowedValueUse;
    let itemUse;
    let arrowFunction;
    let identityCall;
    visitSourceFile(must(context.sourceFile, "checked source file was missing"), (node) => {
        if (node?.Kind === KindParameter) {
            const name = Node_Name(node);
            if (getTstsIdentifierText(name) === "value" && declaredValueName === undefined) {
                declaredValueParameter = node;
                declaredValueName = name;
            }
            if (getTstsIdentifierText(name) === "maybe" && maybeName === undefined) {
                maybeName = name;
            }
            if (getTstsIdentifierText(name) === "user" && userName === undefined) {
                userName = name;
            }
        }
        if (getTstsIdentifierText(node) === "record" && recordName === undefined) {
            recordName = node;
        }
        if (getTstsIdentifierText(node) === "numericRecord" &&
            numericRecordName === undefined) {
            numericRecordName = node;
        }
        if (getTstsIdentifierText(node) === "names" && namesName === undefined) {
            namesName = node;
        }
        if (getTstsIdentifierText(node) === "tuple" && tupleName === undefined) {
            tupleName = node;
        }
        if (getTstsIdentifierText(node) === "Box") {
            boxName = node;
        }
        if (getTstsIdentifierText(node) === "value") {
            const type = context.checker.getTypeAtLocation(node);
            if (type !== undefined) {
                const typeText = context.checker.typeToString(type);
                valueUseTypes.push(typeText);
                if (typeText === "string") {
                    narrowedValueUse = node;
                }
            }
        }
        if (node?.Kind === KindArrowFunction) {
            arrowFunction = node;
            const parameter = Node_Parameters(node)[0];
            const parameterName = parameter ? Node_Name(parameter) : undefined;
            if (getTstsIdentifierText(parameterName) === "item") {
                const parameterType = context.checker.getTypeAtLocation(parameterName);
                if (parameterType !== undefined) {
                    itemUse = parameterName;
                }
            }
        }
        if (node?.Kind === KindPropertyAccessExpression) {
            const receiver = Node_Expression(node);
            if (getTstsIdentifierText(receiver) === "item") {
                itemUse = receiver;
            }
        }
        if (node?.Kind === KindCallExpression &&
            getTstsIdentifierText(Node_Expression(node)) === "identity") {
            identityCall = node;
        }
    });
    const valueSymbol = context.checker.getSymbolAtLocation(must(narrowedValueUse, "narrowed value use was not discovered"));
    const valueDeclaration = must(declaredValueName, "value declaration was not discovered");
    const declaredValueType = context.checker.getDeclaredTypeOfSymbol(context.checker.getSymbolAtLocation(valueDeclaration));
    const maybeType = context.checker.getTypeAtLocation(must(maybeName, "maybe declaration was not discovered"));
    const userType = context.checker.getTypeAtLocation(must(userName, "user declaration was not discovered"));
    const recordType = context.checker.getTypeAtLocation(must(recordName, "record identifier was not discovered"));
    const numericRecordType = context.checker.getTypeAtLocation(must(numericRecordName, "numericRecord identifier was not discovered"));
    const namesType = context.checker.getTypeAtLocation(must(namesName, "names identifier was not discovered"));
    const tupleType = context.checker.getTypeAtLocation(must(tupleName, "tuple identifier was not discovered"));
    const boxType = context.checker.getTypeAtLocation(must(boxName, "Box identifier was not discovered"));
    const itemType = context.checker.getTypeAtLocation(must(itemUse, "contextually typed item use was not discovered"));
    const arrowContextualType = context.checker.getContextualType(must(arrowFunction, "arrow function was not discovered"));
    const identitySignature = context.checker.getResolvedSignature(must(identityCall, "identity call was not discovered"));
    const identityCallType = context.checker.getTypeAtLocation(identityCall);
    const userNameProperty = context.checker.getPropertyOfType(userType, "name");
    const userNamePropertyType = context.checker.getTypeOfSymbolAtLocation(userNameProperty, must(userName, "user declaration was not discovered"));
    const sourceFileSymbol = context.checker.getSymbolAtLocation(context.sourceFile);
    const scopeSymbols = context.checker.getSymbolsInScope(must(identityCall, "identity call was not discovered"), SymbolFlagsValue);
    const valueDeclarations = context.checker.getSymbolDeclarations(valueSymbol);
    const valueDeclaredTypeNode = Node_Type(must(declaredValueParameter, "value declaration parameter was missing"));
    return {
        valueUseTypes,
        declaredValueType: context.checker.typeToString(declaredValueType),
        declaredValueUnionMembers: context.checker
            .getUnionMembers(declaredValueType)
            ?.map((type) => context.checker.typeToString(type)) ?? [],
        maybeNonNullishMembers: context.checker
            .getNonNullishUnionMembers(maybeType)
            ?.map((type) => context.checker.typeToString(type)) ?? [],
        valueSymbolName: must(valueSymbol, "value symbol was not resolved").Name,
        valueDeclarationCount: valueDeclarations.length,
        valueDeclarationTypeText: context.checker.typeToString(context.checker.getTypeFromTypeNode(valueDeclaredTypeNode)),
        itemUseType: context.checker.typeToString(itemType),
        arrowContextualType: context.checker.typeToString(arrowContextualType),
        identityCallType: context.checker.typeToString(identityCallType),
        identitySignatureParameterCount: must(identitySignature, "identity signature was not resolved").parameters.length,
        identityReturnType: context.checker.typeToString(context.checker.getReturnTypeOfSignature(identitySignature)),
        userAliasSymbolName: context.checker.getTypeAliasSymbolName(userType),
        userTypeSymbolName: context.checker.getTypeSymbolName(userType),
        userNamePropertyType: context.checker.typeToString(userNamePropertyType),
        stringIndexType: context.checker.typeToString(context.checker.getStringIndexType(recordType)),
        numberIndexType: context.checker.typeToString(context.checker.getNumberIndexType(numericRecordType)),
        namesIsArray: context.checker.isArrayType(namesType),
        tupleIsTuple: context.checker.isTupleType(tupleType),
        boxConstructSignatureCount: context.checker.getConstructSignatures(boxType).length,
        moduleExports: context.checker
            .getExportsOfModule(sourceFileSymbol)
            .map((symbol) => context.checker.getSymbolName(symbol))
            .sort(),
        scopeHasIdentity: scopeSymbols.some((symbol) => context.checker.getSymbolName(symbol) === "identity"),
        typeNodeWasCreated: context.checker.typeToTypeNode(userType, context.sourceFile, FlagsNone) !==
            undefined,
    };
};
test("extension checker facade exposes TSTS narrowed and contextual semantic queries", () => {
    const snapshot = collectSemanticSnapshot(`
    declare function accepts(callback: (input: { name: string }) => string): void;

    export function read(value: string | number) {
      if (typeof value === "string") {
        return value;
      }
      return value;
    }

    function identity<T>(value: T): T {
      return value;
    }

    const answer = identity("hello");
    accepts((item) => item.name);

    export type UserAlias = { name: string };
    export const record: { [key: string]: number } = {};
    export const numericRecord: { [index: number]: string } = {};
    export const names = ["a"];
    export const tuple: [string, number] = ["a", 1];
    export class Box {
      constructor(value: string) {}
    }
    export const created = new Box("x");

    export function inspect(maybe: string | undefined, user: UserAlias) {
      return user.name ?? maybe;
    }
  `);
    assert.equal(snapshot.valueSymbolName, "value");
    assert.equal(snapshot.declaredValueType, "string | number");
    assert.deepEqual(snapshot.declaredValueUnionMembers, ["string", "number"]);
    assert.deepEqual(snapshot.maybeNonNullishMembers, ["string"]);
    assert.equal(snapshot.valueDeclarationCount, 1);
    assert.equal(snapshot.valueDeclarationTypeText, "string | number");
    assert.ok(snapshot.valueUseTypes.includes("string"));
    assert.ok(snapshot.valueUseTypes.includes("number"));
    assert.equal(snapshot.itemUseType, "{ name: string; }");
    assert.match(snapshot.arrowContextualType, /input: \{ name: string; \}/);
    assert.equal(snapshot.identityCallType, "\"hello\"");
    assert.equal(snapshot.identitySignatureParameterCount, 1);
    assert.equal(snapshot.identityReturnType, "\"hello\"");
    assert.equal(snapshot.userAliasSymbolName, "UserAlias");
    assert.equal(typeof snapshot.userTypeSymbolName, "string");
    assert.equal(snapshot.userNamePropertyType, "string");
    assert.equal(snapshot.stringIndexType, "number");
    assert.equal(snapshot.numberIndexType, "string");
    assert.equal(typeof snapshot.namesIsArray, "boolean");
    assert.equal(snapshot.tupleIsTuple, true);
    assert.equal(snapshot.boxConstructSignatureCount, 1);
    assert.deepEqual(snapshot.moduleExports, [
        "Box",
        "created",
        "inspect",
        "names",
        "numericRecord",
        "read",
        "record",
        "tuple",
        "UserAlias",
    ].sort());
    assert.equal(snapshot.scopeHasIdentity, true);
    assert.equal(snapshot.typeNodeWasCreated, true);
});
//# sourceMappingURL=checker-facade.test.js.map