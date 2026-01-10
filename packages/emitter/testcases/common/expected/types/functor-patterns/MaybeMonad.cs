namespace TestCases.common.types.functorpatterns
{
    public class Functor<T>
        where T : class
    {
        public Functor<U> Map<U>(global::System.Func<T, U> fn)
            where U : class
            {
            throw "Not implemented";
            }
    }
    public static class Maybe
    {
        public static Maybe<T> Just<T>(T value)
            where T : class
            {
            return new Maybe<T>(value);
            }

        public static Maybe<T> Nothing<T>()
            where T : class
            {
            return new Maybe<T>(default);
            }
    }
    public class Maybe<T> : Functor<T>
        where T : class
    {
        private T? Value;

        public Maybe(T? value) : base()
            {
            this.Value = value;
            }

        public override Maybe<U> Map<U>(global::System.Func<T, U> fn)
            where U : class
            {
            if (this.Value is null)
                {
                return Maybe.Nothing<U>();
                }
            return Maybe.Just(fn(this.Value));
            }

        public Maybe<U> FlatMap<U>(global::System.Func<T, Maybe<U>> fn)
            where U : class
            {
            if (this.Value is null)
                {
                return Maybe.Nothing<U>();
                }
            return fn(this.Value);
            }

        public T GetOrElse(T defaultValue)
            {
            return this.Value is not null ? this.Value : defaultValue;
            }
    }
}