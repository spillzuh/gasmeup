import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

const CENTER_LAT = 25.7617;
const CENTER_LNG = -80.1918;
const RADIUS_METERS = 8046; // ~5 miles

type FuelType = "regular" | "mid" | "premium";

function mapFuelType(googleType: string): FuelType | null {
  if (googleType === "REGULAR_UNLEADED") return "regular";
  if (googleType === "MIDGRADE") return "mid";
  if (googleType === "PREMIUM") return "premium";
  return null;
}

async function seed() {
  console.log("Fetching gas stations from Google Places...");

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
            center: { latitude: CENTER_LAT, longitude: CENTER_LNG },
            radius: RADIUS_METERS,
          },
        },
      }),
    }
  );

  const data = await response.json();

  if (!data.places) {
    console.error("No places returned. Full response:", data);
    return;
  }

  console.log(`Found ${data.places.length} stations. Processing...`);

  for (const place of data.places) {
    const { data: existing } = await supabase
      .from("stations")
      .select("id")
      .eq("google_place_id", place.id)
      .limit(1)
      .maybeSingle();

    let station = existing;

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
      console.log(`Inserted station: ${place.displayName?.text}`);
    } else {
      console.log(`Station already exists: ${place.displayName?.text} (checking prices...)`);
    }

    const { data: existingPrices } = await supabase
      .from("price_submissions")
      .select("id")
      .eq("station_id", station.id)
      .limit(1);

    if (existingPrices && existingPrices.length > 0) {
      console.log(`  Prices already exist, skipping.`);
      continue;
    }

    console.log(`  RAW fuelOptions:`, JSON.stringify(place.fuelOptions));
    const fuelPrices = place.fuelOptions?.fuelPrices ?? [];
    console.log(`  -> ${fuelPrices.length} fuel prices found`);

    for (const fp of fuelPrices) {
      const fuelType = mapFuelType(fp.type);
      if (!fuelType) continue;

      const price = Number(fp.price.units) + (fp.price.nanos ?? 0) / 1_000_000_000;

      const { error: priceError } = await supabase
        .from("price_submissions")
        .insert({
          station_id: station.id,
          user_id: null,
          price,
          fuel_type: fuelType,
          source: "google",
        });

      if (priceError) {
        console.error("Failed to insert price:", priceError.message);
      } else {
        console.log(`  -> ${fuelType}: $${price.toFixed(2)}`);
      }
    }
  }

  console.log("Seeding complete.");
}

seed();