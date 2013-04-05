
var graphs = [];        // rickshaw objects
var datum = [];         // metric data
var aliases = [];       // alias strings
var descriptions = [];  // description strings
var realMetrics = [];   // non-false targets

// minutes of data in the live feed
var period = (typeof period == 'undefined') ? 5 : period;

// gather our non-false targets
function gatherRealMetrics() {
  var falseTargets = 0;
  for (var i=0; i<metrics.length; i++) {
    if (metrics[i].target === false) {
    falseTargets++;
    } else {
      realMetrics[i - falseTargets] = metrics[i];
    }
  }
}

// build our graph objects
function constructGraphs() {
  for (var i=0; i<realMetrics.length; i++) {
    aliases[i] = realMetrics[i].alias || realMetrics[i].target;
    descriptions[i] = realMetrics[i].description || null;
    datum[i] = [{ x:0, y:0 }];
    graphs[i] = new Rickshaw.Graph({
      element: document.querySelector('.graph' + i),
      width: 348,
      height: 100,
      interpolation: 'step-after',
      renderer: 'area',
      stroke: true,
      series: [{
        name: aliases[i],
        color: '#afdab1',
        data: datum[i]
      }]
    });
    graphs[i].render();
  }
}

// construct url
var myUrl;
var padnulls = (typeof padnulls == 'undefined') ? true : padnulls;
function constructUrl(period) {
  var targets = '';
  for (var i=0; i<realMetrics.length; i++) {
    if (i != 0) {
      targets += '&';
    }
    if (padnulls === true) {
      targets += ('target=keepLastValue(' + encodeURI(realMetrics[i].target) + ')');
    } else {
      targets += ('target=' + encodeURI(realMetrics[i].target));
    }
  }
  myUrl = url + '/render/?' + targets + '&from=-' + period + 'minutes&format=json';
}

// refresh the graph
function refreshData(immediately) {

  getData(function(values) {
    for (var i=0; i<graphs.length; i++) {
      for (var j=0; j<values[i].length; j++) {
        if (typeof values[i][j] !== 'undefined') {
          datum[i][j] = values[i][j];
        }
      }

      // check our thresholds and update color
      var lastValue = datum[i][datum[i].length - 1].y;
      var warning = realMetrics[i].warning;
      var critical = realMetrics[i].critical;
      if (critical > warning) {
        if (lastValue >= critical) {
          graphs[i].series[0].color = '#d59295';
        } else if (lastValue >= warning) {
          graphs[i].series[0].color = '#f5cb56';
        } else {
          graphs[i].series[0].color = '#afdab1';
        }
      } else {
        if (lastValue <= critical) {
          graphs[i].series[0].color = '#d59295';
        } else if (lastValue <= warning) {
          graphs[i].series[0].color = '#f5cb56';
        } else {
          graphs[i].series[0].color = '#afdab1';
        }
      }
      // we want to render immediately, i.e.
      // as soon as ajax completes
      // used for time period / pause view
      if (immediately) {
        updateGraphs(i);
      }
    }
    values = null;
  });

  // we can wait until all data is gathered, i.e.
  // the live refresh should happen synchronously
  if (!immediately) {
    for (var i=0; i<graphs.length; i++) {
      updateGraphs(i);
    }
  }
}

// retrieve dashboard list
function getDashboards(cb) {
  $.ajax({
    dataType: 'json',
    error: function(xhr, textStatus, errorThrown) { console.log(errorThrown); },
    url: '/'
  }).done(function(d) {
    cb(d.dashboards);
  });
}

// retrieve the data from Graphite
function getData(cb) {
  var myDatum = [];
  $.ajax({
    beforeSend: function(xhr) {
      if (auth.length > 0) {
        var bytes = Crypto.charenc.Binary.stringToBytes(auth);
        var base64 = Crypto.util.bytesToBase64(bytes);
        xhr.setRequestHeader('Authorization', 'Basic ' + base64);
      }
    },
    dataType: 'json',
    error: function(xhr, textStatus, errorThrown) { console.log(errorThrown); },
    url: myUrl
  }).done(function(d) {
    if (d.length > 0) {
      for (var i=0; i<d.length; i++) {
        myDatum[i] = [];
        for (var j=0; j<d[i].datapoints.length; j++) {
          myDatum[i][j] = { x: d[i].datapoints[j][1], y: d[i].datapoints[j][0] };
        }
      } 
    }
    cb(myDatum);
  });
}

