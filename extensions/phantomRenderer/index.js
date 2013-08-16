/**
 * User: rupin_t
 * Date: 8/16/13
 * Time: 3:23 PM
 */

var child_process = require('child_process'),
    util = require('util'),
    _ = require('lodash'),
    async = require('async');

var Renderer = require('../../lib/renderer.js');

var PhantomRenderer = module.exports = function (options) {
    this._paths = {
        phantomjs: __dirname + '/../../.utils/phantomjs/bin/phantomjs',
        script: __dirname + '/generatePage.js'
    };
    Renderer.call(this, options);
};

util.inherits(PhantomRenderer, Renderer);

PhantomRenderer.prototype.run = function (args, callback) {
    if (!_.isString(args.route))
        return callback(new Error('The required argument "route" is missing.'));
    args.host = _.isString(args.host) ? args.host :
        _.isString(this.options.host) ? this.options.host : null;
    if (!args.host)
        return callback(new Error('The "host" argument or option is required.'));

    var cmd = [
        this._paths.phantomjs,
        this._paths.script,
        args.host + args.route
    ].join(' ');

    return child_process.exec(cmd,
        function (error, stdout, stderr) {
            if (error)
                return callback(new Error('PhantomJs error: ' + (stderr || '').length ? stderr : stdout));
            return callback(null, stdout);
        }
    );
};

