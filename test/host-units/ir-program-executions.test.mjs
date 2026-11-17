import { test } from "node:test";
import { executionCases } from "./fixtures/program-executions.mjs";

await test("Program complete execution identities and invocation resources", executionCases);
