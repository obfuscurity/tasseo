
var Tasseo = {
  graphs: {},      // rickshaw objects
  datum: {},       // metric data
  aliases: {},     // alias strings
  descriptions: {}, // description strings
  realMetrics: {}, // non-false targets

  // minutes of data in the live feed
  period: (typeof period == 'undefined') ? 20 : period,

  // gather our non-false targets
  gatherRealMetrics: function() {
    for (var metric in metrics) {
      if (metrics[metric].target === false) {
      } else {
        this.realMetrics[metrics[metric].target] = metrics[metric];
        this.realMetrics[metrics[metric].target]['selector'] = metrics[metric].target.replace(/\./g, '-');
      }
    }
  },

  // build our graph objects
  constructGraphs: function() {
    for (var metric in this.realMetrics) {
      var target = this.realMetrics[metric].target
      var alias = this.realMetrics[metric].alias || this.realMetrics[metric].target;
      this.aliases[target] = alias;
      this.descriptions[target] = this.realMetrics[metric].description || null;
      this.datum[target] = [{ x:0, y:0 }];
      this.graphs[target] = new Rickshaw.Graph({
        element: document.querySelector('.graph' + this.realMetrics[metric].selector),
        width: 348,
        height: 100,
        interpolation: 'step-after',
        renderer: 'area',
        stroke: true,
        series: [{
          name: this.aliases[target],
          color: '#afdab1',
          data: this.datum[target]
        }]
      });
      this.graphs[target].render();
    }
  },

  // refresh the graph
  refreshData: function (immediately) {
    for (var metric in this.realMetrics) {
      this.getData(metric, function(metric, values) {
        for (var i = 0; i < values.length; i++) {
          if (typeof values[i] !== "undefined") {
            this.datum[metric][i] = values[i];
          }
        }
        // check our thresholds and update color
        var lastValue = this.datum[metric][this.datum[metric].length - 1].y;
        var warning = this.realMetrics[metric].warning;
        var critical = this.realMetrics[metric].critical;
        if (critical > warning) {
          if (lastValue >= critical) {
            this.graphs[metric].series[0].color = '#d59295';
          } else if (lastValue >= warning) {
            this.graphs[metric].series[0].color = '#f5cb56';
          } else {
            this.graphs[metric].series[0].color = '#afdab1';
          }
        } else {
          if (lastValue <= critical) {
            this.graphs[metric].series[0].color = '#d59295';
          } else if (lastValue <= warning) {
            this.graphs[metric].series[0].color = '#f5cb56';
          } else {
            this.graphs[metric].series[0].color = '#afdab1';
          }
        }
        // we want to render immediately, i.e.
        // as soon as ajax completes
        // used for time period / pause view
        if (immediately) this.updateGraph(metric);
      });
      values = null;
    }

    // we can wait until all data is gathered, i.e.
    // the live refresh should happen synchronously
    if (!immediately) {
      for (var graph in this.graphs) {
        this.updateGraph(graph);
      }
    }
  },

  // add our containers
  buildContainers: function() {
    for (var metric in metrics) {
      if (metrics[metric].target === false) {
        $('.main').append('<div id="false"></div>');
        falseTargets++;
      } else {
        var link_open = 'link' in metrics[metric] ? '<a href="' + metrics[i].link + '" target="_new">' : '';
        var link_close = 'link' in metrics[metric] ? '</a>' : '';
        var graph_div = 
          '<div class="graph graph' + metrics[metric].selector + '">' +
          '<span class="description description' + metrics[metric].selector + '"></span>' +
          link_open + '<div class="overlay-name overlay-name' + metrics[metric].selector + '"></div>' + link_close +
          '<div class="overlay-number overlay-number' + metrics[metric].selector + '"></div>' +
          '</div>';
        $('.main').append(graph_div);
      }
    }
  },

  initialize: function() {
    // filter out false targets
    this.gatherRealMetrics();

    // build our div containers
    this.buildContainers();

    // build our graph objects
    this.constructGraphs();
    // initial load screen
    for (var graph in this.graphs) {
      if (this.realMetrics[graph].target === false) {
        //continue;
      } else if (myTheme === "dark") {
        $('.overlay-number' + this.realMetrics[graph].selector).html('<img src="i/spin-night.gif" />');
      } else {
        $('.overlay-number' + this.realMetrics[graph].selector).html('<img src="i/spin.gif" />');
      }
    }
  }

};

