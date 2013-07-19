/**
 * User: rupin_t
 * Date: 7/15/13
 * Time: 2:48 PM
 */

var exec = require('child_process').exec,
    maxProcesses = require('os').cpus().length;

var async = require('async');

var db = require('../lib/db.js'),
    config = require('../config.js'),
    solidify = require('solidify').create();

var stack = [], nProcesses = 0;

var handler = function () {
    while (stack.length && nProcesses < maxProcesses) {
        var o = stack.shift();
        exec(
            'casperjs ' + __dirname + '/../scripts/generatePage.js --url=' + config.host + o.task.url,
            function (error, stdout) {
                nProcesses--;
                if (error)
                    return o.callback(new Error('CasperJs failed'), null);
                try {
                    async.waterfall([
                        function (next) {
                            db.pages.get(o.task.url, function (err, model) {
                                next(null, model);
                            });
                        },
                        function (model, next) {
                            stdout = solidify.compile(stdout);
                            if (!model)
                                return db.pages.post({ url: o.task.url, html: stdout }, next);
                            model.set('luts', +new Date());
                            model.set('html', stdout);
                            db.pages.put(model, next);
                        },
                        function (model) {
                            o.callback(null, model.getId());
                        }
                    ], o.callback);
                } catch (e) {
                    return o.callback(e);
                }
            }
        );
        nProcesses++;
    }
    setTimeout(handler, 20);
};
handler();

module.exports = function (task, callback) {
    stack.push({ task: task, callback: callback });
};