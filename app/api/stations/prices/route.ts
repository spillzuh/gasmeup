import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { stationIds, fuelType = "regular" } = await req.json();

  if (!Array.isArray(stationIds) || stationIds.length === 0) {
    return NextResponse.json({ prices: {} });
  }

  const { data: prices, error } = await supabase
    .from("price_submissions")
    .select("station_id, price, source, submitted_at")
    .in("station_id", stationIds)
    .eq("fuel_type", fuelType)
    .order("submitted_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const priceMap: Record<number, number | null> = {};
  for (const id of stationIds) {
    const userPrice = prices?.find((p) => p.station_id === id && p.source === "user");
    const googlePrice = prices?.find((p) => p.station_id === id && p.source === "google");
    const best = userPrice ?? googlePrice;
    priceMap[id] = best ? best.price : null;
  }

  return NextResponse.json({ prices: priceMap });
}