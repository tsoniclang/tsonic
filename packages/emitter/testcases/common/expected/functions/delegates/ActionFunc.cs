namespace TestCases.common.functions.delegates
{
        public static class ActionFunc
        {
            public static void RunAction(global::System.Action action)
                {
                action();
                }

            public static void RunActionWithArg(global::System.Action<int> action, int value)
                {
                action(value);
                }

            public static R ApplyFunc<T, R>(global::System.Func<T, R> fn, T value)
                {
                return fn(value);
                }

            public static R ApplyFunc2<T1, T2, R>(global::System.Func<T1, T2, R> fn, T1 a, T2 b)
                {
                return fn(a, b);
                }

            public static global::System.Func<A, C> Compose<A, B, C>(global::System.Func<A, B> f, global::System.Func<B, C> g)
                {
                return (a) => g(f(a));
                }
        }
}