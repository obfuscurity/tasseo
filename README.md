# Tasseo

[![Build Status](https://secure.travis-ci.org/obfuscurity/tasseo.png)](http://travis-ci.org/obfuscurity/tasseo)

Reading the tea leaves.

![graph](https://github.com/obfuscurity/tasseo/raw/master/lib/tasseo/public/i/tasseo.png "Tasseo Dashboard")

## Overview

Tasseo is a lightweight, easily configurable, near-realtime dashboard for time-series metrics. Charts are refreshed every two seconds and provide a heads-up view of the most current value.

The default behavior is designed for a retention policy with a 1-second resolution for at least 5 minutes, although this can be modified within the dashboard and metric attributes.

Tasseo was originally designed for the Graphite TSDB, but has since been extended to support InfluxDB, Librato Metrics, and Amazon CloudWatch backend sources.

## Configuration

### Examples

Creating your own dashboard is as simple as dropping a JSON file into the `dashboards` directory, committing it, and pushing the code to a Heroku app. The name of your file (minus the `.js` suffix) becomes the name of your dashboard. Here's an example configuration that you could put in e.g. `dashboards/example.js`:

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

The `target` attribute is the only mandatory field. As you might expect, each dashboard can contain an arbitrary list of different Graphite metrics. Another perfectly valid example, this time including the dashboard-level attribute `period`:

```json
var period = 3;
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

Dashboard-level attributes are top-level variables defined in your dashboard configuration.

* period - Range (in minutes) of data to query from Graphite. (optional, defaults to _5_)
* refresh - Refresh interval for charts, in milliseconds. (optional, defaults to _2000_)
* theme - Default theme for dashboard. Currently the only option is `dark`. (optional)
* padnulls - Determines whether to pad null values or not. (optional, defaults to _true_)
* title - Dictates whether the dashboard title is shown or not. (optional, defaults to _true_)
* toolbar - Dictates whether the toolbar is shown or not. (optional, defaults to _true_)
* normalColor - Set normal graph color. (optional, defaults to `#afdab1`)
* criticalColor - Set `critical` graph color. (optional, defaults to `#d59295`)
* warningColor - Set `warning` graph color. (optional, defaults to `#f5cb56`)
* interpolation - Line smoothing method supported by D3. (optional, defaults to _step-after_)
* renderer - Rendering method supported by D3. (optional, defaults to _area_)
* stroke - Dictates whether stroke outline is shown or not. (optional, defaults to _true_)

### Metric Attributes

Metric-level attributes are attributes of the metric object(s) in your `metrics` array.

* alias - Short name for the metric. (optional)
* target - Full target name as used by Graphite. Can contain a combination of chained functions. (mandatory)
* description - Text description or comment. (optional)
* link - External link to apply to metric name or alias. (optional)
* warning - Warning threshold. Exceeding this value causes the graph to turn yellow. (optional)
* critical - Critical threshold. Exceeding this value causes the graph to turn red. (optional)
* unit - Arbitrary string that can be used to designate a unit value; for example, "Mbps". (optional)
* series - Name of the InfluxDB series that each target belongs to. (mandatory for InfluxDB)
* transform - A function that takes the value and returns a transformed value. (optional)
* scale - Use a dynamic y-axis scale rather than defaulting to zero min. (optional)
* where - A `where` clause to pass to InfluxDB. (optional for InfluxDB)
* Amazon CloudWatch specific fields which are documented [here](http://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_GetMetricStatistics.html) and are discussed in the *Amazon CloudWatch* section below
  * Namespace, MetricName, Dimensions, Statistics, EndTime, StartTime, Period, Unit

## Deployment

The only required environment variables are:
* `HOST`. This should be set to 127.0.0.1 (or the IP address you want)
* `GRAPHITE_URL`. This should be set to the base URL of your Graphite composer (e.g. `https://graphite.yourdomain.com`).

If your server requires Basic Auth, you can set the `GRAPHITE_AUTH` variable (e.g. `username:password`).
Also, if you also want to override foreman's default `PORT`, you can set it too: use the `PORT` environment variable.

The variables can be exported in the shell or written down in an environment file. Foreman reads variables in `.env` by default but you can also pass any environment file with `-f /path/to/env/file`.

### Local

```bash
$ rvm use 1.9.2
$ bundle install
$ echo "HOST=127.0.0.1" > .env
$ echo "GRAPHITE_URL=..." >> .env
$ echo "GRAPHITE_AUTH=..." >> .env  # e.g. username:password (optional)
$ foreman start
$ open http://127.0.0.1:5000
```

### Heroku

```bash
$ export DEPLOY=production/staging/you
$ heroku create -r $DEPLOY -s cedar tasseo-$DEPLOY
$ heroku config:set -r $DEPLOY HOST=...
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

If your Graphite composer is protected by basic authentication, you have to ensure that the HTTP verb OPTIONS is allowed unauthenticated. This looks like the following for Apache:
```
<Location />
    AuthName "graphs restricted"
    AuthType Basic
    AuthUserFile /etc/apache2/htpasswd
    <LimitExcept OPTIONS>
      require valid-user
    </LimitExcept>
</Location>
```

See http://blog.rogeriopvl.com/archives/nginx-and-the-http-options-method/ for an Nginx example.

## Alternate Backends

### Librato Metrics

Tasseo can be configured to fetch metrics from [Librato Metrics](https://metrics.librato.com/)
instead of Graphite by setting the `LIBRATO_AUTH` environment variable instead of `GRAPHITE_AUTH`.

The format of this variable is:

```
LIBRATO_AUTH=<username>:<token>
```

By default, all sources for a metric are aggregated. To limit to a specific
source, specify the `source:` option when defining a metric. For instance, to
limit to the "web1" source:

```
{
  target: "fetch.timer",
  source: "web1"
}
```

If you are sending data less frequently than 1 second, you should adjust the
`period=` and `refresh=` configuration settings accordingly.

For instance, if you were sending metrics every 60 seconds, this could be sufficient:

```
var period = 60;
var refresh = 30000;
```

### InfluxDB

Tasseo can also be configured to fetch metrics from an [InfluxDB](http://influxdb.org/) server. The necessary environment variables are `INFLUXDB_URL` and `INFLUXDB_AUTH`. Within the configuration, each target must also contain a `series` attribute.

The formats of these variables are:

```
INFLUXDB_URL=http://sandbox.influxdb.org:8086
INFLUXDB_AUTH=<username>:<password>
```

Sample configuration:

```
var metrics =
[
  {
    target: "available",
    series: "disk_usage",
    transform: function(value) {
      // metric is logged in MB but we want to display GB
      return value / 1024;
    },
    // minimum y axis value will equal minimum metric y value (instead of 0)
    scale: true,
    db: "points"
  }
]
```

Is equivalent to the InfluxDB query `select available from disk_usage`.

### Amazon CloudWatch

Tasseo can be configured to fetch metrics from [Amazon CloudWatch](http://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/Welcome.html)
instead of Graphite by setting the `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_REGION` environment variables instead of `GRAPHITE_AUTH`. **As warned [here](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/browser-configuring.html)**, only use AWS IAM code credentials that have read only access to specific resources. These environment variables are used on the client and may be downloaded by anyone who happens to browse to your deployed dashboard. In addition, you will need to write `var usingCloudWatch = true;` in the metric configuration file.

By default, metric values are aggregated, come in 1 minute segments (CloudWatch's minimum), and span the default Tasseo 5 minute period (these correspond to the fields: "Statistics", "Period", and "EndTime"/"StartTime"). These fields are documented further [here](http://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_GetMetricStatistics.html). The fields "Namespace", "MetricName", "Dimensions", must be specified by the user. Although a target is required to be present, its value is irrelevant. An example for getting the Put latency off of a Kinesis Stream:

```
{
    'target': '',
    'Namespace': 'AWS/Kinesis',
    'MetricName': 'PutRecord.Latency',
    'Dimensions': [
      {
        'Name': 'StreamName',
        'Value': 'what-i-named-my-stream'
      }
    ]
  }
```

To view data on a bigger window, you should adjust the
`period=` configuration variable accordingly. `period`, given in minutes, will affect the window set by "StartTime" and "EndTime". You can override any of the CloudWatch settings from your metric JSON.

For instance, if you wanted to see metrics for the last hour, and have them refresh every minute, this could be sufficient:

```
var period = 60; // 60 minutes
var refresh = 1 * 60 * 1000; // 1 minute
```

To get an idea of what values for "Namespace", "MetricName", "Dimensions" are necessary for your purposes, consult your [CloudWatch dashboard](https://console.aws.amazon.com/cloudwatch/home#metrics:) or browse the response of the [listMetrics](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/frames.html#\!AWS/CloudWatch.html) API.


## GitHub Authentication

To authenticate against a GitHub organization, set the following environment variables:

```bash
$ export GITHUB_CLIENT_ID=<id>
$ export GITHUB_CLIENT_SECRET=<secret>
$ export GITHUB_AUTH_ORGANIZATION=<org>
```

To register an OAuth application, go here: https://github.com/settings/applications


## License

Tasseo is distributed under a 3-clause BSD license. Third-party software libraries included with this project are distributed under their respective licenses.

* d3.js - [3-clause BSD](https://github.com/mbostock/d3/blob/master/LICENSE)
* Rickshaw - [MIT](https://github.com/shutterstock/rickshaw)
* underscore.js - [MIT](https://github.com/jashkenas/underscore/blob/master/LICENSE)
