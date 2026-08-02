import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleMapPicker } from "./GoogleMapPicker";

describe("GoogleMapPicker", () => {
  afterEach(() => {
    delete window.google;
    vi.unstubAllEnvs();
  });

  it("allows a manual Google Maps link when no key is configured", () => {
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "");
    render(<GoogleMapPicker onLocationChange={vi.fn()} />);
    expect(screen.getByText(/pode colar o link manualmente/i)).toBeInTheDocument();
  });

  it("writes a canonical Google Maps link when the map is clicked", async () => {
    let onMapClick: ((event: { latLng?: { lat: () => number; lng: () => number } }) => void) | undefined;
    class FakeMap {
      setCenter = vi.fn();
      setZoom = vi.fn();
      addListener(eventName: string, callback: (event: { latLng?: { lat: () => number; lng: () => number } }) => void) {
        if (eventName === "click") onMapClick = callback;
        return { remove: vi.fn() };
      }
    }
    class FakeMarker { setPosition = vi.fn(); setMap = vi.fn(); }
    class FakeAutocomplete {
      addListener = vi.fn(() => ({ remove: vi.fn() }));
      getPlace = vi.fn(() => ({}));
    }
    window.google = {
      maps: { Map: FakeMap, Marker: FakeMarker, places: { Autocomplete: FakeAutocomplete } }
    } as never;
    vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
    const onLocationChange = vi.fn();

    render(<GoogleMapPicker onLocationChange={onLocationChange} />);
    await waitFor(() => expect(screen.getByLabelText("Pesquisar localização no mapa")).toBeEnabled());
    act(() => onMapClick?.({ latLng: { lat: () => 38.7223, lng: () => -9.1393 } }));

    expect(onLocationChange).toHaveBeenCalledWith("https://www.google.com/maps/search/?api=1&query=38.7223,-9.1393");
  });
});
