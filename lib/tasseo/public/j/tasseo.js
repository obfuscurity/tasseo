/* Dashboard object */

function TasseoDashboard(metrics, datasource, period, options) {
  this.options = $.extend({
    interpolation: 'step-after',
    renderer: 'area',
    stroke: true,
    criticalColor: '#d59295',
    warningColor: '#f5cb56',
    normalColor: '#afdab1',
    container: '.main'
  }, options);

  this.period = period;
  this.datasource = datasource;
  this.buildContainers(metrics);
  this.createGraphs(metrics);
}

TasseoDashboard.prototype = {
  createGraphs: function(metrics) {
    var filtered = [];
    _.each(metrics, function(metric, idx) {
      if (_.isString(metric.target)) {
        var element = document.querySelector('.graph' + idx);
        filtered.push(new TasseoMetric(element, metric, this.options));
      }
    }, this);

    this.metrics = filtered;
  },

  clearGraphs: function() {
    _.each(this.metrics, function(metric) {
      metric.clear();
    })
  },

  // add our containers
  buildContainers: function(metrics) {
    var falseTargets = 0;
    for (var i=0; i<metrics.length; i++) {
      if (metrics[i].target === false) {
        $(this.options.container).append('<div class="false"></div>');
        falseTargets++;
      } else {
        var j = i - falseTargets;
        var link_open = 'link' in metrics[i] ? '<a href="' + metrics[i].link + '" target="_new">' : '';
        var link_close = 'link' in metrics[i] ? '</a>' : '';
        var graph_div =
            '<div id="' + j + '" class="graph graph' + j + '">' +
            '<span class="description description' + j + '"></span>' +
            link_open + '<div class="overlay-name overlay-name' + j + '"></div>' + link_close +
            '<div class="overlay-number overlay-number' + j + '"></div>' +
            '</div>';
        $(this.options.container).append(graph_div);
      }
    }
  },

  setPeriod: function(period) {
    this.period = period;
  },

  refreshData: function() {
    this.datasource.refresh(this.metrics, this.period);
  }
}


function TasseoMetric(element, metricSpec, dashboardOptions) {
  // Merge the keys from metricSpec into this object
  _.extend(this, metricSpec);

  this.element = element;
  this.alias = this.alias || this.target;
  this.transform = this.transform || function(value) { return value; };
  this.scale = this.scale || false;
  this.metricSpec = metricSpec;
  this.dashboardOptions = dashboardOptions;

  this.clear();
}

TasseoMetric.prototype = {
  clear: function() {
    this.datum = [{ x:0, y:0 }];
    this.graph = new Rickshaw.Graph({
      element: this.element,
      width: this.dashboardOptions.graph_width || 348,
      height: this.dashboardOptions.graph_height || 100,
      interpolation: this.dashboardOptions.interpolation,
      renderer: this.dashboardOptions.renderer,
      stroke: this.dashboardOptions.stroke,
      series: [{
        name: this.alias,
        color: this.dashboardOptions.normalColor,
        data: this.datum
      }]
    });

    this.graph.render();
  },

  setColor: function(color) {
    this.graph.series[0].color = color;
  },

  replaceDatum: function(newDatum) {
    if (newDatum.length > 0)
    {
      // Replace the array without changing the reference
      this.datum.length = 0;
      Array.prototype.push.apply(this.datum, newDatum)
    }
  },

  datumMin: function() {
    return _.chain(this.datum)
        .map(function(pt) { return pt.y })
        .min()
        .value()
  },

  update: function(newData) {
    var cleanData = _.chain(newData)
        .select(function(data) {
          return _.isNumber(data.x) && _.isNumber(data.y)
        })
        .sortBy(function(data) {
          return data.x
        }).value();

    this.replaceDatum(cleanData);

    // check our thresholds and update color
    var lastValue = this.transform(_.last(this.datum).y);
    var warning = this.warning;
    var critical = this.critical;
    if (critical > warning) {
      if (lastValue >= critical) {
        this.setColor(this.dashboardOptions.criticalColor)
      } else if (lastValue >= warning) {
        this.setColor(this.dashboardOptions.warningColor)
      } else {
        this.setColor(this.dashboardOptions.normalColor)
      }
    } else {
      if (lastValue <= critical) {
        this.setColor(this.dashboardOptions.criticalColor)
      } else if (lastValue <= warning) {
        this.setColor(this.dashboardOptions.warningColor)
      } else {
        this.setColor(this.dashboardOptions.normalColor)
      }
    }

    this.redraw()
  },

  redraw: function() {
    var element = $(this.element);

    // scale our graph so that the min is not 0
    if (this.scale) {
      this.graph.configure({ min: this.datumMin() });
    }
    // update our graph
    this.graph.update();

    element.find('.overlay-name').text(this.alias);

    if (!_.isUndefined(_.last(this.datum))) {
      var lastValue = this.transform(_.last(this.datum).y);
      var lastValueDisplay;
      if (_.isNumber(lastValue) && lastValue < 2.0) {
        lastValueDisplay = Math.round(lastValue*1000)/1000;
      } else {
        lastValueDisplay = parseInt(lastValue, 10);
      }
      if (this.description) {
        element.find('.description').html('Note:<br /><br />' + this.description);
      }
      element.find('.overlay-name').text(this.alias);
      element.find('.overlay-number').text(lastValueDisplay);
      if (!_.isUndefined(this.unit)) {
        element.find('.overlay-number').append('<span class="unit">' + this.unit + '</span>');
      }
    } else {
      element.find('.overlay-number').html('<span class="error">NF</span>');
    }
  }
};


