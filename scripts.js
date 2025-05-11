// Initial map view
const initialView = {
  center: [-97.52899, 38.91388],
  zoom: 3.7,
  bearing: 0
};

// Access token
mapboxgl.accessToken = 'pk.eyJ1IjoibWVyY2Fkb2FubmVtIiwiYSI6ImNtOTF5emdodjA2bDAyam9oeHBmMHpzcmcifQ.Rq1Q0NNdnqalkKmh-0EkhA';

// Create map
const STRmap = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mercadoannem/cmainpzjg00e901s11fbjetcz',
  center: initialView.center,
  zoom: initialView.zoom,
  bearing: initialView.bearing,
  maxBounds: [[-180, 10], [-60, 72]]
});

// RESET VIEW BUTTON LOGIC
function resetMapView() {
  STRmap.flyTo({
    center: initialView.center,
    zoom: initialView.zoom,
    bearing: initialView.bearing
  });

  // Restore all layer visibility and data sources
  STRmap.setLayoutProperty('state-fill', 'visibility', 'visible');
  STRmap.setLayoutProperty('state-boundaries-outline', 'visibility', 'visible');
  STRmap.setLayoutProperty('county-fill', 'visibility', 'none');
  STRmap.setLayoutProperty('county-boundaries-layer', 'visibility', 'none');
  STRmap.setLayoutProperty('selected-county-highlight', 'visibility', 'none');
  STRmap.setLayoutProperty('selected-state-highlight', 'visibility', 'none');

  STRmap.getSource('selected-county').setData({ type: 'FeatureCollection', features: [] });
  STRmap.getSource('selected-state').setData({ type: 'FeatureCollection', features: [] });
  STRmap.getSource('county-boundaries').setData(countiesGeoJSON);
  STRmap.getSource('str-schools').setData({ type: 'FeatureCollection', features: [] });

  updatePanel('state', { name: '—', avgStr: '—', numSchools: '—' });
  updatePanel('county', { name: '—', avgStr: '—', numSchools: '—' });

  if (popup) popup.remove();
}

document.getElementById('reset-view-btn')?.addEventListener('click', resetMapView);

// Dynamic State STR Data Loader
function loadSTRDataForStateByFullName(stateName) {
  const stateId = stateName.toLowerCase().replace(/ /g, '_');
  const scriptId = `str-script-${stateId}`;

  if (document.getElementById(scriptId)) {
    useLoadedStateData(stateId);
    return;
  }

  const script = document.createElement('script');
  script.src = `${stateId}.js`;
  script.id = scriptId;
  script.onload = () => useLoadedStateData(stateId);
  script.onerror = () => console.error(`Failed to load STR data for: ${stateId}`);
  document.body.appendChild(script);
}

//update state scores
function useLoadedStateData(stateId) {
  const geojsonVar = window[`strData_${stateId}`];
  const source = STRmap.getSource('str-schools');
  const displayName = stateId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (!source) {
    console.warn('STR source not available on the map.');
    return;
  }

  // If no data available for this state
  if (!geojsonVar?.features?.length) {
    console.warn(`No school data for: ${stateId}`);

    source.setData({ type: 'FeatureCollection', features: [] });

    // Update state info panel
    updatePanel('state', {
      name: displayName,
      avgStr: 'No data available',
      numSchools: 'No data available'
    });

    // Optionally clear county panel
    updatePanel('county', {
      name: 'No data available',
      avgStr: 'No data available',
      numSchools: 'No data available'
    });

    return;
  }

  // If data exists
  source.setData(geojsonVar);

  const features = geojsonVar.features;
  const totalSTR = features.reduce((sum, f) => sum + parseFloat(f.properties.str || 0), 0);
  const avgSTR = (totalSTR / features.length).toFixed(1);

  updatePanel('state', {
    name: displayName,
    avgStr: avgSTR,
    numSchools: features.length
  });
}

// Reusable panel updater
function updatePanel(type, { name, avgStr, numSchools }) {
  document.getElementById(`${type}-name`).textContent = name;
  document.getElementById(`${type}-avg-str`).textContent = avgStr;
  document.getElementById(`${type}-num-schools`).textContent = numSchools;

  if (pane) {
    pane.classList.toggle('highlighted', shouldHighlight);
  }

}

