const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const Promise = require('bluebird');

const axios = require('axios');
const querystring = require('qs');
const states = require('us-state-codes');
const yaml = require('yaml-js');

const HashIndex = require('./lib/hashIndex');
const { countryNameToIso3166Alpha, iso3166AlphaToCountryName } = require('./lib/iso3166');

const hashIndex = new HashIndex();

const TEAM_MAP_VERSION = 10;

if (!process.env.GEONAMES_USERNAME) {
  throw new Error('env variable GEONAMES_USERNAME must be set');
}

const geoNames =
  (endpoint) =>
  async (params = {}) => {
    const response = await axios({
      method: 'get',
      url: `https://secure.geonames.org/${endpoint}`,
      params: {
        type: 'json',
        username: process.env.GEONAMES_USERNAME,
        ...params
      },
      paramsSerializer: function (params) {
        return querystring.stringify(params, { arrayFormat: 'repeat' });
      }
    });

    const status = _.get(response, 'data.status', false);
    if (status) {
      throw new Error(
        `GeoNames raised error ${status.value}: ${status.message}. Search: ${response.request.path}`
      );
    }

    return _.get(response, 'data.geonames');
  };

const searchBlacklist = ['St. ', 'San '];

const startsWithBlackList = (name) => {
  if (!name) {
    return false;
  }

  if (searchBlacklist.some((b) => name.startsWith(b))) {
    return true;
  }

  return !/^[\S]+$/.test(name.substr(0, 3));
};

const searchGeoNames = geoNames('search');
const countryInfo = geoNames('countryInfo');

const STATE_CODE_REGEX = /,\s*([A-Z]+)\s*(,\s?USA?)?$/i;

function getLocality(locationName) {
  let search = (locationName && locationName.trim()) || '';

  search = search.slice(0, 1).toLocaleUpperCase() + search.slice(1);

  return search !== 'Anywhere' ? search : '';
}

function getCenterOfBoundingBox({ north, west, south, east }) {
  const [lat1, lng1, lat2, lng2] = [north, west, south, east].map(
    (f) => (parseFloat(f) * Math.PI) / 180
  );

  const x = Math.cos(lat1) * Math.cos(lng1) + Math.cos(lat2) * Math.cos(lng2);
  const y = Math.cos(lat1) * Math.sin(lng1) + Math.cos(lat2) * Math.sin(lng2);
  const z = Math.sin(lat1) + Math.sin(lat2);

  return [Math.atan2(z, Math.sqrt(x * x + y * y)), Math.atan2(y, x)].map(
    (f) => f * (180 / Math.PI)
  );
}

const getSearchQuery = async (locationName, country) => {
  const search = (locationName !== 'TBD' && locationName) || false;
  const countryCode = countryNameToIso3166Alpha(country);

  if (search) {
    let options = {
      maxRows: 1,
      inclBbox: true,
      featureClass: ['P', 'A'],
      country: countryCode,
      orderby: 'relevance',
      q: search,
      isNameRequired: true
    };

    if (countryCode === 'US' && STATE_CODE_REGEX.test(search)) {
      let state = search.match(STATE_CODE_REGEX)[1];
      options.q = search.replace(STATE_CODE_REGEX, '');

      if (state.length !== 2) {
        state = states.getStateCodeByStateName(states.sanitizeStateName(state));
      }

      if (state.length === 2) {
        options.adminCode1 = state.toUpperCase();
      }
    }

    //Ensure that abbreviations / spaces are not used for startsWith
    if (!startsWithBlackList(search)) {
      options.name_startsWith = search.substr(0, 3);
    }

    const result = _.get(await searchGeoNames(options), '[0]', {});

    return { ...result, countryCode };
  }

  const result = _.get(await countryInfo({ country: countryCode }), '[0]', {});

  const [lat, lng] = getCenterOfBoundingBox(result);

  return { ...result, lat, lng, countryCode };
};

