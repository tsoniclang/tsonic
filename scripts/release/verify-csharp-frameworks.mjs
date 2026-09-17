import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function readCsharpFrameworkMatrix(value) {
  const selections = JSON.parse(value ?? "[]");
  if (!Array.isArray(selections)) throw new Error("TSONIC_CSHARP_FRAMEWORK_MATRIX must be a JSON array.");
  for (const selection of selections) {
    if (selection === null || typeof selection !== "object" ||
        Object.keys(selection).sort().join(",") !== "framework,sdk" ||
        typeof selection.framework !== "string" || typeof selection.sdk !== "string" ||
        !/^net[1-9][0-9]+\.0$/u.test(selection.framework) ||
        !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/u.test(selection.sdk)) {
      throw new Error("Each framework selection requires an exact SDK version and a net10.0-or-later framework.");
    }
  }
  return Object.freeze(selections.map((selection) => Object.freeze(selection)));
}

export function verifyCsharpFrameworks(root, options) {
  const { run, environment, message, verifyInstallation } = options;
  const selections = readCsharpFrameworkMatrix(environment.TSONIC_CSHARP_FRAMEWORK_MATRIX);
  for (const selection of selections) {
    writeFileSync(resolve(root, "global.json"), `${JSON.stringify({ sdk: {
      version: selection.sdk, rollForward: "disable", allowPrerelease: true,
    } }, null, 2)}\n`);
    const commandOptions = { cwd: root, capture: true, env: environment };
    if (run("dotnet", ["--version"], commandOptions).trim() !== selection.sdk) {
      throw new Error(`Installed proof did not select SDK ${selection.sdk}.`);
    }
    const config = JSON.parse(readFileSync(resolve(root, "tsonic.json"), "utf8"));
    if (config.targets?.length !== 1 || config.targets[0].id !== "csharp" ||
        typeof config.outDir !== "string" ||
        typeof config.targets[0].options?.assemblyName !== "string") {
      throw new Error("Framework proof requires the created C# project's explicit output directory and assembly name.");
    }
    config.targets[0].surfaces = ["js"];
    config.targets[0].options.targetFramework = selection.framework;
    writeFileSync(resolve(root, "tsonic.json"), `${JSON.stringify(config, null, 2)}\n`);
    writeFileSync(resolve(root, "src/App.ts"), [
      'import { Environment } from "@tsonic/dotnet/System.js";',
      'import { readFileSync } from "node:fs";',
      `if (Environment.Version.Major !== ${selection.framework.slice(3, -2)}) throw new Error("Wrong framework");`,
      `if (readFileSync("message.txt", "utf8") !== ${JSON.stringify(message)}) throw new Error("Wrong file contents");`,
      'console.log([1, 2, 3].map(value => value * 2).join(","));',
      "",
    ].join("\n"));
    for (const phase of ["cold", "warm"]) {
      const output = run("npm", ["start", "--silent"], commandOptions);
      if (!output.replaceAll("\r\n", "\n").endsWith("2,4,6\n")) {
        throw new Error(`Installed ${selection.framework} ${phase} run failed its runtime contract: ${output}`);
      }
      const project = readFileSync(resolve(root, config.outDir, "csharp", `${config.targets[0].options.assemblyName}.csproj`), "utf8");
      if (!project.includes(`<TargetFramework>${selection.framework}</TargetFramework>`) ||
          !project.includes(`/csharp/runtime/${selection.framework}/`)) {
        throw new Error(`Installed ${selection.framework} project lost its framework selection.`);
      }
      verifyInstallation(`${selection.framework} ${phase}`);
      process.stdout.write(`Installed C# ${selection.framework} SDK ${selection.sdk}: ${phase} execution passed without reinstall.\n`);
    }
  }
}
