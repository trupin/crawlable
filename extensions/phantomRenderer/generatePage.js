/**
 * User: rupin_t
 * Date: 8/16/13
 * Time: 3:22 PM
 */

function waitFor(testFx, onReady, timeOutMillis) {
    var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000, //< Default Max Timout is 3s
        start = new Date().getTime(),
        condition = false,
        interval = setInterval(function() {
            if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
                // If not time-out yet and condition not yet fulfilled
                condition = (typeof(testFx) === "string" ? eval(testFx) : testFx()); //< defensive code
            } else {
                if(!condition) {
                    // If condition still not fulfilled (timeout but condition is 'false')
                    console.log("'waitFor()' timeout");
                    phantom.exit(1);
                } else {
                    // Condition fulfilled (timeout and/or condition is 'true')
                    typeof(onReady) === "string" ? eval(onReady) : onReady(); //< Do what it's supposed to do once the condition is fulfilled
                    clearInterval(interval); //< Stop this interval
                }
            }
        }, 250); //< repeat check every 250ms
}

var system = require('system');

if (system.args.length !== 2) {
    console.log('Usage: phantomjs ./file url');
    phantom.exit(1);
}

var page = require('webpage').create();

page.settings.userAgent = 'crawlable';

page.open(system.args[1], function (status) {
    if (status !== "success") {
        console.log('Cannot access to network');
        phantom.exit(1);
    }
    else {
        waitFor(function () {
            return page.evaluate(function () {
                return $('#app-fully-loaded').length;
            });
        }, function () {
            console.log(page.evaluate(function () {
                return $('#app').html();
            }));
            phantom.exit(0);
        }, 5000);
    }
});