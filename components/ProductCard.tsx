"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StockBadge } from "./StockBadge";
import { formatPrice } from "@/lib/utils";

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

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(
    product.stocks.find((s) => s.available > 0)?.warehouseId ?? product.stocks[0]?.warehouseId ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = product.stocks.find((s) => s.warehouseId === selectedWarehouse);
  const canReserve = selected && selected.available > 0;

  async function handleReserve() {
    if (!selected || !canReserve) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `${product.id}-${selectedWarehouse}-${Date.now()}`,
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouse,
          quantity: 1,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError("Not enough stock — someone just grabbed the last unit!");
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Failed to reserve. Please try again.");
        return;
      }

      router.push(`/reservation/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      {/* Image */}
      <div className="relative h-48 bg-slate-50 overflow-hidden">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300 text-4xl">📦</div>
        )}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-slate-500 text-xs font-mono px-2 py-1 rounded-md">
          {product.sku}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="font-semibold text-slate-900 text-lg leading-snug">{product.name}</h3>
          {product.description && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{product.description}</p>
          )}
        </div>

        <div className="text-2xl font-bold text-slate-900">{formatPrice(product.price)}</div>

        {/* Warehouse selector */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Select Warehouse</p>
          <div className="flex flex-col gap-1.5">
            {product.stocks.map((stock) => (
              <label
                key={stock.warehouseId}
                className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  selectedWarehouse === stock.warehouseId
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`warehouse-${product.id}`}
                    value={stock.warehouseId}
                    checked={selectedWarehouse === stock.warehouseId}
                    onChange={() => setSelectedWarehouse(stock.warehouseId)}
                    className="accent-indigo-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{stock.warehouseName}</p>
                    <p className="text-xs text-slate-400">{stock.warehouseLocation}</p>
                  </div>
                </div>
                <StockBadge available={stock.available} />
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={handleReserve}
          disabled={!canReserve || loading}
          className={`mt-auto w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all duration-150 ${
            canReserve && !loading
              ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md active:scale-95"
              : "bg-slate-100 text-slate-400 cursor-not-allowed"
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Reserving…
            </span>
          ) : canReserve ? (
            "Reserve Now"
          ) : (
            "Out of Stock"
          )}
        </button>
      </div>
    </div>
  );
}
