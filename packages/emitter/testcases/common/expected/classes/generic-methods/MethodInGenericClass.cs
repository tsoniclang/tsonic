namespace TestCases.common.classes.genericmethods
{
    public class Transformer<T>
    {
        public T value;

        public Transformer(T value)
            {
            this.value = value;
            }

        public Transformer<U> map<U>(Func<T, U> fn)
            {
            return new Transformer<U>(fn(this.value));
            }

        public Transformer<T> combine(Transformer<T> other, Func<T, T, T> fn)
            {
            return new Transformer<T>(fn(this.value, other.value));
            }
    }
}
