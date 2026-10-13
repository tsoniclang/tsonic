import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { collectFiles } from "./file-inventory.mjs";
import { keelDigest } from "./keel-source-analysis.mjs";

export const keelCatalogueOwner = Object.freeze({ repo: "tsonic", path: "test/fixtures/catalogue/cases.json" });
const acceptance = [
  ["pudding/csharp/aspnet-ef","tsonic-csharp","csharp-pudding",["aspnetcore/packages/blog-ef"]],
  ["pudding/csharp/aspnet-blog","tsonic-csharp","csharp-pudding",["aspnetcore/packages/blog"]],
  ["pudding/csharp/bcl-calculator","tsonic-csharp","csharp-pudding",["native/packages/calculator"]],
  ["pudding/csharp/bcl-fibonacci","tsonic-csharp","csharp-pudding",["native/packages/fibonacci"]],
  ["pudding/csharp/bcl-generators-resources","tsonic-csharp","csharp-pudding",["native/packages/generators-resources"]],
  ["pudding/csharp/bcl-hello","tsonic-csharp","csharp-pudding",["native/packages/hello-world"]],
  ["pudding/csharp/bcl-high-performance","tsonic-csharp","csharp-pudding",["native/packages/high-performance"]],
  ["pudding/csharp/bcl-native-pointers","tsonic-csharp","csharp-pudding",["native/packages/native-pointers"]],
  ["pudding/csharp/bcl-parallel","tsonic-csharp","csharp-pudding",["native/packages/multithreading"]],
  ["pudding/csharp/bcl-todo","tsonic-csharp","csharp-pudding",["native/packages/todolist-api"]],
  ["pudding/csharp/js-calculator","tsonic-csharp","csharp-pudding",["js/packages/calculator"]],
  ["pudding/csharp/js-concurrency","tsonic-csharp","csharp-pudding",["js/packages/concurrency"]],
  ["pudding/csharp/js-fibonacci","tsonic-csharp","csharp-pudding",["js/packages/fibonacci"]],
  ["pudding/csharp/js-hello","tsonic-csharp","csharp-pudding",["js/packages/hello-world"]],
  ["pudding/csharp/js-regexp-complete","tsonic-csharp","csharp-pudding",["js/packages/regexp-complete"]],
  ["pudding/csharp/js-notes","tsonic-csharp","csharp-pudding",["js/packages/notes-webapp"]],
  ["pudding/csharp/js-todo","tsonic-csharp","csharp-pudding",["js/packages/todolist-api"]],
  ["pudding/csharp/node-concurrency","tsonic-csharp","csharp-pudding",["nodejs/packages/concurrency"]],
  ["pudding/csharp/node-env","tsonic-csharp","csharp-pudding",["nodejs/packages/env-info"]],
  ["pudding/csharp/node-file-reader","tsonic-csharp","csharp-pudding",["nodejs/packages/file-reader"]],
  ["pudding/csharp/node-web","tsonic-csharp","csharp-pudding",["nodejs/packages/webserver"]],
  ["pudding/csharp/scoped-domain","tsonic-csharp","csharp-pudding",["workspaces/scoped-multi-project/packages/domain"]],
  ["pudding/csharp/scoped-api","tsonic-csharp","csharp-pudding",["workspaces/scoped-multi-project/packages/api"]],
  ["pudding/csharp/unscoped-domain","tsonic-csharp","csharp-pudding",["workspaces/unscoped-multi-project/packages/acme-domain"]],
  ["pudding/csharp/unscoped-api","tsonic-csharp","csharp-pudding",["workspaces/unscoped-multi-project/packages/acme-api"]],
  ["pudding/rust/js-calculator","tsonic-rust","rust-pudding",["js/packages/calculator"]],
  ["pudding/rust/js-callbacks","tsonic-rust","rust-pudding",["js/packages/callbacks"]],
  ["pudding/rust/js-collections","tsonic-rust","rust-pudding",["js/packages/collections"]],
  ["pudding/rust/js-fibonacci","tsonic-rust","rust-pudding",["js/packages/fibonacci"]],
  ["pudding/rust/js-hello","tsonic-rust","rust-pudding",["js/packages/hello"]],
  ["pudding/rust/js-json-regexp-date","tsonic-rust","rust-pudding",["js/packages/json-regexp-date"]],
  ["pudding/rust/js-regexp-complete","tsonic-rust","rust-pudding",["js/packages/regexp-complete"]],
  ["pudding/rust/native-async","tsonic-rust","rust-pudding",["native/packages/async"]],
  ["pudding/rust/native-calculator","tsonic-rust","rust-pudding",["native/packages/calculator"]],
  ["pudding/rust/native-cargo-provider","tsonic-rust","rust-pudding",["native/packages/cargo-provider"]],
  ["pudding/rust/native-callables","tsonic-rust","rust-pudding",["native/packages/callables"]],
  ["pudding/rust/native-fibonacci","tsonic-rust","rust-pudding",["native/packages/fibonacci"]],
  ["pudding/rust/native-fixed-arrays","tsonic-rust","rust-pudding",["native/packages/fixed-arrays"]],
  ["pudding/rust/native-generators-resources","tsonic-rust","rust-pudding",["native/packages/generators-resources"]],
  ["pudding/rust/native-hello","tsonic-rust","rust-pudding",["native/packages/hello"]],
  ["pudding/rust/native-models","tsonic-rust","rust-pudding",["native/packages/models"]],
  ["pudding/rust/native-module-initialization","tsonic-rust","rust-pudding",["native/packages/module-initialization"]],
  ["pudding/rust/native-native-pointers","tsonic-rust","rust-pudding",["native/packages/native-pointers"]],
  ["pudding/rust/native-lifetimes","tsonic-rust","rust-pudding",["native/packages/lifetimes"]],
  ["pudding/rust/native-project-polymorphism","tsonic-rust","rust-pudding",["native/packages/project-polymorphism"]],
  ["pudding/rust/native-typed-locations","tsonic-rust","rust-pudding",["native/packages/typed-locations"]],
  ["pudding/rust/node-assertions","tsonic-rust","rust-pudding",["nodejs/packages/assertions"]],
  ["pudding/rust/node-async-fs","tsonic-rust","rust-pudding",["nodejs/packages/async-fs"]],
  ["pudding/rust/node-crypto-buffer","tsonic-rust","rust-pudding",["nodejs/packages/crypto-buffer"]],
  ["pudding/rust/node-env-path","tsonic-rust","rust-pudding",["nodejs/packages/env-path"]],
  ["pudding/rust/node-file-system","tsonic-rust","rust-pudding",["nodejs/packages/file-system"]],
  ["pudding/rust/node-url","tsonic-rust","rust-pudding",["nodejs/packages/url"]],
  ["pudding/rust/workspace-scoped-domain","tsonic-rust","rust-pudding",["workspaces/scoped-multi-project/packages/domain"]],
  ["pudding/rust/workspace-scoped-api","tsonic-rust","rust-pudding",["workspaces/scoped-multi-project/packages/api"]],
  ["pudding/rust/workspace-unscoped-domain","tsonic-rust","rust-pudding",["workspaces/unscoped-multi-project/packages/acme-domain"]],
  ["pudding/rust/workspace-unscoped-api","tsonic-rust","rust-pudding",["workspaces/unscoped-multi-project/packages/acme-api"]],
  ["tsumo/csharp/engine","tsonic-csharp","tsumo-csharp",["packages/engine"]],
  ["tsumo/csharp/cli","tsonic-csharp","tsumo-csharp",["packages/cli"]],
  ["tsumo/csharp/tests","tsonic-csharp","tsumo-csharp",["packages/tests"]],
  ["tsumo/rust/engine","tsonic-rust","tsumo-rust",["packages/engine"]],
  ["tsumo/rust/cli","tsonic-rust","tsumo-rust",["packages/cli"]],
  ["tsumo/rust/tests","tsonic-rust","tsumo-rust",["packages/tests"]],
  ["express/csharp/full","tsonic-csharp","express",["tests/tsonic/fixture-app.ts"]],
  ["express/rust/full","tsonic-rust","express",["tests/tsonic/fixture-app.ts"]],
  ["express/csharp/async-middleware","tsonic-csharp","express",["tests/tsonic/patterns/async-middleware.ts"]],
  ["express/rust/async-middleware","tsonic-rust","express",["tests/tsonic/patterns/async-middleware.ts"]],
  ["express/csharp/error-middleware","tsonic-csharp","express",["tests/tsonic/patterns/error-middleware.ts"]],
  ["express/rust/error-middleware","tsonic-rust","express",["tests/tsonic/patterns/error-middleware.ts"]],
  ["express/csharp/promise-handler","tsonic-csharp","express",["tests/tsonic/patterns/promise-handler.ts"]],
  ["express/rust/promise-handler","tsonic-rust","express",["tests/tsonic/patterns/promise-handler.ts"]],
];
const catalogue = [
  ["cases-asyncChain","69fa73322b61124ad1c25498135d60071384a960784ff19f75b24737d1b5ee81",["csharp","rust"],["native","js"]],
  ["cases-numberLoop","8e8932aefb40c973ba70731f778e9112c355b2b8fe28828ae0044a43d2e8f0b8",["csharp","rust"],["native","js"]],
  ["cases-intLoop","8ea1da78032d8207cad5af67e791542b564d73da29fb5b8f0d2a1fe419289a77",["csharp","rust"],["native","js"]],
  ["cases-arrayPushSum","32eef52600dbbf8c25883d4d98d5d6e8b60666da87acc0d71973ebe85bac44c0",["csharp","rust"],["native","js"]],
  ["cases-arrayIndexSum","ea5089a0c080f06e8fe14aa84e7ed0e3126ba31dad59871b36b3bf6e629411e0",["csharp","rust"],["native","js"]],
  ["cases-arrayPipeline","bf864fcca45c83da185a2af93c48c55d921bd9cd5010148b2faf906d70beefdd",["csharp","rust"],["native","js"]],
  ["cases-stringBuild","3e30eb0420e2e6aaa43a594917c1060d3d629a6cb6b8b57bb678ffc152e9d04d",["csharp","rust"],["native","js"]],
  ["cases-stringOps","858290fc9660601ce11575ef18ddbc3aae75aebff3a3bc3c6c8b80fcf106cab9",["csharp","rust"],["native","js"]],
  ["cases-stringTemplate","15936453c6d8d0c5bb2a126469ab7bf295f2093f70643ae7db07895fa5715fdf",["csharp","rust"],["native","js"]],
  ["cases-classAdd","099c4c577815adbf47889fa1612aff01eee0da7a945c26d07f457a42e8c545eb",["csharp","rust"],["native","js"]],
  ["cases-recordUpdate","253a0c4e4045b18c3a16556f26a34c28b25050ea67daf851c0b33b4bb8ae49e1",["csharp","rust"],["native","js"]],
  ["cases-mapCount","e6f7efb7280c9a6bffc6a9e69bf8d03369bf21ea771888c0cdbe8d64547766a8",["csharp","rust"],["native","js"]],
  ["cases-closureCall","35495619b14ee22036673ab11d782f71093e752aab810c90c94cfada15704133",["csharp","rust"],["native","js"]],
  ["cases-tryLoop","6a4a3eb9d000e79bd408218d08ef88221efbe0d75f1a3b366529d5953299d102",["csharp","rust"],["native","js"]],
  ["cases-jsonStringify","f32dd8762a14bc58a857a85c660fdaf437bb5b78288633850cdcb70719d60262",["csharp","rust"],["native","js"]],
  ["cases-unionArea","63fa0cbe843ce8307bbc6c69710bce729b7f916b84c9ec0a14f2d5447bd03ac1",["csharp","rust"],["native","js"]],
  ["cases-promiseThen","9f35a0b0c9be6fc89ca79ebab90620b92e9e31fe151eec4ea55e72804e52a82c",["csharp","rust"],["native","js"]],
  ["cases-promiseAll","b965b01e5fc22a0e2fc712046c71325a531b77db0ed59ecf3b68b1f3b59828f5",["csharp","rust"],["native","js"]],
  ["cases-storedPromise","baa01cc207a8c100d62420bc71b3c18bc0455c113cfe666d43ec7361aa32a591",["csharp","rust"],["native","js"]],
  ["promise-probe-numThenNoAwait","bf5cc6c74a194846b8fde8c89c5cfaed57469597c6aaee8c3605f8a495f7366d",["csharp","rust"],["native","js"]],
  ["promise-probe-numThenAwait","6d21f0479c528f14b24ff88167e526d22a3610a6c909b6a614f3c9e8b567f95b",["csharp","rust"],["native","js"]],
  ["promise-probe-numAll","1a3d1e678c6bcebaad1759de397df524e7abedfadef458fd24ca9c967a89539c",["csharp","rust"],["native","js"]],
  ["promise-probe-numCatch","a5c43613375be766d5cbf9adcf6aeddfad61a898da9c05483563cf6c98ef8f74",["csharp","rust"],["native","js"]],
  ["promise-probe-numFinally","d5b58778785277c3f51c7f9f8c7fedfae680385d7a9e571be790e6eae0414bb8",["csharp","rust"],["native","js"]],
  ["promise-probe-numResolve","061a8ebd8c80acbcecd90c8f649734a72d278ca7a59d515730de4455e0291e07",["csharp","rust"],["native","js"]],
  ["int32-promise-probe-int32Catch","e896734a4f5fed9fc1a5c78426664ac98ed8287f0d0b15921fd3607c638e3b7c",["csharp","rust"],["native","js"]],
  ["int32-promise-probe-int32AllTuple","6eca5eea6920ff894236a79dc7d3c287f6a87749c892286ddc9716d04c20893d",["csharp","rust"],["native","js"]],
  ["all-probes-sliceForOfNoLoad","4288c5df5d3ff4f4f11e8597e7ba1d3e40be6f7a917ed65678ab502d787885ea",["rust"],["native"]],
  ["all-probes-sliceIndex","617caefc0f4dac7b5d689e87219a6ef6033f5123928374cce2766c133919cdad",["rust"],["native"]],
  ["all-probes-intoIterSum","806d704759659ef8eeb6e751784be0d4e517439c8278f1dcd9f5887600ffd7e8",["rust"],["native"]],
  ["all-probes-vecForOf","ae88bcea6edac593a8b6034e081a23bb3ce19ba2d713d12fb47ab263eae0de33",["rust"],["native"]],
  ["all-probes-vecIndex","36476e77d9d68568e0edb1e99ee167bde24658c3c747ad1cb3cd0710a606dac3",["rust"],["native"]],
  ["all-probes-vecGet","e7c172ce1be95ef6d1caca7764387156031fee09d89020eeaf68dbfabf19949a",["rust"],["native"]],
  ["all-probes-vecFold","4de0248dd905df10954354439da0d42e8bbc87bb75c9dc4e2a1a75482e6b0db2",["rust"],["native"]],
  ["all-probes-vecToArray","41dfdf457944ac0676686989cabb293600d37411c9c01d2a2d45e664c7324834",["rust"],["native"]],
  ["all-probes-nativeArrayForOf","39daf4bd038747051f87ad27066db9c9d9c4e14b0a12a0f66ff6c92154f5c10c",["rust"],["native"]],
  ["all-probes-nativeArrayIndex","2e8ab1d3f03bc1c5fc361dd79a10ed42ffc639297cc13a4513941dd34191b7d6",["rust"],["native"]],
  ["all-probes-literalArrayLoop","f7261ca7f5122c856df103a0a0cb7fa9f9a709250c9d5ad126a92327b2f789d8",["rust"],["native"]],
  ["all-probes-stringPushStr","f4dc8a644605a4359a7274a0c277a3a560b821551f9c78a35b1bf4e7a45f9947",["rust"],["native"]],
  ["all-probes-stringSplitCount","0959103053b79c2efa292ac0bbfb63dd3f0a8a44374642d09c8ab4c489de95ae",["rust"],["native"]],
  ["all-probes-unionSlice","e2c9d92464b958d761363b0bebb6b4ff2cb9ee928f4a4189b31e5a708f9e93b8",["rust"],["native"]],
  ["all-probes-structAdd","d29ef882c0a3c7688885e730099b4b030956069572f0883da4b183bb1f976c54",["rust"],["native"]],
  ["all-probes-structUpdate","d1b51a1b263644fb5f58282752c8a53211d6f75fe9cb0239792268d4d340a8ce",["rust"],["native"]],
  ["all-probes-structUnionIf","655b49926da1d89c67812bd37e46bc89e7b37a321c550afdd8f466c7f3088f68",["rust"],["native"]],
  ["all-probes-structUnionLocal","f58a6a777ee9263f9717f52c666bc506e3add5adad6e8f1f0dc99176c9d101d7",["rust"],["native"]],
  ["override-cases-arrayPushSum","055425a5714369a3dc95ce3e2bbe2b26b483055ad3efb529b828106fdea25210",["rust"],["native"]],
  ["override-cases-arrayIndexSum","8cd8850068f70d28b9dc64ab34b48f4a5a6d4cbdda45a99b7b927e0b889776b6",["rust"],["native"]],
  ["override-cases-arrayPipeline","c3f8b56d5f385e46ba07f4ce1456872cde51dbcc0763cccb8f6c1ad4c1961f18",["rust"],["native"]],
  ["override-cases-stringBuild","54a8dd320e6d3d424e7c73e9225117445ab20820aa405cbc537118649f9749b8",["rust"],["native"]],
  ["override-cases-stringOps","ecae4c1fe48bd59bf07e17d598aaebbfb74383c59585818375e319d3a30a3766",["rust"],["native"]],
  ["override-cases-stringTemplate","d746f84e5920cff85dff37f4daca178df7ad5f91382c681557c02f11ad10ec37",["rust"],["native"]],
  ["override-cases-mapCount","19291226c571abc05b52d3246488035617c1e2891d6e444312f24471c77b5100",["rust"],["native"]],
  ["override-cases-unionArea","7c42dde790451522791e0b7a4a31b984ff0676d96d77a4b701140edb2fc3bfcf",["rust"],["native"]],
  ["cs-override-csListIndex","cbdecadac0b46ff1da0600b9ae769fefd53d948d369310a9418877817337ecc9",["csharp"],["native"]],
  ["cs-override-csListToArray","3ff6473c59534828661ce615779bafdfba528cbf8e4f06c9a2c43bf7f2469364",["csharp"],["native"]],
  ["cs-override-csDictionary","4bcaffe566418650c5f69be49542fa112085d89055e186686549840e8235f4a9",["csharp"],["native"]],
  ["cs-override-csStringBuilder","9101ef8b4bf5df919d683980716292c80e88eded3ed59966c059c73e592a1f6d",["csharp"],["native"]],
  ["cs-override-csStruct","b8be3cb6fbd6c618466aea7d557735e5559a2f8688fc6f56a843853a86ca27fe",["csharp"],["native"]],
];