// perform the actual graph object and
// overlay name and number updates
function updateGraphs(i) {
  // update our graph
  graphs[i].update();
  if (datum[i][datum[i].length - 1] !== undefined) {
    var lastValue = datum[i][datum[i].length - 1].y;
    var lastValueDisplay;
    if ((typeof lastValue == 'number') && lastValue < 2.0) {
      lastValueDisplay = Math.round(lastValue*1000)/1000;
    } else {
      lastValueDisplay = parseInt(lastValue);
    }
    if (realMetrics[i].description) {
      $('.description' + i).html('Note:<br /><br />' + descriptions[i]);
    }
    $('.overlay-name' + i).text(aliases[i]);
    $('.overlay-number' + i).text(lastValueDisplay);
    if (realMetrics[i].unit) {
      $('.overlay-number' + i).append('<span class="unit">' + realMetrics[i].unit + '</span>');
    }
  } else {
    $('.overlay-name' + i).text(aliases[i]);
    $('.overlay-number' + i).html('<span class="error">NF</span>');
  }
}

// add our containers
function buildContainers() {
  var falseTargets = 0;
  for (var i=0; i<metrics.length; i++) {
    if (metrics[i].target === false) {
      $('.main').append('<div class="false"></div>');
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
      $('.main').append(graph_div);
    }
  }
}

// filter out false targets
gatherRealMetrics();

// build our div containers
buildContainers();

// build our graph objects
constructGraphs();

// build our url
constructUrl(period);

// set our theme
var myTheme = (typeof theme == 'undefined') ? 'default' : theme;
if (myTheme === 'dark') { enableNightMode(); }

// hide our toolbar if necessary
var toolbar = (typeof toolbar == 'undefined') ? true : toolbar;
if (!toolbar) { $('div.toolbar').css('display', 'none'); }

// initial load screen
for (var i=0; i<graphs.length; i++) {
  if (realMetrics[i].target === false) {
    //continue;
  } else if (myTheme === 'dark') {
    $('.overlay-number' + i + ' span').html('<img src="/i/spin-night.gif" />');
  } else {
    $('.overlay-number' + i).html('<img src="/i/spin.gif" />');
  }
}
refreshData('now');

// define our refresh and start interval
var refreshInterval = (typeof refresh == 'undefined') ? 2000 : refresh;
var refreshId = setInterval(refreshData, refreshInterval);

// set our 'live' interval hint
$('.toolbar ul li.timepanel a.play').text(period + 'min');

// populate and render our navigation list
$('.title').on('hover', 'span', function() {
  getDashboards(function(list) {
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
  var period = $(this).attr('title');
  constructUrl(period);
  if (! $('.toolbar ul li.timepanel a.play').hasClass('pause')) {
    $('.toolbar ul li.timepanel a.play').addClass('pause');
  }
  $('.toolbar ul li.timepanel a.play').text('paused');
  $(this).parent('li').parent('ul').find('li').removeClass('selected');
  $(this).parent('li').addClass('selected');
  refreshData('now');
  clearInterval(refreshId);
});

// time panel, resume live feed
$('.toolbar ul li.timepanel').on('click', 'a.play', function() {
  constructUrl(5);
  $(this).parent('li').parent('ul').find('li').removeClass('selected');
  $(this).parent('li').addClass('selected');
  $(this).removeClass('pause');
  $('.toolbar ul li.timepanel a.play').text(period + 'min');
  refreshData('now');
  // explicitly clear the old Interval in case
  // someone 'doubles up' on the live play button
  clearInterval(refreshId);
  // remove and recreate the original graphs[]
  // helps clear out any rendering artifacts
  $('.graph svg').remove();
  constructGraphs();
  // reapply our style settings if night mode is active
  if ($('body').hasClass('night')) { enableNightMode(); }
  // restart our refresh interval
  refreshId = setInterval(refreshData, refreshInterval);
});

