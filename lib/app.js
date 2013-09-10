/**
 * User: rupin_t
 * Date: 9/5/13
 * Time: 12:10 PM
 */

var express = require('express'),
    _ = require('lodash'),
    async = require('async'),
    Crawlable = require('../index.js');

module.exports = function (options, callback) {

    options = _.isObject(options) ? options : {};

    options.crawlable = _.isObject(options.crawlable) ? options.crawlable : {};

    options.port = _.isNumber(options.port) ? options.port : null;
    if (!options.port)
        throw new Error('Missing required "port" option.');

    options.crawlable.host = 'http://localhost:' + options.port;

    var crawlable = Crawlable.create(options.crawlable);

    options.handlebars = _.isObject(options.handlebars) ? options.handlebars : {};
    options.handlebars.args = _.isArray(options.handlebars.args) ? options.handlebars.args : [];
    options.handlebars.helpers = _.isFunction(options.handlebars.helpers) ? options.handlebars.helpers : function () {};

    if (!_.isString(options.handlebars.views))
        throw new Error('Missing require "views" option.');

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

        app._crawlable = crawlable;
        app.crawl = crawlable.crawl.bind(crawlable);

        var routes = [];
        app.crawlable = function (path) {
            routes.push(path);
        };

        // configure the application
        app.configure(function () {
            app.set('view engine', 'html');
            app.engine('html', require('hbs').__express);
            app.set('views', options.handlebars.views);
            options.configure(app, express);
            app.use(crawlable._solidify.express());
        });

        options.routes(app);

        async.eachSeries(routes, function (path, done) {
            crawlable.route(path, done);
        }, function (err) {
            if (err)
                return callback(err);

            app.get('*', crawlable.express(_.pick(options.crawlable, 'notFound')), options.render);

            app.listen(options.port, function (err) {
                if (err)
                    return callback(err);
                callback(null, app);
            });

        });
    });

};