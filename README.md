# GitLab Team Map

![banner](./banner.png)

> Map of the GitLab team for https://about.gitlab.com/team/

You can find the current version of the map on: https://gitlab-com.gitlab.io/teampage-map/

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Maintainers](#maintainers)
- [Contribute](#contribute)
- [License](#license)

## Background

All the data is taken from the team page source file: [data/team.yml][team.yml].
There is a simple node script which converts the data from to a team.yml to a json and also geo-codes the locations.
A cached version of this generated file is used and downloaded from GitLab CI to minimize API calls needed to generate the file.
The CI build is scheduled to run daily, so that the Map reflects the status of the team page.

We use [mapbox] as a tile provider and the popular framework [leaflet] to render the map.
If you click on clusters with >10 GitLabbers the Map will zoom in.
Smaller clusters will expand on click.
Each GitLabber's picture is clickable and a popup with more info will open up.
Zooming with mousewheel is disabled until you click the Map once. It will be disabled once you leave the Map area.

## Install

Requirements:

- `node`
- `yarn`
- `ruby`

Open a shell and serve this directory:

```bash
bash ./build.sh
ruby -run -e httpd . -p 9090
```

The src files live in `src/`. They are copied to the `/public` directory.
Now you can use navigate to:

- full-screen page: http://localhost:9090/public/
- iframe test (to simulate the team page): http://localhost:9090/iframe.test.html

If you change something in the `src/` directory, you need to rerun `bash ./build.sh`

## Maintainers

- [@leipert](https://gitlab.com/leipert)

## Contribute

MRs accepted.

Small note: If editing the README, please conform to the [standard-readme] specification.

## License

MIT © 2018-present GitLab B.V.

[team.yml]: https://gitlab.com/gitlab-com/www-gitlab-com/blob/master/data/team.yml
[standard-readme]: https://github.com/RichardLitt/standard-readme
