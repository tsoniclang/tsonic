// Generated from: GenericNullDefault.ts
// Generated at: 2025-12-13T16:22:31.443Z
// WARNING: Do not modify this file manually

namespace TestCases.edgecases.genericnulldefault
{
    public class Result <T>
    {
        public T? value { get; set; }

        public string? error { get; set; }
    }

            public static class GenericNullDefault
            {
                public static Result<T> wrapError<T>(string error)
                    {
                    return new Result<T> { value = default, error = error };
                    }

                public static Result<T> wrapValue<T>(T value)
                    {
                    return new Result<T> { value = value, error = null };
                    }

                public static Result<string> getConcreteNull()
                    {
                    return new Result<string> { value = null, error = null };
                    }
            }
}