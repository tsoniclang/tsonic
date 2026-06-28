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
export const ScriptKindUnknown = 0;
export const ScriptKindJS = 1;
export const ScriptKindJSX = 2;
export const ScriptKindTS = 3;
export const ScriptKindTSX = 4;
export const ScriptKindExternal = 5;
export const ScriptKindJSON = 6;
export const ScriptKindDeferred = 7;
//# sourceMappingURL=scriptkind.js.map