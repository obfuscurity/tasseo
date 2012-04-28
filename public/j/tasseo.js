
// add our containers
for (var i=0; i<metrics.length; i++) {
  $('#main').append('<div id="graph" class="graph' + i + '"><div id="overlay-name" class="overlay-name' + i + '"></div><div id="overlay-number" class="overlay-number' + i + '"></div></div>');
}

// build our structures
var graphs = [];
var datum = [];
var urls = [];
var hovers = [];
for (var j=0; j<metrics.length; j++) {

  // our server
  var period = metrics[j].period || 5;
  urls[j] = url + "/render/?target=" + encodeURI(metrics[j].target) + "&from=-" + period + "minutes&format=json";

  // construct our graph
  var alias = metrics[j].alias || metrics[j].target;
  datum[j] = [{ x:0, y:0 }];
  graphs[j] = new Rickshaw.Graph({
    element: document.querySelector(".graph" + j),
    width: 350,
    height: 80,
    interpolation: 'step-after',
    series: [{
      name: alias,
      color: '#afdab1',
      data: datum[j]
    }]
  });
  graphs[j].render();
}

// refresh the graph
var myRefresh = (typeof refresh == "undefined") ? 2000 : refresh;
var int = self.setInterval("refreshData()", myRefresh);
function refreshData() {
  for (var k=0; k<graphs.length; k++) {
    getData(function(n, values) {
      for (var x=0; x<values.length; x++) {
        datum[n][x] = values[x];
      }

      // check our thresholds and update color
      if (metrics[n].critical > metrics[n].warning) {
        if (datum[n][datum.length].y > metrics[n].critical) {
          graphs[n].series[0].color = "#d59295";
        } else if (datum[n][datum.length].y > metrics[n].warning) {
          graphs[n].series[0].color = "#f5cb56";
        }
      } else {
        if (datum[n][datum.length].y < metrics[n].critical) {
          graphs[n].series[0].color = "#d59295";
        } else if (datum[n][datum.length].y < metrics[n].warning) {
          graphs[n].series[0].color = "#f5cb56";
        }
      }

      // update our graph
      graphs[n].update();
      alias = metrics[n].alias || metrics[n].target;
      $(".overlay-name" + n).text(alias);
      $(".overlay-number" + n).text(parseInt(datum[n][datum.length].y));
      if (metrics[n].unit) {
        $(".overlay-number" + n).append('<span class="unit">' + metrics[n].unit + '</span>');
      }
    }, k);
  }
}

// pull 5min of data from graphite
function getData(cb, n) {
  var myDatum = [];
  $.ajax({
    dataType: 'jsonp',
    jsonp: 'jsonp',
    error: function(xhr, textStatus, errorThrown) { console.log(errorThrown); },
    url: urls[n]
    }).done(function(d) {
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
  });
}

