// Global variables to be changed
// var DELAY = 15000; // in millseconds  
var IP = "158.130.107.97";
var PORT = "3001";
var url = "http://" + IP + ":" + PORT + "/";
var DISPLAY_MODE, INTERVAL_ID;
var censorNow, censorMin, censorMax, censorAvg, outsideNow, tempMode;
var HTTP_TIMEOUT = 5000; 
var pauseCensor = true;
var outsideWeatherRequestToggle = true; // 0 if is requesting, 1 if its ready.

function sendErrorMessage(error) {
  Pebble.sendAppMessage({"now": "Error",
                          "avg": "connect",
                          "min": "to",
                          "max": error});
  console.log("Error connecting to: " + error);
}

function getHTTPRequestObject(fileName) {
  var req = new XMLHttpRequest();
  req.timeout = HTTP_TIMEOUT; // time out in 5 seconds.
  req.onerror = function(e) {logError(fileName);};
  req.ontimeout = function(e) {logError(fileName);};
  console.log("Generating httprequest object to: " + fileName);
  req.open('GET', fileName , true);
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

var locationOptions = { "timeout": 15000, "maximumAge": 60000 };

function convertToCorrectTemperatureFormat(tempInKelvin) {
  var tempInCelsius = Math.round ((tempInKelvin - 273.15) * 100 )/100;
  if (tempMode == "Celsius")
    return tempInCelsius;
  else if (tempMode == "Fahrenheit")
    return Math.round ((tempInCelsius * 1.8 + 32) * 100) / 100;
  else
    return 0;
}

function fetchWeather(latitude, longitude) {
  var req = getHTTPRequestObject("http://api.openweathermap.org/data/2.5/weather?" +
    "lat=" + latitude + "&lon=" + longitude);
  req.onload = function(e) {
    if (req.readyState == 4 && req.status == 200) {
      console.log(req.responseText);
      var response = JSON.parse(req.responseText);
      if (response && response.list && response.list.length > 0) {
        var weatherResult = response.list[0];
        outsideNow = convertToCorrectTemperatureFormat(weatherResult.main.temp);
        outsideWeatherRequestToggle = false;
      } else {
        console.log("Error");
      }
    }
  };
  req.send(null);
}

function locationSuccess(pos) {
  var coordinates = pos.coords;
  fetchWeather(coordinates.latitude, coordinates.longitude);
}

function locationError(err) {
  console.warn('location error (' + err.code + '): ' + err.message);
  Pebble.sendAppMessage({
    "now":"Loc Unavailable",
    "avg":"N/A",
     "min": "N/A",
     "max": "N/A"
  });
}

function getOutsideWeather() {
  outsideWeatherRequestToggle = true;
  navigator.geolocation.getCurrentPosition(locationSuccess, locationError, locationOptions);
}

function pauseResumeCensor() {
  var requestFile = (pauseCensor ? "standby_0":"standby_1");
    
  var req = getHTTPRequestObject(url + requestFile);
  req.onload = function(e) {
    if (req.readyState == 4 && req.status == 200) {
      Pebble.sendAppMessage({
        "now":"Temperature",
         "avg":"censor",
         "min":"is",
         "max": (pauseCensor ? "paused":"resumed"),
        });
      pauseCensor = !pauseCensor;
    } else {
      logError("server connection failed.");
    }
  };  
}

function sendMorseCode() {
  var req = getHTTPRequestObject(url + "morse");
  req.onload = function(e) {
    if (req.readyState == 4 && req.status == 200) {
      Pebble.sendAppMessage({
        "now":"Sent morse",
         "avg":"code to",
         "min":"temperature",
         "max":"censor"
        });
    } else {
      logError("server connection failed.");
    }
  };
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
  var req = getHTTPRequestObject(url + "temperature");

  if (DISPLAY_MODE == 2) 
    getOutsideWeather();
  
  req.onload = function(e) {
    if (req.readyState == 4 && req.status == 200) {
      onloadSuccess(req);
      while (outsideWeatherRequestToggle);
      sendTempToWatch();
    } else {
      logError("temperature");
    }
  };
  req.send(null);
}


function sendTempToWatch() {
  switch(DISPLAY_MODE) {
    case 2: 
      Pebble.sendAppMessage({
        "now":"Censor Now:",
         "avg":censorNow,
         "min":"Outside Now:",
         "max":outsideNow,
         "temperatureMode":getTemperatureModeByName(tempMode)
        });
      break;
    case 1:
      Pebble.sendAppMessage({
        "now":"Now:" + censorNow,
         "avg":"Avg:" + censorAvg,
         "min":"Min:" + censorMin,
         "max":"Max:" + censorMax,
         "temperatureMode":getTemperatureModeByName(tempMode)
        });
      break;
    default: 
      console.log("Error, display mode not set.");
  }
}

function onloadSuccess(request) {
  console.log(request.responseText);
  var response = JSON.parse(request.responseText);
  if (response && response.data && response.data.length >0) {
    var sign;
    tempMode = response.mode;
    if (tempMode == "Error") {
      sendErrorMessage("sensor");
      return;
    }
    var result = response.data[0];
    sign = (tempMode == "Celsius"? "\u00B0C":"\u00B0F" );
    censorNow = result.now + sign;
    censorAvg = result.avg + sign;
    censorAvg = result.min + sign;
    censorMax = result.max + sign;
  } else {
    console.log("Invalid Response Received from Server.");
    sendErrorMessage("server");
  }
}

function logError(error) {
    console.log("Error connecting to server at " + error);
    sendErrorMessage("server");
}

/*
* Function to send message to Arduino to change readings to Fahrenheit
*/
function setTemperatureMode(currentMode, displayMode){
  var fileName = (getTemperatureModeByValue(currentMode) == "Celsius" ? "setF": "setC");
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

function getDelayInMS(delay) {
  var oneSecond = 1000;
  switch(delay) {
    case 1:
      return -1;
    case 2:
      return 15 * oneSecond;
    case 3:
      return 60 * oneSecond;
    case 4:
      return 5 * 60 * oneSecond;
    case 5:
      return 15 * 60 * oneSecond;
  }
}

function updateWeather(delay) {
  var delayInMS = getDelayInMS(delay);
  console.log("Setting auto refresh delay to: "+ delayInMS + " ms");
  // reset any existing loop.
  if (INTERVAL_ID)
    clearInterval(INTERVAL_ID);

  if (delayInMS ==  -1) {
    getWeather();
  } else {
    INTERVAL_ID = setInterval(getWeather, delayInMS);
  }
}

Pebble.addEventListener("ready",
                         function(e) {
                           console.log("Connection established between phone and watch.");
                           /*if (e.payload.displayMode) {
                             DISPLAY_MODE = e.payload.displayMode;
                             console.log("Set current displayMode to %d", DISPLAY_MODE);
                           } else 
                             console.log("Illegal message received from watch, missing dipslayMode info.");
                
                           if (e.payload.refreshMode)
                             updateWeather(e.payload.refreshMode);*/
                           console.log("ready type:" + e.type);
                         });

Pebble.addEventListener("appmessage",
                         function(e) {
                           console.log(new Date().toString() + "Message received.");
                           if (e.payload){
                             console.log("Received message:" + JSON.stringify(e.payload));
                             if (e.payload.displayMode) 
                               DISPLAY_MODE = e.payload.displayMode;
                             
                             if (e.payload.temperatureMode){ 
                               console.log("temperature mode change request received.");
                               setTemperatureMode(e.payload.temperatureMode);
                             } else if (e.payload.command){
                               console.log("command received: " + e.payload.command);
                               switch(e.payload.command) {
                                 case 1: // send morse code
                                   sendMorseCode();
                                   break;
                                 case 2: // get latest weather info
                                   getWeather();
                                   break;
                                 case 3: // pause/resume censor.
                                   pauseResumeCensor();
                                   break;
                                 default:
                                   console.log("Illegal command received.");
                               }
                             } else if (e.payload.refreshMode) {
                               updateWeather(e.payload.refreshMode);
                             }
                           } else
                             console.log("appmessage payload failed.");
                         });
