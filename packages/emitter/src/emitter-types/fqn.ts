/**
 * Fully Qualified Name (FQN) rendering utilities
 *
 * All types and members are emitted with global:: prefix to eliminate
 * any ambiguity from C# using statements or namespace resolution.
 */

/**
 * Render a fully qualified type name with global:: prefix
 * e.g., "System.Collections.Generic.List" → "global::System.Collections.Generic.List"
 */
export const renderTypeFQN = (namespace: string, typeName: string): string => {
  return `global::${namespace}.${typeName}`;
};

/**
 * Render a fully qualified static member access with global:: prefix
 * e.g., ("System", "Console", "WriteLine") → "global::System.Console.WriteLine"
 */
export const renderMemberFQN = (
  namespace: string,
  typeName: string,
  member: string
): string => {
  return `global::${namespace}.${typeName}.${member}`;
};

/**
 * Render a simple namespace-qualified name with global:: prefix
 * e.g., "System.Console" → "global::System.Console"
 */
export const renderFQN = (qualifiedName: string): string => {
  return `global::${qualifiedName}`;
};

/**
 * Common fully qualified type names used throughout emission
 */
export const FQN = {
  // System types
  Object: "global::System.Object",
  String: "global::System.String",
  Int32: "global::System.Int32",
  Int64: "global::System.Int64",
  Double: "global::System.Double",
  Boolean: "global::System.Boolean",
  Void: "void",

  // System.Collections.Generic
  List: (elementType: string) =>
    `global::System.Collections.Generic.List<${elementType}>`,
  Dictionary: (keyType: string, valueType: string) =>
    `global::System.Collections.Generic.Dictionary<${keyType}, ${valueType}>`,
  IEnumerable: (elementType: string) =>
    `global::System.Collections.Generic.IEnumerable<${elementType}>`,

  // System.Threading.Tasks
  Task: "global::System.Threading.Tasks.Task",
  TaskOf: (resultType: string) =>
    `global::System.Threading.Tasks.Task<${resultType}>`,

  // Tsonic.Runtime
  TsonicRuntime: {
    DynamicObject: "global::Tsonic.Runtime.DynamicObject",
    Union: (types: string) => `global::Tsonic.Runtime.Union<${types}>`,
  },

  // Tsonic.JSRuntime
  TsonicJSRuntime: {
    Array: "global::Tsonic.JSRuntime.Array",
    String: "global::Tsonic.JSRuntime.String",
    Number: "global::Tsonic.JSRuntime.Number",
    Math: "global::Tsonic.JSRuntime.Math",
    Console: "global::Tsonic.JSRuntime.Console",
  },

  // System.Func delegates
  Func: (typeArgs: string) => `global::System.Func<${typeArgs}>`,
  Action: "global::System.Action",
  ActionOf: (typeArgs: string) => `global::System.Action<${typeArgs}>`,
} as const;
