// Generated from: Person.ts
// Generated at: 2025-12-13T16:22:31.374Z
// WARNING: Do not modify this file manually

namespace TestCases.classes.basic
{
    public class Person
    {
        public string name;

        public double age;

        public string greet()
            {
            return $"Hello, I'm {this.name}";
            }

        public void birthday()
            {
            this.age++;
            }
    }
}