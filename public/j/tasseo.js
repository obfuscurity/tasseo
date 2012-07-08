
var graphs = {};      // rickshaw objects
var datum = {};       // metric data
var aliases = {};     // alias strings
var realMetrics = {}; // non-false targets

// minutes of data in the live feed
var period = (typeof period == 'undefined') ? 20 : period;

// gather our non-false targets
function gatherRealMetrics() {
  for (var metric in metrics) {
    if (metrics[metric].target === false) {
    } else {
      var name = metrics[metric].target + '-' + metrics[metric].source
      realMetrics[name] = metrics[metric];
      realMetrics[name]['selector'] = metrics[metric].target.replace(/\./g, '-');
    }
  }
}

// build our graph objects
function constructGraphs() {
  for (var metric in realMetrics) {
    var name = realMetrics[metric].target + '-' + realMetrics[metric].source
    var alias = realMetrics[metric].alias || realMetrics[metric].target;
    aliases[name] = alias;
    datum[name] = [{ x:0, y:0 }];
    graphs[name] = new Rickshaw.Graph({
      element: document.querySelector('.graph' + realMetrics[metric].selector),
      width: 348,
      height: 100,
      interpolation: 'step-after',
      series: [{
        name: aliases[name],
        color: '#afdab1',
        data: datum[name]
      }]
    });
    graphs[name].render();
  }
}

// construct url
function constructUrl(metric) {
  var source = realMetrics[metric].source;
  var target = realMetrics[metric].target;
  var now = new Date();
  var offset = now.getTimezoneOffset();
  now = parseInt((now.getTime() + offset * 60) / 1000);
  var start = now - (period * 60);
  var end = now;
  return url + '/' + encodeURI(target) + '?source=' + source + '&resolution=1&start_time=' + start + '&end_time=' + end;
}

// refresh the graph
function refreshData(immediately) {
  for (var metric in realMetrics) {
    getData(metric, function(values) {
      for (var i = 0; i < values.length; i++) {
        if (typeof values[i] !== "undefined") {
          datum[metric][i] = values[i];
        }
      }
      // check our thresholds and update color
      var lastValue = datum[metric][datum[metric].length - 1].y;
      var warning = realMetrics[metric].warning;
      var critical = realMetrics[metric].critical;
      if (critical > warning) {
        if (lastValue >= critical) {
          graphs[metric].series[0].color = '#d59295';
        } else if (lastValue >= warning) {
          graphs[metric].series[0].color = '#f5cb56';
        } else {
          graphs[metric].series[0].color = '#afdab1';
        }
      } else {
        if (lastValue <= critical) {
          graphs[metric].series[0].color = '#d59295';
        } else if (lastValue <= warning) {
          graphs[metric].series[0].color = '#f5cb56';
        } else {
          graphs[metric].series[0].color = '#afdab1';
        }
      }
      // we want to render immediately, i.e.
      // as soon as ajax completes
      // used for time period / pause view
      if (immediately) updateGraph(metric);
    });
    values = null;
  }

  // we can wait until all data is gathered, i.e.
  // the live refresh should happen synchronously
  if (!immediately) {
    for (var graph in graphs) {
      updateGraph(graph);
    }
  }
}

function displayTransform(value, period, transform) {
  if (transform !== undefined && transform.length > 0) {
    var p = period, x = value;
    return eval(transform);
  } else {
    return value;
  }
}
// retrieve the data from Graphite
function getData(metric, cb) {
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
    url: constructUrl(metric),
    cache: false
  }).done(function(d) {
    var source = realMetrics[metric].source;
    var transform = d.attributes.display_transform;
    var period = d.period;
    myDatum[0] = {
      x: d.measurements[source][0].measure_time,
      y: displayTransform(d.measurements[source][0].value, period, transform) || 0
    };
    for (var j = 1; j < d.measurements[source].length; j++) {
      myDatum[j] = {
        x: d.measurements[source][j].measure_time,
        y: displayTransform(d.measurements[source][j].value, period, transform) || graphs[metric].lastKnownValue
      };
      if (typeof d.measurements[source][0].value === "number") {
        graphs[metric].lastKnownValue = d.measurements[source][0].value;
      }
    }
    cb(myDatum);
  });
}