// Update county scores
function updateCountySnapshot(countyName) {
  if (!countyName) {
    console.warn("County name is missing.");
    return;
  }

  const countySchools = STRmap.querySourceFeatures('str-schools', {
    filter: ['==', ['get', 'county'], countyName]
  });

  const totalSTR = countySchools.reduce((sum, f) => sum + parseFloat(f.properties.str || 0), 0);
  const avgSTR = countySchools.length > 0 ? (totalSTR / countySchools.length).toFixed(1) : 'No data available';  

  // Update UI
  document.getElementById('county-name').textContent = countyName.replace(/\b\w/g, c => c.toUpperCase());
  document.getElementById('avg-str').textContent = avgSTR;
  document.getElementById('num-schools').textContent = countySchools.length;
}


// Calculate Feature Bounding Box
function getFeatureBounds(feature) {
  try {
    if (feature.geometry.type === 'MultiPolygon') {
      let bounds = null;
      feature.geometry.coordinates.forEach(polygon => {
        polygon.forEach(ring => {
          ring.forEach(coord => {
            if (Array.isArray(coord) && coord.length >= 2) {
              bounds = bounds ? bounds.extend(coord) : new mapboxgl.LngLatBounds(coord, coord);
            }
          });
        });
      });
      return bounds;
    } else if (feature.geometry.type === 'Polygon') {
      let bounds = null;
      feature.geometry.coordinates[0].forEach(coord => {
        if (Array.isArray(coord) && coord.length >= 2) {
          bounds = bounds ? bounds.extend(coord) : new mapboxgl.LngLatBounds(coord, coord);
        }
      });
      return bounds;
    } else if (feature.geometry.type === 'Point') {
      const coord = feature.geometry.coordinates;
      return new mapboxgl.LngLatBounds(coord, coord);
    }
    return null;
  } catch (error) {
    console.error("Error calculating bounds for feature:", error);
    return null;
  }
}

