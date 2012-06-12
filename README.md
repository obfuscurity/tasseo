# Tasseo

Reading the tea leaves.

![graph](https://github.com/obfuscurity/tasseo/raw/master/public/i/tasseo.png "Tasseo Dashboard")

## Overview

Tasseo is a lightweight, easily configurable, real-time dashboard for Graphite events. Charts are refreshed every two seconds and provide a heads-up view of the most current value.

The default behavior is designed for a Carbon retention policy with a 1-second resolution for at least 5 minutes, although this can be modified within the dashboard and metric attributes.

## Configuration

### Examples

Creating your own dashboard is as simple as dropping a JSON file into the `public/d` directory, committing it, and pushing the code to a Heroku app. The name of your file (minus the `.js` suffix) becomes the name of your dashboard. Here's an example configuration that you could put in e.g. `public/d/example.js`:

```json
var metrics =
[
  {
    "alias": "pulse-events-per-second",
    "target": "pulse.pulse-events-per-second",
    "warning": 100,
    "critical": 500
  }
];
```

The `target` attribute is the only mandatory field. As you might expect, each dashboard can contain an arbitrary list of different Graphite metrics. Another perfectly valid example:

```json
var metrics =
[
  { "target": "pulse.hermes-econns-apps-per-minute" },
  { "target": "pulse.hermes-econns-per-minute" },
  { "target": "pulse.hermes-elevated-route-lookups-per-minute" },
  { "target": "pulse.hermes-errors-per-minute" },
  { "target": "pulse.hermes-h10-per-minute" },
  { "target": "pulse.hermes-h11-per-minute" },
  { "target": "pulse.hermes-h12-per-minute" },
  { "target": "pulse.hermes-h13-per-minute" },
  { "target": "pulse.hermes-h14-per-minute" },
  { "target": "pulse.hermes-h18-per-minute" },
  { "target": "pulse.hermes-h99-per-minute" }
];
```

As an alternative to static dashboard layouts, it's possible to use a `false` target to _pad_ cells on the dashboard grid. Because metrics are read in a predictable manner from their respective `.js` files, this provides a mechanism for organizing an otherwise uncontrollable layout.


```json
var metrics =
[
  { "target": "foo" },
  { "target": false },
  { "target": "bar" }
];
```

### Thresholds

`warning` and `critical` thresholds are optional. If defined, the color of the graph will change when the current value exceeds the respective threshold. If the thresholds are reversed (i.e. `critical` is lower than `warning`), Tasseo understands that an inverse threshold is expected.

### Dashboard Attributes

* period - Range (in minutes) of data to query from Graphite. (optional, defaults to _5_)
* refresh - Refresh interval for charts, in milliseconds. (optional, defaults to _2000_)
* theme - Default theme for dashboard. Currently the only option is `dark`. (optional)
* toolbar - Dictates whether the toolbar is shown or not. (optional, default true)

### Metric Attributes

* alias - Short name for the metric. (optional)
* target - Full target name as used by Graphite. Can contain a combination of chained functions. (__mandatory__)
* warning - Warning threshold. Exceeding this value causes the graph to turn yellow. (optional)
* critical - Critical threshold. Exceeding this value causes the graph to turn red. (optional)
* unit - Arbitrary string that can be used to designate a unit value; for example, "Mbps". (optional)

## Deployment

The only required environment variable is `GRAPHITE_URL`. This should be set to the base URL of your Graphite composer (e.g. `https://graphite.yourdomain.com`). If your server requires Basic Auth, you can set the `GRAPHITE_AUTH` variable (e.g. `username:password`).

### Development

```bash
$ rvm use 1.9.2
$ bundle install
$ export GRAPHITE_URL=...
$ export GRAPHITE_AUTH=... # e.g. username:password (optional)
$ foreman start
$ open http://127.0.0.1:5000
```

### Production

```bash
$ export DEPLOY=production/staging/you
$ heroku create -r $DEPLOY -s cedar tasseo-$DEPLOY
$ heroku config:set -r $DEPLOY GRAPHITE_URL=...
$ heroku config:set -r $DEPLOY GRAPHITE_AUTH=...
$ git push $DEPLOY master
$ heroku scale -r $DEPLOY web=1
$ heroku open -r $DEPLOY
```

## Graphite Server Configuration

In order to support CORS with JSON instead of JSONP, we need to allow specific headers and allow the cross-domain origin request. The following are suggested settings for Apache 2.x. Adjust as necessary for your environment or webserver.

```
Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Methods "GET, OPTIONS"
Header set Access-Control-Allow-Headers "origin, authorization, accept"
```

## License

Tasseo is distributed under a 3-clause BSD license. Third-party software libraries included with this project are distributed under their respective licenses.

* d3.js - [3-clause BSD](https://github.com/mbostock/d3/blob/master/LICENSE)
* Rickshaw - [MIT](https://github.com/shutterstock/rickshaw)
