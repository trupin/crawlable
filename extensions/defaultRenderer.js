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
};

util.inherits(Renderer, BaseRenderer);

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

Renderer.prototype.run = function (page, callback) {
    waitFor(function (callback) {
        page.evaluate(function () {
            return $('#app-fully-loaded').length;
        }, callback);
    }, function (error) {
        if (error)
            return callback(error);
        page.evaluate(function () {
            return $('#app').html();
        }, function (result) {
            callback(null, result);
        });
    }, 5000);
};