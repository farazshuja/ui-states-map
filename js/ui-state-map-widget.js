let _scripts = [
  {
    url: 'https://code.jquery.com/jquery-3.3.1.min.js',
    _g: '$'
  },
  {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/d3/4.13.0/d3.min.js',
    _g: 'd3'
  },
  {
    url: 'https://d3js.org/topojson.v2.min.js',
    _g: 'd3-topo'
  }
];

function createScriptTag() {
  // gets the first script in the list
  let script = _scripts.shift();
  // all scripts were loaded
  if (!script) {
    renderMap();
    return;
  }

  // if its already loaded don't load it
  if (window[script._g]) {
    createScriptTag();
  }
  let js = document.createElement('script');
  js.type = 'text/javascript';
  js.src = script.url;
  js.onload = (event) => {
    // loads the next script
    createScriptTag();
  };
  let s = document.getElementsByTagName('head')[0];
  s.append(js);
}

createScriptTag();

/* Map Related Code */
//var API_URL = 'https://dtc-court-map-staging.herokuapp.com/api/v1/counts_by_program_type?type[]=Adult+Drug&type[]=Veterans+Treatment';

function renderMap() {

  var svg = d3.select(COURTS_MAP_PLACEHOLDER)
    .append('svg')
    .attr('id', 'chart')
    .attr('viewBox', '0 0 960 600');
  
  var legendWidth = 300;
  var legendHeight = 45;

  var path = d3.geoPath();
  var apiData = null;
  var stateNames = null;
  var distinct_colors = [];

  // synchoronouly load data
  function initAPI() {
    $.when(
      $.getJSON('/api/v1/boundaries.json'),
      $.getJSON('/api/v1/state_names.json'),
      $.getJSON(COURTS_MAP_API)
    )
      .done(function (_mapData, _stateNames, _apiData) {
        apiData = _apiData[0];
        stateNames = _stateNames[0];
        drawMap(_mapData[0]);
      });
  }

  function drawMap(mapData) {
    svg.on('click', function (d) {
      window.location = apiData.link;
    });

    var stateGroup = svg.selectAll('g.state')
    var statePath = stateGroup
      .data(topojson.feature(mapData, mapData.objects.states).features)
      .enter()
      .append('g')
      .attr('class', function (d) {
        var id = +d.id;
        var state = stateNames[id].name.toLowerCase().replace(' ', '-');
        return 'state ' + state;
      })
      .on('mouseover', function (d) {
        d3.select(this).classed('state-hover', true);
      })
      .on('mouseout', function (d) {
        d3.select(this).classed('state-hover', false);
      })

    statePath
      .append('path')
      .attr("d", path)
      .attr("class", "state-path")

    statePath.append('line')
      .attr('class', 'state-line')
      .attr("x1", function (d) {
        var id = +d.id;
        var rx = stateNames[id].rx;
        return path.centroid(d)[0] + rx;
      })
      .attr("y1", function (d) {
        var id = +d.id;
        var ry = stateNames[id].ry;
        return path.centroid(d)[1] + ry;
      })
      .attr("x2", function (d) {
        var id = +d.id;
        var lx = stateNames[id].lx;
        var lw = stateNames[id].lw;
        return path.centroid(d)[0] + lx + lw;
      })
      .attr("y2", function (d) {
        var id = +d.id;
        var ly = stateNames[id].ly;
        var lw = stateNames[id].lw;
        return path.centroid(d)[1] + ly + lw;
      });

    statePath.append("rect")
      .attr('class', 'state-text-rect')
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('width', 30)
      .attr('height', 20)
      .attr("x", function (d) {
        var id = +d.id;
        var lx = stateNames[id].lx;
        var lw = stateNames[id].lw;
        if (lw > 0) {
          return path.centroid(d)[0] + lx + lw - 15;
        }
        return path.centroid(d)[0] - 15;

      })
      .attr("y", function (d) {
        var id = +d.id;
        var ly = stateNames[id].ly;
        var lw = stateNames[id].lw;
        if (lw > 0) {
          return path.centroid(d)[1] + ly + lw - 15;
        }
        return path.centroid(d)[1] - 15;
      });

    statePath.append("text")
      .attr('class', 'state-text')
      .attr("x", function (d) {
        var id = +d.id;
        var lx = stateNames[id].lx;
        var lw = stateNames[id].lw;
        if (lw > 0) {
          return path.centroid(d)[0] + lx + lw;
        }
        return path.centroid(d)[0];
      })
      .attr("y", function (d) {
        var id = +d.id;
        var ly = stateNames[id].ly;
        var lw = stateNames[id].lw;
        if (lw > 0) {
          return path.centroid(d)[1] + ly + lw;
        }
        return path.centroid(d)[1];
      })
      .text(function (d) {
        var id = +d.id;
        var state = stateNames[id].name;
        return apiData.counts[state];
      });
    svg.append("path")
      .attr("class", "state-borders")
      .attr("d", path(topojson.mesh(mapData, mapData.objects.states, function (a, b) { return a !== b; })));

  }
  initAPI();
}