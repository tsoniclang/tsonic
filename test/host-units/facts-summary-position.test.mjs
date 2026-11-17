import { test } from "node:test";
import { summaryPositionCases } from "./fixtures/facts-summary-position.mjs";

test("Facts publishes its existing canonical SummaryPosition ordering", summaryPositionCases);