const funnyPlaceMap = {
  'Seattle, WA': 'Seattle, WA', // https://www.youtube.com/watch?v=ZKVVxYfk7Y0
  'Alrington, Texas': 'Arlington, Texas',
  'Barry Island, Wales': 'Barry, Vale of Glamorgan',
  'Phila., PA': 'Philadelphia, PA',
  'Detroit Metro Area, MI': 'Detroit, MI',
  'Twin Cities, Minnesota': 'Minneapolis, Minnesota',
  'Boston Area, MA': 'Boston, MA',
  'Greater Zürich Area': 'Kanton Zürich',
  'Southeastern Pennsylvania': 'Berks County, Pennsylvania',
  'Washington, DC Metro': 'Washington, DC',
  'Los Angeles Metro, California': 'Los Angeles, CA',
  'Seoul/Suwon': 'Suwon',
  'Seoul/Seongnam': 'Seongnam',
  'Delhi-NCR': 'National Capital Territory of Delhi',
  'Saintfield, County Down, N.Ireland': 'Saintfield, Northern Ireland',
  'Chattanoga, TN': 'Chattanooga, TN',
  'Altanta, GA': 'Atlanta, GA',
  'West Jakarta': 'Jakarta Barat',
  'Grecia, Alajuela Province, Alajuela': 'Grecia',
  'Wilmington, N.C.': 'Wilmington, NC',
  'Greater Sydney Area': 'Sydney',
  EMEA: undefined,
  APAC: undefined
};

const cachedLocations = {
  'Yirrganydji|Australia': {
    location: [-16.75, 145.66],
    countryCode: 'AU',
    locality: 'Yirrganydji',
    country: 'Australia'
  },
  'Upstate, New York|USA': {
    location: [43.0, -75.5],
    countryCode: 'US',
    locality: 'Upstate New York',
    country: 'USA'
  },
  'EMEA|Ireland': {
    location: [53.415, -8.239],
    countryCode: 'IE',
    adminCode1: undefined,
    locality: undefined,
    country: 'Ireland'
  },
  'Americas East|United States': {
    location: [38, -82],
    countryCode: 'US',
    locality: undefined,
    country: 'USA'
  },
  '|Alexandria, Egypt': {
    location: [31.202, 29.916],
    countryCode: 'EG',
    locality: 'Alexandria',
    country: 'Egypt'
  },
  '|Apex, NC USA': {
    location: [35.732, -78.85],
    countryCode: 'US',
    locality: 'Apex',
    country: 'USA'
  },
  'Hamburg (but currently Tarifa, Spain)|Germany': {
    location: [36.01, -5.6],
    countryCode: 'ES',
    locality: 'Tarifa',
    country: 'Spain'
  },
  'APAC|Singapore': {
    location: [1.29, 103.85],
    countryCode: 'SG',
    locality: 'Singapore',
    country: 'Singapore'
  },
  'Netherlands|Rotterdam': {
    location: [51.922, 4.479],
    countryCode: 'NL',
    locality: 'Rotterdam',
    country: 'The Netherlands'
  }
};

const roundNumber = (number) => +parseFloat(number).toFixed(3);

const getLocation = async (locationName, country) => {
  const cacheKey = `${locationName}|${country}`;

  if (cachedLocations[cacheKey]) {
    console.log(`Using cached coordinates for ${locationName} in ${country}`);
    return cachedLocations[cacheKey];
  } else {
    console.log(`'${cacheKey}' not cached`);
  }

  if (funnyPlaceMap[locationName]) {
    locationName = funnyPlaceMap[locationName];
  }

  const { lat, lng, countryCode, adminCode1, name } =
    (await getSearchQuery(locationName, country)) || {};

  if (!lng || !lat) {
    throw new Error(`Could not find ${locationName} in ${country}`);
  }

  cachedLocations[cacheKey] = {
    location: [roundNumber(lat), roundNumber(lng)],
    countryCode,
    adminCode1,
    locality: name,
    country: iso3166AlphaToCountryName(countryCode)
  };

  return cachedLocations[cacheKey];
};

