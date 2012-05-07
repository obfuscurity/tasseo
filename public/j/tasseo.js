
// add our containers
for (var i=0; i<metrics.length; i++) {
  $('#main').append('<div id="graph" class="graph' + i + '"><div id="overlay-name" class="overlay-name' + i + '"></div><div id="overlay-number" class="overlay-number' + i + '"></div></div>');
}

var graphs = [];   // rickshaw objects
var datum = [];    // metric data
var urls = [];     // graphite urls
var aliases = [];  // alias strings

// minutes of data in the live feed
var period = (typeof period == 'undefined') ? 5 : period;

// construct a url
function constructUrl(index, period) {
  urls[index] = url + '/render/?target=' + encodeURI(metrics[index].target) + '&from=-' + period + 'minutes&format=json';
}

// build our graph objects
function constructGraphs() {
  for (var j=0; j<metrics.length; j++) {
    constructUrl(j, period);
    aliases[j] = metrics[j].alias || metrics[j].target;
    datum[j] = [{ x:0, y:0 }];
    graphs[j] = new Rickshaw.Graph({
      element: document.querySelector('.graph' + j),
      width: 350,
      height: 100,
      interpolation: 'step-after',
      series: [{
        name: aliases[j],
        color: '#afdab1',
        data: datum[j]
      }]
    });
    graphs[j].render();
  }
}

constructGraphs();

// set our last known value at invocation
Rickshaw.Graph.prototype.lastKnownValue = 0;

// refresh the graph
function refreshData(immediately) {

  for (var k=0; k<graphs.length; k++) {
    getData(function(n, values) {
      for (var x=0; x<values.length; x++) {
        datum[n][x] = values[x];
      }

      // check our thresholds and update color
      var lastValue = datum[n][datum[n].length - 1].y;
      var warning = metrics[n].warning;
      var critical = metrics[n].critical;
      if (critical > warning) {
        if (lastValue > critical) {
          graphs[n].series[0].color = '#d59295';
        } else if (lastValue > warning) {
          graphs[n].series[0].color = '#f5cb56';
        } else {
          graphs[n].series[0].color = '#afdab1';
        }
      } else {
        if (lastValue < critical) {
          graphs[n].series[0].color = '#d59295';
        } else if (lastValue < warning) {
          graphs[n].series[0].color = '#f5cb56';
        } else {
          graphs[n].series[0].color = '#afdab1';
        }
      }
      // we want to render immediately, i.e.
      // as soon as ajax completes
      // used for time period / pause view
      if (immediately) {
        updateGraphs(n);
      }
    }, k);
  }
  // we can wait until all data is gathered, i.e.
  // the live refresh should happen synchronously
  if (!immediately) {
    for (var q=0; q<graphs.length; q++) {
      updateGraphs(q);
    }
  }
}

// perform the actual graph object and
// overlay name and number updates
function updateGraphs(m) {
  // update our graph
  graphs[m].update();
  if (metrics[m].target === false) {
    //continue;
  } else if (datum[m][datum[m].length - 1] !== undefined) {
    var lastValue = datum[m][datum[m].length - 1].y;
    var lastValueDisplay;
    if ((typeof lastValue == 'number') && lastValue < 2.0) {
      lastValueDisplay = Math.round(lastValue*1000)/1000;
    } else {
      lastValueDisplay = parseInt(lastValue)
    }
    $('.overlay-name' + m).text(aliases[m]);
    $('.overlay-number' + m).text(lastValueDisplay);
    if (metrics[m].unit) {
      $('.overlay-number' + m).append('<span class="unit">' + metrics[m].unit + '</span>');
    }
  } else {
    $('.overlay-name' + m).text(aliases[m])
    $('.overlay-number' + m).html('<span class="error">NF</span>');
  }
}

// set our theme
var myTheme = (typeof theme == 'undefined') ? 'default' : theme;
if (myTheme === "dark") { enableNightMode(); }

// initial load screen
refreshData();
for (var g=0; g<graphs.length; g++) {
  if (metrics[g].target === false) {
  } else if (myTheme === "dark") {
    $('.overlay-number' + g).html('<img src="/i/spin-night.gif" />');
  } else {
    $('.overlay-number' + g).html('<img src="/i/spin.gif" />');
  }
}

// define our refresh and start interval
var refreshInterval = (typeof refresh == 'undefined') ? 2000 : refresh;
var refreshId = setInterval(refreshData, refreshInterval);

// set our "live" interval hint
$('#toolbar ul li.timepanel a.play').text(period + 'min');

// pull data from graphite
function getData(cb, n) {
  var myDatum = [];
  if (metrics[n].target !== false) {
    $.ajax({
      dataType: 'jsonp',
      jsonp: 'jsonp',
      error: function(xhr, textStatus, errorThrown) { console.log(errorThrown); },
      url: urls[n]
    }).done(function(d) {
      if (d.length > 0) {
        myDatum[0] = {
          x: d[0].datapoints[0][1],
          y: d[0].datapoints[0][0] || graphs[n].lastKnownValue || 0
        };
        for (var m=1; m<d[0].datapoints.length; m++) {
          myDatum[m] = {
            x: d[0].datapoints[m][1],
            y: d[0].datapoints[m][0] || graphs[n].lastKnownValue
          };
          if (typeof d[0].datapoints[m][0] === "number") {
            graphs[n].lastKnownValue = d[0].datapoints[m][0];
          }
        }
        cb(n, myDatum);
      }
    });
  }
}

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
  console.log(this);
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
  var period = $(this).attr("title");
  for (var n=0; n<metrics.length; n++) {
    constructUrl(n, period);
  }
  if (! $('#toolbar ul li.timepanel a.play').hasClass('pause')) {
    $('#toolbar ul li.timepanel a.play').addClass('pause');
  }
  $('#toolbar ul li.timepanel a.play').text('paused');
  $(this).parent('li').parent('ul').find('li').removeClass('selected');
  $(this).parent('li').addClass('selected');
  refreshData("now");
  clearInterval(refreshId);
});

// time panel, resume live feed
$('#toolbar ul li.timepanel a.play').click(function() {
  for (var p=0; p<metrics.length; p++) {
    constructUrl(p, 5);
  }
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

