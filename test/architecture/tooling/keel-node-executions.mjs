const nodeBooleanOptions = new Set((
  "--experimental-vfs --report-exclude-env --global-search-paths --strip-types --force-async-hooks-checks " +
  "--experimental-stream-iter --require-module --experimental-detect-module --allow-addons --build-snapshot " +
  "--debug --force-context-aware --expose-internals --disable-sigusr1 --experimental-inspector-network-resource " +
  "--allow-wasi --enable-source-maps --trace-tls --permission --experimental-sqlite --allow-inspector " +
  "--permission-audit --allow-ffi --experimental-addon-modules --allow-net --experimental-require-module " +
  "--preserve-symlinks-main --allow-child-process --inspect-brk --report-on-signal --inspect-wait " +
  "--track-heap-objects --extra-info-on-fatal-exception --test-only --network-family-autoselection --allow-worker --print " +
  "--inspect-brk-node --tls-min-v1.0 --experimental-ffi --experimental-vm-modules --inspect --check " +
  "--report-uncaught-exception --pending-deprecation --tls-min-v1.2 --experimental-import-meta-resolve " +
  "--experimental-import-text --trace-promises --test-force-exit --deprecation --test-update-snapshots " +
  "--report-exclude-network --trace-env-native-stack --throw-deprecation --experimental-test-coverage " +
  "--trace-deprecation --test-randomize --entry-url --trace-env --openssl-shared-config --help " +
  "--experimental-network-inspection --test --trace-sigint --cpu-prof --zero-fill-buffers --force-fips " +
  "--experimental-shadow-realm --async-context-frame --trace-env-js-stack --v8-options --trace-sync-io " +
  "--report-compact --debug-arraybuffer-allocations --experimental-test-module-mocks --addons --tls-min-v1.3 " +
  "--experimental-websocket --enable-fips --report-on-fatalerror --use-openssl-ca --use-bundled-ca --tls-min-v1.1 " +
  "--experimental-global-navigator --allow-openssl-store --heap-prof --experimental-worker-inspection --trace-exit " +
  "--node-snapshot --experimental-storage-inspection --completion-bash --preserve-symlinks --test-udp-no-try-send " +
  "--tls-max-v1.3 --experimental-eventsource --use-env-proxy --force-node-api-uncaught-exceptions-policy " +
  "--trace-warnings --prof-process --experimental-repl-await --test-coverage-include-all --trace-uncaught " +
  "--openssl-legacy-provider --experimental-webstorage --version --frozen-intrinsics --disable-wasm-trap-handler " +
  "--verify-base-objects --watch --interactive --watch-preserve-output --insecure-http-parser --tls-max-v1.2 " +
  "--debug-brk --warnings --use-system-ca --experimental-print-required-tla --prof --perf-prof-unwinding-info " +
  "--jitless --expose-gc --enable-etw-stack-walking --perf-basic-prof --perf-prof --abort-on-uncaught-exception " +
  "--interpreted-frames-native-stack --harmony-shadow-realm --disallow-code-generation-from-strings --perf-basic-prof-only-functions"
).split(" "));
const nodeValueOptions = new Set((
  "--test-coverage-functions --diagnostic-dir --test-coverage-exclude --allow-fs-read --test-concurrency " +
  "--input-type --allow-fs-write --inspect-publish-uid --inspect-port --cpu-prof-dir --max-old-space-size-percentage " +
  "--stack-trace-limit --dns-result-order --report-signal --cpu-prof-name --trace-require-module --tls-keylog " +
  "--heap-prof-dir --test-coverage-lines --experimental-test-tag-filter --test-isolation --test-rerun-failures " +
  "--conditions --heap-prof-interval --cpu-prof-interval --security-revert --disable-proto --test-coverage-include " +
  "--localstorage-file --test-reporter-destination --trace-event-file-pattern --secure-heap-min --trace-event-categories " +
  "--test-coverage-branches --test-random-seed --report-filename --tls-cipher-list --watch-path --test-shard " +
  "--redirect-warnings --max-http-header-size --test-name-pattern --use-largepages --test-timeout --icu-data-dir " +
  "--secure-heap --test-skip-pattern --watch-kill-signal --openssl-config --v8-pool-size --heapsnapshot-signal " +
  "--heap-prof-name --unhandled-rejections --report-dir --network-family-autoselection-attempt-timeout " +
  "--disable-warning --heapsnapshot-near-heap-limit --title --max-old-space-size --max-semi-space-size --max-heap-size"
).split(" "));
const nodeModuleOptions = new Set(["--import", "--require", "--experimental-loader", "--test-global-setup", "--test-reporter"]);
const nodeOpaqueEntryOptions = new Set(["--run", "--build-sea", "--experimental-sea-config", "--experimental-package-map",
  "--build-snapshot-config", "--experimental-config-file", "--snapshot-blob", "--env-file", "--env-file-if-exists"]);
