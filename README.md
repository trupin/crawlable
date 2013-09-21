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

`Crawlable` doesn't simply cache html, it uses a module named [`Solidify`](https://github.com/trupin/solidify) to generate a derived version of your client side templates before storing it. When a client requests the server, Crawlable will feed the cached template with some updated data before giving it to you.

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
 
## How to use it ?

 `Crawlable` uses [`phantomjs`](http://phantomjs.org/) to render the web page on the server side, but you have no need to install it yourself,
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

### How to use it on the server side with `Express` ?

The code below is what your app.js file could contain.

``` js
var Crawlable = require('crawlable');

Crawlable.express({
    port: process.env.PORT || 5000, // the listened port.
    configure: function (app, express) {
        // you can configure your app here.
        app.use(express.favicon());
        app.use(express.static(__dirname + '/public'));
        app.use(express.logger('dev'));
        app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    },
    routes: function (app) {
        // register your api routes here.
        app.get('/my/api/route', function (req, res) {
            // do something in your API route.
        });

        // and your crawlable routes.
        app.crawlable('/');
    },
    render: function (req, res) {
        // specify a way to render your application.
        res.render('app.html', { html: req.crawlable.html });
    }
}, function (err, app) {
    if (err)
        return console.log(err);
    console.log('The application is ready.');
    // crawl every routes in order to generate the crawlable cache.
    app.crawl();
});
```

In this example, we create a ready to use `Express` application. The server is already configured to be used with `Crawlable`. This means each registered routes (`get|post|put|del`) define your API, and each registered `Crawlable` routes define a way to render your application.

When a client requests a `Crawlable` route, the `render` function is called with the `req.crawlable` object filled with some elements you may need to render your application (most of the time your need the `req.crawlable.html` string, which contains the html of your rendered application for this route).

Notice the `Crawlable.express` configures the application to use `HandleBars` as a template engine.

The `index.html` template could be as below.

``` html
<html>
    <head>...</head>
    <body>
        <!-- Where you put your static application content at the first place. -->
        <div id="app">{{{ html }}}</div>

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

### Description of `Crawlable.express`

`Crawlable.express(options, callback) {...};`

**options:**
* `port`: the listened port. _Required_
* `crawlable`: the crawlable options.
* `handlebars.views`: the folder where your views are (default to 'views').
* `handlebars.helpers`: a function to register some helpers (`function (HandleBars, ...) {...};`).
* `handlebars.args`: an array of arguments which will be passed to the `handlebars.helpers` function.
* `configure`: a function to configure your `Express` application (`function (app, express) {...};`). _Required_
* `routes`: a function to register your `Express` and `Crawlable` routes (`function (app) {...};`).
* `render`: a function to render your application (`function (req, res) {...};`). _Required_

**callback:** a function called just after the application has started (`function (err, res) {...};`).

**`app` object extra features**:
* `app._crawlable`: the `Crawlable` instance.
* `app.crawlable`: the `crawlable.route` method equivalent. Registers a `crawlable` route (`app.crawlable("pathname" | ["pahtname1", ...]);`).
* `app.crawl`: the `crawlable.crawl` method equivalent. Crawls all the `crawlable` routes (`app.crawl(callback);`).

## Adapt a `Backbone.Marionette` application to `Crawlable`

The code below is what your `app.js` file could contain.

``` js
// Be sure to use the solidify template engine.
Backbone.Marionette.TemplateCache.prototype.compileTemplate = function (rawTemplate) {
    return Backbone.$.solidify(rawTemplate);
};

// Create a Marionette application (it could be Backbone.js or whatever you want).
var app = new Marionette.Application();

$(document).ready(function () {
    // Initialize your main application anchor with crawlable.
    // It says to crawlable to wait for the application to be fully loaded, before injecting the code
    // into the <div id="#app">.
    $('#app').crawlable();

    // Start your application.
    app.start();
});
```

This example of code shows you how to render your application over the static html, cached by `Crawlable`. By doing that, your application page will seems to be fully loaded even if your javascript code hasn't been executed yet.

### Description of the `jQuery.crawlable` plugin

`jQuery("selector").crawlable(options);`: define an anchor in which your dynamic application will be injected when fully loaded.

**options**:

* `context`: a string containing the initial html with which your application should start.
* `wait`: a number determining how much time (ms) `Crawlable` have to wait after the last ajax query to consider the application as fully loaded (default to 250 ms).

### Dynamic cached templates

You may wonder now, **"What if my page deals with some dynamic contents ?"**. `Crawlable` is able to handle it, but you will have to adapt your client side templates.

For this example, imagine we want to render a list. We have a `Collection` and a `View`, rendering an `ItemView` for each `Model` of our `Collection`.

By using some `Handlebars` templates, see how we do it.

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

As you can see, we just have to respect some extra rules to make our template understandable by `Crawlable`.

### Quick description of the `Solidify` syntax

You can see the [`Solidify` documentation](https://github.com/trupin/solidify) for details, but here is what you need for now:

* `{{solidify ["method"] "/my/api/route"}}` specifies a request to do when `Crawlable` will need some data to feed the template
(on the server side only).
* `{{solidify-include "/my/template/path"}}` specifies a template to include (on the server side only).
* `{{[#]solidify-helperName}}` calls an helper (on the server side only).
* `{ {[#]helperName} }` calls an helper (on the client and server side).
* `{ {fieldName} }` dereferences a field (on the client and server side).

Notice that every other `HandleBars` syntax are available, and all the syntaxes we saw which are used on the server side only, are completely ignored by `Solidify` on the client side, so it has no influence on your client side original templates. 
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
