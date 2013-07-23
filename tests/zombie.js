/**
 * User: rupin_t
 * Date: 7/23/13
 * Time: 5:48 PM
 */

var Browser = require('zombie');

//var browser = new Browser({
//    silent: true,
//    userAgent: 'phantom.js'
//});

Browser.visit("http://localhost:3001", function (e, browser) {
    if (e) return console.log(e);
    var i = setInterval(function () {
        if (browser.query('#app-fully-loaded')) {
            console.log(browser.html('#app'));
            browser.close();
            clearInterval(i);
        }
    }, 500);
});
