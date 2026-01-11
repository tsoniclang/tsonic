namespace TestCases.common.functions.optionalcallbacks
{
        public static class OptionalParams
        {
            // type Callback = global::System.Action<int>

            public static int Compute(int value, global::System.Action<int>? callback = default)
                {
                var result = value * 2;
                if (callback is not null)
                    {
                    callback(result);
                    }
                return result;
                }

            public static int MaybeTransform(int value, global::System.Func<int, int>? transform)
                {
                if (transform is not null)
                    {
                    return transform(value);
                    }
                return value;
                }
        }
}