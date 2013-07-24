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

    this.options = options = _.cloneDeep(options || {});
    if (!_.isString(options.host))
        throw new Error('The required field "host" is missing.');

    Renderer.apply(this, options);
};

util.inherits(CasperRenderer, Renderer);

CasperRenderer.prototype.run = function (args, callback) {
    if (!_.isString(args.route))
        return callback(new Error('The required argument "route" is missing.'));

    var env = { PATH: process.env.PATH + ':' + this._paths.phantomjs };
    var cmd = [
        this._paths.casperjs,
        this._paths.script,
        '--url=' + this.options.host + args.route
    ].join(' ');

    return child_process.exec(cmd, { env: env },
        function (error, stdout) {
            if (error)
                return callback(new Error('CasperJS error: ' + stdout));
            return callback(null, stdout);
        }
    );
};

