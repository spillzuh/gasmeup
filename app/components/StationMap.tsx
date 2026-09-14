"use client";

import { APIProvider, Map, AdvancedMarker, InfoWindow } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";

type Station = {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  price: number | null;
};

export default function StationMap() {
  const [stations, setStations] = useState<Station[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [hoveredStationId, setHoveredStationId] = useState<number | null>(null);
  const [loadingStations, setLoadingStations] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.error("Geolocation not supported by this browser.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.error("Geolocation error:", error.message);
      },
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!userLocation) return;

    async function fetchNearbyStations() {
      setLoadingStations(true);
      try {
        const res = await fetch("/api/stations/nearby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: userLocation!.lat, lng: userLocation!.lng }),
        });
        const json = await res.json();
        setStations(json.stations ?? []);
      } catch (err) {
        console.error("Failed to fetch nearby stations:", err);
      } finally {
        setLoadingStations(false);
      }
    }

    fetchNearbyStations();
  }, [userLocation]);

  function startTrip(station: Station) {
    if (!userLocation) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${station.lat},${station.lng}`;
    window.open(url, "_blank");
  }

  const pricedStations = stations.filter((s) => s.price != null);
  const cheapestPrice =
    pricedStations.length > 0 ? Math.min(...pricedStations.map((s) => s.price!)) : null;

  if (!userLocation) {
    return (
      <div
        style={{
          height: "600px",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#888" }}>Getting your location…</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <div style={{ height: "600px", width: "100%" }}>
        <Map
          defaultCenter={userLocation}
          defaultZoom={14}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID!}
        >
          <AdvancedMarker position={userLocation} title="Your location">
            <div style={{ position: "relative", width: 20, height: 20 }}>
              <div
                style={{
                  position: "absolute",
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  backgroundColor: "rgba(66, 133, 244, 0.3)",
                  animation: "pulse 2s infinite",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 5,
                  left: 5,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: "#4285F4",
                  border: "2px solid white",
                }}
              />
            </div>
          </AdvancedMarker>

            {stations.map((station) => {
            const isCheapest =
              cheapestPrice != null && station.price === cheapestPrice;
            const isHovered = hoveredStationId === station.id;

            return (
              <AdvancedMarker
                key={station.id}
                position={{ lat: station.lat, lng: station.lng }}
                title={station.name}
                onClick={() => setSelectedStation(station)}
              >
                <div
                  className="price-pin-wrapper"
                  onMouseEnter={() => setHoveredStationId(station.id)}
                  onMouseLeave={() => setHoveredStationId(null)}
                >
                  <div className="price-pin-pop">
                    <div
                      className="price-pin-inner"
                      style={{
                        transform: isHovered ? "scale(1.4)" : "scale(1)",
                      }}
                    >
                      {isCheapest && <span className="best-price-label">🏆 Best Price</span>}
                      <div className={`price-pin ${isCheapest ? "price-pin-cheapest" : ""}`}>
                        {station.price != null ? `$${station.price.toFixed(2)}` : "—"}
                      </div>
                      <div
                        className={`price-pin-tail ${isCheapest ? "price-pin-tail-cheapest" : ""}`}
                        style={{ opacity: isHovered ? 0 : 1 }}
                      />                    
                      </div>
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}
          {selectedStation && (
            <InfoWindow
              position={{ lat: selectedStation.lat, lng: selectedStation.lng }}
              onCloseClick={() => setSelectedStation(null)}
            >
              <div style={{ minWidth: 160 }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{selectedStation.name}</p>
                <p style={{ margin: "4px 0", fontSize: 12, color: "#555" }}>
                  {selectedStation.address}
                </p>
                {selectedStation.price != null && (
                  <p style={{ margin: "4px 0", fontWeight: 600 }}>
                    ${selectedStation.price.toFixed(2)} / gal
                  </p>
                )}
                <button
                  onClick={() => startTrip(selectedStation)}
                  style={{
                    marginTop: 6,
                    padding: "6px 12px",
                    background: "#facc15",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Start Trip
                </button>
              </div>
            </InfoWindow>
          )}
        </Map>
      </div>

      {loadingStations && (
        <p style={{ padding: 8, fontSize: 12, color: "#888" }}>Finding nearby stations…</p>
      )}

            <style jsx global>{`
        @keyframes pulse {
          0% {
            transform: scale(0.8);
            opacity: 1;
          }
          100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }

        @keyframes popIn {
          0% {
            transform: scale(0.3) translateY(10px);
            opacity: 0;
          }
          70% {
            transform: scale(1.1) translateY(-2px);
            opacity: 1;
          }
          100% {
            transform: scale(1) translateY(0);
          }
        }

        .price-pin-wrapper {
          cursor: pointer;
        }

        .price-pin-pop {
          animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        .price-pin-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: transform 0.15s ease;
        }

        .best-price-label {
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 2px;
          color: #0e7490;
          text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
        }

        .price-pin {
          background: #22d3ee;
          color: #083344;
          font-weight: 700;
          font-size: 13px;
          padding: 5px 10px;
          border-radius: 10px;
          border: 2px solid #06b6d4;
          box-shadow: 0 2px 8px rgba(6, 182, 212, 0.4);
          white-space: nowrap;
          transition: box-shadow 0.15s ease;
        }

        .price-pin-wrapper:hover .price-pin {
          box-shadow: 0 4px 14px rgba(6, 182, 212, 0.6);
        }

        .price-pin-cheapest {
          background: #22c55e;
          color: #052e16;
          border-color: #15803d;
          box-shadow: 0 2px 10px rgba(21, 128, 61, 0.5);
        }

        .price-pin-wrapper:hover .price-pin-cheapest {
          box-shadow: 0 4px 16px rgba(21, 128, 61, 0.7);
        }

        .price-pin-tail {
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 7px solid #22d3ee;
          transition: opacity 0.15s ease;
        }

        .price-pin-tail-cheapest {
          border-top-color: #22c55e;
        }
      `}</style>
    </APIProvider>
  );
}