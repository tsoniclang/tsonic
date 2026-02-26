namespace TestCases.common.classes.genericmethods
{
    public class Transformer<T>
    {
        public T value { get; set; }

        public Transformer(T value)
        {
            this.value = value;
        }

        public Transformer<U> map<U>(global::System.Func<T, U> fn)
        {
            return new Transformer<U>(fn(this.value));
        }

        public Transformer<T> combine(Transformer<T> other, global::System.Func<T, T, T> fn)
        {
            return new Transformer<T>(fn(this.value, other.value));
        }
    }
}