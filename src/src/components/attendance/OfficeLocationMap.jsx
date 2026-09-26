import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [20, 0];
const markerIcon = L.icon({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function OfficeLocationMap({ latitude, longitude, onPositionChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onPositionChangeRef = useRef(onPositionChange);

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const hasPosition = Number.isFinite(latitude) && Number.isFinite(longitude);
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true }).setView(hasPosition ? [latitude, longitude] : DEFAULT_CENTER, hasPosition ? 16 : 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    if (hasPosition) addMarker(map, latitude, longitude);
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const point = [latitude, longitude];
    if (!markerRef.current) addMarker(map, latitude, longitude);
    else markerRef.current.setLatLng(point);
    map.setView(point, Math.max(map.getZoom(), 16), { animate: true });
  }, [latitude, longitude]);

  function addMarker(map, lat, lon) {
    const marker = L.marker([lat, lon], { draggable: true, icon: markerIcon }).addTo(map);
    marker.bindPopup('Drag the pin to the office entrance.').openPopup();
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      onPositionChangeRef.current({ latitude: position.lat, longitude: position.lng });
    });
    markerRef.current = marker;
  }

  return <div ref={containerRef} className="office-location-map" aria-label="Interactive office location map" />;
}
