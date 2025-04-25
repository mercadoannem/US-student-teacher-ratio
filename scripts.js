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
  bearing: initialView.bearing
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
  render: function (item) {
    let maki = '';
    switch (item.id.split('.')[0]) {
      case 'address':
        maki = 'building';
        break;
      case 'locality':
      case 'place':
      case 'neighborhood':
        maki = 'city';
        break;
      default:
        maki = 'marker';
    }
    return `<div class='geocoder-dropdown-item'>
      <img class='geocoder-dropdown-icon' src='https://unpkg.com/@mapbox/maki@6.1.0/icons/${maki}-15.svg'>
      <span class='geocoder-dropdown-text'>${item.text}</span>
    </div>`;
  },
  mapboxgl: mapboxgl,
  countries: 'us',      // Limit to U.S.
  types: 'region', // Place
});

// Add layers
STRmap.on('load', () => {

  // Activate geocoder
  STRmap.addControl(geocoder);

  // Add counties
  STRmap.addSource('county-boundaries', {
    type: 'geojson',
    data: countiesGeoJSON
  });

  STRmap.addLayer({
    id: 'county-fill',
    type: 'fill',
    source: 'county-boundaries',
    paint: {
      'fill-color': '#ADD8E6',
      'fill-opacity': 0.2
    }
  });

  STRmap.addLayer({
    id: 'county-boundaries-layer',
    type: 'line',
    source: 'county-boundaries',
    paint: {
      'line-color': '#D3D3D3',
      'line-width': [
        'interpolate', ['linear'], ['zoom'],
        5, 0.5,
        12, 2.5
      ]
    }
  });

  // Add STR school circles
  STRmap.addSource('str-schools', {
    type: 'geojson',
    data: strGeoJSON
  });

  STRmap.addLayer({
    id: 'str-schools-layer',
    type: 'circle',
    source: 'str-schools',
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        5, 2,
        12, 8
      ],
      'circle-color': '#007cbf',
      'circle-opacity': [
        'interpolate', ['linear'], ['get', 'str'],
        5, 0.2,
        25, 1
      ]
    }
  });

  // Hover popup
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

  // Simple fly to result (no county match yet)
  geocoder.on('result', (e) => {
    const bbox = e.result.bbox;

    if (bbox) {
      STRmap.fitBounds(bbox, {
        padding: 40,       // Space around the edges
        duration: 1000     // Smooth transition
      });
    } else {
      // fallback: if bbox is not provided, center the point
      STRmap.flyTo({
        center: e.result.center,
        zoom: 6,
        speed: 1.2,
        curve: 1
      });
    }
  });

  STRmap.on('click', (e) => {
    // Check if the click was NOT on the STR circles
    const features = STRmap.queryRenderedFeatures(e.point, {
      layers: ['str-schools-layer']
    });

    if (!features.length) {
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