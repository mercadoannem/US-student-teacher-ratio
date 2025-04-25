// Initial map view
const initialView = {
  center: [-98.36754, 39.32436],
  zoom: 3.5,
  bearing: 0
};

// Access token
mapboxgl.accessToken = 'pk.eyJ1IjoibWVyY2Fkb2FubmVtIiwiYSI6ImNtOTF5emdodjA2bDAyam9oeHBmMHpzcmcifQ.Rq1Q0NNdnqalkKmh-0EkhA';

// Create map
const STRmap = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v10',
  center: initialView.center,
  zoom: initialView.zoom,
  bearing: initialView.bearing,
  maxBounds: [[-180, 10], [-60, 72]] // Limit view to US bounding box
});

// Convert strLocdata to GeoJSON
const strGeoJSON = {
  type: "FeatureCollection",
  features: strLocdata.map(record => ({
    type: "Feature",
    properties: {
      school: record["School Name"],
      county: record["County Name"],
      str: parseFloat(record.STR)
    },
    geometry: {
      type: "Point",
      coordinates: [record.X, record.Y]
    }
  }))
};

// Add geocoder
const geocoder = new MapboxGeocoder({
  accessToken: mapboxgl.accessToken,
  mapboxgl: mapboxgl,
  countries: 'us',
  types: 'region',
  placeholder: 'Search for a state...',
  clearOnBlur: true
});

// Layers and controls
STRmap.on('load', () => {
  // Append geocoder manually
  document.getElementById('geocoder').appendChild(geocoder.onAdd(STRmap));

  // Add STR school circles
  STRmap.addSource('str-schools', { type: 'geojson', data: strGeoJSON });

  STRmap.addLayer({
    id: 'str-schools-layer',
    type: 'circle',
    source: 'str-schools',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        5, 2, 12, 8
      ],
      'circle-color': '#007cbf',
      'circle-opacity': ['interpolate', ['linear'], ['get', 'str'], 5, 0.2, 25, 1]
    }
  });

  // Add counties (initially hidden)
  STRmap.addSource('county-boundaries', { type: 'geojson', data: countiesGeoJSON });
  STRmap.addLayer({
    id: 'county-fill',
    type: 'fill',
    source: 'county-boundaries',
    layout: { visibility: 'none' },
    paint: { 'fill-color': '#ADD8E6', 'fill-opacity': 0.2 }
  });
  STRmap.addLayer({
    id: 'county-boundaries-layer',
    type: 'line',
    source: 'county-boundaries',
    layout: { visibility: 'none' },
    paint: {
      'line-color': '#D3D3D3',
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 2.5]
    }
  });

  // Highlight selected county
  STRmap.addSource('selected-county', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });
  STRmap.addLayer({
    id: 'selected-county-highlight',
    type: 'line',
    source: 'selected-county',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#ff6600', 'line-width': 3 }
  });

  // Hover effect for STR markers
  let popup;
  STRmap.on('mouseenter', 'str-schools-layer', (e) => {
    const props = e.features[0].properties;
    popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
      .setLngLat(e.lngLat)
      .setHTML(`<strong>${props.school}</strong><br>County: ${props.county}<br>STR: ${props.str}`)
      .addTo(STRmap);
    STRmap.getCanvas().style.cursor = 'pointer';
  });
  STRmap.on('mouseleave', 'str-schools-layer', () => {
    if (popup) popup.remove();
    STRmap.getCanvas().style.cursor = '';
  });

  // Click on a county
  STRmap.on('click', 'county-fill', (e) => {
    const feature = e.features[0];
    STRmap.getSource('selected-county').setData(feature);
    const coords = feature.geometry.coordinates[0];
    const bounds = coords.reduce((b, coord) => b.extend(coord), new mapboxgl.LngLatBounds(coords[0], coords[0]));
    STRmap.fitBounds(bounds, { padding: 40, duration: 1000 });
  });

  STRmap.on('mouseenter', 'county-fill', () => {
    STRmap.getCanvas().style.cursor = 'pointer';
  });
  STRmap.on('mouseleave', 'county-fill', () => {
    STRmap.getCanvas().style.cursor = '';
  });

  // When a state is selected via geocoder
  geocoder.on('result', (e) => {
    if (e.result.bbox) {
      STRmap.fitBounds(e.result.bbox, { padding: 40, duration: 1000 });
    } else {
      STRmap.flyTo({ center: e.result.center, zoom: 6, speed: 1.2, curve: 1 });
    }

    // Show county layers
    STRmap.setLayoutProperty('county-fill', 'visibility', 'visible');
    STRmap.setLayoutProperty('county-boundaries-layer', 'visibility', 'visible');
    STRmap.setLayoutProperty('selected-county-highlight', 'visibility', 'visible');
  });

  // Reset map to initial view on background click
  STRmap.on('click', (e) => {
    const features = STRmap.queryRenderedFeatures(e.point, {
      layers: ['str-schools-layer', 'county-fill']
    });

    if (!features.length) {
      STRmap.flyTo({ center: initialView.center, zoom: initialView.zoom, bearing: initialView.bearing });

      // Hide counties
      STRmap.setLayoutProperty('county-fill', 'visibility', 'none');
      STRmap.setLayoutProperty('county-boundaries-layer', 'visibility', 'none');
      STRmap.setLayoutProperty('selected-county-highlight', 'visibility', 'none');

      // Clear county selection
      STRmap.getSource('selected-county').setData({ type: 'FeatureCollection', features: [] });

      // Reset geocoder input
      document.querySelector('.mapboxgl-ctrl-geocoder input').value = '';
    }
  });
});