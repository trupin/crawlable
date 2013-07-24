/**
 * User: rupin_t
 * Date: 7/12/13
 * Time: 12:08 PM
 */

var _ = require('lodash');

exports.create = require('./lib/processor.js').create;
exports.renderers = {
    Casper: require('./extensions/casperRenderer')
};

/**
 * The express route.
 * @param req
 * @param res
 */
// TODO move it in processor.
exports.express = function (crawlable) {
    return function (req, res, next) {
        req.crawlable = { html: '' };
        if (req.headers['user-agent'] == 'crawlable')
            return next();

        var options = {
            host: 'http://' + req.headers.host,
            context: _.extend(
                req.query || {},
                req.params || {},
                req.body || {}
            )
        };

        if (req.query.regenerate) {
            options.force = true;
            options.wait = true;
        }

        crawlable.render(req._parsedUrl.pathname, options,
            function (err, page) {
                if (err) console.log(err);
                req.crawlable.html = err ? '' : page.html;
                if (options.wait)
                    next();
            }
        );
        if (!options.wait)
            next();
    };
};