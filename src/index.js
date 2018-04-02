import * as d3 from 'd3';
import stateNames from './data/state-names.js';

let selected = false;

const svg = d3.select('#us-map')
  .append('svg')
  .attr('id', 'chart')
  .attr('viewBox', '0 0 960 600');

const description = svg.append('g')
  .attr('class', 'description')
  .attr('transform', 'translate(800, 420)');


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
      if (selected) {
        return;
      }
      var id = +d.id;
      var state = stateNames[id];
      var colorObj = apiData.color_code[state];
      if (colorObj) {
        d3.select(this).attr('fill', colorObj.color).attr('cursor', 'pointer');
        renderDescription(apiData, state, colorObj.color);
      }
    })
    .on('mouseout', clearSelection)
    .on('click', function (d) {
      if (selected) {
        return;
      }
      var id = +d.id;
      var state = stateNames[id];
      selected = this;
      filterTable(state);
      $('.btn-clear-selection').show();
    })

  svg.append("path")
    .attr("class", "state-borders")
    .attr("d", path(topojson.mesh(mapData, mapData.objects.states, function (a, b) { return a !== b; })));

}

function clearSelection() {
  if (selected) {
    return;
  }
  d3.select(this).attr('fill', '#dadada').attr('cursor', 'default');
  //$('#us-map-popup').addClass('hidden');
  animatePopup();
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
      lists += ('<li><span>' + key + '</span>' + '<span>' + counts[key] + '</span></li>');
    })
    $('#us-map-popup .list-data').html(lists);
  }

}

function drawBars(apiData) {
  //generate table
  const maxCrime = d3.max(Object.values(apiData.total));
  const crimeScale = d3.scaleLinear()
    .domain([0, maxCrime])
    .range([0, 100]); // map between 0 and 100% width

  const colorScale = d3.scaleOrdinal()
    .domain(apiData.program_types)
    .range(d3.schemeCategory10);


  apiData.states.forEach((s) => {
    const stateId = s.toLowerCase().replace(/\s/g, '-');
    $('#bars-table tbody').append(`
      <tr class="${stateId}">
        <td>${s}</td>
        <td>
          <div class="bar-graph">${generateBars(apiData.counts[s], crimeScale, colorScale)}</div>
        </td>
        <td>${apiData.total[s]}</td>
      </tr>
    `)
  });

  animateBars();

  $('.btn-clear-selection').click(function () {
    d3.select(selected).attr('fill', '#dadada').attr('cursor', 'default');
    $(this).hide();
    $('#us-map-popup').addClass('hidden');
    selected = false;
    filterTable();
  })
}

function generateBars(state, crimeScale, colorScale) {
  let divs = '';
  Object.keys(state).forEach((s) => {
    const val = state[s];
    divs += `
      <div class="bar" data-width="${crimeScale(val)}" style="width: 0%; background: ${colorScale(s)};">
        <span>${s}: ${val}</span>
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

function animateBars() {
  $('.bar-graph .bar').each(function(bar) {
    const width = $(this).attr('data-width');
    $(this)
      .velocity({
        'width': width + '%'
      }, {
        duration: 700
      })
  });
}

initAPI();


