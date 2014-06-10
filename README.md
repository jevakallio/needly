NeedlyJS
======

A tiny (< 1KB minified and gzipped) JavaScript dependency injector / service locator.

## Getting started

Although Needly was originally designed for use in Backbone application, it has no external dependencies. Go ahead and include Needly in your project any way you see fit. `Needly` works as a browser global, AMD module, and with node.js.

Start by initializing a new `Needly.Container`. In most cases you'll need one container throughout the application lifetime.

```javascript
  var needs = new Needly.Container();
```

I like to call the instance `needs`, because it flows nicely with the rest of the API:

```javascript
  needs.registerClass('navigationservice', NavigationService);

  var View = Backbone.View.extend({
    navigation: needs.property('navigationservice')
    initialize: function() {
      needs.resolveAll(this);
    },
    onCancel: function() {
      this.navigation.back();
    }
  });

  var view = new View();
```

TODO

## API

The API documentation exists in the form of Jasmine specs. Check 'em out.
