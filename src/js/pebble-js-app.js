// Global variables to be changed
// var DELAY = 15000; // in millseconds  
var IP = "192.168.100.107";
var PORT = "3001";
var url = "http://" + IP + ":" + PORT + "/";
var DELAY = 1000 * 10 * 1; // one minute.


function sendErrorMessage(error) {
  Pebble.sendAppMessage({"now": "Error",
                          "avg": "connect",
                          "min": "to",
                          "max": error});
  console.log("Error connecting to: " + error);
}

function getHTTPRequestObject(fileName) {
  var req = new XMLHttpRequest();
  var request_url = url + fileName;
  console.log("Generating httprequest object to: " + request_url);
  req.open('GET', request_url , true);
  return req;
}

function getTemperatureModeByName(mode) {
  if (mode == "Celsius")
    return 100;
  else if (mode == "Fahrenheit")
    return 101;
  else 
    return -1;
}

function getTemperatureModeByValue(mode) {
  if (mode == 100)
    return "Celsius";
  else if (mode == 101)
    return "Fahrenheit";
  else 
    return "Error";
}


/**
 * Function to get response from the server and send it back to the Pebble watch.
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
  var req = getHTTPRequestObject("temperature");
  req.onerror = function(e) {logError("temperature");};
  
  req.onload = function(e) {
    if (req.readyState == 4 && req.status == 200) {
      onloadSuccess(req);  
    } else {
      logError("temperature");
    }
  };
  req.send(null);
}

function onloadSuccess(request) {
  console.log(request.responseText);
      var response = JSON.parse(request.responseText);
      if (response && response.data && response.data.length >0) {
        var avg, now, min, max, sign, mode;
        mode = response.mode;
        if (mode == "Error") {
          sendErrorMessage("sensor");
          return;
        }
  
        var result = response.data[0];
        sign = (mode == "Celsius"? "\u00B0C":"\u00B0F" );
        now = result.now;
        avg = result.avg;
        min = result.min;
        max = result.max;
        Pebble.sendAppMessage({
          "now":"Now:" + now + sign,
           "avg":"Avg:" + avg + sign,
           "min":"Min:" + min + sign,
           "max":"Max:" + max + sign,
           "temperatureMode":getTemperatureModeByName(mode)});
      } else {
        console.log("Invalid Response Received from Server.");
        sendErrorMessage("server");
      }
}

function logError(error) {
    console.log("Error connecting to server at " + url + error);
    sendErrorMessage("server");
}

/*
* Function to send message to Arduino to change readings to Fahrenheit
*/
function setTemperatureMode(current_mode){
  var fileName = (getTemperatureModeByValue(current_mode) == "Celsius" ? "setF": "setC");
  var req = getHTTPRequestObject(fileName);
    
  req.onerror = function(e) {logError(fileName);};
    
  req.onload = function(e) {
    if (req.readyState == 4 && req.status == 200) {
      console.log("Request: " + fileName + "success");
      getWeather();
    } else {
      logError(fileName);
    }
  };
  req.send(null);
}

function updateWeather() {
  getWeather();
  setTimeout(updateWeather(), 10000);
}

Pebble.addEventListener("ready",
                         function(e) {
                           console.log("connect!" + e.ready);
                           getWeather();
                           console.log("ready type:" + e.type);
                         });

Pebble.addEventListener("appmessage",
                         function(e) {
                           console.log(new Date().toString() + "Message received.");
                           if (e.payload){
                             console.log("Received message:" + JSON.stringify(e.payload)); 
                             if (e.payload.temperatureMode){  
                               setTemperatureMode(e.payload.temperatureMode);
                             } else if (e.payload.max){
                               getWeather();
                             }
                           } else
                             console.log("appmessage payload failed.");
                         });
