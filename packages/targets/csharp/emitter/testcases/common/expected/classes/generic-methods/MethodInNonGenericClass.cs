namespace TestCases.common.classes.genericmethods
{
    public class Wrapper<T>
    {
        [global::System.Diagnostics.CodeAnalysis.SetsRequiredMembersAttribute]
        public Wrapper()
        {

        }

        public required T value { get; set; }
    }

    public class Pair<K, V>
    {
        [global::System.Diagnostics.CodeAnalysis.SetsRequiredMembersAttribute]
        public Pair()
        {

        }

        public required K key { get; set; }

        public required V value { get; set; }
    }

    public class Utils
    {
        public static T identity<T>(T value)
        {
            return value;
        }

        public Wrapper<T> wrap<T>(T value)
        {
            return new Wrapper<T> { value = value };
        }

        public Pair<K, V> pair<K, V>(K key, V value)
        {
            return new Pair<K, V> { key = key, value = value };
        }
    }
}