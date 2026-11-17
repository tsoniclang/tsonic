import { keelRuntimeRoots } from "./keel-structure-checks.mjs";

const structure = "docs/architecture/csharp-rust-structure.md";
const nativeScope = "Keel D-K01: preserve reachable native APIs; common provider/API completion is not inferred.";

export const keelOwnedRuntimeFamilies = Object.freeze([
  family("runtime", "Absence", ["Absence"], ["optional_storage.rs"]),
  family("runtime", "Arrays", ["Arrays"], ["raw_memory/array.rs"]),
  family("runtime", "Asynchronous", ["Asynchronous"], ["async_runtime.rs", "dispatch.rs", "dispatch", "dispatch_queue.rs", "ordered_dispatch.rs", "timer_queue.rs", "timer_queue"]),
  family("runtime", "Callables", ["Callables"], ["callable.rs", "frame_callable.rs", "frame_callable_family.rs"]),
  family("runtime", "Errors", ["Errors"], ["error.rs", "retained_error.rs"]),
  family("runtime", "Iteration", ["Iteration"], ["iteration.rs", "generator"]),
  family("runtime", "Memory", ["Memory"], ["location", "raw_memory/mod.rs"]),
  family("runtime", "Numeric", ["Numeric"], ["bigint.rs", "numeric.rs", "operators.rs", "conversions"]),
  family("runtime", "Records", ["Records"], ["field.rs", "record.rs", "record_field.rs"]),
  family("runtime", "Resources", ["Resources"], ["control_flow.rs"]),
  family("runtime", "Values", ["Values"], ["empty_object.rs", "ts_value.rs", "object_handle.rs", "object_identity.rs", "object_ref.rs", "module_cell.rs", "source_string.rs", "reachability.rs"]),
  family("runtime", "Crate composition", [], ["lib.rs"], {
    nativeReason: "S11-05/S11-07: Rust lib.rs composes native crate modules and core/alloc/std features; CLR project/assembly composition is not a runtime algorithm.",
  }),
  family("js", "Arrays", ["Arrays"], ["array"]),
  family("js", "Asynchronous", ["Asynchronous"], ["event_loop.rs", "event_loop", "promise_jobs.rs", "promise_jobs", "promise.rs", "promise", "timers.rs", "timers"]),
  family("js", "Binary", ["Binary"], ["array_buffer", "atomics.rs", "data_view.rs", "typed_array"]),
  family("js", "Collections", ["Collections"], ["map.rs", "set.rs", "weak_collections.rs"]),
  family("js", "Errors", ["Errors"], ["errors.rs"]),
  family("js", "Intl", ["Intl"], ["intl"]),
  family("js", "Json", ["Json"], ["json.rs"]),
  family("js", "Numeric", ["Numeric", "Boolean.cs"], ["bigint.rs", "boolean.rs", "math.rs", "number", "numeric.rs", "native_integer.rs"]),
  family("js", "Objects", ["Objects", "Symbol.cs"], ["object", "value", "equality.rs", "symbol.rs"]),
  family("js", "Properties", ["Properties"], [], {
    nativeReason: "S11-07: CLR AssemblyInfo attributes are native assembly metadata; Rust crate visibility/export declarations are composed in lib.rs, not a fabricated assembly-metadata helper.",
  }),
  family("js", "RegExp", ["RegExp"], ["regexp"]),
  family("js", "Strings", ["Strings", "Globals.String.cs"], ["string.rs", "js_string.rs", "exact_string.rs", "string_capacity.rs", "string_number.rs", "uri.rs"]),
  family("js", "Global composition", ["Globals.cs", "GlobalUsings.cs", "Date.cs", "console.cs"], ["abi.rs", "globals.rs", "date", "console.rs", "wrappers.rs", "lib.rs", "web"]),
  ...[
    ["assert", ["assert"], ["assert.rs"]],
    ["async_hooks", ["async_hooks"], ["async_hooks.rs"]],
    ["buffer", ["buffer"], ["buffer"]],
    ["child_process", ["child_process"], ["child_process"]],
    ["crypto", ["crypto"], ["crypto"]],
    ["dgram", ["dgram"], ["dgram.rs"]],
    ["diagnostics_channel", ["diagnostics_channel"], ["diagnostics_channel.rs"]],
    ["dns", ["dns", "dns_promises"], ["dns"]],
    ["events", ["events"], ["events"]],
    ["fs", ["fs"], ["fs"]],
    ["fs_promises", ["fs_promises"], ["fs_promises"]],
    ["http", ["http"], ["http"]],
    ["http2", ["http2"], ["http2"]],
    ["https", ["https"], ["https.rs"]],
    ["module", ["module"], ["module.rs"]],
    ["net", ["net"], ["net"]],
    ["os", ["os"], ["os"]],
    ["path", ["path"], ["path.rs", "path_posix.rs", "path_win32.rs"]],
    ["perf_hooks", ["perf_hooks"], ["perf_hooks"]],
    ["process", ["process"], ["process"]],
    ["querystring", ["querystring"], ["querystring.rs"]],
    ["readline", ["readline", "readline_promises"], ["readline.rs", "readline"]],
    ["stream", ["stream", "stream_consumers", "stream_promises"], ["stream"]],
    ["string_decoder", ["string_decoder"], ["string_decoder.rs"]],
    ["timers", ["timers", "timers_promises"], ["timers.rs", "timers"]],
    ["tls", ["tls"], ["tls.rs", "tls"]],
    ["tty", ["tty"], ["tty.rs"]],
    ["url", ["url"], ["url"]],
    ["util", ["util", "util_types"], ["util", "error.rs"]],
    ["v8", ["v8"], ["v8"]],
    ["worker_threads", ["worker_threads"], ["worker_threads"]],
    ["zlib", ["zlib"], ["zlib"]],
  ].map(([name, csharp, rust]) => family("nodejs", name, csharp, rust)),
  family("nodejs", "Composition", ["Properties"], ["abi.rs", "lib.rs"]),
  family("nodejs", "Dispatch and native retention", ["BackgroundDispatch.cs", "NodePhases.cs"], ["background.rs", "background", "event_loop.rs", "phases.rs", "readiness.rs", "retained_listener.rs", "runtime_resources.rs", "runtime_resources", "runtime_tasks.rs", "runtime_tasks", "sync.rs"]),
  family("nodejs", "Checked numeric adapters", ["JsNumeric.cs"], [], {
    nativeReason: "JsNumeric.cs owns CLR checked native casts and port/nonnegative validation. Rust uses native integer carriers/try-conversions at each typed declaration; no matching runtime class is required.",
  }),
  ...[
    ["console", ["console"], [], "node:console"],
    ["fetch", [], ["fetch.rs"], "native:fetch"],
    ["sqlite", [], ["sqlite"], "node:sqlite"],
    ["cluster", [], ["cluster.rs"], "node:cluster"],
    ["punycode", [], ["punycode.rs"], "node:punycode"],
  ].map(([name, csharp, rust, api]) => family("nodejs", name, csharp, rust, {
    api, required: false, scopeEvidence: nativeScope,
  })),
]);

function family(tier, name, csharp, rust, extra = {}) {
  return Object.freeze({
    family: `${tier}/${name}`, evidence: `${structure}#native-runtime-source`, ...extra,
    owners: Object.freeze([[`csharp-${tier}`, csharp], [`rust-${tier}`, rust]].flatMap(([repo, paths]) =>
      paths.map(path => Object.freeze({ repo, path: `${keelRuntimeRoots[repo]}/${path}` })))),
  });
}
