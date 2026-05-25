import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const reservation = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          stock_id: string;
          quantity: number;
        }>
      >`
        SELECT id, status, stock_id, quantity
        FROM reservations
        WHERE id = ${id}
        FOR UPDATE
      `;

      if (!reservation.length) {
        return { error: "Reservation not found", statusCode: 404 };
      }

      const res = reservation[0];

      if (res.status !== "PENDING") {
        return {
          error: `Cannot release a reservation with status: ${res.status.toLowerCase()}`,
          statusCode: 409,
        };
      }

      await tx.stock.update({
        where: { id: res.stock_id },
        data: { reserved: { decrement: res.quantity } },
      });

      const updated = await tx.reservation.update({
        where: { id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });

      return {
        data: {
          id: updated.id,
          status: updated.status,
          releasedAt: updated.releasedAt,
        },
        statusCode: 200,
      };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error(`POST /api/reservations/${id}/release error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
