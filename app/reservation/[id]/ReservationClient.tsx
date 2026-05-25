"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Countdown } from "@/components/Countdown";
import { formatPrice } from "@/lib/utils";

interface Reservation {
  id: string;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  quantity: number;
  expiresAt: string;
  confirmedAt?: string | null;
  releasedAt?: string | null;
  product: {
    id: string;
    name: string;
    sku: string;
    price: string;
    imageUrl?: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}

interface Props {
  reservationId: string;
}

export function ReservationClient({ reservationId }: Props) {
  const router = useRouter();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations?id=${reservationId}`);
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error ?? "Reservation not found");
        return;
      }
      setReservation(data);
    } catch {
      setFetchError("Failed to load reservation");
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  async function handleConfirm() {
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/reservations/${reservationId}/confirm`, {
        method: "POST",
        headers: {
          "Idempotency-Key": `confirm-${reservationId}`,
        },
      });

      const data = await res.json();

      if (res.status === 410) {
        setError("Your reservation expired before we could confirm it. Units have been released.");
        await fetchReservation();
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Failed to confirm. Please try again.");
        return;
      }

      await fetchReservation();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/reservations/${reservationId}/release`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to cancel.");
        return;
      }

      await fetchReservation();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading reservation…
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-4xl mb-4">❌</p>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Reservation Not Found</h2>
        <p className="text-slate-500 mb-6">{fetchError}</p>
        <button
          onClick={() => router.push("/")}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
        >
          Back to Products
        </button>
      </div>
    );
  }

  if (!reservation) return null;

  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";
  const isPending = reservation.status === "PENDING";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Breadcrumb */}
      <button
        onClick={() => router.push("/")}
        className="text-sm text-slate-400 hover:text-slate-600 mb-8 flex items-center gap-1 transition-colors"
      >
        ← Back to products
      </button>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Status banner */}
        <div
          className={`px-6 py-4 ${
            isConfirmed
              ? "bg-emerald-50 border-b border-emerald-100"
              : isReleased
              ? "bg-slate-50 border-b border-slate-100"
              : "bg-indigo-50 border-b border-indigo-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {isConfirmed ? "✅" : isReleased ? "🔓" : "⏳"}
            </span>
            <div>
              <p className="font-semibold text-slate-900">
                {isConfirmed
                  ? "Purchase Confirmed!"
                  : isReleased
                  ? "Reservation Cancelled"
                  : "Item Reserved — Complete Your Purchase"}
              </p>
              <p className="text-sm text-slate-500">
                Reservation ID:{" "}
                <span className="font-mono text-xs">{reservation.id}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Product info */}
          <div className="flex gap-4">
            {reservation.product.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={reservation.product.imageUrl}
                alt={reservation.product.name}
                className="w-24 h-24 rounded-xl object-cover border border-slate-100"
              />
            )}
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-slate-900">
                {reservation.product.name}
              </h2>
              <p className="text-sm text-slate-400 font-mono mt-0.5">
                SKU: {reservation.product.sku}
              </p>
              <div className="mt-2 flex items-center gap-4 text-sm text-slate-600">
                <span>📍 {reservation.warehouse.name}</span>
                <span>Qty: {reservation.quantity}</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {formatPrice(reservation.product.price)}
              </p>
            </div>
          </div>

          {/* Countdown — only show if pending */}
          {isPending && (
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
              <Countdown
                expiresAt={reservation.expiresAt}
                onExpire={fetchReservation}
              />
            </div>
          )}

          {/* Confirmation details */}
          {isConfirmed && (
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-sm text-emerald-700">
              <p className="font-semibold mb-1">Order confirmed</p>
              <p>
                Confirmed at:{" "}
                {reservation.confirmedAt
                  ? new Date(reservation.confirmedAt).toLocaleString()
                  : "—"}
              </p>
            </div>
          )}

          {isReleased && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-sm text-slate-600">
              <p className="font-semibold mb-1">Reservation released</p>
              <p>Units have been returned to inventory and are available again.</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              ⚠️ {error}
            </div>
          )}

          {/* Actions */}
          {isPending && (
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={actionLoading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 px-6 rounded-xl transition-colors active:scale-95"
              >
                {actionLoading ? "Processing…" : "Confirm Purchase"}
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="flex-1 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-semibold py-3 px-6 rounded-xl border border-slate-200 transition-colors active:scale-95"
              >
                Cancel
              </button>
            </div>
          )}

          {(isConfirmed || isReleased) && (
            <button
              onClick={() => router.push("/")}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Back to Products
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
