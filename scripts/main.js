const CC_API_BASE = "https://us-west-2.aws.realm.mongodb.com/api/client/v2.0/app/ccscorecard-experimental-gubqp"
/** constant {string} */
const CC_API_LOGIN = CC_API_BASE + "/auth/providers/api-key/login"
/** constant {string} */
const CC_API_GQL = CC_API_BASE + "/graphql";
/** constant {string} */
const CC_API_KEY = "A1RJYVgCktjnwsajZuqOPrqHE14NANh0I0lOIde5Fbxdz1r80jItkfe4QiZz6gdV";
/** constant {integer} */
const SMALL_BREAKPOINT = 599;
/** constant {integer} */
const LEGIS_LIMIT = 1000;
/** constant {object} */
var CC_API_TOKENS = null;

/** 
 * Gets auth tokens needed for making API queries and stores them globally.
 *
 * @async
 * @function
 */
async function getAuthTokens() {
  const response = await fetch(CC_API_LOGIN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: `{
      "key": "${CC_API_KEY}"
    }`,
  });

  if(!response.ok) {
    throw Error(
      "Encountered an the following issue when " +
      "retrieving API access tokens: " + response.statusText
    );
  }

  CC_API_TOKENS = await response.json();
}

/** 
 * Makes an API call, returns the response as JSON if successful.
 *
 * @async
 * @function
 * @param {string} payload - a stringified version of a valid GraphQL query document
 * @param {Object} variables - an Object containing the GraphQL variables
     necessary for the execution of the query
 * @returns {Object} - the API response to the query, parsed as JSON
 * @throws Will throw Error if reponse status code is not within 200 and 299
 */
async function callAPI(payload, variables = {}) {
  const responseRaw = await fetch(CC_API_GQL, {
    method: 'POST',
    headers: {
      'Authorization': "Bearer " + CC_API_TOKENS.access_token,
      'Content-Type' : 'application/json',
    },
    body: JSON.stringify({ 
      query: payload, 
      variables: variables
    })
  });

  if(!responseRaw.ok) {
    throw Error(
      "The server could not handle the API request - " + responseRaw.statusText
    );
  }

  const response = await responseRaw.json();

  if(response.errors) {
    throw Error(
      "There was an issue with the body of the API request - " +
      response.errors.map((err) => err.message).toString()
    );
  }
  return response.data;
}

/**
 * Fills a target html element with a loading animation until a callback completes.
 *
 * @async
 * @function
 * @param {string} target - the CSS selector string for the HTML element to be
 *   filled with an animation.
 * @param {function} callback - the async callback function to be executed before
 *   unloading the animation.
 */
async function loadAndUnload(target, callback) {
  // alter the target to display the animation and hide contents
  const $toHide = $(target)
                    .children()
                    .filter(function(index) {
                      return $( this ).css('display') != 'none';
                    });
  $toHide.hide();
  $(target).append($('<div class="loading"></div>'));

  // wait for the callback
  await callback();
  
  // redisplay the target's contents and remove animation
  $('.loading')
    .css('position', 'absolute')  // so it's not pushed by elems fading in
    .fadeOut('slow');
  $toHide.fadeIn('slow');
}

/**
 * Once a state's representatives have been retrived, display them.
 * @function
 */
function displayStateLegislators() {
  // remove placeholder elements
  $('#search-prompt').css('display', 'none');

  // display results elements
  $('#search-results').fadeIn({
    duration: 'fast',
    start: () => $('#search-results').css('display', 'flex')
  });
}

/**
 * When a district or chamber is specified, reset the filtered viewed.
 */
function refreshLegislatorFilters() {
  const currDistrict = $('#district-input').val();
  const currChamber = $('#chamber-input').val();
  const stateLegis = $('#results-body > .results-row');

  stateLegis.show();

  if(currChamber) {
    stateLegis.filter(function() {
        return $(this).attr('chamber') != currChamber;
    }).hide();
  }

  if(currDistrict) {
    stateLegis.filter(function() {
        return $(this).attr('district') != currDistrict;
    }).hide();
  }
}

