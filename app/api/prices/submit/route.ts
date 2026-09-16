import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "You must be signed in to submit a price." }, { status: 401 });
  }

  const { stationId, price, fuelType } = await req.json();

  if (typeof stationId !== "number" || typeof price !== "number" || !fuelType) {
    return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
  }

  if (!["regular", "mid", "premium"].includes(fuelType)) {
    return NextResponse.json({ error: "Invalid fuel type." }, { status: 400 });
  }

  if (price <= 0 || price > 20) {
    return NextResponse.json({ error: "Price out of expected range." }, { status: 400 });
  }

  const { error } = await supabase.from("price_submissions").insert({
    station_id: stationId,
    user_id: session.user.email,
    price,
    fuel_type: fuelType,
    source: "user",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}