// perform the actual graph object and
// overlay name and number updates
function updateGraph(graph) {
  // update our graph
  graphs[graph].update();
  if (datum[graph][datum[graph].length - 1] !== undefined) {
    var lastValue = datum[graph][datum[graph].length - 1].y;
    var lastValueDisplay = Math.round(lastValue * 100) / 100;
    $('.overlay-name' + realMetrics[graph].selector).text(aliases[graph]);
    $('.overlay-number' + realMetrics[graph].selector).text(lastValueDisplay);
    if (realMetrics[graph].unit) {
      $('.overlay-number' + realMetrics[graph].selector).append('<span class="unit">' + realMetrics[graph].unit + '</span>');
    }
  } else {
    $('.overlay-name' + realMetrics[graph].selector).text(aliases[graph]);
    $('.overlay-number' + realMetrics[graph].selector).html('<span class="error">NF</span>');
  }
}

// add our containers
function buildContainers() {
  var falseTargets = 0;
  for (var metric in metrics) {
    if (metrics[metric].target === false) {
      $('#main').append('<div id="false"></div>');
      falseTargets++;
    } else {
      $('#main').append(
        '<div id="graph" class="graph' + metrics[metric].selector + '">' +
        '<div id="overlay-name" class="overlay-name' + metrics[metric].selector + '"></div>' +
        '<div id="overlay-number" class="overlay-number' + metrics[metric].selector + '"></div>' +
        '</div>'
      );
    }
  }
}

// filter out false targets
gatherRealMetrics();

// build our div containers
buildContainers();

// build our graph objects
constructGraphs();

// set our last known value at invocation
Rickshaw.Graph.prototype.lastKnownValue = 0;

// set our theme
var myTheme = (typeof theme == 'undefined') ? 'default' : theme;
if (myTheme === "dark") { enableNightMode(); }

// hide our toolbar if necessary
var toolbar = (typeof toolbar == 'undefined') ? true : toolbar;
if (!toolbar) { $('div#toolbar').css('display', 'none'); }

// initial load screen
for (var graph in graphs) {
  if (realMetrics[graph].target === false) {
    //continue;
  } else if (myTheme === "dark") {
    $('.overlay-number' + realMetrics[graph].selector).html('<img src="/i/spin-night.gif" />');
  } else {
    $('.overlay-number' + realMetrics[graph].selector).html('<img src="/i/spin.gif" />');
  }
}
refreshData("now");

// define our refresh and start interval
var refreshInterval = (typeof refresh == 'undefined') ? 20000 : refresh;
var refreshId = setInterval(refreshData, refreshInterval);

// set our "live" interval hint
$('#toolbar ul li.timepanel a.play').text(period + 'min');

// activate night mode
function enableNightMode() {
  $('body').addClass('night');
  $('div#title h1').addClass('night');
  $('div#graph svg').css('opacity', '0.8');
  $('div#overlay-name').addClass('night');
  $('div#overlay-number').addClass('night');
  $('div#toolbar ul li.timepanel').addClass('night');
}

// deactivate night mode
function disableNightMode() {
  $('body').removeClass('night');
  $('div#title h1').removeClass('night');
  $('div#graph svg').css('opacity', '1.0');
  $('div#overlay-name').removeClass('night');
  $('div#overlay-number').removeClass('night');
  $('div#toolbar ul li.timepanel').removeClass('night');
}

// activate night mode by click
$('li.toggle-night a').click(function() {
  if ($('body').hasClass('night')) {
    disableNightMode();
  } else {
    enableNightMode();
  }
});

// toggle number display
$('li.toggle-nonum a').click(function() { $('div#overlay-number').toggleClass('nonum'); });

// time panel, pause live feed and show range
$('#toolbar ul li.timepanel a.range').click(function() {
  period = $(this).attr("title");
  refreshData("now")
  if (! $('#toolbar ul li.timepanel a.play').hasClass('pause')) {
    $('#toolbar ul li.timepanel a.play').addClass('pause');
  }
  $('#toolbar ul li.timepanel a.play').text('paused');
  $(this).parent('li').parent('ul').find('li').removeClass('selected');
  $(this).parent('li').addClass('selected');
  clearInterval(refreshId);
});

// time panel, resume live feed
$('#toolbar ul li.timepanel a.play').click(function() {
  period = 20;
  $(this).parent('li').parent('ul').find('li').removeClass('selected');
  $(this).parent('li').addClass('selected');
  $(this).removeClass('pause');
  $('#toolbar ul li.timepanel a.play').text(period + 'min');
  refreshData("now");
  // explicitly clear the old Interval in case
  // someone "doubles up" on the live play button
  clearInterval(refreshId);
  // remove and recreate the original graphs[]
  // helps clear out any rendering artifacts
  $('#graph svg').remove();
  constructGraphs();
  // reapply our style settings if night mode is active
  if ($('body').hasClass('night')) { enableNightMode(); }
  // restart our refresh interval
  refreshId = setInterval(refreshData, refreshInterval);
});

