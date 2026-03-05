import type { SimpleBindingFile } from "../program/binding-types.js";

const JS_RUNTIME_ASSEMBLY = "Tsonic.JSRuntime";

export const JS_SURFACE_BUILTIN_BINDINGS: SimpleBindingFile = {
  bindings: {
    console: {
      kind: "global",
      assembly: JS_RUNTIME_ASSEMBLY,
      type: "Tsonic.JSRuntime.console",
    },
    Math: {
      kind: "global",
      assembly: JS_RUNTIME_ASSEMBLY,
      type: "Tsonic.JSRuntime.Math",
    },
    JSON: {
      kind: "global",
      assembly: JS_RUNTIME_ASSEMBLY,
      type: "Tsonic.JSRuntime.JSON",
    },
    Date: {
      kind: "global",
      assembly: JS_RUNTIME_ASSEMBLY,
      type: "Tsonic.JSRuntime.Date",
    },
    RegExp: {
      kind: "global",
      assembly: JS_RUNTIME_ASSEMBLY,
      type: "Tsonic.JSRuntime.RegExp",
    },
    Map: {
      kind: "global",
      assembly: JS_RUNTIME_ASSEMBLY,
      type: "Tsonic.JSRuntime.Map",
    },
    Set: {
      kind: "global",
      assembly: JS_RUNTIME_ASSEMBLY,
      type: "Tsonic.JSRuntime.Set",
    },
    WeakMap: {
      kind: "global",
      assembly: JS_RUNTIME_ASSEMBLY,
      type: "Tsonic.JSRuntime.WeakMap",
    },
    WeakSet: {
      kind: "global",
      assembly: JS_RUNTIME_ASSEMBLY,
      type: "Tsonic.JSRuntime.WeakSet",
    },
    parseInt: {
      kind: "global",
      assembly: JS_RUNTIME_ASSEMBLY,
      type: "Tsonic.JSRuntime.Globals",
      csharpName: "Globals.parseInt",
    },
    parseFloat: {
      kind: "global",
      assembly: JS_RUNTIME_ASSEMBLY,
      type: "Tsonic.JSRuntime.Globals",
      csharpName: "Globals.parseFloat",
    },
    isFinite: {
      kind: "global",
      assembly: JS_RUNTIME_ASSEMBLY,
      type: "Tsonic.JSRuntime.Globals",
      csharpName: "Globals.isFinite",
    },
    isNaN: {
      kind: "global",
      assembly: JS_RUNTIME_ASSEMBLY,
      type: "Tsonic.JSRuntime.Globals",
      csharpName: "Globals.isNaN",
    },
  },
};
