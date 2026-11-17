import { test } from "node:test";
import { observationCases } from "./fixtures/facts-observations.mjs";

test("standalone static observation codec and checked-source verification", observationCases);
