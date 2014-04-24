// Global variables to be changed
var IP = "158.130.105.196";
var PORT = "3001";
var sensorServerURL = "http://" + IP + ":" + PORT + "/";
var INTERVAL_ID;
var sensorNow, sensorMin, sensorMax, sensorAvg, outsideNow, tempMode;
var HTTP_TIMEOUT = 5000;
var DISPLAY_MODE = 1; // default display set to show sensor temperature only.
var REFRESH_MODE = 3;

// TODO: Add persistent storage for the javascript to store the initial values of 
// DISPLAY_MODE, and REFRESH_MODE variable values. The values should be the same as the initlal
// values set by the watch's persisten storage.
// Also need to add codes to update those values once new values are received.


function sendErrorMessage(error) {
  sendMessage("Error", "connect", "to", error);
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

var locationOptions = { "timeout": 15000, "maximumAge": 60000 };

function convertToCorrectTemperatureFormat(tempInKelvin) {
  var tempInCelsius = Math.round ((tempInKelvin - 273.15) * 100 )/100;
  
  switch(tempMode) {
    case "Celsius":
      return tempInCelsius + "\u00B0C";
    case "Fahrenheit":
      return Math.round ((tempInCelsius * 1.8 + 32) * 100) / 100 + "\u00B0F";
    default:
      console.log("Invalid temperature mode: " + tempMode);
      return 0 + "\u00B0C";
  }
}

function fetchWeather(latitude, longitude) {
  var req = getHTTPRequestObject("http://api.openweathermap.org/data/2.5/weather?" +
    "lat=" + latitude + "&lon=" + longitude);
  req.onload = function(e) {
    if (req.readyState == 4 && req.status == 200) {
      console.log(req.responseText);
      var response = JSON.parse(req.responseText);
      if (response && response.main && response.main.temp) {
        outsideNow = convertToCorrectTemperatureFormat(response.main.temp);
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
  Pebble.sendAppMessage({"min": "Outside Now:", "max": outsideNow}, sendSuccess, sendFail);
}

function locationError(err) {
  console.warn('location error (' + err.code + '): ' + err.message);
  sendMessage("Location", "Unavailable", "", "");
}

function getOutsideWeather() {
  navigator.geolocation.getCurrentPosition(locationSuccess, locationError, locationOptions);
}

function pauseResumeSensor() {
  var requestFile = "standby";
  var req = getHTTPRequestObject(sensorServerURL + requestFile);
  req.onload = function(e) {
    if (req.readyState == 4 && req.status == 200) {
      var response = JSON.parse(req.responseText);
      if (response.status)
        sendMessage("Temperature", "sensor", "is", response.status);
    } else {
      logError("server connection failed.");
    }
  };
  req.send(null);
}

/*
* Function to send message to Arduino to change readings to Fahrenheit
*/
function setTemperatureMode(){
  var fileName = (tempMode == "Celsius" ? "setF": "setC");
  var req = getHTTPRequestObject(sensorServerURL + fileName);

  req.onload = function(e) {
    if (req.readyState == 4 && req.status == 200) {
      console.log("Request: " + sensorServerURL + fileName + " success");
      getWeather();
    } else {
      logError(sensorServerURL + fileName);
    }
  };
  req.send(null);
}

function sendMorseCode() {
  var req = getHTTPRequestObject(sensorServerURL + "morse");
  req.onload = function(e) {
    if (req.readyState == 4 && req.status == 200) 
      sendMessage("Sent morse", "code to", "temperature", "display");
     else 
      logError("server connection failed.");
  };
  req.send(null);
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
  var req = getHTTPRequestObject(sensorServerURL + "temperature");

  if (DISPLAY_MODE == 2) 
    getOutsideWeather();
  
  req.onload = function(e) {
    if (req.readyState == 4 && req.status == 200) {
      onloadSuccess(req);
    } else {
      logError("temperature");
    }
  };
  req.send(null);
}

function sendTempToWatch() {
  switch(DISPLAY_MODE) {
    case 1:
      sendMessage("Now: " + sensorNow, "Avg: " + sensorAvg, "Min: " + sensorMin, "Max" + sensorMax);
      break;
    case 2: 
      Pebble.sendAppMessage({"now": "Sensor Now:", "avg": sensorNow}, sendSuccess, sendFail);
      break;
    default: 
      console.log("Error, display mode not set.");
  }
}

function onloadSuccess(request) {
  console.log(request.responseText);
  var response = JSON.parse(request.responseText);
  if (response) {
    tempMode = response.mode;
    if (response.error) {
      sendErrorMessage(response.error);
      return;
    }
    if (response.data && response.data.length >0) {
      var result = response.data[0];
      var sign = (tempMode == "Celsius"? "\u00B0C":"\u00B0F" );
      sensorNow = result.now + sign;
      sensorAvg = result.avg + sign;
      sensorMin = result.min + sign;
      sensorMax = result.max + sign;
      sendTempToWatch();
    } 
  } else {
    console.log("Invalid Response Received from Server.");
    sendErrorMessage("server");
  }
}

function logError(error) {
    console.log("Error connecting to server at " + error);
    sendErrorMessage("server");
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

function updateWeather() {
  var delayInMS = getDelayInMS(REFRESH_MODE);
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

function sendSuccess (e) {
  console.log("Successfully send message to Pebble");
  console.log("Message sent: " + e.data);
}

function sendFail (e) {
  console.log("Send message to Pebble failed");
  console.log("Message attempted to send: " + e.data);
}

function sendMessage(one, two, three, four) {
  Pebble.sendAppMessage({"now": one, "avg": two, "min": three, "max": four}, sendSuccess, sendFail);
}

function readyHandler(e) {
  console.log("Connection established between phone and watch.");
  updateWeather();
  getWeather();
  console.log("ready type:" + e.type);
}

function appMessageHandler(e) {
  console.log(e.type + "Message received.");
  if (e.payload){
    console.log("Received message:" + JSON.stringify(e.payload));
    if (e.payload.displayMode)
      if (DISPLAY_MODE != e.payload.displayMode) {
        DISPLAY_MODE = e.payload.displayMode;
        getWeather();
      }

    if (e.payload.refreshMode) 
      if (e.payload.refreshMode != REFRESH_MODE) {
        REFRESH_MODE = e.payload.refreshMode;
        updateWeather();
      } 
    
    if (e.payload.command){
      console.log("command received: " + e.payload.command);
      switch(e.payload.command) {
        case 1: // get latest weather info
          getWeather();
          break;
        case 2: // send morse code
          sendMorseCode();
          break;
        case 3: // pause/resume sensor.
          pauseResumeSensor();
          break;
        case 4:  // change temperature mode.
          setTemperatureMode();
          break;
        default:
          console.log("Illegal command received.");
      }
    }  
  } else
    console.log("appmessage payload failed.");
}

Pebble.addEventListener("ready", readyHandler);
Pebble.addEventListener("appmessage", appMessageHandler);