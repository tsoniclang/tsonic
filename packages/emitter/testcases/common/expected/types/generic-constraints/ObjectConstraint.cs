// Generated from: ObjectConstraint.ts
// Generated at: 2026-01-17T15:37:34.005Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.genericconstraints
{
    public class RefWrapper<T>
        where T : class
    {
        public T? value;

        public RefWrapper(T? value)
            {
            this.value = value;
            }

        public bool isNull()
            {
            return this.value is null;
            }
    }
}