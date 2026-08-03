import { useEffect, useRef, useState } from "react";

type Coordinates = { lat: number; lng: number };
type GoogleListener = { remove?: () => void };
type GoogleLatLng = { lat: () => number; lng: () => number };
type GoogleMap = {
  setCenter: (position: Coordinates) => void;
  setZoom: (zoom: number) => void;
  addListener: (eventName: string, callback: (event: { latLng?: GoogleLatLng }) => void) => GoogleListener;
};
type GoogleMarker = { setPosition: (position: Coordinates) => void; setMap: (map: GoogleMap | null) => void };
type GoogleAutocomplete = {
  addListener: (eventName: string, callback: () => void) => GoogleListener;
  getPlace: () => { geometry?: { location?: GoogleLatLng } };
};
type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: { center: Coordinates; zoom: number; clickableIcons: boolean }) => GoogleMap;
    Marker: new (options: { map: GoogleMap; position: Coordinates }) => GoogleMarker;
    places: { Autocomplete: new (input: HTMLInputElement, options: { fields: string[] }) => GoogleAutocomplete };
  };
};

declare global {
  interface Window { google?: GoogleMapsApi }
}

const DEFAULT_CENTER = { lat: 39.5, lng: -8 };
let googleMapsPromise: Promise<GoogleMapsApi> | null = null;

function loadGoogleMaps(apiKey: string) {
  if (window.google) return Promise.resolve(window.google);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.async = true;
    script.onload = () => window.google ? resolve(window.google) : reject(new Error("A API Google Maps não ficou disponível."));
    script.onerror = () => reject(new Error("Não foi possível carregar o Google Maps."));
    document.head.append(script);
  });
  return googleMapsPromise;
}

const googleMapsLink = ({ lat, lng }: Coordinates) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

export function GoogleMapPicker({ onLocationChange }: { onLocationChange: (url: string) => void }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "error">("loading");

  useEffect(() => { onLocationChangeRef.current = onLocationChange; }, [onLocationChange]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) {
      setStatus("unavailable");
      return;
    }

    let disposed = false;
    let marker: GoogleMarker | null = null;
    let autocompleteListener: GoogleListener | undefined;
    let mapListener: GoogleListener | undefined;

    loadGoogleMaps(apiKey).then((google) => {
      if (disposed || !mapElement.current || !searchInput.current) return;
      const map = new google.maps.Map(mapElement.current, { center: DEFAULT_CENTER, zoom: 6, clickableIcons: false });
      const selectCoordinates = (coordinates: Coordinates) => {
        map.setCenter(coordinates);
        map.setZoom(16);
        if (marker) marker.setPosition(coordinates);
        else marker = new google.maps.Marker({ map, position: coordinates });
        onLocationChangeRef.current(googleMapsLink(coordinates));
      };
      const autocomplete = new google.maps.places.Autocomplete(searchInput.current, { fields: ["geometry"] });
      autocompleteListener = autocomplete.addListener("place_changed", () => {
        const location = autocomplete.getPlace().geometry?.location;
        if (location) selectCoordinates({ lat: location.lat(), lng: location.lng() });
      });
      mapListener = map.addListener("click", (event) => {
        if (event.latLng) selectCoordinates({ lat: event.latLng.lat(), lng: event.latLng.lng() });
      });
      setStatus("ready");
    }).catch(() => { if (!disposed) setStatus("error"); });

    return () => {
      disposed = true;
      autocompleteListener?.remove?.();
      mapListener?.remove?.();
      marker?.setMap(null);
    };
  }, []);

  if (status === "unavailable") return <p className="mock-map-picker__notice">A pesquisa no mapa requer a configuração de Google Maps. Pode colar o link manualmente.</p>;
  if (status === "error") return <p className="mock-map-picker__notice" role="alert">Não foi possível carregar o mapa. Pode colar o link manualmente.</p>;

  return <div className="mock-map-picker">
    <label className="mock-field">Pesquisar localização no mapa
      <input ref={searchInput} type="search" placeholder="Pesquisar morada, local ou coordenadas" disabled={status !== "ready"} />
    </label>
    {status === "loading" && <p className="mock-map-picker__notice">A carregar o mapa…</p>}
    <div className="mock-map-picker__map" ref={mapElement} aria-label="Mapa para selecionar a localização do projeto" />
    <small>Clique no mapa para definir a localização.</small>
  </div>;
}
