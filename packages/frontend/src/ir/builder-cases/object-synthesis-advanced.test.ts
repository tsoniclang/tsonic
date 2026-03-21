/**
 * IR Builder tests: Advanced object synthesis - computed keys, getters, methods, narrowing
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { buildIrModule } from "../builder.js";
import { IrFunctionDeclaration, IrVariableDeclaration } from "../types.js";
import { createTestProgram } from "./_test-helpers.js";

describe("IR Builder", function () {
  this.timeout(90_000);

  describe("Call Inference Regressions – advanced object synthesis", () => {
    it("normalizes computed const-literal property and accessor keys during synthesis", () => {
      const source = `
        export function run(): number {
          const valueKey = "value";
          const doubledKey = "doubled";
          const obj = {
            [valueKey]: 21,
            get [doubledKey](): number {
              return this.value * 2;
            },
          };
          return obj.doubled;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (declaration) =>
              declaration.name.kind === "identifierPattern" &&
              declaration.name.name === "obj" &&
              declaration.initializer !== undefined
          )
      );
      const initializer = decl?.declarations.find(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "obj"
      )?.initializer;
      expect(initializer?.kind).to.equal("object");
      if (!initializer || initializer.kind !== "object") return;

      const valueProp = initializer.properties.find(
        (prop) => prop.kind === "property" && prop.key === "value"
      );
      expect(valueProp).to.not.equal(undefined);

      const doubledAccessor = initializer.behaviorMembers?.find(
        (member) =>
          member.kind === "propertyDeclaration" && member.name === "doubled"
      );
      expect(doubledAccessor).to.not.equal(undefined);
    });

    it("infers unannotated object literal getter types from deterministic bodies", () => {
      const source = `
        export function run(): number {
          const obj = {
            value: 21,
            get doubled() {
              return this.value * 2;
            },
          };
          return obj.doubled;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (declaration) =>
              declaration.name.kind === "identifierPattern" &&
              declaration.name.name === "obj" &&
              declaration.initializer?.kind === "object"
          )
      );
      const initializer = decl?.declarations.find(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "obj"
      )?.initializer;
      expect(initializer?.kind).to.equal("object");
      if (!initializer || initializer.kind !== "object") return;

      const objectType = initializer.inferredType;
      expect(objectType?.kind).to.equal("objectType");
      if (!objectType || objectType.kind !== "objectType") return;

      const doubledMember = objectType.members.find(
        (member) =>
          member.kind === "propertySignature" && member.name === "doubled"
      );
      expect(doubledMember?.kind).to.equal("propertySignature");
      if (!doubledMember || doubledMember.kind !== "propertySignature") return;
      expect(doubledMember.type.kind).to.equal("primitiveType");
      if (doubledMember.type.kind !== "primitiveType") return;
      expect(doubledMember.type.name).to.equal("number");
    });

    it("infers unannotated object literal method return types from deterministic bodies", () => {
      const source = `
        export function run(): number {
          const obj = {
            value: 21,
            inc() {
              this.value += 1;
              return this.value;
            },
          };
          return obj.inc();
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (declaration) =>
              declaration.name.kind === "identifierPattern" &&
              declaration.name.name === "obj" &&
              declaration.initializer?.kind === "object"
          )
      );
      const initializer = decl?.declarations.find(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "obj"
      )?.initializer;
      expect(initializer?.kind).to.equal("object");
      if (!initializer || initializer.kind !== "object") return;

      const objectType = initializer.inferredType;
      expect(objectType?.kind).to.equal("objectType");
      if (!objectType || objectType.kind !== "objectType") return;

      const incMember = objectType.members.find(
        (member) => member.kind === "propertySignature" && member.name === "inc"
      );
      expect(incMember?.kind).to.equal("propertySignature");
      if (!incMember || incMember.kind !== "propertySignature") return;
      expect(incMember.type.kind).to.equal("functionType");
      if (incMember.type.kind !== "functionType") return;
      expect(incMember.type.returnType.kind).to.not.equal("voidType");
      expect(incMember.type.returnType.kind).to.not.equal("unknownType");
      expect(incMember.type.returnType.kind).to.not.equal("anyType");

      const returnStmt = run.body.statements.find(
        (stmt) => stmt.kind === "returnStatement"
      );
      expect(returnStmt).to.not.equal(undefined);
      if (
        !returnStmt ||
        returnStmt.kind !== "returnStatement" ||
        !returnStmt.expression
      )
        return;
      expect(returnStmt.expression.kind).to.equal("call");
      if (returnStmt.expression.kind !== "call") return;
      expect(returnStmt.expression.inferredType?.kind).to.not.equal("voidType");
      expect(returnStmt.expression.inferredType?.kind).to.not.equal(
        "unknownType"
      );
      expect(returnStmt.expression.inferredType?.kind).to.not.equal("anyType");
    });

    it("synthesizes exact numeric properties after nullish fallback narrowing", () => {
      const source = `
        import type { int } from "@tsonic/core/types.js";

        declare function parseRole(raw: string): int | undefined;

        export function run(raw: string): int {
          const parsedInviteAsRole = parseRole(raw);
          const inviteAsRole = parsedInviteAsRole ?? (400 as int);
          const input = {
            inviteAsRole,
          };
          return input.inviteAsRole;
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(
        ctx.diagnostics.some(
          (diagnostic) =>
            diagnostic.code === "TSN5203" &&
            diagnostic.message.includes("inviteAsRole")
        )
      ).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (declaration) =>
              declaration.name.kind === "identifierPattern" &&
              declaration.name.name === "input" &&
              declaration.initializer?.kind === "object"
          )
      );
      const initializer = decl?.declarations.find(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "input"
      )?.initializer;
      expect(initializer?.kind).to.equal("object");
      if (!initializer || initializer.kind !== "object") return;

      const objectType = initializer.inferredType;
      expect(objectType?.kind).to.equal("objectType");
      if (!objectType || objectType.kind !== "objectType") return;

      const inviteAsRoleMember = objectType.members.find(
        (member) =>
          member.kind === "propertySignature" && member.name === "inviteAsRole"
      );
      expect(inviteAsRoleMember?.kind).to.equal("propertySignature");
      if (
        !inviteAsRoleMember ||
        inviteAsRoleMember.kind !== "propertySignature"
      )
        return;
      expect(inviteAsRoleMember.type.kind).to.equal("primitiveType");
      if (inviteAsRoleMember.type.kind !== "primitiveType") return;
      expect(inviteAsRoleMember.type.name).to.equal("int");
    });

    it("normalizes computed const-literal numeric keys during synthesis", () => {
      const source = `
        export function run(): number {
          const slot = 1;
          const obj = {
            [slot]: 7,
          };
          return obj["1"];
        }
      `;

      const { testProgram, ctx, options } = createTestProgram(source);
      const sourceFile = testProgram.sourceFiles[0];
      if (!sourceFile) throw new Error("Failed to create source file");

      const result = buildIrModule(sourceFile, testProgram, options, ctx);
      expect(result.ok).to.equal(true);
      expect(ctx.diagnostics.some((d) => d.code === "TSN7403")).to.equal(false);
      if (!result.ok) return;

      const run = result.value.body.find(
        (stmt): stmt is IrFunctionDeclaration =>
          stmt.kind === "functionDeclaration" && stmt.name === "run"
      );
      expect(run).to.not.equal(undefined);
      if (!run) return;

      const decl = run.body.statements.find(
        (stmt): stmt is IrVariableDeclaration =>
          stmt.kind === "variableDeclaration" &&
          stmt.declarations.some(
            (declaration) =>
              declaration.name.kind === "identifierPattern" &&
              declaration.name.name === "obj" &&
              declaration.initializer !== undefined
          )
      );
      const initializer = decl?.declarations.find(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "obj"
      )?.initializer;
      expect(initializer?.kind).to.equal("object");
      if (!initializer || initializer.kind !== "object") return;

      const slotProp = initializer.properties.find(
        (prop) => prop.kind === "property" && prop.key === "1"
      );
      expect(slotProp).to.not.equal(undefined);
    });
  });
});