STRmap.on('load', () => {
  if (typeof statesGeoJSON === 'undefined') {
    console.error("statesGeoJSON is not defined!");
    return;
  }

  // State boundaries source
  STRmap.addSource('state-boundaries', {
    type: 'geojson',
    data: statesGeoJSON
  });

  // County boundaries source
  STRmap.addSource('county-boundaries', {
    type: 'geojson',
    data: countiesGeoJSON
  });

  // Selected state/county sources
  STRmap.addSource('selected-county', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  STRmap.addSource('selected-state', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  // STR data
  STRmap.addSource('str-schools', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] } // initially empty
  });

  // Base layers (state fill)
  STRmap.addLayer({
    id: 'state-fill',
    type: 'fill',
    source: 'state-boundaries',
    paint: {
      'fill-color': '#F23CA6',
      'fill-opacity': 0.3
    }
  });

  // County fill (initially hidden)
  STRmap.addLayer({
    id: 'county-fill',
    type: 'fill',
    source: 'county-boundaries',
    layout: { visibility: 'none' },
    paint: {
      'fill-color': '#FF9535',
      'fill-opacity': 0.5
    }
  });

  // Lines (state boundaries)
  STRmap.addLayer({
    id: 'state-boundaries-outline',
    type: 'line',
    source: 'state-boundaries',
    paint: {
      'line-color': '#F23CA6',
      'line-width': 1,
      'line-opacity': 1
    }
  });

  // County boundaries (initially hidden)
  STRmap.addLayer({
    id: 'county-boundaries-layer',
    type: 'line',
    source: 'county-boundaries',
    layout: { visibility: 'none' },
    paint: {
      'line-color': '#FF9535',
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 2.5]
    }
  });

  // Highlights should come after base layers
  STRmap.addLayer({
    id: 'selected-state-highlight',
    type: 'line',
    source: 'selected-state',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#F23CA6', 'line-width': 3, 'line-opacity': 1 }

  });

  STRmap.addLayer({
    id: 'selected-county-highlight',
    type: 'line',
    source: 'selected-county',
    layout: { visibility: 'none' },
    paint: { 'line-color': '#FF9535', 'line-width': 3, 'line-opacity': 1 }
  });

  STRmap.addLayer({
    id: 'str-schools-layer',
    type: 'circle',
    source: 'str-schools',
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4, 1.5,   // smaller at low zoom
        12, 4     // smaller at high zoom
      ],
      'circle-color': '#5E57FF',
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.8
    }
  });

  try {
    let combinedBounds = null;
    statesGeoJSON.features.forEach(feature => {
      const featureBounds = getFeatureBounds(feature);
      if (featureBounds) {
        combinedBounds = combinedBounds ? combinedBounds.extend(featureBounds) : featureBounds;
      }
    });
    //if (combinedBounds) STRmap.fitBounds(combinedBounds, { padding: 40 });
  } catch (error) {
    console.error("Error calculating state bounds:", error);
  }

  STRmap.on('click', 'county-fill', (e) => {
    if (e.originalEvent) e.originalEvent.stopPropagation();
    const feature = e.features[0];
  
    // Try to extract a usable county name
    let selectedCountyName = '';
    try {
      const raw = feature.properties.coty_name;
      if (raw && raw.startsWith('["')) {
        selectedCountyName = JSON.parse(raw)[0];
      } else {
        throw new Error("Invalid coty_name format");
      }
    } catch (err) {
      console.warn("Falling back to basic county name parsing:", err);
      selectedCountyName = feature.properties.name || feature.properties.NAME || '';
    }
  
    // Normalize names for comparison
    const targetName = selectedCountyName.toLowerCase().replace(" county", "").trim();
    const allSchools = STRmap.querySourceFeatures('str-schools');
  
    const countySchools = allSchools.filter(f => {
      const schoolCounty = (f.properties.county || '').toLowerCase().replace(" county", "").trim();
      return schoolCounty === targetName;
    });
  
    // Highlight selected county
    STRmap.getSource('selected-county').setData({
      type: 'FeatureCollection',
      features: [feature]
    });
    STRmap.setLayoutProperty('selected-county-highlight', 'visibility', 'visible');
  
    const featureBounds = getFeatureBounds(feature);
    if (featureBounds) STRmap.fitBounds(featureBounds, { padding: 40, duration: 1000 });
  
    // Format name for UI
    const formattedName = selectedCountyName.replace(/\b\w/g, c => c.toUpperCase());
  
    // Update UI
    if (countySchools.length === 0) {
      document.getElementById('county-name').textContent = formattedName;
      document.getElementById('avg-str').textContent = 'No data available';
      document.getElementById('num-schools').textContent = 'No data available';
      return;
    }
  
    const totalSTR = countySchools.reduce((sum, f) => sum + parseFloat(f.properties.str || 0), 0);
    const avgSTR = (totalSTR / countySchools.length).toFixed(1);
  
    document.getElementById('county-name').textContent = formattedName;
    document.getElementById('avg-str').textContent = avgSTR;
    document.getElementById('num-schools').textContent = countySchools.length;
  });
  


  STRmap.on('mouseenter', 'county-fill', () => {
    STRmap.getCanvas().style.cursor = 'pointer';
  });

  STRmap.on('mouseleave', 'county-fill', () => {
    STRmap.getCanvas().style.cursor = '';
  });

  STRmap.on('click', 'state-fill', (e) => {
    if (e.originalEvent) e.originalEvent.stopPropagation();
    const feature = e.features[0];

    const stateProps = feature.properties;
    const rawStateName = stateProps.name || stateProps.NAME || stateProps.STATE_NAME;
    if (!rawStateName) {
      console.error("Could not determine state name from properties");
      return;
    }

    const stateName = rawStateName.toLowerCase();
    loadSTRDataForStateByFullName(rawStateName);

    // Clear any selected county
    STRmap.getSource('selected-county').setData({
      type: 'FeatureCollection',
      features: []
    });
    STRmap.setLayoutProperty('selected-county-highlight', 'visibility', 'none');

    // Update selected state
    STRmap.getSource('selected-state').setData({
      type: 'FeatureCollection',
      features: [feature]
    });
    STRmap.setLayoutProperty('selected-state-highlight', 'visibility', 'visible');

    // Fit to bounds
    const featureBounds = getFeatureBounds(feature);
    if (featureBounds) STRmap.fitBounds(featureBounds, { padding: 40, duration: 1000 });

    // Filter counties for this state
    const filteredCounties = {
      type: "FeatureCollection",
      features: countiesGeoJSON.features.filter(
        county => String(county.properties.ste_name || '').toLowerCase() === stateName
      )
    };

    if (filteredCounties.features.length === 0 && stateProps.STATEFP) {
      filteredCounties.features = countiesGeoJSON.features.filter(
        county => county.properties.STATEFP === stateProps.STATEFP
      );
    }

    const stateSchools = STRmap.querySourceFeatures('str-schools');

    const stateTotalSTR = stateSchools.reduce((sum, f) => sum + parseFloat(f.properties.str || 0), 0);
    const stateAvgSTR = (stateSchools.length > 0) ? (stateTotalSTR / stateSchools.length).toFixed(1) : '—';

    document.getElementById('state-name').textContent = rawStateName;
    document.getElementById('state-avg-str').textContent = stateAvgSTR;
    document.getElementById('state-num-schools').textContent = stateSchools.length;

    STRmap.getSource('county-boundaries').setData(filteredCounties);
    STRmap.setLayoutProperty('county-fill', 'visibility', 'visible');
    STRmap.setLayoutProperty('county-boundaries-layer', 'visibility', 'visible');

    STRmap.setLayoutProperty('state-fill', 'visibility', 'none');
    STRmap.setLayoutProperty('state-boundaries-outline', 'visibility', 'visible');
  });

  STRmap.on('mouseenter', 'state-fill', () => {
    STRmap.getCanvas().style.cursor = 'pointer';
  });

  STRmap.on('mouseleave', 'state-fill', () => {
    STRmap.getCanvas().style.cursor = '';
  });

  STRmap.on('click', (e) => {
    const features = STRmap.queryRenderedFeatures(e.point, {
      layers: ['county-fill', 'state-fill']
    });

    if (!features.length) {
      // Reset to initial view
      resetMapView();

      // Reset all layers
      STRmap.setLayoutProperty('county-fill', 'visibility', 'none');
      STRmap.setLayoutProperty('county-boundaries-layer', 'visibility', 'none');
      STRmap.setLayoutProperty('selected-county-highlight', 'visibility', 'none');
      STRmap.setLayoutProperty('selected-state-highlight', 'visibility', 'none');

      // Clear selections
      STRmap.getSource('selected-county').setData({
        type: 'FeatureCollection',
        features: []
      });
      STRmap.getSource('selected-state').setData({
        type: 'FeatureCollection',
        features: []
      });

      // Reset county data
      STRmap.getSource('county-boundaries').setData(countiesGeoJSON);

      // Reset school markers
      STRmap.getSource('str-schools').setData({
        type: 'FeatureCollection',
        features: []
      });

      // Show state layers again
      STRmap.setLayoutProperty('state-fill', 'visibility', 'visible');
      STRmap.setLayoutProperty('state-boundaries-outline', 'visibility', 'visible');

      // Remove popup if present
      if (popup) popup.remove();
      
    }
  });
});

