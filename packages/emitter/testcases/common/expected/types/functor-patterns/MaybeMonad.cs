namespace TestCases.common.types.functorpatterns
{
    public class Functor<T>
        where T : class
    {
        public Functor<U> map<U>(global::System.Func<T, U> fn)
            where U : class
        {
            throw "Not implemented";
        }
    }

    public static class Maybe
    {
        public static Maybe<T> just<T>(T value)
            where T : class
        {
            return new Maybe<T>(value);
        }

        public static Maybe<T> nothing<T>()
            where T : class
        {
            return new Maybe<T>(default);
        }
    }

    public class Maybe<T> : Functor<T>
        where T : class
    {
        private T? value { get; set; }

        public Maybe(T? value) : base()
        {
            this.value = value;
        }

        public override Maybe<U> map<U>(global::System.Func<T, U> fn)
            where U : class
        {
            if (this.value == null)
            {
                return Maybe.nothing<U>();
            }
            return Maybe.just(fn(this.value));
        }

        public Maybe<U> flatMap<U>(global::System.Func<T, Maybe<U>> fn)
            where U : class
        {
            if (this.value == null)
            {
                return Maybe.nothing<U>();
            }
            return fn(this.value);
        }

        public T getOrElse(T defaultValue)
        {
            return this.value != null ? this.value : defaultValue;
        }
    }
}