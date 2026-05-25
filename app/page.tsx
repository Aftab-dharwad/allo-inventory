import { ProductCard } from "@/components/ProductCard";

interface StockEntry {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  total: number;
  reserved: number;
  available: number;
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  sku: string;
  price: string;
  imageUrl?: string | null;
  stocks: StockEntry[];
}

async function getProducts(): Promise<Product[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/products`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export default async function HomePage() {
  let products: Product[] = [];
  let error: string | null = null;

  try {
    products = await getProducts();
  } catch {
    error = "Failed to load products. Please check your database connection.";
  }

  const totalAvailable = products.reduce(
    (sum, p) => sum + p.stocks.reduce((s, st) => s + st.available, 0),
    0
  );

  return (
    <div>
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900">Product Catalogue</h1>
        <p className="text-slate-500 mt-1">
          {error
            ? "—"
            : `${products.length} products · ${totalAvailable} units available across all warehouses`}
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
          ⚠️ {error}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="font-medium">No products found.</p>
          <p className="text-sm mt-1">Run the seed script to populate the database.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
