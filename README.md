# Crawlable is a way to render your web application as a static web site

When you develop some cool features on a web project, there is a great chance that you do some ajax requests.
In the case you are developing a web application with backbone.js for example, you have no choice but to use the ajax
feature proposed by jQuery.
So you are developing some great stuffs, but if your project needs to be viewed on the web, you will wonder two things:

* how is your work visible by google when it will try to reference it ? (is all the content always available, so it can be interpreted
by google ?)
* and how a visitor, who doesn't activated javascript, or who have a pretty slow computer will be able to navigate on it ?

Crawlable is maybe your solution, because it is able to render your dynamic client side stuffs written with javascript, on the server side.
By this way, it can give a static cached html to your client, before any javascript started to be executed on the web page.

## How do I use it ?

Crawlable uses phantomjs (http://phantomjs.org/) to render the web page on the server side, but you have no need to install it yourself,
the installer take care of it for you.

But, phantomjs uses ```python```. So you should have it installed to make the whole thing work.

Then, install it like this:

	`npm install crawlable --save`

At this time, Crawlable is very convenient to use with the great Express and Connect modules.

### So, how do I use it with Express ?

```
	var express = require('express'),
		Crawlable = require('crawlable');

	// this is the host that crawlable will query to render the pages.
	var host = 'http://127.0.0.1:' + (process.env.PORT || 5000);

	// create a new crawlable instance
	var crawlable = Crawlable.create({ host: host });

	// create your express application
	var app = express();

	// configure it
    app.configure(function () {
		// this middleware catches when crawlable is requesting your server
        app.use(crawlable._solidify.express());
    });

	// start crawlable
	crawlable.start(function (err) {
		if (err) return console.log(err);

		// register a route. in that case it is the only route available from the crawlable router
		crawlable.route('/', function (err) {
			if (err) return console.log(err);

			// register your express main route. don't forget the crawlable middleware, which will handle
			// the cached html content, and generate it if it doesn't exists.
			app.get('*', crawlable.express(), function (req, res) {
				// here you can do what you want to render your application.
				// you can access the rendered html like this: req.crawlable.html
				// for example:
                // res.render('app.html', { staticApp: req.crawlable.html });
            });

			// start your application
	        app.listen(url.parse(host).port);

			// generate the cache for every registered routes,so the first client will be able to access the static html.
			crawlable.crawl();
		});
	});

```

## Example

* You can check the todos example github: https://github.com/trupin/crawlable-todos
* Or visit it deployed at: http://crawlable-todos.herokuapp.com/
