import { test } from "node:test";
import { sourceScopeCases } from "./fixtures/facts-source-scopes.mjs";

test("Facts canonical declaration and source-scope authorities", sourceScopeCases);