/**
 * Applies approriate table formatting for the current Browser size.
 */
function formatTableForBrowserSize() {
  // if the table is displayed
  if($('#search-results').css('display') != 'none'){
    // get whether this is for mobile or not
    if($(window).width() <= SMALL_BREAKPOINT){
      $('.district-cell, .election-cell').hide();
      $('.results-cell > p:nth-child(2)').show();
      $('.results-cell > button').html('\>');
    } else {
      $('.district-cell, .election-cell').show();
      $('.results-cell > p:nth-child(2)').hide();
      $('.results-cell > button').html('TAKE ACTION');
    }
  }
}

/**
 * Toggles the enabled/disabled state of the form.
*/

function showFullForm(shouldShow){
  // hide the placeholder prompt
  if(shouldShow) {
    $('#search-prompt').hide();
    $('#search-button')
      .html('RESET')
      .addClass('reset-button');
    // display results elements
    $('#search-results').fadeIn({
      duration: 'fast',
      start: () => $('#search-results').css('display', 'flex')
    });
  } else {
    $('#search-prompt').show();
    $('#search-button')
      .html('SEARCH')
      .removeClass('reset-button');
    $('#search-results').hide();
  }

  $('#chamber-input, #district-input, #search-button')
    .attr('disabled', !shouldShow);

}

/**
 * When the user selects a state, fetch legislators and progress the UI.
 */
async function handleStateSelection() {
  showFullForm(true);

  await loadAndUnload('#search-results', async function() {
    // clear event listeners and contents from chamber and dist inputs
    ['#chamber-input', '#district-input'].forEach((id) => {
      $(id).off();
      $(id)
        .children()
        .filter(function() {
          return $(this).attr('value');
        })
        .remove();
    });

    // clear the currently displayed reps, if any
    $('#results-body')
      .children()
      .filter(function() {
        return $(this).attr('id') != 'results-headers';
      })
      .remove();

    // get all legislators from the API
    const allLegis = await callAPI(`
      query ($stateAbbr: String){
        representatives(
          query: {state_abbr: $stateAbbr, office: {is_current: true}}
          limit: ${LEGIS_LIMIT})
        {
          full_name
          role
          cc_score
          office {
            seat_number
            district {
              shortcode
              presidential_elections {
                year
                dem_share
                rep_share
              }
            }
          }
        }
      }
    `,
    {
      'stateAbbr': $('#state-input').val(),
    });

    // sort the list of legi's by district number
    allLegis['representatives'].sort((a, b) => {
      let aDistCode = a['office']['district']['shortcode'].slice(2);
      let aDistNum = parseInt(aDistCode.replace(/[^0-9]/, ''));
      let aDistLetter = aDistCode.replace(/[0-9]/, '');

      let bDistCode = b['office']['district']['shortcode'].slice(2);
      let bDistNum = parseInt(bDistCode.replace(/[^0-9]/, ''));
      let bDistLetter = bDistCode.replace(/[0-9]/, '');

      return aDistNum - bDistNum || aDistLetter.localeCompare(bDistLetter);
    });

    // render legislators to the results div
    allLegis['representatives'].forEach((legi) => {
      let distShortcode = `${$('#state-input > option:selected').text()} ${legi['office']['district']['shortcode']}`;
      // replace the score value with '-' if NaN
      let ccScore = legi['cc_score'] ? parseInt(legi['cc_score']) : '-';
      // render the elections number, if possible - otherwise use a '-'
      let electionCode = '-';
      let electionList = legi['office']['district']['presidential_elections'];

      if(electionList && electionList.filter(e => e['year'] === 2016)) {
        let elctObj = electionList.filter(e => e['year'] === 2016).pop();
        let elctLetter = elctObj['dem_share'] > elctObj['rep_share'] ? 'D' : 'R';
        let elctNumber = Math.max(elctObj['dem_share'], elctObj['rep_share']) - Math.min(elctObj['dem_share'], elctObj['rep_share']);
        elctNumber = (elctNumber*100).toFixed(2);

        electionCode = `${elctLetter}+%${elctNumber}`;
      }

      $('#results-body').append(
        $('<div class="results-row"></div>')
          .append(
            $('<div class="results-cell name-cell"></div>')
                .append($(`<p>${legi['full_name']}</p>`))
                .append($(`<p>${distShortcode}</p>`))
          )
          .append(
            $('<div class="results-cell district-cell"></div>')
              .append($(`<p>${distShortcode}</p>`))
          )
          .append(
            $('<div class="results-cell election-cell"></div>')
              .append($(`<p>${electionCode}</p>`))
          )
          .append(
            $('<div class="results-cell score-cell"></div>')
                .append($(`<p>${ccScore}</p>`))
                .append($(`<p>${electionCode}</p>`))
          )
          .append($('<div class="results-cell"><button>\></button></div>'))
          .attr('district', legi['office']['seat_number'].toLowerCase())
          .attr('chamber', legi['role'] === 'Senator' ? 'upper' : 'lower')
      );
    });

    // update the list of chamber options
    ['Lower', 'Upper'].forEach((chamber) => {
      $('#chamber-input').append(
        `<option value="${chamber.toLowerCase()}">${chamber}</option>`
      );
    });

    // populate the district filter dropdown with a list of districts
    let distNums = allLegis['representatives']
                    .map((legi) => legi['office']['seat_number']);
    distNums
      .filter((d, i) => distNums.indexOf(d) === i)
      .sort((a, b) => {
        return parseInt(a.replace(/[^0-9]/, '')) - parseInt(b.replace(/[^0-9]/, '')) ||
          a.replace(/[0-9]/, '').localeCompare(b.replace(/[0-9]/, ''));
      })
      .forEach((distNum) => {
        $('#district-input').append(
          `<option value="${distNum.toLowerCase()}">${distNum}</option>`
        );
      });

    // start listening for changes to the district/ chamber filters
    $('#chamber-input').on('change', refreshLegislatorFilters);
    $('#district-input').on('change', refreshLegislatorFilters);

    formatTableForBrowserSize();
  });
}

