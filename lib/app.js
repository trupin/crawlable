/**
 * User: rupin_t
 * Date: 9/5/13
 * Time: 12:10 PM
 */

var express = require('express'),
    methods = require('methods'),
    _ = require('lodash'),
    async = require('async'),
    Crawlable = require('../index.js');

module.exports = function (options) {

    options = _.isObject(options) ? options : {};

    options.crawlable = _.isObject(options.crawlable) ? options.crawlable : {};

    options.port = _.isNumber(options.port) ? options.port : null;
    if (!options.port)
        throw new Error('Missing required "port" option.');

    options.crawlable.host = 'http://localhost:' + options.crawlable.port;

    var crawlable = Crawlable.create(options.crawlable);

    options.handlebars = _.isObject(options.handlebars) ? options.handlebars : {};
    options.handlebars.args = _.isArray(options.handlebars.args) ? options.handlebars.args : [];
    options.handlebars.helpers = _.isFunction(options.handlebars.helpers) ? options.handlebars.helpers : function () {};

    if (!_.isString(options.handlebars.template))
        throw new Error('Missing require "template" option.');

    options.handlebars.args.unshift(Crawlable.Solidify.HandleBars);
    options.handlebars.helpers.apply(null, options.handlebars.args);

    options.configure = _.isFunction(options.configure) ? options.configure : function () {};
    options.routes = _.isFunction(options.routes) ? options.routes : function () {};
    options.render = _.isFunction(options.render) ? options.render : function (req, res) {
        // TODO implement a default render function
    };

    if (!_.isFunction(options.render))
        throw new Error('Missing required "render" option.');

    crawlable.start(function (err) {
        if (err)
            return callback(err);

        var app = express();

        // configure the application
        app.configure(function () {
            options.configure(app);
            app.use(crawlable._solidify.express());
        });

        var routes = [], oldFns = {};
        _.each(methods, function (method) {
            oldFns[method] = app[method];
            app['c' + method] = function (path) {
                routes.push({
                    method: method,
                    fns: [crawlable.express()]
                        .concat(_.toArray(arguments).slice(1))
                        .concat([options.render]),
                    path: path,
                    crawlable: true
                });
            };
            app[method] = function (path) {
                routes.push({
                    method: method,
                    fns: _.toArray(arguments).slice(1),
                    path: path,
                    crawlable: false
                });
            };
        });

        options.routes(app);

        async.forEachSeries(routes, function (route, done) {
            oldFns[route.method].call(app, route.path, route.fns);
            if (route.crawlable)
                crawlable.route(route.path, done);
            else done(null);
        }, function (err) {
            if (err)
                return callback(err);

            oldFns.get('*', crawlable.express(_.pick(options.crawlable, 'notFound')), options.render);

            app.listen(options.port);
            callback(null, app);
        });
    });

};