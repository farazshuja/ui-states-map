import * as d3 from 'd3';
import stateNames from './data/state-names.js';

let filteredOn = null;
// filter: { sort_type: 'title | total', sort_order: 'asc | desc', state: 'state name'}
let filter = {
  sort_type: 'title',
  sort_order: 'asc',
  state: null
};

const colors_palette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf", "#749da1", "#424c51", "#eb9191"];
const svg = d3.select('#us-map')
  .append('svg')
  .attr('id', 'chart')
  .attr('viewBox', '0 0 960 600');

const legendWidth = 300;
const legendHeight = 45;
const legendSVG = d3.select('#us-map-legend')
  .append('svg')
  .attr('id', 'chart')
  .attr('viewBox', `0 0 ${legendWidth} ${legendHeight}`);


var path = d3.geoPath();
let apiData = null;

// synchoronouly load data
async function initAPI() {
  const mapDataResponse = await fetch('./data/us-10m.v1.json');
  const mapData = await mapDataResponse.json();

  const apiResponse = await fetch('./data/api_response.json');
  apiData = await apiResponse.json();

  drawMap(mapData);  
  drawBarsTable(apiData);
}

function drawMap(mapData) {
  svg.append("g")
    .attr("class", "states")
    .selectAll("path")
    .data(topojson.feature(mapData, mapData.objects.states).features)
    .enter().append("path")
    .attr("d", path)
    .attr("class", "state-path")
    .attr('fill', (d) => {
      var id = +d.id;
      var state = stateNames[id];
      var colorObj = apiData.color_code[state];
      if (colorObj) {
        return colorObj.color;
      }
    })
    .on('mouseover', (d) => {
      var id = +d.id;
      var state = stateNames[id];
      var colorObj = apiData.color_code[state];
      if (colorObj) {
        renderDescription(state, colorObj.color);
      }
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
  const distinct_colors = Object.values(apiData.color_code).reduce((last, obj) => {
    let c = obj.color;
    if (last.indexOf(c) == -1) {
      last.push(c);
    }
    return last;
  }, []);

  const legendScale = d3.scaleBand()
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
    .attr('x', (d, i) => legendScale(i))
    .attr('y', 0)
    .attr('fill', d => d);

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

function renderDescription(state, color) {
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
    Object.keys(counts).forEach((key) => {
      const val = counts[key];
      lists += ('<li>' + key + '<span class="count">' + counts[key] + '</span></li>');
    })
    $('#us-map-popup .list-data').html(lists);
  }

}

// generate html structure of the bars table
function drawBarsTable() {
  apiData.states.forEach(() => {
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
    let $a = $(this);    
    const direction = $a.hasClass('asc') ? 'desc' : 'asc';
    $('a[data-sort]').removeClass('sort asc desc');

    $a.addClass('sort').addClass(direction);
    filter.sort_type = $a.attr('data-sort');
    filter.sort_order = direction;

    updateBars();
  });
}

// filter bars based on different attributes like sort type, sort order, selected state
function filterBarsData() {
  let data = [];
  Object.keys(apiData.counts).forEach(s => {
    let courts = apiData.counts[s];
    let courtsArr = [];
    let courtsSum = 0;
    //let filteredCourts = courts.filter(d => !filter.state || d.title === filter.state);

    Object.keys(courts).forEach(court => {
      courtsArr.push({
        title: court,
        count: courts[court]
      });
    });

    courtsArr = courtsArr.filter(d => !filter.state || d.title === filter.state);
    courtsSum = courtsArr.reduce((last, arr) => {
      return last + arr.count;
    }, 0);

    data.push({
      title: s,
      counts: courtsArr,
      total: courtsSum
    });
  });
  
  data.sort((a, b) => {
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
  let barsData = filterBarsData();
  const program_types = apiData.program_types;
  console.log(barsData);
  const colorScale = d3.scaleOrdinal()
    .domain(program_types)
    .range(colors_palette);

  const maxCourts = d3.max(barsData.map(b => b.total));
  const courtsScale = d3.scaleLinear()
    .domain([0, maxCourts])
    .range([0, 100]); // map between 0 and 100% width*/

  const cells = d3.selectAll('.state-row')
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
  let textCells = cells.filter(d => {
    return d.column === 'title' || d.column === 'total';
  })
  .text(d => d.value);

  textCells.exit().remove();

  let countCells = cells.filter(d => d.column === 'counts');
  countCells
    .append('div')
    .attr('class', 'bar-graph')
    .selectAll('div')
    .data(d => {
      return d.value;
    })
    .enter()
    .append('div')
    .attr('class', 'bar')
    .on('click', function(d) {
      selectBarLegend(d.title);
    })
    .style('background', d => colorScale(d.title))
    .style('width', '0%')
    .transition(800)    
    .style('width', d => `${courtsScale(d.count)}%`)
    .attr('title', d => `${d.title}: ${d.count}`);

  drawBarsLegend(colorScale);
}

function drawBarsLegend(colorScale) {
  // if its generated already, just return back
  if($('#bar-legend').children().length > 0) {
    return;
  }

  apiData.program_types.forEach(type => {
    const $item = $(`
      <div data-type="${type}"><span style="background:${colorScale(type)}"></span>${type}</div>
    `);
    $item.click(function () {
      const type = $(this).attr('data-type');
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


