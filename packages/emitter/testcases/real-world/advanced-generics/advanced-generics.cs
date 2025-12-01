namespace TestCases.realworld.advancedgenerics
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
        public double compareTo(T other) => throw new global::System.NotImplementedException();
    }
    public class Builder<T>
    {
        private Partial<T> props = new {  };

        public Builder<T> set<K>(K key, dynamic value)
            where K : dynamic
            {
            this.props[key] = value;
            return this;
            }

        public T build()
            {
            return this.props;
            }
    }

            public static class advancedgenerics
            {
                // type Result = Union<dynamic, dynamic>

                public static Result<T, E> ok<T, E>(T value)
                    {
                    return new { ok = true, value = value };
                    }

                public static Result<T, E> err<T, E>(E error)
                    {
                    return new { ok = false, error = error };
                    }

                public static dynamic isOk<T, E>(Result<T, E> result)
                    {
                    return result.ok == true;
                    }

                public static dynamic isErr<T, E>(Result<T, E> result)
                    {
                    return result.ok == false;
                    }

                public static T? min<T>(global::System.Collections.Generic.List<T> items)
                    where T : Comparable<T>
                    {
                    if (global::Tsonic.Runtime.Array.length(items) == 0)
                        {
                        return default;
                        }
                    var result = global::Tsonic.Runtime.Array.get(items, 0);
                    for (int i = 1; i < global::Tsonic.Runtime.Array.length(items); i++)
                        {
                        if (global::Tsonic.Runtime.Array.get(items, i).compareTo(result) < 0)
                            {
                            result = global::Tsonic.Runtime.Array.get(items, i);
                            }
                        }
                    return result;
                    }

                public static T? max<T>(global::System.Collections.Generic.List<T> items)
                    where T : Comparable<T>
                    {
                    if (global::Tsonic.Runtime.Array.length(items) == 0)
                        {
                        return default;
                        }
                    var result = global::Tsonic.Runtime.Array.get(items, 0);
                    for (int i = 1; i < global::Tsonic.Runtime.Array.length(items); i++)
                        {
                        if (global::Tsonic.Runtime.Array.get(items, i).compareTo(result) > 0)
                            {
                            result = global::Tsonic.Runtime.Array.get(items, i);
                            }
                        }
                    return result;
                    }
            }
}
