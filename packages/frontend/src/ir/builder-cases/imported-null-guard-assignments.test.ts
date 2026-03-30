import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import type { IrFunctionDeclaration } from "../types.js";
import { createFilesystemTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

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
        (member) => member.kind === "referenceType" && member.name === "PageContext"
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
});
