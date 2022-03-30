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
  } else {
    throw new Error('Not a calendar resource. Content-Type: ' + contentType);
  }
}



/**
 * Respond with hello worker text
 * @param {Request} request
 */
async function handleRequest(request) {
  console.log("in handleRequest");
  const url = new URL(request.url);
  const ical = url.searchParams.get('ical');
  console.log(ical);
  const response = await fetch(ical);
  console.log("ICAL response",response);
  try {
    const text = await gatherResponse(response);
    console.log("ICAL text",text);
    const converted = convert(text);
    console.log(converted)
    return new Response(JSON.stringify(converted), {
      headers: { 'content-type': 'application/json', ...corsHeaders},
    });
  } catch (error) {
    return new Response(JSON.stringify({"message":"Error: "+error.message}), {
      status: 400,
      headers: { 'content-type': 'application/json', ...corsHeaders },
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
