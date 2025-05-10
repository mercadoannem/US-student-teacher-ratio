// Initial map view
const initialView = {
  center: [-99.25186, 37.53243],
  zoom: 3.88,
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
  
  // Schools data source
  STRmap.addSource('str-schools', { 
    type: 'geojson', 
    data: strGeoJSON 
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

  // Base layers (state fill)
  STRmap.addLayer({
    id: 'state-fill',
    type: 'fill',
    source: 'state-boundaries',
    paint: {
      'fill-color': '#F23CA6',
      'fill-opacity': 0.5
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

  // Points (schools) should be on top
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

  STRmap.on('click', 'county-fill', (e) => {
    if (e.originalEvent) e.originalEvent.stopPropagation();
    const feature = e.features[0];
    
    // Update selected county data
    STRmap.getSource('selected-county').setData({
      type: 'FeatureCollection',
      features: [feature]
    });
    
    // Show highlight
    STRmap.setLayoutProperty('selected-county-highlight', 'visibility', 'visible');
    
    // Fit to bounds
    const featureBounds = getFeatureBounds(feature);
    if (featureBounds) STRmap.fitBounds(featureBounds, { padding: 40, duration: 1000 });
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

    const stateProps = feature.properties;
    const rawStateName = stateProps.name || stateProps.NAME || stateProps.STATE_NAME;
    if (!rawStateName) {
      console.error("Could not determine state name from properties");
      return;
    }
    const stateName = rawStateName.toLowerCase();

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

    // Update county boundaries with filtered data
    STRmap.getSource('county-boundaries').setData(filteredCounties);
    
    // Show county layers while keeping state outline visible 
    STRmap.setLayoutProperty('county-fill', 'visibility', 'visible');
    STRmap.setLayoutProperty('county-boundaries-layer', 'visibility', 'visible');
    
    // We want to keep the state outline visible but hide the fill
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
      layers: ['str-schools-layer', 'county-fill', 'state-fill']
    });
    
    if (!features.length) {
      // Reset to initial view
      STRmap.flyTo({ 
        center: initialView.center, 
        zoom: initialView.zoom, 
        bearing: initialView.bearing 
      });
      
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

      // Show state layers again
      STRmap.setLayoutProperty('state-fill', 'visibility', 'visible');
      STRmap.setLayoutProperty('state-boundaries-outline', 'visibility', 'visible');
      
      // Remove popup if present
      if (popup) popup.remove();
    }
  });
});