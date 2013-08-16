/**
 * User: rupin_t
 * Date: 8/16/13
 * Time: 3:32 PM
 */

var phantom = require('phantom');

phantom.create(function (ph) {

    var waitFor = function (testFx, onReady, timeOutMillis) {
        var maxtimeOutMillis = timeOutMillis ? timeOutMillis : 3000,
            start = new Date().getTime(),
            condition = false,
            runningTest = false,
            interval = setInterval(function () {
                if ((new Date().getTime() - start < maxtimeOutMillis) && !condition && !runningTest) {
                    runningTest = true;
                    testFx(function (result) {
                        runningTest = false;
                        condition = result;
                        if (condition) {
                            onReady(null);
                            clearInterval(interval);
                        }
                    });
                }
                else if (!condition) {
                    onReady(new Error('Timeout elapsed.'));
                    clearInterval(interval);
                }
            }, 50);
    };

    ph.createPage(function (page) {
        page.set('settings', {
            userAgent: "crawlable",
            javascriptEnabled: true,
            loadImages: false
        }, function () {
            page.open('http://localhost:3000', function (status) {
                if (status !== "success") {
                    console.log('Cannot access to network');
                    process.exit(1);
                }
                else {
                    waitFor(function (callback) {
                        page.evaluate(function () {
                            return $('#app-fully-loaded').length;
                        }, callback);
                    }, function (error) {
                        if (error) {
                            console.log(error);
                            process.exit(1);
                        }
                        page.evaluate(function () {
                            return $('#app').html();
                        }, function (result) {
                            console.log(result);
                            process.exit(0);
                        });
                    }, 5000);
                }
            });
        });
    });
});