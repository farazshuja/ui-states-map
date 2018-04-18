var stateNames = {"1": "Alabama","2": "Alaska","4": "Arizona","5": "Arkansas","6": "California","8": "Colorado","9": "Connecticut","10": "Delaware","11": "District of Columbia","12": "Florida","13": "Georgia","15": "Hawaii","16": "Idaho","17": "Illinois","18": "Indiana","19": "Iowa","20": "Kansas","21": "Kentucky","22": "Louisiana","23": "Maine","24": "Maryland","25": "Massachusetts","26": "Michigan","27": "Minnesota","28": "Mississippi","29": "Missouri","30": "Montana","31": "Nebraska","32": "Nevada","33": "New Hampshire","34": "New Jersey","35": "New Mexico","36": "New York","37": "North Carolina","38": "North Dakota","39": "Ohio","40": "Oklahoma","41": "Oregon","42": "Pennsylvania","44": "Rhode Island","45": "South Carolina","46": "South Dakota","47": "Tennessee","48": "Texas","49": "Utah","50": "Vermont","51": "Virginia","53": "Washington","54": "West Virginia","55": "Wisconsin","56": "Wyoming","60": "American Samoa","66": "Guam","69": "Northern Mariana Islands","72": "Puerto Rico","74": "U.S. Minor Outlying Islands","78": "U.S. Virgin Islands"};

var filteredOn = null;
// filter: { sort_type: 'title | total', sort_order: 'asc | desc', state: 'state name'}
var filter = {
  sort_type: 'title',
  sort_order: 'asc',
  state: null
};

var colors_pavarte = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf", "#749da1", "#424c51", "#eb9191"];
var svg = d3.select('#us-map')
  .append('svg')
  .attr('id', 'chart')
  .attr('viewBox', '0 0 960 600');

var legendWidth = 300;
var legendHeight = 45;
var legendSVG = d3.select('#us-map-legend')
  .append('svg')
  .attr('id', 'chart')
  .attr('viewBox', `0 0 ${legendWidth} ${legendHeight}`);


var path = d3.geoPath();
var apiData = null;

// synchoronouly load data
function initAPI() {
  $.getJSON('./data/us-10m.v1.json', function(data) {
    var mapData = data;

    $.getJSON('./data/api_response.json', function (response) {
      apiData = response;

      drawMap(mapData);
      drawBarsTable(apiData);
    });
  });
}

function drawMap(mapData) {
  svg.append("g")
    .attr("class", "states")
    .selectAll("path")
    .data(topojson.feature(mapData, mapData.objects.states).features)
    .enter().append("path")
    .attr("d", path)
    .attr("class", "state-path")
    .attr('fill', function (d) {
      var id = +d.id;
      var state = stateNames[id];
      var colorObj = apiData.color_code[state];
      if (colorObj) {
        return colorObj.color;
      }
    })
    .on('mouseover', function (d) {
      var id = +d.id;
      var state = stateNames[id];
      var colorObj = apiData.color_code[state];
      renderDescription(state);
    })
    .on('mouseout', function () {
      animatePopup();
    });

  svg.append("path")
    .attr("class", "state-borders")
    .attr("d", path(topojson.mesh(mapData, mapData.objects.states, function (a, b) { return a !== b; })));

  // draw legend
  drawLegend();

}

function drawLegend() {
  var distinct_colors = Object.values(apiData.color_code).reduce(function(last, obj) {
    var c = obj.color;
    if (last.indexOf(c) == -1) {
      last.push(c);
    }
    return last;
  }, []);

  var legendScale = d3.scaleBand()
    .domain(d3.range(distinct_colors.length))
    .range([0, legendWidth]);

  legendSVG.append("g")
    .attr('class', 'legend')
    .selectAll('rect')
    .data(distinct_colors)
    .enter()
    .append('rect')
    .attr('width', legendScale.bandwidth())
    .attr('height', 20)
    .attr('x', function (d, i) {
      return legendScale(i)      
    })
    .attr('y', 0)
    .attr('fill', function(d) { return d; });

  legendSVG.append("g")
    .append('text')
    .attr('class', 'legend-text')
    .attr('x', 0)
    .attr('y', 40)
    .text('Weakest');

  legendSVG.append("g")
    .append('text')
    .attr('class', 'legend-text')
    .attr('x', 300)
    .attr('y', 40)
    .text('Strongest')
    .attr('text-anchor', 'end');
}

function renderDescription(state) {
  var coordinators = apiData.coordinators[state];
  var counts = apiData.counts[state];

  if (coordinators) {
    animatePopup(true);
    $('#us-map-popup h1').html(state);
    $('#us-map-popup .description').html(
      coordinators.first_name + ' ' + coordinators.last_name + '<br />' +
      coordinators.title + '<br />' +
      coordinators.email + '<br />' +
      coordinators.phone
    )
  }

  var lists = '';
  if (counts) {
    Object.keys(counts).forEach(function(key) {
      var val = counts[key];
      lists += ('<li>' + key + '<span class="count">' + counts[key] + '</span></li>');
    });
    $('#us-map-popup .list-data').html(lists);
  }

}

