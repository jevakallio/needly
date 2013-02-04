/*global module*/
/*jshint curly:false */

(function (root, factory) {
  if (typeof exports === 'object') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    root.Needly = factory();
  }
}(this, function () {

  //private
  var CLASS = "class";
  var FACTORY = "factory";
  var SINGLETON = "singleton";
  var _slice = Array.prototype.slice;
  var _construct = function(ctor, args) {
    function F() { return ctor.apply(this, args);}
    F.prototype = ctor.prototype;
    return new F();
  };
  var _concat = function(a, b) {
    return (a || []).concat(b || []);
  };

  /**
   * A resolver function that is exported by container.inject()
   * Works by closing over the container's resolve-method with
   * passed args.
   * @param {String}  name  Dependency name to resolve
   * @param {Array}   args  Optional arguments for dependency's constructor
   */
  function Dependency(container, name, args) {
    this.resolve = function() {
      return container.resolve(name, { args:args });
    };
  }

  /**
   * Needly.Container, a IoC container which can be used as a dependency injector
   * and a service locator
   */
  function Container() {

    var _self = this, _cache = {};

    /**
     * Registers a "Class" (a constructor function) with name and optional arguments
     * @param {String}    name      Dependency name to register
     * @param {Function}  Class     Dependency
     * @param {Array}     withArgs  Optional arguments to the Class constructor
     *
     * @returns argument:Class for chaining
     */
    this.registerClass = function(name, Class, withArgs) {
      _cache[name] = {
        type: CLASS,
        item: Class,
        args: withArgs
      };
      return Class;
    };

    /**
     * Registers a Singleton instance with name and optional arguments
     * @param {String}    name      Dependency name to register
     * @param {Function}  instance  Singleton instance. Can be anything.
     *
     * @returns argument:instance for chaining
     */
    this.registerSingleton = function(name, instance) {
      _cache[name] = {
        type: SINGLETON,
        item: instance
      };
      return instance;
    };

    /**
     * Registers a factory function dependency with name and optional arguments
     * @param {String}    name      Dependency name to register
     * @param {Function}  factory   Factory (any function which returns the dependency)
     * @param {Array}     withArgs  Optional arguments to the factory function
     * @param {Any}       context   Optional context for the factory function
     *
     * @returns argument:factory for chaining
     */
    this.registerFactory = function(name, factory, withArgs, context) {
      _cache[name] = {
        type: FACTORY,
        item: factory,
        args: withArgs,
        context:  context
      };
      return factory;
    };

    /**
     * Registers multiple dependencies using a configuration object. The keys will be the
     * dependency names, and the the values should be objects in the format:
     *  {String}  type        Type of dependency (class|singleton|factory)
     *  {Any}     dependency  The dependency to register
     *  {Array}   args        (Optional) arguments to pass to class constructor or factory
     *  {Any}     context     (Optional) context to pass to factory
     */
    this.registerMany = function(config) {
      for(var key in config) {
        if(config.hasOwnProperty(key)) {
          var dep = config[key];
          var type = dep.type;
          var err = "BadConfiguration:";
          if(!dep || !dep.dependency)
              throw new Error(err + key + ".dependency");
          if(type !== SINGLETON && type !== CLASS && type !== FACTORY)
              throw new Error(err + key + ".type");
          _cache[key] = {
            item:dep.dependency,
            type:dep.type,
            args:dep.type !== SINGLETON ? dep.args: null,
            context: dep.type === FACTORY ? dep.context : null
          };
        }
      }
    };

    /**
     * Unregisters a dependency by name
     * @param {String}  name  Name of the dependency to unregister
     * @returns {Boolean} whether a dependency was found and deleted
     */
    this.unregister = function(name) {
      delete _cache[name];
    };

    /**
     * Unregisters all dependencies
     */
    this.unregisterAll = function() {
      _cache = {};
    };

    /**
     * Creates an injector for a  named dependency, which can be later resolved.
     * The dependency does not necessarily have to be registered at the time of
     * injection, as long as it will be by the time the dependency is resolved.
     * @param {String}  name    Name of the dependency.
     * @param {Array}   args    Optional arguments for the dependency's constructor (if a class)
     *
     * @returns {Dependency}    An injector for dependency by name, bound to this container.
     */
    this.property = function(name, args) {
      return new Dependency(this, name, args);
    };

    /**
     * Creates a modified version of the passed function that, when called, is
     * injected with the dependecies specified by rest of the arguments:
     *
     * @param {Function} func   The function to wrap
     * @param {Array}    args   Names of the dependencies to inject
     *
     * @returns {Function} A wrapped version of func, which is injected at call-time
     * @example container.injectArgs()
     */
    this.args = function() {
      var len = arguments.length - 1,
          args = _slice.call(arguments, 0, len),
          func = arguments[len];

      return function() {
        var resolved = [];
        var override = _slice.call(arguments);
        var count = Math.max(len, override.length);

        for(var i=0; i<count; i++) {

          var dep = args[i], conf;

          if(!dep) {
            dep = override[i];
          }
          else if(typeof dep === 'string') {
            dep = override[i] || _self.resolve(dep);
          }
          else if(dep === new Object(dep)) {
            conf = dep;
            dep = override[i] || {};
            for(var prop in conf) {
              if(!dep.hasOwnProperty(prop) && conf.hasOwnProperty(prop)) {
                dep[prop] = _self.resolve(conf[prop]);
              }
            }
          }
          else {
            throw new Error("BadArgument: Expected string or object. Received: " + dep);
          }
          resolved.push(dep);
        }

        return func.apply(func, resolved);
      };
    },

    /**
     * Resolves all injected dependencies for an object. Works by iterating
     * the object's properties, and if any of them is a Dependency resolver,
     * replaces the resolver with the resolved dependency.
     *
     * @param {Function|Object} Any function or object (associative array).
     * @returns argument:obj for chaining
     */
    this.resolveAll = function(obj) {
      for(var prop in obj) {
        var val = obj[prop];
        if(val && val instanceof Dependency) {
          obj[prop] = val.resolve();
        }
      }
      return obj;
    };

    /**
     * Overrides the @initializer function of the @Class prototype
     * to resolve all property-injected dependencies.
     * @param {Function}  Class             A class (constructor function)
     * @param {String}    initializer   Name of the function to override. Optional,
                                            defaults to "initialize".
     */
    this.autoResolve = function(Class, initializer) {
      initializer = initializer || "initialize";
      var init = Class.prototype[initializer];
      Class.prototype[initializer] = function() {
          _self.resolveAll(this);
          if(init) init.apply(this, arguments);
      };
    };

    /**
     * Resolves a dependency by name. If dependency is not found,
     * calls options.error handler, if defined, and returns undefined.
     * @param {String}  name    Dependency name
     * @param {Object}  options Options object with following, optional properties
     *  > {Function}  error  Error handler
     *  > {Array}     args   Arguments to pass to dependency (factory or Class, ignored for singleton).
     */
    this.resolve = function(name, options) {
      var opts = options || {};
      var dep = _cache[name];
      var args;
      if(dep) {
        args = _concat(dep.args, opts.args);
        switch(dep.type) {
          case SINGLETON:
            return dep.item;
          case FACTORY:
            return this.resolveAll(dep.item.apply(opts.context || dep.context || this, args));
          case CLASS:
            return this.resolveAll(_construct(dep.item, args));
        }
      } else {
        var warning = "DependencyNotFound:" + name;
        if(console && console.warn) console.warn(warning);
        if(opts.error) opts.error(warning);
      }
    };

    return this;
  }

  return {
    Container: Container
  };

}));