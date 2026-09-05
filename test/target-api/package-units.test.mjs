import { fileURLToPath } from "node:url";
import { importPackageUnitTests } from "../scripts/import-package-unit-tests.mjs";

await importPackageUnitTests(fileURLToPath(new URL("../../packages/target-api", import.meta.url)));
