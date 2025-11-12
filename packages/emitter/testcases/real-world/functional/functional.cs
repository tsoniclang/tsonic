
using Tsonic.Runtime;
using System;
using System.Collections.Generic;

namespace TestCases.realworld
{
    public class Some<T>
    {
        public readonly object _tag = "Some";

        public Some(T value)
            {

            }
    }
    public class None
    {
        public readonly object _tag = "None";
    }
    public class Lazy<T>
    {
        private Func<T> computer;

        private T? value;

        private bool computed = false;

        public Lazy(Func<T> computer)
            {
            this.computer = computer;
            }

        public T get()
            {
            if (!this.computed)
                {
                this.value = this.computer();
                this.computed = true;
                }
            return this.value!;
            }

        public Lazy<U> map<U>(Func<T, U> mapper)
            {
            return new Lazy(() => mapper(this.get()));
            }
    }

    public static class functional
    {
        // type Option = Union<Some<T>, None>

        public static Option<T> some<T>(T value)
            {
            return new Some(value);
            }

        public static Option<T> none<T>()
            {
            return new None();
            }

        public static dynamic isSome<T>(Option<T> option)
            {
            return option._tag == "Some";
            }

        public static dynamic isNone<T>(Option<T> option)
            {
            return option._tag == "None";
            }

        public static T getOrElse<T>(Option<T> option, T defaultValue)
            {
            if (isSome(option))
                {
                return option.value;
                }
            return defaultValue;
            }

        public static B pipe<A, B>(A value, Func<A, B> fn)
            {
            return fn(value);
            }

        public static Func<A, C> compose<A, B, C>(Func<B, C> f, Func<A, B> g)
            {
            return (a) => f(g(a));
            }

        public static Func<A, Func<B, C>> curry<A, B, C>(Func<A, B, C> fn)
            {
            return (a) => (b) => fn(a, b);
            }

        public static Func<B, C> partial<A, B, C>(Func<A, B, C> fn, A a)
            {
            return (b) => fn(a, b);
            }

        public static Func<T, R> memoize<T, R>(Func<T, R> fn)
            where T : List<dynamic>
            {
            var cache = new Map<string, R>();
            return (args) =>
            {
            var key = Tsonic.Runtime.JSON.stringify(args);
            if (cache.has(key))
                {
                return cache.get(key)!;
                }
            var result = fn(params args);
            cache.set(key, result);
            return result;
            };
            }

        public static Action<T> debounce<T>(Action<T> fn, double delayMs)
            where T : List<dynamic>
            {
            dynamic timeoutId;
            return (args) =>
            {
            if (timeoutId != default)
                {
                clearTimeout(timeoutId);
                }
            timeoutId = setTimeout(() =>
            {
            fn(params args);
            }, delayMs);
            };
            }

        public static T assoc<T, K>(T obj, K key, dynamic value)
            where K : dynamic
            {
            return new { /* ...spread */, /* computed */ = value };
            }

        public static Omit<T, K> dissoc<T, K>(T obj, K key)
            where K : dynamic
            {
            var /* destructuring */ = obj;
            return rest;
            }
    }
}