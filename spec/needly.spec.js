/*global Needly, describe, it, expect, beforeEach, afterEach*/
describe("Needly:", function() {

  var need;

  //a simple test function, which simply returns its arguments
  function testFunc() { return arguments; }

  //a simple test class, which  copies the arguments as properties
  function TestClass(first, second, third) {
    this.first  = first; this.second = second; this.third  = third;
  }

  //a simple test factory, which creates a TestClass instance
  function testFactory(first, third) {
    return new TestClass(first, "bar", third);
  }

  beforeEach(function() { need = new Needly.Container(); });
  afterEach( function() { need.unregisterAll(); });

  describe("Needly.Container", function() {

    it("can be new-ed up", function() {
      var container = new Needly.Container();
      expect(container instanceof Needly.Container).toBeTruthy();
    });

    it("can be initialized without new, Crockford-style", function() {
      var container = Needly.Container();
      expect(container.registerClass).toBeTruthy();
    });

  });

  describe("registering Singleton dependencies with Container.registerSingleton", function() {

    it("registers a singleton dependency", function() {
      var instance = new TestClass();
      need.registerSingleton("foo", instance);
      expect(need.resolve("foo")).toBe(instance);
    });

  });

  describe("registering and resolving Class dependencies with Container.registerClass", function() {

    it("registers a class dependency and resolves an instance", function() {
      need.registerClass("class", TestClass);
      var instance = need.resolve("class");
      expect(instance instanceof TestClass).toBeTruthy();
    });

    it("registers a class dependency with pre-applied arguments", function() {
      need.registerClass("class", TestClass, ["foo"]);
      var instance = need.resolve("class");
      expect(instance.first).toEqual("foo");
    });

    it("registers a class dependency without arguments, creates dependency using arguments passed to resolve", function() {
      need.registerClass("class", TestClass);
      var instance = need.resolve("class", { args:["foo"] });
      expect(instance.first).toEqual("foo");
    });

    it("registers a class with partially applied arguments and fills rest from arguments passed to resolve", function() {
      need.registerClass("class", TestClass, ["foo"]);
      var instance = need.resolve("class", { args: ["bar"] });

      //first argument was registered, second passed at resolution
      expect(instance.first).toEqual("foo");
      expect(instance.second).toEqual("bar");
    });
  });

  describe("registering factory dependencies with registerFactory", function() {

    it("registers a factory and resolves to the return value", function() {
      need.registerFactory("factory", function() { return "foo"; });
      var instance = need.resolve("factory");
      expect(instance).toEqual("foo");
    });

    it("registers a factory with pre-applied arguments", function() {
      need.registerFactory("factory", testFactory, ["foo", "baz"]);
      var instance = need.resolve("factory");
      expect(instance.first).toEqual("foo");
      expect(instance.second).toEqual("bar");
      expect(instance.third).toEqual("baz");
    });

    it("registers a factory without arguments, uses arguments passed to resolve", function() {
      need.registerFactory("factory", testFactory);
      var instance = need.resolve("factory", {args:["foo", "baz"]});
      expect(instance.first).toEqual("foo");
      expect(instance.second).toEqual("bar");
      expect(instance.third).toEqual("baz");
    });

    it("registers a factory with partially applied arguments and fills rest from arguments to resolve", function() {

      need.registerFactory("factory", testFactory, ["foo"]);
      var instance = need.resolve("factory", { args:["qux"] });
      expect(instance.first).toEqual("foo");
      expect(instance.second).toEqual("bar");
      expect(instance.third).toEqual("qux");
    });

    it("overrides factory this-context with provided context", function() {
      var context = { foo:"bar" };

      need.registerFactory("factory", function() {
        expect(this).toBe(context);
      }, null, context);

      need.resolve("factory");
    });
  });

  describe("registering multiple dependencies with registerMany", function() {
    it("registers valid dependencies", function() {
      need.registerMany({
        a: { type:"singleton",  dependency:"foo" },
        b: { type:"factory",    dependency:testFactory, args:["bar"] },
        c: { type:"class",      dependency:TestClass,   args:["baz"] }
      });

      expect(need.resolve("a")).toEqual("foo");
      expect(need.resolve("b").first).toEqual("bar");
      expect(need.resolve("c").first).toEqual("baz");
    });

    it("throws if type is missing or is not valid", function() {
      expect(function() { need.registerMany({a: { dependency:"foo" }}); }).toThrow();
      expect(function() { need.registerMany({a: { type:"lol",  dependency:"wut" }}); }).toThrow();
    });

    it("throws is dependency is not provided", function() {
      expect(function() { need.registerMany({a: { type:"class", dependency:null }}); }).toThrow();
    });
  }),

  describe("resolve", function() {

    it("calls error callback if module was not found", function() {
      var errorMessage;
      need.registerClass("foo", TestClass);

      need.resolve("foo", { error: function(msg) { errorMessage = msg; } });
      expect(errorMessage).toBeUndefined();

      need.resolve("bar", { error: function(msg) { errorMessage = msg; } });
      expect(errorMessage).toEqual("DependencyNotFound:bar");
    });

    it("resolves nested dependencies defined for registered class", function() {
      //create a few test classes with nested dependencies
      var A = function() {};
      var B = function() {};
      var C = function() {};
      A.prototype.b = need.property("b");
      B.prototype.c = need.property("c");

      //register classes
      need.registerClass("a", A);
      need.registerClass("b", B);
      need.registerClass("c", C);

      //check that the dependency tree was resolved
      var a = need.resolve("a");
      expect(a     instanceof A).toBeTruthy();
      expect(a.b   instanceof B).toBeTruthy();
      expect(a.b.c instanceof C).toBeTruthy();
    });

    it("resolves nested dependencies of factory-created instances", function() {

      var A = function() { };
      A.prototype.b = need.property("b");

      need.registerFactory("a-factory", function() { return new A(); });
      need.registerSingleton("b", "B");

      var a = need.resolve("a-factory");
      expect(a   instanceof A).toBeTruthy();
      expect(a.b).toEqual("B");
    });
  });

  describe("unregister", function() {
    it("unregisters a single dependency by name", function() {
      need.registerSingleton("foo", "foo");
      need.registerSingleton("bar", "bar");
      expect(need.resolve("foo")).toBeDefined();
      expect(need.resolve("bar")).toBeDefined();

      need.unregister("bar");
      expect(need.resolve("foo")).toBeDefined();
      expect(need.resolve("bar")).toBeUndefined();
    });
  });

  describe("unregisterAll", function() {
    it("unregisters a all dependencies", function() {
      need.registerSingleton("foo", "foo");
      need.registerSingleton("bar", "bar");
      expect(need.resolve("foo")).toBeDefined();
      expect(need.resolve("bar")).toBeDefined();

      need.unregisterAll();
      expect(need.resolve("foo")).toBeUndefined();
      expect(need.resolve("bar")).toBeUndefined();
    });
  });

  describe("property", function() {

    it("creates a resolver for a named dependency", function() {
      need.registerClass("foo", TestClass);
      var resolver = need.property("foo");
      expect(resolver.resolve).toBeDefined();
      expect(resolver.resolve() instanceof TestClass).toBeTruthy();
    });

    it("can resolve a dependency that doesn't exist at the time of injection", function() {

      var resolver = need.property("foo");
      expect(resolver.resolve()).toBeUndefined();

      need.registerClass("foo", TestClass);
      expect(resolver.resolve() instanceof TestClass).toBeTruthy();
    });
  });

  describe("args", function() {

    it("can inject arguments to function", function() {

      var func = need.args("foo", testFunc);
      need.registerClass("foo", TestClass);

      var args = func();
      expect(args[0] instanceof TestClass).toEqual(true);
    });

    it("can inject multiple dependencies into object argument", function() {
      need.registerSingleton("foo", "foo");
      need.registerSingleton("bar", "bar");
      var func = need.args({arg1:"foo", arg2:"bar"}, testFunc);

      var result = func();
      expect(result[0].arg1).toEqual("foo");
      expect(result[0].arg2).toEqual("bar");
    });

    it("can merge injected properties to existing object argument", function() {
      need.registerSingleton("foo", "foo");
      need.registerSingleton("bar", "bar");
      var func = need.args({arg1:"foo", arg2:"bar"}, testFunc);

      var result = func({arg2: "baz", arg3:"baz"}, "qux");
      expect(result[0].arg1).toEqual("foo");
      expect(result[0].arg2).toEqual("baz");
      expect(result[0].arg3).toEqual("baz");
      expect(result[1]).toEqual("qux");
    });

    it("prefers passed arguments to injected arguments", function() {
      need.registerSingleton("foo", "foo");
      need.registerSingleton("bar", "bar");
      var func = need.args("foo", "bar", testFunc);
      var args = func("baz");
      expect(args.length).toEqual(2);
      expect(args[0]).toEqual("baz");
      expect(args[1]).toEqual("bar");
    });

  });
});