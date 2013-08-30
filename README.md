# Crawlable is a way to render your web application as a static web site

When you develop some cool features on a web project, there is a good chance that you do some ajax requests.
In the case you are developing a web application with ```backbone.js``` for example, you have no choice but to use the ajax
feature proposed by ```jQuery```.
So you are developing some great stuffs, but if your project needs to be viewed on the web, you will wonder two things:

* how is your work visible by google when it will try to reference it ? (is all the content always available, so it can be interpreted
by google ?)
* and how a visitor who doesn't have javascript support, or who have a slow computer will be able to navigate on it ?

Crawlable could be your solution ! It is able to render your dynamic client side stuffs written with javascript, on the server side.
By this way, it can give a static cached html to your client, before any javascript code started to be executed on the web page.

You may say now, "ok, but what if I have cached some dynamic content which could be updated at every time !?".

Crawlable doesn't simply cache html, it uses a module named ```Solidify``` (https://github.com/trupin/solidify) to generate a derived version of your client side templates before storing it. When a client request the server, Crawlable will feed the cached template with some updated data before giving it to you. 

## How does it works ?

Before explaining how all of this can be used, you need to understand how it works a little more deeply.

Here are the steps Crawlable is going through to compute your final server side rendered html:

* Crawlable demands to generate the cache for a specific page, so it asks to the router if it knows about a specific ```pathname```. If the router says "No !", a 404 HTTP  (not found) error is returned, otherwise, Crawlable continues its work.
* Crawlable then asks to ```phantomjs``` to render a page with a ```pathname``` for an ```host```. At this time, ```phantomjs``` will query your server, with a special ```user agent```, so it will now it's not a normal client.
* The client side javascript is interpreted by ```phantomjs```, and the templates are rendered in a special way, so Crawlable doesn't just get some html, rather a template compiled by ```Solidify```.
* Now Crawlable has this "solidified" template on the server side, it stores it, in order to be able to quickly refetch it at any time.
* If a normal client queries the same page, Crawlable renders it on the server side, by feeding it with updated data. The "solidified" template actually contains metadata, so Crawlable knows where to fetch these updated data, with a specific session id if needed, etc...
* Then, the rendered html can be injected in your web application page, so the final client will be able to see it right after the page has loaded.
* If the client has a javascript support, your web application will replace this static html after it has loaded. If not, the client will simply be able to visit the page as if it was a static web site. That's why if this client was Google, javascript support activated or not, the content would always be visible to it. So your web application would be referenced in the same conditions than a classic static web site.
 
## How do I use it ?

Crawlable uses ```phantomjs``` (http://phantomjs.org/) to render the web page on the server side, but you have no need to install it yourself,
the installer take care of it for you.

But, ```phantomjs``` uses ```python```. So you should have it installed to make the whole thing work.

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
