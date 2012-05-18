
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
  for (var i=0; i<metrics.length; i++) {
    constructUrl(i, period);
    aliases[i] = metrics[i].alias || metrics[i].target;
    datum[i] = [{ x:0, y:0 }];
    graphs[i] = new Rickshaw.Graph({
      element: document.querySelector('.graph' + i),
      width: 350,
      height: 100,
      interpolation: 'step-after',
      series: [{
        name: aliases[i],
        color: '#afdab1',
        data: datum[i]
      }]
    });
    graphs[i].render();
  }
}

// refresh the graph
function refreshData(immediately) {

  for (var i=0; i<graphs.length; i++) {
    getData(function(j, values) {
      for (var k=0; k<values.length; k++) {
        datum[j][k] = values[k];
      }

      // check our thresholds and update color
      var lastValue = datum[j][datum[j].length - 1].y;
      var warning = metrics[j].warning;
      var critical = metrics[j].critical;
      if (critical > warning) {
        if (lastValue > critical) {
          graphs[j].series[0].color = '#d59295';
        } else if (lastValue > warning) {
          graphs[j].series[0].color = '#f5cb56';
        } else {
          graphs[j].series[0].color = '#afdab1';
        }
      } else {
        if (lastValue < critical) {
          graphs[j].series[0].color = '#d59295';
        } else if (lastValue < warning) {
          graphs[j].series[0].color = '#f5cb56';
        } else {
          graphs[j].series[0].color = '#afdab1';
        }
      }
      // we want to render immediately, i.e.
      // as soon as ajax completes
      // used for time period / pause view
      if (immediately) {
        updateGraphs(j);
      }
      j = null;
      values = null;
    }, i);
  }
  // we can wait until all data is gathered, i.e.
  // the live refresh should happen synchronously
  if (!immediately) {
    for (var i=0; i<graphs.length; i++) {
      updateGraphs(i);
    }
  }
}

// pull data from graphite
function getData(cb, i) {
  var myDatum = [];
  if (metrics[i].target !== false) {
    $.ajax({
      beforeSend : function(xhr) {
        if (auth.length > 0) {
          var bytes = Crypto.charenc.Binary.stringToBytes(auth);
          var base64 = Crypto.util.bytesToBase64(bytes);
          xhr.setRequestHeader("Authorization", "Basic " + base64);
        }
      },
      dataType: 'json',
      error: function(xhr, textStatus, errorThrown) { console.log(errorThrown); },
      url: urls[i]
    }).done(function(d) {
      if (d.length > 0) {
        myDatum[0] = {
          x: d[0].datapoints[0][1],
          y: d[0].datapoints[0][0] || graphs[i].lastKnownValue || 0
        };
        for (var j=1; j<d[0].datapoints.length; j++) {
          myDatum[j] = {
            x: d[0].datapoints[j][1],
            y: d[0].datapoints[j][0] || graphs[i].lastKnownValue
          };
          if (typeof d[0].datapoints[j][0] === "number") {
            graphs[i].lastKnownValue = d[0].datapoints[j][0];
          }
        }
        cb(i, myDatum);
      }
    });
  }
}

// perform the actual graph object and
// overlay name and number updates
function updateGraphs(i) {
  // update our graph
  graphs[i].update();
  if (metrics[i].target === false) {
    //continue;
  } else if (datum[i][datum[i].length - 1] !== undefined) {
    var lastValue = datum[i][datum[i].length - 1].y;
    var lastValueDisplay;
    if ((typeof lastValue == 'number') && lastValue < 2.0) {
      lastValueDisplay = Math.round(lastValue*1000)/1000;
    } else {
      lastValueDisplay = parseInt(lastValue)
    }
    $('.overlay-name' + i).text(aliases[i]);
    $('.overlay-number' + i).text(lastValueDisplay);
    if (metrics[i].unit) {
      $('.overlay-number' + i).append('<span class="unit">' + metrics[i].unit + '</span>');
    }
  } else {
    $('.overlay-name' + i).text(aliases[i])
    $('.overlay-number' + i).html('<span class="error">NF</span>');
  }
}

// add our containers
for (var i=0; i<metrics.length; i++) {
  $('#main').append('<div id="graph" class="graph' + i + '"><div id="overlay-name" class="overlay-name' + i + '"></div><div id="overlay-number" class="overlay-number' + i + '"></div></div>');
}

// build our graph objects
constructGraphs();

// set our last known value at invocation
Rickshaw.Graph.prototype.lastKnownValue = 0;

// set our theme
var myTheme = (typeof theme == 'undefined') ? 'default' : theme;
if (myTheme === "dark") { enableNightMode(); }

// initial load screen
refreshData();
for (var i=0; i<graphs.length; i++) {
  if (metrics[i].target === false) {
  } else if (myTheme === "dark") {
    $('.overlay-number' + i).html('<img src="/i/spin-night.gif" />');
  } else {
    $('.overlay-number' + i).html('<img src="/i/spin.gif" />');
  }
}

// define our refresh and start interval
var refreshInterval = (typeof refresh == 'undefined') ? 2000 : refresh;
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

