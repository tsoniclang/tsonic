namespace TestCases.common.edgecases.genericnulldefault
{
    public class Result <T>
    {
        public required T? value { get; set; }

        public required string? error { get; set; }
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