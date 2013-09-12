# `Crawlable` is a way to render your web application as a static web site

When you develop some cool features on a web project, there is a good chance that you do some ajax requests.
In the case you are developing a web application with `backbone.js` for example, you have no choice but to use the ajax
feature proposed by `jQuery`.
So you are developing some great stuffs, but if your project needs to be viewed on the web, you will wonder two things:

* how is your work visible by google when it will try to reference it ? (is all the content always available, so it can be interpreted
by google ?)
* and how a visitor who doesn't have javascript support, or who have a slow computer will be able to navigate on it ?

`Crawlable` could be your solution ! It is able to render your dynamic client side stuffs written with javascript, on the server side.
By this way, it can give a static cached html to your client, before any javascript code started to be executed on the web page.

You may say now, "ok, but what if I have cached some dynamic content which could be updated at every time !?".

`Crawlable` doesn't simply cache html, it uses a module named `Solidify` (https://github.com/trupin/solidify) to generate a derived version of your client side templates before storing it. When a client requests the server, Crawlable will feed the cached template with some updated data before giving it to you.

## How does it works ?

Before explaining how all of this can be used, you need to understand how it works a little more deeply.

Here are the steps `Crawlable` is going through to compute your final server side rendered html:

* `Crawlable` demands to generate the cache for a specific page, so it asks to the router if it knows about a specific `pathname`. If the router says "No !", a 404 HTTP  (not found) error is returned, otherwise, Crawlable continues its work.
* `Crawlable` then asks to `phantomjs` to render a page with a `pathname` for an `host`. At this time, `phantomjs` will query your server, with a special `user agent`, so it will know it's not a normal client.
* The client side javascript is interpreted by `phantomjs`, and the templates are rendered in a special way, so `Crawlable` doesn't just get some html, rather a template compiled by `Solidify`.
* Now `Crawlable` has this "solidified" template on the server side, it stores it, in order to be able to quickly refetch it at any time.
* If a normal client queries the same page, `Crawlable` renders it on the server side, by feeding it with updated data. The "solidified" template actually contains metadata, so Crawlable knows where to fetch these updated data, with a specific session id if needed, etc...
* Then, the rendered html can be injected in your web application page, so the final client will be able to see it right after the page has loaded.
* If the client has a javascript support, your web application will replace this static html after it has loaded. If not, the client will simply be able to visit the page as if it was a static web site. That's why if this client was Google, javascript support activated or not, the content would always be visible to it. So your web application would be referenced in the same conditions than a classic static web site.
 
