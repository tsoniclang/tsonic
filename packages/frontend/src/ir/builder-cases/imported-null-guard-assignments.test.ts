import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import type { IrFunctionDeclaration, IrType } from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  const findMaxCountMemberTypes = (
    value: unknown,
    output: IrType[] = []
  ): IrType[] => {
    if (!value || typeof value !== "object") {
      return output;
    }

    if (
      "kind" in value &&
      (value as { kind?: unknown }).kind === "memberAccess" &&
      "property" in value &&
      (value as { property?: unknown }).property === "maxCount" &&
      "inferredType" in value
    ) {
      const inferredType = (value as { inferredType?: IrType }).inferredType;
      if (inferredType) {
        output.push(inferredType);
      }
    }

    for (const child of Object.values(value)) {
      if (Array.isArray(child)) {
        child.forEach((entry) => findMaxCountMemberTypes(entry, output));
        continue;
      }

      findMaxCountMemberTypes(child, output);
    }

    return output;
  };

  it("preserves imported nullable reference property types across local null guards", () => {
    const fixture = createFilesystemTestProgram(
      {
        "src/models/page-context.ts": [
          "export class PageContext {",
          "  readonly slug: string;",
          "  constructor(slug: string) {",
          "    this.slug = slug;",
          "  }",
          "}",
        ].join("\n"),
        "src/models/menu-entry.ts": [
          'import type { PageContext } from "./page-context.ts";',
          "",
          "export class MenuEntry {",
          "  page: PageContext | undefined;",
          "  constructor() {",
          "    this.page = undefined;",
          "  }",
          "}",
        ].join("\n"),
        "src/build.ts": [
          'import { MenuEntry } from "./models/menu-entry.ts";',
          'import { PageContext } from "./models/page-context.ts";',
          "",
          "const findPageByRef = (pageRef: string): PageContext | undefined => {",
          '  if (pageRef === "") {',
          "    return undefined;",
          "  }",
          "  return new PageContext(pageRef);",
          "};",
          "",
          "export function attach(entry: MenuEntry, pageRef: string): void {",
          '  if (pageRef !== "" && entry.page === undefined) {',
          "    const resolved = findPageByRef(pageRef);",
          "    if (resolved !== undefined) {",
          "      entry.page = resolved;",
          "    }",
          "  }",
          "}",
        ].join("\n"),
      },
      "src/build.ts"
    );

    try {
      const result = buildIrModule(
        fixture.sourceFile,
        fixture.testProgram,
        fixture.options,
        fixture.ctx
      );

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const attachFn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "attach"
      );
      expect(attachFn).to.not.equal(undefined);
      if (!attachFn) return;

      const ifStmt = attachFn.body.statements.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "ifStatement" }> =>
          stmt.kind === "ifStatement"
      );
      expect(ifStmt).to.not.equal(undefined);
      if (!ifStmt || ifStmt.thenStatement.kind !== "blockStatement") return;

      const nestedIf = ifStmt.thenStatement.statements.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "ifStatement" }> =>
          stmt.kind === "ifStatement"
      );
      expect(nestedIf).to.not.equal(undefined);
      if (!nestedIf || nestedIf.thenStatement.kind !== "blockStatement") return;

      const assignmentStmt = nestedIf.thenStatement.statements.find(
        (stmt): stmt is Extract<typeof stmt, { kind: "expressionStatement" }> =>
          stmt.kind === "expressionStatement"
      );
      expect(assignmentStmt).to.not.equal(undefined);
      if (
        !assignmentStmt ||
        assignmentStmt.expression.kind !== "assignment" ||
        assignmentStmt.expression.left.kind !== "memberAccess" ||
        assignmentStmt.expression.right.kind !== "identifier"
      ) {
        return;
      }

      const leftType = assignmentStmt.expression.left.inferredType;
      expect(leftType?.kind).to.equal("unionType");
      if (!leftType || leftType.kind !== "unionType") return;

      const leftRefMember = leftType.types.find(
        (member) =>
          member.kind === "referenceType" && member.name === "PageContext"
      );
      const leftUndefinedMember = leftType.types.find(
        (member) =>
          member.kind === "primitiveType" && member.name === "undefined"
      );
      expect(leftRefMember).to.not.equal(undefined);
      expect(leftUndefinedMember).to.not.equal(undefined);

      const rightType = assignmentStmt.expression.right.inferredType;
      expect(rightType?.kind).to.equal("referenceType");
      if (!rightType || rightType.kind !== "referenceType") return;
      expect(rightType.name).to.equal("PageContext");
    } finally {
      fixture.cleanup();
    }
  });

  it("preserves imported optional property unions after terminating truthiness guards", () => {
    const fixture = createFilesystemTestProgram(
      {
        "src/options.ts": [
          "export interface MultipartField {",
          "  name: string;",
          "  maxCount?: number;",
          "}",
        ].join("\n"),
        "src/index.ts": [
          'import type { MultipartField } from "./options.js";',
          "",
          "function findAllowRule(",
          "  allowList: readonly MultipartField[],",
          "  fieldname: string",
          "): MultipartField | undefined {",
          "  for (let index = 0; index < allowList.length; index += 1) {",
          "    const candidate = allowList[index]!;",
          "    if (candidate.name.toLowerCase() === fieldname.toLowerCase()) {",
          "      return candidate;",
          "    }",
          "  }",
          "",
          "  return undefined;",
          "}",
          "",
          "export function run(",
          "  allowList: readonly MultipartField[],",
          "  fieldname: string",
          "): void {",
          "  const rule = findAllowRule(allowList, fieldname);",
          "  if (!rule) {",
          "    return;",
          "  }",
          "",
          "  if (rule.maxCount !== undefined) {",
          "    const current = 0;",
          "    const nextCount = current + 1;",
          "    if (nextCount > rule.maxCount) {",
          "      throw new Error(String(rule.maxCount));",
          "    }",
          "  }",
          "}",
        ].join("\n"),
      },
      "src/index.ts"
    );

    try {
      const result = buildIrModule(
        fixture.sourceFile,
        fixture.testProgram,
        fixture.options,
        fixture.ctx
      );

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      const runFn = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(runFn).to.not.equal(undefined);
      if (!runFn) return;

      const maxCountTypes = findMaxCountMemberTypes(runFn.body);
      expect(maxCountTypes.length).to.be.greaterThan(0);

      for (const inferredType of maxCountTypes) {
        expect(inferredType.kind).to.equal("unionType");
        if (inferredType.kind !== "unionType") {
          continue;
        }

        const hasNumber = inferredType.types.some(
          (member) =>
            member.kind === "primitiveType" && member.name === "number"
        );
        const hasUndefined = inferredType.types.some(
          (member) =>
            member.kind === "primitiveType" && member.name === "undefined"
        );
        expect(hasNumber).to.equal(true);
        expect(hasUndefined).to.equal(true);
      }
    } finally {
      fixture.cleanup();
    }
  });
});
