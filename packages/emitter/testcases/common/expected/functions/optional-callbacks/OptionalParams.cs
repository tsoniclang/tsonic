// Generated from: OptionalParams.ts
// Generated at: 2026-02-25T03:00:29.142Z
// WARNING: Do not modify this file manually

namespace TestCases.common.functions.optionalcallbacks
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class OptionalParams
    {
        // type Callback = global::System.Action<int>

        public static int compute(int value, global::System.Action<int>? callback = default)
        {
            var result = value * 2;
            if (callback != null)
            {
                callback(result);
            }
            return result;
        }

        public static int maybeTransform(int value, global::System.Func<int, int>? transform)
        {
            if (transform != null)
            {
                return transform(value);
            }
            return value;
        }
    }
}