## How do I use it ?

 `Crawlable` uses `phantomjs` (http://phantomjs.org/) to render the web page on the server side, but you have no need to install it yourself,
the installer takes care of it for you.

But, `phantomjs` uses `python`. So you should have it installed to make the whole thing work.

Then, install it like this:

`npm install crawlable --save`

At this time, `Crawlable` is very convenient to use with the great `Express` and `Connect` modules.
As we saw above, `Crawlable` is not simply a server side module, but also a client side library.

On the client side, you would use it with the `JQuery` plugin named `jquery.crawlable.js`. This plugin depends on
the `Solidify` plugin named `jquery.solidify.js`, which also depends on the `Handlebars` template engine and `JQuery`.

So you would include something like this in your html:

``` html
	<script type="text/javascript" src="/jquery.js"></script>
	<script type="text/javascript" src="/handlebars.js"></script>
	<script type="text/javascript" src="/jquery.solidify.js"></script>
	<script type="text/javascript" src="/jquery.crawlable.js"></script>
```

### So, how do I use it on the server side with `Express` ?

Here is the code you could use in your `app.js` file:

``` js
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

Then, admitting you are using `Handlebars` as a template engine, here is what you could have as `index.html` file:

``` html
	<html>
		<head>...</head>
		<body>
			<!-- Where you put your static application content at the first place. -->
			<div id="app">{{{ staticApp }}}</div>

			<!-- JS libraries -->
            <script type="text/javascript" src="/jquery/jquery.js"></script>
            <script type="text/javascript" src="/handlebars/handlebars.js"></script>
            <script type="text/javascript" src="/underscore/underscore.js"></script>
	        <script type="text/javascript" src="/backbone/backbone.js"></script>
            <script type="text/javascript" src="/backbone.babysitter/lib/backbone.babysitter.js"></script>
            <script type="text/javascript" src="/backbone.wreqr/lib/backbone.wreqr.js"></script>
            <script type="text/javascript" src="/marionette/lib/backbone.marionette.js"></script>
            <script type="text/javascript" src="/solidify/jquery.solidify.js"></script>
            <script type="text/javascript" src="/crawlable/jquery.crawlable.js"></script>

            <!-- Application sources -->
            <script type="text/javascript" src="/app.js"></script>
		</body>
	</html>
```

### How do I make my client side javascript compatible ?

What happen now on the client side ? Here is what you could have in your `app.js` file:

``` js
	// Be sure to use the solidify template engine.
	Backbone.Marionette.TemplateCache.prototype.compileTemplate = function (rawTemplate) {
        return Backbone.$.solidify(rawTemplate);
    };

	// Create a Marionette application (it could be Backbone.js or whatever you want).
	var app = new Marionette.Application();

	// Initialize it.
	app.addInitializer(function () {
		// do something ...
	});

	$(document).ready(function () {

		// Initialize your main application anchor with crawlable.
		// It says to crawlable to wait for the application to be fully loaded, before inject the code
		// into the <div id="#app">.
		// The context option is the initial state with which the application should start.
        $('#app').crawlable({
            context: '<div class="container-fluid"></div>'
        });

		// Simply start your application.
        app.start();

	});
```

At this point, the peace of code we seen is able to load an application in front of its ```Crawlable``` static part.
But what if we want to create some dynamic content, and cache it with ```Crawlable```?

Imagine now you want to render a list. You would have a `Collection` and a `View`, rendering an `ItemView` for each
`Model` of your `Collection`.

By using some `Handlebars` templates, see how you would do (notice there is no need to modify your javascript code
to make it compatible with `Crawlable`, only your templates).

Here is the `Item` template:

``` html
	<!-- specify the needed request to fetch the data -->
	{{solidify "/api/items"}}
	<!-- the same as {{#each}}, but for the server side rendering only (client will ignore it) -->
	{{#solidify-each "this"}}
		<!-- dereference the field content, will be interpreted on the client and server side -->
		<li>{ {content} }</li>
	{{/solidify-each}}
```

Now here is the `List` template:

``` html
	<div>
		<h1>My list</h1>
		<div>
			<!-- Include a template. This is for the server side only, the client simply ignore it -->
			{{solidify-include "/templates/item.html"}}
		</div>
	</div>
```

As you can see, you just have to respect some extra rules to make your template understandable by `Crawlable`.
You can see the `Solidify` documentation for details, but here is what you need for now:

* `{{solidify ["method"] "/my/api/route"}}` specifies a request to do when `Crawlable` will need some data to feed the template
(on the server side only).
* `{{solidify-include "/my/template/path"}}` specifies a template to include (on the server side only).
* `{{[#]solidify-helperName}}` calls an helper (on the server side only).
* `{ {[#]helperName} }` calls an helper (on the client and server side).
* `{ {fieldName} }` dereferences a field (on the client and server side).

Notice that every other `Handlebars` syntax are available, and all the syntax we saw which are used on the server side
only, are completely ignored by `Solidify` on the client side, so it has no influence on your client side original template.

## Options

`Crawlable` provides the following configuration options:

* `logger`: a winston logger instance to provide a way to log.
* `Persistence`: a `Persistence` class to provide a way to store data. Defaults to `NeDb`.
* `persistenceOptions`: an object containing the `persistence` options used at instantiation.
* `cacheTtl`: the cache entry time to live in seconds. Defaults to one hour.
* `Renderer`: the `Renderer` class to provide a way to render a webpage. Defaults to `DefaultRenderer`.
* `rendererOptions`: an object containing the `renderer` options used at instantiation.
* `concurrency`: the max amount of pages it can process at the same time. Defaults to 10.

## What technologies does it use and why ?

`Crawlable` uses the excellent [`PhantomJS`](http://phantomjs.org/) through a bridge, implemented in the node module [`phantom`](https://github.com/sgentle/phantomjs-node)
It is light because only one `PhantomJS` process is used. This process runs like a "page pool", meaning that an amount of
pages is launched at the start and only these `PhantomJS` pages are used to render the html.
By doing this way, `Crawlable` saves a lot of memory and can consider doing some efficient parallel renderings.

`Crawlable` also uses [`nedb`](https://github.com/louischatriot/nedb) by default to store data.
This can handle an "in memory" and a "persistent" storing. It is also totally embedded and very light.

## Want an example ?

* You can check the todos example on `github`: https://github.com/trupin/crawlable-todos
* Or visit it deployed on `heroku`: http://crawlable-todos.herokuapp.com/
