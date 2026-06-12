import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import type { GoPtr } from "../go/compat.js";
import type { Node } from "../internal/ast/spine.js";
import type { SourceFile } from "../internal/ast/ast.js";
import {
  Node_Expression,
  Node_Parameters,
} from "../internal/ast/ast.js";
import { Node_Name } from "../internal/ast/spine.js";
import {
  KindArrowFunction,
  KindCallExpression,
  KindParameter,
  KindPropertyAccessExpression,
} from "../internal/ast/generated/kinds.js";
import { createCompilerSourceProgram } from "../services/source-program.js";
import type {
  CompilerExtension,
  ExtensionCheckedSourceFileContext,
} from "./extension-host.js";
import {
  getTstsIdentifierText,
  visitTstsSubtree,
} from "./ast-helpers.js";

type SemanticQuerySnapshot = {
  readonly valueUseTypes: readonly string[];
  readonly declaredValueType: string;
  readonly valueSymbolName: string;
  readonly itemUseType: string;
  readonly arrowContextualType: string;
  readonly identityCallType: string;
  readonly identitySignatureParameterCount: number;
};

const repoTempRoot = path.join(
  process.cwd(),
  ".temp",
  "tsts-checker-facade",
);

const must = <T>(value: GoPtr<T>, message: string): T => {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
};

const visitSourceFile = (
  sourceFile: SourceFile,
  visit: (node: GoPtr<Node>) => void,
): void => {
  for (const statement of must(
    sourceFile.Statements,
    "source file statements were not initialized",
  ).Nodes) {
    visitTstsSubtree(statement, visit);
  }
};

const createTempSourceFile = (sourceText: string): {
  readonly projectRoot: string;
  readonly filePath: string;
} => {
  fs.mkdirSync(repoTempRoot, { recursive: true });
  const projectRoot = fs.mkdtempSync(path.join(repoTempRoot, "case-"));
  const filePath = path.join(projectRoot, "index.ts");
  fs.writeFileSync(filePath, sourceText);
  return { projectRoot, filePath };
};

const collectSemanticSnapshot = (sourceText: string): SemanticQuerySnapshot => {
  const { projectRoot, filePath } = createTempSourceFile(sourceText);
  let snapshot: SemanticQuerySnapshot | undefined;
  const extension: CompilerExtension = {
    id: "semantic-query-contract",
    afterCheckSourceFile: (context): void => {
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

const readSemanticSnapshot = (
  context: ExtensionCheckedSourceFileContext,
): SemanticQuerySnapshot => {
  const valueUseTypes: string[] = [];
  let declaredValueName: GoPtr<Node>;
  let narrowedValueUse: GoPtr<Node>;
  let itemUse: GoPtr<Node>;
  let arrowFunction: GoPtr<Node>;
  let identityCall: GoPtr<Node>;

  visitSourceFile(must(context.sourceFile, "checked source file was missing"), (node) => {
    if (node?.Kind === KindParameter) {
      const name = Node_Name(node);
      if (getTstsIdentifierText(name) === "value" && declaredValueName === undefined) {
        declaredValueName = name;
      }
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

    if (
      node?.Kind === KindCallExpression &&
      getTstsIdentifierText(Node_Expression(node)) === "identity"
    ) {
      identityCall = node;
    }
  });

  const valueSymbol = context.checker.getSymbolAtLocation(
    must(narrowedValueUse, "narrowed value use was not discovered"),
  );
  const declaredValueType = context.checker.getDeclaredTypeOfSymbol(
    context.checker.getSymbolAtLocation(
      must(declaredValueName, "value declaration was not discovered"),
    ),
  );
  const itemType = context.checker.getTypeAtLocation(
    must(itemUse, "contextually typed item use was not discovered"),
  );
  const arrowContextualType = context.checker.getContextualType(
    must(arrowFunction, "arrow function was not discovered"),
  );
  const identitySignature = context.checker.getResolvedSignature(
    must(identityCall, "identity call was not discovered"),
  );
  const identityCallType = context.checker.getTypeAtLocation(identityCall);

  return {
    valueUseTypes,
    declaredValueType: context.checker.typeToString(declaredValueType),
    valueSymbolName: must(valueSymbol, "value symbol was not resolved").Name,
    itemUseType: context.checker.typeToString(itemType),
    arrowContextualType: context.checker.typeToString(arrowContextualType),
    identityCallType: context.checker.typeToString(identityCallType),
    identitySignatureParameterCount: must(
      identitySignature,
      "identity signature was not resolved",
    ).parameters.length,
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
  `);

  assert.equal(snapshot.valueSymbolName, "value");
  assert.equal(snapshot.declaredValueType, "string | number");
  assert.ok(snapshot.valueUseTypes.includes("string"));
  assert.ok(snapshot.valueUseTypes.includes("number"));
  assert.equal(snapshot.itemUseType, "{ name: string; }");
  assert.match(snapshot.arrowContextualType, /input: \{ name: string; \}/);
  assert.equal(snapshot.identityCallType, "\"hello\"");
  assert.equal(snapshot.identitySignatureParameterCount, 1);
});
