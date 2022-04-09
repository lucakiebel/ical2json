const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Max-Age': '86400',
};


addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})


async function gatherResponse(response) {
  const { headers } = response;
  const contentType = headers.get('content-type') || '';
  if (contentType.includes('text/calendar')) {
    return response.text();
  } else if (contentType.includes('application/json')) {
    return response.json();
  }
  else {
    throw new Error('Not a calendar/json resource. Content-Type: ' + contentType);
  }
}

async function getSourceAndConvert(url, convertFn) {
  const data = await gatherResponse(url);
  return convertFn(data);
}


/**
 * Respond with hello worker text
 * @param {Request} request
 */
async function handleRequest(request) {
  console.log("in handleRequest");
  const url = new URL(request.url);
  const ical = url.searchParams.get('ical');
  const json = url.searchParams.get('json');

  if(ical || json) {
    const convertFn = (ical) ? convert : revert;
    const source = await getSourceAndConvert(ical || json, convertFn);
    const response = new Response(source, {
      headers: {
        'content-type': (ical) ? 'application/json' : 'text/calendar',
        ...corsHeaders
      },
      status: 200,
    });
    return response;
  } else {
    return new Response('', {
      status: 400,
      headers: corsHeaders,
    });
  }
}

// from https://github.com/adrianlee44/ical2json

// Make sure lines are splited correctly
// http://stackoverflow.com/questions/1155678/javascript-string-newline-character
var NEW_LINE = /\r\n|\n|\r/;
var COLON = ':';
// const COMMA = ",";
// const DQUOTE = "\"";
// const SEMICOLON = ";";
var SPACE = ' ';
/**
 * Take ical string data and convert to JSON
 */
function convert(source) {
    var output = {};
    var lines = source.split(NEW_LINE);
    var parentObj = {};
    var currentObj = output;
    var parents = [];
    var currentKey = '';
    for (var i = 0; i < lines.length; i++) {
        var currentValue = '';
        var line = lines[i];
        if (line.charAt(0) === SPACE) {
            currentObj[currentKey] += line.substr(1);
        }
        else {
            var splitAt = line.indexOf(COLON);
            if (splitAt < 0) {
                continue;
            }
            currentKey = line.substr(0, splitAt);
            currentValue = line.substr(splitAt + 1);
            switch (currentKey) {
                case 'BEGIN':
                    parents.push(parentObj);
                    parentObj = currentObj;
                    if (parentObj[currentValue] == null) {
                        parentObj[currentValue] = [];
                    }
                    // Create a new object, store the reference for future uses
                    currentObj = {};
                    parentObj[currentValue].push(currentObj);
                    break;
                case 'END':
                    currentObj = parentObj;
                    parentObj = parents.pop();
                    break;
                default:
                    if (currentObj[currentKey]) {
                        if (!Array.isArray(currentObj[currentKey])) {
                            currentObj[currentKey] = [currentObj[currentKey]];
                        }
                        currentObj[currentKey].push(currentValue);
                    }
                    else {
                        currentObj[currentKey] = currentValue;
                    }
            }
        }
    }
    return output;
}


/**
* Take JSON, revert back to ical
*/
function revert(object) {
  const lines = [];

  for (const key in object) {
    const value = object[key];
    if (Array.isArray(value)) {
      if (key === 'RDATE') {
        (value).forEach((item) => {
          lines.push(key + ':' + item);
        });
      } else {
        (value).forEach((item) => {
          lines.push('BEGIN:' + key);
          lines.push(revert(item));
          lines.push('END:' + key);
        });
      }
    } else {
      let fullLine = key + ':' + value;
      do {
        // According to ical spec, lines of text should be no longer
        // than 75 octets
        lines.push(fullLine.substr(0, 75));
        fullLine = SPACE + fullLine.substr(75);
      } while (fullLine.length > 1);
    }
  }

  return lines.join('\n');
}