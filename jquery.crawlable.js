/**
 * User: rupin_t
 * Date: 7/22/13
 * Time: 4:07 PM
 */

(function ($) {
    $.isCrawlable = navigator.userAgent == 'crawlable'; // TODO make it dynamic

    /**
     * Crawlable loader jQuery plugin
     * @param options
     * @returns {*}
     */
    $.fn.crawlable = function (options) {
        if (!this.length) return this;

        var that = this;

        options.wait = typeof options.wait == 'number' ? options.wait : 250;
        options.interval = typeof options.interval == 'number' ? options.interval : 20;
        options.context = typeof options.context == 'string' ? '<div>' + options.context + '</div>' : '<div></div>';

        var $context = $(options.context);

        if (!$context.length)
            throw new Error('Couldn\'t fetch the context.');

        if ($.isCrawlable) {
            that.on('app:load', function () {
                $('body').append('<div id="app-fully-loaded"></div>');
            });
        }
        else {
            var jqInitFn = $.fn.init;
            that.on('app:load', function () {
                that.html($context.children());
                $context.remove();

                $.fn.init = jqInitFn;
            });
            // overload jquery in order to always use the app context and not window.
            $.fn.init = function (selector, context) {
                return new jqInitFn(selector, context, $context);
            };
        }

        /**
         * Triggers the document:ajax:inactive event when there is no more pending ajax request at page load.
         * This event will be triggered only one time.
         */
        var t, c = options.wait, called = false;

        var onTimeout = function (i) {
            if (!called) {
                called = true;
                that.trigger('app:load');
                clearInterval(i);
            }
        };

        var i = setInterval(function () {
            if ($.active) {
                if (t) clearTimeout(t);
                t = setTimeout(_.bind(onTimeout, i), options.wait);
            }
            else if (c <= 0) onTimeout(i);
            c -= options.interval;
        }, options.interval);

        return that;
    };

})(jQuery);