// When a state is selected, enable the search button
$('#state-input').on('change', () => $('#search-form > button').attr('disabled', false));

/**
 * When the Reset button is clicked, reset the page.
 */
$('#search-form > button').on('click', async function(e) {
  e.preventDefault();

  if($('#search-form > button').html() == "SEARCH") {
    handleStateSelection();
  } else {
    showFullForm(false);

    // reset the dropdown menu options
    $('#chamber-input, #district-input')
      .children()
      .filter(function() {
        return $(this).attr('hidden') != 'hidden';
      })
      .remove();
    $('#chamber-input, #district-input').attr('disabled', true);
    $('#state-input').val('');
  }
});

/**
 * Whenever the page resizes, make sure the proper table formatting is applied.
 */
$(window).resize(formatTableForBrowserSize);

/**
 * When the DOM is ready, initialize the page components.
 */
$(document).ready(async function(){
  // set main div to loading
  await loadAndUnload("#search-container", async function() {
    // get the access tokens for making API requests
    await getAuthTokens();

    // retrieve the states list from the database
    const states = await callAPI(`
      query {
        regions (query: {_cls: "Region.State"}){
          name
          state_abbr
        }
      }
    `);

    // populate the state dropdown
    states.regions.forEach((reg) => {
      $("#state-input").append($(`<option value=${reg.state_abbr}>${reg.name}</option>`));
    });
  });

  // handle URL state query, if present
  const currUrl = new URL(window.location.href);
  const queryState = currUrl.searchParams.get('state');

  if(queryState) {
    // set the state selector
    $('#state-input').val(queryState);
    // call handle state selection
    handleStateSelection();
  }
});
