import { test } from "node:test";
import * as types from "../../packages/host/dist/ir-types/index.js";
import { graphInsertionCases } from "./fixtures/types-graph-insertion.mjs";

test("Types owns atomic finite graph insertion into the actual populated run arena", suite => graphInsertionCases(suite, types));
