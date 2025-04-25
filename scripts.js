// Initial view
const initialView = {
  center: [38.86118, 1.3048135], // Erie County
  zoom: 12,
  bearing: 0
};

// Mapbox access
mapboxgl.accessToken = 'pk.eyJ1IjoibWVyY2Fkb2FubmVtIiwiYSI6ImNtOTF5emdodjA2bDAyam9oeHBmMHpzcmcifQ.Rq1Q0NNdnqalkKmh-0EkhA';

// Create map
const STRmap = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v10',
  center: [-78.8, 42.9], // Erie County center
  zoom: 8
});

// Convert strLocdata to a GeoJSON
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

STRmap.on('load', () => {
  // 🟡 Add county boundaries from counties.js
  STRmap.addSource('county-boundaries', {
    type: 'geojson',
    data: countiesGeoJSON
  });

  // Optional fill
  STRmap.addLayer({
    id: 'county-fill',
    type: 'fill',
    source: 'county-boundaries',
    layout: {},
    paint: {
      'fill-color': '#ADD8E6',
      'fill-opacity': 0.2
    }
  });

  // Border outline
  STRmap.addLayer({
    id: 'county-boundaries-layer',
    type: 'line',
    source: 'county-boundaries',
    paint: {
      'line-color': '#D3D3D3',
      'line-width': 2
    }
  });

  // Add STR GeoJSON source
STRmap.addSource('str-schools', {
  type: 'geojson',
  data: strGeoJSON
});

// Add circle layer for STR points
STRmap.addLayer({
  id: 'str-schools-layer',
  type: 'circle',
  source: 'str-schools',
  paint: {
    'circle-radius': 6,
    'circle-color': '#007cbf',
    'circle-opacity': [
      'interpolate',
      ['linear'],
      ['get', 'str'],
      5, 0.2,     // low STR = faint
      25, 1       // high STR = solid
    ]
  }
});
  

  // 🔁 Return to initial view
  STRmap.on('click', function (e) {
    if (!e.originalEvent.target.closest('.custom-marker')) {
      STRmap.flyTo({
        center: initialView.center,
        zoom: initialView.zoom,
        bearing: initialView.bearing,
        speed: 1.2,
        curve: 1
      });
    }
  });
});