let cached = [];

try {
  const previous = JSON.parse(fs.readFileSync('./team.json', 'utf8'));
  if (_.get(previous, 'version') === TEAM_MAP_VERSION) {
    cached = previous.team;
  }
} catch (e) {
  console.log('Could not load existing reverse coded team.json');
}

const memberPictureBaseURL = 'about.gitlab.com/images/team/';

function getMemberPicture(picture) {
  if (picture.startsWith('https://')) {
    return picture;
  }

  const pictureURL = 'https://' + path.normalize(`${memberPictureBaseURL}${picture}`);

  if (pictureURL.includes(memberPictureBaseURL)) {
    return `${pictureURL.replace(/\.(png|jpe?g)$/gi, '')}-crop.jpg`;
  }

  return pictureURL;
}

function compareMembers(a, b) {
  const keyLength = Math.min(a.key.length, b.key.length);

  return a.key.substr(0, keyLength) === b.key.substr(0, keyLength);
}

const mapMember = async (member) => {
  const hash = hashIndex.shorten(member.key);

  if (cached[hash]) {
    console.log(`Cached result for ${member.name}`);
    return cached[hash];
  }

  console.log(
    `Searching location for ${member.name}: ${member.locality || 'No locality'} in ${
      member.country
    }`
  );

  let result;
  try {
    result = await getLocation(member.locality, member.country);
  } catch (e) {
    throw new Error(`Could not load location for ${member.name}:\n\t${e}`);
  }

  const { location, countryCode, adminCode1, locality, country } = result;
  console.log(
    `${member.name}; ${member.locality || 'No locality'}, ${
      member.country
    }: ${location} — ${country}`
  );

  return {
    key: hash,
    slug: member.slug,
    name: member.name,
    location,
    countryCode,
    stateCode: countryCode === 'US' ? adminCode1 : null,
    locality,
    country,
    picture: member.picture
  };
};

function bail(e) {
  if (e && e.stack) {
    console.warn(e.stack);
  }
  console.warn(`Error creating the team page map:\n\t${e}`);
  process.exit(1);
}

// Get document, or throw exception on error
async function main() {
  const doc = yaml.load(fs.readFileSync('./team.yml', 'utf8'));

  const members = doc
    .filter(
      (member) =>
        member.type !== 'vacancy' &&
        member.country &&
        member.country !== 'Remote' &&
        member.slug !== 'open-roles'
    )
    .flatMap((member) => {
      const locality = getLocality(member.locality);
      const picture = getMemberPicture(member.picture);
      const res = { ...member, locality, picture };
      const countryCode = countryNameToIso3166Alpha(member.country);
      if(['RU', 'BY', 'UA'].includes(countryCode)){
        return []
      }
      res.key = hashIndex.create(member);
      return res;
    })
    .sort(function (a, b) {
      if (a.start_date > b.start_date) {
        return 1;
      }
      if (a.start_date < b.start_date) {
        return -1;
      }
      return 0;
    });
  
  const tooMuch = _.differenceWith(cached, members, compareMembers);

  if (tooMuch.length > 0) {
    console.log(`Going to remove ${tooMuch.map((x) => x.name).join(', ')}`);
    cached = _.difference(cached, tooMuch);
  }

  cached = _.keyBy(cached, 'key');

  const team = await Promise.map(members, mapMember, { concurrency: 1 });

  console.log('\nFound a location for all team members');
  const result = { version: TEAM_MAP_VERSION, team };
  return fs.writeFileSync('./team.json', JSON.stringify(result));
}

main()
  .then(() => {
    console.log('Mapped all members on the team page and wrote results to team.json');
    process.exit(0);
  })
  .catch(bail);
