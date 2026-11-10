import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

function targetCsharpOnlyPackageJson(name) {
  return JSON.stringify({
    name: `tsonic-test-${name}`,
    type: "module",
    private: true,
    dependencies: {
      "@tsonic/target-csharp": "file:../../../../tsonic-csharp",
      "@tsonic/csharp-runtime": "file:../../../../csharp-runtime",
      "@tsonic/csharp-js": "file:../../../../csharp-js",
    },
  }, null, 2);
}

function targetCsharpNodejsPackageJson(projectDirectory) {
  return JSON.stringify({
    name: `tsonic-test-${projectDirectory.split("/").at(-1)}`,
    type: "module",
    private: true,
    dependencies: {
      "@tsonic/target-csharp": "file:../../../../tsonic-csharp",
      "@tsonic/csharp-runtime": "file:../../../../csharp-runtime",
      "@tsonic/csharp-js": "file:../../../../csharp-js",
      "@tsonic/csharp-nodejs": "file:../../../../csharp-nodejs",
    },
  }, null, 2);
}

export { targetCsharpOnlyPackageJson, targetCsharpNodejsPackageJson };
