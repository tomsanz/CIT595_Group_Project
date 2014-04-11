// Global variables to be changed
// var DELAY = 15000; // in millseconds  
var IP = "192.168.0.105";
var PORT = "80";


function sendErrorMessage(error) {
  Pebble.sendAppMessage({"now": "Error",
                          "avg": "connect",
                          "min": "to",
                          "max": error});
  console.log("Error connecting to: " + error);
}

/**
 * Get response from the server and send it back to the Pebble watch.
 * The server should have the following format:
 * {
 *   "mode": "Celsius",
 *   "data": [
 *     {"avg": 25.5,
 *     "min": 10.5,
 *     "max": 38.4,
 *     "now": 30.9}
 *   ]
 * } 
 */
function getWeather() {
  console.log("About to establish HTTP connection.");
  var req = new XMLHttpRequest();
  var url = "http://" + IP + ":" + PORT + "/temperature";
  console.log("opening URL: " + url);
  
  req.onerror = function(e) {
    console.log("Error connecting to server at " + url);
    sendErrorMessage("server");
  };
    
  req.onload = function(e) {
    if (req.readyState == 4 && req.status == 200) {
      onloadSuccess(req);  
    } else {
      sendErrorMessage("server");
      console.log("Error connecting to server at " + url);
    }
  };
  
  req.open('GET', url , true);
  req.send(null);
}

function onloadSuccess(request) {
  console.log(request.responseText);
      var response = JSON.parse(request.responseText);
      if (response && response.data && response.data.length >0) {
        var avg, now, min, max, sign;
        var result = response.data[0];
        if (response.mode == "Celsius")
          sign = "\u00B0C";
        else
          sign = "\u00B0F";
        now = result.now;
        avg = result.avg;
        min = result.min;
        max = result.max;
        Pebble.sendAppMessage({
          "now":"Now:" + now + sign,
           "avg":"Avg:" + avg + sign,
           "min":"Min:" + min + sign,
           "max":"Max:" + max + sign});
      } else {
        console.log("Error reading from temperature sensor.");
        sendErrorMessage("server");
      }
}

// To be investigated on why this doesn't work. 
// Currently it crashes the phone every time its run,
// have to restart phone to resume js communication.

/*function setInterval() {
  getWeather();
  console.log("ready to loop ");
  var oldTime = new Date().getTime();
  console.log("current time is " + oldTime);
  while("true") {
    var currentTime = new Date().getTime();
    if ((currentTime - oldTime) > DELAY) {
      getWeather();
      oldTime = currentTime;
    }
  }
}*/

Pebble.addEventListener("ready",
                         function(e) {
                           console.log("connect!" + e.ready);
                           getWeather();
                           console.log(e.type);
                         });

Pebble.addEventListener("appmessage",
                         function(e) {
                           getWeather();
                           console.log(e.type);
                           console.log(e.payload);
                           console.log("message!");
                         });


