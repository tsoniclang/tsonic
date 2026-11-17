import assert from "node:assert/strict";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { Session } from "node:inspector";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkCoverage } from "../architecture/host/coverage.mjs";
import { parseSources } from "../architecture/host/import-graph.mjs";

const repository = fileURLToPath(new URL("../../", import.meta.url));

export async function startInferCoverage(names, label) {
  const runtimeFiles = names.map(name => resolve(repository, "packages/host/dist/infer", name));
  const session = new Session();
  const post = (method, parameters = {}) => new Promise((done, reject) => {
    session.post(method, parameters, (error, result) => error === null ? done(result) : reject(error));
  });
  session.connect();
  await post("Debugger.enable");
  await post("Profiler.enable");
  await post("Profiler.startPreciseCoverage", { callCount: true, detailed: true });
  return async () => {
    try {
      const capture = await post("Profiler.takePreciseCoverage");
      const urls = new Set(runtimeFiles.map(path => pathToFileURL(path).href));
      const result = capture.result.filter(script => urls.has(script.url));
      const sources = [];
      for (const script of result) {
        const actual = await post("Debugger.getScriptSource", { scriptId: script.scriptId });
        sources.push({ scriptId: script.scriptId, url: script.url, text: actual.scriptSource });
      }
      await post("Profiler.stopPreciseCoverage");
      const report = checkCoverage({ canonical: realpathSync, readText: path => readFileSync(path, "utf8"), parse: parseSources,
        project: (scriptUrl, text) => ({ path: fileURLToPath(scriptUrl), text }) }, runtimeFiles, [{ ...capture, result, sources }]);
      const directory = resolve(repository, ".temp/infer-coverage", label);
      mkdirSync(directory, { recursive: true });
      writeFileSync(resolve(directory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
      assert.equal(result.length, runtimeFiles.length, "each named infer runtime file has real V8 evidence");
      assert.equal(report.status, "passed", JSON.stringify(report.findings).slice(0, 6000));
      for (const file of report.files) {
        assert.equal(file.status, "covered", file.path);
        assert.equal(file.lines, 100, file.path);
        assert.equal(file.branches, 100, file.path);
        assert.equal(file.functions, 100, file.path);
      }
    } finally { session.disconnect(); }
  };
}
