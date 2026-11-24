import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useFetch } from "@/hooks/useFetch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Clock,
  Phone,
  Mail,
  Navigation,
  ExternalLink,
  Loader2,
  AlertTriangle,
} from "lucide-react";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const MAPBOX_STYLE = import.meta.env.VITE_MAPBOX_STYLE || "mapbox://styles/mapbox/streets-v12";

// Default cafe coordinates (Mapbox uses [lng, lat] order)
const DEFAULT_LNG = 123.18631853657558;
const DEFAULT_LAT = 13.627225580837424;

function FallbackCard({ cafeInfo }) {
  const lat = cafeInfo?.latitude || DEFAULT_LAT;
  const lng = cafeInfo?.longitude || DEFAULT_LNG;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  return (
    <Card className="overflow-hidden">
      <div className="bg-latte/50 p-8 text-center space-y-4">
        <MapPin className="h-12 w-12 text-caramel mx-auto" />
        <h3 className="font-heading text-xl font-semibold text-espresso">Visit Us</h3>
        <p className="text-muted-foreground text-sm">
          {cafeInfo?.address || "[ADDRESS]"}
        </p>
        <Button asChild>
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
            <Navigation className="h-4 w-4" />
            Get Directions
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </div>
    </Card>
  );
}

export default function MapSection() {
  const { data: cafeInfo, loading: cafeLoading } = useFetch("/api/cafe/info/");
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [directionsState, setDirectionsState] = useState({
    loading: false,
    error: null,
    distance: null,
    duration: null,
  });

  const cafeLng = cafeInfo?.longitude && cafeInfo.longitude !== "[LNG]"
    ? parseFloat(cafeInfo.longitude)
    : DEFAULT_LNG;
  const cafeLat = cafeInfo?.latitude && cafeInfo.latitude !== "[LAT]"
    ? parseFloat(cafeInfo.latitude)
    : DEFAULT_LAT;

  // Initialize map
  useEffect(() => {
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === "pk.your_public_token_here") {
      setMapError(true);
      return;
    }
    if (mapRef.current || !mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    try {
      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style: MAPBOX_STYLE,
        center: [cafeLng, cafeLat],
        zoom: 15.5,
        attributionControl: true,
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      // Disable scroll zoom until focused (prevent scroll trapping)
      map.scrollZoom.disable();
      mapContainer.current.addEventListener("focus", () => map.scrollZoom.enable());
      mapContainer.current.addEventListener("blur", () => map.scrollZoom.disable());

      // On touch devices, require two-finger pan
      map.dragPan.enable();
      if ("ontouchstart" in window) {
        // Cooperative gestures: show hint on single-finger
        map.touchZoomRotate.enable();
      }

      // Custom HTML marker
      const markerEl = document.createElement("div");
      markerEl.className = "catopia-map-marker";
      markerEl.setAttribute("tabindex", "0");
      markerEl.setAttribute("role", "button");
      markerEl.setAttribute("aria-label", "Catopia Café location");
      markerEl.innerHTML = `
        <div style="
          width: 48px; height: 48px;
          background: #D4883E;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(61,43,31,0.3);
          border: 3px solid white;
          cursor: pointer;
        ">
          <span style="
            transform: rotate(45deg);
            font-size: 20px;
            line-height: 1;
          ">🐾</span>
        </div>
      `;

      // Build popup using DOM nodes
      const popupContent = document.createElement("div");
      popupContent.style.cssText = "font-family: Inter, sans-serif;";

      const popupTitle = document.createElement("h3");
      popupTitle.textContent = cafeInfo?.name || "Catopia Café";
      popupTitle.style.cssText = "font-weight: 700; font-size: 14px; color: #3D2B1F; margin: 0 0 4px;";
      popupContent.appendChild(popupTitle);

      const popupAddr = document.createElement("p");
      popupAddr.textContent = cafeInfo?.address || "[ADDRESS]";
      popupAddr.style.cssText = "font-size: 12px; color: #8B7355; margin: 0;";
      popupContent.appendChild(popupAddr);

      const popup = new mapboxgl.Popup({ offset: 25, closeOnClick: false })
        .setDOMContent(popupContent);

      const marker = new mapboxgl.Marker({ element: markerEl })
        .setLngLat([cafeLng, cafeLat])
        .setPopup(popup)
        .addTo(map);

      markerRef.current = marker;
      mapRef.current = map;

      map.on("load", () => setMapReady(true));
      map.on("error", () => setMapError(true));
    } catch {
      setMapError(true);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [cafeLng, cafeLat, cafeInfo]);

  // Get Directions handler
  const handleGetDirections = useCallback(async () => {
    if (!mapRef.current) return;

    setDirectionsState({ loading: true, error: null, distance: null, duration: null });

    // 1. Request user location
    if (!navigator.geolocation) {
      setDirectionsState({
        loading: false,
        error: "Geolocation is not supported by your browser.",
        distance: null,
        duration: null,
      });
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const userLng = position.coords.longitude;
      const userLat = position.coords.latitude;

      // 2. Fetch driving route from Mapbox Directions API
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${userLng},${userLat};${cafeLng},${cafeLat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Directions request failed");
      const data = await res.json();

      if (!data.routes || data.routes.length === 0) {
        throw new Error("No route found");
      }

      const route = data.routes[0];
      const distanceKm = (route.distance / 1000).toFixed(1);
      const durationMin = Math.round(route.duration / 60);

      // 3. Draw route on map
      const map = mapRef.current;
      if (map.getSource("route")) {
        map.getSource("route").setData({
          type: "Feature",
          geometry: route.geometry,
        });
      } else {
        map.addLayer({
          id: "route",
          type: "line",
          source: {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: route.geometry,
            },
          },
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#D4883E",
            "line-width": 4,
            "line-opacity": 0.8,
          },
        });
      }

      // Fit map to route bounds
      const coordinates = route.geometry.coordinates;
      const bounds = coordinates.reduce(
        (b, coord) => b.extend(coord),
        new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });

      setDirectionsState({
        loading: false,
        error: null,
        distance: distanceKm,
        duration: durationMin,
      });
    } catch (err) {
      const isPermissionDenied = err?.code === 1;
      setDirectionsState({
        loading: false,
        error: isPermissionDenied
          ? "Location access was denied."
          : err.message || "Could not get directions.",
        distance: null,
        duration: null,
      });
    }
  }, [cafeLng, cafeLat]);

  const directionsGoogleUrl = `https://www.google.com/maps/dir/?api=1&destination=${cafeLat},${cafeLng}`;
  const openHour = cafeInfo?.opening_hour ?? 10;
  const closeHour = cafeInfo?.closing_hour ?? 21;
  const formatHour = (h) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:00 ${ampm}`;
  };

  if (cafeLoading) {
    return (
      <section id="visit-us" className="bg-cream py-16 md:py-20 scroll-mt-20">
        <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6">
          <div className="text-center mb-10">
            <Skeleton className="h-4 w-20 mx-auto mb-2" />
            <Skeleton className="h-9 w-48 mx-auto" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-80 rounded-[var(--radius-xl)]" />
            <Skeleton className="h-80 rounded-[var(--radius-xl)]" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="visit-us" className="bg-cream py-16 md:py-20 scroll-mt-20">
      <div className="mx-auto max-w-[var(--container-lg)] px-4 md:px-6">
        <div className="text-center mb-10">
          <p className="section-subtitle mb-2">Visit Us</p>
          <h2 className="section-title">Find Us</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Map */}
          {mapError ? (
            <FallbackCard cafeInfo={cafeInfo} />
          ) : (
            <div
              ref={mapContainer}
              tabIndex={0}
              className="h-80 md:h-96 rounded-[var(--radius-xl)] overflow-hidden shadow-lg focus:ring-2 focus:ring-caramel focus:ring-offset-2 outline-none"
              role="application"
              aria-label="Interactive map showing Catopia Café location"
            />
          )}

          {/* Info card */}
          <Card className="flex flex-col justify-between">
            <CardContent className="p-6 space-y-5">
              <h3 className="font-heading text-xl font-semibold text-espresso">
                {cafeInfo?.name || "Catopia Café"}
              </h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-caramel shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-espresso">Address</p>
                    <p className="text-sm text-muted-foreground">
                      {cafeInfo?.address || "[ADDRESS]"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-caramel shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-espresso">Daily Hours</p>
                    <p className="text-sm text-muted-foreground">
                      {formatHour(openHour)} – {formatHour(closeHour)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-caramel shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-espresso">Phone</p>
                    <p className="text-sm text-muted-foreground">
                      {cafeInfo?.phone || "[PHONE]"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-caramel shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-espresso">Email</p>
                    <p className="text-sm text-muted-foreground">
                      {cafeInfo?.email || "[EMAIL]"}
                    </p>
                  </div>
                </div>

                {/* Directions result */}
                {directionsState.distance && (
                  <div className="rounded-[var(--radius-md)] bg-status-paid-bg p-3 text-sm">
                    <p className="font-medium text-status-paid">
                      {directionsState.distance} km · ~{directionsState.duration} min drive
                    </p>
                  </div>
                )}

                {directionsState.error && (
                  <div className="rounded-[var(--radius-md)] bg-status-pending-bg p-3 text-sm space-y-2">
                    <p className="flex items-center gap-2 text-status-pending font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      {directionsState.error}
                    </p>
                    <a
                      href={directionsGoogleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-caramel hover:underline"
                    >
                      Open in Google Maps <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </CardContent>

            <div className="p-6 pt-0">
              <Button
                className="w-full"
                onClick={handleGetDirections}
                disabled={directionsState.loading || mapError}
              >
                {directionsState.loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
                {directionsState.loading ? "Getting directions..." : "Get Directions"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
