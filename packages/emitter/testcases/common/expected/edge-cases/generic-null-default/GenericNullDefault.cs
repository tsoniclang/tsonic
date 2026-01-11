namespace TestCases.common.edgecases.genericnulldefault
{
    public class Result <T> 
        where T : class
    {
        public required T? Value { get; set; }

        public required string? Error { get; set; }
    }
    internal class StringWrapper
    {
        public string Value;

        public StringWrapper(string value)
            {
            this.Value = value;
            }
    }

            public static class GenericNullDefault
            {
                public static Result<T> WrapError<T>(string error)
                    where T : class
                    {
                    return new Result<T> { Value = default, Error = error };
                    }

                public static Result<T> WrapValue<T>(T value)
                    where T : class
                    {
                    return new Result<T> { Value = value, Error = null };
                    }

                public static Result<StringWrapper> GetConcreteNull()
                    {
                    return new Result<StringWrapper> { Value = null, Error = null };
                    }
            }
}