/* Graphite datasource */

function TasseoGraphiteDatasource(url, auth, options) {
  this.baseUrl = url;
  this.auth = auth;
  this.options = _.extend({
    padnulls: true
  }, options)
}

TasseoGraphiteDatasource.prototype = {
  refresh: function(metrics, period) {
    var self = this;

    $.ajax({
      beforeSend: function(xhr) {
        if (self.auth && self.auth.length > 0) {
          var bytes = Crypto.charenc.Binary.stringToBytes(self.auth);
          var base64 = Crypto.util.bytesToBase64(bytes);
          xhr.setRequestHeader('Authorization', 'Basic ' + base64);
        }
      },
      dataType: 'json',
      error: function(xhr, textStatus, errorThrown) { console.log(errorThrown); },
      url: this.urlForMetrics(metrics, period)
    }).done(function(metricResults) {
      _.each(metrics, function(metric, idx) {
        var metricResult = _.find(metricResults, function(metricResult) {
          return ('keepLastValue(' + metric.target + ')') == metricResult.target;
        });
        if(metricResult === undefined) {
          console.log("not found: " + metric.alias);
        } else {
          var newDatapoints = _.map(metricResult.datapoints, function(datapoint) {
            return { x: datapoint[1], y: datapoint[0] }
          });
          metric.update(newDatapoints)
        }
      })
    })
  },

  urlForMetrics: function(metrics, period) {
    var targets = _.map(metrics, function(metric) {
      if (this.options.padnulls) {
        return 'target=keepLastValue(' + encodeURI(metric.target) + ')'
      } else {
        return 'target=' + encodeURI(metric.target)
      }
    }, this).join("&");

    var myUrl = this.baseUrl + '/render/?' + targets + '&from=-' + period + 'minutes&format=json';
    return myUrl;
  }
};



/* InfluxDB datasource */

function TasseoInfluxDBDatasource(url, auth, options) {
  this.auth = auth.split(':');
  this.user = this.auth[0];
  this.pass = this.auth[1];
  this.options = _.extend({}, options);
  this.url = url;
}

TasseoInfluxDBDatasource.prototype = {
  refresh: function(metrics, period) {
    _.each(metrics, function(metric) {
      this.refreshMetric(metric, period);
    }, this)
  },

  refreshMetric: function(metric, period) {
    var self = this;

    $.ajax({
      url: this.urlForMetric(metric, period),
      dataType: 'json',
      error: function(xhr, textStatus, errorThrown) { console.log(errorThrown); },
      success: function(metricResult) {
        var datapoints = metricResult.results[0].series[0].values;
        var newDatapoints = _.map(datapoints, function(datapoint) {
          return { x: new Date(datapoint[0]).getTime()/1000.0, y: parseFloat(datapoint[datapoint.length - 1]) }
        });
        metric.update(newDatapoints)
      }
    })
  },

  urlForMetric: function(metric, period) {
    var self = this;

    var query = 'select ' + metric.target + ' from ' + metric.series + ' where time > now() - ' + period + 'm';
    if (metric.where) {
      query += ' and (' + metric.where + ')';
    }

    return this.url + '/query?&time_precision=s&q=' + escape(query) + '&db=' + metric.db + '&u=' + self.user + '&p=' + self.pass;
  }
};



/* Librato datasource */

