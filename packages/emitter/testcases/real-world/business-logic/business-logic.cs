namespace TestCases.realworld.businesslogic
{
    public class Product
    {
        public string id { get; set; }

        public string name { get; set; }

        public double price { get; set; }

        public double stock { get; set; }

        public string category { get; set; }
    }
    public class CartItem
    {
        public Product product { get; set; }

        public double quantity { get; set; }
    }
    public class Order
    {
        public string id { get; set; }

        public global::System.Collections.Generic.List<CartItem> items { get; set; }

        public double total { get; set; }

        public OrderStatus status { get; set; }

        public Date createdAt { get; set; }
    }
    public class ShoppingCart
    {
        private global::System.Collections.Generic.List<CartItem> items = new global::System.Collections.Generic.List<CartItem>();

        public bool addItem(Product product, double quantity)
            {
            if (quantity <= 0.0 || quantity > product.stock)
                {
                return false;
                }
            var existingItem = global::Tsonic.JSRuntime.Array.find(this.items, (CartItem item) => item.product.id == product.id);
            if (existingItem != null)
                {
                var newQuantity = existingItem.quantity + quantity;
                if (newQuantity > product.stock)
                    {
                    return false;
                    }
                existingItem.quantity = newQuantity;
                }
            else
                {
                global::Tsonic.JSRuntime.Array.push(this.items, new CartItem { product = product, quantity = quantity });
                }
            return true;
            }

        public bool removeItem(string productId)
            {
            var index = global::Tsonic.JSRuntime.Array.findIndex(this.items, (CartItem item) => item.product.id == productId);
            if (index != -1.0)
                {
                global::Tsonic.JSRuntime.Array.splice(this.items, index, 1.0);
                return true;
                }
            return false;
            }

        public bool updateQuantity(string productId, double quantity)
            {
            var item = global::Tsonic.JSRuntime.Array.find(this.items, (CartItem item) => item.product.id == productId);
            if (!item)
                {
                return false;
                }
            if (quantity <= 0.0)
                {
                return this.removeItem(productId);
                }
            if (quantity > item.product.stock)
                {
                return false;
                }
            item.quantity = quantity;
            return true;
            }

        public double getTotal()
            {
            return global::Tsonic.JSRuntime.Array.reduce(this.items, (double sum, CartItem item) => sum + item.product.price * item.quantity, 0.0);
            }

        public double getItemCount()
            {
            return global::Tsonic.JSRuntime.Array.reduce(this.items, (double sum, CartItem item) => sum + item.quantity, 0.0);
            }

        public global::System.Collections.Generic.List<CartItem> getItems()
            {
            return global::System.Linq.Enumerable.ToList(this.items);
            }

        public void clear()
            {
            this.items = new global::System.Collections.Generic.List<CartItem>();
            }
    }
    public class DiscountCalculator
    {
        public static double applyPercentageDiscount(double price, double percentage)
            {
            if (percentage < 0.0 || percentage > 100.0)
                {
                throw new Error("Invalid discount percentage");
                }
            return price * 1.0 - percentage / 100.0;
            }

        public static double applyFixedDiscount(double price, double discount)
            {
            var result = price - discount;
            return result < 0.0 ? 0.0 : result;
            }

        public static double calculateBulkDiscount(double quantity, double price)
            {
            if (quantity >= 100.0)
                {
                return this.applyPercentageDiscount(price, 20.0);
                }
            else
                if (quantity >= 50.0)
                    {
                    return this.applyPercentageDiscount(price, 15.0);
                    }
                else
                    if (quantity >= 10.0)
                        {
                        return this.applyPercentageDiscount(price, 10.0);
                        }
            return price;
            }
    }
    public class OrderProcessor
    {
        private double nextOrderId = 1.0;

        public Order createOrder(ShoppingCart cart)
            {
            var items = cart.getItems();
            if (global::Tsonic.JSRuntime.Array.length(items) == 0.0)
                {
                throw new Error("Cannot create order from empty cart");
                }
            Order order = new Order { id = $"ORD-{this.nextOrderId++}", items = items, total = cart.getTotal(), status = "pending", createdAt = new Date() };
            return order;
            }

        public void updateOrderStatus(Order order, OrderStatus newStatus)
            {
            global::System.Collections.Generic.Dictionary<string, global::System.Collections.Generic.List<OrderStatus>> validTransitions = new global::System.Collections.Generic.Dictionary<string, global::System.Collections.Generic.List<OrderStatus>> { ["pending"] = new global::System.Collections.Generic.List<OrderStatus> { "processing", "cancelled" }, ["processing"] = new global::System.Collections.Generic.List<OrderStatus> { "shipped", "cancelled" }, ["shipped"] = new global::System.Collections.Generic.List<OrderStatus> { "delivered" }, ["delivered"] = new global::System.Collections.Generic.List<OrderStatus>(), ["cancelled"] = new global::System.Collections.Generic.List<OrderStatus>() };
            var allowed = validTransitions[(int)(order.status)];
            if (!global::Tsonic.JSRuntime.Array.includes(allowed, newStatus))
                {
                throw new Error($"Cannot transition from {order.status} to {newStatus}");
                }
            order.status = newStatus;
            }

        public bool cancelOrder(Order order)
            {
            if (order.status == "delivered")
                {
                return false;
                }
            if (order.status == "cancelled")
                {
                return false;
                }
            order.status = "cancelled";
            return true;
            }
    }

            public static class businesslogic
            {
                // type OrderStatus = global::Tsonic.Runtime.Union<string, string, string, string, string>

                public static global::System.Collections.Generic.List<Product> searchProducts(global::System.Collections.Generic.List<Product> products, string query)
                    {
                    var lowerQuery = global::Tsonic.JSRuntime.String.toLowerCase(query);
                    return global::Tsonic.JSRuntime.Array.filter(products, (Product p) => global::Tsonic.JSRuntime.String.includes(global::Tsonic.JSRuntime.String.toLowerCase(p.name), lowerQuery) ?? global::Tsonic.JSRuntime.String.includes(global::Tsonic.JSRuntime.String.toLowerCase(p.category), lowerQuery));
                    }

                public static global::System.Collections.Generic.List<Product> filterByCategory(global::System.Collections.Generic.List<Product> products, string category)
                    {
                    return global::Tsonic.JSRuntime.Array.filter(products, (Product p) => p.category == category);
                    }

                public static global::System.Collections.Generic.List<Product> filterByPriceRange(global::System.Collections.Generic.List<Product> products, double minPrice, double maxPrice)
                    {
                    return global::Tsonic.JSRuntime.Array.filter(products, (Product p) => p.price >= minPrice && p.price <= maxPrice);
                    }

                public static global::System.Collections.Generic.List<Product> sortByPrice(global::System.Collections.Generic.List<Product> products, bool ascending = true)
                    {
                    var sorted = global::System.Linq.Enumerable.ToList(products);
                    global::Tsonic.JSRuntime.Array.sort(sorted, (Product a, Product b) =>
                    {
                    return ascending ? a.price - b.price : b.price - a.price;
                    });
                    return sorted;
                    }
            }
}