var LibratoMetrics = {
  url: 'https://metrics-api.librato.com/v1/metrics',

  // construct url
  constructUrl: function (metric) {
    var source = this.realMetrics[metric].source;
    var now = new Date();
    var offset = now.getTimezoneOffset();
    now = parseInt((now.getTime() + offset * 60) / 1000);
    var start = now - (this.period * 60);
    var end = now;
    return this.url + '/' + encodeURI(metric) + '?source=' + source + '&resolution=1&start_time=' + start + '&end_time=' + end;
  },

  displayTransform: function (value, period, transform) {
    if (transform !== undefined && transform !== null && transform.length > 0) {
      var p = period, x = value;
      return eval(transform);
    } else {
      return value;
    }
  },

  // retrieve the data from Graphite
  getData: function(metric, cb) {
    var myDatum = [];
    $.ajax({
      beforeSend: function(xhr) {
        if (auth.length > 0) {
          var bytes = Crypto.charenc.Binary.stringToBytes(auth);
          var base64 = Crypto.util.bytesToBase64(bytes);
          xhr.setRequestHeader("Authorization", "Basic " + base64);
        }
      },
      dataType: 'json',
      error: function(xhr, textStatus, errorThrown) { console.log(errorThrown); },
      url: this.constructUrl(metric),
      cache: false
    }).done(function(d) {
      LibratoMetrics.done(metric, cb, d);
    });
  },

  done: function(metric, callback, d) {
    var myDatum = [];
    var source = this.realMetrics[metric].source;
    var transform = d.attributes.display_transform;
    var period = d.period;
    myDatum[0] = {
      x: d.measurements[source][0].measure_time,
      y: this.displayTransform(d.measurements[source][0].value, period, transform) || 0
    };
    for (var j = 1; j < d.measurements[source].length; j++) {
      myDatum[j] = {
        x: d.measurements[source][j].measure_time,
        y: this.displayTransform(d.measurements[source][j].value, period, transform) || graphs[metric].lastKnownValue
      };
      if (typeof d.measurements[source][0].value === "number") {
        this.graphs[d.name].lastKnownValue = d.measurements[source][0].value;
      }
    }
    callback.call(LibratoMetrics, metric, myDatum);
  },

  // perform the actual graph object and
  // overlay name and number updates
  updateGraph: function(graph) {
    // update our graph
    this.graphs[graph].update();
    if (this.datum[graph][this.datum[graph].length - 1] !== undefined) {
      var lastValue = this.datum[graph][this.datum[graph].length - 1].y;
      var lastValueDisplay = Math.round(lastValue * 100) / 100;
      if (this.descriptions[graph]) {
        $('.description' + this.realMetrics[graph].selector).html('Note:<br /><br />' + this.descriptions[graph]);
      }
      $('.overlay-name' + this.realMetrics[graph].selector).text(this.aliases[graph]);
      $('.overlay-number' + this.realMetrics[graph].selector).text(lastValueDisplay);
      if (this.realMetrics[graph].unit) {
        $('.overlay-number' + this.realMetrics[graph].selector).append('<span class="unit">' + this.realMetrics[graph].unit + '</span>');
      }
    } else {
      $('.overlay-name' + this.realMetrics[graph].selector).text(aliases[graph]);
      $('.overlay-number' + this.realMetrics[graph].selector).html('<span class="error">NF</span>');
    }
  },
};

$.extend(LibratoMetrics, Tasseo);

LibratoMetrics.initialize();
// set our last known value at invocation
Rickshaw.Graph.prototype.lastKnownValue = 0;

// set our theme
var myTheme = (typeof theme == 'undefined') ? 'default' : theme;
if (myTheme === "dark") { enableNightMode(); }

// hide our toolbar if necessary
var toolbar = (typeof toolbar == 'undefined') ? true : toolbar;
if (!toolbar) { $('div.toolbar').css('display', 'none'); }

LibratoMetrics.refreshData("now");

function refreshData() {
  LibratoMetrics.refreshData();
}
//
// define our refresh and start interval
var refreshInterval = (typeof refresh == 'undefined') ? 20000 : refresh;
var refreshId = setInterval(refreshData, refreshInterval);

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
  $('.title span').html(window.location.pathname.replace(/^\\/, ''));
});

// navigate to selection
$('.title span').on('change', 'select', function() {
  window.location.pathname = '/' + $(this).val();
});

// activate night mode
function enableNightMode() {
  $('body').addClass('night');
  $('div.title h1').addClass('night');
  $('div.graph svg').css('opacity', '0.8');
  $('span.description').addClass('night');
  $('div.overlay-name').addClass('night');
  $('div.overlay-number').addClass('night');
  $('div.toolbar ul li.timepanel').addClass('night');
}

// deactivate night mode
function disableNightMode() {
  $('body').removeClass('night');
  $('div.title h1').removeClass('night');
  $('div.graph svg').css('opacity', '1.0');
  $('span.description').removeClass('night');
  $('div.overlay-name').removeClass('night');
  $('div.overlay-number').removeClass('night');
  $('div.toolbar ul li.timepanel').removeClass('night');
}

// activate night mode by click
$('li.toggle-night').on('click', 'a', function() {
  if ($('body').hasClass('night')) {
    disableNightMode();
  } else {
    enableNightMode();
  }
});

// toggle number display
$('li.toggle-nonum').on('click', 'a', function() { $('div.overlay-number').toggleClass('nonum'); });

// time panel, pause live feed and show range
$('.toolbar ul li.timepanel').on('click', 'a.range', function() {
  LibratoMetrics.period = $(this).attr("title");
  if (! $('#toolbar ul li.timepanel a.play').hasClass('pause')) {
    $('.toolbar ul li.timepanel a.play').addClass('pause');
  }
  $('.toolbar ul li.timepanel a.play').text('paused');
  $(this).parent('li').parent('ul').find('li').removeClass('selected');
  $(this).parent('li').addClass('selected');
  LibratoMetrics.refreshData("now");
  clearInterval(refreshId);
});

// time panel, resume live feed
$('.toolbar ul li.timepanel').on('click', 'a.play', function() {
  $(this).parent('li').parent('ul').find('li').removeClass('selected');
  $(this).parent('li').addClass('selected');
  $(this).removeClass('pause');
  $('.toolbar ul li.timepanel a.play').text(LibratoMetrics.period + 'min');
  LibratoMetrics.refreshData("now");
  // explicitly clear the old Interval in case
  // someone "doubles up" on the live play button
  clearInterval(refreshId);
  // remove and recreate the original graphs[]
  // helps clear out any rendering artifacts
  $('.graph svg').remove();
  LibratoMetrics.constructGraphs();
  // reapply our style settings if night mode is active
  if ($('body').hasClass('night')) { enableNightMode(); }
  // restart our refresh interval
  refreshId = setInterval(LibratoMetrics.refreshData, refreshInterval);
});