function TasseoLibratoDatasource(auth, options) {
  this.auth = auth;
  this.options = _.extend({}, options);
  this.url = this.options.url || 'https://metrics-api.librato.com/v1/metrics';
}

TasseoLibratoDatasource.prototype = {
  refresh: function(metrics, period) {
    _.each(metrics, function(metric) {
      this.refreshMetric(metric, period);
    }, this)
  },

  refreshMetric: function(metric, period) {
    var self = this;

    $.ajax({
      url: this.urlForMetric(metric, period),
      beforeSend: function(xhr) {
        if (self.auth && self.auth.length > 0) {
          var bytes = Crypto.charenc.Binary.stringToBytes(self.auth);
          var base64 = Crypto.util.bytesToBase64(bytes);
          xhr.setRequestHeader('Authorization', 'Basic ' + base64);
        }
      },
      dataType: 'json',
      error: function(xhr, textStatus, errorThrown) { console.log(errorThrown); },
      success: function(metricResult) {
        var datapoints = metricResult.measurements[metric.source || "all"];
        var newDatapoints = _.map(datapoints, function(datapoint) {
          return { x: datapoint['measure_time'], y: datapoint['value'] }
        });
        metric.update(newDatapoints)
      }
    })
  },

  urlForMetric: function(metric, period) {
    var now = Math.floor(new Date() / 1000),
        start_time = now - (period * 60),
        end_time = now;

    var url = this.url + "/" + metric.target + "?start_time=" + start_time + "&end_time=" + end_time + "&resolution=1";

    if (metric.source) {
      url += "&source=" + metric.source;
    } else {
      url += "&summarize_sources=true&breakout_sources=false"
    }

    return url;
  }
};

/* AWSCloudWatch datasource */

function TasseoAWSCloudWatchDatasource(accessKeyId, secretAccessKey, region, options) {
  this.options = _.extend({}, options);
  AWS.config.update({accessKeyId: accessKeyId, secretAccessKey: secretAccessKey});
  AWS.config.region = region ;
  this.client = new AWS.CloudWatch();
}

TasseoAWSCloudWatchDatasource.prototype = {
  // http://docs.aws.amazon.com/AmazonCloudWatch/latest/APIReference/API_GetMetricStatistics.html
  GET_METRIC_STATISTICS_VALID_PARAMS: [
    'Namespace',
    'MetricName',
    'Dimensions',
    'Statistics',
    'EndTime',
    'StartTime',
    'Period',
    'Unit'
  ],

  refresh: function(metrics, period) {
    _.each(metrics, function(metric) {
      this.refreshMetric(metric, period);
    }, this)
  },

  defaultParams: function(period) {
    var endTime = new Date();
    var startTime = new Date(endTime.getTime() - period * 60 * 1000); // convert period min to ms
    return {
      EndTime: endTime.toISOString(),
      StartTime: startTime.toISOString(),
      Period: 60, // 1 minute segments of data, the minimum
      Statistics: [ 'Sum' ]
    }
  },

  buildParams: function(metricParams, period) {
    return _.reduce(
        this.GET_METRIC_STATISTICS_VALID_PARAMS,
        function(acc, el) {
          metricParams[el] ? acc[el] = metricParams[el] : null;
          return acc
        },
        this.defaultParams(period))
  },

  refreshMetric: function(metric, period) {
    var requestParams = this.buildParams(metric, period);

    this.client.getMetricStatistics(requestParams, function(err, data) {
      if (err) {
        console.log(err, err.stack);
      } else {
        var stat = requestParams.Statistics[0];
        var newDatapoints = _.map(data['Datapoints'], function(datapoint) {
          return { y: datapoint[stat], x: datapoint.Timestamp.getTime() }
        });
        metric.update(newDatapoints)
      }
    });
  }
};



/* UI functionality */

function TasseoUi(dashboard, options) {
  this.dashboard = dashboard;
  this.options = _.extend({
    darkMode: false,
    title: true,
    toolbar: true,
    refreshInterval: 2000,
    realtimePeriod: 5
  }, options);

  this.setDarkMode(this.options.darkMode);

  if (!this.options.title) {
    $('div.title span').css('visibility', 'hidden');
  }

  if (!this.options.toolbar) {
    $('div.toolbar').css('visibility', 'hidden');
  }

  if (this.isDarkMode()) {
    $('.overlay-number').html('<img src="/i/spin-night.gif" />');
  } else {
    $('.overlay-number').html('<img src="/i/spin.gif" />');
  }

  this.attach();
  this.start();
}

