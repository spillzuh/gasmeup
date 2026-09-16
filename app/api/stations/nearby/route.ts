import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

type FuelType = "regular" | "mid" | "premium";

function mapFuelType(googleType: string): FuelType | null {
  if (googleType === "REGULAR_UNLEADED") return "regular";
  if (googleType === "MIDGRADE") return "mid";
  if (googleType === "PREMIUM") return "premium";
  return null;
}

export async function POST(req: NextRequest) {
  const { lat, lng, radiusMeters = 8046, fuelType = "regular" } = await req.json();

  if (!["regular", "mid", "premium"].includes(fuelType)) {
    return NextResponse.json({ error: "Invalid fuel type" }, { status: 400 });
  }

  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_API_KEY,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.fuelOptions",
      },
      body: JSON.stringify({
        includedTypes: ["gas_station"],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radiusMeters,
          },
        },
      }),
    }
  );

  const data = await response.json();

  if (data.places) {
    console.log(`Google returned ${data.places.length} places`);

    for (const place of data.places) {
      const { data: existing } = await supabase
        .from("stations")
        .select("id")
        .eq("google_place_id", place.id)
        .limit(1)
        .maybeSingle();

      let station = existing;

      if (station) {
        const { data: existingPrices } = await supabase
          .from("price_submissions")
          .select("id")
          .eq("station_id", station.id)
          .limit(1);

        if (existingPrices && existingPrices.length > 0) {
          console.log(`SKIP (already has prices): ${place.displayName?.text}`);
          continue;
        }
        console.log(`Station exists but no prices, backfilling: ${place.displayName?.text}`);
      }

      if (!station) {
        const { data: newStation, error: stationError } = await supabase
          .from("stations")
          .insert({
            name: place.displayName?.text ?? "Unknown Station",
            address: place.formattedAddress ?? "",
            lat: place.location?.latitude,
            lng: place.location?.longitude,
            google_place_id: place.id,
          })
          .select()
          .single();

        if (stationError || !newStation) {
          console.error("Failed to insert station:", stationError?.message);
          continue;
        }

        station = newStation;
        console.log(`NEW station: ${place.displayName?.text}`);
      }

      const fuelPrices = place.fuelOptions?.fuelPrices ?? [];
      console.log(`  -> ${fuelPrices.length} fuel prices found for ${station.name ?? place.displayName?.text}`);

      for (const fp of fuelPrices) {
        const fuelType = mapFuelType(fp.type);
        if (!fuelType) continue;

        const price = Number(fp.price.units) + (fp.price.nanos ?? 0) / 1_000_000_000;

        const { error: priceError } = await supabase.from("price_submissions").insert({
          station_id: station.id,
          user_id: null,
          price,
          fuel_type: fuelType,
          source: "google",
        });

        if (priceError) {
          console.error(`  price insert failed:`, priceError.message);
        } else {
          console.log(`  inserted ${fuelType}: $${price.toFixed(2)}`);
        }
      }
    }
  }

  const latDelta = radiusMeters / 111320;
  const lngDelta = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));

  const { data: stations, error } = await supabase
    .from("stations")
    .select("id, name, address, lat, lng")
    .gte("lat", lat - latDelta)
    .lte("lat", lat + latDelta)
    .gte("lng", lng - lngDelta)
    .lte("lng", lng + lngDelta);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stations: stations ?? [] });
}