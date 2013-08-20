/**
 * User: rupin_t
 * Date: 8/16/13
 * Time: 4:35 PM
 */

var util = require('util'),
    _ = require('lodash'),
    async = require('async');

var BaseRenderer = require('../lib/renderer.js');

var Renderer = module.exports = function (options) {
    BaseRenderer.call(this, options);

    this._timeout = (_.isNumber(options.timeout) ? options.timeout : 5) * 1000;
};

util.inherits(Renderer, BaseRenderer);

Renderer.prototype.waitFor = function (testFx, onReady) {
    var that = this,
        start = new Date().getTime(),
        condition = false,
        runningTest = false,
        interval = setInterval(function () {
            if ((new Date().getTime() - start < that._timeout)) {
                if (!runningTest) {
                    runningTest = true;
                    testFx(function (result) {
                        if (result) {
                            onReady(null);
                            clearInterval(interval);
                        }
                        else {
                            runningTest = false;
                            condition = !!result;
                        }
                    });
                }
            }
            else if (!condition) {
                onReady(new Error('Timeout elapsed.'));
                clearInterval(interval);
            }
        }, 100);
};

Renderer.prototype.run = function (page, callback) {
    this.waitFor(function (callback) {
        page.evaluate(function () {
            return !!document.getElementById('app-fully-loaded');
        }, callback);
    }, function (error) {
        if (error)
            return callback(error);
        page.evaluate(function () {
            var el = document.getElementById('app');
            return el ? el.innerHTML : '';
        }, function (result) {
            callback(null, result);
        });
    });
};