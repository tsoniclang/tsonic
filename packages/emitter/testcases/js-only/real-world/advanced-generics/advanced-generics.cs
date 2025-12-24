namespace TestCases.jsonly.realworld.advancedgenerics
{
    public class Pair<T, U>
    {
        public T first;

        public U second;

        public Pair(T first, U second)
            {
            this.first = first;
            this.second = second;
            }

        public Pair<U, T> swap()
            {
            return new Pair(this.second, this.first);
            }

        public Pair<V, W> map<V, W>(global::System.Func<T, V> firstMapper, global::System.Func<U, W> secondMapper)
            {
            return new Pair(firstMapper(this.first), secondMapper(this.second));
            }
    }
    public class ResultOk <T, E>
    {
        public required bool ok { get; set; }

        public required T value { get; set; }
    }
    public class ResultErr <T, E>
    {
        public required bool ok { get; set; }

        public required E error { get; set; }
    }
    public class TreeNode<T>
    {
        public T value;

        public global::System.Collections.Generic.List<TreeNode<T>> children = new global::System.Collections.Generic.List<TreeNode<T>>();

        public TreeNode(T value)
            {
            this.value = value;
            }

        public TreeNode<T> addChild(T value)
            {
            var child = new TreeNode(value);
            global::Tsonic.JSRuntime.Array.push(this.children, child);
            return child;
            }

        public void forEach(global::System.Action<T> callback)
            {
            callback(this.value);
            foreach (var child in this.children)
                {
                child.forEach(callback);
                }
            }

        public TreeNode<U> map<U>(global::System.Func<T, U> mapper)
            {
            var mapped = new TreeNode(mapper(this.value));
            foreach (var child in this.children)
                {
                global::Tsonic.JSRuntime.Array.push(mapped.children, child.map(mapper));
                }
            return mapped;
            }
    }
    public class Comparable <T>
    {
        public double compareTo(T other) => throw new NotImplementedException();
    }

            public static class advancedgenerics
            {
                // type Result = global::Tsonic.Runtime.Union<ResultOk<T, E>, ResultErr<T, E>>

                public static Result<T, E> ok<T, E>(T value)
                    {
                    ResultOk<T, E> result = new ResultOk<T, E> { ok = true, value = value };
                    return result;
                    }

                public static Result<T, E> err<T, E>(E error)
                    {
                    ResultErr<T, E> result = new ResultErr<T, E> { ok = false, error = error };
                    return result;
                    }

                public static bool isOk<T, E>(Result<T, E> result)
                    {
                    return result.Match(__m1 => __m1.ok, __m2 => __m2.ok) == true;
                    }

                public static bool isErr<T, E>(Result<T, E> result)
                    {
                    return result.Match(__m1 => __m1.ok, __m2 => __m2.ok) == false;
                    }

                public static T? min<T>(global::System.Collections.Generic.List<T> items)
                    where T : Comparable<T>
                    {
                    if (global::Tsonic.JSRuntime.Array.length(items) == 0)
                        {
                        return default;
                        }
                    var result = global::Tsonic.JSRuntime.Array.get(items, 0);
                    for (int i = 1; i < global::Tsonic.JSRuntime.Array.length(items); i++)
                        {
                        if (global::Tsonic.JSRuntime.Array.get(items, i).compareTo(result) < 0)
                            {
                            result = global::Tsonic.JSRuntime.Array.get(items, i);
                            }
                        }
                    return result;
                    }

                public static T? max<T>(global::System.Collections.Generic.List<T> items)
                    where T : Comparable<T>
                    {
                    if (global::Tsonic.JSRuntime.Array.length(items) == 0)
                        {
                        return default;
                        }
                    var result = global::Tsonic.JSRuntime.Array.get(items, 0);
                    for (int i = 1; i < global::Tsonic.JSRuntime.Array.length(items); i++)
                        {
                        if (global::Tsonic.JSRuntime.Array.get(items, i).compareTo(result) > 0)
                            {
                            result = global::Tsonic.JSRuntime.Array.get(items, i);
                            }
                        }
                    return result;
                    }

                public static Pair<double, string> createPair()
                    {
                    return new Pair(42, "hello");
                    }

                public static string processResult()
                    {
                    var result = ok<double, string>(100);
                    if (result.Is1())
                    {
                        var result__1_1 = result.As1();
                        return $"Value: {result__1_1.value}";
                    }
                    return "Error";
                    }
            }
}