
using Tsonic.Runtime;
using System;

namespace TestCases.realworld
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

        public Pair<V, W> map<V, W>(Func<T, V> firstMapper, Func<U, W> secondMapper)
            {
            return new Pair(firstMapper(this.first), secondMapper(this.second));
            }
    }
    public class TreeNode<T>
    {
        public T value;

        public Tsonic.Runtime.Array<TreeNode<T>> children = new Tsonic.Runtime.Array<object>();

        public TreeNode(T value)
            {
            this.value = value;
            }

        public TreeNode<T> addChild(T value)
            {
            var child = new TreeNode(value);
            this.children.push(child);
            return child;
            }

        public void forEach(Action<T> callback)
            {
            callback(this.value);
            foreach (var child in this.children)
                {
                child.forEach(callback);
                }
            }

        public TreeNode<U> map<U>(Func<T, U> mapper)
            {
            var mapped = new TreeNode(mapper(this.value));
            foreach (var child in this.children)
                {
                mapped.children.push(child.map(mapper));
                }
            return mapped;
            }
    }
    public class Comparable <T>
    {
        public double compareTo(T other) => throw new NotImplementedException();
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

        public static T? min<T>(Tsonic.Runtime.Array<T> items)
            where T : Comparable<T>
            {
            if (items.length == 0.0)
                {
                return default;
                }
            var result = items[0];
            for (var i = 1.0; i < items.length; i++)
                {
                if (items[i].compareTo(result) < 0.0)
                    {
                    result = items[i];
                    }
                }
            return result;
            }

        public static T? max<T>(Tsonic.Runtime.Array<T> items)
            where T : Comparable<T>
            {
            if (items.length == 0.0)
                {
                return default;
                }
            var result = items[0];
            for (var i = 1.0; i < items.length; i++)
                {
                if (items[i].compareTo(result) > 0.0)
                    {
                    result = items[i];
                    }
                }
            return result;
            }
    }
}