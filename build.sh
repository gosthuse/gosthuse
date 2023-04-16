#!/usr/bin/env bash
# Use the unofficial bash strict mode: http://redsymbol.net/articles/unofficial-bash-strict-mode/
set -euo pipefail
export FS=$'\n\t'

function download() {
  curl --fail --location --remote-name "$@"
}

# Download cached team.json and new team.yml
download 'https://gitlab-com.gitlab.io/teampage-map/team.json' ||
  download --data "job=build_page" --get \
    'https://gitlab.com/gitlab-com/teampage-map/-/jobs/artifacts/master/raw/public/team.json' ||
  echo "No cached team.json available"
download https://about.gitlab.com/company/team/team.yml

# Update team.json with data from the team.yml

yarn

mkdir -p src/vendor
cp node_modules/es6-promise/dist/es6-promise.auto.min.js src/vendor/
cp node_modules/mapbox-gl/dist/mapbox-gl.js src/vendor/
cp node_modules/mapbox-gl/dist/mapbox-gl.css src/vendor/
cp node_modules/normalize.css/normalize.css src/vendor/

node ./index.js
node ./toGeoJSON.js

# Copy assets into public folder
rm -rf public/
cp -f team.json src/
cp -f team_geo.json src/
cp -r src/ public/

# GZIP assets
find public -type f -exec gzip -f -k {} +
