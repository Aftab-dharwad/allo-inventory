import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Called by Vercel Cron every minute: { "crons": [{ "path": "/api/cron/expire-reservations", "schedule": "* * * * *" }] }
export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find all expired PENDING reservations
    const expired = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: now },
      },
      select: { id: true, stockId: true, quantity: true },
    });

    if (expired.length === 0) {
      return NextResponse.json({ released: 0, message: "No expired reservations" });
    }

    // Release each in a transaction
    let released = 0;
    for (const reservation of expired) {
      try {
        await prisma.$transaction([
          prisma.stock.update({
            where: { id: reservation.stockId },
            data: { reserved: { decrement: reservation.quantity } },
          }),
          prisma.reservation.update({
            where: { id: reservation.id },
            data: { status: "RELEASED", releasedAt: now },
          }),
        ]);
        released++;
      } catch (err) {
        console.error(`Failed to release reservation ${reservation.id}:`, err);
      }
    }

    console.log(`Cron: Released ${released}/${expired.length} expired reservations`);
    return NextResponse.json({ released, total: expired.length });
  } catch (error) {
    console.error("Cron expire-reservations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
