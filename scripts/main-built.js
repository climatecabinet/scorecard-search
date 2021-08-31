const CC_API_BASE = "https://us-west-2.aws.realm.mongodb.com/api/client/v2.0/app/climate-cabinet-production-esyps";
/** constant {string} */
const CC_API_LOGIN = CC_API_BASE + "/auth/providers/api-key/login";
/** constant {string} */
const CC_API_GQL = CC_API_BASE + "/graphql";
/** constant {string} */
const CC_API_KEY = "e5WolP3ekUwIQNvx7O01FgnhOFFwv9r43gV6PDlX4jIi1cWmMdPcXli6epxIRtDz";
/** constant {integer} */
const SMALL_BREAKPOINT = 599;
/** constant {integer} */
const MID_BREAKPOINT = 899;
/** constant {integer} */
const LEGIS_LIMIT = 1000;
/** constant {object} */
var CC_API_TOKENS = null;

const LEGISLATOR_PAGE_URL_PREFIX = 'https://www.climatecabinetaction.org/legislator-pages/'

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
                    .filter(function() {
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
 * When a user selects a chamber, restrict district dropdown choices to only
 * the districts in the chamber.
 */
function filterSelectableDistricts() {
  const currChamber = $('#chamber-input').val();

  $('#district-input')
    .children()
    .show()
    .filter(function() {
      if ($(this).attr('chamber')) {
        return !$(this).attr('chamber').includes(currChamber)
      }
      return false;
    }).hide();

  // if we've now hidden the currently selected district, reset the dropdown
  let chamberOfCurrDist = $('#district-input')
    .find(':selected')
    .attr('chamber');

  if (chamberOfCurrDist) {
    if (!chamberOfCurrDist.includes(currChamber)) {
      $('#district-input').val('');
    }
  }
}

/**
 * Applies appropriate table formatting for the current Browser size.
 */
function formatTableForBrowserSize() {
  // apply small breakpoint changes
  if($(window).width() <= SMALL_BREAKPOINT){
    $('.cta-button')
      .html('')
      .css('background', 'no-repeat center/contain url("../../images/take_action_mobile.png")');
    $('.district-cell, .party-cell').hide();
    $('.results-cell > p:nth-child(2)').show();
  } else {
    $('.cta-button')
      .html('TAKE ACTION')
      .css('background', '');
    $('.district-cell, .party-cell').show();
    $('.results-cell > p:nth-child(2)').hide();
  }

  // apply mid breakpoint changes
  if($(window).width() <= MID_BREAKPOINT){
    $('#score-header').html('CC SCORE');
  } else {
    $('#score-header').html('CLIMATE CABINET SCORE');
  }
}

/**
 * Toggles the enabled/disabled state of the form.
*/
function showFullForm(shouldShow){
  // hide the placeholder prompt
  if(shouldShow) {
    $('#search-prompt').hide();
    $('#reset-container').show({
      duration: 0,
      start: () => {
        $('#reset-container').css('display', 'flex');
      }
    });
    $('#search-results').fadeIn({
      duration: 'fast',
      start: () => $('#search-results').css('display', 'flex')
    });
  } else {
    $('#search-prompt').show();
    $('#reset-container').hide();
    $('#search-results').hide();
  }

  $('#chamber-input, #district-input, #reset-container')
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
      query getIncumbentsForState($stateAbbr: String){
        representatives(
          query: {state_abbr: $stateAbbr, office: {is_current: true}}
          limit: ${LEGIS_LIMIT})
        {
          full_name
          role
          party
          cc_score
          slug
          office {
            seat_number
            district {
              shortcode
              district_type
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
      let distShortcode = legi['office']['district']['shortcode'];

      // replace the score value with '-' if NaN
      let ccScore = legi['cc_score'] !== null ? parseInt(legi['cc_score']) : '-';
      let party = legi['party'] || 'Unknown';

      // render the row
      const { slug } = legi;
      const ctaOnClick = `window.open('${LEGISLATOR_PAGE_URL_PREFIX}${slug}', '_blank')`;

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
            $('<div class="results-cell party-cell"></div>')
              .append($(`<p>${party}</p>`))
          )
          .append(
            $('<div class="results-cell score-cell"></div>')
                .append($(`<p>${ccScore}</p>`))
                .append($(`<p>${party}</p>`))
          )
          .append(
            $('<div class="results-cell"></div>')
                .append($(`<button class="cta-button" aria-label="Take Action" onclick="${ctaOnClick}">TAKE ACTION</button>`))
          )
          .attr('district', legi['office']['seat_number'].toLowerCase())
          .attr('chamber', legi['role'] === 'Senator' ? 'upper' : 'lower')
      );
    });

    const chambersMap = {};
    let lowerDistNums = [];
    let upperDistNums = [];
    allLegis['representatives'].forEach(legi => {
      // get the names of this state's lower and upper chambers
      const chamberType = legi['role'] === 'Senator' ? 'upper' : 'lower';
      if(!Object.keys(chambersMap).includes(chamberType)) {
        chambersMap[chamberType] = legi['office']['district']['district_type']
                                     .replace('Legislative', 'House')  // fix for MD
                                     .trim();
      }

      // get a list of district numbers in each chamber
      if (legi['role'] == 'Representative'){
        lowerDistNums.push(legi['office']['seat_number'])
      } else if (legi['role'] == 'Senator'){
        upperDistNums.push(legi['office']['seat_number'])
      } else {
        console.warn(
          `Unable to identify role '${legi['role']}' of legislator ` +
          `${legi['full_name']} - not adding their district number ` +
          `to the district drop-down.`
        );
      }
    });

    Object.entries(chambersMap).forEach((chamber) => {
      $('#chamber-input').append(
        `<option value="${chamber[0]}">${chamber[1]}</option>`
      );
    });

    let distNums = lowerDistNums.concat(upperDistNums)

    distNums
      .filter((d, i) => distNums.indexOf(d) === i)
      .sort((a, b) => {
        return parseInt(a.replace(/[^0-9]/, '')) - parseInt(b.replace(/[^0-9]/, '')) ||
          a.replace(/[0-9]/, '').localeCompare(b.replace(/[0-9]/, ''));
      })
      .forEach((distNum) => {
        let chamber = '';
        if (lowerDistNums.includes(distNum)) {
          chamber += 'lower';
        }
        if (upperDistNums.includes(distNum)) {
          chamber += 'upper';
        }

        $('#district-input').append(
          `<option chamber="${chamber}" value="${distNum.toLowerCase()}">${distNum}</option>`
        );
      });

    // if #chamber-input changes, restrict the district dropdown choices
    $('#chamber-input').on('change', filterSelectableDistricts);

    // start listening for changes to the district/ chamber filters
    $('#chamber-input').on('change', refreshLegislatorFilters);
    $('#district-input').on('change', refreshLegislatorFilters);

    formatTableForBrowserSize();
  });
}

/**
 * When a state is selected, search for that state
 */
$('#state-input').on('change', handleStateSelection);

/**
 * When the Reset button is clicked, reset the page.
 */
$('#reset-container > button').on('click', async function(e) {
  e.preventDefault();

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
        regions (
          query: {_cls: "Region.State"},
          sortBy: NAME_ASC
        ){
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

  // make sure the UI loads according to browser size
  formatTableForBrowserSize();
});
