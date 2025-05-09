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
  style: 'mapbox://styles/mapbox/dark-v11',
  center: initialView.center,
  zoom: initialView.zoom,
  bearing: initialView.bearing,
  maxBounds: [[-180, 10], [-60, 72]]
});

// Convert strLocdata to GeoJSON with STR validation
const strGeoJSON = {
  type: "FeatureCollection",
  features: strLocdata
    .filter(record => !isNaN(parseFloat(record.STR)))
    .map(record => ({
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

STRmap.on('load', () => {

  // --- State boundaries ---
  if (typeof statesGeoJSON === 'undefined') {
    console.error("statesGeoJSON is not defined!");
    return;
  }

  STRmap.addSource('state-boundaries', { 
    type: 'geojson', 
    data: statesGeoJSON 
  });

  STRmap.addLayer({
    id: 'state-fill',
    type: 'fill',
    source: 'state-boundaries',
    paint: {
      'fill-color': '#d8e1ef',
      'fill-opacity': 0.2
    }
  });

  STRmap.addLayer({
    id: 'state-boundaries-outline',
    type: 'line',
    source: 'state-boundaries',
    paint: {
      'line-color': '#DF19FB',
      'line-width': 2
    }
  });

  // Fit to state boundaries - fixed to use statesGeoJSON instead of stateGeoJSON
  try {
    const stateBounds = statesGeoJSON.features.reduce((b, feature) => {
      const coords = feature.geometry.coordinates.flat(2);
      return coords.reduce(
        (bb, coord) => bb.extend(coord),
        b || new mapboxgl.LngLatBounds(coord, coord)
      );
    }, null);
    
    if (stateBounds) {
      STRmap.fitBounds(stateBounds, { padding: 40 });
    } else {
      console.warn("Could not calculate state bounds");
    }
  } catch (error) {
    console.error("Error calculating state bounds:", error);
  }

  // --- STR school points ---
  STRmap.addSource('str-schools', { type: 'geojson', data: strGeoJSON });
  STRmap.addLayer({
    id: 'str-schools-layer',
    type: 'circle',
    source: 'str-schools',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2, 12, 8],
      'circle-color': '#007cbf',
      'circle-opacity': ['interpolate', ['linear'], ['get', 'str'], 5, 0.2, 25, 1]
    }
  });

  // --- County boundaries (initially hidden) ---
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

  // --- Highlight selected county ---
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

  // --- Hover popup for schools ---
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

  // --- Click on a county to highlight ---
  STRmap.on('click', 'county-fill', (e) => {
    const feature = e.features[0];
    STRmap.getSource('selected-county').setData(feature);
    STRmap.setLayoutProperty('selected-county-highlight', 'visibility', 'visible');

    const coords = feature.geometry.coordinates.flat(2);
    const bounds = coords.reduce(
      (b, coord) => b.extend(coord),
      new mapboxgl.LngLatBounds(coords[0], coords[0])
    );
    STRmap.fitBounds(bounds, { padding: 40, duration: 1000 });
  });

  STRmap.on('mouseenter', 'county-fill', () => {
    STRmap.getCanvas().style.cursor = 'pointer';
  });

  STRmap.on('mouseleave', 'county-fill', () => {
    STRmap.getCanvas().style.cursor = '';
  });

  // --- Background click to reset view ---
  STRmap.on('click', (e) => {
    const features = STRmap.queryRenderedFeatures(e.point, {
      layers: ['str-schools-layer', 'county-fill']
    });

    if (!features.length) {
      STRmap.flyTo({ center: initialView.center, zoom: initialView.zoom, bearing: initialView.bearing });
      STRmap.setLayoutProperty('county-fill', 'visibility', 'none');
      STRmap.setLayoutProperty('county-boundaries-layer', 'visibility', 'none');
      STRmap.setLayoutProperty('selected-county-highlight', 'visibility', 'none');
      STRmap.getSource('selected-county').setData({ type: 'FeatureCollection', features: [] });

      const geocoderInput = document.querySelector('.mapboxgl-ctrl-geocoder input');
      if (geocoderInput) geocoderInput.value = '';
    }
  });

});