import type { int } from "../../go/scalars.js";

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/scriptkind.go::type::ScriptKind","kind":"type","status":"implemented","sigHash":"6196215e249fe0b53ed41210f4585a3428de14e48e74b04eaadcbe1af1380453","bodyHash":"b6cd3259176326c4360a3df316c38dc5c58bc7c3cc365ee9706aa6cd6825f0fe"}
 *
 * Go source:
 * ScriptKind int32
 */
export type ScriptKind = int;

/**
 * @tsgo-unit {"id":"github.com/microsoft/typescript-go::internal/core/scriptkind.go::constGroup::ScriptKindUnknown+ScriptKindJS+ScriptKindJSX+ScriptKindTS+ScriptKindTSX+ScriptKindExternal+ScriptKindJSON+ScriptKindDeferred","kind":"constGroup","status":"implemented","sigHash":"5b74fa88d283f74cba8af3a029f9affb34b9e33508ed26c3d1709a6814fda68c","bodyHash":"c5335f9e3f70c7e726f7aed08161f9213492cd6ae24d8968839155d43b59ff7c"}
 *
 * Go source:
 * const (
 * 	ScriptKindUnknown ScriptKind = iota
 * 	ScriptKindJS
 * 	ScriptKindJSX
 * 	ScriptKindTS
 * 	ScriptKindTSX
 * 	ScriptKindExternal
 * 	ScriptKindJSON
 * 	/**
 * 	 * Used on extensions that doesn't define the ScriptKind but the content defines it.
 * 	 * Deferred extensions are going to be included in all project contexts.
 * 	 * /
 * 	ScriptKindDeferred
 * )
 */
export const ScriptKindUnknown: ScriptKind = 0;
export const ScriptKindJS: ScriptKind = 1;
export const ScriptKindJSX: ScriptKind = 2;
export const ScriptKindTS: ScriptKind = 3;
export const ScriptKindTSX: ScriptKind = 4;
export const ScriptKindExternal: ScriptKind = 5;
export const ScriptKindJSON: ScriptKind = 6;
export const ScriptKindDeferred: ScriptKind = 7;
