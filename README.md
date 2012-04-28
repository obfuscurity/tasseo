# Tasseo

Reading the tea leaves.

![graph](https://github.com/obfuscurity/tasseo/raw/master/public/i/tasseo.png "Tasseo Dashboard")

## Overview

Tasseo is a lightweight, easily configurable, real-time dashboard for Graphite events. Charts are refreshed every two seconds and provide a heads-up view of the most current value.

## Configuration

### Examples

Creating your own dashboard is as simple as dropping a JSON file into the ``public/d`` directory, committing it and pushing it to the staging or production Tasseo apps. The name of your file (minus the ``.js`` suffix) becomes the name of your dashboard. Here's a sample (also found [here](https://github.com/obfuscurity/tasseo/blob/master/public/d/template.js)):

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

The ``target`` attribute is the only mandatory field. As you might expect, each dashboard can contain an arbitrary list of different Graphite metrics. Another perfectly valid example:

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

### Thresholds

``warning`` and ``critical`` thresholds are optional. If defined, the color of the graph will change when the current value exceeds the respective threshold. If the thresholds are reversed (i.e. ``critical`` is lower than ``warning``), Tasseo understands that an inverse threshold is expected.

### Dashboard Attributes

* refresh - Refresh interval for charts, in milliseconds. (optional, defaults to _2000_)

### Metric Attributes

* alias - Short name for the metric. (optional)
* target - Full target name as used by Graphite. Can contain a combination of chained functions. (__mandatory__)
* warning - Warning threshold. Exceeding this value causes the graph to turn yellow. (optional)
* critical - Critical threshold. Exceeding this value causes the graph to turn red. (optional)
* unit - Arbitrary string that can be used to designate a unit value; for example, "Mbps". (optional)
* period - Range (in minutes) of data to query from Graphite. (optional, defaults to _5_)

## Deployment

The only environment variable is ``GRAPHITE_URL``. This should be set to the base URL of your Graphite composer (e.g. ``https://graphite.yourdomain.com``).

### Development

```bash
$ rvm use 1.9.2
$ bundle install
$ export GRAPHITE_URL=...
$ foreman start
$ open http://127.0.0.1:5000
```

### Production

```bash
$ export DEPLOY=production/staging/you
$ heroku create -r $DEPLOY -s cedar tasseo-$DEPLOY
$ heroku config:set -r $DEPLOY GRAPHITE_URL=...
$ git push $DEPLOY master
$ heroku scale -r $DEPLOY web=1
$ heroku open -r $DEPLOY
```

## License

Tasseo is distributed under a 3-clause BSD license. Third-party software libraries included with this project are distributed under their respective licenses.

* d3.js - [3-clause BSD](https://github.com/mbostock/d3/blob/master/LICENSE)
* Rickshaw - [MIT](https://github.com/shutterstock/rickshaw)
