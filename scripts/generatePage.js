/**
 * User: rupin_t
 * Date: 7/8/13
 * Time: 5:35 PM
 */

var casper = require('casper').create({
//    verbose: true,
//    logLevel: "error",
//    exitOnError: true,
    onError: function (self, m) {
        console.log(m);
        self.exit();
    },
    pageSettings: {
        loadImage: false,
        loadPlugins: false,
        userAgent: 'crawlable',
        username: 'crawlable',
        password: 'crawlable'
    }
});

casper.start(casper.cli.get('url'));

casper.waitForSelector('#app-fully-loaded');

casper.then(function () {
    this.echo(this.getHTML('#app'));
});

casper.run();
