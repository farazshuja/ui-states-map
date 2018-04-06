import * as d3 from 'd3';
import stateNames from './data/state-names.js';

let filteredOn = null;
const colors_palette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f","#bcbd22", "#17becf", "#749da1", "#424c51", "#eb9191"];
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
        renderDescription(apiData, state, colorObj.color);
      }
    })
    .on('mouseout', function () {
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
      lists += ('<li>' + key + '<span class="count">' + counts[key] + '</span></li>');
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
    .range(colors_palette);


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
    $('.btn-clear-selection').prev('span').show();
    $(this).hide();
    animateBars();
    filteredOn = false;
    $('#bar-legend > div').removeClass('selected');
  });

  drawBarsLegend(apiData.program_types, colorScale, apiData);

  // hook sort filters
  $('a[data-sort]').click(function() {
    const sort_type = $(this).attr('data-sort');
    const sort_order = $(this).hasClass('asc') ? 'desc' : 'asc';

    
    let arr = [];    
    $('#bars-table tbody tr').each((index, item) => {
      const $el = sort_type == 'state' ? $(item).children('td').eq(0) : $(item).find('.total');
      arr.push({
        index: index,
        value: sort_type == 'state' ? $el.text() : +$el.text()
      })
    });

    arr.sort((a, b) => {
      if(typeof a === 'number') {
        return sort_order == 'asc' ? a.value - b.value : b.value - a.value;
      }
      else {
        return sort_order == 'asc' 
          ? (a.value > b.value) - (a.value < b.value)
          : (a.value < b.value) - (a.value > b.value)
      }      
    });
    
    console.log(arr);
    
    /*while(arr.length > 0) {
      const $tr = $('#bars-table tbody tr');
      const lastIndex = arr.length - 1; // 35
      const lastItem = arr.pop();      // index: 0

      // if they are not same
      if (lastItem.index !== lastIndex) {
        arr.splice(lastItem.index, 1);
        const $row1 = $tr.eq(lastIndex);
        const $row2 = $tr.eq(lastItem.index);
        const $row1Clone = $row1.clone(true);
        const $row2Clone = $row2.clone(true);

        $row1.css('background', '#aaa');
        $row2.css('background', '#aaa');

        $row1Clone.insertBefore($row2);
        $row2Clone.insertBefore($row1);

        console.log($row1.attr('class'));
        $row1.remove();
        $row2.remove();
      }

    }*/

    $(this).removeClass('asc desc').addClass(sort_order);
        
  });  
}

function drawBarsLegend (program_types, colorScale, apiData) {
  program_types.forEach(type => {
    const $item = $(`
      <div data-type="${type}"><span style="background:${colorScale(type)}"></span>${type}</div>
    `);
    $item.click(function() {
      filterBars(null, apiData, type);
    });
    $('#bar-legend').append($item);
  })
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

function filterBars(bar, apiData, _type) {
  //animate bars to
  animateBars(0);

  const type = _type || $(bar).attr('data-type');

  //highlight bars legend
  $('#bar-legend > div').removeClass('selected');
  $(`#bar-legend > div[data-type="${type}"]`).addClass('selected');

  //w8 for 800ms and animate bars
  setTimeout(function () {
    const maxCrime = d3.max(Object.values(apiData.counts).map(o => o[type]));
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
    $('.btn-clear-selection').prev('span').hide();
    $('.btn-clear-selection').text('x ' + type).show();
  }

}

initAPI();


