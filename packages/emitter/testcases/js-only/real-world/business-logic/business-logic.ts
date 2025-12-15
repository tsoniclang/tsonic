// E-commerce domain models
export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: string; // ISO timestamp - Date is not in globals
}

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export class ShoppingCart {
  private items: CartItem[] = [];

  addItem(product: Product, quantity: number): boolean {
    if (quantity <= 0 || quantity > product.stock) {
      return false;
    }

    const existingItem = this.items.find(
      (item) => item.product.id === product.id
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > product.stock) {
        return false;
      }
      existingItem.quantity = newQuantity;
    } else {
      this.items.push({ product, quantity });
    }

    return true;
  }

  removeItem(productId: string): boolean {
    const index = this.items.findIndex((item) => item.product.id === productId);

    if (index !== -1) {
      this.items.splice(index, 1);
      return true;
    }

    return false;
  }

  updateQuantity(productId: string, quantity: number): boolean {
    const item = this.items.find((item) => item.product.id === productId);

    if (!item) {
      return false;
    }

    if (quantity <= 0) {
      return this.removeItem(productId);
    }

    if (quantity > item.product.stock) {
      return false;
    }

    item.quantity = quantity;
    return true;
  }

  getTotal(): number {
    return this.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  }

  getItemCount(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  getItems(): CartItem[] {
    return [...this.items];
  }

  clear(): void {
    this.items = [];
  }
}

export class DiscountCalculator {
  static applyPercentageDiscount(price: number, percentage: number): number {
    if (percentage < 0 || percentage > 100) {
      throw new Error("Invalid discount percentage");
    }
    return price * (1 - percentage / 100);
  }

  static applyFixedDiscount(price: number, discount: number): number {
    const result = price - discount;
    return result < 0 ? 0 : result;
  }

  static calculateBulkDiscount(quantity: number, price: number): number {
    if (quantity >= 100) {
      return this.applyPercentageDiscount(price, 20);
    } else if (quantity >= 50) {
      return this.applyPercentageDiscount(price, 15);
    } else if (quantity >= 10) {
      return this.applyPercentageDiscount(price, 10);
    }
    return price;
  }
}

export class OrderProcessor {
  private nextOrderId: number = 1;

  createOrder(cart: ShoppingCart): Order {
    const items = cart.getItems();

    if (items.length === 0) {
      throw new Error("Cannot create order from empty cart");
    }

    const order: Order = {
      id: `ORD-${this.nextOrderId++}`,
      items: items,
      total: cart.getTotal(),
      status: "pending",
      createdAt: "2024-01-01T00:00:00.000Z", // ISO timestamp placeholder
    };

    return order;
  }

  updateOrderStatus(order: Order, newStatus: OrderStatus): void {
    const validTransitions: Record<string, OrderStatus[]> = {
      pending: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
    };

    const allowed = validTransitions[order.status];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot transition from ${order.status} to ${newStatus}`);
    }

    order.status = newStatus;
  }

  cancelOrder(order: Order): boolean {
    if (order.status === "delivered") {
      return false;
    }

    if (order.status === "cancelled") {
      return false;
    }

    order.status = "cancelled";
    return true;
  }
}

export function searchProducts(products: Product[], query: string): Product[] {
  const lowerQuery = query.toLowerCase();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.category.toLowerCase().includes(lowerQuery)
  );
}

export function filterByCategory(
  products: Product[],
  category: string
): Product[] {
  return products.filter((p) => p.category === category);
}

export function filterByPriceRange(
  products: Product[],
  minPrice: number,
  maxPrice: number
): Product[] {
  return products.filter((p) => p.price >= minPrice && p.price <= maxPrice);
}

export function sortByPrice(
  products: Product[],
  ascending: boolean = true
): Product[] {
  const sorted = [...products];
  sorted.sort((a, b) => {
    return ascending ? a.price - b.price : b.price - a.price;
  });
  return sorted;
}
