/**
 * User: rupin_t
 * Date: 7/17/13
 * Time: 11:58 AM
 */

var Handlebars = require('handlebars'),
    _ = require('underscore'),
    request = require('request'),
    crypto = require('crypto'),
    async = require('async'),
    url = require('url');

var config = require('../config.js');

var reqs;

var computeId = function (data) {
    var shasum = crypto.createHash('md5');
    return shasum.update(data).digest('hex');
};

Handlebars.registerHelper('staticable', function (url, options) {
    if (reqs.indexOf(url) == -1)
        reqs.push(url);
    return '{{#context "' + computeId(url) + '"}}' + options.fn(this) + '{{/context}}';
});

exports.compile = function (rawTemplate) {
    reqs = [];
    var template = Handlebars.compile(rawTemplate)();
    while (rawTemplate.indexOf('{ { {') !== -1 || rawTemplate.indexOf('} } }') !== -1)
        rawTemplate = rawTemplate.replace('{ { {', '{{{').replace('} } }', '}}}');
    while (template.indexOf('{ {') !== -1 || template.indexOf('} }') !== -1)
        template = template.replace('{ {', '{{').replace('} }', '}}');
    return {
        template: template,
        requests: reqs
    };
};

Handlebars.registerHelper('context', function (field, options) {
    return options.fn(this[field] || {});
});

var replace = function (str, context) {
    var regex = /(:\w+)/;
    while (str.match(regex)) {
        str = str.replace(regex, function (__, param) {
            if (param && param.length > 1 && context[param.substring(1)])
                return param.substring(1) + '=' + context[param.substring(1)];
            return '';
        });
    }
    while (str.indexOf('//') != -1)
        str = str.replace('//', '/');
    return str;
};

var compileUrl = function (u, context) {
    u = url.parse(u);
    return (u.protocol + '//' + u.host + replace(u.pathname || '', context) + '?' + replace(u.query || '', context))
        .replace(/[?/]$/, '');
};

exports.feed = function (/*options, */o, req, callback) {


//    var options = options || {};
//
//    options.requests = options.requests || {};
//    options.template = options.template || '';
//    options.context = options.

    async.waterfall([
        function (next) {
            async.map(o.requests, function (url, done) {
                url = compileUrl(config.host + url, _.extend(req.body, req.params, req.query));
                console.log('Staticable requesting: ' + url);
                request(url, function (error, response, body) {
                    if (error || response.statusCode != 200)
                        return done(error || new _errors.HttpError('Couldn\'t fetch the template context.', response.statusCode));
                    try {
                        done(null, JSON.parse(body));
                    } catch (e) {
                        done(e);
                    }
                })
            }, next);
        },
        function (res, next) {
            var context = {};
            for (var i = 0; i < res.length; ++i)
                context[computeId(o.requests[i])] = res[i];
            try {
                next(null, Handlebars.compile(o.template)(context));
            } catch (e) {
                next(e);
            }
        }
    ], callback);
};