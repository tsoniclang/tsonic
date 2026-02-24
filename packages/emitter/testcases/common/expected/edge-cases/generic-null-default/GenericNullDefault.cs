namespace TestCases.common.edgecases.genericnulldefault
{
    public class Result <T> 
        where T : class
    {
        public required T? value { get; set; }

        public required string? error { get; set; }
    }
    public class StringWrapper
    {
        public string value { get; set; }

        public StringWrapper(string value)
            {
            this.value = value;
            }
    }

            [global::Tsonic.Internal.ModuleContainerAttribute]
            public static class GenericNullDefault
            {
                public static Result<T> wrapError<T>(string error)
                    where T : class
                    {
                    return new Result<T> { value = default, error = error };
                    }

                public static Result<T> wrapValue<T>(T value)
                    where T : class
                    {
                    return new Result<T> { value = value, error = null };
                    }

                public static Result<StringWrapper> getConcreteNull()
                    {
                    return new Result<StringWrapper> { value = null, error = null };
                    }
            }
}