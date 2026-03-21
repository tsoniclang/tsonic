/**
 * Static Safety - Utility Types tests
 *
 * Covers:
 * - Mapped utility types (TSN7406): Partial, Required, Readonly, Pick, Omit
 * - Conditional utility types (TSN7407): Extract, Exclude, NonNullable,
 *   ReturnType, Parameters, Awaited, ConstructorParameters, InstanceType
 * - Mapped/conditional syntax (direct aliases, infer clauses)
 * - No false positives for utility-like names
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { validateProgram } from "../validator.js";
import { createTestProgram } from "./helpers.js";

describe("Static Safety Validation", () => {
  describe("Mapped utility types now supported", () => {
    it("should accept Partial<T>", () => {
      const source = `
        interface Person { name: string; age: number; }
        type PartialPerson = Partial<Person>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should accept Required<T>", () => {
      const source = `
        interface Person { name?: string; }
        type RequiredPerson = Required<Person>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should accept Readonly<T>", () => {
      const source = `
        interface Person { name: string; age: number; }
        type ReadonlyPerson = Readonly<Person>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should accept Pick<T, K>", () => {
      const source = `
        interface Person { name: string; age: number; email: string; }
        type NameOnly = Pick<Person, "name">;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should accept Omit<T, K>", () => {
      const source = `
        interface Person { name: string; age: number; }
        type NoAge = Omit<Person, "age">;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should accept nested utility types (Partial<Readonly<T>>)", () => {
      const source = `
        interface Person { name: string; age: number; }
        type PartialReadonlyPerson = Partial<Readonly<Person>>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should accept Pick with multiple keys", () => {
      const source = `
        interface Person { name: string; age: number; email: string; phone: string; }
        type ContactInfo = Pick<Person, "name" | "email" | "phone">;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should accept Omit with multiple keys", () => {
      const source = `
        interface Person { name: string; age: number; email: string; phone: string; }
        type MinimalPerson = Omit<Person, "email" | "phone">;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should accept Required on type with mixed optional properties", () => {
      const source = `
        interface MixedPerson { name: string; age?: number; email?: string; }
        type FullPerson = Required<MixedPerson>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should accept Partial on type with already optional properties", () => {
      const source = `
        interface OptionalPerson { name?: string; age?: number; }
        type StillOptional = Partial<OptionalPerson>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should accept Readonly on type with readonly properties", () => {
      const source = `
        interface PartiallyReadonly { readonly id: string; name: string; }
        type FullyReadonly = Readonly<PartiallyReadonly>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should accept utility types in variable declarations", () => {
      const source = `
        interface Person { name: string; age: number; }
        const update: Partial<Person> = { name: "Alice" };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should accept utility types in function parameters", () => {
      const source = `
        interface Person { name: string; age: number; }
        function updatePerson(person: Person, updates: Partial<Person>): Person {
          return { ...person, ...updates };
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should accept utility types in function return type", () => {
      const source = `
        interface Person { name: string; age: number; }
        function getPartialPerson(): Partial<Person> {
          return { name: "Bob" };
        }
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });
  });

  describe("Conditional utility types are supported", () => {
    // Extract, Exclude, NonNullable are now supported and expanded at compile time
    it("should accept Extract<T, U>", () => {
      const source = `
        type StringOrNumber = string | number;
        type OnlyStrings = Extract<StringOrNumber, string>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7407");
      expect(diag).to.equal(undefined);
    });

    it("should accept Exclude<T, U>", () => {
      const source = `
        type StringOrNumber = string | number;
        type NoStrings = Exclude<StringOrNumber, string>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7407");
      expect(diag).to.equal(undefined);
    });

    it("should accept NonNullable<T>", () => {
      const source = `
        type MaybeString = string | null | undefined;
        type DefinitelyString = NonNullable<MaybeString>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7407");
      expect(diag).to.equal(undefined);
    });

    it("should accept ReturnType<T> (now supported)", () => {
      const source = `
        function greet(name: string): string { return name; }
        type GreetReturn = ReturnType<typeof greet>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7407");
      expect(diag).to.equal(undefined);
    });

    it("should accept Parameters<T> (now supported)", () => {
      const source = `
        function add(a: number, b: number): number { return a + b; }
        type AddParams = Parameters<typeof add>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7407");
      expect(diag).to.equal(undefined);
    });

    it("should accept Awaited<T> (now supported)", () => {
      const source = `
        type Result = Awaited<Promise<string>>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7407");
      expect(diag).to.equal(undefined);
    });

    it("should accept ConstructorParameters<T> (now supported)", () => {
      const source = `
        class User {
          constructor(name: string, active: boolean) {}
        }
        type CtorParams = ConstructorParameters<typeof User>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7407");
      expect(diag).to.equal(undefined);
    });

    it("should accept InstanceType<T> (now supported)", () => {
      const source = `
        class Product {
          constructor(public readonly sku: string) {}
        }
        type ProductInstance = InstanceType<typeof Product>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7407");
      expect(diag).to.equal(undefined);
    });
  });

  describe("Mapped/conditional syntax is supported", () => {
    it("should allow direct mapped type aliases", () => {
      const source = `
        type Mapper<T> = { [K in keyof T]: T[K] };
        type X = Mapper<{ a: string; b: number }>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);
      expect(
        diagnostics.diagnostics.find((d) => d.code === "TSN7406")
      ).to.equal(undefined);
    });

    it("should allow direct conditional type aliases", () => {
      const source = `
        type C<T> = T extends string ? number : boolean;
        type A = C<string>;
        type B = C<number>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);
      expect(
        diagnostics.diagnostics.find((d) => d.code === "TSN7407")
      ).to.equal(undefined);
    });

    it("should allow infer clauses in conditional aliases", () => {
      const source = `
        type Unwrap<T> = T extends Promise<infer U> ? U : T;
        type N = Unwrap<Promise<number>>;
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);
      expect(
        diagnostics.diagnostics.find((d) => d.code === "TSN7409")
      ).to.equal(undefined);
    });
  });

  describe("No false positives for utility-like names", () => {
    it("should allow user-defined type named Partial without type args", () => {
      const source = `
        interface Partial { x: number; y: number; }
        const p: Partial = { x: 1, y: 2 };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should allow Record<string, T> (string keys are supported)", () => {
      const source = `
        type StringDict = Record<string, number>;
        const d: StringDict = { a: 1, b: 2 };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      // Should not have TSN7406 (mapped type) or TSN7413 (non-string key)
      const mappedDiag = diagnostics.diagnostics.find(
        (d) => d.code === "TSN7406"
      );
      const keyDiag = diagnostics.diagnostics.find((d) => d.code === "TSN7413");
      expect(mappedDiag).to.equal(undefined);
      expect(keyDiag).to.equal(undefined);
    });

    it("should allow ReadonlyArray<T> (not a mapped type)", () => {
      const source = `
        const arr: ReadonlyArray<number> = [1, 2, 3];
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7406");
      expect(diag).to.equal(undefined);
    });

    it("should allow user-defined Extract without type args", () => {
      const source = `
        interface Extract { value: string; }
        const e: Extract = { value: "test" };
      `;

      const program = createTestProgram(source);
      const diagnostics = validateProgram(program);

      const diag = diagnostics.diagnostics.find((d) => d.code === "TSN7407");
      expect(diag).to.equal(undefined);
    });
  });
});
