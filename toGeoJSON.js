const fs = require('fs');
const team = require('./team.json');

const properties = ['name', 'picture', 'country', 'locality', 'stateCode'];

function filter(rest) {
  const result = {};
  for (let key in rest) {
    if (properties.includes(key) && rest[key]) {
      result[key] = rest[key];
    }
  }
  return result;
}

const newGeoJSON = {
  type: 'FeatureCollection',
  features: team.team.map((x) => {
    const { location, ...rest } = x;

    return {
      type: 'Feature',
      properties: filter(rest),
      geometry: { type: 'Point', coordinates: location.reverse() }
    };
  })
};

fs.writeFileSync('./team_geo.json', JSON.stringify(newGeoJSON));
