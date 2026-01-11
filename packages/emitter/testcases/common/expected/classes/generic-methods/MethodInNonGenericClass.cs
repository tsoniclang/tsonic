namespace TestCases.common.classes.genericmethods
{
    public class Wrapper <T>
    {
        public required T Value { get; set; }
    }
    public class Pair <K, V>
    {
        public required K Key { get; set; }

        public required V Value { get; set; }
    }
    public class Utils
    {
        public static T Identity<T>(T value)
            {
            return value;
            }

        public Wrapper<T> Wrap<T>(T value)
            {
            return new Wrapper<T> { Value = value };
            }

        public Pair<K, V> Pair<K, V>(K key, V value)
            {
            return new Pair<K, V> { Key = key, Value = value };
            }
    }
}