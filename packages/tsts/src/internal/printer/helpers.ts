import type { bool, int } from "../../go/scalars.js";
import type { GoPtr, GoSlice } from "../../go/compat.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::type::Priority","kind":"type","status":"implemented","sigHash":"e45a20d4215421395016743450c400ac5a036a54551ebf389bcf72e97792bafc","bodyHash":"2ab6d6a4dd675ef3c0c291801db9ec07f9bb7327fe479c4d9c642f66ddd4160c"}
 *
 * Go source:
 * Priority struct {
 * 	Value int
 * }
 */
export interface Priority {
  Value: int;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::type::EmitHelper","kind":"type","status":"implemented","sigHash":"fb8b475b77a631d7dba481d5932e322c07601ea12eecd8ee9d88282bf4f268ce","bodyHash":"ebae1db40dab2b764d75dfb12fba9b6bfbc72ad3a9b665b8cf7bff0527f5ffdb"}
 *
 * Go source:
 * EmitHelper struct {
 * 	Name         string                                          // A unique name for this helper.
 * 	Scoped       bool                                            // Indicates whether the helper MUST be emitted in the current scope.
 * 	Text         string                                          // ES3-compatible raw script text
 * 	TextCallback func(makeUniqueName func(string) string) string // A function yielding an ES3-compatible raw script text.
 * 	Priority     *Priority                                       // Helpers with a higher priority are emitted earlier than other helpers on the node.
 * 	Dependencies []*EmitHelper                                   // Emit helpers this helper depends on
 * 	ImportName   string                                          // The name of the helper to use when importing via `--importHelpers`.
 * }
 */
export interface EmitHelper {
  Name: string;
  Scoped: bool;
  Text: string;
  TextCallback: GoPtr<(makeUniqueName: (arg0: string) => string) => string>;
  Priority: GoPtr<Priority>;
  Dependencies: GoPtr<GoSlice<GoPtr<EmitHelper>>>;
  ImportName: string;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::func::compareEmitHelpers","kind":"func","status":"implemented","sigHash":"950fd9826c98a6720b8a949f4dccef594dc0ffd482585545220de5cd85e96346","bodyHash":"acdc67c100f2432fe74df46caff1814f61e79bafa82437e1b499d842ef8c47ea"}
 *
 * Go source:
 * func compareEmitHelpers(x *EmitHelper, y *EmitHelper) int {
 * 	if x == y {
 * 		return 0
 * 	}
 * 	if x.Priority == y.Priority {
 * 		return 0
 * 	}
 * 	if x.Priority == nil {
 * 		return 1
 * 	}
 * 	if y.Priority == nil {
 * 		return -1
 * 	}
 * 	return x.Priority.Value - y.Priority.Value
 * }
 */
export function compareEmitHelpers(x: GoPtr<EmitHelper>, y: GoPtr<EmitHelper>): int {
  if (x === y) {
    return 0;
  }
  if (x!.Priority === y!.Priority) {
    return 0;
  }
  if (x!.Priority === undefined) {
    return 1;
  }
  if (y!.Priority === undefined) {
    return -1;
  }
  return x!.Priority.Value - y!.Priority.Value;
}

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::decorateHelper","kind":"varGroup","status":"implemented","sigHash":"fc3d975abeb7fb79728a2f11d19af582b13f5d63d3174915d8421d159a0e5596","bodyHash":"d130ddb21229e7e4b7643c2964ade8a27d4c48759a6f19558908cec8be3e7a59"}
 *
 * Go source:
 * var decorateHelper = &EmitHelper{
 * 	Name:       "typescript:decorate",
 * 	ImportName: "__decorate",
 * 	Scoped:     false,
 * 	Priority:   &Priority{2},
 * 	Text: `var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
 *     var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
 *     if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
 *     else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
 *     return c > 3 && r && Object.defineProperty(target, key, r), r;
 * };`,
 * }
 */
export const decorateHelper: GoPtr<EmitHelper> = {
  Name: "typescript:decorate",
  ImportName: "__decorate",
  Scoped: false,
  Priority: { Value: 2 },
  Text: `var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};`,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::metadataHelper","kind":"varGroup","status":"implemented","sigHash":"dfb6fc8ef2d82ef9f9fece8c9c31456c2289bdd5258b373c7c1fe5156c709a6e","bodyHash":"80ea101251bd8339bb4a159ca4568ab555e76101e75b9976d0a233146534e968"}
 *
 * Go source:
 * var metadataHelper = &EmitHelper{
 * 	Name:       "typescript:metadata",
 * 	ImportName: "__metadata",
 * 	Scoped:     false,
 * 	Priority:   &Priority{3},
 * 	Text: `var __metadata = (this && this.__metadata) || function (k, v) {
 *     if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
 * };`,
 * }
 */
export const metadataHelper: GoPtr<EmitHelper> = {
  Name: "typescript:metadata",
  ImportName: "__metadata",
  Scoped: false,
  Priority: { Value: 3 },
  Text: `var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};`,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::paramHelper","kind":"varGroup","status":"implemented","sigHash":"3086092f92bf2c8402a8dab813f54f64848e8c97d4e5bfb5059f7ccc6f9980ab","bodyHash":"0c45b0ba095b57eacae3508f29edd63b921683deca14b7fb6a40bc58d4f3e843"}
 *
 * Go source:
 * var paramHelper = &EmitHelper{
 * 	Name:       "typescript:param",
 * 	ImportName: "__param",
 * 	Scoped:     false,
 * 	Priority:   &Priority{4},
 * 	Text: `var __param = (this && this.__param) || function (paramIndex, decorator) {
 *     return function (target, key) { decorator(target, key, paramIndex); }
 * };`,
 * }
 */
export const paramHelper: GoPtr<EmitHelper> = {
  Name: "typescript:param",
  ImportName: "__param",
  Scoped: false,
  Priority: { Value: 4 },
  Text: `var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};`,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::addDisposableResourceHelper","kind":"varGroup","status":"implemented","sigHash":"548031f6e1f618db128ea3b0db2fdfbbd92203d35114ef48f714a8c6378bf3cb","bodyHash":"2be75abc3c75ced5c371a881bac3ebea8cc16af9c10349d09d8df9de2b0f689e"}
 *
 * Go source:
 * var addDisposableResourceHelper = &EmitHelper{
 * 	Name:       "typescript:addDisposableResource",
 * 	ImportName: "__addDisposableResource",
 * 	Scoped:     false,
 * 	Text: `var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
 *     if (value !== null && value !== void 0) {
 *         if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
 *         var dispose, inner;
 *         if (async) {
 *             if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
 *             dispose = value[Symbol.asyncDispose];
 *         }
 *         if (dispose === void 0) {
 *             if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
 *             dispose = value[Symbol.dispose];
 *             if (async) inner = dispose;
 *         }
 *         if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
 *         if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
 *         env.stack.push({ value: value, dispose: dispose, async: async });
 *     }
 *     else if (async) {
 *         env.stack.push({ async: true });
 *     }
 *     return value;
 * };`,
 * }
 */
export const addDisposableResourceHelper: GoPtr<EmitHelper> = {
  Name: "typescript:addDisposableResource",
  ImportName: "__addDisposableResource",
  Scoped: false,
  Text: `var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};`,
  Priority: undefined,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::disposeResourcesHelper","kind":"varGroup","status":"implemented","sigHash":"b2856c689ca84ce6878951b499eee027ff502075d4c343ec6ceb86179e27f0cb","bodyHash":"a6a0b338526320a3fe8e08a09867b145e3f1b4ddbdce7a1e7d82fd256c2a8d4d"}
 *
 * Go source:
 * var disposeResourcesHelper = &EmitHelper{
 * 	Name:       "typescript:disposeResources",
 * 	ImportName: "__disposeResources",
 * 	Scoped:     false,
 * 	Text: `var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
 *     return function (env) {
 *         function fail(e) {
 *             env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
 *             env.hasError = true;
 *         }
 *         var r, s = 0;
 *         function next() {
 *             while (r = env.stack.pop()) {
 *                 try {
 *                     if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
 *                     if (r.dispose) {
 *                         var result = r.dispose.call(r.value);
 *                         if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
 *                     }
 *                     else s |= 1;
 *                 }
 *                 catch (e) {
 *                     fail(e);
 *                 }
 *             }
 *             if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
 *             if (env.hasError) throw env.error;
 *         }
 *         return next();
 *     };
 * })(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
 *     var e = new Error(message);
 *     return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
 * });`,
 * }
 */
export const disposeResourcesHelper: GoPtr<EmitHelper> = {
  Name: "typescript:disposeResources",
  ImportName: "__disposeResources",
  Scoped: false,
  Text: `var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});`,
  Priority: undefined,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::classPrivateFieldGetHelper","kind":"varGroup","status":"implemented","sigHash":"15d6b4f8f3f87dec14b3d2b99fbaa18c1611b9137f0fab60848ddee4c3c311b2","bodyHash":"2b5a393b8cd83203cb63c04635ca45d2c16aef8269aeb66e6b189a9ce43e6c26"}
 *
 * Go source:
 * var classPrivateFieldGetHelper = &EmitHelper{
 * 	Name:       "typescript:classPrivateFieldGet",
 * 	ImportName: "__classPrivateFieldGet",
 * 	Scoped:     false,
 * 	Text: `var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
 *     if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
 *     if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
 *     return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
 * };`,
 * }
 */
export const classPrivateFieldGetHelper: GoPtr<EmitHelper> = {
  Name: "typescript:classPrivateFieldGet",
  ImportName: "__classPrivateFieldGet",
  Scoped: false,
  Text: `var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};`,
  Priority: undefined,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::classPrivateFieldSetHelper","kind":"varGroup","status":"implemented","sigHash":"3280e27a46c4f33560e516adf6b1f200efa4f9a67c55b63bd75e24041691b9c6","bodyHash":"27a7ccab040fb280c5603a2c205265c2dc434700c67dd9104db0b51e8c5d52e6"}
 *
 * Go source:
 * var classPrivateFieldSetHelper = &EmitHelper{
 * 	Name:       "typescript:classPrivateFieldSet",
 * 	ImportName: "__classPrivateFieldSet",
 * 	Scoped:     false,
 * 	Text: `var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
 *     if (kind === "m") throw new TypeError("Private method is not writable");
 *     if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
 *     if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
 *     return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
 * };`,
 * }
 */
export const classPrivateFieldSetHelper: GoPtr<EmitHelper> = {
  Name: "typescript:classPrivateFieldSet",
  ImportName: "__classPrivateFieldSet",
  Scoped: false,
  Text: `var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};`,
  Priority: undefined,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::classPrivateFieldInHelper","kind":"varGroup","status":"implemented","sigHash":"4da1d679fa7e78a6e0ce7fdbdb4d90c43639ba8da154179ea076a01c7a786fb6","bodyHash":"d5e7f0fc7715958e2f53bcc257a8971da96d93ed99ce05812b57da228d1396bb"}
 *
 * Go source:
 * var classPrivateFieldInHelper = &EmitHelper{
 * 	Name:       "typescript:classPrivateFieldIn",
 * 	ImportName: "__classPrivateFieldIn",
 * 	Scoped:     false,
 * 	Text: `var __classPrivateFieldIn = (this && this.__classPrivateFieldIn) || function(state, receiver) {
 *     if (receiver === null || (typeof receiver !== "object" && typeof receiver !== "function")) throw new TypeError("Cannot use 'in' operator on non-object");
 *     return typeof state === "function" ? receiver === state : state.has(receiver);
 * };`,
 * }
 */
export const classPrivateFieldInHelper: GoPtr<EmitHelper> = {
  Name: "typescript:classPrivateFieldIn",
  ImportName: "__classPrivateFieldIn",
  Scoped: false,
  Text: `var __classPrivateFieldIn = (this && this.__classPrivateFieldIn) || function(state, receiver) {
    if (receiver === null || (typeof receiver !== "object" && typeof receiver !== "function")) throw new TypeError("Cannot use 'in' operator on non-object");
    return typeof state === "function" ? receiver === state : state.has(receiver);
};`,
  Priority: undefined,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::awaitHelper","kind":"varGroup","status":"implemented","sigHash":"ff3fc94977bf096a3fcd6745dc82e67aaba83b5e2d085f3be6242f60c6b87500","bodyHash":"d564b0c2326bb7e1e46ea170e108d1e778f0f4e66e58640472a10f99d2028dfb"}
 *
 * Go source:
 * var awaitHelper = &EmitHelper{
 * 	Name:       "typescript:await",
 * 	ImportName: "__await",
 * 	Scoped:     false,
 * 	Text:       `var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }`,
 * }
 */
export const awaitHelper: GoPtr<EmitHelper> = {
  Name: "typescript:await",
  ImportName: "__await",
  Scoped: false,
  Text: `var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }`,
  Priority: undefined,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::asyncGeneratorHelper","kind":"varGroup","status":"implemented","sigHash":"93ebbfe2b2d214389f7508dbaef77757d682dbbccafee6a29fc98ebdcf8c792e","bodyHash":"f21dd99944bd066c3772b238c6062de43267f18ed3372e9e908dcd237bbf483c"}
 *
 * Go source:
 * var asyncGeneratorHelper = &EmitHelper{
 * 	Name:         "typescript:asyncGenerator",
 * 	ImportName:   "__asyncGenerator",
 * 	Scoped:       false,
 * 	Dependencies: []*EmitHelper{awaitHelper},
 * 	Text: `var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
 *     if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
 *     var g = generator.apply(thisArg, _arguments || []), i, q = [];
 *     return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
 *     function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
 *     function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
 *     function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
 *     function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
 *     function fulfill(value) { resume("next", value); }
 *     function reject(value) { resume("throw", value); }
 *     function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
 * };`,
 * }
 */
export const asyncGeneratorHelper: GoPtr<EmitHelper> = {
  Name: "typescript:asyncGenerator",
  ImportName: "__asyncGenerator",
  Scoped: false,
  Dependencies: [awaitHelper],
  Text: `var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};`,
  Priority: undefined,
  TextCallback: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::asyncDelegatorHelper","kind":"varGroup","status":"implemented","sigHash":"1d6a9eda2bb41ef5107c47b653d87525c5564455ba1651003e0504f8a9ebf2c9","bodyHash":"864fc1b681f8d87421325ccf958bb091deae7bbf2f158755fa24657f2d2352c9"}
 *
 * Go source:
 * var asyncDelegatorHelper = &EmitHelper{
 * 	Name:         "typescript:asyncDelegator",
 * 	ImportName:   "__asyncDelegator",
 * 	Scoped:       false,
 * 	Dependencies: []*EmitHelper{awaitHelper},
 * 	Text: `var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
 *     var i, p;
 *     return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
 *     function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
 * };`,
 * }
 */
export const asyncDelegatorHelper: GoPtr<EmitHelper> = {
  Name: "typescript:asyncDelegator",
  ImportName: "__asyncDelegator",
  Scoped: false,
  Dependencies: [awaitHelper],
  Text: `var __asyncDelegator = (this && this.__asyncDelegator) || function (o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
};`,
  Priority: undefined,
  TextCallback: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::asyncValuesHelper","kind":"varGroup","status":"implemented","sigHash":"9abf82f0b77c956253e0d0f7e07a7169ef70abd104ad65f36bc865f1e14f54ff","bodyHash":"b615bb5af27674efc24a8f017ce68c502e73fef77e238b0feda06f31ce321b24"}
 *
 * Go source:
 * var asyncValuesHelper = &EmitHelper{
 * 	Name:       "typescript:asyncValues",
 * 	ImportName: "__asyncValues",
 * 	Scoped:     false,
 * 	Text: `var __asyncValues = (this && this.__asyncValues) || function (o) {
 *     if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
 *     var m = o[Symbol.asyncIterator], i;
 *     return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
 *     function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
 *     function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
 * };`,
 * }
 */
export const asyncValuesHelper: GoPtr<EmitHelper> = {
  Name: "typescript:asyncValues",
  ImportName: "__asyncValues",
  Scoped: false,
  Text: `var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};`,
  Priority: undefined,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::restHelper","kind":"varGroup","status":"implemented","sigHash":"036bb066ccf2fb6887613dfd01900cc473f817e6aeaf477294a6f490fa33ad2d","bodyHash":"40ed39be258ad3ae6bcb27f767321169f5811c25ec8a1a489f7a63bf3967c4b7"}
 *
 * Go source:
 * var restHelper = &EmitHelper{
 * 	Name:       "typescript:rest",
 * 	ImportName: "__rest",
 * 	Scoped:     false,
 * 	Text: `var __rest = (this && this.__rest) || function (s, e) {
 *     var t = {};
 *     for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
 *         t[p] = s[p];
 *     if (s != null && typeof Object.getOwnPropertySymbols === "function")
 *         for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
 *             if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
 *                 t[p[i]] = s[p[i]];
 *         }
 *     return t;
 * };`,
 * }
 */
export const restHelper: GoPtr<EmitHelper> = {
  Name: "typescript:rest",
  ImportName: "__rest",
  Scoped: false,
  Text: `var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};`,
  Priority: undefined,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::awaiterHelper","kind":"varGroup","status":"implemented","sigHash":"51782c7cc1d85305fb7527f86a4cdb0f6ba5fdc6751da029facc2c1066e3bbce","bodyHash":"610cc8041ae967a35711fd977372a6a41f45130d1d1d8b5bd41b485030321ef0"}
 *
 * Go source:
 * var awaiterHelper = &EmitHelper{
 * 	Name:       "typescript:awaiter",
 * 	ImportName: "__awaiter",
 * 	Scoped:     false,
 * 	Priority:   &Priority{5},
 * 	Text: `var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
 *     function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
 *     return new (P || (P = Promise))(function (resolve, reject) {
 *         function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
 *         function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
 *         function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
 *         step((generator = generator.apply(thisArg, _arguments || [])).next());
 *     });
 * };`,
 * }
 */
export const awaiterHelper: GoPtr<EmitHelper> = {
  Name: "typescript:awaiter",
  ImportName: "__awaiter",
  Scoped: false,
  Priority: { Value: 5 },
  Text: `var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};`,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::AsyncSuperHelper","kind":"varGroup","status":"implemented","sigHash":"790cfedbe295d8d80f2dd53e637a741f29789041eae2e3cad3b87997bf099fce","bodyHash":"3e1afdeaee0d9901415853cad5a2f7cfa96b072206e2c267e460cec86b8c686c"}
 *
 * Go source:
 * var AsyncSuperHelper = &EmitHelper{
 * 	Name:   "typescript:async-super",
 * 	Scoped: true,
 * 	TextCallback: func(makeUniqueName func(string) string) string {
 * 		return "\nconst " + makeUniqueName("_superIndex") + " = name => super[name];"
 * 	},
 * }
 */
export const AsyncSuperHelper: GoPtr<EmitHelper> = {
  Name: "typescript:async-super",
  Scoped: true,
  TextCallback: (makeUniqueName: (arg0: string) => string): string => {
    return "\nconst " + makeUniqueName("_superIndex") + " = name => super[name];";
  },
  Text: "",
  ImportName: "",
  Priority: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::AdvancedAsyncSuperHelper","kind":"varGroup","status":"implemented","sigHash":"5c79a7068690226b7b2264733bf1b3bb50478983073c3a23dae7140cc48d6898","bodyHash":"d83449894c0f9cdba038655408d43b4567727a8f496d186be6c9453f9cfb9fac"}
 *
 * Go source:
 * var AdvancedAsyncSuperHelper = &EmitHelper{
 * 	Name:   "typescript:advanced-async-super",
 * 	Scoped: true,
 * 	TextCallback: func(makeUniqueName func(string) string) string {
 * 		return "\nconst " + makeUniqueName("_superIndex") + " = (function (geti, seti) {\n" +
 * 			"    const cache = Object.create(null);\n" +
 * 			"    return name => cache[name] || (cache[name] = { get value() { return geti(name); }, set value(v) { seti(name, v); } });\n" +
 * 			"})(name => super[name], (name, value) => super[name] = value);"
 * 	},
 * }
 */
export const AdvancedAsyncSuperHelper: GoPtr<EmitHelper> = {
  Name: "typescript:advanced-async-super",
  Scoped: true,
  TextCallback: (makeUniqueName: (arg0: string) => string): string => {
    return "\nconst " + makeUniqueName("_superIndex") + " = (function (geti, seti) {\n" +
      "    const cache = Object.create(null);\n" +
      "    return name => cache[name] || (cache[name] = { get value() { return geti(name); }, set value(v) { seti(name, v); } });\n" +
      "})(name => super[name], (name, value) => super[name] = value);";
  },
  Text: "",
  ImportName: "",
  Priority: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::esDecorateHelper","kind":"varGroup","status":"implemented","sigHash":"82f6bf8b922162a9abeefc3aa7171065e599cfba5042c8a2d302a33ae8700757","bodyHash":"c29ea1ff4bfeded9864d60d6cd54bcc3f3a05f1786c98803aa9976ed97c62f50"}
 *
 * Go source:
 * var esDecorateHelper = &EmitHelper{
 * 	Name:       "typescript:esDecorate",
 * 	ImportName: "__esDecorate",
 * 	Scoped:     false,
 * 	Priority:   &Priority{2},
 * 	Text: `var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
 *     function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
 *     var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
 *     var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
 *     var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
 *     var _, done = false;
 *     for (var i = decorators.length - 1; i >= 0; i--) {
 *         var context = {};
 *         for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
 *         for (var p in contextIn.access) context.access[p] = contextIn.access[p];
 *         context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
 *         var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
 *         if (kind === "accessor") {
 *             if (result === void 0) continue;
 *             if (result === null || typeof result !== "object") throw new TypeError("Object expected");
 *             if (_ = accept(result.get)) descriptor.get = _;
 *             if (_ = accept(result.set)) descriptor.set = _;
 *             if (_ = accept(result.init)) initializers.unshift(_);
 *         }
 *         else if (_ = accept(result)) {
 *             if (kind === "field") initializers.unshift(_);
 *             else descriptor[key] = _;
 *         }
 *     }
 *     if (target) Object.defineProperty(target, contextIn.name, descriptor);
 *     done = true;
 * };`,
 * }
 */
export const esDecorateHelper: GoPtr<EmitHelper> = {
  Name: "typescript:esDecorate",
  ImportName: "__esDecorate",
  Scoped: false,
  Priority: { Value: 2 },
  Text: `var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};`,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::runInitializersHelper","kind":"varGroup","status":"implemented","sigHash":"81b6f0310e6668ce4c3498aad2b928ef2c3ea4fc498ea005d6257d9b37f123fa","bodyHash":"dec8a9b12e82259818ffb4c6921c7e11835ed1014668c08a1dff8271c1204c02"}
 *
 * Go source:
 * var runInitializersHelper = &EmitHelper{
 * 	Name:       "typescript:runInitializers",
 * 	ImportName: "__runInitializers",
 * 	Scoped:     false,
 * 	Priority:   &Priority{2},
 * 	Text: `var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
 *     var useValue = arguments.length > 2;
 *     for (var i = 0; i < initializers.length; i++) {
 *         value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
 *     }
 *     return useValue ? value : void 0;
 * };`,
 * }
 */
export const runInitializersHelper: GoPtr<EmitHelper> = {
  Name: "typescript:runInitializers",
  ImportName: "__runInitializers",
  Scoped: false,
  Priority: { Value: 2 },
  Text: `var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};`,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::makeTemplateObjectHelper","kind":"varGroup","status":"implemented","sigHash":"9a3e6a8d12999091ae44ba18e47b8f03a33e217be332b7c18e85ec350c5fa3e6","bodyHash":"c37ad8f1a01e074989a09bbc6a2ac8c69b74d01ab4c398439be7cc914a1a919b"}
 *
 * Go source:
 * var makeTemplateObjectHelper = &EmitHelper{
 * 	Name:       "typescript:makeTemplateObject",
 * 	ImportName: "__makeTemplateObject",
 * 	Scoped:     false,
 * 	Priority:   &Priority{0},
 * 	Text: `var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
 *     if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
 *     return cooked;
 * };`,
 * }
 */
export const makeTemplateObjectHelper: GoPtr<EmitHelper> = {
  Name: "typescript:makeTemplateObject",
  ImportName: "__makeTemplateObject",
  Scoped: false,
  Priority: { Value: 0 },
  Text: `var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};`,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::propKeyHelper","kind":"varGroup","status":"implemented","sigHash":"027680d11c31b3c465b17df80989d002aa9d3496e6680b3e83fbd22560023b64","bodyHash":"8786c5440734dbf041260449c8808dc2181b34eca4e720afc31ad45c0ec9ef58"}
 *
 * Go source:
 * var propKeyHelper = &EmitHelper{
 * 	Name:       "typescript:propKey",
 * 	ImportName: "__propKey",
 * 	Scoped:     false,
 * 	Text: `var __propKey = (this && this.__propKey) || function (x) {
 *     return typeof x === "symbol" ? x : "".concat(x);
 * };`,
 * }
 */
export const propKeyHelper: GoPtr<EmitHelper> = {
  Name: "typescript:propKey",
  ImportName: "__propKey",
  Scoped: false,
  Text: `var __propKey = (this && this.__propKey) || function (x) {
    return typeof x === "symbol" ? x : "".concat(x);
};`,
  Priority: undefined,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::setFunctionNameHelper","kind":"varGroup","status":"implemented","sigHash":"f948b3c837ab7f0694d46d11504a4f2fa9278aa36d60be456d2f6860294fc233","bodyHash":"19a721de56beeea845b527294a935e3a0373c0738641bcffc0a2dec5c83df25e"}
 *
 * Go source:
 * var setFunctionNameHelper = &EmitHelper{
 * 	Name:       "typescript:setFunctionName",
 * 	ImportName: "__setFunctionName",
 * 	Scoped:     false,
 * 	Text: `var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
 *     if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
 *     return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
 * };`,
 * }
 */
export const setFunctionNameHelper: GoPtr<EmitHelper> = {
  Name: "typescript:setFunctionName",
  ImportName: "__setFunctionName",
  Scoped: false,
  Text: `var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};`,
  Priority: undefined,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::createBindingHelper","kind":"varGroup","status":"implemented","sigHash":"19930eab78c4c6a8a41fe8af343d10525a1f1a29e650bd848784201774c634ec","bodyHash":"503e045302d389045920cc5532dcb4ef1037e6e8068be5b518deccc05d335a89"}
 *
 * Go source:
 * var createBindingHelper = &EmitHelper{
 * 	Name:       "typescript:commonjscreatebinding",
 * 	ImportName: "__createBinding",
 * 	Scoped:     false,
 * 	Priority:   &Priority{1},
 * 	Text: `var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
 *     if (k2 === undefined) k2 = k;
 *     var desc = Object.getOwnPropertyDescriptor(m, k);
 *     if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
 *       desc = { enumerable: true, get: function() { return m[k]; } };
 *     }
 *     Object.defineProperty(o, k2, desc);
 * }) : (function(o, m, k, k2) {
 *     if (k2 === undefined) k2 = k;
 *     o[k2] = m[k];
 * }));`,
 * }
 */
export const createBindingHelper: GoPtr<EmitHelper> = {
  Name: "typescript:commonjscreatebinding",
  ImportName: "__createBinding",
  Scoped: false,
  Priority: { Value: 1 },
  Text: `var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));`,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::setModuleDefaultHelper","kind":"varGroup","status":"implemented","sigHash":"5894bf5c3c22952714262503097868aaba61bc85aab0c93c8799b656e769ea1c","bodyHash":"06fbcbbfafc882a72f04b865b028e45b3688cddfabc79a27572621d056bd9fb3"}
 *
 * Go source:
 * var setModuleDefaultHelper = &EmitHelper{
 * 	Name:       "typescript:commonjscreatevalue",
 * 	ImportName: "__setModuleDefault",
 * 	Scoped:     false,
 * 	Priority:   &Priority{1},
 * 	Text: `var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
 *     Object.defineProperty(o, "default", { enumerable: true, value: v });
 * }) : function(o, v) {
 *     o["default"] = v;
 * });`,
 * }
 */
export const setModuleDefaultHelper: GoPtr<EmitHelper> = {
  Name: "typescript:commonjscreatevalue",
  ImportName: "__setModuleDefault",
  Scoped: false,
  Priority: { Value: 1 },
  Text: `var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});`,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::importStarHelper","kind":"varGroup","status":"implemented","sigHash":"f683ed9b2cc0e485887e0005b78ceb0b2db415ae33b5e819893458ec2d17d810","bodyHash":"6a35d7d178df224a4bd79a687eda5d9e94c914af263ec619b3f0c4080d18b609"}
 *
 * Go source:
 * var importStarHelper = &EmitHelper{
 * 	Name:         "typescript:commonjsimportstar",
 * 	ImportName:   "__importStar",
 * 	Scoped:       false,
 * 	Dependencies: []*EmitHelper{createBindingHelper, setModuleDefaultHelper},
 * 	Priority:     &Priority{2},
 * 	Text: `var __importStar = (this && this.__importStar) || (function () {
 *     var ownKeys = function(o) {
 *         ownKeys = Object.getOwnPropertyNames || function (o) {
 *             var ar = [];
 *             for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
 *             return ar;
 *         };
 *         return ownKeys(o);
 *     };
 *     return function (mod) {
 *         if (mod && mod.__esModule) return mod;
 *         var result = {};
 *         if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
 *         __setModuleDefault(result, mod);
 *         return result;
 *     };
 * })();`,
 * }
 */
export const importStarHelper: GoPtr<EmitHelper> = {
  Name: "typescript:commonjsimportstar",
  ImportName: "__importStar",
  Scoped: false,
  Dependencies: [createBindingHelper, setModuleDefaultHelper],
  Priority: { Value: 2 },
  Text: `var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();`,
  TextCallback: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::importDefaultHelper","kind":"varGroup","status":"implemented","sigHash":"616d6b09fb58f74989c289a7a994fbab65e78ebcf58ee844cd08a543a8d89f62","bodyHash":"9cff0e76cd5f6f46663cdd08b1c39cdc368724ca7aa2bdbc079f694e90f08a1c"}
 *
 * Go source:
 * var importDefaultHelper = &EmitHelper{
 * 	Name:       "typescript:commonjsimportdefault",
 * 	ImportName: "__importDefault",
 * 	Scoped:     false,
 * 	Text: `var __importDefault = (this && this.__importDefault) || function (mod) {
 *     return (mod && mod.__esModule) ? mod : { "default": mod };
 * };`,
 * }
 */
export const importDefaultHelper: GoPtr<EmitHelper> = {
  Name: "typescript:commonjsimportdefault",
  ImportName: "__importDefault",
  Scoped: false,
  Text: `var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};`,
  Priority: undefined,
  TextCallback: undefined,
  Dependencies: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::exportStarHelper","kind":"varGroup","status":"implemented","sigHash":"375fafc84f0f0b6eb956dd99b4903703ef99c1e4cb8577f65d8b88f0400cd5f3","bodyHash":"5929db2d899c1bcb7db463dc8134cf925997a9f5bb2faae520507bf267925a13"}
 *
 * Go source:
 * var exportStarHelper = &EmitHelper{
 * 	Name:         "typescript:export-star",
 * 	ImportName:   "__exportStar",
 * 	Scoped:       false,
 * 	Dependencies: []*EmitHelper{createBindingHelper},
 * 	Priority:     &Priority{2},
 * 	Text: `var __exportStar = (this && this.__exportStar) || function(m, exports) {
 *     for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
 * };`,
 * }
 */
export const exportStarHelper: GoPtr<EmitHelper> = {
  Name: "typescript:export-star",
  ImportName: "__exportStar",
  Scoped: false,
  Dependencies: [createBindingHelper],
  Priority: { Value: 2 },
  Text: `var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};`,
  TextCallback: undefined,
};

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/printer/helpers.go::varGroup::rewriteRelativeImportExtensionsHelper","kind":"varGroup","status":"implemented","sigHash":"5c7fd4d16a8b49dcd61ec3ff540c03b93e6666b0d9a6f8eb997e34b92fc1faa7","bodyHash":"48ede1b8193fc72a91d58dd00a5b97ff3990f1e2156b97a80ad0b84e692cd1c5"}
 *
 * Go source:
 * var rewriteRelativeImportExtensionsHelper = &EmitHelper{
 * 	Name:       "typescript:rewriteRelativeImportExtensions",
 * 	ImportName: "__rewriteRelativeImportExtension",
 * 	Scoped:     false,
 * 	Text: `var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
 *     if (typeof path === "string" && /^\.\.?\//.test(path)) {
 *         return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
 *             return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
 *         });
 *     }
 *     return path;
 * };`,
 * }
 */
export const rewriteRelativeImportExtensionsHelper: GoPtr<EmitHelper> = {
  Name: "typescript:rewriteRelativeImportExtensions",
  ImportName: "__rewriteRelativeImportExtension",
  Scoped: false,
  Text: `var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\\.\\.?\\//.test(path)) {
        return path.replace(/\\.(tsx)$|((?:\\.d)?)((?:\\.[^./]+?)?)\\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};`,
  Priority: undefined,
  TextCallback: undefined,
  Dependencies: undefined,
};
