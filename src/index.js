import * as d3 from 'd3';
import stateNames from './data/state-names.js';

let filteredOn = null;
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

// synchoronouly load data
async function initAPI() {
  const mapDataResponse = await fetch('./data/us-10m.v1.json');
  const mapData = await mapDataResponse.json();

  const apiResponse = await fetch('./data/api_response.json');
  const apiData = await apiResponse.json();

  drawMap(mapData, apiData);
  drawBars(apiData);
}

function drawMap(mapData, apiData) {
  svg.append("g")
    .attr("class", "states")
    .selectAll("path")
    .data(topojson.feature(mapData, mapData.objects.states).features)
    .enter().append("path")
    .attr("d", path)
    .on('mouseover', function (d) {
      var id = +d.id;
      var state = stateNames[id];
      var colorObj = apiData.color_code[state];
      if (colorObj) {
        d3.select(this).attr('fill', colorObj.color).attr('cursor', 'pointer');
        renderDescription(apiData, state, colorObj.color);
      }
    })
    .on('mouseout', function () {
      d3.select(this).attr('fill', '#dadada').attr('cursor', 'default');
      animatePopup();
    });

  svg.append("path")
    .attr("class", "state-borders")
    .attr("d", path(topojson.mesh(mapData, mapData.objects.states, function (a, b) { return a !== b; })));

  // draw legend
  drawLegend(apiData);

}

function drawLegend (apiData) {
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

function renderDescription(data, state, color) {
  var coordinators = data.coordinators[state];
  var counts = data.counts[state];

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
      lists += ('<li><span>' + key + '</span>' + '<span class="count">' + counts[key] + '</span></li>');
    })
    $('#us-map-popup .list-data').html(lists);
  }

}

// generate html structure of the bars table
function drawBarsTable(apiData) {
  apiData.states.forEach((s, i) => {
    const stateId = s.toLowerCase().replace(/\s/g, '-');
    $('#bars-table tbody').append(`
      <tr class="${stateId}">
        <td>${s}</td>
        <td>
          <div id="state-bar-${i}" class="bar-graph"></div>
        </td>
        <td><span class="total" data-total="${apiData.total[s]}">${apiData.total[s]}</span></td>
      </tr>
    `);
  });
}
function drawBars(apiData) {
  console.log(apiData);
  //generate table
  const maxCrime = d3.max(Object.values(apiData.total));
  const crimeScale = d3.scaleLinear()
    .domain([0, maxCrime])
    .range([0, 100]); // map between 0 and 100% width

  const colorScale = d3.scaleOrdinal()
    .domain(apiData.program_types)
    .range(d3.schemeCategory10);


  apiData.states.forEach((s, i) => {
    const stateId = s.toLowerCase().replace(/\s/g, '-');
    $('#bars-table tbody').append(`
      <tr class="${stateId}">
        <td>${s}</td>
        <td>
          <div id="state-bar-${i}" class="bar-graph">${generateBars(apiData.counts[s], crimeScale, colorScale)}</div>
        </td>
        <td><span class="total" data-total="${apiData.total[s]}">${apiData.total[s]}</span></td>
      </tr>
    `);
    $(`#state-bar-${i}`).on('click', '.bar', function () {
      if (filteredOn) {
        return;
      }

      filteredOn = true;
      filterBars(this, apiData)
    })

  });

  animateBars();

  $('.btn-clear-selection').click(function () {
    $(this).hide();
    animateBars();
    filteredOn = false;
  });
}

function generateBars(state, crimeScale, colorScale) {
  let divs = '';
  Object.keys(state).forEach((s) => {
    const val = state[s];
    divs += `
      <div class="bar" data-type="${s}" data-width="${crimeScale(val)}" style="width: 0%; background: ${colorScale(s)};">
        <span data-val="${val}">${s}: ${val}</span>
      </div>
    `;
  });
  return divs;
}

function filterTable(state) {
  const $tr = $('#bars-table tbody tr');
  $tr.hide();

  if (state) {
    state = state.toLowerCase().replace(/\s/g, '-');
    $tr.filter(`.${state}`).show()
  }
  else {
    $tr.show();
  }
}

function filterBars(bar, apiData) {
  //animate bars to
  animateBars(0);

  var type = $(bar).attr('data-type');

  //w8 for 800ms and animate bars
  setTimeout(function () {
    const maxCrime = d3.max(Object.values(apiData.counts).map(o => o[type]));
    console.log(maxCrime);
    const crimeScale = d3.scaleLinear()
      .domain([0, maxCrime])
      .range([0, 100]); // map between 0 and 100% width

    animateBars(null, type, crimeScale);
  }, 800)
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

function animateBars(_w, type, crimeScale) {

  const filter = type ? `[data-type="${type}"]` : '.bar';

  $('.bar-graph .bar').filter(filter).each(function (bar) {
    let width = 0;
    if (crimeScale) {
      const v = $(this).children('span').attr('data-val');
      console.log(v);
      width = crimeScale(v);
      $(this).closest('tr').find('.total').text(v)
    }
    else if (typeof _w === 'undefined') {
      width = $(this).attr('data-width');
    }

    $(this)
      .velocity({
        'width': width + '%',
        'border-width': width === 0 ? '0px' : '1px'
      }, {
          duration: 700
        })

  });

  // update total to zero in case of zero
  $('#bars-table .total').each(function () {
    const $total = $(this);
    if (crimeScale) {
      if ($total.attr('data-total') == $total.text()) {
        $total.text('0');
      }
    }
    else {
      $total.text($total.attr('data-total'));
    }
  });

  if (crimeScale) {
    $('.btn-clear-selection').text('x ' + type).show();
  }

}

initAPI();