// generate html structure of the bars table
function drawBarsTable() {
  apiData.states.forEach(function() {
    $('#bars-table tbody').append(`
      <tr class="state-row">
        <td class="state-name"></td>
        <td></td>
        <td class="total"></td>
      </tr>
    `);
  });
  updateBars();
  
  $('a[data-sort]').click(function () {
    var $a = $(this);    
    var direction = $a.hasClass('asc') ? 'desc' : 'asc';
    $('a[data-sort]').removeClass('sort asc desc');

    $a.addClass('sort').addClass(direction);
    filter.sort_type = $a.attr('data-sort');
    filter.sort_order = direction;

    updateBars();
  });
}

// filter bars based on different attributes like sort type, sort order, selected state
function filterBarsData() {
  var data = [];
  Object.keys(apiData.counts).forEach(function(s) {
    var courts = apiData.counts[s];
    var courtsArr = [];
    var courtsSum = 0;

    Object.keys(courts).forEach(function(court) {
      courtsArr.push({
        title: court,
        count: courts[court]
      });
    });

    courtsArr = courtsArr.filter(function(d) {
      return !filter.state || d.title === filter.state
    });
    courtsSum = courtsArr.reduce(function(last, arr) {
      return last + arr.count;
    }, 0);

    data.push({
      title: s,
      counts: courtsArr,
      total: courtsSum
    });
  });
  
  data.sort(function(a, b) {
    if (filter.sort_type === 'total') {
      return filter.sort_order == 'asc' ? a.total - b.total : b.total - a.total;
    }
    else {
      return filter.sort_order == 'asc'
        ? (a.title > b.title) - (a.title < b.title)
        : (a.title < b.title) - (a.title > b.title)
    }
  });
  
  return data;
}

function updateBars() {
  var barsData = filterBarsData();
  var program_types = apiData.program_types;
  console.log(barsData);
  var colorScale = d3.scaleOrdinal()
    .domain(program_types)
    .range(colors_pavarte);

  var maxCourts = d3.max(barsData.map(function(b) { return b.total; }));
  var courtsScale = d3.scaleLinear()
    .domain([0, maxCourts])
    .range([0, 100]); // map between 0 and 100% width*/

  var cells = d3.selectAll('.state-row')
    .data(barsData)
    .selectAll('td')
    .data(function (row) {
      return [
        { column: 'title', value: row.title },
        { column: 'counts', value: row.counts },
        { column: 'total', value: row.total }
      ]
    })
  //.append('div');

  d3.selectAll('div.bar').remove();

  // generate state names and total
  var textCells = cells.filter(function(d) {
    return d.column === 'title' || d.column === 'total';
  })
  .text(function(d) { return d.value; });

  textCells.exit().remove();

  var countCells = cells.filter(function(d) { return d.column === 'counts'});
  countCells
    .append('div')
    .attr('class', 'bar-graph')
    .selectAll('div')
    .data(function(d) {
      return d.value;
    })
    .enter()
    .append('div')
    .attr('class', 'bar')
    .on('click', function(d) {
      selectBarLegend(d.title);
    })
    .style('background', function(d) { return colorScale(d.title); })
    .style('width', '0%')
    .transition(800)    
    .style('width', function(d) { return `${courtsScale(d.count)}%`; })
    .attr('title', function(d) { return `${d.title}: ${d.count}`; });

  drawBarsLegend(colorScale);
}

function drawBarsLegend(colorScale) {
  // if its generated already, just return back
  if($('#bar-legend').children().length > 0) {
    return;
  }

  apiData.program_types.forEach(function(type) {
    var $item = $(`
      <div data-type="${type}"><span style="background:${colorScale(type)}"></span>${type}</div>
    `);
    $item.click(function () {
      var type = $(this).attr('data-type');
      selectBarLegend(type);      
    });
    $('#bar-legend').append($item);
  });

  $('.btn-clear-selection').click(function () {
    $(this).hide();
    filter.state = null;
    updateBars();
  });
}

function selectBarLegend(type) {
  $('#bar-legend > div').removeClass('selected');
  $(`#bar-legend > div[data-type="${type}"]`).addClass('selected');
  $('.btn-clear-selection').text('x ' + type).show();  

  filter.state = type;
  updateBars();  
}

// show / hide popup with animation
function animatePopup(show) {
  $('#us-map-popup')
    .velocity("stop", true).velocity({
      opacity: show ? 1 : 0,
      'margin-top': show ? '0px' : '10px'
    },
      {
        display: show ? 'block' : 'none',
        duration: 200
      });
}

initAPI();


