namespace TestCases.common.functions.optionalcallbacks
{
    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class OptionalParams
    {
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