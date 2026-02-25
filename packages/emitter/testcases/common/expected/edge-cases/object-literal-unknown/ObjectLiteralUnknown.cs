// Generated from: ObjectLiteralUnknown.ts
// Generated at: 2026-02-25T03:00:11.158Z
// WARNING: Do not modify this file manually

namespace TestCases.common.edgecases.objectliteralunknown
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class ObjectLiteralUnknown
    {
        public static object? takesUnknown(object? x)
        {
            return x;
        }

        public static object? passPlainObjectLiteral()
        {
            return takesUnknown(new global::System.Collections.Generic.Dictionary<string, object?> { ["ok"] = true, ["n"] = 1, ["s"] = "x" });
        }

        public static object? passNestedObjectLiteral()
        {
            return takesUnknown(new global::System.Collections.Generic.Dictionary<string, object?> { ["a"] = new global::System.Collections.Generic.Dictionary<string, object?> { ["b"] = true } });
        }
    }
}