const nodeOptionAliases = new Map([["-C", "--conditions"], ["-r", "--require"], ["-i", "--interactive"],
  ["-v", "--version"], ["-h", "--help"], ["-c", "--check"], ["-e", "--eval"], ["-p", "--print"],
  ["-pe", "--eval"], ["--loader", "--experimental-loader"], ["--experimental-strip-types", "--strip-types"],
  ["--webstorage", "--experimental-webstorage"], ["--enable-network-family-autoselection", "--network-family-autoselection"],
  ["--debug-port", "--inspect-port"], ["--report-directory", "--report-dir"],
  ["--security-reverts", "--security-revert"], ["--experimental-test-isolation", "--test-isolation"]]);
const nodeBuiltinReporters = new Set(["dot", "junit", "lcov", "spec", "tap"]);
const nodeNonStdinModes = new Set(["--help", "--version", "--check", "--test", "--v8-options", "--completion-bash", "--prof-process"]);
const nativeOptionFields = {
  worker: new Set(["execArgv", "eval", "env"]),
  fork: new Set(["execArgv", "env", "execPath"]),
  process: new Set(["shell", "env"]),
  processSync: new Set(["shell", "env", "input"]),
  foreignProcess: new Set(["shell"]),
};

export function createKeelNodeExecutions({ ast, importedApi, memberAccess, literal, transparent, sourceAddress,
  fragmentAddress, literalAddress, firstPartyFragment, referencesCanonicalSource, computedModuleEntry, references }) {
  return { codeEntry, nodeExecution, nodeModuleExecution, executionEnvironment };

  function nodeModuleExecution(node, worker) {
    const arguments_ = ast.arguments(node);
    const controls = invocationControls(arguments_, node, worker ? "worker" : "fork");
    if (controls.eval) codeEntry(arguments_[0], node);
    else executionAddress(sourceAddress(arguments_[0]), node);
  }

  function codeEntry(argument, node, text) {
    const address = text === undefined ? fragmentAddress(argument) : { firstParty: firstPartyFragment(text), observerEvidence: referencesCanonicalSource(text) };
    if (address.firstParty || address.observerEvidence) computedModuleEntry(node);
    else references.push({ external: true, environment: "code-string", offset: ast.pos(node) });
  }

  function nodeExecution(node, member) {
    if (["exec", "execSync"].includes(member)) { computedModuleEntry(node); return; }
    const arguments_ = ast.arguments(node);
    const executable = transparent(arguments_[0]);
    const executableApi = importedApi(executable);
    const argv = memberAccess(executable);
    const nativeNode = literal(executable) && ast.text(executable) === "node" ||
      ["node:process#execPath", "node:process#argv0"].includes(executableApi) ||
      ast.kindName(executable) === "KindElementAccessExpression" && ast.text(ast.children(executable)[1]) === "0" &&
        importedApi(argv?.receiver) === "node:process#argv";
    const controls = invocationControls(arguments_, node, nativeNode
      ? ["spawnSync", "execFileSync"].includes(member) ? "processSync" : "process" : "foreignProcess");
    if (controls.shell) return;
    if (!nativeNode) {
      references.push({ external: true, environment: "external-process", offset: ast.pos(node) }); return;
    }
    if (nodeArguments(controls.argumentList, node)) for (const input of controls.inputs) codeEntry(input, node);
  }

  function nodeArguments(argumentList, node, optionsOnly = false) {
    const values = transparent(argumentList);
    if (ast.kindName(values) !== "KindArrayLiteralExpression") {
      const address = fragmentAddress(values);
      if (address.firstParty || address.observerEvidence) computedModuleEntry(node);
      else references.push({ external: true, environment: "node-arguments", offset: ast.pos(node) });
      return true;
    }
    const elements = ast.elements(values);
    let script = optionsOnly;
    let code = false;
    let interactive = false;
    const nonStdinModes = new Set();
    let afterFlags = false;
    let unresolvedScript = false;
    for (let index = 0; index < elements.length; index++) {
      const argument = elements[index];
      const flag = literal(argument) ? ast.text(argument) : undefined;
      if (!afterFlags && flag === "--") { afterFlags = true; continue; }
      if (!afterFlags && flag?.startsWith("-") && flag !== "-") {
        const short = nodeOptionAliases.has(flag.split("=")[0]) ? null : /^-(pe|[eprC])(.+)$/su.exec(flag);
        const spelling = short === null ? flag.split("=")[0] : `-${short[1]}`;
        const option = nodeOptionAliases.get(spelling) ?? spelling;
        const joined = short?.[2] ?? (flag.includes("=") ? flag.slice(flag.indexOf("=") + 1) : undefined);
        const inlineCode = ["--eval", "--print"].includes(option);
        const module = nodeModuleOptions.has(option);
        const opaque = nodeOpaqueEntryOptions.has(option);
        if (inlineCode || module || opaque || nodeValueOptions.has(option)) {
          if (option === "--print" && joined === undefined &&
            (elements[index + 1] === undefined || literal(elements[index + 1]) && ast.text(elements[index + 1]).startsWith("-"))) {
            codeEntry(undefined, node); continue;
          }
          if (option === "--print" && joined === undefined && !literal(elements[index + 1])) {
            codeEntry(elements[index + 1], node);
            unresolvedArguments(elements.slice(index + 1), node);
            return true;
          }
          const value = joined === undefined ? elements[++index] : undefined;
          if (joined === undefined && (value === undefined || ast.kindName(value) === "KindSpreadElement")) {
            computedModuleEntry(node); return true;
          }
          if (inlineCode) {
            code = true;
            codeEntry(value, node, joined);
          } else if (module) {
            const address = joined === undefined ? sourceAddress(value) : literalAddress(joined);
            if (option !== "--test-reporter" || !nodeBuiltinReporters.has(address.specifier)) executionAddress(address, node, option === "--require");
          } else if (opaque) {
            computedModuleEntry(node);
          }
        } else if (!nodeBooleanOptions.has(option) && !(option.startsWith("--no-") && nodeBooleanOptions.has(`--${option.slice(5)}`)) &&
          option !== "--experimental-default-config-file" && option !== "--trace-events-enabled") {
          computedModuleEntry(node); return true;
        } else if (option === "--experimental-default-config-file") computedModuleEntry(node);
        else {
          const enabled = !option.startsWith("--no-");
          const booleanOption = enabled ? option : `--${option.slice(5)}`;
          if (booleanOption === "--interactive") interactive = enabled;
          if (nodeNonStdinModes.has(booleanOption)) {
            if (enabled) nonStdinModes.add(booleanOption);
            else nonStdinModes.delete(booleanOption);
          }
        }
        continue;
      }
      if (optionsOnly) {
        unresolvedArguments(elements.slice(index), node);
        break;
      }
      if (!script && !code) {
        if (flag === "-") {
          references.push({ external: true, environment: "node-stdin", offset: ast.pos(node) });
          unresolvedScript = true; break;
        }
        const address = sourceAddress(argument);
        executionAddress(address, node);
        if (address.path === undefined && address.specifier === undefined && !address.firstParty && address.suffix === undefined) {
          unresolvedScript = true;
          unresolvedArguments(elements.slice(index + 1), node);
          break;
        }
        script = true;
      }
      break;
    }
    if (!script && !code && !unresolvedScript && !elements.some(element => literal(element) && /^(?:--import|--require|-r|--loader|--experimental-loader)(?:=|$)/u.test(ast.text(element)))) {
      references.push({ external: true, environment: "node-arguments", offset: ast.pos(node) });
    }
    return nonStdinModes.size === 0 && !script && (interactive || !code);
  }

  function unresolvedArguments(arguments_, node) {
    if (arguments_.some(argument => {
      const address = sourceAddress(argument);
      return address.firstParty || address.observerEvidence;
    })) computedModuleEntry(node);
    references.push({ external: true, environment: "node-arguments", offset: ast.pos(node) });
  }

  function invocationControls(arguments_, node, kind) {
    const second = transparent(arguments_[1]);
    const shape = ast.kindName(second);
    const callable = ["KindArrowFunction", "KindFunctionExpression", "KindClassExpression"].includes(shape);
    const optionsObject = shape === "KindObjectLiteralExpression";
    const noArguments = optionsObject || callable || shape === "KindNullKeyword" || second === undefined;
    const candidates = kind === "worker" || optionsObject ? [arguments_[1]] : callable ? []
      : shape === "KindArrayLiteralExpression" || noArguments ? [arguments_[2]] : [arguments_[1], arguments_[2]];
    const controls = { eval: false, shell: false, argumentList: kind === "worker" || noArguments ? undefined : arguments_[1], inputs: [] };
    for (const candidate of candidates) {
      const current = executionOptions(candidate, node, kind);
      controls.eval ||= current.eval;
      controls.shell ||= current.shell;
      controls.inputs.push(...current.inputs);
    }
    return controls;
  }

  function executionOptions(value, node, kind) {
    const options = transparent(value);
    const controls = { eval: false, shell: false, inputs: [] };
    if (options === undefined) return controls;
    if (ast.kindName(options) !== "KindObjectLiteralExpression") {
      const address = fragmentAddress(options);
      if (address.firstParty || address.observerEvidence) computedModuleEntry(node);
      else references.push({ external: true, environment: "node-options", offset: ast.pos(node) });
      return controls;
    }
    const seen = new Set();
    for (const property of ast.properties(options)) {
      const name = ast.name(property);
      const key = ast.kindName(name) === "KindIdentifier" || literal(name) ? ast.text(name) : undefined;
      if (key === undefined) { computedModuleEntry(node); continue; }
      if (!nativeOptionFields[kind].has(key)) continue;
      if (seen.has(key)) computedModuleEntry(node);
      seen.add(key);
      if (ast.kindName(property) !== "KindPropertyAssignment") { computedModuleEntry(node); continue; }
      const argument = transparent(ast.children(property).at(-1));
      if (key === "execArgv") nodeArguments(argument, node, true);
      else if (key === "env") executionEnvironment(argument, node);
      else if (key === "input") controls.inputs.push(argument);
      else if (key === "execPath") references.push({ external: true, environment: "fork-executable", offset: ast.pos(node) });
      else if (key === "eval") {
        if (ast.kindName(argument) === "KindTrueKeyword") controls.eval = true;
        else if (ast.kindName(argument) !== "KindFalseKeyword") computedModuleEntry(node);
      } else if (key === "shell" && ast.kindName(argument) !== "KindFalseKeyword") {
        computedModuleEntry(node); controls.shell = true;
      }
    }
    return controls;
  }

  function executionEnvironment(value, node) {
    const environment = transparent(value);
    if (ast.kindName(environment) !== "KindObjectLiteralExpression") {
      const address = fragmentAddress(environment);
      if (address.firstParty || address.observerEvidence) computedModuleEntry(node);
      else references.push({ external: true, environment: "node-environment", offset: ast.pos(node) });
      return;
    }
    for (const property of ast.properties(environment)) {
      if (ast.kindName(property) === "KindSpreadAssignment") {
        const spread = transparent(ast.children(property)[0]);
        if (ast.kindName(spread) === "KindObjectLiteralExpression") executionEnvironment(spread, node);
        else if (importedApi(spread) === "node:process#env") {
          references.push({ external: true, environment: "node-environment", offset: ast.pos(node) });
        } else {
          const address = fragmentAddress(spread);
          if (address.firstParty || address.observerEvidence) computedModuleEntry(node);
          else references.push({ external: true, environment: "node-environment", offset: ast.pos(node) });
        }
        continue;
      }
      const name = ast.name(property);
      const key = ast.kindName(name) === "KindIdentifier" || literal(name) ? ast.text(name) : undefined;
      if (key === undefined) computedModuleEntry(node);
      else if (key === "NODE_OPTIONS") {
        if (ast.kindName(property) === "KindPropertyAssignment") codeEntry(ast.children(property).at(-1), node);
        else computedModuleEntry(node);
      }
    }
  }

  function executionAddress(address, node, nativeRequire = false) {
    if (address.specifier !== undefined && /^[a-z][a-z0-9+.-]*:/iu.test(address.specifier) && !address.specifier.startsWith("file:")) {
      if (address.firstParty || address.observerEvidence) computedModuleEntry(node);
      else references.push({ external: true, environment: "node-entry-protocol", offset: ast.pos(node) });
      return;
    }
    if (address.specifier !== undefined && !/^[a-z][a-z0-9+.-]*:/iu.test(address.specifier)) address.firstParty = true;
    if (address.path === undefined && address.specifier === undefined && !address.firstParty && address.suffix === undefined) {
      references.push({ external: true, environment: "node-entry", offset: ast.pos(node) });
    } else references.push({ ...address, module: true, executionEntry: true, nativeRequire, offset: ast.pos(node) });
  }

}
