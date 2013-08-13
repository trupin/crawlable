/**
 * User: rupin_t
 * Date: 7/24/13
 * Time: 10:49 AM
 */

var child_process = require('child_process'),
    util = require('util'),
    _ = require('lodash'),
    async = require('async');

var Renderer = require('../../lib/renderer.js');

var CasperRenderer = module.exports = function (options) {
    this._paths = {
        phantomjs: __dirname + '/../../.utils/phantomjs/bin/',
        casperjs: __dirname + '/../../.utils/casperjs/bin/casperjs',
        script: __dirname + '/generatePage.js'
    };
    Renderer.call(this, options);
};

util.inherits(CasperRenderer, Renderer);

CasperRenderer.prototype.run = function (args, callback) {
    if (!_.isString(args.route))
        return callback(new Error('The required argument "route" is missing.'));
    args.host = _.isString(args.host) ? args.host :
        _.isString(this.options.host) ? this.options.host : null;
    if (!args.host)
        return callback(new Error('The "host" argument or option is required.'));

    var env = { PATH: process.env.PATH + ':' + this._paths.phantomjs };
    var cmd = [
        this._paths.casperjs,
        this._paths.script,
        '--url=' + args.host + args.route
    ].join(' ');

    return child_process.exec(cmd, { env: env },
        function (error, stdout) {
            if (error) {
                var msg = stdout.match(/\[ERROR- (.*) -ERROR\]/);
                msg = msg ? msg[1] : 'Unknown';
                return callback(new Error('CasperJS error: ' + msg));
            }
            return callback(null, stdout);
        }
    );
};