document.getElementById('reset-view-btn')?.addEventListener('click', () => {
  STRmap.flyTo({
    center: initialView.center,
    zoom: initialView.zoom,
    bearing: initialView.bearing
  });

  // Reset visibility
  STRmap.setLayoutProperty('county-fill', 'visibility', 'none');
  STRmap.setLayoutProperty('county-boundaries-layer', 'visibility', 'none');
  STRmap.setLayoutProperty('selected-county-highlight', 'visibility', 'none');
  STRmap.setLayoutProperty('selected-state-highlight', 'visibility', 'none');

  // Reset sources
  STRmap.getSource('selected-county').setData({
    type: 'FeatureCollection',
    features: []
  });
  STRmap.getSource('selected-state').setData({
    type: 'FeatureCollection',
    features: []
  });
  STRmap.getSource('county-boundaries').setData(countiesGeoJSON);
  STRmap.getSource('str-schools').setData({
    type: 'FeatureCollection',
    features: []
  });

  // Reset panels
  updatePanel('state', {
    name: '—',
    avgStr: '—',
    numSchools: '—'
  });
  updatePanel('county', {
    name: '—',
    avgStr: '—',
    numSchools: '—'
  });

  // Remove popup
  if (popup) popup.remove();
});


let popup;
STRmap.on('mouseenter', 'str-schools-layer', (e) => {
  const props = e.features[0].properties;
  popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false })
    .setLngLat(e.lngLat)
    .setHTML(`<strong>${props.school}</strong><br>STR: ${props.str}`)
    .addTo(STRmap);
  STRmap.getCanvas().style.cursor = 'pointer';
});

STRmap.on('mouseleave', 'str-schools-layer', () => {
  if (popup) popup.remove();
  STRmap.getCanvas().style.cursor = '';
});