TasseoUi.prototype = {
  start: function() {
    if (!this.refreshId) {
      this.refreshId = setInterval(_.bind(dashboard.refreshData, dashboard), this.options.refreshInterval);
      _.bind(dashboard.refreshData, dashboard)(); //fire an initial call
    }

    // set our 'live' interval hint
    $('.toolbar ul li.timepanel a.play').
        removeClass('pause').
        text(this.options.realtimePeriod + 'min');
  },
  pause: function() {
    if (this.refreshId) {
      clearInterval(this.refreshId);
      this.refreshId = undefined;
    }

    $('.toolbar ul li.timepanel a.play').
        addClass('pause').
        text('paused');
  },

  attach: function() {
    var self = this;

    // populate and render our navigation list
    $('.title').on('hover', 'span', function() {
      self.getDashboards(function(list) {
        $('.title span').html('<select><option value="/">welcome</option></select>');
        for (var i in list) {
          if (list[i] === window.location.pathname.replace(/^\//, '')) {
            $('.title select').append('<option selected="selected">' + list[i] + '</option>');
          } else {
            $('.title select').append('<option>' + list[i] + '</option>');
          }
        }
        $('.title span select').focus();
      });
    });

    // display description
    $(document).on('mouseenter', 'div.graph', function() {
      if ($(this).find('span.description').text().length > 0) {
        $(this).find('span.description').css('visibility', 'visible');
      }
    });

    // hide description
    $(document).on('mouseleave', 'div.graph', function() {
      $(this).find('span.description').css('visibility', 'hidden');
    });

    // clear navigation list on focusout
    $('.title span').on('focusout', 'select', function() {
      $('.title span').html(window.location.pathname.replace(/^\//, ''));
    });

    // navigate to selection
    $('.title span').on('change', 'select', function() {
      window.location.pathname = '/' + $(this).val();
    });


    // activate night mode by click
    $('li.toggle-night').on('click', 'a', function() {
      self.toggleDarkMode()
    });

    // toggle number display
    $('li.toggle-nonum').on('click', 'a', function() {
      $('div.overlay-number').toggleClass('nonum');
    });

    // time panel, pause live feed and show range
    $('.toolbar ul li.timepanel').on('click', 'a.range', function() {
      $(this).parent('li').parent('ul').find('li').removeClass('selected');
      $(this).parent('li').addClass('selected');

      self.pause()

      var period = $(this).attr('title');
      self.dashboard.setPeriod(period);
      self.dashboard.refreshData();
    });

    // time panel, resume live feed
    $('.toolbar ul li.timepanel').on('click', 'a.play', function() {
      $(this).parent('li').parent('ul').find('li').removeClass('selected');
      $(this).parent('li').addClass('selected');

      self.clearGraphs();

      self.dashboard.setPeriod(self.options.realtimePeriod);
      self.dashboard.refreshData();
      self.start()
    });
  },

  clearGraphs: function() {
    $('.graph svg').remove();
    this.dashboard.clearGraphs();

    // reapply dark mode
    this.setDarkMode(this.options.darkMode)
  },

  setDarkMode: function(enabled) {
    this.options.darkMode = enabled;

    if (enabled) {
      this.enableNightMode()
    } else {
      this.disableNightMode()
    }
  },

  isDarkMode: function() {
    return this.options.darkMode;
  },

  toggleDarkMode: function() {
    this.setDarkMode(!this.isDarkMode())
  },

  // activate night mode
  enableNightMode: function() {
    $('body').addClass('night');
    $('div.title h1').addClass('night');
    $('div.graph svg').css('opacity', '0.8');
    $('span.description').addClass('night');
    $('div.overlay-name').addClass('night');
    $('div.overlay-number').addClass('night');
    $('div.toolbar ul li.timepanel').addClass('night');
  },

  // deactivate night mode
  disableNightMode: function() {
    $('body').removeClass('night');
    $('div.title h1').removeClass('night');
    $('div.graph svg').css('opacity', '1.0');
    $('span.description').removeClass('night');
    $('div.overlay-name').removeClass('night');
    $('div.overlay-number').removeClass('night');
    $('div.toolbar ul li.timepanel').removeClass('night');
  },

  // retrieve dashboard list
  getDashboards: function(cb) {
    $.ajax({
      dataType: 'json',
      error: function(xhr, textStatus, errorThrown) { console.log(errorThrown); },
      url: '/'
    }).done(function(d) {
      cb(d.dashboards);
    });
  }
};
