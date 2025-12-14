// Generated from: Inheritance.ts
// Generated at: 2025-12-13T16:22:31.395Z
// WARNING: Do not modify this file manually

namespace TestCases.classes.inheritance
{
    public class Animal
    {
        public string name;

        public Animal(string name)
            {
            this.name = name;
            }

        public string makeSound()
            {
            return "Some sound";
            }
    }
    public class Dog : Animal
    {
        public string breed;

        public Dog(string name, string breed) : base(name)
            {
            this.breed = breed;
            }

        public override string makeSound()
            {
            return "Woof!";
            }
    }
}