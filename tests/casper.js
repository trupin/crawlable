/**
 * User: rupin_t
 * Date: 7/24/13
 * Time: 11:03 AM
 */

var child_process = require('child_process');

var phantomjs = __dirname + '/../.utils/phantomjs/bin/';
var casperjs = __dirname + '/../.utils/casperjs/bin/casperjs';
var script = __dirname + '/../scripts/generatePage.js';

var url = 'http://localhost:3001';

var env = {
    PATH: process.env.PATH + ':' + phantomjs
};

var cmd = [casperjs, script, '--url=' + url].join(' ');

child_process.exec(cmd, { env: env },
    function (error, stdout) {
        if (error) console.log(stdout);
    }
);
