// add our containers
for (var i=0; i<metrics.length; i++) {
  $('#main').append('<div id="graph" class="graph' + i + '"><div id="overlay-name" class="overlay-name' + i + '"></div><div id="overlay-number" class="overlay-number' + i + '"></div></div>');
}

var graphs = [];   // rickshaw objects
var datum = [];    // metric data
var urls = [];     // graphite urls
var aliases = [];  // alias strings

// build our structures
for (var j=0; j<metrics.length; j++) {
  var period = metrics[j].period || 5;
  urls[j] = url + '/render/?target=' + encodeURI(metrics[j].target) + '&from=-' + period + 'minutes&format=json';
  aliases[j] = metrics[j].alias || metrics[j].target;
  datum[j] = [{ x:0, y:0 }];
  graphs[j] = new Rickshaw.Graph({
    element: document.querySelector('.graph' + j),
    width: 350,
    height: 80,
    interpolation: 'step-after',
    series: [{
      name: aliases[j],
      color: '#afdab1',
      data: datum[j]
    }]
  });
  graphs[j].render();
}

// refresh the graph
function refreshData() {

  for (var k=0; k<graphs.length; k++) {
    getData(function(n, values) {
      for (var x=0; x<values.length; x++) {
        datum[n][x] = values[x];
      }

      // check our thresholds and update color
      if (metrics[n].critical > metrics[n].warning) {
        if (datum[n][datum.length].y > metrics[n].critical) {
          graphs[n].series[0].color = '#d59295';
        } else if (datum[n][datum.length].y > metrics[n].warning) {
          graphs[n].series[0].color = '#f5cb56';
        }
      } else {
        if (datum[n][datum.length].y < metrics[n].critical) {
          graphs[n].series[0].color = '#d59295';
        } else if (datum[n][datum.length].y < metrics[n].warning) {
          graphs[n].series[0].color = '#f5cb56';
        }
      }
    }, k);
  }

  for (var m=0; m<graphs.length; m++) {
    // update our graph
    graphs[m].update();
    if (datum[m][datum.length] !== undefined) {
      var lastValue = datum[m][datum.length].y;
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
      $('.overlay-name' + m).html(aliases[m] + " <br /><b>not found</b>");
    }
  }
}

var refreshInterval = (typeof refresh == 'undefined') ? 2000 : refresh;
setInterval(refreshData, refreshInterval);

// pull data from graphite
function getData(cb, n) {
  var myDatum = [];
  $.ajax({
    dataType: 'jsonp',
    jsonp: 'jsonp',
    error: function(xhr, textStatus, errorThrown) { console.log(errorThrown); },
    url: urls[n]
  }).done(function(d) {
    if (d.length > 0) {
      myDatum[0] = {
        x: d[0].datapoints[0][1],
        y: d[0].datapoints[0][0] || 0
      };
      for (var m=1; m<d[0].datapoints.length; m++) {
        if (d[0].datapoints[m]) {
          myDatum[m] = {
            x: d[0].datapoints[m][1],
            y: d[0].datapoints[m][0] || d[0].datapoints[m - 1][0]
          };
        }
      }
      cb(n, myDatum);
    }
  });
}

// toggle night mode
$('li.toggle-night a').toggle(function() {
  $('body').toggleClass('night');
  $('div#title h1').toggleClass('night');
  $('div#graph svg').css('opacity', '0.6');
  $('div#overlay-name').toggleClass('night');
  $('div#overlay-number').toggleClass('night');
}, function() {
  $('body').toggleClass('night');
  $('div#title h1').toggleClass('night');
  $('div#graph svg').css('opacity', '1.0');
  $('div#overlay-name').toggleClass('night');
  $('div#overlay-number').toggleClass('night');
});

// toggle number display
$('li.toggle-nonum a').click(function() { $('div#overlay-number').toggleClass('nonum'); });

