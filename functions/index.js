'use strict';

const { ApiAiApp } = require('actions-on-google');
const functions = require('firebase-functions');
const http = require("http"); 
const request = require('request-json');

var galwayBusRestClient = request.createClient('http://galwaybus.herokuapp.com/');

process.env.DEBUG = 'actions-on-google:*';


const BUS_NUMBER_PARAM = 'busnumber'; 





const permissionChecker = app => {
      const permission = app.SupportedPermissions.DEVICE_PRECISE_LOCATION;
      app.askForPermission('To find the closest bus stop', permission);   
}


const gotPermission = app => {
      if (app.isPermissionGranted()) { 
          findClosestBusStop(app) 
      } else { 
          app.tell("I cannot find when the next bus is coming without your location."); 
      }   
}

function findClosestBusStop(app) { 
    var busNumber = app.getContext("request_permission").parameters[BUS_NUMBER_PARAM];
    var deviceCoordinates = app.getDeviceLocation().coordinates
    const deviceLatitude = deviceCoordinates.latitude; 
    const deviceLongitude = deviceCoordinates.longitude; 
    galwayBusRestClient.get('stops.json', function(err, res, body) {
        var shortestDistance = -1; 
        var closestStop; 

        for (var stop of body) {
          var distance = calculateDistance(deviceLatitude, deviceLongitude, stop.latitude, stop.longitude)
            if (shortestDistance == -1 || shortestDistance > distance) { 
                shortestDistance = distance; 
                closestStop = stop; 
            } 
        }

        app.ask("Closest stop = " + closestStop.long_name + ", the " + busNumber + " is here!.  Would you like to lookup another bus?")    
    });

}


/** 
 * finds the closest bus stop using the folowing haversine formula 
 * a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2) 
 * c = 2 ⋅ atan2( √a, √(1−a) ) 
 * d = R ⋅ c 
 * @param {*} deviceLatitude  
 * @param {*} deviceLongitude  
 * @param {*} stop  
 * @return the distance in meters between the device and the stop 
 */ 
function calculateDistance(deviceLatitude, deviceLongitude, stopLatitude, stopLongitude) { 
    var R = 6371; // metres
    var φ1 = Math.radians(deviceLatitude);
    var φ2 = Math.radians(stopLatitude);
    var Δφ = Math.radians(stopLatitude - deviceLatitude);
    var Δλ = Math.radians(stopLongitude - deviceLongitude);

    var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
} 

Math.radians = function(degrees) { 
  return degrees * Math.PI / 180; 
}; 

/** @type {Map<string, function(ApiAiApp): void>} */
const actionMap = new Map();
actionMap.set('bus-requested', permissionChecker); 
actionMap.set('find-bus', gotPermission); 

/**
 * The entry point to handle a http request
 * @param {Request} request An Express like Request object of the HTTP request
 * @param {Response} response An Express like Response object to send back data
 */
const galwayBus = functions.https.onRequest((request, response) => {
  const app = new ApiAiApp({ request, response });
  console.log(`Request headers: ${JSON.stringify(request.headers)}`);
  console.log(`Request body: ${JSON.stringify(request.body)}`);
  app.handleRequest(actionMap);
});

module.exports = {
  galwayBus
};