export const keelOwnedDeterminismPrograms = Object.freeze([
  ...acceptance.map(([id, target, repo, paths]) => Object.freeze({
    id, target, family: "acceptance", inputs: paths.map(path => Object.freeze({ repo, path })),
  })),
  ...catalogue.flatMap(([caseId, seedSha256, targets, surfaces]) => targets.flatMap(target => surfaces.map(surface => Object.freeze({
    id: `catalogue/${target}/${surface}/${caseId}`, target: `tsonic-${target}`, family: "catalogue",
    caseId, surface, seedSha256, inputs: [keelCatalogueOwner],
  })))),
]);

export function readKeelProgramInputs(workspace, program) {
  const excluded = [".analysis", ".temp", ".test", ".tests", ".git", "node_modules", "out", "dist", "target", "bin", "obj"];
  const rows = [];
  for (const input of program.inputs) {
    const path = resolve(workspace, input.repo, input.path);
    const stat = statSync(path);
    if (stat.isFile()) rows.push([`${input.repo}/${input.path}`, readFileSync(path)]);
    else if (stat.isDirectory()) for (const file of collectFiles(path, { exclude: excluded })) {
      rows.push([`${input.repo}/${input.path}/${file}`, readFileSync(resolve(path, file))]);
    } else throw new Error("Required generation input is not an authored file or directory.");
  }
  if (rows.length === 0) throw new Error("Required generation input tree is empty.");
  if (program.family === "catalogue") {
    const catalogue = JSON.parse(readFileSync(resolve(workspace, keelCatalogueOwner.repo, keelCatalogueOwner.path), "utf8"));
    const current = catalogue.cases?.filter(entry => entry.id === program.caseId);
    if (catalogue.schemaVersion !== 1 || current?.length !== 1 || typeof current[0].source !== "string" ||
      !current[0].targets?.includes(program.target.slice("tsonic-".length)) || !current[0].surfaces?.includes(program.surface)) {
      throw new Error("The maintained catalogue has no exact required case/target/surface.");
    }
    rows.push([program.caseId, Buffer.from(current[0].source)]);
  }
  return keelDigest(JSON.stringify(rows.sort(([left], [right]) => left.localeCompare(right))
    .map(([file, bytes]) => [file, keelDigest(bytes)])));
}
