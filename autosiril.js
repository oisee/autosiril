(function(undefined) {
  if (typeof(this.Opal) !== 'undefined') {
    console.warn('Opal already loaded. Loading twice can cause troubles, please fix your setup.');
    return this.Opal;
  }

  var nil;

  // The actual class for BasicObject
  var BasicObject;

  // The actual Object class.
  // The leading underscore is to avoid confusion with window.Object()
  var _Object;

  // The actual Module class
  var Module;

  // The actual Class class
  var Class;

  // Constructor for instances of BasicObject
  function BasicObject_alloc(){}

  // Constructor for instances of Object
  function Object_alloc(){}

  // Constructor for instances of Class
  function Class_alloc(){}

  // Constructor for instances of Module
  function Module_alloc(){}

  // Constructor for instances of NilClass (nil)
  function NilClass_alloc(){}

  // The Opal object that is exposed globally
  var Opal = this.Opal = {};

  // All bridged classes - keep track to donate methods from Object
  var bridges = {};

  // TopScope is used for inheriting constants from the top scope
  var TopScope = function(){};

  // Opal just acts as the top scope
  TopScope.prototype = Opal;

  // To inherit scopes
  Opal.constructor = TopScope;

  // List top scope constants
  Opal.constants = [];

  // This is a useful reference to global object inside ruby files
  Opal.global = this;

  // Minify common function calls
  var $hasOwn = Opal.hasOwnProperty;
  var $slice  = Opal.slice = Array.prototype.slice;

  // Nil object id is always 4
  var nil_id = 4;

  // Generates even sequential numbers greater than 4
  // (nil_id) to serve as unique ids for ruby objects
  var unique_id = nil_id;

  // Return next unique id
  Opal.uid = function() {
    unique_id += 2;
    return unique_id;
  };

  // Table holds all class variables
  Opal.cvars = {};

  // Globals table
  Opal.gvars = {};

  // Exit function, this should be replaced by platform specific implementation
  // (See nodejs and phantom for examples)
  Opal.exit = function(status) { if (Opal.gvars.DEBUG) console.log('Exited with status '+status); };

  // keeps track of exceptions for $!
  Opal.exceptions = [];

  // Get a constant on the given scope. Every class and module in Opal has a
  // scope used to store, and inherit, constants. For example, the top level
  // `Object` in ruby has a scope accessible as `Opal.Object.$$scope`.
  //
  // To get the `Array` class using this scope, you could use:
  //
  //     Opal.Object.$$scope.get("Array")
  //
  // If a constant with the given name cannot be found, then a dispatch to the
  // class/module's `#const_method` is called, which by default will raise an
  // error.
  //
  // @param [String] name the name of the constant to lookup
  // @return [RubyObject]
  //
  Opal.get = function(name) {
    var constant = this[name];

    if (constant == null) {
      return this.base.$const_get(name);
    }

    return constant;
  };

  // Create a new constants scope for the given class with the given
  // base. Constants are looked up through their parents, so the base
  // scope will be the outer scope of the new klass.
  //
  // @param base_scope [$$scope] the scope in which the new scope should be created
  // @param klass      [Class]
  // @param id         [String, null] the name of the newly created scope
  //
  Opal.create_scope = function(base_scope, klass, id) {
    var const_alloc = function() {};
    var const_scope = const_alloc.prototype = new base_scope.constructor();

    klass.$$scope       = const_scope;
    klass.$$base_module = base_scope.base;

    const_scope.base        = klass;
    const_scope.constructor = const_alloc;
    const_scope.constants   = [];

    if (id) {
      Opal.cdecl(base_scope, id, klass);
      const_alloc.displayName = id+"_scope_alloc";
    }
  }

  // A `class Foo; end` expression in ruby is compiled to call this runtime
  // method which either returns an existing class of the given name, or creates
  // a new class in the given `base` scope.
  //
  // If a constant with the given name exists, then we check to make sure that
  // it is a class and also that the superclasses match. If either of these
  // fail, then we raise a `TypeError`. Note, superklass may be null if one was
  // not specified in the ruby code.
  //
  // We pass a constructor to this method of the form `function ClassName() {}`
  // simply so that classes show up with nicely formatted names inside debuggers
  // in the web browser (or node/sprockets).
  //
  // The `base` is the current `self` value where the class is being created
  // from. We use this to get the scope for where the class should be created.
  // If `base` is an object (not a class/module), we simple get its class and
  // use that as the base instead.
  //
  // @param base        [Object] where the class is being created
  // @param superklass  [Class,null] superclass of the new class (may be null)
  // @param id          [String] the name of the class to be created
  // @param constructor [Function] function to use as constructor
  //
  // @return new [Class]  or existing ruby class
  //
  Opal.klass = function(base, superklass, id, constructor) {
    var klass, bridged, alloc;

    // If base is an object, use its class
    if (!base.$$is_class && !base.$$is_module) {
      base = base.$$class;
    }

    // If the superclass is a function then we're bridging a native JS class
    if (typeof(superklass) === 'function') {
      bridged = superklass;
      superklass = _Object;
    }

    // Try to find the class in the current scope
    klass = base.$$scope[id];

    // If the class exists in the scope, then we must use that
    if (klass && klass.$$orig_scope === base.$$scope) {
      // Make sure the existing constant is a class, or raise error
      if (!klass.$$is_class) {
        throw Opal.TypeError.$new(id + " is not a class");
      }

      // Make sure existing class has same superclass
      if (superklass && klass.$$super !== superklass) {
        throw Opal.TypeError.$new("superclass mismatch for class " + id);
      }

      return klass;
    }

    // Class doesnt exist, create a new one with given superclass...

    // Not specifying a superclass means we can assume it to be Object
    if (superklass == null) {
      superklass = _Object;
    }

    // If bridged the JS class will also be the alloc function
    alloc = bridged || boot_class_alloc(id, constructor, superklass);

    // Create the class object (instance of Class)
    klass = boot_class_object(id, superklass, alloc);

    // Name the class
    klass.$$name = id;
    klass.displayName = id;

    // Mark the object as a class
    klass.$$is_class = true;

    // Every class gets its own constant scope, inherited from current scope
    Opal.create_scope(base.$$scope, klass, id);

    // Name new class directly onto current scope (Opal.Foo.Baz = klass)
    base[id] = base.$$scope[id] = klass;

    if (bridged) {
      Opal.bridge(klass, alloc);
    }
    else {
      // Copy all parent constants to child, unless parent is Object
      if (superklass !== _Object && superklass !== BasicObject) {
        donate_constants(superklass, klass);
      }

      // Call .inherited() hook with new class on the superclass
      if (superklass.$inherited) {
        superklass.$inherited(klass);
      }
    }

    return klass;
  };

  // Create generic class with given superclass.
  Opal.boot_class = function(superklass, constructor) {
    var alloc = boot_class_alloc(null, constructor, superklass)

    return boot_class_object(null, superklass, alloc);
  }

  // The class object itself (as in `Class.new`)
  //
  // @param superklass [(Opal) Class] Another class object (as in `Class.new`)
  // @param alloc      [constructor]  The constructor that holds the prototype
  //                                  that will be used for instances of the
  //                                  newly constructed class.
  function boot_class_object(id, superklass, alloc) {
    // Grab the superclass prototype and use it to build an intermediary object
    // in the prototype chain.
    function Superclass_alloc_proxy() {}
    Superclass_alloc_proxy.prototype = superklass.constructor.prototype;
    function SingletonClass_alloc() {}
    SingletonClass_alloc.prototype = new Superclass_alloc_proxy();

    if (id) {
      SingletonClass_alloc.displayName = "SingletonClass_alloc("+id+")";
    }

    // The built class is the only instance of its singleton_class
    var klass = new SingletonClass_alloc();

    setup_module_or_class_object(klass, SingletonClass_alloc, superklass, alloc.prototype);

    // @property $$alloc This is the constructor of instances of the current
    //                   class. Its prototype will be used for method lookup
    klass.$$alloc = alloc;

    // @property $$proto.$$class Make available to instances a reference to the
    //                           class they belong to.
    klass.$$proto.$$class = klass;

    return klass;
  }

  // Adds common/required properties to a module or class object
  // (as in `Module.new` / `Class.new`)
  //
  // @param module      The module or class that needs to be prepared
  //
  // @param constructor The constructor of the module or class itself,
  //                    usually it's already assigned by using `new`. Some
  //                    ipothesis on why it's needed can be found below.
  //
  // @param superklass  The superclass of the class/module object, for modules
  //                    is `Module` (of `Module` in JS context)
  //
  // @param prototype   The prototype on which the class/module methods will
  //                    be stored.
  //
  function setup_module_or_class_object(module, constructor, superklass, prototype) {
    // @property $$id Each class is assigned a unique `id` that helps
    //                comparation and implementation of `#object_id`
    module.$$id = Opal.uid();

    // @property $$proto This is the prototype on which methods will be defined
    module.$$proto = prototype;

    // @property constructor keeps a ref to the constructor, but apparently the
    //                       constructor is already set on:
    //
    //                          `var module = new constructor` is called.
    //
    //                       Maybe there are some browsers not abiding (IE6?)
    module.constructor = constructor;

    if (superklass === Module) {
      // @property $$is_module Clearly mark this as a module
      module.$$is_module = true;
      module.$$class     = Module;
    }
    else {
      // @property $$is_class Clearly mark this as a class
      module.$$is_class = true;
      module.$$class    = Class;
    }

    // @property $$super the superclass, doesn't get changed by module inclusions
    module.$$super = superklass;

    // @property $$parent direct parent class or module
    //                    starts with the superclass, after module inclusion is
    //                    the last included module
    module.$$parent = superklass;

    // @property $$inc included modules
    module.$$inc = [];
  }

  // Define new module (or return existing module). The given `base` is basically
  // the current `self` value the `module` statement was defined in. If this is
  // a ruby module or class, then it is used, otherwise if the base is a ruby
  // object then that objects real ruby class is used (e.g. if the base is the
  // main object, then the top level `Object` class is used as the base).
  //
  // If a module of the given name is already defined in the base, then that
  // instance is just returned.
  //
  // If there is a class of the given name in the base, then an error is
  // generated instead (cannot have a class and module of same name in same base).
  //
  // Otherwise, a new module is created in the base with the given name, and that
  // new instance is returned back (to be referenced at runtime).
  //
  // @param  base [Module, Class] class or module this definition is inside
  // @param  id [String] the name of the new (or existing) module
  // @return [Module]
  //
  Opal.module = function(base, id) {
    var module;

    if (!base.$$is_class && !base.$$is_module) {
      base = base.$$class;
    }

    if ($hasOwn.call(base.$$scope, id)) {
      module = base.$$scope[id];

      if (!module.$$is_module && module !== _Object) {
        throw Opal.TypeError.$new(id + " is not a module");
      }
    }
    else {
      module = boot_module_object();

      // name module using base (e.g. Foo or Foo::Baz)
      module.$$name = id;

      // mark the object as a module
      module.$$is_module = true;

      // initialize dependency tracking
      module.$$dep = [];

      Opal.create_scope(base.$$scope, module, id);

      // Name new module directly onto current scope (Opal.Foo.Baz = module)
      base[id] = base.$$scope[id] = module;
    }

    return module;
  };

  // Internal function to create a new module instance. This simply sets up
  // the prototype hierarchy and method tables.
  //
  function boot_module_object() {
    var mtor = function() {};
    mtor.prototype = Module_alloc.prototype;

    function module_constructor() {}
    module_constructor.prototype = new mtor();

    var module = new module_constructor();
    var module_prototype = {};

    setup_module_or_class_object(module, module_constructor, Module, module_prototype);

    return module;
  }

  // Make `boot_module_object` available to the JS-API
  Opal.boot_module_object = boot_module_object;

  // Return the singleton class for the passed object.
  //
  // If the given object alredy has a singleton class, then it will be stored on
  // the object as the `$$meta` property. If this exists, then it is simply
  // returned back.
  //
  // Otherwise, a new singleton object for the class or object is created, set on
  // the object at `$$meta` for future use, and then returned.
  //
  // @param [RubyObject] object the ruby object
  // @return [RubyClass] the singleton class for object
  //
  Opal.get_singleton_class = function(object) {
    if (object.$$meta) {
      return object.$$meta;
    }

    if (object.$$is_class || object.$$is_module) {
      return build_class_singleton_class(object);
    }

    return build_object_singleton_class(object);
  };

  // Build the singleton class for an existing class.
  //
  // NOTE: Actually in MRI a class' singleton class inherits from its
  // superclass' singleton class which in turn inherits from Class.
  //
  // @param [RubyClass] klass
  // @return [RubyClass]
  //
  function build_class_singleton_class(klass) {
    var meta = new Opal.Class.$$alloc();

    meta.$$class = Opal.Class;
    meta.$$proto = klass.constructor.prototype;

    meta.$$is_singleton = true;
    meta.$$singleton_of = klass;
    meta.$$inc          = [];
    meta.$$scope        = klass.$$scope;

    return klass.$$meta = meta;
  }

  // Build the singleton class for a Ruby (non class) Object.
  //
  // @param [RubyObject] object
  // @return [RubyClass]
  //
  function build_object_singleton_class(object) {
    var orig_class = object.$$class,
        class_id   = "#<Class:#<" + orig_class.$$name + ":" + orig_class.$$id + ">>";

    var Singleton = function() {};
    var meta = Opal.boot_class(orig_class, Singleton);
    meta.$$name   = class_id;

    meta.$$proto  = object;
    meta.$$class  = orig_class.$$class;
    meta.$$scope  = orig_class.$$scope;
    meta.$$parent = orig_class;
    meta.$$is_singleton = true;
    meta.$$singleton_of = object;

    return object.$$meta = meta;
  }

  // Bridges a single method.
  function bridge_method(target, from, name, body) {
    var ancestors, i, ancestor, length;

    ancestors = target.$$bridge.$ancestors();

    // order important here, we have to check for method presence in
    // ancestors from the bridged class to the last ancestor
    for (i = 0, length = ancestors.length; i < length; i++) {
      ancestor = ancestors[i];

      if ($hasOwn.call(ancestor.$$proto, name) &&
          ancestor.$$proto[name] &&
          !ancestor.$$proto[name].$$donated &&
          !ancestor.$$proto[name].$$stub &&
          ancestor !== from) {
        break;
      }

      if (ancestor === from) {
        target.prototype[name] = body
        break;
      }
    }

  }

  // Bridges from *donator* to a *target*.
  function _bridge(target, donator) {
    var id, methods, method, i, bridged;

    if (typeof(target) === "function") {
      id      = donator.$__id__();
      methods = donator.$instance_methods();

      for (i = methods.length - 1; i >= 0; i--) {
        method = '$' + methods[i];

        bridge_method(target, donator, method, donator.$$proto[method]);
      }

      if (!bridges[id]) {
        bridges[id] = [];
      }

      bridges[id].push(target);
    }
    else {
      bridged = bridges[target.$__id__()];

      if (bridged) {
        for (i = bridged.length - 1; i >= 0; i--) {
          _bridge(bridged[i], donator);
        }

        bridges[donator.$__id__()] = bridged.slice();
      }
    }
  }

  // The actual inclusion of a module into a class.
  //
  // ## Class `$$parent` and `iclass`
  //
  // To handle `super` calls, every class has a `$$parent`. This parent is
  // used to resolve the next class for a super call. A normal class would
  // have this point to its superclass. However, if a class includes a module
  // then this would need to take into account the module. The module would
  // also have to then point its `$$parent` to the actual superclass. We
  // cannot modify modules like this, because it might be included in more
  // then one class. To fix this, we actually insert an `iclass` as the class'
  // `$$parent` which can then point to the superclass. The `iclass` acts as
  // a proxy to the actual module, so the `super` chain can then search it for
  // the required method.
  //
  // @param [RubyModule] module the module to include
  // @param [RubyClass] klass the target class to include module into
  // @return [null]
  //
  Opal.append_features = function(module, klass) {
    var iclass, donator, prototype, methods, id, i;

    // check if this module is already included in the class
    for (i = klass.$$inc.length - 1; i >= 0; i--) {
      if (klass.$$inc[i] === module) {
        return;
      }
    }

    klass.$$inc.push(module);
    module.$$dep.push(klass);
    _bridge(klass, module);

    // iclass
    iclass = {
      $$name:   module.$$name,
      $$proto:  module.$$proto,
      $$parent: klass.$$parent,
      $$module: module,
      $$iclass: true
    };

    klass.$$parent = iclass;

    donator   = module.$$proto;
    prototype = klass.$$proto;
    methods   = module.$instance_methods();

    for (i = methods.length - 1; i >= 0; i--) {
      id = '$' + methods[i];

      // if the target class already has a method of the same name defined
      // and that method was NOT donated, then it must be a method defined
      // by the class so we do not want to override it
      if ( prototype.hasOwnProperty(id) &&
          !prototype[id].$$donated &&
          !prototype[id].$$stub) {
        continue;
      }

      prototype[id] = donator[id];
      prototype[id].$$donated = module;
    }

    donate_constants(module, klass);
  };

  // Boot a base class (makes instances).
  function boot_class_alloc(id, constructor, superklass) {
    if (superklass) {
      var alloc_proxy = function() {};
      alloc_proxy.prototype  = superklass.$$proto || superklass.prototype;
      constructor.prototype = new alloc_proxy();
    }

    if (id) {
      constructor.displayName = id+'_alloc';
    }

    constructor.prototype.constructor = constructor;

    return constructor;
  }

  // Builds the class object for core classes:
  // - make the class object have a singleton class
  // - make the singleton class inherit from its parent singleton class
  //
  // @param id         [String]      the name of the class
  // @param alloc      [Function]    the constructor for the core class instances
  // @param superclass [Class alloc] the constructor of the superclass
  //
  function boot_core_class_object(id, alloc, superclass) {
    var superclass_constructor = function() {};
        superclass_constructor.prototype = superclass.prototype;

    var singleton_class = function() {};
        singleton_class.prototype = new superclass_constructor();

    singleton_class.displayName = "#<Class:"+id+">";

    // the singleton_class acts as the class object constructor
    var klass = new singleton_class();

    setup_module_or_class_object(klass, singleton_class, superclass, alloc.prototype);

    klass.$$alloc     = alloc;
    klass.$$name      = id;
    klass.displayName = id;

    // Give all instances a ref to their class
    alloc.prototype.$$class = klass;

    Opal[id] = klass;
    Opal.constants.push(id);

    return klass;
  }

  // For performance, some core Ruby classes are toll-free bridged to their
  // native JavaScript counterparts (e.g. a Ruby Array is a JavaScript Array).
  //
  // This method is used to setup a native constructor (e.g. Array), to have
  // its prototype act like a normal Ruby class. Firstly, a new Ruby class is
  // created using the native constructor so that its prototype is set as the
  // target for th new class. Note: all bridged classes are set to inherit
  // from Object.
  //
  // Example:
  //
  //    Opal.bridge(self, Function);
  //
  // @param [Class] klass the Ruby class to bridge
  // @param [Function] constructor native JavaScript constructor to use
  // @return [Class] returns the passed Ruby class
  //
  Opal.bridge = function(klass, constructor) {
    if (constructor.$$bridge) {
      throw Opal.ArgumentError.$new("already bridged");
    }

    Opal.stub_subscribers.push(constructor.prototype);

    constructor.prototype.$$class = klass;
    constructor.$$bridge          = klass;

    var ancestors = klass.$ancestors();

    // order important here, we have to bridge from the last ancestor to the
    // bridged class
    for (var i = ancestors.length - 1; i >= 0; i--) {
      _bridge(constructor, ancestors[i]);
    }

    for (var name in BasicObject_alloc.prototype) {
      var method = BasicObject_alloc.prototype[method];

      if (method && method.$$stub && !(name in constructor.prototype)) {
        constructor.prototype[name] = method;
      }
    }

    return klass;
  }


  // Constant assignment, see also `Opal.cdecl`
  //
  // @param base_module [Module, Class] the constant namespace
  // @param name        [String] the name of the constant
  // @param value       [Object] the value of the constant
  //
  // @example Assigning a namespaced constant
  //   self::FOO = 'bar'
  //
  // @example Assigning with Module#const_set
  //   Foo.const_set :BAR, 123
  //
  Opal.casgn = function(base_module, name, value) {
    function update(klass, name) {
      klass.$$name = name;

      for (name in klass.$$scope) {
        var value = klass.$$scope[name];

        if (value.$$name === nil && (value.$$is_class || value.$$is_module)) {
          update(value, name)
        }
      }
    }

    var scope = base_module.$$scope;

    if (value.$$is_class || value.$$is_module) {
      // Only checking _Object prevents setting a const on an anonymous class
      // that has a superclass that's not Object
      if (value.$$is_class || value.$$base_module === _Object) {
        value.$$base_module = base_module;
      }

      if (value.$$name === nil && value.$$base_module.$$name !== nil) {
        update(value, name);
      }
    }

    scope.constants.push(name);
    return scope[name] = value;
  };

  // constant decl
  Opal.cdecl = function(base_scope, name, value) {
    if ((value.$$is_class || value.$$is_module) && value.$$orig_scope == null) {
      value.$$name = name;
      value.$$orig_scope = base_scope;
      base_scope.constructor[name] = value;
    }

    base_scope.constants.push(name);
    return base_scope[name] = value;
  };

  // When a source module is included into the target module, we must also copy
  // its constants to the target.
  //
  function donate_constants(source_mod, target_mod) {
    var source_constants = source_mod.$$scope.constants,
        target_scope     = target_mod.$$scope,
        target_constants = target_scope.constants;

    for (var i = 0, length = source_constants.length; i < length; i++) {
      target_constants.push(source_constants[i]);
      target_scope[source_constants[i]] = source_mod.$$scope[source_constants[i]];
    }
  }

  // Donate methods for a module.
  function donate(module, jsid) {
    var included_in = module.$$dep,
        body = module.$$proto[jsid],
        i, length, includee, dest, current,
        klass_includees, j, jj, current_owner_index, module_index;

    if (!included_in) {
      return;
    }

    for (i = 0, length = included_in.length; i < length; i++) {
      includee = included_in[i];
      dest = includee.$$proto;
      current = dest[jsid];

      if (dest.hasOwnProperty(jsid) && !current.$$donated && !current.$$stub) {
        // target class has already defined the same method name - do nothing
      }
      else if (dest.hasOwnProperty(jsid) && !current.$$stub) {
        // target class includes another module that has defined this method
        klass_includees = includee.$$inc;

        for (j = 0, jj = klass_includees.length; j < jj; j++) {
          if (klass_includees[j] === current.$$donated) {
            current_owner_index = j;
          }
          if (klass_includees[j] === module) {
            module_index = j;
          }
        }

        // only redefine method on class if the module was included AFTER
        // the module which defined the current method body. Also make sure
        // a module can overwrite a method it defined before
        if (current_owner_index <= module_index) {
          dest[jsid] = body;
          dest[jsid].$$donated = module;
        }
      }
      else {
        // neither a class, or module included by class, has defined method
        dest[jsid] = body;
        dest[jsid].$$donated = module;
      }

      if (includee.$$dep) {
        donate(includee, jsid);
      }
    }
  }

  // Methods stubs are used to facilitate method_missing in opal. A stub is a
  // placeholder function which just calls `method_missing` on the receiver.
  // If no method with the given name is actually defined on an object, then it
  // is obvious to say that the stub will be called instead, and then in turn
  // method_missing will be called.
  //
  // When a file in ruby gets compiled to javascript, it includes a call to
  // this function which adds stubs for every method name in the compiled file.
  // It should then be safe to assume that method_missing will work for any
  // method call detected.
  //
  // Method stubs are added to the BasicObject prototype, which every other
  // ruby object inherits, so all objects should handle method missing. A stub
  // is only added if the given property name (method name) is not already
  // defined.
  //
  // Note: all ruby methods have a `$` prefix in javascript, so all stubs will
  // have this prefix as well (to make this method more performant).
  //
  //    Opal.add_stubs(["$foo", "$bar", "$baz="]);
  //
  // All stub functions will have a private `$$stub` property set to true so
  // that other internal methods can detect if a method is just a stub or not.
  // `Kernel#respond_to?` uses this property to detect a methods presence.
  //
  // @param [Array] stubs an array of method stubs to add
  //
  Opal.add_stubs = function(stubs) {
    var subscriber, subscribers = Opal.stub_subscribers,
        i, ilength = stubs.length,
        j, jlength = subscribers.length,
        method_name, stub;

    for (i = 0; i < ilength; i++) {
      method_name = stubs[i];
      stub = stub_for(method_name);

      for (j = 0; j < jlength; j++) {
        subscriber = subscribers[j];

        if (!(method_name in subscriber)) {
          subscriber[method_name] = stub;
        }
      }
    }
  };

  // Keep a list of prototypes that want method_missing stubs to be added.
  //
  // @default [Prototype List] BasicObject_alloc.prototype
  //
  Opal.stub_subscribers = [BasicObject_alloc.prototype];

  // Add a method_missing stub function to the given prototype for the
  // given name.
  //
  // @param [Prototype] prototype the target prototype
  // @param [String] stub stub name to add (e.g. "$foo")
  //
  Opal.add_stub_for = function(prototype, stub) {
    var method_missing_stub = stub_for(stub);
    prototype[stub] = method_missing_stub;
  }

  // Generate the method_missing stub for a given method name.
  //
  // @param [String] method_name The js-name of the method to stub (e.g. "$foo")
  //
  function stub_for(method_name) {
    function method_missing_stub() {
      // Copy any given block onto the method_missing dispatcher
      this.$method_missing.$$p = method_missing_stub.$$p;

      // Set block property to null ready for the next call (stop false-positives)
      method_missing_stub.$$p = null;

      // call method missing with correct args (remove '$' prefix on method name)
      return this.$method_missing.apply(this, [method_name.slice(1)].concat($slice.call(arguments)));
    }

    method_missing_stub.$$stub = true;

    return method_missing_stub;
  }

  // Arity count error dispatcher
  Opal.ac = function(actual, expected, object, meth) {
    var inspect = '';
    if (object.$$is_class || object.$$is_module) {
      inspect += object.$$name + '.';
    }
    else {
      inspect += object.$$class.$$name + '#';
    }
    inspect += meth;

    throw Opal.ArgumentError.$new('[' + inspect + '] wrong number of arguments(' + actual + ' for ' + expected + ')');
  };

  // The Array of ancestors for a given module/class
  Opal.ancestors = function(module_or_class) {
    var parent = module_or_class,
        result = [];

    while (parent) {
      result.push(parent);
      for (var i=0; i < parent.$$inc.length; i++) {
        result = result.concat(Opal.ancestors(parent.$$inc[i]));
      }

      parent = parent.$$is_class ? parent.$$super : null;
    }

    return result;
  }

  // Super dispatcher
  Opal.find_super_dispatcher = function(obj, jsid, current_func, iter, defs) {
    var dispatcher;

    if (defs) {
      if (obj.$$is_class || obj.$$is_module) {
        dispatcher = defs.$$super;
      }
      else {
        dispatcher = obj.$$class.$$proto;
      }
    }
    else {
      if (obj.$$is_class || obj.$$is_module) {
        dispatcher = obj.$$super;
      }
      else {
        dispatcher = find_obj_super_dispatcher(obj, jsid, current_func);
      }
    }

    dispatcher = dispatcher['$' + jsid];
    dispatcher.$$p = iter;

    return dispatcher;
  };

  // Iter dispatcher for super in a block
  Opal.find_iter_super_dispatcher = function(obj, jsid, current_func, iter, defs) {
    if (current_func.$$def) {
      return Opal.find_super_dispatcher(obj, current_func.$$jsid, current_func, iter, defs);
    }
    else {
      return Opal.find_super_dispatcher(obj, jsid, current_func, iter, defs);
    }
  };

  function find_obj_super_dispatcher(obj, jsid, current_func) {
    var klass = obj.$$meta || obj.$$class;
    jsid = '$' + jsid;

    while (klass) {
      if (klass.$$proto[jsid] === current_func) {
        // ok
        break;
      }

      klass = klass.$$parent;
    }

    // if we arent in a class, we couldnt find current?
    if (!klass) {
      throw new Error("could not find current class for super()");
    }

    klass = klass.$$parent;

    // else, let's find the next one
    while (klass) {
      var working = klass.$$proto[jsid];

      if (working && working !== current_func) {
        // ok
        break;
      }

      klass = klass.$$parent;
    }

    return klass.$$proto;
  }

  // Used to return as an expression. Sometimes, we can't simply return from
  // a javascript function as if we were a method, as the return is used as
  // an expression, or even inside a block which must "return" to the outer
  // method. This helper simply throws an error which is then caught by the
  // method. This approach is expensive, so it is only used when absolutely
  // needed.
  //
  Opal.ret = function(val) {
    Opal.returner.$v = val;
    throw Opal.returner;
  };

  // handles yield calls for 1 yielded arg
  Opal.yield1 = function(block, arg) {
    if (typeof(block) !== "function") {
      throw Opal.LocalJumpError.$new("no block given");
    }

    if (block.length > 1 && arg.$$is_array) {
      return block.apply(null, arg);
    }
    else {
      return block(arg);
    }
  };

  // handles yield for > 1 yielded arg
  Opal.yieldX = function(block, args) {
    if (typeof(block) !== "function") {
      throw Opal.LocalJumpError.$new("no block given");
    }

    if (block.length > 1 && args.length === 1) {
      if (args[0].$$is_array) {
        return block.apply(null, args[0]);
      }
    }

    if (!args.$$is_array) {
      args = $slice.call(args);
    }

    return block.apply(null, args);
  };

  // Finds the corresponding exception match in candidates.  Each candidate can
  // be a value, or an array of values.  Returns null if not found.
  Opal.rescue = function(exception, candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];

      if (candidate.$$is_array) {
        var result = Opal.rescue(exception, candidate);

        if (result) {
          return result;
        }
      }
      else if (candidate['$==='](exception)) {
        return candidate;
      }
    }

    return null;
  };

  Opal.is_a = function(object, klass) {
    if (object.$$meta === klass) {
      return true;
    }

    var search = object.$$class;

    while (search) {
      if (search === klass) {
        return true;
      }

      for (var i = 0, length = search.$$inc.length; i < length; i++) {
        if (search.$$inc[i] === klass) {
          return true;
        }
      }

      search = search.$$super;
    }

    return false;
  };

  // Helpers for implementing multiple assignment
  // Our code for extracting the values and assigning them only works if the
  // return value is a JS array
  // So if we get an Array subclass, extract the wrapped JS array from it

  Opal.to_ary = function(value) {
    // Used for: a, b = something (no splat)
    if (value.$$is_array) {
      return (value.constructor === Array) ? value : value.literal;
    }
    else if (value['$respond_to?']('to_ary', true)) {
      var ary = value.$to_ary();
      if (ary === nil) {
        return [value];
      }
      else if (ary.$$is_array) {
        return (ary.constructor === Array) ? ary : ary.literal;
      }
      else {
        throw Opal.TypeError.$new("Can't convert " + value.$$class +
          " to Array (" + value.$$class + "#to_ary gives " + ary.$$class + ")");
      }
    }
    else {
      return [value];
    }
  };

  Opal.to_a = function(value) {
    // Used for: a, b = *something (with splat)
    if (value.$$is_array) {
      // A splatted array must be copied
      return (value.constructor === Array) ? value.slice() : value.literal.slice();
    }
    else if (value['$respond_to?']('to_a', true)) {
      var ary = value.$to_a();
      if (ary === nil) {
        return [value];
      }
      else if (ary.$$is_array) {
        return (ary.constructor === Array) ? ary : ary.literal;
      }
      else {
        throw Opal.TypeError.$new("Can't convert " + value.$$class +
          " to Array (" + value.$$class + "#to_a gives " + ary.$$class + ")");
      }
    }
    else {
      return [value];
    }
  };

  // Used to get a list of rest keyword arguments. Method takes the given
  // keyword args, i.e. the hash literal passed to the method containing all
  // keyword arguemnts passed to method, as well as the used args which are
  // the names of required and optional arguments defined. This method then
  // just returns all key/value pairs which have not been used, in a new
  // hash literal.
  //
  // @param given_args [Hash] all kwargs given to method
  // @param used_args [Object<String: true>] all keys used as named kwargs
  // @return [Hash]
  //
  Opal.kwrestargs = function(given_args, used_args) {
    var keys      = [],
        map       = {},
        key       = null,
        given_map = given_args.$$smap;

    for (key in given_map) {
      if (!used_args[key]) {
        keys.push(key);
        map[key] = given_map[key];
      }
    }

    return Opal.hash2(keys, map);
  };

  // Call a ruby method on a ruby object with some arguments:
  //
  //   var my_array = [1, 2, 3, 4]
  //   Opal.send(my_array, 'length')     # => 4
  //   Opal.send(my_array, 'reverse!')   # => [4, 3, 2, 1]
  //
  // A missing method will be forwarded to the object via
  // method_missing.
  //
  // The result of either call with be returned.
  //
  // @param [Object] recv the ruby object
  // @param [String] mid ruby method to call
  //
  Opal.send = function(recv, mid) {
    var args = $slice.call(arguments, 2),
        func = recv['$' + mid];

    if (func) {
      return func.apply(recv, args);
    }

    return recv.$method_missing.apply(recv, [mid].concat(args));
  };

  Opal.block_send = function(recv, mid, block) {
    var args = $slice.call(arguments, 3),
        func = recv['$' + mid];

    if (func) {
      func.$$p = block;
      return func.apply(recv, args);
    }

    return recv.$method_missing.apply(recv, [mid].concat(args));
  };

  // Used to define methods on an object. This is a helper method, used by the
  // compiled source to define methods on special case objects when the compiler
  // can not determine the destination object, or the object is a Module
  // instance. This can get called by `Module#define_method` as well.
  //
  // ## Modules
  //
  // Any method defined on a module will come through this runtime helper.
  // The method is added to the module body, and the owner of the method is
  // set to be the module itself. This is used later when choosing which
  // method should show on a class if more than 1 included modules define
  // the same method. Finally, if the module is in `module_function` mode,
  // then the method is also defined onto the module itself.
  //
  // ## Classes
  //
  // This helper will only be called for classes when a method is being
  // defined indirectly; either through `Module#define_method`, or by a
  // literal `def` method inside an `instance_eval` or `class_eval` body. In
  // either case, the method is simply added to the class' prototype. A special
  // exception exists for `BasicObject` and `Object`. These two classes are
  // special because they are used in toll-free bridged classes. In each of
  // these two cases, extra work is required to define the methods on toll-free
  // bridged class' prototypes as well.
  //
  // ## Objects
  //
  // If a simple ruby object is the object, then the method is simply just
  // defined on the object as a singleton method. This would be the case when
  // a method is defined inside an `instance_eval` block.
  //
  // @param [RubyObject or Class] obj the actual obj to define method for
  // @param [String] jsid the javascript friendly method name (e.g. '$foo')
  // @param [Function] body the literal javascript function used as method
  // @return [null]
  //
  Opal.defn = function(obj, jsid, body) {
    obj.$$proto[jsid] = body;

    if (obj.$$is_module) {
      donate(obj, jsid);

      if (obj.$$module_function) {
        Opal.defs(obj, jsid, body);
      }
    }

    if (obj.$__id__ && !obj.$__id__.$$stub) {
      var bridged = bridges[obj.$__id__()];

      if (bridged) {
        for (var i = bridged.length - 1; i >= 0; i--) {
          bridge_method(bridged[i], obj, jsid, body);
        }
      }
    }

    if (obj.$method_added && !obj.$method_added.$$stub) {
      obj.$method_added(jsid.substr(1));
    }

    var singleton_of = obj.$$singleton_of;
    if (singleton_of && singleton_of.$singleton_method_added && !singleton_of.$singleton_method_added.$$stub) {
      singleton_of.$singleton_method_added(jsid.substr(1));
    }

    return nil;
  };


  // Define a singleton method on the given object.
  Opal.defs = function(obj, jsid, body) {
    Opal.defn(Opal.get_singleton_class(obj), jsid, body)
  };

  Opal.def = function(obj, jsid, body) {
    // if instance_eval is invoked on a module/class, it sets inst_eval_mod
    if (!obj.$$eval && (obj.$$is_class || obj.$$is_module)) {
      Opal.defn(obj, jsid, body);
    }
    else {
      Opal.defs(obj, jsid, body);
    }
  };

  // Called from #remove_method.
  Opal.rdef = function(obj, jsid) {
    // TODO: remove from bridges as well

    if (!$hasOwn.call(obj.$$proto, jsid)) {
      throw Opal.NameError.$new("method '" + jsid.substr(1) + "' not defined in " + obj.$name());
    }

    delete obj.$$proto[jsid];

    if (obj.$$is_singleton) {
      if (obj.$$proto.$singleton_method_removed && !obj.$$proto.$singleton_method_removed.$$stub) {
        obj.$$proto.$singleton_method_removed(jsid.substr(1));
      }
    }
    else {
      if (obj.$method_removed && !obj.$method_removed.$$stub) {
        obj.$method_removed(jsid.substr(1));
      }
    }
  };

  // Called from #undef_method.
  Opal.udef = function(obj, jsid) {
    if (!obj.$$proto[jsid] || obj.$$proto[jsid].$$stub) {
      throw Opal.NameError.$new("method '" + jsid.substr(1) + "' not defined in " + obj.$name());
    }

    Opal.add_stub_for(obj.$$proto, jsid);

    if (obj.$$is_singleton) {
      if (obj.$$proto.$singleton_method_undefined && !obj.$$proto.$singleton_method_undefined.$$stub) {
        obj.$$proto.$singleton_method_undefined(jsid.substr(1));
      }
    }
    else {
      if (obj.$method_undefined && !obj.$method_undefined.$$stub) {
        obj.$method_undefined(jsid.substr(1));
      }
    }
  };

  Opal.alias = function(obj, name, old) {
    var id     = '$' + name,
        old_id = '$' + old,
        body   = obj.$$proto['$' + old];

    // instance_eval is being run on a class/module, so that need to alias class methods
    if (obj.$$eval) {
      return Opal.alias(Opal.get_singleton_class(obj), name, old);
    }

    if (typeof(body) !== "function" || body.$$stub) {
      var ancestor = obj.$$super;

      while (typeof(body) !== "function" && ancestor) {
        body     = ancestor[old_id];
        ancestor = ancestor.$$super;
      }

      if (typeof(body) !== "function" || body.$$stub) {
        throw Opal.NameError.$new("undefined method `" + old + "' for class `" + obj.$name() + "'")
      }
    }

    Opal.defn(obj, id, body);

    return obj;
  };

  Opal.alias_native = function(obj, name, native_name) {
    var id   = '$' + name,
        body = obj.$$proto[native_name];

    if (typeof(body) !== "function" || body.$$stub) {
      throw Opal.NameError.$new("undefined native method `" + native_name + "' for class `" + obj.$name() + "'")
    }

    Opal.defn(obj, id, body);

    return obj;
  };

  Opal.hash_init = function(hash) {
    hash.$$map  = {};
    hash.$$smap = {};
    hash.$$keys = [];
  };

  Opal.hash_clone = function(from_hash, to_hash) {
    to_hash.none = from_hash.none;
    to_hash.proc = from_hash.proc;

    for (var i = 0, keys = from_hash.$$keys, length = keys.length, key, value; i < length; i++) {
      key = from_hash.$$keys[i];

      if (key.$$is_string) {
        value = from_hash.$$smap[key];
      } else {
        value = key.value;
        key = key.key;
      }

      Opal.hash_put(to_hash, key, value);
    }
  };

  Opal.hash_put = function(hash, key, value) {
    if (key.$$is_string) {
      if (!hash.$$smap.hasOwnProperty(key)) {
        hash.$$keys.push(key);
      }
      hash.$$smap[key] = value;
      return;
    }

    var key_hash = key.$hash(), bucket, last_bucket;

    if (!hash.$$map.hasOwnProperty(key_hash)) {
      bucket = {key: key, key_hash: key_hash, value: value};
      hash.$$keys.push(bucket);
      hash.$$map[key_hash] = bucket;
      return;
    }

    bucket = hash.$$map[key_hash];

    while (bucket) {
      if (key === bucket.key || key['$eql?'](bucket.key)) {
        last_bucket = undefined;
        bucket.value = value;
        break;
      }
      last_bucket = bucket;
      bucket = bucket.next;
    }

    if (last_bucket) {
      bucket = {key: key, key_hash: key_hash, value: value};
      hash.$$keys.push(bucket);
      last_bucket.next = bucket;
    }
  };

  Opal.hash_get = function(hash, key) {
    if (key.$$is_string) {
      if (hash.$$smap.hasOwnProperty(key)) {
        return hash.$$smap[key];
      }
      return;
    }

    var key_hash = key.$hash(), bucket;

    if (hash.$$map.hasOwnProperty(key_hash)) {
      bucket = hash.$$map[key_hash];

      while (bucket) {
        if (key === bucket.key || key['$eql?'](bucket.key)) {
          return bucket.value;
        }
        bucket = bucket.next;
      }
    }
  };

  Opal.hash_delete = function(hash, key) {
    var i, keys = hash.$$keys, length = keys.length, value;

    if (key.$$is_string) {
      if (!hash.$$smap.hasOwnProperty(key)) {
        return;
      }

      for (i = 0; i < length; i++) {
        if (keys[i] === key) {
          keys.splice(i, 1);
          break;
        }
      }

      value = hash.$$smap[key];
      delete hash.$$smap[key];
      return value;
    }

    var key_hash = key.$hash();

    if (!hash.$$map.hasOwnProperty(key_hash)) {
      return;
    }

    var bucket = hash.$$map[key_hash], last_bucket;

    while (bucket) {
      if (key === bucket.key || key['$eql?'](bucket.key)) {
        value = bucket.value;

        for (i = 0; i < length; i++) {
          if (keys[i] === bucket) {
            keys.splice(i, 1);
            break;
          }
        }

        if (last_bucket && bucket.next) {
          last_bucket.next = bucket.next;
        }
        else if (last_bucket) {
          delete last_bucket.next;
        }
        else if (bucket.next) {
          hash.$$map[key_hash] = bucket.next;
        }
        else {
          delete hash.$$map[key_hash];
        }

        return value;
      }
      last_bucket = bucket;
      bucket = bucket.next;
    }
  };

  Opal.hash_rehash = function(hash) {
    for (var i = 0, length = hash.$$keys.length, key_hash, bucket, last_bucket; i < length; i++) {

      if (hash.$$keys[i].$$is_string) {
        continue;
      }

      key_hash = hash.$$keys[i].key.$hash();

      if (key_hash === hash.$$keys[i].key_hash) {
        continue;
      }

      bucket = hash.$$map[hash.$$keys[i].key_hash];
      last_bucket = undefined;

      while (bucket) {
        if (bucket === hash.$$keys[i]) {
          if (last_bucket && bucket.next) {
            last_bucket.next = bucket.next;
          }
          else if (last_bucket) {
            delete last_bucket.next;
          }
          else if (bucket.next) {
            hash.$$map[hash.$$keys[i].key_hash] = bucket.next;
          }
          else {
            delete hash.$$map[hash.$$keys[i].key_hash];
          }
          break;
        }
        last_bucket = bucket;
        bucket = bucket.next;
      }

      hash.$$keys[i].key_hash = key_hash;

      if (!hash.$$map.hasOwnProperty(key_hash)) {
        hash.$$map[key_hash] = hash.$$keys[i];
        continue;
      }

      bucket = hash.$$map[key_hash];
      last_bucket = undefined;

      while (bucket) {
        if (bucket === hash.$$keys[i]) {
          last_bucket = undefined;
          break;
        }
        last_bucket = bucket;
        bucket = bucket.next;
      }

      if (last_bucket) {
        last_bucket.next = hash.$$keys[i];
      }
    }
  };

  Opal.hash = function() {
    var arguments_length = arguments.length, args, hash, i, length, key, value;

    if (arguments_length === 1 && arguments[0].$$is_hash) {
      return arguments[0];
    }

    hash = new Opal.Hash.$$alloc();
    Opal.hash_init(hash);

    if (arguments_length === 1 && arguments[0].$$is_array) {
      args = arguments[0];
      length = args.length;

      for (i = 0; i < length; i++) {
        if (args[i].length !== 2) {
          throw Opal.ArgumentError.$new("value not of length 2: " + args[i].$inspect());
        }

        key = args[i][0];
        value = args[i][1];

        Opal.hash_put(hash, key, value);
      }

      return hash;
    }

    if (arguments_length === 1) {
      args = arguments[0];
      for (key in args) {
        if (args.hasOwnProperty(key)) {
          value = args[key];

          Opal.hash_put(hash, key, value);
        }
      }

      return hash;
    }

    if (arguments_length % 2 !== 0) {
      throw Opal.ArgumentError.$new("odd number of arguments for Hash");
    }

    for (i = 0; i < arguments_length; i += 2) {
      key = arguments[i];
      value = arguments[i + 1];

      Opal.hash_put(hash, key, value);
    }

    return hash;
  };

  // hash2 is a faster creator for hashes that just use symbols and
  // strings as keys. The map and keys array can be constructed at
  // compile time, so they are just added here by the constructor
  // function
  //
  Opal.hash2 = function(keys, smap) {
    var hash = new Opal.Hash.$$alloc();

    hash.$$map  = {};
    hash.$$keys = keys;
    hash.$$smap = smap;

    return hash;
  };

  // Create a new range instance with first and last values, and whether the
  // range excludes the last value.
  //
  Opal.range = function(first, last, exc) {
    var range         = new Opal.Range.$$alloc();
        range.begin   = first;
        range.end     = last;
        range.exclude = exc;

    return range;
  };

  Opal.ivar = function(name) {
    if (
        // properties
        name === "constructor" ||
        name === "displayName" ||
        name === "__count__" ||
        name === "__noSuchMethod__" ||
        name === "__parent__" ||
        name === "__proto__" ||

        // methods
        name === "hasOwnProperty" ||
        name === "valueOf"
       )
    {
      return name + "$";
    }

    return name;
  };

  // Require system
  // --------------

  Opal.modules         = {};
  Opal.loaded_features = ['corelib/runtime'];
  Opal.current_dir     = '.'
  Opal.require_table   = {'corelib/runtime': true};

  function normalize(path) {
    var parts, part, new_parts = [], SEPARATOR = '/';

    if (Opal.current_dir !== '.') {
      path = Opal.current_dir.replace(/\/*$/, '/') + path;
    }

    path = path.replace(/\.(rb|opal|js)$/, '');
    parts = path.split(SEPARATOR);

    for (var i = 0, ii = parts.length; i < ii; i++) {
      part = parts[i];
      if (part === '') continue;
      (part === '..') ? new_parts.pop() : new_parts.push(part)
    }

    return new_parts.join(SEPARATOR);
  }

  Opal.loaded = function(paths) {
    var i, l, path;

    for (i = 0, l = paths.length; i < l; i++) {
      path = normalize(paths[i]);

      if (Opal.require_table[path]) {
        return;
      }

      Opal.loaded_features.push(path);
      Opal.require_table[path] = true;
    }
  }

  Opal.load = function(path) {
    path = normalize(path);

    Opal.loaded([path]);

    var module = Opal.modules[path];

    if (module) {
      module(Opal);
    }
    else {
      var severity = Opal.dynamic_require_severity || 'warning';
      var message  = 'cannot load such file -- ' + path;

      if (severity === "error") {
        Opal.LoadError ? Opal.LoadError.$new(message) : function(){throw message}();
      }
      else if (severity === "warning") {
        console.warn('WARNING: LoadError: ' + message);
      }
    }

    return true;
  }

  Opal.require = function(path) {
    path = normalize(path);

    if (Opal.require_table[path]) {
      return false;
    }

    return Opal.load(path);
  }

  // Initialization
  // --------------

  // Constructors for *instances* of core objects
  boot_class_alloc('BasicObject', BasicObject_alloc);
  boot_class_alloc('Object',      Object_alloc,       BasicObject_alloc);
  boot_class_alloc('Module',      Module_alloc,       Object_alloc);
  boot_class_alloc('Class',       Class_alloc,        Module_alloc);

  // Constructors for *classes* of core objects
  BasicObject = boot_core_class_object('BasicObject', BasicObject_alloc, Class_alloc);
  _Object     = boot_core_class_object('Object',      Object_alloc,      BasicObject.constructor);
  Module      = boot_core_class_object('Module',      Module_alloc,      _Object.constructor);
  Class       = boot_core_class_object('Class',       Class_alloc,       Module.constructor);

  // Fix booted classes to use their metaclass
  BasicObject.$$class = Class;
  _Object.$$class     = Class;
  Module.$$class      = Class;
  Class.$$class       = Class;

  // Fix superclasses of booted classes
  BasicObject.$$super = null;
  _Object.$$super     = BasicObject;
  Module.$$super      = _Object;
  Class.$$super       = Module;

  BasicObject.$$parent = null;
  _Object.$$parent     = BasicObject;
  Module.$$parent      = _Object;
  Class.$$parent       = Module;

  Opal.base                = _Object;
  BasicObject.$$scope      = _Object.$$scope = Opal;
  BasicObject.$$orig_scope = _Object.$$orig_scope = Opal;

  Module.$$scope      = _Object.$$scope;
  Module.$$orig_scope = _Object.$$orig_scope;
  Class.$$scope       = _Object.$$scope;
  Class.$$orig_scope  = _Object.$$orig_scope;

  _Object.$$proto.toString = function() {
    return this.$to_s();
  };

  _Object.$$proto.$require = Opal.require;

  Opal.top = new _Object.$$alloc();

  // Nil
  Opal.klass(_Object, _Object, 'NilClass', NilClass_alloc);
  nil = Opal.nil = new NilClass_alloc();
  nil.$$id = nil_id;
  nil.call = nil.apply = function() { throw Opal.LocalJumpError.$new('no block given'); };

  Opal.breaker  = new Error('unexpected break');
  Opal.returner = new Error('unexpected return');

  TypeError.$$super = Error;
}).call(this);

if (typeof(global) !== 'undefined') {
  global.Opal = this.Opal;
  Opal.global = global;
}

if (typeof(window) !== 'undefined') {
  window.Opal = this.Opal;
  Opal.global = window;
}
Opal.loaded(["corelib/runtime"]);
/* Generated by Opal 0.9.2 */
Opal.modules["corelib/helpers"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module;

  Opal.add_stubs(['$new', '$class', '$===', '$respond_to?', '$raise', '$type_error', '$__send__', '$coerce_to', '$nil?', '$<=>', '$inspect', '$coerce_to!']);
  return (function($base) {
    var $Opal, self = $Opal = $module($base, 'Opal');

    var def = self.$$proto, $scope = self.$$scope;

    Opal.defs(self, '$bridge', function(klass, constructor) {
      var self = this;

      return Opal.bridge(klass, constructor);
    });

    Opal.defs(self, '$type_error', function(object, type, method, coerced) {
      var $a, $b, self = this;

      if (method == null) {
        method = nil
      }
      if (coerced == null) {
        coerced = nil
      }
      if ((($a = (($b = method !== false && method !== nil) ? coerced : method)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return $scope.get('TypeError').$new("can't convert " + (object.$class()) + " into " + (type) + " (" + (object.$class()) + "#" + (method) + " gives " + (coerced.$class()))
        } else {
        return $scope.get('TypeError').$new("no implicit conversion of " + (object.$class()) + " into " + (type))
      }
    });

    Opal.defs(self, '$coerce_to', function(object, type, method) {
      var $a, self = this;

      if ((($a = type['$==='](object)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return object}
      if ((($a = object['$respond_to?'](method)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise(self.$type_error(object, type))
      }
      return object.$__send__(method);
    });

    Opal.defs(self, '$coerce_to!', function(object, type, method) {
      var $a, self = this, coerced = nil;

      coerced = self.$coerce_to(object, type, method);
      if ((($a = type['$==='](coerced)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise(self.$type_error(object, type, method, coerced))
      }
      return coerced;
    });

    Opal.defs(self, '$coerce_to?', function(object, type, method) {
      var $a, self = this, coerced = nil;

      if ((($a = object['$respond_to?'](method)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        return nil
      }
      coerced = self.$coerce_to(object, type, method);
      if ((($a = coerced['$nil?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        return nil}
      if ((($a = type['$==='](coerced)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise(self.$type_error(object, type, method, coerced))
      }
      return coerced;
    });

    Opal.defs(self, '$try_convert', function(object, type, method) {
      var $a, self = this;

      if ((($a = type['$==='](object)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return object}
      if ((($a = object['$respond_to?'](method)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return object.$__send__(method)
        } else {
        return nil
      }
    });

    Opal.defs(self, '$compare', function(a, b) {
      var $a, self = this, compare = nil;

      compare = a['$<=>'](b);
      if ((($a = compare === nil) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "comparison of " + (a.$class()) + " with " + (b.$class()) + " failed")}
      return compare;
    });

    Opal.defs(self, '$destructure', function(args) {
      var self = this;

      
      if (args.length == 1) {
        return args[0];
      }
      else if (args.$$is_array) {
        return args;
      }
      else {
        return $slice.call(args);
      }
    
    });

    Opal.defs(self, '$respond_to?', function(obj, method) {
      var self = this;

      
      if (obj == null || !obj.$$class) {
        return false;
      }
    
      return obj['$respond_to?'](method);
    });

    Opal.defs(self, '$inspect', function(obj) {
      var self = this;

      
      if (obj === undefined) {
        return "undefined";
      }
      else if (obj === null) {
        return "null";
      }
      else if (!obj.$$class) {
        return obj.toString();
      }
      else {
        return obj.$inspect();
      }
    
    });

    Opal.defs(self, '$instance_variable_name!', function(name) {
      var $a, self = this;

      name = $scope.get('Opal')['$coerce_to!'](name, $scope.get('String'), "to_str");
      if ((($a = /^@[a-zA-Z_][a-zA-Z0-9_]*?$/.test(name)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('NameError').$new("'" + (name) + "' is not allowed as an instance variable name", name))
      }
      return name;
    });
  })($scope.base)
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/module"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$===', '$raise', '$equal?', '$<', '$>', '$nil?', '$attr_reader', '$attr_writer', '$coerce_to!', '$new', '$=~', '$inject', '$const_get', '$split', '$const_missing', '$to_str', '$to_proc', '$lambda', '$bind', '$call', '$class', '$append_features', '$included', '$name', '$to_s', '$__id__']);
  return (function($base, $super) {
    function $Module(){}
    var self = $Module = $klass($base, $super, 'Module', $Module);

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_3, TMP_5, TMP_6;

    Opal.defs(self, '$new', TMP_1 = function() {
      var self = this, $iter = TMP_1.$$p, block = $iter || nil;

      TMP_1.$$p = null;
      
      var klass         = Opal.boot_module_object();
      klass.$$name      = nil;
      klass.$$class     = Opal.Module;
      klass.$$dep       = []
      klass.$$is_module = true;
      klass.$$proto     = {};

      // inherit scope from parent
      Opal.create_scope(Opal.Module.$$scope, klass);

      if (block !== nil) {
        var block_self = block.$$s;
        block.$$s = null;
        block.call(klass);
        block.$$s = block_self;
      }

      return klass;
    
    });

    Opal.defn(self, '$===', function(object) {
      var $a, self = this;

      if ((($a = object == null) !== nil && (!$a.$$is_boolean || $a == true))) {
        return false}
      return Opal.is_a(object, self);
    });

    Opal.defn(self, '$<', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Module')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('TypeError'), "compared with non class/module")
      }
      
      var working = self,
          ancestors,
          i, length;

      if (working === other) {
        return false;
      }

      for (i = 0, ancestors = Opal.ancestors(self), length = ancestors.length; i < length; i++) {
        if (ancestors[i] === other) {
          return true;
        }
      }

      for (i = 0, ancestors = Opal.ancestors(other), length = ancestors.length; i < length; i++) {
        if (ancestors[i] === self) {
          return false;
        }
      }

      return nil;
    
    });

    Opal.defn(self, '$<=', function(other) {
      var $a, self = this;

      return ((($a = self['$equal?'](other)) !== false && $a !== nil) ? $a : $rb_lt(self, other));
    });

    Opal.defn(self, '$>', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Module')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('TypeError'), "compared with non class/module")
      }
      return $rb_lt(other, self);
    });

    Opal.defn(self, '$>=', function(other) {
      var $a, self = this;

      return ((($a = self['$equal?'](other)) !== false && $a !== nil) ? $a : $rb_gt(self, other));
    });

    Opal.defn(self, '$<=>', function(other) {
      var $a, self = this, lt = nil;

      
      if (self === other) {
        return 0;
      }
    
      if ((($a = $scope.get('Module')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        return nil
      }
      lt = $rb_lt(self, other);
      if ((($a = lt['$nil?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        return nil}
      if (lt !== false && lt !== nil) {
        return -1
        } else {
        return 1
      }
    });

    Opal.defn(self, '$alias_method', function(newname, oldname) {
      var self = this;

      Opal.alias(self, newname, oldname);
      return self;
    });

    Opal.defn(self, '$alias_native', function(mid, jsid) {
      var self = this;

      if (jsid == null) {
        jsid = mid
      }
      Opal.alias_native(self, mid, jsid);
      return self;
    });

    Opal.defn(self, '$ancestors', function() {
      var self = this;

      return Opal.ancestors(self);
    });

    Opal.defn(self, '$append_features', function(klass) {
      var self = this;

      Opal.append_features(self, klass);
      return self;
    });

    Opal.defn(self, '$attr_accessor', function() {
      var $a, $b, self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var names = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        names[$splat_index] = arguments[$splat_index + 0];
      }
      ($a = self).$attr_reader.apply($a, Opal.to_a(names));
      return ($b = self).$attr_writer.apply($b, Opal.to_a(names));
    });

    Opal.alias(self, 'attr', 'attr_accessor');

    Opal.defn(self, '$attr_reader', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var names = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        names[$splat_index] = arguments[$splat_index + 0];
      }
      
      var proto = self.$$proto;

      for (var i = names.length - 1; i >= 0; i--) {
        var name = names[i],
            id   = '$' + name,
            ivar = Opal.ivar(name);

        // the closure here is needed because name will change at the next
        // cycle, I wish we could use let.
        var body = (function(ivar) {
          return function() {
            if (this[ivar] == null) {
              return nil;
            }
            else {
              return this[ivar];
            }
          };
        })(ivar);

        // initialize the instance variable as nil
        proto[ivar] = nil;

        if (self.$$is_singleton) {
          proto.constructor.prototype[id] = body;
        }
        else {
          Opal.defn(self, id, body);
        }
      }
    
      return nil;
    });

    Opal.defn(self, '$attr_writer', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var names = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        names[$splat_index] = arguments[$splat_index + 0];
      }
      
      var proto = self.$$proto;

      for (var i = names.length - 1; i >= 0; i--) {
        var name = names[i],
            id   = '$' + name + '=',
            ivar = Opal.ivar(name);

        // the closure here is needed because name will change at the next
        // cycle, I wish we could use let.
        var body = (function(ivar){
          return function(value) {
            return this[ivar] = value;
          }
        })(ivar);

        // initialize the instance variable as nil
        proto[ivar] = nil;

        if (self.$$is_singleton) {
          proto.constructor.prototype[id] = body;
        }
        else {
          Opal.defn(self, id, body);
        }
      }
    
      return nil;
    });

    Opal.defn(self, '$autoload', function(const$, path) {
      var self = this;

      
      var autoloaders;

      if (!(autoloaders = self.$$autoload)) {
        autoloaders = self.$$autoload = {};
      }

      autoloaders[const$] = path;
      return nil;

    });

    Opal.defn(self, '$class_variable_get', function(name) {
      var $a, self = this;

      name = $scope.get('Opal')['$coerce_to!'](name, $scope.get('String'), "to_str");
      if ((($a = name.length < 3 || name.slice(0,2) !== '@@') !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('NameError').$new("class vars should start with @@", name))}
      
      var value = Opal.cvars[name.slice(2)];
      (function() {if ((($a = value == null) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$raise($scope.get('NameError').$new("uninitialized class variable @@a in", name))
        } else {
        return nil
      } return nil; })()
      return value;
    
    });

    Opal.defn(self, '$class_variable_set', function(name, value) {
      var $a, self = this;

      name = $scope.get('Opal')['$coerce_to!'](name, $scope.get('String'), "to_str");
      if ((($a = name.length < 3 || name.slice(0,2) !== '@@') !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('NameError'))}
      
      Opal.cvars[name.slice(2)] = value;
      return value;
    
    });

    Opal.defn(self, '$constants', function() {
      var self = this;

      return self.$$scope.constants.slice(0);
    });

    Opal.defn(self, '$const_defined?', function(name, inherit) {
      var $a, self = this;

      if (inherit == null) {
        inherit = true
      }
      if ((($a = name['$=~'](/^[A-Z]\w*$/)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('NameError').$new("wrong constant name " + (name), name))
      }
      
      var scopes = [self.$$scope];

      if (inherit || self === Opal.Object) {
        var parent = self.$$super;

        while (parent !== Opal.BasicObject) {
          scopes.push(parent.$$scope);

          parent = parent.$$super;
        }
      }

      for (var i = 0, length = scopes.length; i < length; i++) {
        if (scopes[i].hasOwnProperty(name)) {
          return true;
        }
      }

      return false;
    
    });

    Opal.defn(self, '$const_get', function(name, inherit) {
      var $a, $b, TMP_2, self = this;

      if (inherit == null) {
        inherit = true
      }
      if ((($a = name.indexOf('::') != -1 && name != '::') !== nil && (!$a.$$is_boolean || $a == true))) {
        return ($a = ($b = name.$split("::")).$inject, $a.$$p = (TMP_2 = function(o, c){var self = TMP_2.$$s || this;
if (o == null) o = nil;if (c == null) c = nil;
        return o.$const_get(c)}, TMP_2.$$s = self, TMP_2), $a).call($b, self)}
      if ((($a = /^[A-Z]\w*$/.test(name)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('NameError').$new("wrong constant name " + (name), name))
      }
      
      var scopes = [self.$$scope];

      if (inherit || self == Opal.Object) {
        var parent = self.$$super;

        while (parent !== Opal.BasicObject) {
          scopes.push(parent.$$scope);

          parent = parent.$$super;
        }
      }

      for (var i = 0, length = scopes.length; i < length; i++) {
        if (scopes[i].hasOwnProperty(name)) {
          return scopes[i][name];
        }
      }

      return self.$const_missing(name);
    
    });

    Opal.defn(self, '$const_missing', function(name) {
      var self = this;

      
      if (self.$$autoload) {
        var file = self.$$autoload[name];

        if (file) {
          self.$require(file);

          return self.$const_get(name);
        }
      }
    
      return self.$raise($scope.get('NameError').$new("uninitialized constant " + (self) + "::" + (name), name));
    });

    Opal.defn(self, '$const_set', function(name, value) {
      var $a, self = this;

      if ((($a = name['$=~'](/^[A-Z]\w*$/)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('NameError').$new("wrong constant name " + (name), name))
      }
      try {
      name = name.$to_str()
      } catch ($err) {if (true) {
        try {
          self.$raise($scope.get('TypeError'), "conversion with #to_str failed")
        } finally {
          Opal.gvars["!"] = Opal.exceptions.pop() || Opal.nil;
        }
        }else { throw $err; }
      }
      Opal.casgn(self, name, value);
      return value;
    });

    Opal.defn(self, '$define_method', TMP_3 = function(name, method) {
      var $a, $b, $c, TMP_4, self = this, $iter = TMP_3.$$p, block = $iter || nil, $case = nil;

      TMP_3.$$p = null;
      if ((($a = method === undefined && block === nil) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "tried to create a Proc object without a block")}
      ((($a = block) !== false && $a !== nil) ? $a : block = (function() {$case = method;if ($scope.get('Proc')['$===']($case)) {return method}else if ($scope.get('Method')['$===']($case)) {return method.$to_proc().$$unbound;}else if ($scope.get('UnboundMethod')['$===']($case)) {return ($b = ($c = self).$lambda, $b.$$p = (TMP_4 = function(args){var self = TMP_4.$$s || this, $a, bound = nil;
args = $slice.call(arguments, 0);
      bound = method.$bind(self);
        return ($a = bound).$call.apply($a, Opal.to_a(args));}, TMP_4.$$s = self, TMP_4), $b).call($c)}else {return self.$raise($scope.get('TypeError'), "wrong argument type " + (block.$class()) + " (expected Proc/Method)")}})());
      
      var id = '$' + name;

      block.$$jsid = name;
      block.$$s    = null;
      block.$$def  = block;

      Opal.defn(self, id, block);

      return name;
    
    });

    Opal.defn(self, '$remove_method', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var names = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        names[$splat_index] = arguments[$splat_index + 0];
      }
      
      for (var i = 0, length = names.length; i < length; i++) {
        Opal.rdef(self, "$" + names[i]);
      }
    
      return self;
    });

    Opal.defn(self, '$singleton_class?', function() {
      var self = this;

      return !!self.$$is_singleton;
    });

    Opal.defn(self, '$include', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var mods = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        mods[$splat_index] = arguments[$splat_index + 0];
      }
      
      for (var i = mods.length - 1; i >= 0; i--) {
        var mod = mods[i];

        if (mod === self) {
          continue;
        }

        if (!mod.$$is_module) {
          self.$raise($scope.get('TypeError'), "wrong argument type " + ((mod).$class()) + " (expected Module)");
        }

        (mod).$append_features(self);
        (mod).$included(self);
      }
    
      return self;
    });

    Opal.defn(self, '$include?', function(mod) {
      var self = this;

      
      for (var cls = self; cls; cls = cls.$$super) {
        for (var i = 0; i != cls.$$inc.length; i++) {
          var mod2 = cls.$$inc[i];
          if (mod === mod2) {
            return true;
          }
        }
      }
      return false;
    
    });

    Opal.defn(self, '$instance_method', function(name) {
      var self = this;

      
      var meth = self.$$proto['$' + name];

      if (!meth || meth.$$stub) {
        self.$raise($scope.get('NameError').$new("undefined method `" + (name) + "' for class `" + (self.$name()) + "'", name));
      }

      return $scope.get('UnboundMethod').$new(self, meth, name);
    
    });

    Opal.defn(self, '$instance_methods', function(include_super) {
      var self = this;

      if (include_super == null) {
        include_super = true
      }
      
      var methods = [],
          proto   = self.$$proto;

      for (var prop in proto) {
        if (prop.charAt(0) !== '$') {
          continue;
        }

        if (typeof(proto[prop]) !== "function") {
          continue;
        }

        if (proto[prop].$$stub) {
          continue;
        }

        if (!self.$$is_module) {
          if (self !== Opal.BasicObject && proto[prop] === Opal.BasicObject.$$proto[prop]) {
            continue;
          }

          if (!include_super && !proto.hasOwnProperty(prop)) {
            continue;
          }

          if (!include_super && proto[prop].$$donated) {
            continue;
          }
        }

        methods.push(prop.substr(1));
      }

      return methods;
    
    });

    Opal.defn(self, '$included', function(mod) {
      var self = this;

      return nil;
    });

    Opal.defn(self, '$extended', function(mod) {
      var self = this;

      return nil;
    });

    Opal.defn(self, '$method_added', function() {
      var self = this;

      return nil;
    });

    Opal.defn(self, '$method_removed', function() {
      var self = this;

      return nil;
    });

    Opal.defn(self, '$method_undefined', function() {
      var self = this;

      return nil;
    });

    Opal.defn(self, '$module_eval', TMP_5 = function() {
      var self = this, $iter = TMP_5.$$p, block = $iter || nil;

      TMP_5.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        self.$raise($scope.get('ArgumentError'), "no block given")
      }
      
      var old = block.$$s,
          result;

      block.$$s = null;
      result = block.call(self);
      block.$$s = old;

      return result;
    
    });

    Opal.alias(self, 'class_eval', 'module_eval');

    Opal.defn(self, '$module_exec', TMP_6 = function() {
      var self = this, $iter = TMP_6.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_6.$$p = null;
      
      if (block === nil) {
        self.$raise($scope.get('LocalJumpError'), "no block given")
      }

      var block_self = block.$$s, result;

      block.$$s = null;
      result = block.apply(self, args);
      block.$$s = block_self;

      return result;

    });

    Opal.alias(self, 'class_exec', 'module_exec');

    Opal.defn(self, '$method_defined?', function(method) {
      var self = this;

      
      var body = self.$$proto['$' + method];
      return (!!body) && !body.$$stub;
    
    });

    Opal.defn(self, '$module_function', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var methods = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        methods[$splat_index] = arguments[$splat_index + 0];
      }
      
      if (methods.length === 0) {
        self.$$module_function = true;
      }
      else {
        for (var i = 0, length = methods.length; i < length; i++) {
          var meth = methods[i],
              id   = '$' + meth,
              func = self.$$proto[id];

          Opal.defs(self, id, func);
        }
      }

      return self;
    
    });

    Opal.defn(self, '$name', function() {
      var self = this;

      
      if (self.$$full_name) {
        return self.$$full_name;
      }

      var result = [], base = self;

      while (base) {
        if (base.$$name === nil) {
          return result.length === 0 ? nil : result.join('::');
        }

        result.unshift(base.$$name);

        base = base.$$base_module;

        if (base === Opal.Object) {
          break;
        }
      }

      if (result.length === 0) {
        return nil;
      }

      return self.$$full_name = result.join('::');
    
    });

    Opal.defn(self, '$remove_class_variable', function() {
      var self = this;

      return nil;
    });

    Opal.defn(self, '$remove_const', function(name) {
      var self = this;

      
      var old = self.$$scope[name];
      delete self.$$scope[name];
      return old;
    
    });

    Opal.defn(self, '$to_s', function() {
      var $a, self = this;

      return ((($a = Opal.Module.$name.call(self)) !== false && $a !== nil) ? $a : "#<" + (self.$$is_module ? 'Module' : 'Class') + ":0x" + (self.$__id__().$to_s(16)) + ">");
    });

    return (Opal.defn(self, '$undef_method', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var names = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        names[$splat_index] = arguments[$splat_index + 0];
      }
      
      for (var i = 0, length = names.length; i < length; i++) {
        Opal.udef(self, "$" + names[i]);
      }
    
      return self;
    }), nil) && 'undef_method';
  })($scope.base, null)
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/class"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$require', '$raise', '$allocate']);
  self.$require("corelib/module");
  return (function($base, $super) {
    function $Class(){}
    var self = $Class = $klass($base, $super, 'Class', $Class);

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2;

    Opal.defs(self, '$new', TMP_1 = function(sup) {
      var self = this, $iter = TMP_1.$$p, block = $iter || nil;

      if (sup == null) {
        sup = $scope.get('Object')
      }
      TMP_1.$$p = null;
      
      if (!sup.$$is_class) {
        self.$raise($scope.get('TypeError'), "superclass must be a Class");
      }

      function AnonClass(){}
      var klass        = Opal.boot_class(sup, AnonClass)
      klass.$$name     = nil;
      klass.$$parent   = sup;
      klass.$$is_class = true;

      // inherit scope from parent
      Opal.create_scope(sup.$$scope, klass);

      sup.$inherited(klass);

      if (block !== nil) {
        var block_self = block.$$s;
        block.$$s = null;
        block.call(klass);
        block.$$s = block_self;
      }

      return klass;

    });

    Opal.defn(self, '$allocate', function() {
      var self = this;

      
      var obj = new self.$$alloc();
      obj.$$id = Opal.uid();
      return obj;
    
    });

    Opal.defn(self, '$inherited', function(cls) {
      var self = this;

      return nil;
    });

    Opal.defn(self, '$new', TMP_2 = function() {
      var self = this, $iter = TMP_2.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_2.$$p = null;
      
      var obj = self.$allocate();

      obj.$initialize.$$p = block;
      obj.$initialize.apply(obj, args);
      return obj;

    });

    return (Opal.defn(self, '$superclass', function() {
      var self = this;

      return self.$$super || nil;
    }), nil) && 'superclass';
  })($scope.base, null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/basic_object"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $range = Opal.range, $hash2 = Opal.hash2;

  Opal.add_stubs(['$==', '$!', '$nil?', '$cover?', '$size', '$raise', '$compile', '$lambda', '$>', '$new', '$inspect']);
  return (function($base, $super) {
    function $BasicObject(){}
    var self = $BasicObject = $klass($base, $super, 'BasicObject', $BasicObject);

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2, TMP_4, TMP_5;

    Opal.defn(self, '$initialize', function() {
      var self = this;

      return nil;
    });

    Opal.defn(self, '$==', function(other) {
      var self = this;

      return self === other;
    });

    Opal.defn(self, '$eql?', function(other) {
      var self = this;

      return self['$=='](other);
    });

    Opal.alias(self, 'equal?', '==');

    Opal.defn(self, '$__id__', function() {
      var self = this;

      return self.$$id || (self.$$id = Opal.uid());
    });

    Opal.defn(self, '$__send__', TMP_1 = function(symbol) {
      var self = this, $iter = TMP_1.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 1;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 1];
      }
      TMP_1.$$p = null;
      
      var func = self['$' + symbol]

      if (func) {
        if (block !== nil) {
          func.$$p = block;
        }

        return func.apply(self, args);
      }

      if (block !== nil) {
        self.$method_missing.$$p = block;
      }

      return self.$method_missing.apply(self, [symbol].concat(args));
    
    });

    Opal.defn(self, '$!', function() {
      var self = this;

      return false;
    });

    Opal.defn(self, '$!=', function(other) {
      var self = this;

      return (self['$=='](other))['$!']();
    });

    Opal.alias(self, 'equal?', '==');

    Opal.defn(self, '$instance_eval', TMP_2 = function() {
      var $a, $b, TMP_3, self = this, $iter = TMP_2.$$p, block = $iter || nil, string = nil, file = nil, _lineno = nil, compiled = nil, wrapper = nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_2.$$p = null;
      if ((($a = ($b = block['$nil?'](), $b !== false && $b !== nil ?!!Opal.compile : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = ($range(1, 3, false))['$cover?'](args.$size())) !== nil && (!$a.$$is_boolean || $a == true))) {
          } else {
          $scope.get('Kernel').$raise($scope.get('ArgumentError'), "wrong number of arguments (0 for 1..3)")
        }
        $a = Opal.to_a(args), string = ($a[0] == null ? nil : $a[0]), file = ($a[1] == null ? nil : $a[1]), _lineno = ($a[2] == null ? nil : $a[2]), $a;
        compiled = $scope.get('Opal').$compile(string, $hash2(["file", "eval"], {"file": (((($a = file) !== false && $a !== nil) ? $a : "(eval)")), "eval": true}));
        wrapper = function() {return eval(compiled)};
        block = ($a = ($b = $scope.get('Kernel')).$lambda, $a.$$p = (TMP_3 = function(){var self = TMP_3.$$s || this;

        return wrapper.call(self);}, TMP_3.$$s = self, TMP_3), $a).call($b);
      } else if ((($a = $rb_gt(args.$size(), 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
        $scope.get('Kernel').$raise($scope.get('ArgumentError'), "wrong number of arguments (" + (args.$size()) + " for 0)")}
      
      var old = block.$$s,
          result;

      block.$$s = null;

      // Need to pass $$eval so that method definitions know if this is
      // being done on a class/module. Cannot be compiler driven since
      // send(:instance_eval) needs to work.
      if (self.$$is_class || self.$$is_module) {
        self.$$eval = true;
        try {
          result = block.call(self, self);
        }
        finally {
          self.$$eval = false;
        }
      }
      else {
        result = block.call(self, self);
      }

      block.$$s = old;

      return result;
    
    });

    Opal.defn(self, '$instance_exec', TMP_4 = function() {
      var self = this, $iter = TMP_4.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_4.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        $scope.get('Kernel').$raise($scope.get('ArgumentError'), "no block given")
      }
      
      var block_self = block.$$s,
          result;

      block.$$s = null;

      if (self.$$is_class || self.$$is_module) {
        self.$$eval = true;
        try {
          result = block.apply(self, args);
        }
        finally {
          self.$$eval = false;
        }
      }
      else {
        result = block.apply(self, args);
      }

      block.$$s = block_self;

      return result;
    
    });

    Opal.defn(self, '$singleton_method_added', function() {
      var self = this;

      return nil;
    });

    Opal.defn(self, '$singleton_method_removed', function() {
      var self = this;

      return nil;
    });

    Opal.defn(self, '$singleton_method_undefined', function() {
      var self = this;

      return nil;
    });

    return (Opal.defn(self, '$method_missing', TMP_5 = function(symbol) {
      var $a, self = this, $iter = TMP_5.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 1;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 1];
      }
      TMP_5.$$p = null;
      return $scope.get('Kernel').$raise($scope.get('NoMethodError').$new((function() {if ((($a = self.$inspect && !self.$inspect.$$stub) !== nil && (!$a.$$is_boolean || $a == true))) {
        return "undefined method `" + (symbol) + "' for " + (self.$inspect()) + ":" + (self.$$class)
        } else {
        return "undefined method `" + (symbol) + "' for " + (self.$$class)
      } return nil; })(), symbol));
    }), nil) && 'method_missing';
  })($scope.base, null)
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/kernel"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  function $rb_le(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs <= rhs : lhs['$<='](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module, $gvars = Opal.gvars, $hash2 = Opal.hash2, $klass = Opal.klass;

  Opal.add_stubs(['$raise', '$new', '$inspect', '$!', '$=~', '$==', '$object_id', '$class', '$coerce_to?', '$<<', '$allocate', '$copy_instance_variables', '$copy_singleton_methods', '$initialize_clone', '$initialize_copy', '$define_method', '$to_proc', '$singleton_class', '$initialize_dup', '$for', '$loop', '$pop', '$call', '$append_features', '$extended', '$length', '$respond_to?', '$[]', '$nil?', '$to_a', '$to_int', '$fetch', '$Integer', '$Float', '$to_ary', '$to_str', '$coerce_to', '$to_s', '$__id__', '$instance_variable_name!', '$coerce_to!', '$===', '$>', '$print', '$format', '$puts', '$each', '$<=', '$empty?', '$exception', '$kind_of?', '$respond_to_missing?', '$try_convert!', '$expand_path', '$join', '$start_with?', '$sym', '$arg', '$include']);
  (function($base) {
    var $Kernel, self = $Kernel = $module($base, 'Kernel');

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_6, TMP_7, TMP_8, TMP_10, TMP_11;

    Opal.defn(self, '$method_missing', TMP_1 = function(symbol) {
      var self = this, $iter = TMP_1.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 1;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 1];
      }
      TMP_1.$$p = null;
      return self.$raise($scope.get('NoMethodError').$new("undefined method `" + (symbol) + "' for " + (self.$inspect()), symbol, args));
    });

    Opal.defn(self, '$=~', function(obj) {
      var self = this;

      return false;
    });

    Opal.defn(self, '$!~', function(obj) {
      var self = this;

      return (self['$=~'](obj))['$!']();
    });

    Opal.defn(self, '$===', function(other) {
      var $a, self = this;

      return ((($a = self.$object_id()['$=='](other.$object_id())) !== false && $a !== nil) ? $a : self['$=='](other));
    });

    Opal.defn(self, '$<=>', function(other) {
      var self = this;

      
      // set guard for infinite recursion
      self.$$comparable = true;

      var x = self['$=='](other);

      if (x && x !== nil) {
        return 0;
      }

      return nil;
    
    });

    Opal.defn(self, '$method', function(name) {
      var self = this;

      
      var meth = self['$' + name];

      if (!meth || meth.$$stub) {
        self.$raise($scope.get('NameError').$new("undefined method `" + (name) + "' for class `" + (self.$class()) + "'", name));
      }

      return $scope.get('Method').$new(self, meth, name);
    
    });

    Opal.defn(self, '$methods', function(all) {
      var self = this;

      if (all == null) {
        all = true
      }
      
      var methods = [];

      for (var key in self) {
        if (key[0] == "$" && typeof(self[key]) === "function") {
          if (all == false || all === nil) {
            if (!Opal.hasOwnProperty.call(self, key)) {
              continue;
            }
          }
          if (self[key].$$stub === undefined) {
            methods.push(key.substr(1));
          }
        }
      }

      return methods;
    
    });

    Opal.alias(self, 'public_methods', 'methods');

    Opal.defn(self, '$Array', function(object) {
      var self = this;

      
      var coerced;

      if (object === nil) {
        return [];
      }

      if (object.$$is_array) {
        return object;
      }

      coerced = $scope.get('Opal')['$coerce_to?'](object, $scope.get('Array'), "to_ary");
      if (coerced !== nil) { return coerced; }

      coerced = $scope.get('Opal')['$coerce_to?'](object, $scope.get('Array'), "to_a");
      if (coerced !== nil) { return coerced; }

      return [object];
    
    });

    Opal.defn(self, '$at_exit', TMP_2 = function() {
      var $a, self = this, $iter = TMP_2.$$p, block = $iter || nil;
      if ($gvars.__at_exit__ == null) $gvars.__at_exit__ = nil;

      TMP_2.$$p = null;
      ((($a = $gvars.__at_exit__) !== false && $a !== nil) ? $a : $gvars.__at_exit__ = []);
      return $gvars.__at_exit__['$<<'](block);
    });

    Opal.defn(self, '$caller', function() {
      var self = this;

      return [];
    });

    Opal.defn(self, '$class', function() {
      var self = this;

      return self.$$class;
    });

    Opal.defn(self, '$copy_instance_variables', function(other) {
      var self = this;

      
      for (var name in other) {
        if (other.hasOwnProperty(name) && name.charAt(0) !== '$') {
          self[name] = other[name];
        }
      }
    
    });

    Opal.defn(self, '$copy_singleton_methods', function(other) {
      var self = this;

      
      var name;

      if (other.hasOwnProperty('$$meta')) {
        var other_singleton_class_proto = Opal.get_singleton_class(other).$$proto;
        var self_singleton_class_proto = Opal.get_singleton_class(self).$$proto;

        for (name in other_singleton_class_proto) {
          if (name.charAt(0) === '$' && other_singleton_class_proto.hasOwnProperty(name)) {
            self_singleton_class_proto[name] = other_singleton_class_proto[name];
          }
        }
      }

      for (name in other) {
        if (name.charAt(0) === '$' && name.charAt(1) !== '$' && other.hasOwnProperty(name)) {
          self[name] = other[name];
        }
      }
    
    });

    Opal.defn(self, '$clone', function() {
      var self = this, copy = nil;

      copy = self.$class().$allocate();
      copy.$copy_instance_variables(self);
      copy.$copy_singleton_methods(self);
      copy.$initialize_clone(self);
      return copy;
    });

    Opal.defn(self, '$initialize_clone', function(other) {
      var self = this;

      return self.$initialize_copy(other);
    });

    Opal.defn(self, '$define_singleton_method', TMP_3 = function(name, method) {
      var $a, $b, self = this, $iter = TMP_3.$$p, block = $iter || nil;

      TMP_3.$$p = null;
      return ($a = ($b = self.$singleton_class()).$define_method, $a.$$p = block.$to_proc(), $a).call($b, name, method);
    });

    Opal.defn(self, '$dup', function() {
      var self = this, copy = nil;

      copy = self.$class().$allocate();
      copy.$copy_instance_variables(self);
      copy.$initialize_dup(self);
      return copy;
    });

    Opal.defn(self, '$initialize_dup', function(other) {
      var self = this;

      return self.$initialize_copy(other);
    });

    Opal.defn(self, '$enum_for', TMP_4 = function(method) {
      var $a, $b, self = this, $iter = TMP_4.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 1;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 1];
      }
      if (method == null) {
        method = "each"
      }
      TMP_4.$$p = null;
      return ($a = ($b = $scope.get('Enumerator')).$for, $a.$$p = block.$to_proc(), $a).apply($b, [self, method].concat(Opal.to_a(args)));
    });

    Opal.alias(self, 'to_enum', 'enum_for');

    Opal.defn(self, '$equal?', function(other) {
      var self = this;

      return self === other;
    });

    Opal.defn(self, '$exit', function(status) {
      var $a, $b, TMP_5, self = this;
      if ($gvars.__at_exit__ == null) $gvars.__at_exit__ = nil;

      if (status == null) {
        status = true
      }
      ((($a = $gvars.__at_exit__) !== false && $a !== nil) ? $a : $gvars.__at_exit__ = []);
      ($a = ($b = self).$loop, $a.$$p = (TMP_5 = function(){var self = TMP_5.$$s || this, block = nil;
        if ($gvars.__at_exit__ == null) $gvars.__at_exit__ = nil;

      block = $gvars.__at_exit__.$pop();
        if (block !== false && block !== nil) {
          return block.$call()
          } else {
          return ($breaker.$v = nil, $breaker)
        }}, TMP_5.$$s = self, TMP_5), $a).call($b);
      if ((($a = status === true) !== nil && (!$a.$$is_boolean || $a == true))) {
        status = 0}
      Opal.exit(status);
      return nil;
    });

    Opal.defn(self, '$extend', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var mods = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        mods[$splat_index] = arguments[$splat_index + 0];
      }
      
      var singleton = self.$singleton_class();

      for (var i = mods.length - 1; i >= 0; i--) {
        var mod = mods[i];

        if (!mod.$$is_module) {
          self.$raise($scope.get('TypeError'), "wrong argument type " + ((mod).$class()) + " (expected Module)");
        }

        (mod).$append_features(singleton);
        (mod).$extended(self);
      }

      return self;
    });

    Opal.defn(self, '$format', function(format_string) {
      var $a, $b, self = this, ary = nil, $splat_index = nil;
      if ($gvars.DEBUG == null) $gvars.DEBUG = nil;

      var array_size = arguments.length - 1;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 1];
      }
      if ((($a = (($b = args.$length()['$=='](1)) ? args['$[]'](0)['$respond_to?']("to_ary") : args.$length()['$=='](1))) !== nil && (!$a.$$is_boolean || $a == true))) {
        ary = $scope.get('Opal')['$coerce_to?'](args['$[]'](0), $scope.get('Array'), "to_ary");
        if ((($a = ary['$nil?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
          } else {
          args = ary.$to_a()
        }}
      
      var result = '',
          //used for slicing:
          begin_slice = 0,
          end_slice,
          //used for iterating over the format string:
          i,
          len = format_string.length,
          //used for processing field values:
          arg,
          str,
          //used for processing %g and %G fields:
          exponent,
          //used for keeping track of width and precision:
          width,
          precision,
          //used for holding temporary values:
          tmp_num,
          //used for processing %{} and %<> fileds:
          hash_parameter_key,
          closing_brace_char,
          //used for processing %b, %B, %o, %x, and %X fields:
          base_number,
          base_prefix,
          base_neg_zero_regex,
          base_neg_zero_digit,
          //used for processing arguments:
          next_arg,
          seq_arg_num = 1,
          pos_arg_num = 0,
          //used for keeping track of flags:
          flags,
          FNONE  = 0,
          FSHARP = 1,
          FMINUS = 2,
          FPLUS  = 4,
          FZERO  = 8,
          FSPACE = 16,
          FWIDTH = 32,
          FPREC  = 64,
          FPREC0 = 128;

      function CHECK_FOR_FLAGS() {
        if (flags&FWIDTH) { self.$raise($scope.get('ArgumentError'), "flag after width") }
        if (flags&FPREC0) { self.$raise($scope.get('ArgumentError'), "flag after precision") }
      }

      function CHECK_FOR_WIDTH() {
        if (flags&FWIDTH) { self.$raise($scope.get('ArgumentError'), "width given twice") }
        if (flags&FPREC0) { self.$raise($scope.get('ArgumentError'), "width after precision") }
      }

      function GET_NTH_ARG(num) {
        if (num >= args.length) { self.$raise($scope.get('ArgumentError'), "too few arguments") }
        return args[num];
      }

      function GET_NEXT_ARG() {
        switch (pos_arg_num) {
        case -1: self.$raise($scope.get('ArgumentError'), "unnumbered(" + (seq_arg_num) + ") mixed with numbered")
        case -2: self.$raise($scope.get('ArgumentError'), "unnumbered(" + (seq_arg_num) + ") mixed with named")
        }
        pos_arg_num = seq_arg_num++;
        return GET_NTH_ARG(pos_arg_num - 1);
      }

      function GET_POS_ARG(num) {
        if (pos_arg_num > 0) {
          self.$raise($scope.get('ArgumentError'), "numbered(" + (num) + ") after unnumbered(" + (pos_arg_num) + ")")
        }
        if (pos_arg_num === -2) {
          self.$raise($scope.get('ArgumentError'), "numbered(" + (num) + ") after named")
        }
        if (num < 1) {
          self.$raise($scope.get('ArgumentError'), "invalid index - " + (num) + "$")
        }
        pos_arg_num = -1;
        return GET_NTH_ARG(num - 1);
      }

      function GET_ARG() {
        return (next_arg === undefined ? GET_NEXT_ARG() : next_arg);
      }

      function READ_NUM(label) {
        var num, str = '';
        for (;; i++) {
          if (i === len) {
            self.$raise($scope.get('ArgumentError'), "malformed format string - %*[0-9]")
          }
          if (format_string.charCodeAt(i) < 48 || format_string.charCodeAt(i) > 57) {
            i--;
            num = parseInt(str, 10) || 0;
            if (num > 2147483647) {
              self.$raise($scope.get('ArgumentError'), "" + (label) + " too big")
            }
            return num;
          }
          str += format_string.charAt(i);
        }
      }

      function READ_NUM_AFTER_ASTER(label) {
        var arg, num = READ_NUM(label);
        if (format_string.charAt(i + 1) === '$') {
          i++;
          arg = GET_POS_ARG(num);
        } else {
          arg = GET_NEXT_ARG();
        }
        return (arg).$to_int();
      }

      for (i = format_string.indexOf('%'); i !== -1; i = format_string.indexOf('%', i)) {
        str = undefined;

        flags = FNONE;
        width = -1;
        precision = -1;
        next_arg = undefined;

        end_slice = i;

        i++;

        switch (format_string.charAt(i)) {
        case '%':
          begin_slice = i;
        case '':
        case '\n':
        case '\0':
          i++;
          continue;
        }

        format_sequence: for (; i < len; i++) {
          switch (format_string.charAt(i)) {

          case ' ':
            CHECK_FOR_FLAGS();
            flags |= FSPACE;
            continue;

          case '#':
            CHECK_FOR_FLAGS();
            flags |= FSHARP;
            continue;

          case '+':
            CHECK_FOR_FLAGS();
            flags |= FPLUS;
            continue;

          case '-':
            CHECK_FOR_FLAGS();
            flags |= FMINUS;
            continue;

          case '0':
            CHECK_FOR_FLAGS();
            flags |= FZERO;
            continue;

          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
          case '7':
          case '8':
          case '9':
            tmp_num = READ_NUM('width');
            if (format_string.charAt(i + 1) === '$') {
              if (i + 2 === len) {
                str = '%';
                i++;
                break format_sequence;
              }
              if (next_arg !== undefined) {
                self.$raise($scope.get('ArgumentError'), "value given twice - %" + (tmp_num) + "$")
              }
              next_arg = GET_POS_ARG(tmp_num);
              i++;
            } else {
              CHECK_FOR_WIDTH();
              flags |= FWIDTH;
              width = tmp_num;
            }
            continue;

          case '<':
          case '\{':
            closing_brace_char = (format_string.charAt(i) === '<' ? '>' : '\}');
            hash_parameter_key = '';

            i++;

            for (;; i++) {
              if (i === len) {
                self.$raise($scope.get('ArgumentError'), "malformed name - unmatched parenthesis")
              }
              if (format_string.charAt(i) === closing_brace_char) {

                if (pos_arg_num > 0) {
                  self.$raise($scope.get('ArgumentError'), "named " + (hash_parameter_key) + " after unnumbered(" + (pos_arg_num) + ")")
                }
                if (pos_arg_num === -1) {
                  self.$raise($scope.get('ArgumentError'), "named " + (hash_parameter_key) + " after numbered")
                }
                pos_arg_num = -2;

                if (args[0] === undefined || !args[0].$$is_hash) {
                  self.$raise($scope.get('ArgumentError'), "one hash required")
                }

                next_arg = (args[0]).$fetch(hash_parameter_key);

                if (closing_brace_char === '>') {
                  continue format_sequence;
                } else {
                  str = next_arg.toString();
                  if (precision !== -1) { str = str.slice(0, precision); }
                  if (flags&FMINUS) {
                    while (str.length < width) { str = str + ' '; }
                  } else {
                    while (str.length < width) { str = ' ' + str; }
                  }
                  break format_sequence;
                }
              }
              hash_parameter_key += format_string.charAt(i);
            }

          case '*':
            i++;
            CHECK_FOR_WIDTH();
            flags |= FWIDTH;
            width = READ_NUM_AFTER_ASTER('width');
            if (width < 0) {
              flags |= FMINUS;
              width = -width;
            }
            continue;

          case '.':
            if (flags&FPREC0) {
              self.$raise($scope.get('ArgumentError'), "precision given twice")
            }
            flags |= FPREC|FPREC0;
            precision = 0;
            i++;
            if (format_string.charAt(i) === '*') {
              i++;
              precision = READ_NUM_AFTER_ASTER('precision');
              if (precision < 0) {
                flags &= ~FPREC;
              }
              continue;
            }
            precision = READ_NUM('precision');
            continue;

          case 'd':
          case 'i':
          case 'u':
            arg = self.$Integer(GET_ARG());
            if (arg >= 0) {
              str = arg.toString();
              while (str.length < precision) { str = '0' + str; }
              if (flags&FMINUS) {
                if (flags&FPLUS || flags&FSPACE) { str = (flags&FPLUS ? '+' : ' ') + str; }
                while (str.length < width) { str = str + ' '; }
              } else {
                if (flags&FZERO && precision === -1) {
                  while (str.length < width - ((flags&FPLUS || flags&FSPACE) ? 1 : 0)) { str = '0' + str; }
                  if (flags&FPLUS || flags&FSPACE) { str = (flags&FPLUS ? '+' : ' ') + str; }
                } else {
                  if (flags&FPLUS || flags&FSPACE) { str = (flags&FPLUS ? '+' : ' ') + str; }
                  while (str.length < width) { str = ' ' + str; }
                }
              }
            } else {
              str = (-arg).toString();
              while (str.length < precision) { str = '0' + str; }
              if (flags&FMINUS) {
                str = '-' + str;
                while (str.length < width) { str = str + ' '; }
              } else {
                if (flags&FZERO && precision === -1) {
                  while (str.length < width - 1) { str = '0' + str; }
                  str = '-' + str;
                } else {
                  str = '-' + str;
                  while (str.length < width) { str = ' ' + str; }
                }
              }
            }
            break format_sequence;

          case 'b':
          case 'B':
          case 'o':
          case 'x':
          case 'X':
            switch (format_string.charAt(i)) {
            case 'b':
            case 'B':
              base_number = 2;
              base_prefix = '0b';
              base_neg_zero_regex = /^1+/;
              base_neg_zero_digit = '1';
              break;
            case 'o':
              base_number = 8;
              base_prefix = '0';
              base_neg_zero_regex = /^3?7+/;
              base_neg_zero_digit = '7';
              break;
            case 'x':
            case 'X':
              base_number = 16;
              base_prefix = '0x';
              base_neg_zero_regex = /^f+/;
              base_neg_zero_digit = 'f';
              break;
            }
            arg = self.$Integer(GET_ARG());
            if (arg >= 0) {
              str = arg.toString(base_number);
              while (str.length < precision) { str = '0' + str; }
              if (flags&FMINUS) {
                if (flags&FPLUS || flags&FSPACE) { str = (flags&FPLUS ? '+' : ' ') + str; }
                if (flags&FSHARP && arg !== 0) { str = base_prefix + str; }
                while (str.length < width) { str = str + ' '; }
              } else {
                if (flags&FZERO && precision === -1) {
                  while (str.length < width - ((flags&FPLUS || flags&FSPACE) ? 1 : 0) - ((flags&FSHARP && arg !== 0) ? base_prefix.length : 0)) { str = '0' + str; }
                  if (flags&FSHARP && arg !== 0) { str = base_prefix + str; }
                  if (flags&FPLUS || flags&FSPACE) { str = (flags&FPLUS ? '+' : ' ') + str; }
                } else {
                  if (flags&FSHARP && arg !== 0) { str = base_prefix + str; }
                  if (flags&FPLUS || flags&FSPACE) { str = (flags&FPLUS ? '+' : ' ') + str; }
                  while (str.length < width) { str = ' ' + str; }
                }
              }
            } else {
              if (flags&FPLUS || flags&FSPACE) {
                str = (-arg).toString(base_number);
                while (str.length < precision) { str = '0' + str; }
                if (flags&FMINUS) {
                  if (flags&FSHARP) { str = base_prefix + str; }
                  str = '-' + str;
                  while (str.length < width) { str = str + ' '; }
                } else {
                  if (flags&FZERO && precision === -1) {
                    while (str.length < width - 1 - (flags&FSHARP ? 2 : 0)) { str = '0' + str; }
                    if (flags&FSHARP) { str = base_prefix + str; }
                    str = '-' + str;
                  } else {
                    if (flags&FSHARP) { str = base_prefix + str; }
                    str = '-' + str;
                    while (str.length < width) { str = ' ' + str; }
                  }
                }
              } else {
                str = (arg >>> 0).toString(base_number).replace(base_neg_zero_regex, base_neg_zero_digit);
                while (str.length < precision - 2) { str = base_neg_zero_digit + str; }
                if (flags&FMINUS) {
                  str = '..' + str;
                  if (flags&FSHARP) { str = base_prefix + str; }
                  while (str.length < width) { str = str + ' '; }
                } else {
                  if (flags&FZERO && precision === -1) {
                    while (str.length < width - 2 - (flags&FSHARP ? base_prefix.length : 0)) { str = base_neg_zero_digit + str; }
                    str = '..' + str;
                    if (flags&FSHARP) { str = base_prefix + str; }
                  } else {
                    str = '..' + str;
                    if (flags&FSHARP) { str = base_prefix + str; }
                    while (str.length < width) { str = ' ' + str; }
                  }
                }
              }
            }
            if (format_string.charAt(i) === format_string.charAt(i).toUpperCase()) {
              str = str.toUpperCase();
            }
            break format_sequence;

          case 'f':
          case 'e':
          case 'E':
          case 'g':
          case 'G':
            arg = self.$Float(GET_ARG());
            if (arg >= 0 || isNaN(arg)) {
              if (arg === Infinity) {
                str = 'Inf';
              } else {
                switch (format_string.charAt(i)) {
                case 'f':
                  str = arg.toFixed(precision === -1 ? 6 : precision);
                  break;
                case 'e':
                case 'E':
                  str = arg.toExponential(precision === -1 ? 6 : precision);
                  break;
                case 'g':
                case 'G':
                  str = arg.toExponential();
                  exponent = parseInt(str.split('e')[1], 10);
                  if (!(exponent < -4 || exponent >= (precision === -1 ? 6 : precision))) {
                    str = arg.toPrecision(precision === -1 ? (flags&FSHARP ? 6 : undefined) : precision);
                  }
                  break;
                }
              }
              if (flags&FMINUS) {
                if (flags&FPLUS || flags&FSPACE) { str = (flags&FPLUS ? '+' : ' ') + str; }
                while (str.length < width) { str = str + ' '; }
              } else {
                if (flags&FZERO && arg !== Infinity && !isNaN(arg)) {
                  while (str.length < width - ((flags&FPLUS || flags&FSPACE) ? 1 : 0)) { str = '0' + str; }
                  if (flags&FPLUS || flags&FSPACE) { str = (flags&FPLUS ? '+' : ' ') + str; }
                } else {
                  if (flags&FPLUS || flags&FSPACE) { str = (flags&FPLUS ? '+' : ' ') + str; }
                  while (str.length < width) { str = ' ' + str; }
                }
              }
            } else {
              if (arg === -Infinity) {
                str = 'Inf';
              } else {
                switch (format_string.charAt(i)) {
                case 'f':
                  str = (-arg).toFixed(precision === -1 ? 6 : precision);
                  break;
                case 'e':
                case 'E':
                  str = (-arg).toExponential(precision === -1 ? 6 : precision);
                  break;
                case 'g':
                case 'G':
                  str = (-arg).toExponential();
                  exponent = parseInt(str.split('e')[1], 10);
                  if (!(exponent < -4 || exponent >= (precision === -1 ? 6 : precision))) {
                    str = (-arg).toPrecision(precision === -1 ? (flags&FSHARP ? 6 : undefined) : precision);
                  }
                  break;
                }
              }
              if (flags&FMINUS) {
                str = '-' + str;
                while (str.length < width) { str = str + ' '; }
              } else {
                if (flags&FZERO && arg !== -Infinity) {
                  while (str.length < width - 1) { str = '0' + str; }
                  str = '-' + str;
                } else {
                  str = '-' + str;
                  while (str.length < width) { str = ' ' + str; }
                }
              }
            }
            if (format_string.charAt(i) === format_string.charAt(i).toUpperCase() && arg !== Infinity && arg !== -Infinity && !isNaN(arg)) {
              str = str.toUpperCase();
            }
            str = str.replace(/([eE][-+]?)([0-9])$/, '$10$2');
            break format_sequence;

          case 'a':
          case 'A':
            // Not implemented because there are no specs for this field type.
            self.$raise($scope.get('NotImplementedError'), "`A` and `a` format field types are not implemented in Opal yet")

          case 'c':
            arg = GET_ARG();
            if ((arg)['$respond_to?']("to_ary")) { arg = (arg).$to_ary()[0]; }
            if ((arg)['$respond_to?']("to_str")) {
              str = (arg).$to_str();
            } else {
              str = String.fromCharCode($scope.get('Opal').$coerce_to(arg, $scope.get('Integer'), "to_int"));
            }
            if (str.length !== 1) {
              self.$raise($scope.get('ArgumentError'), "%c requires a character")
            }
            if (flags&FMINUS) {
              while (str.length < width) { str = str + ' '; }
            } else {
              while (str.length < width) { str = ' ' + str; }
            }
            break format_sequence;

          case 'p':
            str = (GET_ARG()).$inspect();
            if (precision !== -1) { str = str.slice(0, precision); }
            if (flags&FMINUS) {
              while (str.length < width) { str = str + ' '; }
            } else {
              while (str.length < width) { str = ' ' + str; }
            }
            break format_sequence;

          case 's':
            str = (GET_ARG()).$to_s();
            if (precision !== -1) { str = str.slice(0, precision); }
            if (flags&FMINUS) {
              while (str.length < width) { str = str + ' '; }
            } else {
              while (str.length < width) { str = ' ' + str; }
            }
            break format_sequence;

          default:
            self.$raise($scope.get('ArgumentError'), "malformed format string - %" + (format_string.charAt(i)))
          }
        }

        if (str === undefined) {
          self.$raise($scope.get('ArgumentError'), "malformed format string - %")
        }

        result += format_string.slice(begin_slice, end_slice) + str;
        begin_slice = i + 1;
      }

      if ($gvars.DEBUG && pos_arg_num >= 0 && seq_arg_num < args.length) {
        self.$raise($scope.get('ArgumentError'), "too many arguments for format string")
      }

      return result + format_string.slice(begin_slice);

    });

    Opal.defn(self, '$hash', function() {
      var self = this;

      return self.$__id__();
    });

    Opal.defn(self, '$initialize_copy', function(other) {
      var self = this;

      return nil;
    });

    Opal.defn(self, '$inspect', function() {
      var self = this;

      return self.$to_s();
    });

    Opal.defn(self, '$instance_of?', function(klass) {
      var self = this;

      
      if (!klass.$$is_class && !klass.$$is_module) {
        self.$raise($scope.get('TypeError'), "class or module required");
      }

      return self.$$class === klass;

    });

    Opal.defn(self, '$instance_variable_defined?', function(name) {
      var self = this;

      name = $scope.get('Opal')['$instance_variable_name!'](name);
      return Opal.hasOwnProperty.call(self, name.substr(1));
    });

    Opal.defn(self, '$instance_variable_get', function(name) {
      var self = this;

      name = $scope.get('Opal')['$instance_variable_name!'](name);
      
      var ivar = self[Opal.ivar(name.substr(1))];

      return ivar == null ? nil : ivar;
    
    });

    Opal.defn(self, '$instance_variable_set', function(name, value) {
      var self = this;

      name = $scope.get('Opal')['$instance_variable_name!'](name);
      return self[Opal.ivar(name.substr(1))] = value;
    });

    Opal.defn(self, '$remove_instance_variable', function(name) {
      var self = this;

      name = $scope.get('Opal')['$instance_variable_name!'](name);
      
      var key = Opal.ivar(name.substr(1)),
          val;
      if (self.hasOwnProperty(key)) {
        val = self[key];
        delete self[key];
        return val;
      }
    
      return self.$raise($scope.get('NameError'), "instance variable " + (name) + " not defined");
    });

    Opal.defn(self, '$instance_variables', function() {
      var self = this;

      
      var result = [], ivar;

      for (var name in self) {
        if (self.hasOwnProperty(name) && name.charAt(0) !== '$') {
          if (name.substr(-1) === '$') {
            ivar = name.slice(0, name.length - 1);
          } else {
            ivar = name;
          }
          result.push('@' + ivar);
        }
      }

      return result;
    
    });

    Opal.defn(self, '$Integer', function(value, base) {
      var self = this;

      
      var i, str, base_digits;

      if (!value.$$is_string) {
        if (base !== undefined) {
          self.$raise($scope.get('ArgumentError'), "base specified for non string value")
        }
        if (value === nil) {
          self.$raise($scope.get('TypeError'), "can't convert nil into Integer")
        }
        if (value.$$is_number) {
          if (value === Infinity || value === -Infinity || isNaN(value)) {
            self.$raise($scope.get('FloatDomainError'), value)
          }
          return Math.floor(value);
        }
        if (value['$respond_to?']("to_int")) {
          i = value.$to_int();
          if (i !== nil) {
            return i;
          }
        }
        return $scope.get('Opal')['$coerce_to!'](value, $scope.get('Integer'), "to_i");
      }

      if (base === undefined) {
        base = 0;
      } else {
        base = $scope.get('Opal').$coerce_to(base, $scope.get('Integer'), "to_int");
        if (base === 1 || base < 0 || base > 36) {
          self.$raise($scope.get('ArgumentError'), "invalid radix " + (base))
        }
      }

      str = value.toLowerCase();

      str = str.replace(/(\d)_(?=\d)/g, '$1');

      str = str.replace(/^(\s*[+-]?)(0[bodx]?)/, function (_, head, flag) {
        switch (flag) {
        case '0b':
          if (base === 0 || base === 2) {
            base = 2;
            return head;
          }
        case '0':
        case '0o':
          if (base === 0 || base === 8) {
            base = 8;
            return head;
          }
        case '0d':
          if (base === 0 || base === 10) {
            base = 10;
            return head;
          }
        case '0x':
          if (base === 0 || base === 16) {
            base = 16;
            return head;
          }
        }
        self.$raise($scope.get('ArgumentError'), "invalid value for Integer(): \"" + (value) + "\"")
      });

      base = (base === 0 ? 10 : base);

      base_digits = '0-' + (base <= 10 ? base - 1 : '9a-' + String.fromCharCode(97 + (base - 11)));

      if (!(new RegExp('^\\s*[+-]?[' + base_digits + ']+\\s*$')).test(str)) {
        self.$raise($scope.get('ArgumentError'), "invalid value for Integer(): \"" + (value) + "\"")
      }

      i = parseInt(str, base);

      if (isNaN(i)) {
        self.$raise($scope.get('ArgumentError'), "invalid value for Integer(): \"" + (value) + "\"")
      }

      return i;

    });

    Opal.defn(self, '$Float', function(value) {
      var self = this;

      
      var str;

      if (value === nil) {
        self.$raise($scope.get('TypeError'), "can't convert nil into Float")
      }

      if (value.$$is_string) {
        str = value.toString();

        str = str.replace(/(\d)_(?=\d)/g, '$1');

        //Special case for hex strings only:
        if (/^\s*[-+]?0[xX][0-9a-fA-F]+\s*$/.test(str)) {
          return self.$Integer(str);
        }

        if (!/^\s*[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?\s*$/.test(str)) {
          self.$raise($scope.get('ArgumentError'), "invalid value for Float(): \"" + (value) + "\"")
        }

        return parseFloat(str);
      }

      return $scope.get('Opal')['$coerce_to!'](value, $scope.get('Float'), "to_f");
    
    });

    Opal.defn(self, '$Hash', function(arg) {
      var $a, $b, self = this;

      if ((($a = ((($b = arg['$nil?']()) !== false && $b !== nil) ? $b : arg['$==']([]))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return $hash2([], {})}
      if ((($a = $scope.get('Hash')['$==='](arg)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return arg}
      return $scope.get('Opal')['$coerce_to!'](arg, $scope.get('Hash'), "to_hash");
    });

    Opal.defn(self, '$is_a?', function(klass) {
      var self = this;

      
      if (!klass.$$is_class && !klass.$$is_module) {
        self.$raise($scope.get('TypeError'), "class or module required");
      }

      return Opal.is_a(self, klass);

    });

    Opal.alias(self, 'kind_of?', 'is_a?');

    Opal.defn(self, '$lambda', TMP_6 = function() {
      var self = this, $iter = TMP_6.$$p, block = $iter || nil;

      TMP_6.$$p = null;
      block.$$is_lambda = true;
      return block;
    });

    Opal.defn(self, '$load', function(file) {
      var self = this;

      file = $scope.get('Opal')['$coerce_to!'](file, $scope.get('String'), "to_str");
      return Opal.load(file);
    });

    Opal.defn(self, '$loop', TMP_7 = function() {
      var self = this, $iter = TMP_7.$$p, block = $iter || nil;

      TMP_7.$$p = null;
      
      while (true) {
        if (block() === $breaker) {
          return $breaker.$v;
        }
      }
    
      return self;
    });

    Opal.defn(self, '$nil?', function() {
      var self = this;

      return false;
    });

    Opal.alias(self, 'object_id', '__id__');

    Opal.defn(self, '$printf', function() {
      var $a, self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      if ((($a = $rb_gt(args.$length(), 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$print(($a = self).$format.apply($a, Opal.to_a(args)))}
      return nil;
    });

    Opal.defn(self, '$proc', TMP_8 = function() {
      var self = this, $iter = TMP_8.$$p, block = $iter || nil;

      TMP_8.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        self.$raise($scope.get('ArgumentError'), "tried to create Proc object without a block")
      }
      block.$$is_lambda = false;
      return block;
    });

    Opal.defn(self, '$puts', function() {
      var $a, self = this, $splat_index = nil;
      if ($gvars.stdout == null) $gvars.stdout = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var strs = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        strs[$splat_index] = arguments[$splat_index + 0];
      }
      return ($a = $gvars.stdout).$puts.apply($a, Opal.to_a(strs));
    });

    Opal.defn(self, '$p', function() {
      var $a, $b, TMP_9, self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      ($a = ($b = args).$each, $a.$$p = (TMP_9 = function(obj){var self = TMP_9.$$s || this;
        if ($gvars.stdout == null) $gvars.stdout = nil;
if (obj == null) obj = nil;
      return $gvars.stdout.$puts(obj.$inspect())}, TMP_9.$$s = self, TMP_9), $a).call($b);
      if ((($a = $rb_le(args.$length(), 1)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return args['$[]'](0)
        } else {
        return args
      }
    });

    Opal.defn(self, '$print', function() {
      var $a, self = this, $splat_index = nil;
      if ($gvars.stdout == null) $gvars.stdout = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var strs = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        strs[$splat_index] = arguments[$splat_index + 0];
      }
      return ($a = $gvars.stdout).$print.apply($a, Opal.to_a(strs));
    });

    Opal.defn(self, '$warn', function() {
      var $a, $b, self = this, $splat_index = nil;
      if ($gvars.VERBOSE == null) $gvars.VERBOSE = nil;
      if ($gvars.stderr == null) $gvars.stderr = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var strs = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        strs[$splat_index] = arguments[$splat_index + 0];
      }
      if ((($a = ((($b = $gvars.VERBOSE['$nil?']()) !== false && $b !== nil) ? $b : strs['$empty?']())) !== nil && (!$a.$$is_boolean || $a == true))) {
        return nil
        } else {
        return ($a = $gvars.stderr).$puts.apply($a, Opal.to_a(strs))
      }
    });

    Opal.defn(self, '$raise', function(exception, string, _backtrace) {
      var self = this;
      if ($gvars["!"] == null) $gvars["!"] = nil;

      if (string == null) {
        string = nil
      }
      if (_backtrace == null) {
        _backtrace = nil
      }
      
      if (exception == null && $gvars["!"] !== nil) {
        throw $gvars["!"];
      }
      if (exception == null) {
        exception = $scope.get('RuntimeError').$new();
      }
      else if (exception.$$is_string) {
        exception = $scope.get('RuntimeError').$new(exception);
      }
      // using respond_to? and not an undefined check to avoid method_missing matching as true
      else if (exception.$$is_class && exception['$respond_to?']("exception")) {
        exception = exception.$exception(string);
      }
      else if (exception['$kind_of?']($scope.get('Exception'))) {
        // exception is fine
      }
      else {
        exception = $scope.get('TypeError').$new("exception class/object expected");
      }

      if ($gvars["!"] !== nil) {
        Opal.exceptions.push($gvars["!"]);
      }

      $gvars["!"] = exception;

      throw exception;

    });

    Opal.alias(self, 'fail', 'raise');

    Opal.defn(self, '$rand', function(max) {
      var self = this;

      
      if (max === undefined) {
        return Math.random();
      }
      else if (max.$$is_range) {
        var min = max.begin, range = max.end - min;
        if(!max.exclude) range++;

        return self.$rand(range) + min;
      }
      else {
        return Math.floor(Math.random() *
          Math.abs($scope.get('Opal').$coerce_to(max, $scope.get('Integer'), "to_int")));
      }
    
    });

    Opal.defn(self, '$respond_to?', function(name, include_all) {
      var $a, self = this;

      if (include_all == null) {
        include_all = false
      }
      if ((($a = self['$respond_to_missing?'](name, include_all)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return true}
      
      var body = self['$' + name];

      if (typeof(body) === "function" && !body.$$stub) {
        return true;
      }
    
      return false;
    });

    Opal.defn(self, '$respond_to_missing?', function(method_name, include_all) {
      var self = this;

      if (include_all == null) {
        include_all = false
      }
      return false;
    });

    Opal.defn(self, '$require', function(file) {
      var self = this;

      file = $scope.get('Opal')['$coerce_to!'](file, $scope.get('String'), "to_str");
      return Opal.require(file);
    });

    Opal.defn(self, '$require_relative', function(file) {
      var self = this;

      $scope.get('Opal')['$try_convert!'](file, $scope.get('String'), "to_str");
      file = $scope.get('File').$expand_path($scope.get('File').$join(Opal.current_file, "..", file));
      return Opal.require(file);
    });

    Opal.defn(self, '$require_tree', function(path) {
      var self = this;

      path = $scope.get('File').$expand_path(path);
      if (path['$=='](".")) {
        path = ""}
      
      for (var name in Opal.modules) {
        if ((name)['$start_with?'](path)) {
          Opal.require(name);
        }
      }

      return nil;
    });

    Opal.alias(self, 'send', '__send__');

    Opal.alias(self, 'public_send', '__send__');

    Opal.defn(self, '$singleton_class', function() {
      var self = this;

      return Opal.get_singleton_class(self);
    });

    Opal.defn(self, '$sleep', function(seconds) {
      var self = this;

      if (seconds == null) {
        seconds = nil
      }
      
      if (seconds === nil) {
        self.$raise($scope.get('TypeError'), "can't convert NilClass into time interval")
      }
      if (!seconds.$$is_number) {
        self.$raise($scope.get('TypeError'), "can't convert " + (seconds.$class()) + " into time interval")
      }
      if (seconds < 0) {
        self.$raise($scope.get('ArgumentError'), "time interval must be positive")
      }
      var t = new Date();
      while (new Date() - t <= seconds * 1000);
      return seconds;

    });

    Opal.alias(self, 'sprintf', 'format');

    Opal.alias(self, 'srand', 'rand');

    Opal.defn(self, '$String', function(str) {
      var $a, self = this;

      return ((($a = $scope.get('Opal')['$coerce_to?'](str, $scope.get('String'), "to_str")) !== false && $a !== nil) ? $a : $scope.get('Opal')['$coerce_to!'](str, $scope.get('String'), "to_s"));
    });

    Opal.defn(self, '$tap', TMP_10 = function() {
      var self = this, $iter = TMP_10.$$p, block = $iter || nil;

      TMP_10.$$p = null;
      if (Opal.yield1(block, self) === $breaker) return $breaker.$v;
      return self;
    });

    Opal.defn(self, '$to_proc', function() {
      var self = this;

      return self;
    });

    Opal.defn(self, '$to_s', function() {
      var self = this;

      return "#<" + (self.$class()) + ":0x" + (self.$__id__().$to_s(16)) + ">";
    });

    Opal.defn(self, '$catch', TMP_11 = function(sym) {
      var $a, self = this, $iter = TMP_11.$$p, $yield = $iter || nil, e = nil;

      TMP_11.$$p = null;
      try {
      return $a = Opal.yieldX($yield, []), $a === $breaker ? $a : $a
      } catch ($err) {if (Opal.rescue($err, [$scope.get('UncaughtThrowError')])) {e = $err;
        try {
          if (e.$sym()['$=='](sym)) {
            return e.$arg()}
          return self.$raise();
        } finally {
          Opal.gvars["!"] = Opal.exceptions.pop() || Opal.nil;
        }
        }else { throw $err; }
      }
    });

    Opal.defn(self, '$throw', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      return self.$raise($scope.get('UncaughtThrowError').$new(args));
    });
  })($scope.base);
  return (function($base, $super) {
    function $Object(){}
    var self = $Object = $klass($base, $super, 'Object', $Object);

    var def = self.$$proto, $scope = self.$$scope;

    return self.$include($scope.get('Kernel'))
  })($scope.base, null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/error"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $module = Opal.module;

  Opal.add_stubs(['$new', '$clone', '$to_s', '$empty?', '$class', '$attr_reader', '$[]', '$>', '$length', '$inspect']);
  (function($base, $super) {
    function $Exception(){}
    var self = $Exception = $klass($base, $super, 'Exception', $Exception);

    var def = self.$$proto, $scope = self.$$scope;

    def.message = nil;
    Opal.defs(self, '$new', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      
      var message = (args.length > 0) ? args[0] : nil;
      var err = new self.$$alloc(message);

      if (Error.captureStackTrace) {
        Error.captureStackTrace(err);
      }

      err.name = self.$$name;
      err.$initialize.apply(err, args);
      return err;
    
    });

    Opal.defs(self, '$exception', function() {
      var $a, self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      return ($a = self).$new.apply($a, Opal.to_a(args));
    });

    Opal.defn(self, '$initialize', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      return self.message = (args.length > 0) ? args[0] : nil;
    });

    Opal.defn(self, '$backtrace', function() {
      var self = this;

      
      var backtrace = self.stack;

      if (typeof(backtrace) === 'string') {
        return backtrace.split("\n").slice(0, 15);
      }
      else if (backtrace) {
        return backtrace.slice(0, 15);
      }

      return [];
    
    });

    Opal.defn(self, '$exception', function(str) {
      var self = this;

      if (str == null) {
        str = nil
      }
      
      if (str === nil || self === str) {
        return self;
      }
      
      var cloned = self.$clone();
      cloned.message = str;
      return cloned;
    
    });

    Opal.defn(self, '$message', function() {
      var self = this;

      return self.$to_s();
    });

    Opal.defn(self, '$inspect', function() {
      var $a, self = this, as_str = nil;

      as_str = self.$to_s();
      if ((($a = as_str['$empty?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$class().$to_s()
        } else {
        return "#<" + (self.$class().$to_s()) + ": " + (self.$to_s()) + ">"
      }
    });

    return (Opal.defn(self, '$to_s', function() {
      var $a, $b, self = this;

      return ((($a = (($b = self.message, $b !== false && $b !== nil ?self.message.$to_s() : $b))) !== false && $a !== nil) ? $a : self.$class().$to_s());
    }), nil) && 'to_s';
  })($scope.base, Error);
  (function($base, $super) {
    function $ScriptError(){}
    var self = $ScriptError = $klass($base, $super, 'ScriptError', $ScriptError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('Exception'));
  (function($base, $super) {
    function $SyntaxError(){}
    var self = $SyntaxError = $klass($base, $super, 'SyntaxError', $SyntaxError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('ScriptError'));
  (function($base, $super) {
    function $LoadError(){}
    var self = $LoadError = $klass($base, $super, 'LoadError', $LoadError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('ScriptError'));
  (function($base, $super) {
    function $NotImplementedError(){}
    var self = $NotImplementedError = $klass($base, $super, 'NotImplementedError', $NotImplementedError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('ScriptError'));
  (function($base, $super) {
    function $SystemExit(){}
    var self = $SystemExit = $klass($base, $super, 'SystemExit', $SystemExit);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('Exception'));
  (function($base, $super) {
    function $NoMemoryError(){}
    var self = $NoMemoryError = $klass($base, $super, 'NoMemoryError', $NoMemoryError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('Exception'));
  (function($base, $super) {
    function $SignalException(){}
    var self = $SignalException = $klass($base, $super, 'SignalException', $SignalException);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('Exception'));
  (function($base, $super) {
    function $Interrupt(){}
    var self = $Interrupt = $klass($base, $super, 'Interrupt', $Interrupt);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('Exception'));
  (function($base, $super) {
    function $SecurityError(){}
    var self = $SecurityError = $klass($base, $super, 'SecurityError', $SecurityError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('Exception'));
  (function($base, $super) {
    function $StandardError(){}
    var self = $StandardError = $klass($base, $super, 'StandardError', $StandardError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('Exception'));
  (function($base, $super) {
    function $ZeroDivisionError(){}
    var self = $ZeroDivisionError = $klass($base, $super, 'ZeroDivisionError', $ZeroDivisionError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('StandardError'));
  (function($base, $super) {
    function $NameError(){}
    var self = $NameError = $klass($base, $super, 'NameError', $NameError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('StandardError'));
  (function($base, $super) {
    function $NoMethodError(){}
    var self = $NoMethodError = $klass($base, $super, 'NoMethodError', $NoMethodError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('NameError'));
  (function($base, $super) {
    function $RuntimeError(){}
    var self = $RuntimeError = $klass($base, $super, 'RuntimeError', $RuntimeError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('StandardError'));
  (function($base, $super) {
    function $LocalJumpError(){}
    var self = $LocalJumpError = $klass($base, $super, 'LocalJumpError', $LocalJumpError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('StandardError'));
  (function($base, $super) {
    function $TypeError(){}
    var self = $TypeError = $klass($base, $super, 'TypeError', $TypeError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('StandardError'));
  (function($base, $super) {
    function $ArgumentError(){}
    var self = $ArgumentError = $klass($base, $super, 'ArgumentError', $ArgumentError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('StandardError'));
  (function($base, $super) {
    function $IndexError(){}
    var self = $IndexError = $klass($base, $super, 'IndexError', $IndexError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('StandardError'));
  (function($base, $super) {
    function $StopIteration(){}
    var self = $StopIteration = $klass($base, $super, 'StopIteration', $StopIteration);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('IndexError'));
  (function($base, $super) {
    function $KeyError(){}
    var self = $KeyError = $klass($base, $super, 'KeyError', $KeyError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('IndexError'));
  (function($base, $super) {
    function $RangeError(){}
    var self = $RangeError = $klass($base, $super, 'RangeError', $RangeError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('StandardError'));
  (function($base, $super) {
    function $FloatDomainError(){}
    var self = $FloatDomainError = $klass($base, $super, 'FloatDomainError', $FloatDomainError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('RangeError'));
  (function($base, $super) {
    function $IOError(){}
    var self = $IOError = $klass($base, $super, 'IOError', $IOError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('StandardError'));
  (function($base, $super) {
    function $SystemCallError(){}
    var self = $SystemCallError = $klass($base, $super, 'SystemCallError', $SystemCallError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('StandardError'));
  (function($base) {
    var $Errno, self = $Errno = $module($base, 'Errno');

    var def = self.$$proto, $scope = self.$$scope;

    (function($base, $super) {
      function $EINVAL(){}
      var self = $EINVAL = $klass($base, $super, 'EINVAL', $EINVAL);

      var def = self.$$proto, $scope = self.$$scope, TMP_1;

      return (Opal.defs(self, '$new', TMP_1 = function() {
        var self = this, $iter = TMP_1.$$p, $yield = $iter || nil;

        TMP_1.$$p = null;
        return Opal.find_super_dispatcher(self, 'new', TMP_1, null, $EINVAL).apply(self, ["Invalid argument"]);
      }), nil) && 'new'
    })($scope.base, $scope.get('SystemCallError'))
  })($scope.base);
  (function($base, $super) {
    function $UncaughtThrowError(){}
    var self = $UncaughtThrowError = $klass($base, $super, 'UncaughtThrowError', $UncaughtThrowError);

    var def = self.$$proto, $scope = self.$$scope, TMP_2;

    def.sym = nil;
    self.$attr_reader("sym", "arg");

    return (Opal.defn(self, '$initialize', TMP_2 = function(args) {
      var $a, self = this, $iter = TMP_2.$$p, $yield = $iter || nil;

      TMP_2.$$p = null;
      self.sym = args['$[]'](0);
      if ((($a = $rb_gt(args.$length(), 1)) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.arg = args['$[]'](1)}
      return Opal.find_super_dispatcher(self, 'initialize', TMP_2, null).apply(self, ["uncaught throw " + (self.sym.$inspect())]);
    }), nil) && 'initialize';
  })($scope.base, $scope.get('ArgumentError'));
  (function($base, $super) {
    function $NameError(){}
    var self = $NameError = $klass($base, $super, 'NameError', $NameError);

    var def = self.$$proto, $scope = self.$$scope, TMP_3;

    self.$attr_reader("name");

    return (Opal.defn(self, '$initialize', TMP_3 = function(message, name) {
      var self = this, $iter = TMP_3.$$p, $yield = $iter || nil;

      if (name == null) {
        name = nil
      }
      TMP_3.$$p = null;
      Opal.find_super_dispatcher(self, 'initialize', TMP_3, null).apply(self, [message]);
      return self.name = name;
    }), nil) && 'initialize';
  })($scope.base, null);
  return (function($base, $super) {
    function $NoMethodError(){}
    var self = $NoMethodError = $klass($base, $super, 'NoMethodError', $NoMethodError);

    var def = self.$$proto, $scope = self.$$scope, TMP_4;

    self.$attr_reader("args");

    return (Opal.defn(self, '$initialize', TMP_4 = function(message, name, args) {
      var self = this, $iter = TMP_4.$$p, $yield = $iter || nil;

      if (args == null) {
        args = []
      }
      TMP_4.$$p = null;
      Opal.find_super_dispatcher(self, 'initialize', TMP_4, null).apply(self, [message, name]);
      return self.args = args;
    }), nil) && 'initialize';
  })($scope.base, null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/constants"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice;

  Opal.cdecl($scope, 'RUBY_PLATFORM', "opal");
  Opal.cdecl($scope, 'RUBY_ENGINE', "opal");
  Opal.cdecl($scope, 'RUBY_VERSION', "2.2.3");
  Opal.cdecl($scope, 'RUBY_ENGINE_VERSION', "0.9.2");
  Opal.cdecl($scope, 'RUBY_RELEASE_DATE', "2016-01-10");
  Opal.cdecl($scope, 'RUBY_PATCHLEVEL', 0);
  Opal.cdecl($scope, 'RUBY_REVISION', 0);
  Opal.cdecl($scope, 'RUBY_COPYRIGHT', "opal - Copyright (C) 2013-2015 Adam Beynon");
  return Opal.cdecl($scope, 'RUBY_DESCRIPTION', "opal " + ($scope.get('RUBY_ENGINE_VERSION')) + " (" + ($scope.get('RUBY_RELEASE_DATE')) + " revision " + ($scope.get('RUBY_REVISION')) + ")");
};

/* Generated by Opal 0.9.2 */
Opal.modules["opal/base"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice;

  Opal.add_stubs(['$require']);
  self.$require("corelib/runtime");
  self.$require("corelib/helpers");
  self.$require("corelib/module");
  self.$require("corelib/class");
  self.$require("corelib/basic_object");
  self.$require("corelib/kernel");
  self.$require("corelib/error");
  return self.$require("corelib/constants");
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/nil"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$raise', '$class', '$new', '$>', '$length', '$Rational']);
  (function($base, $super) {
    function $NilClass(){}
    var self = $NilClass = $klass($base, $super, 'NilClass', $NilClass);

    var def = self.$$proto, $scope = self.$$scope;

    def.$$meta = self;

    Opal.defn(self, '$!', function() {
      var self = this;

      return true;
    });

    Opal.defn(self, '$&', function(other) {
      var self = this;

      return false;
    });

    Opal.defn(self, '$|', function(other) {
      var self = this;

      return other !== false && other !== nil;
    });

    Opal.defn(self, '$^', function(other) {
      var self = this;

      return other !== false && other !== nil;
    });

    Opal.defn(self, '$==', function(other) {
      var self = this;

      return other === nil;
    });

    Opal.defn(self, '$dup', function() {
      var self = this;

      return self.$raise($scope.get('TypeError'), "can't dup " + (self.$class()));
    });

    Opal.defn(self, '$clone', function() {
      var self = this;

      return self.$raise($scope.get('TypeError'), "can't clone " + (self.$class()));
    });

    Opal.defn(self, '$inspect', function() {
      var self = this;

      return "nil";
    });

    Opal.defn(self, '$nil?', function() {
      var self = this;

      return true;
    });

    Opal.defn(self, '$singleton_class', function() {
      var self = this;

      return $scope.get('NilClass');
    });

    Opal.defn(self, '$to_a', function() {
      var self = this;

      return [];
    });

    Opal.defn(self, '$to_h', function() {
      var self = this;

      return Opal.hash();
    });

    Opal.defn(self, '$to_i', function() {
      var self = this;

      return 0;
    });

    Opal.alias(self, 'to_f', 'to_i');

    Opal.defn(self, '$to_s', function() {
      var self = this;

      return "";
    });

    Opal.defn(self, '$to_c', function() {
      var self = this;

      return $scope.get('Complex').$new(0, 0);
    });

    Opal.defn(self, '$rationalize', function() {
      var $a, self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      if ((($a = $rb_gt(args.$length(), 1)) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'))}
      return self.$Rational(0, 1);
    });

    Opal.defn(self, '$to_r', function() {
      var self = this;

      return self.$Rational(0, 1);
    });

    return (Opal.defn(self, '$instance_variables', function() {
      var self = this;

      return [];
    }), nil) && 'instance_variables';
  })($scope.base, null);
  return Opal.cdecl($scope, 'NIL', nil);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/boolean"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$raise', '$class']);
  (function($base, $super) {
    function $Boolean(){}
    var self = $Boolean = $klass($base, $super, 'Boolean', $Boolean);

    var def = self.$$proto, $scope = self.$$scope;

    def.$$is_boolean = true;

    def.$$meta = self;

    Opal.defn(self, '$__id__', function() {
      var self = this;

      return self.valueOf() ? 2 : 0;
    });

    Opal.alias(self, 'object_id', '__id__');

    Opal.defn(self, '$!', function() {
      var self = this;

      return self != true;
    });

    Opal.defn(self, '$&', function(other) {
      var self = this;

      return (self == true) ? (other !== false && other !== nil) : false;
    });

    Opal.defn(self, '$|', function(other) {
      var self = this;

      return (self == true) ? true : (other !== false && other !== nil);
    });

    Opal.defn(self, '$^', function(other) {
      var self = this;

      return (self == true) ? (other === false || other === nil) : (other !== false && other !== nil);
    });

    Opal.defn(self, '$==', function(other) {
      var self = this;

      return (self == true) === other.valueOf();
    });

    Opal.alias(self, 'equal?', '==');

    Opal.alias(self, 'eql?', '==');

    Opal.defn(self, '$singleton_class', function() {
      var self = this;

      return $scope.get('Boolean');
    });

    Opal.defn(self, '$to_s', function() {
      var self = this;

      return (self == true) ? 'true' : 'false';
    });

    Opal.defn(self, '$dup', function() {
      var self = this;

      return self.$raise($scope.get('TypeError'), "can't dup " + (self.$class()));
    });

    return (Opal.defn(self, '$clone', function() {
      var self = this;

      return self.$raise($scope.get('TypeError'), "can't clone " + (self.$class()));
    }), nil) && 'clone';
  })($scope.base, Boolean);
  Opal.cdecl($scope, 'TrueClass', $scope.get('Boolean'));
  Opal.cdecl($scope, 'FalseClass', $scope.get('Boolean'));
  Opal.cdecl($scope, 'TRUE', true);
  return Opal.cdecl($scope, 'FALSE', false);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/comparable"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module;

  Opal.add_stubs(['$===', '$>', '$<', '$equal?', '$<=>', '$normalize', '$raise', '$class']);
  return (function($base) {
    var $Comparable, self = $Comparable = $module($base, 'Comparable');

    var def = self.$$proto, $scope = self.$$scope;

    Opal.defs(self, '$normalize', function(what) {
      var $a, self = this;

      if ((($a = $scope.get('Integer')['$==='](what)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return what}
      if ((($a = $rb_gt(what, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return 1}
      if ((($a = $rb_lt(what, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return -1}
      return 0;
    });

    Opal.defn(self, '$==', function(other) {
      var $a, self = this, cmp = nil;

      try {
      if ((($a = self['$equal?'](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
          return true}
        
      if (self["$<=>"] == Opal.Kernel["$<=>"]) {
        return false;
      }

      // check for infinite recursion
      if (self.$$comparable) {
        delete self.$$comparable;
        return false;
      }
    
        if ((($a = cmp = (self['$<=>'](other))) !== nil && (!$a.$$is_boolean || $a == true))) {
          } else {
          return false
        }
        return $scope.get('Comparable').$normalize(cmp) == 0;
      } catch ($err) {if (Opal.rescue($err, [$scope.get('StandardError')])) {
        try {
          return false
        } finally {
          Opal.gvars["!"] = Opal.exceptions.pop() || Opal.nil;
        }
        }else { throw $err; }
      }
    });

    Opal.defn(self, '$>', function(other) {
      var $a, self = this, cmp = nil;

      if ((($a = cmp = (self['$<=>'](other))) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('ArgumentError'), "comparison of " + (self.$class()) + " with " + (other.$class()) + " failed")
      }
      return $scope.get('Comparable').$normalize(cmp) > 0;
    });

    Opal.defn(self, '$>=', function(other) {
      var $a, self = this, cmp = nil;

      if ((($a = cmp = (self['$<=>'](other))) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('ArgumentError'), "comparison of " + (self.$class()) + " with " + (other.$class()) + " failed")
      }
      return $scope.get('Comparable').$normalize(cmp) >= 0;
    });

    Opal.defn(self, '$<', function(other) {
      var $a, self = this, cmp = nil;

      if ((($a = cmp = (self['$<=>'](other))) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('ArgumentError'), "comparison of " + (self.$class()) + " with " + (other.$class()) + " failed")
      }
      return $scope.get('Comparable').$normalize(cmp) < 0;
    });

    Opal.defn(self, '$<=', function(other) {
      var $a, self = this, cmp = nil;

      if ((($a = cmp = (self['$<=>'](other))) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('ArgumentError'), "comparison of " + (self.$class()) + " with " + (other.$class()) + " failed")
      }
      return $scope.get('Comparable').$normalize(cmp) <= 0;
    });

    Opal.defn(self, '$between?', function(min, max) {
      var self = this;

      if ($rb_lt(self, min)) {
        return false}
      if ($rb_gt(self, max)) {
        return false}
      return true;
    });
  })($scope.base)
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/regexp"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $gvars = Opal.gvars;

  Opal.add_stubs(['$nil?', '$[]', '$raise', '$escape', '$options', '$to_str', '$new', '$join', '$coerce_to!', '$!', '$match', '$coerce_to?', '$begin', '$coerce_to', '$call', '$=~', '$attr_reader', '$===', '$inspect', '$to_a']);
  (function($base, $super) {
    function $RegexpError(){}
    var self = $RegexpError = $klass($base, $super, 'RegexpError', $RegexpError);

    var def = self.$$proto, $scope = self.$$scope;

    return nil;
  })($scope.base, $scope.get('StandardError'));
  (function($base, $super) {
    function $Regexp(){}
    var self = $Regexp = $klass($base, $super, 'Regexp', $Regexp);

    var def = self.$$proto, $scope = self.$$scope, TMP_2;

    Opal.cdecl($scope, 'IGNORECASE', 1);

    Opal.cdecl($scope, 'MULTILINE', 4);

    def.$$is_regexp = true;

    (function(self) {
      var $scope = self.$$scope, def = self.$$proto, TMP_1;

      Opal.defn(self, '$allocate', TMP_1 = function() {
        var self = this, $iter = TMP_1.$$p, $yield = $iter || nil, allocated = nil, $zuper = nil, $zuper_index = nil;

        TMP_1.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        allocated = Opal.find_super_dispatcher(self, 'allocate', TMP_1, $iter).apply(self, $zuper);
        allocated.uninitialized = true;
        return allocated;
      });
      Opal.defn(self, '$escape', function(string) {
        var self = this;

        
        return string.replace(/([-[\]\/{}()*+?.^$\\| ])/g, '\\$1')
                     .replace(/[\n]/g, '\\n')
                     .replace(/[\r]/g, '\\r')
                     .replace(/[\f]/g, '\\f')
                     .replace(/[\t]/g, '\\t');
      
      });
      Opal.defn(self, '$last_match', function(n) {
        var $a, self = this;
        if ($gvars["~"] == null) $gvars["~"] = nil;

        if (n == null) {
          n = nil
        }
        if ((($a = n['$nil?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
          return $gvars["~"]
          } else {
          return $gvars["~"]['$[]'](n)
        }
      });
      Opal.alias(self, 'quote', 'escape');
      Opal.defn(self, '$union', function() {
        var self = this, $splat_index = nil;

        var array_size = arguments.length - 0;
        if(array_size < 0) array_size = 0;
        var parts = new Array(array_size);
        for($splat_index = 0; $splat_index < array_size; $splat_index++) {
          parts[$splat_index] = arguments[$splat_index + 0];
        }
        
        var is_first_part_array, quoted_validated, part, options, each_part_options;
        if (parts.length == 0) {
          return /(?!)/;
        }
        // cover the 2 arrays passed as arguments case
        is_first_part_array = parts[0].$$is_array;
        if (parts.length > 1 && is_first_part_array) {
          self.$raise($scope.get('TypeError'), "no implicit conversion of Array into String")
        }        
        // deal with splat issues (related to https://github.com/opal/opal/issues/858)
        if (is_first_part_array) {
          parts = parts[0];
        }
        options = undefined;
        quoted_validated = [];
        for (var i=0; i < parts.length; i++) {
          part = parts[i];
          if (part.$$is_string) {
            quoted_validated.push(self.$escape(part));
          }
          else if (part.$$is_regexp) {
            each_part_options = (part).$options();
            if (options != undefined && options != each_part_options) {
              self.$raise($scope.get('TypeError'), "All expressions must use the same options")
            }
            options = each_part_options;
            quoted_validated.push('('+part.source+')');
          }
          else {
            quoted_validated.push(self.$escape((part).$to_str()));
          }
        }
      
        return self.$new((quoted_validated).$join("|"), options);
      });
      return (Opal.defn(self, '$new', function(regexp, options) {
        var self = this;

        
        if (regexp.$$is_regexp) {
          return new RegExp(regexp);
        }

        regexp = $scope.get('Opal')['$coerce_to!'](regexp, $scope.get('String'), "to_str");

        if (regexp.charAt(regexp.length - 1) === '\\') {
          self.$raise($scope.get('RegexpError'), "too short escape sequence: /" + (regexp) + "/")
        }

        if (options === undefined || options['$!']()) {
          return new RegExp(regexp);
        }

        if (options.$$is_number) {
          var temp = '';
          if ($scope.get('IGNORECASE') & options) { temp += 'i'; }
          if ($scope.get('MULTILINE')  & options) { temp += 'm'; }
          options = temp;
        }
        else {
          options = 'i';
        }

        return new RegExp(regexp, options);

      }), nil) && 'new';
    })(Opal.get_singleton_class(self));

    Opal.defn(self, '$==', function(other) {
      var self = this;

      return other.constructor == RegExp && self.toString() === other.toString();
    });

    Opal.defn(self, '$===', function(string) {
      var self = this;

      return self.$match($scope.get('Opal')['$coerce_to?'](string, $scope.get('String'), "to_str")) !== nil;
    });

    Opal.defn(self, '$=~', function(string) {
      var $a, self = this;
      if ($gvars["~"] == null) $gvars["~"] = nil;

      return ($a = self.$match(string), $a !== false && $a !== nil ?$gvars["~"].$begin(0) : $a);
    });

    Opal.alias(self, 'eql?', '==');

    Opal.defn(self, '$inspect', function() {
      var self = this;

      return self.toString();
    });

    Opal.defn(self, '$match', TMP_2 = function(string, pos) {
      var self = this, $iter = TMP_2.$$p, block = $iter || nil;
      if ($gvars["~"] == null) $gvars["~"] = nil;

      TMP_2.$$p = null;
      
      if (self.uninitialized) {
        self.$raise($scope.get('TypeError'), "uninitialized Regexp")
      }

      if (pos === undefined) {
        pos = 0;
      } else {
        pos = $scope.get('Opal').$coerce_to(pos, $scope.get('Integer'), "to_int");
      }

      if (string === nil) {
        return $gvars["~"] = nil;
      }

      string = $scope.get('Opal').$coerce_to(string, $scope.get('String'), "to_str");

      if (pos < 0) {
        pos += string.length;
        if (pos < 0) {
          return $gvars["~"] = nil;
        }
      }

      var source = self.source;
      var flags = 'g';
      // m flag + a . in Ruby will match white space, but in JS, it only matches beginning/ending of lines, so we get the equivalent here
      if (self.multiline) {
        source = source.replace('.', "[\\s\\S]");
        flags += 'm';
      }

      // global RegExp maintains state, so not using self/this
      var md, re = new RegExp(source, flags + (self.ignoreCase ? 'i' : ''));

      while (true) {
        md = re.exec(string);
        if (md === null) {
          return $gvars["~"] = nil;
        }
        if (md.index >= pos) {
          $gvars["~"] = $scope.get('MatchData').$new(re, md)
          return block === nil ? $gvars["~"] : block.$call($gvars["~"]);
        }
        re.lastIndex = md.index + 1;
      }

    });

    Opal.defn(self, '$~', function() {
      var self = this;
      if ($gvars._ == null) $gvars._ = nil;

      return self['$=~']($gvars._);
    });

    Opal.defn(self, '$source', function() {
      var self = this;

      return self.source;
    });

    Opal.defn(self, '$options', function() {
      var self = this;

      
      if (self.uninitialized) {
        self.$raise($scope.get('TypeError'), "uninitialized Regexp")
      }
      var result = 0;
      // should be supported in IE6 according to https://msdn.microsoft.com/en-us/library/7f5z26w4(v=vs.94).aspx
      if (self.multiline) {
        result |= $scope.get('MULTILINE');
      }
      if (self.ignoreCase) {
        result |= $scope.get('IGNORECASE');
      }
      return result;

    });

    Opal.defn(self, '$casefold?', function() {
      var self = this;

      return self.ignoreCase;
    });

    return Opal.alias(self, 'to_s', 'source');
  })($scope.base, RegExp);
  return (function($base, $super) {
    function $MatchData(){}
    var self = $MatchData = $klass($base, $super, 'MatchData', $MatchData);

    var def = self.$$proto, $scope = self.$$scope;

    def.matches = nil;
    self.$attr_reader("post_match", "pre_match", "regexp", "string");

    Opal.defn(self, '$initialize', function(regexp, match_groups) {
      var self = this;

      $gvars["~"] = self;
      self.regexp = regexp;
      self.begin = match_groups.index;
      self.string = match_groups.input;
      self.pre_match = match_groups.input.slice(0, match_groups.index);
      self.post_match = match_groups.input.slice(match_groups.index + match_groups[0].length);
      self.matches = [];
      
      for (var i = 0, length = match_groups.length; i < length; i++) {
        var group = match_groups[i];

        if (group == null) {
          self.matches.push(nil);
        }
        else {
          self.matches.push(group);
        }
      }
    
    });

    Opal.defn(self, '$[]', function() {
      var $a, self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      return ($a = self.matches)['$[]'].apply($a, Opal.to_a(args));
    });

    Opal.defn(self, '$offset', function(n) {
      var self = this;

      
      if (n !== 0) {
        self.$raise($scope.get('ArgumentError'), "MatchData#offset only supports 0th element")
      }
      return [self.begin, self.begin + self.matches[n].length];

    });

    Opal.defn(self, '$==', function(other) {
      var $a, $b, $c, $d, self = this;

      if ((($a = $scope.get('MatchData')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        return false
      }
      return ($a = ($b = ($c = ($d = self.string == other.string, $d !== false && $d !== nil ?self.regexp.toString() == other.regexp.toString() : $d), $c !== false && $c !== nil ?self.pre_match == other.pre_match : $c), $b !== false && $b !== nil ?self.post_match == other.post_match : $b), $a !== false && $a !== nil ?self.begin == other.begin : $a);
    });

    Opal.alias(self, 'eql?', '==');

    Opal.defn(self, '$begin', function(n) {
      var self = this;

      
      if (n !== 0) {
        self.$raise($scope.get('ArgumentError'), "MatchData#begin only supports 0th element")
      }
      return self.begin;

    });

    Opal.defn(self, '$end', function(n) {
      var self = this;

      
      if (n !== 0) {
        self.$raise($scope.get('ArgumentError'), "MatchData#end only supports 0th element")
      }
      return self.begin + self.matches[n].length;

    });

    Opal.defn(self, '$captures', function() {
      var self = this;

      return self.matches.slice(1);
    });

    Opal.defn(self, '$inspect', function() {
      var self = this;

      
      var str = "#<MatchData " + (self.matches[0]).$inspect();

      for (var i = 1, length = self.matches.length; i < length; i++) {
        str += " " + i + ":" + (self.matches[i]).$inspect();
      }

      return str + ">";

    });

    Opal.defn(self, '$length', function() {
      var self = this;

      return self.matches.length;
    });

    Opal.alias(self, 'size', 'length');

    Opal.defn(self, '$to_a', function() {
      var self = this;

      return self.matches;
    });

    Opal.defn(self, '$to_s', function() {
      var self = this;

      return self.matches[0];
    });

    return (Opal.defn(self, '$values_at', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      
      var i, a, index, values = [];

      for (i = 0; i < args.length; i++) {

        if (args[i].$$is_range) {
          a = (args[i]).$to_a();
          a.unshift(i, 1);
          Array.prototype.splice.apply(args, a);
        }

        index = $scope.get('Opal')['$coerce_to!'](args[i], $scope.get('Integer'), "to_int");

        if (index < 0) {
          index += self.matches.length;
          if (index < 0) {
            values.push(nil);
            continue;
          }
        }

        values.push(self.matches[index]);
      }

      return values;
    
    }), nil) && 'values_at';
  })($scope.base, null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/string"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $gvars = Opal.gvars;

  Opal.add_stubs(['$require', '$include', '$coerce_to?', '$coerce_to', '$raise', '$===', '$format', '$to_s', '$respond_to?', '$to_str', '$<=>', '$==', '$=~', '$new', '$empty?', '$ljust', '$ceil', '$/', '$+', '$rjust', '$floor', '$to_a', '$each_char', '$to_proc', '$coerce_to!', '$copy_singleton_methods', '$initialize_clone', '$initialize_dup', '$enum_for', '$size', '$chomp', '$[]', '$to_i', '$class', '$each_line', '$match', '$captures', '$proc', '$shift', '$__send__', '$succ', '$escape']);
  self.$require("corelib/comparable");
  self.$require("corelib/regexp");
  (function($base, $super) {
    function $String(){}
    var self = $String = $klass($base, $super, 'String', $String);

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_11;

    def.length = nil;
    self.$include($scope.get('Comparable'));

    def.$$is_string = true;

    Opal.defn(self, '$__id__', function() {
      var self = this;

      return self.toString();
    });

    Opal.alias(self, 'object_id', '__id__');

    Opal.defs(self, '$try_convert', function(what) {
      var self = this;

      return $scope.get('Opal')['$coerce_to?'](what, $scope.get('String'), "to_str");
    });

    Opal.defs(self, '$new', function(str) {
      var self = this;

      if (str == null) {
        str = ""
      }
      str = $scope.get('Opal').$coerce_to(str, $scope.get('String'), "to_str");
      return String(str);
    });

    Opal.defn(self, '$initialize', function(str) {
      var self = this;

      
      if (str === undefined) {
        return self;
      }
    
      return self.$raise($scope.get('NotImplementedError'), "Mutable strings are not supported in Opal.");
    });

    Opal.defn(self, '$%', function(data) {
      var $a, self = this;

      if ((($a = $scope.get('Array')['$==='](data)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return ($a = self).$format.apply($a, [self].concat(Opal.to_a(data)))
        } else {
        return self.$format(self, data)
      }
    });

    Opal.defn(self, '$*', function(count) {
      var self = this;

      
      count = $scope.get('Opal').$coerce_to(count, $scope.get('Integer'), "to_int");

      if (count < 0) {
        self.$raise($scope.get('ArgumentError'), "negative argument")
      }

      if (count === 0) {
        return '';
      }

      var result = '',
          string = self.toString();

      // All credit for the bit-twiddling magic code below goes to Mozilla
      // polyfill implementation of String.prototype.repeat() posted here:
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/repeat

      if (string.length * count >= 1 << 28) {
        self.$raise($scope.get('RangeError'), "multiply count must not overflow maximum string size")
      }

      for (;;) {
        if ((count & 1) === 1) {
          result += string;
        }
        count >>>= 1;
        if (count === 0) {
          break;
        }
        string += string;
      }

      return result;

    });

    Opal.defn(self, '$+', function(other) {
      var self = this;

      other = $scope.get('Opal').$coerce_to(other, $scope.get('String'), "to_str");
      return self + other.$to_s();
    });

    Opal.defn(self, '$<=>', function(other) {
      var $a, self = this;

      if ((($a = other['$respond_to?']("to_str")) !== nil && (!$a.$$is_boolean || $a == true))) {
        other = other.$to_str().$to_s();
        return self > other ? 1 : (self < other ? -1 : 0);
        } else {
        
        var cmp = other['$<=>'](self);

        if (cmp === nil) {
          return nil;
        }
        else {
          return cmp > 0 ? -1 : (cmp < 0 ? 1 : 0);
        }

      }
    });

    Opal.defn(self, '$==', function(other) {
      var self = this;

      
      if (other.$$is_string) {
        return self.toString() === other.toString();
      }
      if ($scope.get('Opal')['$respond_to?'](other, "to_str")) {
        return other['$=='](self);
      }
      return false;

    });

    Opal.alias(self, 'eql?', '==');

    Opal.alias(self, '===', '==');

    Opal.defn(self, '$=~', function(other) {
      var self = this;

      
      if (other.$$is_string) {
        self.$raise($scope.get('TypeError'), "type mismatch: String given");
      }

      return other['$=~'](self);

    });

    Opal.defn(self, '$[]', function(index, length) {
      var self = this;

      
      var size = self.length, exclude;

      if (index.$$is_range) {
        exclude = index.exclude;
        length  = $scope.get('Opal').$coerce_to(index.end, $scope.get('Integer'), "to_int");
        index   = $scope.get('Opal').$coerce_to(index.begin, $scope.get('Integer'), "to_int");

        if (Math.abs(index) > size) {
          return nil;
        }

        if (index < 0) {
          index += size;
        }

        if (length < 0) {
          length += size;
        }

        if (!exclude) {
          length += 1;
        }

        length = length - index;

        if (length < 0) {
          length = 0;
        }

        return self.substr(index, length);
      }


      if (index.$$is_string) {
        if (length != null) {
          self.$raise($scope.get('TypeError'))
        }
        return self.indexOf(index) !== -1 ? index : nil;
      }


      if (index.$$is_regexp) {
        var match = self.match(index);

        if (match === null) {
          $gvars["~"] = nil
          return nil;
        }

        $gvars["~"] = $scope.get('MatchData').$new(index, match)

        if (length == null) {
          return match[0];
        }

        length = $scope.get('Opal').$coerce_to(length, $scope.get('Integer'), "to_int");

        if (length < 0 && -length < match.length) {
          return match[length += match.length];
        }

        if (length >= 0 && length < match.length) {
          return match[length];
        }

        return nil;
      }


      index = $scope.get('Opal').$coerce_to(index, $scope.get('Integer'), "to_int");

      if (index < 0) {
        index += size;
      }

      if (length == null) {
        if (index >= size || index < 0) {
          return nil;
        }
        return self.substr(index, 1);
      }

      length = $scope.get('Opal').$coerce_to(length, $scope.get('Integer'), "to_int");

      if (length < 0) {
        return nil;
      }

      if (index > size || index < 0) {
        return nil;
      }

      return self.substr(index, length);
    
    });

    Opal.alias(self, 'byteslice', '[]');

    Opal.defn(self, '$capitalize', function() {
      var self = this;

      return self.charAt(0).toUpperCase() + self.substr(1).toLowerCase();
    });

    Opal.defn(self, '$casecmp', function(other) {
      var self = this;

      other = $scope.get('Opal').$coerce_to(other, $scope.get('String'), "to_str").$to_s();
      
      var ascii_only = /^[\x00-\x7F]*$/;
      if (ascii_only.test(self) && ascii_only.test(other)) {
        self = self.toLowerCase();
        other = other.toLowerCase();
      }
    
      return self['$<=>'](other);
    });

    Opal.defn(self, '$center', function(width, padstr) {
      var $a, self = this;

      if (padstr == null) {
        padstr = " "
      }
      width = $scope.get('Opal').$coerce_to(width, $scope.get('Integer'), "to_int");
      padstr = $scope.get('Opal').$coerce_to(padstr, $scope.get('String'), "to_str").$to_s();
      if ((($a = padstr['$empty?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "zero width padding")}
      if ((($a = width <= self.length) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self}
      
      var ljustified = self.$ljust($rb_divide(($rb_plus(width, self.length)), 2).$ceil(), padstr),
          rjustified = self.$rjust($rb_divide(($rb_plus(width, self.length)), 2).$floor(), padstr);

      return rjustified + ljustified.slice(self.length);

    });

    Opal.defn(self, '$chars', TMP_1 = function() {
      var $a, $b, self = this, $iter = TMP_1.$$p, block = $iter || nil;

      TMP_1.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.$each_char().$to_a()
      }
      return ($a = ($b = self).$each_char, $a.$$p = block.$to_proc(), $a).call($b);
    });

    Opal.defn(self, '$chomp', function(separator) {
      var $a, self = this;
      if ($gvars["/"] == null) $gvars["/"] = nil;

      if (separator == null) {
        separator = $gvars["/"]
      }
      if ((($a = separator === nil || self.length === 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self}
      separator = $scope.get('Opal')['$coerce_to!'](separator, $scope.get('String'), "to_str").$to_s();
      
      if (separator === "\n") {
        return self.replace(/\r?\n?$/, '');
      }
      else if (separator === "") {
        return self.replace(/(\r?\n)+$/, '');
      }
      else if (self.length > separator.length) {
        var tail = self.substr(self.length - separator.length, separator.length);

        if (tail === separator) {
          return self.substr(0, self.length - separator.length);
        }
      }
    
      return self;
    });

    Opal.defn(self, '$chop', function() {
      var self = this;

      
      var length = self.length;

      if (length <= 1) {
        return "";
      }

      if (self.charAt(length - 1) === "\n" && self.charAt(length - 2) === "\r") {
        return self.substr(0, length - 2);
      }
      else {
        return self.substr(0, length - 1);
      }
    
    });

    Opal.defn(self, '$chr', function() {
      var self = this;

      return self.charAt(0);
    });

    Opal.defn(self, '$clone', function() {
      var self = this, copy = nil;

      copy = self.slice();
      copy.$copy_singleton_methods(self);
      copy.$initialize_clone(self);
      return copy;
    });

    Opal.defn(self, '$dup', function() {
      var self = this, copy = nil;

      copy = self.slice();
      copy.$initialize_dup(self);
      return copy;
    });

    Opal.defn(self, '$count', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var sets = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        sets[$splat_index] = arguments[$splat_index + 0];
      }
      
      if (sets.length === 0) {
        self.$raise($scope.get('ArgumentError'), "ArgumentError: wrong number of arguments (0 for 1+)")
      }
      var char_class = char_class_from_char_sets(sets);
      if (char_class === null) {
        return 0;
      }
      return self.length - self.replace(new RegExp(char_class, 'g'), '').length;

    });

    Opal.defn(self, '$delete', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var sets = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        sets[$splat_index] = arguments[$splat_index + 0];
      }
      
      if (sets.length === 0) {
        self.$raise($scope.get('ArgumentError'), "ArgumentError: wrong number of arguments (0 for 1+)")
      }
      var char_class = char_class_from_char_sets(sets);
      if (char_class === null) {
        return self;
      }
      return self.replace(new RegExp(char_class, 'g'), '');

    });

    Opal.defn(self, '$downcase', function() {
      var self = this;

      return self.toLowerCase();
    });

    Opal.defn(self, '$each_char', TMP_2 = function() {
      var $a, $b, TMP_3, self = this, $iter = TMP_2.$$p, block = $iter || nil;

      TMP_2.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_3 = function(){var self = TMP_3.$$s || this;

        return self.$size()}, TMP_3.$$s = self, TMP_3), $a).call($b, "each_char")
      }
      
      for (var i = 0, length = self.length; i < length; i++) {
        var value = Opal.yield1(block, self.charAt(i));

        if (value === $breaker) {
          return $breaker.$v;
        }
      }
    
      return self;
    });

    Opal.defn(self, '$each_line', TMP_4 = function(separator) {
      var self = this, $iter = TMP_4.$$p, block = $iter || nil;
      if ($gvars["/"] == null) $gvars["/"] = nil;

      if (separator == null) {
        separator = $gvars["/"]
      }
      TMP_4.$$p = null;
      if ((block !== nil)) {
        } else {
        return self.$enum_for("each_line", separator)
      }
      
      var value;

      if (separator === nil) {
        value = Opal.yield1(block, self);

        if (value === $breaker) {
          return value.$v;
        }
        else {
          return self;
        }
      }

      separator = $scope.get('Opal').$coerce_to(separator, $scope.get('String'), "to_str")

      var a, i, n, length, chomped, trailing, splitted;

      if (separator.length === 0) {
        for (a = self.split(/(\n{2,})/), i = 0, n = a.length; i < n; i += 2) {
          if (a[i] || a[i + 1]) {
            value = Opal.yield1(block, (a[i] || "") + (a[i + 1] || ""));

            if (value === $breaker) {
              return value.$v;
            }
          }
        }

        return self;
      }

      chomped  = self.$chomp(separator);
      trailing = self.length != chomped.length;
      splitted = chomped.split(separator);

      for (i = 0, length = splitted.length; i < length; i++) {
        if (i < length - 1 || trailing) {
          value = Opal.yield1(block, splitted[i] + separator);

          if (value === $breaker) {
            return value.$v;
          }
        }
        else {
          value = Opal.yield1(block, splitted[i]);

          if (value === $breaker) {
            return value.$v;
          }
        }
      }
    
      return self;
    });

    Opal.defn(self, '$empty?', function() {
      var self = this;

      return self.length === 0;
    });

    Opal.defn(self, '$end_with?', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var suffixes = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        suffixes[$splat_index] = arguments[$splat_index + 0];
      }
      
      for (var i = 0, length = suffixes.length; i < length; i++) {
        var suffix = $scope.get('Opal').$coerce_to(suffixes[i], $scope.get('String'), "to_str").$to_s();

        if (self.length >= suffix.length &&
            self.substr(self.length - suffix.length, suffix.length) == suffix) {
          return true;
        }
      }
    
      return false;
    });

    Opal.alias(self, 'eql?', '==');

    Opal.alias(self, 'equal?', '===');

    Opal.defn(self, '$gsub', TMP_5 = function(pattern, replacement) {
      var self = this, $iter = TMP_5.$$p, block = $iter || nil;

      TMP_5.$$p = null;
      
      if (replacement === undefined && block === nil) {
        return self.$enum_for("gsub", pattern);
      }

      var result = '', match_data = nil, index = 0, match, _replacement;

      if (pattern.$$is_regexp) {
        pattern = new RegExp(pattern.source, 'gm' + (pattern.ignoreCase ? 'i' : ''));
      } else {
        pattern = $scope.get('Opal').$coerce_to(pattern, $scope.get('String'), "to_str");
        pattern = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gm');
      }

      while (true) {
        match = pattern.exec(self);

        if (match === null) {
          $gvars["~"] = nil
          result += self.slice(index);
          break;
        }

        match_data = $scope.get('MatchData').$new(pattern, match);

        if (replacement === undefined) {
          _replacement = block(match[0]);
        }
        else if (replacement.$$is_hash) {
          _replacement = (replacement)['$[]'](match[0]).$to_s();
        }
        else {
          if (!replacement.$$is_string) {
            replacement = $scope.get('Opal').$coerce_to(replacement, $scope.get('String'), "to_str");
          }
          _replacement = replacement.replace(/([\\]+)([0-9+&`'])/g, function (original, slashes, command) {
            if (slashes.length % 2 === 0) {
              return original;
            }
            switch (command) {
            case "+":
              for (var i = match.length - 1; i > 0; i--) {
                if (match[i] !== undefined) {
                  return slashes.slice(1) + match[i];
                }
              }
              return '';
            case "&": return slashes.slice(1) + match[0];
            case "`": return slashes.slice(1) + self.slice(0, match.index);
            case "'": return slashes.slice(1) + self.slice(match.index + match[0].length);
            default:  return slashes.slice(1) + (match[command] || '');
            }
          }).replace(/\\\\/g, '\\');
        }

        if (pattern.lastIndex === match.index) {
          result += (_replacement + self.slice(index, match.index + 1))
          pattern.lastIndex += 1;
        }
        else {
          result += (self.slice(index, match.index) + _replacement)
        }
        index = pattern.lastIndex;
      }

      $gvars["~"] = match_data
      return result;

    });

    Opal.defn(self, '$hash', function() {
      var self = this;

      return self.toString();
    });

    Opal.defn(self, '$hex', function() {
      var self = this;

      return self.$to_i(16);
    });

    Opal.defn(self, '$include?', function(other) {
      var $a, self = this;

      
      if (other.$$is_string) {
        return self.indexOf(other) !== -1;
      }
    
      if ((($a = other['$respond_to?']("to_str")) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('TypeError'), "no implicit conversion of " + (other.$class()) + " into String")
      }
      return self.indexOf(other.$to_str()) !== -1;
    });

    Opal.defn(self, '$index', function(search, offset) {
      var self = this;

      
      var index,
          match,
          regex;

      if (offset === undefined) {
        offset = 0;
      } else {
        offset = $scope.get('Opal').$coerce_to(offset, $scope.get('Integer'), "to_int");
        if (offset < 0) {
          offset += self.length;
          if (offset < 0) {
            return nil;
          }
        }
      }

      if (search.$$is_regexp) {
        regex = new RegExp(search.source, 'gm' + (search.ignoreCase ? 'i' : ''));
        while (true) {
          match = regex.exec(self);
          if (match === null) {
            $gvars["~"] = nil;
            index = -1;
            break;
          }
          if (match.index >= offset) {
            $gvars["~"] = $scope.get('MatchData').$new(regex, match)
            index = match.index;
            break;
          }
          regex.lastIndex = match.index + 1;
        }
      } else {
        search = $scope.get('Opal').$coerce_to(search, $scope.get('String'), "to_str");
        if (search.length === 0 && offset > self.length) {
          index = -1;
        } else {
          index = self.indexOf(search, offset);
        }
      }

      return index === -1 ? nil : index;
    
    });

    Opal.defn(self, '$inspect', function() {
      var self = this;

      
      var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
          meta = {
            '\u0007': '\\a',
            '\u001b': '\\e',
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '\v': '\\v',
            '"' : '\\"',
            '\\': '\\\\'
          },
          escaped = self.replace(escapable, function (chr) {
            return meta[chr] || '\\u' + ('0000' + chr.charCodeAt(0).toString(16).toUpperCase()).slice(-4);
          });
      return '"' + escaped.replace(/\#[\$\@\{]/g, '\\$&') + '"';
    
    });

    Opal.defn(self, '$intern', function() {
      var self = this;

      return self;
    });

    Opal.defn(self, '$lines', TMP_6 = function(separator) {
      var $a, $b, self = this, $iter = TMP_6.$$p, block = $iter || nil, e = nil;
      if ($gvars["/"] == null) $gvars["/"] = nil;

      if (separator == null) {
        separator = $gvars["/"]
      }
      TMP_6.$$p = null;
      e = ($a = ($b = self).$each_line, $a.$$p = block.$to_proc(), $a).call($b, separator);
      if (block !== false && block !== nil) {
        return self
        } else {
        return e.$to_a()
      }
    });

    Opal.defn(self, '$length', function() {
      var self = this;

      return self.length;
    });

    Opal.defn(self, '$ljust', function(width, padstr) {
      var $a, self = this;

      if (padstr == null) {
        padstr = " "
      }
      width = $scope.get('Opal').$coerce_to(width, $scope.get('Integer'), "to_int");
      padstr = $scope.get('Opal').$coerce_to(padstr, $scope.get('String'), "to_str").$to_s();
      if ((($a = padstr['$empty?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "zero width padding")}
      if ((($a = width <= self.length) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self}
      
      var index  = -1,
          result = "";

      width -= self.length;

      while (++index < width) {
        result += padstr;
      }

      return self + result.slice(0, width);
    
    });

    Opal.defn(self, '$lstrip', function() {
      var self = this;

      return self.replace(/^\s*/, '');
    });

    Opal.defn(self, '$match', TMP_7 = function(pattern, pos) {
      var $a, $b, self = this, $iter = TMP_7.$$p, block = $iter || nil;

      TMP_7.$$p = null;
      if ((($a = ((($b = $scope.get('String')['$==='](pattern)) !== false && $b !== nil) ? $b : pattern['$respond_to?']("to_str"))) !== nil && (!$a.$$is_boolean || $a == true))) {
        pattern = $scope.get('Regexp').$new(pattern.$to_str())}
      if ((($a = $scope.get('Regexp')['$==='](pattern)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('TypeError'), "wrong argument type " + (pattern.$class()) + " (expected Regexp)")
      }
      return ($a = ($b = pattern).$match, $a.$$p = block.$to_proc(), $a).call($b, self, pos);
    });

    Opal.defn(self, '$next', function() {
      var self = this;

      
      var i = self.length;
      if (i === 0) {
        return '';
      }
      var result = self;
      var first_alphanum_char_index = self.search(/[a-zA-Z0-9]/);
      var carry = false;
      var code;
      while (i--) {
        code = self.charCodeAt(i);
        if ((code >= 48 && code <= 57) ||
          (code >= 65 && code <= 90) ||
          (code >= 97 && code <= 122)) {
          switch (code) {
          case 57:
            carry = true;
            code = 48;
            break;
          case 90:
            carry = true;
            code = 65;
            break;
          case 122:
            carry = true;
            code = 97;
            break;
          default:
            carry = false;
            code += 1;
          }
        } else {
          if (first_alphanum_char_index === -1) {
            if (code === 255) {
              carry = true;
              code = 0;
            } else {
              carry = false;
              code += 1;
            }
          } else {
            carry = true;
          }
        }
        result = result.slice(0, i) + String.fromCharCode(code) + result.slice(i + 1);
        if (carry && (i === 0 || i === first_alphanum_char_index)) {
          switch (code) {
          case 65:
            break;
          case 97:
            break;
          default:
            code += 1;
          }
          if (i === 0) {
            result = String.fromCharCode(code) + result;
          } else {
            result = result.slice(0, i) + String.fromCharCode(code) + result.slice(i);
          }
          carry = false;
        }
        if (!carry) {
          break;
        }
      }
      return result;
    
    });

    Opal.defn(self, '$oct', function() {
      var self = this;

      
      var result,
          string = self,
          radix = 8;

      if (/^\s*_/.test(string)) {
        return 0;
      }

      string = string.replace(/^(\s*[+-]?)(0[bodx]?)(.+)$/i, function (original, head, flag, tail) {
        switch (tail.charAt(0)) {
        case '+':
        case '-':
          return original;
        case '0':
          if (tail.charAt(1) === 'x' && flag === '0x') {
            return original;
          }
        }
        switch (flag) {
        case '0b':
          radix = 2;
          break;
        case '0':
        case '0o':
          radix = 8;
          break;
        case '0d':
          radix = 10;
          break;
        case '0x':
          radix = 16;
          break;
        }
        return head + tail;
      });

      result = parseInt(string.replace(/_(?!_)/g, ''), radix);
      return isNaN(result) ? 0 : result;
    
    });

    Opal.defn(self, '$ord', function() {
      var self = this;

      return self.charCodeAt(0);
    });

    Opal.defn(self, '$partition', function(sep) {
      var self = this;

      
      var i, m;

      if (sep.$$is_regexp) {
        m = sep.exec(self);
        if (m === null) {
          i = -1;
        } else {
          $scope.get('MatchData').$new(sep, m);
          sep = m[0];
          i = m.index;
        }
      } else {
        sep = $scope.get('Opal').$coerce_to(sep, $scope.get('String'), "to_str");
        i = self.indexOf(sep);
      }

      if (i === -1) {
        return [self, '', ''];
      }

      return [
        self.slice(0, i),
        self.slice(i, i + sep.length),
        self.slice(i + sep.length)
      ];
    
    });

    Opal.defn(self, '$reverse', function() {
      var self = this;

      return self.split('').reverse().join('');
    });

    Opal.defn(self, '$rindex', function(search, offset) {
      var self = this;

      
      var i, m, r, _m;

      if (offset === undefined) {
        offset = self.length;
      } else {
        offset = $scope.get('Opal').$coerce_to(offset, $scope.get('Integer'), "to_int");
        if (offset < 0) {
          offset += self.length;
          if (offset < 0) {
            return nil;
          }
        }
      }

      if (search.$$is_regexp) {
        m = null;
        r = new RegExp(search.source, 'gm' + (search.ignoreCase ? 'i' : ''));
        while (true) {
          _m = r.exec(self);
          if (_m === null || _m.index > offset) {
            break;
          }
          m = _m;
          r.lastIndex = m.index + 1;
        }
        if (m === null) {
          $gvars["~"] = nil
          i = -1;
        } else {
          $scope.get('MatchData').$new(r, m);
          i = m.index;
        }
      } else {
        search = $scope.get('Opal').$coerce_to(search, $scope.get('String'), "to_str");
        i = self.lastIndexOf(search, offset);
      }

      return i === -1 ? nil : i;
    
    });

    Opal.defn(self, '$rjust', function(width, padstr) {
      var $a, self = this;

      if (padstr == null) {
        padstr = " "
      }
      width = $scope.get('Opal').$coerce_to(width, $scope.get('Integer'), "to_int");
      padstr = $scope.get('Opal').$coerce_to(padstr, $scope.get('String'), "to_str").$to_s();
      if ((($a = padstr['$empty?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "zero width padding")}
      if ((($a = width <= self.length) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self}
      
      var chars     = Math.floor(width - self.length),
          patterns  = Math.floor(chars / padstr.length),
          result    = Array(patterns + 1).join(padstr),
          remaining = chars - result.length;

      return result + padstr.slice(0, remaining) + self;
    
    });

    Opal.defn(self, '$rpartition', function(sep) {
      var self = this;

      
      var i, m, r, _m;

      if (sep.$$is_regexp) {
        m = null;
        r = new RegExp(sep.source, 'gm' + (sep.ignoreCase ? 'i' : ''));

        while (true) {
          _m = r.exec(self);
          if (_m === null) {
            break;
          }
          m = _m;
          r.lastIndex = m.index + 1;
        }

        if (m === null) {
          i = -1;
        } else {
          $scope.get('MatchData').$new(r, m);
          sep = m[0];
          i = m.index;
        }

      } else {
        sep = $scope.get('Opal').$coerce_to(sep, $scope.get('String'), "to_str");
        i = self.lastIndexOf(sep);
      }

      if (i === -1) {
        return ['', '', self];
      }

      return [
        self.slice(0, i),
        self.slice(i, i + sep.length),
        self.slice(i + sep.length)
      ];
    
    });

    Opal.defn(self, '$rstrip', function() {
      var self = this;

      return self.replace(/[\s\u0000]*$/, '');
    });

    Opal.defn(self, '$scan', TMP_8 = function(pattern) {
      var self = this, $iter = TMP_8.$$p, block = $iter || nil;

      TMP_8.$$p = null;
      
      var result = [],
          match_data = nil,
          match;

      if (pattern.$$is_regexp) {
        pattern = new RegExp(pattern.source, 'gm' + (pattern.ignoreCase ? 'i' : ''));
      } else {
        pattern = $scope.get('Opal').$coerce_to(pattern, $scope.get('String'), "to_str");
        pattern = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gm');
      }

      while ((match = pattern.exec(self)) != null) {
        match_data = $scope.get('MatchData').$new(pattern, match);
        if (block === nil) {
          match.length == 1 ? result.push(match[0]) : result.push((match_data).$captures());
        } else {
          match.length == 1 ? block(match[0]) : block.call(self, (match_data).$captures());
        }
        if (pattern.lastIndex === match.index) {
          pattern.lastIndex += 1;
        }
      }

      $gvars["~"] = match_data

      return (block !== nil ? self : result);
    
    });

    Opal.alias(self, 'size', 'length');

    Opal.alias(self, 'slice', '[]');

    Opal.defn(self, '$split', function(pattern, limit) {
      var $a, self = this;
      if ($gvars[";"] == null) $gvars[";"] = nil;

      
      if (self.length === 0) {
        return [];
      }

      if (limit === undefined) {
        limit = 0;
      } else {
        limit = $scope.get('Opal')['$coerce_to!'](limit, $scope.get('Integer'), "to_int");
        if (limit === 1) {
          return [self];
        }
      }

      if (pattern === undefined || pattern === nil) {
        pattern = ((($a = $gvars[";"]) !== false && $a !== nil) ? $a : " ");
      }

      var result = [],
          string = self.toString(),
          index = 0,
          match,
          i;

      if (pattern.$$is_regexp) {
        pattern = new RegExp(pattern.source, 'gm' + (pattern.ignoreCase ? 'i' : ''));
      } else {
        pattern = $scope.get('Opal').$coerce_to(pattern, $scope.get('String'), "to_str").$to_s();
        if (pattern === ' ') {
          pattern = /\s+/gm;
          string = string.replace(/^\s+/, '');
        } else {
          pattern = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gm');
        }
      }

      result = string.split(pattern);

      if (result.length === 1 && result[0] === string) {
        return result;
      }

      while ((i = result.indexOf(undefined)) !== -1) {
        result.splice(i, 1);
      }

      if (limit === 0) {
        while (result[result.length - 1] === '') {
          result.length -= 1;
        }
        return result;
      }

      match = pattern.exec(string);

      if (limit < 0) {
        if (match !== null && match[0] === '' && pattern.source.indexOf('(?=') === -1) {
          for (i = 0; i < match.length; i++) {
            result.push('');
          }
        }
        return result;
      }

      if (match !== null && match[0] === '') {
        result.splice(limit - 1, result.length - 1, result.slice(limit - 1).join(''));
        return result;
      }

      i = 0;
      while (match !== null) {
        i++;
        index = pattern.lastIndex;
        if (i + 1 === limit) {
          break;
        }
        match = pattern.exec(string);
      }

      result.splice(limit - 1, result.length - 1, string.slice(index));
      return result;
    
    });

    Opal.defn(self, '$squeeze', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var sets = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        sets[$splat_index] = arguments[$splat_index + 0];
      }
      
      if (sets.length === 0) {
        return self.replace(/(.)\1+/g, '$1');
      }
      var char_class = char_class_from_char_sets(sets);
      if (char_class === null) {
        return self;
      }
      return self.replace(new RegExp('(' + char_class + ')\\1+', 'g'), '$1');
    
    });

    Opal.defn(self, '$start_with?', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var prefixes = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        prefixes[$splat_index] = arguments[$splat_index + 0];
      }
      
      for (var i = 0, length = prefixes.length; i < length; i++) {
        var prefix = $scope.get('Opal').$coerce_to(prefixes[i], $scope.get('String'), "to_str").$to_s();

        if (self.indexOf(prefix) === 0) {
          return true;
        }
      }

      return false;
    
    });

    Opal.defn(self, '$strip', function() {
      var self = this;

      return self.replace(/^\s*/, '').replace(/[\s\u0000]*$/, '');
    });

    Opal.defn(self, '$sub', TMP_9 = function(pattern, replacement) {
      var self = this, $iter = TMP_9.$$p, block = $iter || nil;

      TMP_9.$$p = null;
      
      if (!pattern.$$is_regexp) {
        pattern = $scope.get('Opal').$coerce_to(pattern, $scope.get('String'), "to_str");
        pattern = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      }

      var result = pattern.exec(self);

      if (result === null) {
        $gvars["~"] = nil
        return self.toString();
      }

      $scope.get('MatchData').$new(pattern, result)

      if (replacement === undefined) {
        if (block === nil) {
          self.$raise($scope.get('ArgumentError'), "wrong number of arguments (1 for 2)")
        }
        return self.slice(0, result.index) + block(result[0]) + self.slice(result.index + result[0].length);
      }

      if (replacement.$$is_hash) {
        return self.slice(0, result.index) + (replacement)['$[]'](result[0]).$to_s() + self.slice(result.index + result[0].length);
      }

      replacement = $scope.get('Opal').$coerce_to(replacement, $scope.get('String'), "to_str");

      replacement = replacement.replace(/([\\]+)([0-9+&`'])/g, function (original, slashes, command) {
        if (slashes.length % 2 === 0) {
          return original;
        }
        switch (command) {
        case "+":
          for (var i = result.length - 1; i > 0; i--) {
            if (result[i] !== undefined) {
              return slashes.slice(1) + result[i];
            }
          }
          return '';
        case "&": return slashes.slice(1) + result[0];
        case "`": return slashes.slice(1) + self.slice(0, result.index);
        case "'": return slashes.slice(1) + self.slice(result.index + result[0].length);
        default:  return slashes.slice(1) + (result[command] || '');
        }
      }).replace(/\\\\/g, '\\');

      return self.slice(0, result.index) + replacement + self.slice(result.index + result[0].length);

    });

    Opal.alias(self, 'succ', 'next');

    Opal.defn(self, '$sum', function(n) {
      var self = this;

      if (n == null) {
        n = 16
      }
      
      n = $scope.get('Opal').$coerce_to(n, $scope.get('Integer'), "to_int");

      var result = 0,
          length = self.length,
          i = 0;

      for (; i < length; i++) {
        result += self.charCodeAt(i);
      }

      if (n <= 0) {
        return result;
      }

      return result & (Math.pow(2, n) - 1);

    });

    Opal.defn(self, '$swapcase', function() {
      var self = this;

      
      var str = self.replace(/([a-z]+)|([A-Z]+)/g, function($0,$1,$2) {
        return $1 ? $0.toUpperCase() : $0.toLowerCase();
      });

      if (self.constructor === String) {
        return str;
      }

      return self.$class().$new(str);
    
    });

    Opal.defn(self, '$to_f', function() {
      var self = this;

      
      if (self.charAt(0) === '_') {
        return 0;
      }

      var result = parseFloat(self.replace(/_/g, ''));

      if (isNaN(result) || result == Infinity || result == -Infinity) {
        return 0;
      }
      else {
        return result;
      }
    
    });

    Opal.defn(self, '$to_i', function(base) {
      var self = this;

      if (base == null) {
        base = 10
      }
      
      var result,
          string = self.toLowerCase(),
          radix = $scope.get('Opal').$coerce_to(base, $scope.get('Integer'), "to_int");

      if (radix === 1 || radix < 0 || radix > 36) {
        self.$raise($scope.get('ArgumentError'), "invalid radix " + (radix))
      }

      if (/^\s*_/.test(string)) {
        return 0;
      }

      string = string.replace(/^(\s*[+-]?)(0[bodx]?)(.+)$/, function (original, head, flag, tail) {
        switch (tail.charAt(0)) {
        case '+':
        case '-':
          return original;
        case '0':
          if (tail.charAt(1) === 'x' && flag === '0x' && (radix === 0 || radix === 16)) {
            return original;
          }
        }
        switch (flag) {
        case '0b':
          if (radix === 0 || radix === 2) {
            radix = 2;
            return head + tail;
          }
          break;
        case '0':
        case '0o':
          if (radix === 0 || radix === 8) {
            radix = 8;
            return head + tail;
          }
          break;
        case '0d':
          if (radix === 0 || radix === 10) {
            radix = 10;
            return head + tail;
          }
          break;
        case '0x':
          if (radix === 0 || radix === 16) {
            radix = 16;
            return head + tail;
          }
          break;
        }
        return original
      });

      result = parseInt(string.replace(/_(?!_)/g, ''), radix);
      return isNaN(result) ? 0 : result;

    });

    Opal.defn(self, '$to_proc', function() {
      var $a, $b, TMP_10, self = this, sym = nil;

      sym = self;
      return ($a = ($b = self).$proc, $a.$$p = (TMP_10 = function(args){var self = TMP_10.$$s || this, block, $a, $b, obj = nil;
args = $slice.call(arguments, 0);
        block = TMP_10.$$p || nil, TMP_10.$$p = null;
      if ((($a = args['$empty?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('ArgumentError'), "no receiver given")}
        obj = args.$shift();
        return ($a = ($b = obj).$__send__, $a.$$p = block.$to_proc(), $a).apply($b, [sym].concat(Opal.to_a(args)));}, TMP_10.$$s = self, TMP_10), $a).call($b);
    });

    Opal.defn(self, '$to_s', function() {
      var self = this;

      return self.toString();
    });

    Opal.alias(self, 'to_str', 'to_s');

    Opal.alias(self, 'to_sym', 'intern');

    Opal.defn(self, '$tr', function(from, to) {
      var self = this;

      from = $scope.get('Opal').$coerce_to(from, $scope.get('String'), "to_str").$to_s();
      to = $scope.get('Opal').$coerce_to(to, $scope.get('String'), "to_str").$to_s();
      
      if (from.length == 0 || from === to) {
        return self;
      }

      var i, in_range, c, ch, start, end, length;
      var subs = {};
      var from_chars = from.split('');
      var from_length = from_chars.length;
      var to_chars = to.split('');
      var to_length = to_chars.length;

      var inverse = false;
      var global_sub = null;
      if (from_chars[0] === '^' && from_chars.length > 1) {
        inverse = true;
        from_chars.shift();
        global_sub = to_chars[to_length - 1]
        from_length -= 1;
      }

      var from_chars_expanded = [];
      var last_from = null;
      in_range = false;
      for (i = 0; i < from_length; i++) {
        ch = from_chars[i];
        if (last_from == null) {
          last_from = ch;
          from_chars_expanded.push(ch);
        }
        else if (ch === '-') {
          if (last_from === '-') {
            from_chars_expanded.push('-');
            from_chars_expanded.push('-');
          }
          else if (i == from_length - 1) {
            from_chars_expanded.push('-');
          }
          else {
            in_range = true;
          }
        }
        else if (in_range) {
          start = last_from.charCodeAt(0);
          end = ch.charCodeAt(0);
          if (start > end) {
            self.$raise($scope.get('ArgumentError'), "invalid range \"" + (String.fromCharCode(start)) + "-" + (String.fromCharCode(end)) + "\" in string transliteration")
          }
          for (c = start + 1; c < end; c++) {
            from_chars_expanded.push(String.fromCharCode(c));
          }
          from_chars_expanded.push(ch);
          in_range = null;
          last_from = null;
        }
        else {
          from_chars_expanded.push(ch);
        }
      }

      from_chars = from_chars_expanded;
      from_length = from_chars.length;

      if (inverse) {
        for (i = 0; i < from_length; i++) {
          subs[from_chars[i]] = true;
        }
      }
      else {
        if (to_length > 0) {
          var to_chars_expanded = [];
          var last_to = null;
          in_range = false;
          for (i = 0; i < to_length; i++) {
            ch = to_chars[i];
            if (last_from == null) {
              last_from = ch;
              to_chars_expanded.push(ch);
            }
            else if (ch === '-') {
              if (last_to === '-') {
                to_chars_expanded.push('-');
                to_chars_expanded.push('-');
              }
              else if (i == to_length - 1) {
                to_chars_expanded.push('-');
              }
              else {
                in_range = true;
              }
            }
            else if (in_range) {
              start = last_from.charCodeAt(0);
              end = ch.charCodeAt(0);
              if (start > end) {
                self.$raise($scope.get('ArgumentError'), "invalid range \"" + (String.fromCharCode(start)) + "-" + (String.fromCharCode(end)) + "\" in string transliteration")
              }
              for (c = start + 1; c < end; c++) {
                to_chars_expanded.push(String.fromCharCode(c));
              }
              to_chars_expanded.push(ch);
              in_range = null;
              last_from = null;
            }
            else {
              to_chars_expanded.push(ch);
            }
          }

          to_chars = to_chars_expanded;
          to_length = to_chars.length;
        }

        var length_diff = from_length - to_length;
        if (length_diff > 0) {
          var pad_char = (to_length > 0 ? to_chars[to_length - 1] : '');
          for (i = 0; i < length_diff; i++) {
            to_chars.push(pad_char);
          }
        }

        for (i = 0; i < from_length; i++) {
          subs[from_chars[i]] = to_chars[i];
        }
      }

      var new_str = ''
      for (i = 0, length = self.length; i < length; i++) {
        ch = self.charAt(i);
        var sub = subs[ch];
        if (inverse) {
          new_str += (sub == null ? global_sub : ch);
        }
        else {
          new_str += (sub != null ? sub : ch);
        }
      }
      return new_str;
    
    });

    Opal.defn(self, '$tr_s', function(from, to) {
      var self = this;

      from = $scope.get('Opal').$coerce_to(from, $scope.get('String'), "to_str").$to_s();
      to = $scope.get('Opal').$coerce_to(to, $scope.get('String'), "to_str").$to_s();
      
      if (from.length == 0) {
        return self;
      }

      var i, in_range, c, ch, start, end, length;
      var subs = {};
      var from_chars = from.split('');
      var from_length = from_chars.length;
      var to_chars = to.split('');
      var to_length = to_chars.length;

      var inverse = false;
      var global_sub = null;
      if (from_chars[0] === '^' && from_chars.length > 1) {
        inverse = true;
        from_chars.shift();
        global_sub = to_chars[to_length - 1]
        from_length -= 1;
      }

      var from_chars_expanded = [];
      var last_from = null;
      in_range = false;
      for (i = 0; i < from_length; i++) {
        ch = from_chars[i];
        if (last_from == null) {
          last_from = ch;
          from_chars_expanded.push(ch);
        }
        else if (ch === '-') {
          if (last_from === '-') {
            from_chars_expanded.push('-');
            from_chars_expanded.push('-');
          }
          else if (i == from_length - 1) {
            from_chars_expanded.push('-');
          }
          else {
            in_range = true;
          }
        }
        else if (in_range) {
          start = last_from.charCodeAt(0);
          end = ch.charCodeAt(0);
          if (start > end) {
            self.$raise($scope.get('ArgumentError'), "invalid range \"" + (String.fromCharCode(start)) + "-" + (String.fromCharCode(end)) + "\" in string transliteration")
          }
          for (c = start + 1; c < end; c++) {
            from_chars_expanded.push(String.fromCharCode(c));
          }
          from_chars_expanded.push(ch);
          in_range = null;
          last_from = null;
        }
        else {
          from_chars_expanded.push(ch);
        }
      }

      from_chars = from_chars_expanded;
      from_length = from_chars.length;

      if (inverse) {
        for (i = 0; i < from_length; i++) {
          subs[from_chars[i]] = true;
        }
      }
      else {
        if (to_length > 0) {
          var to_chars_expanded = [];
          var last_to = null;
          in_range = false;
          for (i = 0; i < to_length; i++) {
            ch = to_chars[i];
            if (last_from == null) {
              last_from = ch;
              to_chars_expanded.push(ch);
            }
            else if (ch === '-') {
              if (last_to === '-') {
                to_chars_expanded.push('-');
                to_chars_expanded.push('-');
              }
              else if (i == to_length - 1) {
                to_chars_expanded.push('-');
              }
              else {
                in_range = true;
              }
            }
            else if (in_range) {
              start = last_from.charCodeAt(0);
              end = ch.charCodeAt(0);
              if (start > end) {
                self.$raise($scope.get('ArgumentError'), "invalid range \"" + (String.fromCharCode(start)) + "-" + (String.fromCharCode(end)) + "\" in string transliteration")
              }
              for (c = start + 1; c < end; c++) {
                to_chars_expanded.push(String.fromCharCode(c));
              }
              to_chars_expanded.push(ch);
              in_range = null;
              last_from = null;
            }
            else {
              to_chars_expanded.push(ch);
            }
          }

          to_chars = to_chars_expanded;
          to_length = to_chars.length;
        }

        var length_diff = from_length - to_length;
        if (length_diff > 0) {
          var pad_char = (to_length > 0 ? to_chars[to_length - 1] : '');
          for (i = 0; i < length_diff; i++) {
            to_chars.push(pad_char);
          }
        }

        for (i = 0; i < from_length; i++) {
          subs[from_chars[i]] = to_chars[i];
        }
      }
      var new_str = ''
      var last_substitute = null
      for (i = 0, length = self.length; i < length; i++) {
        ch = self.charAt(i);
        var sub = subs[ch]
        if (inverse) {
          if (sub == null) {
            if (last_substitute == null) {
              new_str += global_sub;
              last_substitute = true;
            }
          }
          else {
            new_str += ch;
            last_substitute = null;
          }
        }
        else {
          if (sub != null) {
            if (last_substitute == null || last_substitute !== sub) {
              new_str += sub;
              last_substitute = sub;
            }
          }
          else {
            new_str += ch;
            last_substitute = null;
          }
        }
      }
      return new_str;
    
    });

    Opal.defn(self, '$upcase', function() {
      var self = this;

      return self.toUpperCase();
    });

    Opal.defn(self, '$upto', TMP_11 = function(stop, excl) {
      var self = this, $iter = TMP_11.$$p, block = $iter || nil;

      if (excl == null) {
        excl = false
      }
      TMP_11.$$p = null;
      if ((block !== nil)) {
        } else {
        return self.$enum_for("upto", stop, excl)
      }
      stop = $scope.get('Opal').$coerce_to(stop, $scope.get('String'), "to_str");
      
      var a, b, s = self.toString(), value;

      if (s.length === 1 && stop.length === 1) {

        a = s.charCodeAt(0);
        b = stop.charCodeAt(0);

        while (a <= b) {
          if (excl && a === b) {
            break;
          }

          value = block(String.fromCharCode(a));
          if (value === $breaker) { return $breaker.$v; }

          a += 1;
        }

      } else if (parseInt(s, 10).toString() === s && parseInt(stop, 10).toString() === stop) {

        a = parseInt(s, 10);
        b = parseInt(stop, 10);

        while (a <= b) {
          if (excl && a === b) {
            break;
          }

          value = block(a.toString());
          if (value === $breaker) { return $breaker.$v; }

          a += 1;
        }

      } else {

        while (s.length <= stop.length && s <= stop) {
          if (excl && s === stop) {
            break;
          }

          value = block(s);
          if (value === $breaker) { return $breaker.$v; }

          s = (s).$succ();
        }

      }
      return self;
    
    });

    
    function char_class_from_char_sets(sets) {
      function explode_sequences_in_character_set(set) {
        var result = '',
            i, len = set.length,
            curr_char,
            skip_next_dash,
            char_code_from,
            char_code_upto,
            char_code;
        for (i = 0; i < len; i++) {
          curr_char = set.charAt(i);
          if (curr_char === '-' && i > 0 && i < (len - 1) && !skip_next_dash) {
            char_code_from = set.charCodeAt(i - 1);
            char_code_upto = set.charCodeAt(i + 1);
            if (char_code_from > char_code_upto) {
              self.$raise($scope.get('ArgumentError'), "invalid range \"" + (char_code_from) + "-" + (char_code_upto) + "\" in string transliteration")
            }
            for (char_code = char_code_from + 1; char_code < char_code_upto + 1; char_code++) {
              result += String.fromCharCode(char_code);
            }
            skip_next_dash = true;
            i++;
          } else {
            skip_next_dash = (curr_char === '\\');
            result += curr_char;
          }
        }
        return result;
      }

      function intersection(setA, setB) {
        if (setA.length === 0) {
          return setB;
        }
        var result = '',
            i, len = setA.length,
            chr;
        for (i = 0; i < len; i++) {
          chr = setA.charAt(i);
          if (setB.indexOf(chr) !== -1) {
            result += chr;
          }
        }
        return result;
      }

      var i, len, set, neg, chr, tmp,
          pos_intersection = '',
          neg_intersection = '';

      for (i = 0, len = sets.length; i < len; i++) {
        set = $scope.get('Opal').$coerce_to(sets[i], $scope.get('String'), "to_str");
        neg = (set.charAt(0) === '^' && set.length > 1);
        set = explode_sequences_in_character_set(neg ? set.slice(1) : set);
        if (neg) {
          neg_intersection = intersection(neg_intersection, set);
        } else {
          pos_intersection = intersection(pos_intersection, set);
        }
      }

      if (pos_intersection.length > 0 && neg_intersection.length > 0) {
        tmp = '';
        for (i = 0, len = pos_intersection.length; i < len; i++) {
          chr = pos_intersection.charAt(i);
          if (neg_intersection.indexOf(chr) === -1) {
            tmp += chr;
          }
        }
        pos_intersection = tmp;
        neg_intersection = '';
      }

      if (pos_intersection.length > 0) {
        return '[' + $scope.get('Regexp').$escape(pos_intersection) + ']';
      }

      if (neg_intersection.length > 0) {
        return '[^' + $scope.get('Regexp').$escape(neg_intersection) + ']';
      }

      return null;
    }
  
  })($scope.base, String);
  return Opal.cdecl($scope, 'Symbol', $scope.get('String'));
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/enumerable"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  function $rb_times(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs * rhs : lhs['$*'](rhs);
  }
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module;

  Opal.add_stubs(['$raise', '$new', '$yield', '$dup', '$enum_for', '$enumerator_size', '$flatten', '$map', '$==', '$destructure', '$respond_to?', '$coerce_to!', '$>', '$*', '$nil?', '$coerce_to', '$try_convert', '$<', '$+', '$-', '$ceil', '$/', '$size', '$===', '$<<', '$[]', '$[]=', '$inspect', '$__send__', '$compare', '$<=>', '$proc', '$call', '$to_a', '$lambda', '$sort!', '$map!', '$first', '$zip']);
  return (function($base) {
    var $Enumerable, self = $Enumerable = $module($base, 'Enumerable');

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2, TMP_3, TMP_6, TMP_8, TMP_11, TMP_12, TMP_14, TMP_15, TMP_16, TMP_18, TMP_19, TMP_21, TMP_23, TMP_25, TMP_27, TMP_28, TMP_29, TMP_31, TMP_33, TMP_34, TMP_36, TMP_37, TMP_39, TMP_41, TMP_42, TMP_43, TMP_44, TMP_46, TMP_48, TMP_50, TMP_52, TMP_54, TMP_59, TMP_60;

    Opal.defn(self, '$all?', TMP_1 = function() {
      var $a, self = this, $iter = TMP_1.$$p, block = $iter || nil;

      TMP_1.$$p = null;
      
      var result = true;

      if (block !== nil) {
        self.$each.$$p = function() {
          var value = Opal.yieldX(block, arguments);

          if (value === $breaker) {
            result = $breaker.$v;
            return $breaker;
          }

          if ((($a = value) === nil || ($a.$$is_boolean && $a == false))) {
            result = false;
            return $breaker;
          }
        };
      }
      else {
        self.$each.$$p = function(obj) {
          if (arguments.length == 1 && (($a = obj) === nil || ($a.$$is_boolean && $a == false))) {
            result = false;
            return $breaker;
          }
        };
      }

      self.$each();

      return result;
    
    });

    Opal.defn(self, '$any?', TMP_2 = function() {
      var $a, self = this, $iter = TMP_2.$$p, block = $iter || nil;

      TMP_2.$$p = null;
      
      var result = false;

      if (block !== nil) {
        self.$each.$$p = function() {
          var value = Opal.yieldX(block, arguments);

          if (value === $breaker) {
            result = $breaker.$v;
            return $breaker;
          }

          if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
            result = true;
            return $breaker;
          }
        };
      }
      else {
        self.$each.$$p = function(obj) {
          if (arguments.length != 1 || (($a = obj) !== nil && (!$a.$$is_boolean || $a == true))) {
            result = true;
            return $breaker;
          }
        }
      }

      self.$each();

      return result;
    
    });

    Opal.defn(self, '$chunk', TMP_3 = function(state) {
      var $a, $b, TMP_4, self = this, $iter = TMP_3.$$p, original_block = $iter || nil;

      TMP_3.$$p = null;
      if (original_block !== false && original_block !== nil) {
        } else {
        $scope.get('Kernel').$raise($scope.get('ArgumentError'), "no block given")
      }
      return ($a = ($b = Opal.get('Enumerator')).$new, $a.$$p = (TMP_4 = function(yielder){var self = TMP_4.$$s || this, $a, $b, TMP_5;
if (yielder == null) yielder = nil;
      
        var block, previous = nil, accumulate = [];

        if (state == undefined || state === nil) {
          block = original_block;
        } else {
          block = ($a = ($b = $scope.get('Proc')).$new, $a.$$p = (TMP_5 = function(val){var self = TMP_5.$$s || this;
if (val == null) val = nil;
        return original_block.$yield(val, state.$dup())}, TMP_5.$$s = self, TMP_5), $a).call($b)
        }

        function releaseAccumulate() {
          if (accumulate.length > 0) {
            yielder.$yield(previous, accumulate)
          }
        }

        self.$each.$$p = function(value) {
          var key = Opal.yield1(block, value);

          if (key === $breaker) {
            return $breaker;
          }

          if (key === nil) {
            releaseAccumulate();
            accumulate = [];
            previous = nil;
          } else {
            if (previous === nil || previous === key) {
              accumulate.push(value);
            } else {
              releaseAccumulate();
              accumulate = [value];
            }

            previous = key;
          }
        }

        self.$each();

        releaseAccumulate();
      }, TMP_4.$$s = self, TMP_4), $a).call($b);
    });

    Opal.defn(self, '$collect', TMP_6 = function() {
      var $a, $b, TMP_7, self = this, $iter = TMP_6.$$p, block = $iter || nil;

      TMP_6.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_7 = function(){var self = TMP_7.$$s || this;

        return self.$enumerator_size()}, TMP_7.$$s = self, TMP_7), $a).call($b, "collect")
      }
      
      var result = [];

      self.$each.$$p = function() {
        var value = Opal.yieldX(block, arguments);

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }

        result.push(value);
      };

      self.$each();

      return result;
    
    });

    Opal.defn(self, '$collect_concat', TMP_8 = function() {
      var $a, $b, TMP_9, $c, TMP_10, self = this, $iter = TMP_8.$$p, block = $iter || nil;

      TMP_8.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_9 = function(){var self = TMP_9.$$s || this;

        return self.$enumerator_size()}, TMP_9.$$s = self, TMP_9), $a).call($b, "collect_concat")
      }
      return ($a = ($c = self).$map, $a.$$p = (TMP_10 = function(item){var self = TMP_10.$$s || this, $a;
if (item == null) item = nil;
      return $a = Opal.yield1(block, item), $a === $breaker ? $a : $a}, TMP_10.$$s = self, TMP_10), $a).call($c).$flatten(1);
    });

    Opal.defn(self, '$count', TMP_11 = function(object) {
      var $a, self = this, $iter = TMP_11.$$p, block = $iter || nil;

      TMP_11.$$p = null;
      
      var result = 0;

      if (object != null) {
        block = function() {
          return $scope.get('Opal').$destructure(arguments)['$=='](object);
        };
      }
      else if (block === nil) {
        block = function() { return true; };
      }

      self.$each.$$p = function() {
        var value = Opal.yieldX(block, arguments);

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }

        if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
          result++;
        }
      }

      self.$each();

      return result;
    
    });

    Opal.defn(self, '$cycle', TMP_12 = function(n) {
      var $a, $b, TMP_13, self = this, $iter = TMP_12.$$p, block = $iter || nil;

      if (n == null) {
        n = nil
      }
      TMP_12.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_13 = function(){var self = TMP_13.$$s || this, $a;

        if (n['$=='](nil)) {
            if ((($a = self['$respond_to?']("size")) !== nil && (!$a.$$is_boolean || $a == true))) {
              return (($scope.get('Float')).$$scope.get('INFINITY'))
              } else {
              return nil
            }
            } else {
            n = $scope.get('Opal')['$coerce_to!'](n, $scope.get('Integer'), "to_int");
            if ((($a = $rb_gt(n, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
              return $rb_times(self.$enumerator_size(), n)
              } else {
              return 0
            }
          }}, TMP_13.$$s = self, TMP_13), $a).call($b, "cycle", n)
      }
      if ((($a = n['$nil?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        n = $scope.get('Opal')['$coerce_to!'](n, $scope.get('Integer'), "to_int");
        if ((($a = n <= 0) !== nil && (!$a.$$is_boolean || $a == true))) {
          return nil}
      }
      
      var result,
          all = [], i, length, value;

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments),
            value = Opal.yield1(block, param);

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }

        all.push(param);
      }

      self.$each();

      if (result !== undefined) {
        return result;
      }

      if (all.length === 0) {
        return nil;
      }

      if (n === nil) {
        while (true) {
          for (i = 0, length = all.length; i < length; i++) {
            value = Opal.yield1(block, all[i]);

            if (value === $breaker) {
              return $breaker.$v;
            }
          }
        }
      }
      else {
        while (n > 1) {
          for (i = 0, length = all.length; i < length; i++) {
            value = Opal.yield1(block, all[i]);

            if (value === $breaker) {
              return $breaker.$v;
            }
          }

          n--;
        }
      }
    
    });

    Opal.defn(self, '$detect', TMP_14 = function(ifnone) {
      var $a, self = this, $iter = TMP_14.$$p, block = $iter || nil;

      TMP_14.$$p = null;
      if ((block !== nil)) {
        } else {
        return self.$enum_for("detect", ifnone)
      }
      
      var result;

      self.$each.$$p = function() {
        var params = $scope.get('Opal').$destructure(arguments),
            value  = Opal.yield1(block, params);

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }

        if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
          result = params;
          return $breaker;
        }
      };

      self.$each();

      if (result === undefined && ifnone !== undefined) {
        if (typeof(ifnone) === 'function') {
          result = ifnone();
        }
        else {
          result = ifnone;
        }
      }

      return result === undefined ? nil : result;
    
    });

    Opal.defn(self, '$drop', function(number) {
      var $a, self = this;

      number = $scope.get('Opal').$coerce_to(number, $scope.get('Integer'), "to_int");
      if ((($a = number < 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "attempt to drop negative size")}
      
      var result  = [],
          current = 0;

      self.$each.$$p = function() {
        if (number <= current) {
          result.push($scope.get('Opal').$destructure(arguments));
        }

        current++;
      };

      self.$each()

      return result;
    
    });

    Opal.defn(self, '$drop_while', TMP_15 = function() {
      var $a, self = this, $iter = TMP_15.$$p, block = $iter || nil;

      TMP_15.$$p = null;
      if ((block !== nil)) {
        } else {
        return self.$enum_for("drop_while")
      }
      
      var result   = [],
          dropping = true;

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments);

        if (dropping) {
          var value = Opal.yield1(block, param);

          if (value === $breaker) {
            result = $breaker.$v;
            return $breaker;
          }

          if ((($a = value) === nil || ($a.$$is_boolean && $a == false))) {
            dropping = false;
            result.push(param);
          }
        }
        else {
          result.push(param);
        }
      };

      self.$each();

      return result;
    
    });

    Opal.defn(self, '$each_cons', TMP_16 = function(n) {
      var $a, $b, TMP_17, self = this, $iter = TMP_16.$$p, block = $iter || nil;

      TMP_16.$$p = null;
      if ((($a = arguments.length != 1) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "wrong number of arguments (" + (arguments.length) + " for 1)")}
      n = $scope.get('Opal').$try_convert(n, $scope.get('Integer'), "to_int");
      if ((($a = n <= 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "invalid size")}
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_17 = function(){var self = TMP_17.$$s || this, $a, $b, enum_size = nil;

        enum_size = self.$enumerator_size();
          if ((($a = enum_size['$nil?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
            return nil
          } else if ((($a = ((($b = enum_size['$=='](0)) !== false && $b !== nil) ? $b : $rb_lt(enum_size, n))) !== nil && (!$a.$$is_boolean || $a == true))) {
            return 0
            } else {
            return $rb_plus($rb_minus(enum_size, n), 1)
          }}, TMP_17.$$s = self, TMP_17), $a).call($b, "each_cons", n)
      }
      
      var buffer = [], result = nil;

      self.$each.$$p = function() {
        var element = $scope.get('Opal').$destructure(arguments);
        buffer.push(element);
        if (buffer.length > n) {
          buffer.shift();
        }
        if (buffer.length == n) {
          var value = Opal.yield1(block, buffer.slice(0, n));

          if (value == $breaker) {
            result = $breaker.$v;
            return $breaker;
          }
        }
      }

      self.$each();

      return result;
    
    });

    Opal.defn(self, '$each_entry', TMP_18 = function() {
      var self = this, $iter = TMP_18.$$p, block = $iter || nil;

      TMP_18.$$p = null;
      return self.$raise($scope.get('NotImplementedError'));
    });

    Opal.defn(self, '$each_slice', TMP_19 = function(n) {
      var $a, $b, TMP_20, self = this, $iter = TMP_19.$$p, block = $iter || nil;

      TMP_19.$$p = null;
      n = $scope.get('Opal').$coerce_to(n, $scope.get('Integer'), "to_int");
      if ((($a = n <= 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "invalid slice size")}
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_20 = function(){var self = TMP_20.$$s || this, $a;

        if ((($a = self['$respond_to?']("size")) !== nil && (!$a.$$is_boolean || $a == true))) {
            return ($rb_divide(self.$size(), n)).$ceil()
            } else {
            return nil
          }}, TMP_20.$$s = self, TMP_20), $a).call($b, "each_slice", n)
      }
      
      var result,
          slice = []

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments);

        slice.push(param);

        if (slice.length === n) {
          if (Opal.yield1(block, slice) === $breaker) {
            result = $breaker.$v;
            return $breaker;
          }

          slice = [];
        }
      };

      self.$each();

      if (result !== undefined) {
        return result;
      }

      // our "last" group, if smaller than n then won't have been yielded
      if (slice.length > 0) {
        if (Opal.yield1(block, slice) === $breaker) {
          return $breaker.$v;
        }
      }

      return nil;
    });

    Opal.defn(self, '$each_with_index', TMP_21 = function() {
      var $a, $b, TMP_22, self = this, $iter = TMP_21.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_21.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_22 = function(){var self = TMP_22.$$s || this;

        return self.$enumerator_size()}, TMP_22.$$s = self, TMP_22), $a).apply($b, ["each_with_index"].concat(Opal.to_a(args)))
      }
      
      var result,
          index = 0;

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments),
            value = block(param, index);

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }

        index++;
      };

      self.$each.apply(self, args);

      if (result !== undefined) {
        return result;
      }
    
      return self;
    });

    Opal.defn(self, '$each_with_object', TMP_23 = function(object) {
      var $a, $b, TMP_24, self = this, $iter = TMP_23.$$p, block = $iter || nil;

      TMP_23.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_24 = function(){var self = TMP_24.$$s || this;

        return self.$enumerator_size()}, TMP_24.$$s = self, TMP_24), $a).call($b, "each_with_object", object)
      }
      
      var result;

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments),
            value = block(param, object);

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }
      };

      self.$each();

      if (result !== undefined) {
        return result;
      }
    
      return object;
    });

    Opal.defn(self, '$entries', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      
      var result = [];

      self.$each.$$p = function() {
        result.push($scope.get('Opal').$destructure(arguments));
      };

      self.$each.apply(self, args);

      return result;
    
    });

    Opal.alias(self, 'find', 'detect');

    Opal.defn(self, '$find_all', TMP_25 = function() {
      var $a, $b, TMP_26, self = this, $iter = TMP_25.$$p, block = $iter || nil;

      TMP_25.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_26 = function(){var self = TMP_26.$$s || this;

        return self.$enumerator_size()}, TMP_26.$$s = self, TMP_26), $a).call($b, "find_all")
      }
      
      var result = [];

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments),
            value = Opal.yield1(block, param);

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }

        if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
          result.push(param);
        }
      };

      self.$each();

      return result;
    
    });

    Opal.defn(self, '$find_index', TMP_27 = function(object) {
      var $a, self = this, $iter = TMP_27.$$p, block = $iter || nil;

      TMP_27.$$p = null;
      if ((($a = object === undefined && block === nil) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$enum_for("find_index")}
      
      var result = nil,
          index  = 0;

      if (object != null) {
        self.$each.$$p = function() {
          var param = $scope.get('Opal').$destructure(arguments);

          if ((param)['$=='](object)) {
            result = index;
            return $breaker;
          }

          index += 1;
        };
      }
      else if (block !== nil) {
        self.$each.$$p = function() {
          var value = Opal.yieldX(block, arguments);

          if (value === $breaker) {
            result = $breaker.$v;
            return $breaker;
          }

          if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
            result = index;
            return $breaker;
          }

          index += 1;
        };
      }

      self.$each();

      return result;
    
    });

    Opal.defn(self, '$first', function(number) {
      var $a, self = this, result = nil;

      if ((($a = number === undefined) !== nil && (!$a.$$is_boolean || $a == true))) {
        result = nil;
        
        self.$each.$$p = function() {
          result = $scope.get('Opal').$destructure(arguments);

          return $breaker;
        };

        self.$each();

        } else {
        result = [];
        number = $scope.get('Opal').$coerce_to(number, $scope.get('Integer'), "to_int");
        if ((($a = number < 0) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('ArgumentError'), "attempt to take negative size")}
        if ((($a = number == 0) !== nil && (!$a.$$is_boolean || $a == true))) {
          return []}
        
        var current = 0;
        number = $scope.get('Opal').$coerce_to(number, $scope.get('Integer'), "to_int");

        self.$each.$$p = function() {
          result.push($scope.get('Opal').$destructure(arguments));

          if (number <= ++current) {
            return $breaker;
          }
        };

        self.$each();
      
      }
      return result;
    });

    Opal.alias(self, 'flat_map', 'collect_concat');

    Opal.defn(self, '$grep', TMP_28 = function(pattern) {
      var $a, self = this, $iter = TMP_28.$$p, block = $iter || nil;

      TMP_28.$$p = null;
      
      var result = [];

      if (block !== nil) {
        self.$each.$$p = function() {
          var param = $scope.get('Opal').$destructure(arguments),
              value = pattern['$==='](param);

          if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
            value = Opal.yield1(block, param);

            if (value === $breaker) {
              result = $breaker.$v;
              return $breaker;
            }

            result.push(value);
          }
        };
      }
      else {
        self.$each.$$p = function() {
          var param = $scope.get('Opal').$destructure(arguments),
              value = pattern['$==='](param);

          if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
            result.push(param);
          }
        };
      }

      self.$each();

      return result;

    });

    Opal.defn(self, '$group_by', TMP_29 = function() {
      var $a, $b, TMP_30, $c, $d, self = this, $iter = TMP_29.$$p, block = $iter || nil, hash = nil;

      TMP_29.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_30 = function(){var self = TMP_30.$$s || this;

        return self.$enumerator_size()}, TMP_30.$$s = self, TMP_30), $a).call($b, "group_by")
      }
      hash = $scope.get('Hash').$new();
      
      var result;

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments),
            value = Opal.yield1(block, param);

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }

        (($a = value, $c = hash, ((($d = $c['$[]']($a)) !== false && $d !== nil) ? $d : $c['$[]=']($a, []))))['$<<'](param);
      }

      self.$each();

      if (result !== undefined) {
        return result;
      }
    
      return hash;
    });

    Opal.defn(self, '$include?', function(obj) {
      var self = this;

      
      var result = false;

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments);

        if ((param)['$=='](obj)) {
          result = true;
          return $breaker;
        }
      }

      self.$each();

      return result;
    
    });

    Opal.defn(self, '$inject', TMP_31 = function(object, sym) {
      var self = this, $iter = TMP_31.$$p, block = $iter || nil;

      TMP_31.$$p = null;
      
      var result = object;

      if (block !== nil && sym === undefined) {
        self.$each.$$p = function() {
          var value = $scope.get('Opal').$destructure(arguments);

          if (result === undefined) {
            result = value;
            return;
          }

          value = Opal.yieldX(block, [result, value]);

          if (value === $breaker) {
            result = $breaker.$v;
            return $breaker;
          }

          result = value;
        };
      }
      else {
        if (sym === undefined) {
          if (!$scope.get('Symbol')['$==='](object)) {
            self.$raise($scope.get('TypeError'), "" + (object.$inspect()) + " is not a Symbol");
          }

          sym    = object;
          result = undefined;
        }

        self.$each.$$p = function() {
          var value = $scope.get('Opal').$destructure(arguments);

          if (result === undefined) {
            result = value;
            return;
          }

          result = (result).$__send__(sym, value);
        };
      }

      self.$each();

      return result == undefined ? nil : result;

    });

    Opal.defn(self, '$lazy', function() {
      var $a, $b, TMP_32, self = this;

      return ($a = ($b = (($scope.get('Enumerator')).$$scope.get('Lazy'))).$new, $a.$$p = (TMP_32 = function(enum$, args){var self = TMP_32.$$s || this, $a;
if (enum$ == null) enum$ = nil;args = $slice.call(arguments, 1);
      return ($a = enum$).$yield.apply($a, Opal.to_a(args))}, TMP_32.$$s = self, TMP_32), $a).call($b, self, self.$enumerator_size());
    });

    Opal.defn(self, '$enumerator_size', function() {
      var $a, self = this;

      if ((($a = self['$respond_to?']("size")) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$size()
        } else {
        return nil
      }
    });

    Opal.alias(self, 'map', 'collect');

    Opal.defn(self, '$max', TMP_33 = function() {
      var self = this, $iter = TMP_33.$$p, block = $iter || nil;

      TMP_33.$$p = null;
      
      var result;

      if (block !== nil) {
        self.$each.$$p = function() {
          var param = $scope.get('Opal').$destructure(arguments);

          if (result === undefined) {
            result = param;
            return;
          }

          var value = block(param, result);

          if (value === $breaker) {
            result = $breaker.$v;
            return $breaker;
          }

          if (value === nil) {
            self.$raise($scope.get('ArgumentError'), "comparison failed");
          }

          if (value > 0) {
            result = param;
          }
        };
      }
      else {
        self.$each.$$p = function() {
          var param = $scope.get('Opal').$destructure(arguments);

          if (result === undefined) {
            result = param;
            return;
          }

          if ($scope.get('Opal').$compare(param, result) > 0) {
            result = param;
          }
        };
      }

      self.$each();

      return result === undefined ? nil : result;
    
    });

    Opal.defn(self, '$max_by', TMP_34 = function() {
      var $a, $b, TMP_35, self = this, $iter = TMP_34.$$p, block = $iter || nil;

      TMP_34.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_35 = function(){var self = TMP_35.$$s || this;

        return self.$enumerator_size()}, TMP_35.$$s = self, TMP_35), $a).call($b, "max_by")
      }
      
      var result,
          by;

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments),
            value = Opal.yield1(block, param);

        if (result === undefined) {
          result = param;
          by     = value;
          return;
        }

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }

        if ((value)['$<=>'](by) > 0) {
          result = param
          by     = value;
        }
      };

      self.$each();

      return result === undefined ? nil : result;
    
    });

    Opal.alias(self, 'member?', 'include?');

    Opal.defn(self, '$min', TMP_36 = function() {
      var self = this, $iter = TMP_36.$$p, block = $iter || nil;

      TMP_36.$$p = null;
      
      var result;

      if (block !== nil) {
        self.$each.$$p = function() {
          var param = $scope.get('Opal').$destructure(arguments);

          if (result === undefined) {
            result = param;
            return;
          }

          var value = block(param, result);

          if (value === $breaker) {
            result = $breaker.$v;
            return $breaker;
          }

          if (value === nil) {
            self.$raise($scope.get('ArgumentError'), "comparison failed");
          }

          if (value < 0) {
            result = param;
          }
        };
      }
      else {
        self.$each.$$p = function() {
          var param = $scope.get('Opal').$destructure(arguments);

          if (result === undefined) {
            result = param;
            return;
          }

          if ($scope.get('Opal').$compare(param, result) < 0) {
            result = param;
          }
        };
      }

      self.$each();

      return result === undefined ? nil : result;
    
    });

    Opal.defn(self, '$min_by', TMP_37 = function() {
      var $a, $b, TMP_38, self = this, $iter = TMP_37.$$p, block = $iter || nil;

      TMP_37.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_38 = function(){var self = TMP_38.$$s || this;

        return self.$enumerator_size()}, TMP_38.$$s = self, TMP_38), $a).call($b, "min_by")
      }
      
      var result,
          by;

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments),
            value = Opal.yield1(block, param);

        if (result === undefined) {
          result = param;
          by     = value;
          return;
        }

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }

        if ((value)['$<=>'](by) < 0) {
          result = param
          by     = value;
        }
      };

      self.$each();

      return result === undefined ? nil : result;
    
    });

    Opal.defn(self, '$minmax', TMP_39 = function() {
      var $a, $b, $c, TMP_40, self = this, $iter = TMP_39.$$p, block = $iter || nil;

      TMP_39.$$p = null;
      ((($a = block) !== false && $a !== nil) ? $a : block = ($b = ($c = self).$proc, $b.$$p = (TMP_40 = function(a, b){var self = TMP_40.$$s || this;
if (a == null) a = nil;if (b == null) b = nil;
      return a['$<=>'](b)}, TMP_40.$$s = self, TMP_40), $b).call($c));
      
      var min = nil, max = nil, first_time = true;

      self.$each.$$p = function() {
        var element = $scope.get('Opal').$destructure(arguments);
        if (first_time) {
          min = max = element;
          first_time = false;
        } else {
          var min_cmp = block.$call(min, element);

          if (min_cmp === nil) {
            self.$raise($scope.get('ArgumentError'), "comparison failed")
          } else if (min_cmp > 0) {
            min = element;
          }

          var max_cmp = block.$call(max, element);

          if (max_cmp === nil) {
            self.$raise($scope.get('ArgumentError'), "comparison failed")
          } else if (max_cmp < 0) {
            max = element;
          }
        }
      }

      self.$each();

      return [min, max];
    
    });

    Opal.defn(self, '$minmax_by', TMP_41 = function() {
      var self = this, $iter = TMP_41.$$p, block = $iter || nil;

      TMP_41.$$p = null;
      return self.$raise($scope.get('NotImplementedError'));
    });

    Opal.defn(self, '$none?', TMP_42 = function() {
      var $a, self = this, $iter = TMP_42.$$p, block = $iter || nil;

      TMP_42.$$p = null;
      
      var result = true;

      if (block !== nil) {
        self.$each.$$p = function() {
          var value = Opal.yieldX(block, arguments);

          if (value === $breaker) {
            result = $breaker.$v;
            return $breaker;
          }

          if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
            result = false;
            return $breaker;
          }
        }
      }
      else {
        self.$each.$$p = function() {
          var value = $scope.get('Opal').$destructure(arguments);

          if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
            result = false;
            return $breaker;
          }
        };
      }

      self.$each();

      return result;
    
    });

    Opal.defn(self, '$one?', TMP_43 = function() {
      var $a, self = this, $iter = TMP_43.$$p, block = $iter || nil;

      TMP_43.$$p = null;
      
      var result = false;

      if (block !== nil) {
        self.$each.$$p = function() {
          var value = Opal.yieldX(block, arguments);

          if (value === $breaker) {
            result = $breaker.$v;
            return $breaker;
          }

          if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
            if (result === true) {
              result = false;
              return $breaker;
            }

            result = true;
          }
        }
      }
      else {
        self.$each.$$p = function() {
          var value = $scope.get('Opal').$destructure(arguments);

          if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
            if (result === true) {
              result = false;
              return $breaker;
            }

            result = true;
          }
        }
      }

      self.$each();

      return result;
    
    });

    Opal.defn(self, '$partition', TMP_44 = function() {
      var $a, $b, TMP_45, self = this, $iter = TMP_44.$$p, block = $iter || nil;

      TMP_44.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_45 = function(){var self = TMP_45.$$s || this;

        return self.$enumerator_size()}, TMP_45.$$s = self, TMP_45), $a).call($b, "partition")
      }
      
      var truthy = [], falsy = [], result;

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments),
            value = Opal.yield1(block, param);

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }

        if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
          truthy.push(param);
        }
        else {
          falsy.push(param);
        }
      };

      self.$each();

      return [truthy, falsy];
    
    });

    Opal.alias(self, 'reduce', 'inject');

    Opal.defn(self, '$reject', TMP_46 = function() {
      var $a, $b, TMP_47, self = this, $iter = TMP_46.$$p, block = $iter || nil;

      TMP_46.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_47 = function(){var self = TMP_47.$$s || this;

        return self.$enumerator_size()}, TMP_47.$$s = self, TMP_47), $a).call($b, "reject")
      }
      
      var result = [];

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments),
            value = Opal.yield1(block, param);

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }

        if ((($a = value) === nil || ($a.$$is_boolean && $a == false))) {
          result.push(param);
        }
      };

      self.$each();

      return result;
    
    });

    Opal.defn(self, '$reverse_each', TMP_48 = function() {
      var $a, $b, TMP_49, self = this, $iter = TMP_48.$$p, block = $iter || nil;

      TMP_48.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_49 = function(){var self = TMP_49.$$s || this;

        return self.$enumerator_size()}, TMP_49.$$s = self, TMP_49), $a).call($b, "reverse_each")
      }
      
      var result = [];

      self.$each.$$p = function() {
        result.push(arguments);
      };

      self.$each();

      for (var i = result.length - 1; i >= 0; i--) {
        Opal.yieldX(block, result[i]);
      }

      return result;
    
    });

    Opal.alias(self, 'select', 'find_all');

    Opal.defn(self, '$slice_before', TMP_50 = function(pattern) {
      var $a, $b, TMP_51, self = this, $iter = TMP_50.$$p, block = $iter || nil;

      TMP_50.$$p = null;
      if ((($a = pattern === undefined && block === nil || arguments.length > 1) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "wrong number of arguments (" + (arguments.length) + " for 1)")}
      return ($a = ($b = $scope.get('Enumerator')).$new, $a.$$p = (TMP_51 = function(e){var self = TMP_51.$$s || this, $a;
if (e == null) e = nil;
      
        var slice = [];

        if (block !== nil) {
          if (pattern === undefined) {
            self.$each.$$p = function() {
              var param = $scope.get('Opal').$destructure(arguments),
                  value = Opal.yield1(block, param);

              if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true)) && slice.length > 0) {
                e['$<<'](slice);
                slice = [];
              }

              slice.push(param);
            };
          }
          else {
            self.$each.$$p = function() {
              var param = $scope.get('Opal').$destructure(arguments),
                  value = block(param, pattern.$dup());

              if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true)) && slice.length > 0) {
                e['$<<'](slice);
                slice = [];
              }

              slice.push(param);
            };
          }
        }
        else {
          self.$each.$$p = function() {
            var param = $scope.get('Opal').$destructure(arguments),
                value = pattern['$==='](param);

            if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true)) && slice.length > 0) {
              e['$<<'](slice);
              slice = [];
            }

            slice.push(param);
          };
        }

        self.$each();

        if (slice.length > 0) {
          e['$<<'](slice);
        }
      }, TMP_51.$$s = self, TMP_51), $a).call($b);
    });

    Opal.defn(self, '$sort', TMP_52 = function() {
      var $a, $b, TMP_53, self = this, $iter = TMP_52.$$p, block = $iter || nil, ary = nil;

      TMP_52.$$p = null;
      ary = self.$to_a();
      if ((block !== nil)) {
        } else {
        block = ($a = ($b = self).$lambda, $a.$$p = (TMP_53 = function(a, b){var self = TMP_53.$$s || this;
if (a == null) a = nil;if (b == null) b = nil;
        return a['$<=>'](b)}, TMP_53.$$s = self, TMP_53), $a).call($b)
      }
      return ary.sort(block);
    });

    Opal.defn(self, '$sort_by', TMP_54 = function() {
      var $a, $b, TMP_55, $c, TMP_56, $d, TMP_57, $e, TMP_58, self = this, $iter = TMP_54.$$p, block = $iter || nil, dup = nil;

      TMP_54.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_55 = function(){var self = TMP_55.$$s || this;

        return self.$enumerator_size()}, TMP_55.$$s = self, TMP_55), $a).call($b, "sort_by")
      }
      dup = ($a = ($c = self).$map, $a.$$p = (TMP_56 = function(){var self = TMP_56.$$s || this, arg = nil;

      arg = $scope.get('Opal').$destructure(arguments);
        return [block.$call(arg), arg];}, TMP_56.$$s = self, TMP_56), $a).call($c);
      ($a = ($d = dup)['$sort!'], $a.$$p = (TMP_57 = function(a, b){var self = TMP_57.$$s || this;
if (a == null) a = nil;if (b == null) b = nil;
      return (a[0])['$<=>'](b[0])}, TMP_57.$$s = self, TMP_57), $a).call($d);
      return ($a = ($e = dup)['$map!'], $a.$$p = (TMP_58 = function(i){var self = TMP_58.$$s || this;
if (i == null) i = nil;
      return i[1];}, TMP_58.$$s = self, TMP_58), $a).call($e);
    });

    Opal.defn(self, '$take', function(num) {
      var self = this;

      return self.$first(num);
    });

    Opal.defn(self, '$take_while', TMP_59 = function() {
      var $a, self = this, $iter = TMP_59.$$p, block = $iter || nil;

      TMP_59.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.$enum_for("take_while")
      }
      
      var result = [];

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments),
            value = Opal.yield1(block, param);

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }

        if ((($a = value) === nil || ($a.$$is_boolean && $a == false))) {
          return $breaker;
        }

        result.push(param);
      };

      self.$each();

      return result;
    
    });

    Opal.alias(self, 'to_a', 'entries');

    Opal.defn(self, '$zip', TMP_60 = function() {
      var $a, self = this, $iter = TMP_60.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var others = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        others[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_60.$$p = null;
      return ($a = self.$to_a()).$zip.apply($a, Opal.to_a(others));
    });
  })($scope.base)
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/enumerator"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$require', '$include', '$allocate', '$new', '$to_proc', '$coerce_to', '$nil?', '$empty?', '$+', '$class', '$__send__', '$===', '$call', '$enum_for', '$size', '$destructure', '$inspect', '$[]', '$raise', '$yield', '$each', '$enumerator_size', '$respond_to?', '$try_convert', '$<', '$for']);
  self.$require("corelib/enumerable");
  return (function($base, $super) {
    function $Enumerator(){}
    var self = $Enumerator = $klass($base, $super, 'Enumerator', $Enumerator);

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2, TMP_3, TMP_4;

    def.size = def.args = def.object = def.method = nil;
    self.$include($scope.get('Enumerable'));

    def.$$is_enumerator = true;

    Opal.defs(self, '$for', TMP_1 = function(object, method) {
      var self = this, $iter = TMP_1.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 2;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 2];
      }
      if (method == null) {
        method = "each"
      }
      TMP_1.$$p = null;
      
      var obj = self.$allocate();

      obj.object = object;
      obj.size   = block;
      obj.method = method;
      obj.args   = args;

      return obj;

    });

    Opal.defn(self, '$initialize', TMP_2 = function() {
      var $a, $b, self = this, $iter = TMP_2.$$p, block = $iter || nil;

      TMP_2.$$p = null;
      if (block !== false && block !== nil) {
        self.object = ($a = ($b = $scope.get('Generator')).$new, $a.$$p = block.$to_proc(), $a).call($b);
        self.method = "each";
        self.args = [];
        self.size = arguments[0] || nil;
        if ((($a = self.size) !== nil && (!$a.$$is_boolean || $a == true))) {
          return self.size = $scope.get('Opal').$coerce_to(self.size, $scope.get('Integer'), "to_int")
          } else {
          return nil
        }
        } else {
        self.object = arguments[0];
        self.method = arguments[1] || "each";
        self.args = $slice.call(arguments, 2);
        return self.size = nil;
      }
    });

    Opal.defn(self, '$each', TMP_3 = function() {
      var $a, $b, $c, self = this, $iter = TMP_3.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_3.$$p = null;
      if ((($a = ($b = block['$nil?'](), $b !== false && $b !== nil ?args['$empty?']() : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self}
      args = $rb_plus(self.args, args);
      if ((($a = block['$nil?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        return ($a = self.$class()).$new.apply($a, [self.object, self.method].concat(Opal.to_a(args)))}
      return ($b = ($c = self.object).$__send__, $b.$$p = block.$to_proc(), $b).apply($c, [self.method].concat(Opal.to_a(args)));
    });

    Opal.defn(self, '$size', function() {
      var $a, self = this;

      if ((($a = $scope.get('Proc')['$==='](self.size)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return ($a = self.size).$call.apply($a, Opal.to_a(self.args))
        } else {
        return self.size
      }
    });

    Opal.defn(self, '$with_index', TMP_4 = function(offset) {
      var $a, $b, TMP_5, self = this, $iter = TMP_4.$$p, block = $iter || nil;

      if (offset == null) {
        offset = 0
      }
      TMP_4.$$p = null;
      if (offset !== false && offset !== nil) {
        offset = $scope.get('Opal').$coerce_to(offset, $scope.get('Integer'), "to_int")
        } else {
        offset = 0
      }
      if (block !== false && block !== nil) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_5 = function(){var self = TMP_5.$$s || this;

        return self.$size()}, TMP_5.$$s = self, TMP_5), $a).call($b, "with_index", offset)
      }
      
      var result, index = offset;

      self.$each.$$p = function() {
        var param = $scope.get('Opal').$destructure(arguments),
            value = block(param, index);

        if (value === $breaker) {
          result = $breaker.$v;
          return $breaker;
        }

        index++;

        return value;
      }

      self.$each();

      if (result !== undefined) {
        return result;
      }

      return self.object;
    
    });

    Opal.alias(self, 'with_object', 'each_with_object');

    Opal.defn(self, '$inspect', function() {
      var $a, self = this, result = nil;

      result = "#<" + (self.$class()) + ": " + (self.object.$inspect()) + ":" + (self.method);
      if ((($a = self.args['$empty?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        result = $rb_plus(result, "(" + (self.args.$inspect()['$[]']($scope.get('Range').$new(1, -2))) + ")")
      }
      return $rb_plus(result, ">");
    });

    (function($base, $super) {
      function $Generator(){}
      var self = $Generator = $klass($base, $super, 'Generator', $Generator);

      var def = self.$$proto, $scope = self.$$scope, TMP_6, TMP_7;

      def.block = nil;
      self.$include($scope.get('Enumerable'));

      Opal.defn(self, '$initialize', TMP_6 = function() {
        var self = this, $iter = TMP_6.$$p, block = $iter || nil;

        TMP_6.$$p = null;
        if (block !== false && block !== nil) {
          } else {
          self.$raise($scope.get('LocalJumpError'), "no block given")
        }
        return self.block = block;
      });

      return (Opal.defn(self, '$each', TMP_7 = function() {
        var $a, $b, self = this, $iter = TMP_7.$$p, block = $iter || nil, yielder = nil, $splat_index = nil;

        var array_size = arguments.length - 0;
        if(array_size < 0) array_size = 0;
        var args = new Array(array_size);
        for($splat_index = 0; $splat_index < array_size; $splat_index++) {
          args[$splat_index] = arguments[$splat_index + 0];
        }
        TMP_7.$$p = null;
        yielder = ($a = ($b = $scope.get('Yielder')).$new, $a.$$p = block.$to_proc(), $a).call($b);
        
        try {
          args.unshift(yielder);

          if (Opal.yieldX(self.block, args) === $breaker) {
            return $breaker.$v;
          }
        }
        catch (e) {
          if (e === $breaker) {
            return $breaker.$v;
          }
          else {
            throw e;
          }
        }

        return self;
      }), nil) && 'each';
    })($scope.base, null);

    (function($base, $super) {
      function $Yielder(){}
      var self = $Yielder = $klass($base, $super, 'Yielder', $Yielder);

      var def = self.$$proto, $scope = self.$$scope, TMP_8;

      def.block = nil;
      Opal.defn(self, '$initialize', TMP_8 = function() {
        var self = this, $iter = TMP_8.$$p, block = $iter || nil;

        TMP_8.$$p = null;
        return self.block = block;
      });

      Opal.defn(self, '$yield', function() {
        var self = this, $splat_index = nil;

        var array_size = arguments.length - 0;
        if(array_size < 0) array_size = 0;
        var values = new Array(array_size);
        for($splat_index = 0; $splat_index < array_size; $splat_index++) {
          values[$splat_index] = arguments[$splat_index + 0];
        }
        
        var value = Opal.yieldX(self.block, values);

        if (value === $breaker) {
          throw $breaker;
        }

        return value;

      });

      return (Opal.defn(self, '$<<', function() {
        var $a, self = this, $splat_index = nil;

        var array_size = arguments.length - 0;
        if(array_size < 0) array_size = 0;
        var values = new Array(array_size);
        for($splat_index = 0; $splat_index < array_size; $splat_index++) {
          values[$splat_index] = arguments[$splat_index + 0];
        }
        ($a = self).$yield.apply($a, Opal.to_a(values));
        return self;
      }), nil) && '<<';
    })($scope.base, null);

    return (function($base, $super) {
      function $Lazy(){}
      var self = $Lazy = $klass($base, $super, 'Lazy', $Lazy);

      var def = self.$$proto, $scope = self.$$scope, TMP_9, TMP_12, TMP_14, TMP_19, TMP_21, TMP_22, TMP_24, TMP_27, TMP_30;

      def.enumerator = nil;
      (function($base, $super) {
        function $StopLazyError(){}
        var self = $StopLazyError = $klass($base, $super, 'StopLazyError', $StopLazyError);

        var def = self.$$proto, $scope = self.$$scope;

        return nil;
      })($scope.base, $scope.get('Exception'));

      Opal.defn(self, '$initialize', TMP_9 = function(object, size) {
        var TMP_10, self = this, $iter = TMP_9.$$p, block = $iter || nil;

        if (size == null) {
          size = nil
        }
        TMP_9.$$p = null;
        if ((block !== nil)) {
          } else {
          self.$raise($scope.get('ArgumentError'), "tried to call lazy new without a block")
        }
        self.enumerator = object;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_9, (TMP_10 = function(yielder, each_args){var self = TMP_10.$$s || this, $a, $b, TMP_11;
if (yielder == null) yielder = nil;each_args = $slice.call(arguments, 1);
        try {
          return ($a = ($b = object).$each, $a.$$p = (TMP_11 = function(args){var self = TMP_11.$$s || this;
args = $slice.call(arguments, 0);
            
              args.unshift(yielder);

              if (Opal.yieldX(block, args) === $breaker) {
                return $breaker;
              }
            }, TMP_11.$$s = self, TMP_11), $a).apply($b, Opal.to_a(each_args))
          } catch ($err) {if (Opal.rescue($err, [$scope.get('Exception')])) {
            try {
              return nil
            } finally {
              Opal.gvars["!"] = Opal.exceptions.pop() || Opal.nil;
            }
            }else { throw $err; }
          }}, TMP_10.$$s = self, TMP_10)).apply(self, [size]);
      });

      Opal.alias(self, 'force', 'to_a');

      Opal.defn(self, '$lazy', function() {
        var self = this;

        return self;
      });

      Opal.defn(self, '$collect', TMP_12 = function() {
        var $a, $b, TMP_13, self = this, $iter = TMP_12.$$p, block = $iter || nil;

        TMP_12.$$p = null;
        if (block !== false && block !== nil) {
          } else {
          self.$raise($scope.get('ArgumentError'), "tried to call lazy map without a block")
        }
        return ($a = ($b = $scope.get('Lazy')).$new, $a.$$p = (TMP_13 = function(enum$, args){var self = TMP_13.$$s || this;
if (enum$ == null) enum$ = nil;args = $slice.call(arguments, 1);
        
          var value = Opal.yieldX(block, args);

          if (value === $breaker) {
            return $breaker;
          }

          enum$.$yield(value);
        }, TMP_13.$$s = self, TMP_13), $a).call($b, self, self.$enumerator_size());
      });

      Opal.defn(self, '$collect_concat', TMP_14 = function() {
        var $a, $b, TMP_15, self = this, $iter = TMP_14.$$p, block = $iter || nil;

        TMP_14.$$p = null;
        if (block !== false && block !== nil) {
          } else {
          self.$raise($scope.get('ArgumentError'), "tried to call lazy map without a block")
        }
        return ($a = ($b = $scope.get('Lazy')).$new, $a.$$p = (TMP_15 = function(enum$, args){var self = TMP_15.$$s || this, $a, $b, TMP_16, $c, TMP_17;
if (enum$ == null) enum$ = nil;args = $slice.call(arguments, 1);
        
          var value = Opal.yieldX(block, args);

          if (value === $breaker) {
            return $breaker;
          }

          if ((value)['$respond_to?']("force") && (value)['$respond_to?']("each")) {
            ($a = ($b = (value)).$each, $a.$$p = (TMP_16 = function(v){var self = TMP_16.$$s || this;
if (v == null) v = nil;
          return enum$.$yield(v)}, TMP_16.$$s = self, TMP_16), $a).call($b)
          }
          else {
            var array = $scope.get('Opal').$try_convert(value, $scope.get('Array'), "to_ary");

            if (array === nil) {
              enum$.$yield(value);
            }
            else {
              ($a = ($c = (value)).$each, $a.$$p = (TMP_17 = function(v){var self = TMP_17.$$s || this;
if (v == null) v = nil;
          return enum$.$yield(v)}, TMP_17.$$s = self, TMP_17), $a).call($c);
            }
          }
        }, TMP_15.$$s = self, TMP_15), $a).call($b, self, nil);
      });

      Opal.defn(self, '$drop', function(n) {
        var $a, $b, TMP_18, self = this, current_size = nil, set_size = nil, dropped = nil;

        n = $scope.get('Opal').$coerce_to(n, $scope.get('Integer'), "to_int");
        if ((($a = $rb_lt(n, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('ArgumentError'), "attempt to drop negative size")}
        current_size = self.$enumerator_size();
        set_size = (function() {if ((($a = $scope.get('Integer')['$==='](current_size)) !== nil && (!$a.$$is_boolean || $a == true))) {
          if ((($a = $rb_lt(n, current_size)) !== nil && (!$a.$$is_boolean || $a == true))) {
            return n
            } else {
            return current_size
          }
          } else {
          return current_size
        } return nil; })();
        dropped = 0;
        return ($a = ($b = $scope.get('Lazy')).$new, $a.$$p = (TMP_18 = function(enum$, args){var self = TMP_18.$$s || this, $a;
if (enum$ == null) enum$ = nil;args = $slice.call(arguments, 1);
        if ((($a = $rb_lt(dropped, n)) !== nil && (!$a.$$is_boolean || $a == true))) {
            return dropped = $rb_plus(dropped, 1)
            } else {
            return ($a = enum$).$yield.apply($a, Opal.to_a(args))
          }}, TMP_18.$$s = self, TMP_18), $a).call($b, self, set_size);
      });

      Opal.defn(self, '$drop_while', TMP_19 = function() {
        var $a, $b, TMP_20, self = this, $iter = TMP_19.$$p, block = $iter || nil, succeeding = nil;

        TMP_19.$$p = null;
        if (block !== false && block !== nil) {
          } else {
          self.$raise($scope.get('ArgumentError'), "tried to call lazy drop_while without a block")
        }
        succeeding = true;
        return ($a = ($b = $scope.get('Lazy')).$new, $a.$$p = (TMP_20 = function(enum$, args){var self = TMP_20.$$s || this, $a, $b;
if (enum$ == null) enum$ = nil;args = $slice.call(arguments, 1);
        if (succeeding !== false && succeeding !== nil) {
            
            var value = Opal.yieldX(block, args);

            if (value === $breaker) {
              return $breaker;
            }

            if ((($a = value) === nil || ($a.$$is_boolean && $a == false))) {
              succeeding = false;

              ($a = enum$).$yield.apply($a, Opal.to_a(args));
            }
          
            } else {
            return ($b = enum$).$yield.apply($b, Opal.to_a(args))
          }}, TMP_20.$$s = self, TMP_20), $a).call($b, self, nil);
      });

      Opal.defn(self, '$enum_for', TMP_21 = function(method) {
        var $a, $b, self = this, $iter = TMP_21.$$p, block = $iter || nil, $splat_index = nil;

        var array_size = arguments.length - 1;
        if(array_size < 0) array_size = 0;
        var args = new Array(array_size);
        for($splat_index = 0; $splat_index < array_size; $splat_index++) {
          args[$splat_index] = arguments[$splat_index + 1];
        }
        if (method == null) {
          method = "each"
        }
        TMP_21.$$p = null;
        return ($a = ($b = self.$class()).$for, $a.$$p = block.$to_proc(), $a).apply($b, [self, method].concat(Opal.to_a(args)));
      });

      Opal.defn(self, '$find_all', TMP_22 = function() {
        var $a, $b, TMP_23, self = this, $iter = TMP_22.$$p, block = $iter || nil;

        TMP_22.$$p = null;
        if (block !== false && block !== nil) {
          } else {
          self.$raise($scope.get('ArgumentError'), "tried to call lazy select without a block")
        }
        return ($a = ($b = $scope.get('Lazy')).$new, $a.$$p = (TMP_23 = function(enum$, args){var self = TMP_23.$$s || this, $a;
if (enum$ == null) enum$ = nil;args = $slice.call(arguments, 1);
        
          var value = Opal.yieldX(block, args);

          if (value === $breaker) {
            return $breaker;
          }

          if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
            ($a = enum$).$yield.apply($a, Opal.to_a(args));
          }
        }, TMP_23.$$s = self, TMP_23), $a).call($b, self, nil);
      });

      Opal.alias(self, 'flat_map', 'collect_concat');

      Opal.defn(self, '$grep', TMP_24 = function(pattern) {
        var $a, $b, TMP_25, $c, TMP_26, self = this, $iter = TMP_24.$$p, block = $iter || nil;

        TMP_24.$$p = null;
        if (block !== false && block !== nil) {
          return ($a = ($b = $scope.get('Lazy')).$new, $a.$$p = (TMP_25 = function(enum$, args){var self = TMP_25.$$s || this, $a;
if (enum$ == null) enum$ = nil;args = $slice.call(arguments, 1);
          
            var param = $scope.get('Opal').$destructure(args),
                value = pattern['$==='](param);

            if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
              value = Opal.yield1(block, param);

              if (value === $breaker) {
                return $breaker;
              }

              enum$.$yield(Opal.yield1(block, param));
            }
          }, TMP_25.$$s = self, TMP_25), $a).call($b, self, nil)
          } else {
          return ($a = ($c = $scope.get('Lazy')).$new, $a.$$p = (TMP_26 = function(enum$, args){var self = TMP_26.$$s || this, $a;
if (enum$ == null) enum$ = nil;args = $slice.call(arguments, 1);
          
            var param = $scope.get('Opal').$destructure(args),
                value = pattern['$==='](param);

            if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
              enum$.$yield(param);
            }
          }, TMP_26.$$s = self, TMP_26), $a).call($c, self, nil)
        }
      });

      Opal.alias(self, 'map', 'collect');

      Opal.alias(self, 'select', 'find_all');

      Opal.defn(self, '$reject', TMP_27 = function() {
        var $a, $b, TMP_28, self = this, $iter = TMP_27.$$p, block = $iter || nil;

        TMP_27.$$p = null;
        if (block !== false && block !== nil) {
          } else {
          self.$raise($scope.get('ArgumentError'), "tried to call lazy reject without a block")
        }
        return ($a = ($b = $scope.get('Lazy')).$new, $a.$$p = (TMP_28 = function(enum$, args){var self = TMP_28.$$s || this, $a;
if (enum$ == null) enum$ = nil;args = $slice.call(arguments, 1);
        
          var value = Opal.yieldX(block, args);

          if (value === $breaker) {
            return $breaker;
          }

          if ((($a = value) === nil || ($a.$$is_boolean && $a == false))) {
            ($a = enum$).$yield.apply($a, Opal.to_a(args));
          }
        }, TMP_28.$$s = self, TMP_28), $a).call($b, self, nil);
      });

      Opal.defn(self, '$take', function(n) {
        var $a, $b, TMP_29, self = this, current_size = nil, set_size = nil, taken = nil;

        n = $scope.get('Opal').$coerce_to(n, $scope.get('Integer'), "to_int");
        if ((($a = $rb_lt(n, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('ArgumentError'), "attempt to take negative size")}
        current_size = self.$enumerator_size();
        set_size = (function() {if ((($a = $scope.get('Integer')['$==='](current_size)) !== nil && (!$a.$$is_boolean || $a == true))) {
          if ((($a = $rb_lt(n, current_size)) !== nil && (!$a.$$is_boolean || $a == true))) {
            return n
            } else {
            return current_size
          }
          } else {
          return current_size
        } return nil; })();
        taken = 0;
        return ($a = ($b = $scope.get('Lazy')).$new, $a.$$p = (TMP_29 = function(enum$, args){var self = TMP_29.$$s || this, $a;
if (enum$ == null) enum$ = nil;args = $slice.call(arguments, 1);
        if ((($a = $rb_lt(taken, n)) !== nil && (!$a.$$is_boolean || $a == true))) {
            ($a = enum$).$yield.apply($a, Opal.to_a(args));
            return taken = $rb_plus(taken, 1);
            } else {
            return self.$raise($scope.get('StopLazyError'))
          }}, TMP_29.$$s = self, TMP_29), $a).call($b, self, set_size);
      });

      Opal.defn(self, '$take_while', TMP_30 = function() {
        var $a, $b, TMP_31, self = this, $iter = TMP_30.$$p, block = $iter || nil;

        TMP_30.$$p = null;
        if (block !== false && block !== nil) {
          } else {
          self.$raise($scope.get('ArgumentError'), "tried to call lazy take_while without a block")
        }
        return ($a = ($b = $scope.get('Lazy')).$new, $a.$$p = (TMP_31 = function(enum$, args){var self = TMP_31.$$s || this, $a;
if (enum$ == null) enum$ = nil;args = $slice.call(arguments, 1);
        
          var value = Opal.yieldX(block, args);

          if (value === $breaker) {
            return $breaker;
          }

          if ((($a = value) !== nil && (!$a.$$is_boolean || $a == true))) {
            ($a = enum$).$yield.apply($a, Opal.to_a(args));
          }
          else {
            self.$raise($scope.get('StopLazyError'));
          }
        }, TMP_31.$$s = self, TMP_31), $a).call($b, self, nil);
      });

      Opal.alias(self, 'to_enum', 'enum_for');

      return (Opal.defn(self, '$inspect', function() {
        var self = this;

        return "#<" + (self.$class()) + ": " + (self.enumerator.$inspect()) + ">";
      }), nil) && 'inspect';
    })($scope.base, self);
  })($scope.base, null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/numeric"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_times(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs * rhs : lhs['$*'](rhs);
  }
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$require', '$include', '$instance_of?', '$class', '$Float', '$coerce', '$===', '$raise', '$__send__', '$equal?', '$coerce_to!', '$-@', '$**', '$-', '$*', '$div', '$<', '$ceil', '$to_f', '$denominator', '$to_r', '$==', '$floor', '$/', '$%', '$Complex', '$zero?', '$numerator', '$abs', '$arg', '$round', '$to_i', '$truncate', '$>']);
  self.$require("corelib/comparable");
  return (function($base, $super) {
    function $Numeric(){}
    var self = $Numeric = $klass($base, $super, 'Numeric', $Numeric);

    var def = self.$$proto, $scope = self.$$scope;

    self.$include($scope.get('Comparable'));

    Opal.defn(self, '$coerce', function(other) {
      var $a, self = this;

      if ((($a = other['$instance_of?'](self.$class())) !== nil && (!$a.$$is_boolean || $a == true))) {
        return [other, self]}
      return [self.$Float(other), self.$Float(self)];
    });

    Opal.defn(self, '$__coerced__', function(method, other) {
      var $a, $b, self = this, a = nil, b = nil, $case = nil;

      try {
      $b = other.$coerce(self), $a = Opal.to_ary($b), a = ($a[0] == null ? nil : $a[0]), b = ($a[1] == null ? nil : $a[1]), $b
      } catch ($err) {if (true) {
        try {
          $case = method;if ("+"['$===']($case) || "-"['$===']($case) || "*"['$===']($case) || "/"['$===']($case) || "%"['$===']($case) || "&"['$===']($case) || "|"['$===']($case) || "^"['$===']($case) || "**"['$===']($case)) {self.$raise($scope.get('TypeError'), "" + (other.$class()) + " can't be coerce into Numeric")}else if (">"['$===']($case) || ">="['$===']($case) || "<"['$===']($case) || "<="['$===']($case) || "<=>"['$===']($case)) {self.$raise($scope.get('ArgumentError'), "comparison of " + (self.$class()) + " with " + (other.$class()) + " failed")}
        } finally {
          Opal.gvars["!"] = Opal.exceptions.pop() || Opal.nil;
        }
        }else { throw $err; }
      }
      return a.$__send__(method, b);
    });

    Opal.defn(self, '$<=>', function(other) {
      var $a, self = this;

      if ((($a = self['$equal?'](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return 0}
      return nil;
    });

    Opal.defn(self, '$[]', function(bit) {
      var self = this, min = nil, max = nil;

      bit = $scope.get('Opal')['$coerce_to!'](bit, $scope.get('Integer'), "to_int");
      min = ((2)['$**'](30))['$-@']();
      max = $rb_minus(((2)['$**'](30)), 1);
      return (bit < min || bit > max) ? 0 : (self >> bit) % 2;
    });

    Opal.defn(self, '$+@', function() {
      var self = this;

      return self;
    });

    Opal.defn(self, '$-@', function() {
      var self = this;

      return $rb_minus(0, self);
    });

    Opal.defn(self, '$%', function(other) {
      var self = this;

      return $rb_minus(self, $rb_times(other, self.$div(other)));
    });

    Opal.defn(self, '$abs', function() {
      var self = this;

      if ($rb_lt(self, 0)) {
        return self['$-@']()
        } else {
        return self
      }
    });

    Opal.defn(self, '$abs2', function() {
      var self = this;

      return $rb_times(self, self);
    });

    Opal.defn(self, '$angle', function() {
      var self = this;

      if ($rb_lt(self, 0)) {
        return (($scope.get('Math')).$$scope.get('PI'))
        } else {
        return 0
      }
    });

    Opal.alias(self, 'arg', 'angle');

    Opal.defn(self, '$ceil', function() {
      var self = this;

      return self.$to_f().$ceil();
    });

    Opal.defn(self, '$conj', function() {
      var self = this;

      return self;
    });

    Opal.alias(self, 'conjugate', 'conj');

    Opal.defn(self, '$denominator', function() {
      var self = this;

      return self.$to_r().$denominator();
    });

    Opal.defn(self, '$div', function(other) {
      var self = this;

      if (other['$=='](0)) {
        self.$raise($scope.get('ZeroDivisionError'), "divided by o")}
      return ($rb_divide(self, other)).$floor();
    });

    Opal.defn(self, '$divmod', function(other) {
      var self = this;

      return [self.$div(other), self['$%'](other)];
    });

    Opal.defn(self, '$fdiv', function(other) {
      var self = this;

      return $rb_divide(self.$to_f(), other);
    });

    Opal.defn(self, '$floor', function() {
      var self = this;

      return self.$to_f().$floor();
    });

    Opal.defn(self, '$i', function() {
      var self = this;

      return self.$Complex(0, self);
    });

    Opal.defn(self, '$imag', function() {
      var self = this;

      return 0;
    });

    Opal.alias(self, 'imaginary', 'imag');

    Opal.defn(self, '$integer?', function() {
      var self = this;

      return false;
    });

    Opal.alias(self, 'magnitude', 'abs');

    Opal.alias(self, 'modulo', '%');

    Opal.defn(self, '$nonzero?', function() {
      var $a, self = this;

      if ((($a = self['$zero?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        return nil
        } else {
        return self
      }
    });

    Opal.defn(self, '$numerator', function() {
      var self = this;

      return self.$to_r().$numerator();
    });

    Opal.alias(self, 'phase', 'arg');

    Opal.defn(self, '$polar', function() {
      var self = this;

      return [self.$abs(), self.$arg()];
    });

    Opal.defn(self, '$quo', function(other) {
      var self = this;

      return $rb_divide($scope.get('Opal')['$coerce_to!'](self, $scope.get('Rational'), "to_r"), other);
    });

    Opal.defn(self, '$real', function() {
      var self = this;

      return self;
    });

    Opal.defn(self, '$real?', function() {
      var self = this;

      return true;
    });

    Opal.defn(self, '$rect', function() {
      var self = this;

      return [self, 0];
    });

    Opal.alias(self, 'rectangular', 'rect');

    Opal.defn(self, '$round', function(digits) {
      var self = this;

      return self.$to_f().$round(digits);
    });

    Opal.defn(self, '$to_c', function() {
      var self = this;

      return self.$Complex(self, 0);
    });

    Opal.defn(self, '$to_int', function() {
      var self = this;

      return self.$to_i();
    });

    Opal.defn(self, '$truncate', function() {
      var self = this;

      return self.$to_f().$truncate();
    });

    Opal.defn(self, '$zero?', function() {
      var self = this;

      return self['$=='](0);
    });

    Opal.defn(self, '$positive?', function() {
      var self = this;

      return $rb_gt(self, 0);
    });

    Opal.defn(self, '$negative?', function() {
      var self = this;

      return $rb_lt(self, 0);
    });

    Opal.defn(self, '$dup', function() {
      var self = this;

      return self.$raise($scope.get('TypeError'), "can't dup " + (self.$class()));
    });

    return (Opal.defn(self, '$clone', function() {
      var self = this;

      return self.$raise($scope.get('TypeError'), "can't clone " + (self.$class()));
    }), nil) && 'clone';
  })($scope.base, null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/array"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  function $rb_times(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs * rhs : lhs['$*'](rhs);
  }
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $hash2 = Opal.hash2, $gvars = Opal.gvars;

  Opal.add_stubs(['$require', '$include', '$raise', '$===', '$to_a', '$respond_to?', '$to_ary', '$coerce_to', '$initialize', '$to_proc', '$coerce_to?', '$join', '$to_str', '$class', '$clone', '$hash', '$<=>', '$==', '$object_id', '$inspect', '$enum_for', '$coerce_to!', '$>', '$*', '$enumerator_size', '$empty?', '$copy_singleton_methods', '$initialize_clone', '$initialize_dup', '$replace', '$size', '$eql?', '$length', '$begin', '$end', '$exclude_end?', '$flatten', '$__id__', '$[]', '$to_s', '$new', '$!', '$delete_if', '$each', '$reverse', '$rotate', '$rand', '$at', '$keep_if', '$shuffle!', '$dup', '$<', '$sort', '$!=', '$times', '$[]=', '$<<', '$kind_of?', '$last', '$first', '$upto']);
  self.$require("corelib/enumerable");
  self.$require("corelib/numeric");
  return (function($base, $super) {
    function $Array(){}
    var self = $Array = $klass($base, $super, 'Array', $Array);

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_6, TMP_8, TMP_10, TMP_12, TMP_13, TMP_15, TMP_17, TMP_19, TMP_20, TMP_21, TMP_22, TMP_24, TMP_26, TMP_27, TMP_29, TMP_31, TMP_33, TMP_34, TMP_36, TMP_38, TMP_39, TMP_40, TMP_43, TMP_44, TMP_47;

    def.length = nil;
    self.$include($scope.get('Enumerable'));

    def.$$is_array = true;

    Opal.defs(self, '$[]', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var objects = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        objects[$splat_index] = arguments[$splat_index + 0];
      }
      return objects;
    });

    Opal.defn(self, '$initialize', TMP_1 = function(size, obj) {
      var $a, self = this, $iter = TMP_1.$$p, block = $iter || nil;

      if (size == null) {
        size = nil
      }
      if (obj == null) {
        obj = nil
      }
      TMP_1.$$p = null;
      if ((($a = arguments.length > 2) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "wrong number of arguments (" + (arguments.length) + " for 0..2)")}
      
      if (arguments.length === 0) {
        self.splice(0, self.length);
        return self;
      }
    
      if ((($a = arguments.length === 1) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = $scope.get('Array')['$==='](size)) !== nil && (!$a.$$is_boolean || $a == true))) {
          return size.$to_a()
        } else if ((($a = size['$respond_to?']("to_ary")) !== nil && (!$a.$$is_boolean || $a == true))) {
          return size.$to_ary()}}
      size = $scope.get('Opal').$coerce_to(size, $scope.get('Integer'), "to_int");
      if ((($a = size < 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "negative array size")}
      
      self.splice(0, self.length);
      var i, value;

      if (block === nil) {
        for (i = 0; i < size; i++) {
          self.push(obj);
        }
      }
      else {
        for (i = 0, value; i < size; i++) {
          value = block(i);

          if (value === $breaker) {
            return $breaker.$v;
          }

          self[i] = value;
        }
      }

      return self;
    
    });

    Opal.defs(self, '$new', TMP_2 = function() {
      var $a, $b, self = this, $iter = TMP_2.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_2.$$p = null;
      return ($a = ($b = []).$initialize, $a.$$p = block.$to_proc(), $a).apply($b, Opal.to_a(args));
    });

    Opal.defs(self, '$try_convert', function(obj) {
      var self = this;

      return $scope.get('Opal')['$coerce_to?'](obj, $scope.get('Array'), "to_ary");
    });

    Opal.defn(self, '$&', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Array')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        other = other.$to_a()
        } else {
        other = $scope.get('Opal').$coerce_to(other, $scope.get('Array'), "to_ary").$to_a()
      }
      
      var result = [], hash = $hash2([], {}), i, length, item;

      for (i = 0, length = other.length; i < length; i++) {
        Opal.hash_put(hash, other[i], true);
      }

      for (i = 0, length = self.length; i < length; i++) {
        item = self[i];
        if (Opal.hash_delete(hash, item) !== undefined) {
          result.push(item);
        }
      }

      return result;

    });

    Opal.defn(self, '$|', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Array')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        other = other.$to_a()
        } else {
        other = $scope.get('Opal').$coerce_to(other, $scope.get('Array'), "to_ary").$to_a()
      }
      
      var hash = $hash2([], {}), i, length, item;

      for (i = 0, length = self.length; i < length; i++) {
        Opal.hash_put(hash, self[i], true);
      }

      for (i = 0, length = other.length; i < length; i++) {
        Opal.hash_put(hash, other[i], true);
      }

      return hash.$keys();

    });

    Opal.defn(self, '$*', function(other) {
      var $a, self = this;

      if ((($a = other['$respond_to?']("to_str")) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$join(other.$to_str())}
      if ((($a = other['$respond_to?']("to_int")) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('TypeError'), "no implicit conversion of " + (other.$class()) + " into Integer")
      }
      other = $scope.get('Opal').$coerce_to(other, $scope.get('Integer'), "to_int");
      if ((($a = other < 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "negative argument")}
      
      var result = [];

      for (var i = 0; i < other; i++) {
        result = result.concat(self);
      }

      return result;
    
    });

    Opal.defn(self, '$+', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Array')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        other = other.$to_a()
        } else {
        other = $scope.get('Opal').$coerce_to(other, $scope.get('Array'), "to_ary").$to_a()
      }
      return self.concat(other);
    });

    Opal.defn(self, '$-', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Array')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        other = other.$to_a()
        } else {
        other = $scope.get('Opal').$coerce_to(other, $scope.get('Array'), "to_ary").$to_a()
      }
      if ((($a = self.length === 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        return []}
      if ((($a = other.length === 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$clone()}
      
      var result = [], hash = $hash2([], {}), i, length, item;

      for (i = 0, length = other.length; i < length; i++) {
        Opal.hash_put(hash, other[i], true);
      }

      for (i = 0, length = self.length; i < length; i++) {
        item = self[i];
        if (Opal.hash_get(hash, item) === undefined) {
          result.push(item);
        }
      }

      return result;

    });

    Opal.defn(self, '$<<', function(object) {
      var self = this;

      self.push(object);
      return self;
    });

    Opal.defn(self, '$<=>', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Array')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        other = other.$to_a()
      } else if ((($a = other['$respond_to?']("to_ary")) !== nil && (!$a.$$is_boolean || $a == true))) {
        other = other.$to_ary().$to_a()
        } else {
        return nil
      }
      
      if (self.$hash() === other.$hash()) {
        return 0;
      }

      var count = Math.min(self.length, other.length);

      for (var i = 0; i < count; i++) {
        var tmp = (self[i])['$<=>'](other[i]);

        if (tmp !== 0) {
          return tmp;
        }
      }

      return (self.length)['$<=>'](other.length);

    });

    Opal.defn(self, '$==', function(other) {
      var self = this;

      
      var recursed = {};

      function _eqeq(array, other) {
        var i, length, a, b;

        if (array === other)
          return true;

        if (!other.$$is_array) {
          if ($scope.get('Opal')['$respond_to?'](other, "to_ary")) {
            return (other)['$=='](array);
          } else {
            return false;
          }
        }

        if (array.constructor !== Array)
          array = array.literal;
        if (other.constructor !== Array)
          other = other.literal;

        if (array.length !== other.length) {
          return false;
        }

        recursed[(array).$object_id()] = true;

        for (i = 0, length = array.length; i < length; i++) {
          a = array[i];
          b = other[i];
          if (a.$$is_array) {
            if (b.$$is_array && b.length !== a.length) {
              return false;
            }
            if (!recursed.hasOwnProperty((a).$object_id())) {
              if (!_eqeq(a, b)) {
                return false;
              }
            }
          } else {
            if (!(a)['$=='](b)) {
              return false;
            }
          }
        }

        return true;
      }

      return _eqeq(self, other);

    });

    Opal.defn(self, '$[]', function(index, length) {
      var self = this;

      
      var size = self.length,
          exclude, from, to;

      if (index.$$is_range) {
        exclude = index.exclude;
        from    = $scope.get('Opal').$coerce_to(index.begin, $scope.get('Integer'), "to_int");
        to      = $scope.get('Opal').$coerce_to(index.end, $scope.get('Integer'), "to_int");

        if (from < 0) {
          from += size;

          if (from < 0) {
            return nil;
          }
        }

        if (from > size) {
          return nil;
        }

        if (to < 0) {
          to += size;

          if (to < 0) {
            return [];
          }
        }

        if (!exclude) {
          to += 1;
        }

        return self.slice(from, to);
      }
      else {
        index = $scope.get('Opal').$coerce_to(index, $scope.get('Integer'), "to_int");

        if (index < 0) {
          index += size;

          if (index < 0) {
            return nil;
          }
        }

        if (length === undefined) {
          if (index >= size || index < 0) {
            return nil;
          }

          return self[index];
        }
        else {
          length = $scope.get('Opal').$coerce_to(length, $scope.get('Integer'), "to_int");

          if (length < 0 || index > size || index < 0) {
            return nil;
          }

          return self.slice(index, index + length);
        }
      }
    
    });

    Opal.defn(self, '$[]=', function(index, value, extra) {
      var $a, self = this, data = nil, length = nil;

      
      var i, size = self.length;
    
      if ((($a = $scope.get('Range')['$==='](index)) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = $scope.get('Array')['$==='](value)) !== nil && (!$a.$$is_boolean || $a == true))) {
          data = value.$to_a()
        } else if ((($a = value['$respond_to?']("to_ary")) !== nil && (!$a.$$is_boolean || $a == true))) {
          data = value.$to_ary().$to_a()
          } else {
          data = [value]
        }
        
        var exclude = index.exclude,
            from    = $scope.get('Opal').$coerce_to(index.begin, $scope.get('Integer'), "to_int"),
            to      = $scope.get('Opal').$coerce_to(index.end, $scope.get('Integer'), "to_int");

        if (from < 0) {
          from += size;

          if (from < 0) {
            self.$raise($scope.get('RangeError'), "" + (index.$inspect()) + " out of range");
          }
        }

        if (to < 0) {
          to += size;
        }

        if (!exclude) {
          to += 1;
        }

        if (from > size) {
          for (i = size; i < from; i++) {
            self[i] = nil;
          }
        }

        if (to < 0) {
          self.splice.apply(self, [from, 0].concat(data));
        }
        else {
          self.splice.apply(self, [from, to - from].concat(data));
        }

        return value;

        } else {
        if ((($a = extra === undefined) !== nil && (!$a.$$is_boolean || $a == true))) {
          length = 1
          } else {
          length = value;
          value = extra;
          if ((($a = $scope.get('Array')['$==='](value)) !== nil && (!$a.$$is_boolean || $a == true))) {
            data = value.$to_a()
          } else if ((($a = value['$respond_to?']("to_ary")) !== nil && (!$a.$$is_boolean || $a == true))) {
            data = value.$to_ary().$to_a()
            } else {
            data = [value]
          }
        }
        
        var old;

        index  = $scope.get('Opal').$coerce_to(index, $scope.get('Integer'), "to_int");
        length = $scope.get('Opal').$coerce_to(length, $scope.get('Integer'), "to_int");

        if (index < 0) {
          old    = index;
          index += size;

          if (index < 0) {
            self.$raise($scope.get('IndexError'), "index " + (old) + " too small for array; minimum " + (-self.length));
          }
        }

        if (length < 0) {
          self.$raise($scope.get('IndexError'), "negative length (" + (length) + ")")
        }

        if (index > size) {
          for (i = size; i < index; i++) {
            self[i] = nil;
          }
        }

        if (extra === undefined) {
          self[index] = value;
        }
        else {
          self.splice.apply(self, [index, length].concat(data));
        }

        return value;
      
      }
    });

    Opal.defn(self, '$assoc', function(object) {
      var self = this;

      
      for (var i = 0, length = self.length, item; i < length; i++) {
        if (item = self[i], item.length && (item[0])['$=='](object)) {
          return item;
        }
      }

      return nil;
    
    });

    Opal.defn(self, '$at', function(index) {
      var self = this;

      index = $scope.get('Opal').$coerce_to(index, $scope.get('Integer'), "to_int");
      
      if (index < 0) {
        index += self.length;
      }

      if (index < 0 || index >= self.length) {
        return nil;
      }

      return self[index];
    
    });

    Opal.defn(self, '$bsearch', TMP_3 = function() {
      var self = this, $iter = TMP_3.$$p, block = $iter || nil;

      TMP_3.$$p = null;
      if ((block !== nil)) {
        } else {
        return self.$enum_for("bsearch")
      }
      
      var min = 0,
          max = self.length,
          mid,
          val,
          ret,
          smaller = false,
          satisfied = nil;

      while (min < max) {
        mid = min + Math.floor((max - min) / 2);
        val = self[mid];
        ret = block(val);

        if (ret === $breaker) {
          return $breaker.$v;
        }
        else if (ret === true) {
          satisfied = val;
          smaller = true;
        }
        else if (ret === false || ret === nil) {
          smaller = false;
        }
        else if (ret.$$is_number) {
          if (ret === 0) { return val; }
          smaller = (ret < 0);
        }
        else {
          self.$raise($scope.get('TypeError'), "wrong argument type " + ((ret).$class()) + " (must be numeric, true, false or nil)")
        }

        if (smaller) { max = mid; } else { min = mid + 1; }
      }

      return satisfied;
    
    });

    Opal.defn(self, '$cycle', TMP_4 = function(n) {
      var $a, $b, TMP_5, $c, self = this, $iter = TMP_4.$$p, block = $iter || nil;

      if (n == null) {
        n = nil
      }
      TMP_4.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_5 = function(){var self = TMP_5.$$s || this, $a;

        if (n['$=='](nil)) {
            return (($scope.get('Float')).$$scope.get('INFINITY'))
            } else {
            n = $scope.get('Opal')['$coerce_to!'](n, $scope.get('Integer'), "to_int");
            if ((($a = $rb_gt(n, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
              return $rb_times(self.$enumerator_size(), n)
              } else {
              return 0
            }
          }}, TMP_5.$$s = self, TMP_5), $a).call($b, "cycle", n)
      }
      if ((($a = ((($c = self['$empty?']()) !== false && $c !== nil) ? $c : n['$=='](0))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return nil}
      
      var i, length, value;

      if (n === nil) {
        while (true) {
          for (i = 0, length = self.length; i < length; i++) {
            value = Opal.yield1(block, self[i]);

            if (value === $breaker) {
              return $breaker.$v;
            }
          }
        }
      }
      else {
        n = $scope.get('Opal')['$coerce_to!'](n, $scope.get('Integer'), "to_int");
        if (n <= 0) {
          return self;
        }

        while (n > 0) {
          for (i = 0, length = self.length; i < length; i++) {
            value = Opal.yield1(block, self[i]);

            if (value === $breaker) {
              return $breaker.$v;
            }
          }

          n--;
        }
      }
    
      return self;
    });

    Opal.defn(self, '$clear', function() {
      var self = this;

      self.splice(0, self.length);
      return self;
    });

    Opal.defn(self, '$clone', function() {
      var self = this, copy = nil;

      copy = [];
      copy.$copy_singleton_methods(self);
      copy.$initialize_clone(self);
      return copy;
    });

    Opal.defn(self, '$dup', function() {
      var self = this, copy = nil;

      copy = [];
      copy.$initialize_dup(self);
      return copy;
    });

    Opal.defn(self, '$initialize_copy', function(other) {
      var self = this;

      return self.$replace(other);
    });

    Opal.defn(self, '$collect', TMP_6 = function() {
      var $a, $b, TMP_7, self = this, $iter = TMP_6.$$p, block = $iter || nil;

      TMP_6.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_7 = function(){var self = TMP_7.$$s || this;

        return self.$size()}, TMP_7.$$s = self, TMP_7), $a).call($b, "collect")
      }
      
      var result = [];

      for (var i = 0, length = self.length; i < length; i++) {
        var value = Opal.yield1(block, self[i]);

        if (value === $breaker) {
          return $breaker.$v;
        }

        result.push(value);
      }

      return result;
    
    });

    Opal.defn(self, '$collect!', TMP_8 = function() {
      var $a, $b, TMP_9, self = this, $iter = TMP_8.$$p, block = $iter || nil;

      TMP_8.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_9 = function(){var self = TMP_9.$$s || this;

        return self.$size()}, TMP_9.$$s = self, TMP_9), $a).call($b, "collect!")
      }
      
      for (var i = 0, length = self.length; i < length; i++) {
        var value = Opal.yield1(block, self[i]);

        if (value === $breaker) {
          return $breaker.$v;
        }

        self[i] = value;
      }
    
      return self;
    });

    
    function binomial_coefficient(n, k) {
      if (n === k || k === 0) {
        return 1;
      }

      if (k > 0 && n > k) {
        return binomial_coefficient(n - 1, k - 1) + binomial_coefficient(n - 1, k);
      }

      return 0;
    }
  

    Opal.defn(self, '$combination', TMP_10 = function(n) {
      var $a, $b, TMP_11, self = this, $iter = TMP_10.$$p, $yield = $iter || nil, num = nil;

      TMP_10.$$p = null;
      num = $scope.get('Opal')['$coerce_to!'](n, $scope.get('Integer'), "to_int");
      if (($yield !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_11 = function(){var self = TMP_11.$$s || this;

        return binomial_coefficient(self.length, num);}, TMP_11.$$s = self, TMP_11), $a).call($b, "combination", num)
      }
      
      var i, length, stack, chosen, lev, done, next;

      if (num === 0) {
        ((($a = Opal.yield1($yield, [])) === $breaker) ? $breaker.$v : $a)
      } else if (num === 1) {
        for (i = 0, length = self.length; i < length; i++) {
          ((($a = Opal.yield1($yield, [self[i]])) === $breaker) ? $breaker.$v : $a)
        }
      }
      else if (num === self.length) {
        ((($a = Opal.yield1($yield, self.slice())) === $breaker) ? $breaker.$v : $a)
      }
      else if (num >= 0 && num < self.length) {
        stack = [];
        for (i = 0; i <= num + 1; i++) {
          stack.push(0);
        }

        chosen = [];
        lev = 0;
        done = false;
        stack[0] = -1;

        while (!done) {
          chosen[lev] = self[stack[lev+1]];
          while (lev < num - 1) {
            lev++;
            next = stack[lev+1] = stack[lev] + 1;
            chosen[lev] = self[next];
          }
          ((($a = Opal.yield1($yield, chosen.slice())) === $breaker) ? $breaker.$v : $a)
          lev++;
          do {
            done = (lev === 0);
            stack[lev]++;
            lev--;
          } while ( stack[lev+1] + num === self.length + lev + 1 );
        }
      }

      return self;
    });

    Opal.defn(self, '$compact', function() {
      var self = this;

      
      var result = [];

      for (var i = 0, length = self.length, item; i < length; i++) {
        if ((item = self[i]) !== nil) {
          result.push(item);
        }
      }

      return result;
    
    });

    Opal.defn(self, '$compact!', function() {
      var self = this;

      
      var original = self.length;

      for (var i = 0, length = self.length; i < length; i++) {
        if (self[i] === nil) {
          self.splice(i, 1);

          length--;
          i--;
        }
      }

      return self.length === original ? nil : self;
    
    });

    Opal.defn(self, '$concat', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Array')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        other = other.$to_a()
        } else {
        other = $scope.get('Opal').$coerce_to(other, $scope.get('Array'), "to_ary").$to_a()
      }
      
      for (var i = 0, length = other.length; i < length; i++) {
        self.push(other[i]);
      }
    
      return self;
    });

    Opal.defn(self, '$delete', TMP_12 = function(object) {
      var $a, self = this, $iter = TMP_12.$$p, $yield = $iter || nil;

      TMP_12.$$p = null;
      
      var original = self.length;

      for (var i = 0, length = original; i < length; i++) {
        if ((self[i])['$=='](object)) {
          self.splice(i, 1);

          length--;
          i--;
        }
      }

      if (self.length === original) {
        if (($yield !== nil)) {
          return ((($a = Opal.yieldX($yield, [])) === $breaker) ? $breaker.$v : $a);
        }
        return nil;
      }
      return object;

    });

    Opal.defn(self, '$delete_at', function(index) {
      var self = this;

      
      index = $scope.get('Opal').$coerce_to(index, $scope.get('Integer'), "to_int");

      if (index < 0) {
        index += self.length;
      }

      if (index < 0 || index >= self.length) {
        return nil;
      }

      var result = self[index];

      self.splice(index, 1);

      return result;

    });

    Opal.defn(self, '$delete_if', TMP_13 = function() {
      var $a, $b, TMP_14, self = this, $iter = TMP_13.$$p, block = $iter || nil;

      TMP_13.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_14 = function(){var self = TMP_14.$$s || this;

        return self.$size()}, TMP_14.$$s = self, TMP_14), $a).call($b, "delete_if")
      }
      
      for (var i = 0, length = self.length, value; i < length; i++) {
        if ((value = block(self[i])) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          self.splice(i, 1);

          length--;
          i--;
        }
      }
    
      return self;
    });

    Opal.defn(self, '$drop', function(number) {
      var self = this;

      
      if (number < 0) {
        self.$raise($scope.get('ArgumentError'))
      }

      return self.slice(number);

    });

    Opal.defn(self, '$each', TMP_15 = function() {
      var $a, $b, TMP_16, self = this, $iter = TMP_15.$$p, block = $iter || nil;

      TMP_15.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_16 = function(){var self = TMP_16.$$s || this;

        return self.$size()}, TMP_16.$$s = self, TMP_16), $a).call($b, "each")
      }
      
      for (var i = 0, length = self.length; i < length; i++) {
        var value = Opal.yield1(block, self[i]);

        if (value == $breaker) {
          return $breaker.$v;
        }
      }
    
      return self;
    });

    Opal.defn(self, '$each_index', TMP_17 = function() {
      var $a, $b, TMP_18, self = this, $iter = TMP_17.$$p, block = $iter || nil;

      TMP_17.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_18 = function(){var self = TMP_18.$$s || this;

        return self.$size()}, TMP_18.$$s = self, TMP_18), $a).call($b, "each_index")
      }
      
      for (var i = 0, length = self.length; i < length; i++) {
        var value = Opal.yield1(block, i);

        if (value === $breaker) {
          return $breaker.$v;
        }
      }
    
      return self;
    });

    Opal.defn(self, '$empty?', function() {
      var self = this;

      return self.length === 0;
    });

    Opal.defn(self, '$eql?', function(other) {
      var self = this;

      
      var recursed = {};

      function _eql(array, other) {
        var i, length, a, b;

        if (!other.$$is_array) {
          return false;
        }

        other = other.$to_a();

        if (array.length !== other.length) {
          return false;
        }

        recursed[(array).$object_id()] = true;

        for (i = 0, length = array.length; i < length; i++) {
          a = array[i];
          b = other[i];
          if (a.$$is_array) {
            if (b.$$is_array && b.length !== a.length) {
              return false;
            }
            if (!recursed.hasOwnProperty((a).$object_id())) {
              if (!_eql(a, b)) {
                return false;
              }
            }
          } else {
            if (!(a)['$eql?'](b)) {
              return false;
            }
          }
        }

        return true;
      }

      return _eql(self, other);
    
    });

    Opal.defn(self, '$fetch', TMP_19 = function(index, defaults) {
      var self = this, $iter = TMP_19.$$p, block = $iter || nil;

      TMP_19.$$p = null;
      
      var original = index;

      index = $scope.get('Opal').$coerce_to(index, $scope.get('Integer'), "to_int");

      if (index < 0) {
        index += self.length;
      }

      if (index >= 0 && index < self.length) {
        return self[index];
      }

      if (block !== nil) {
        return block(original);
      }

      if (defaults != null) {
        return defaults;
      }

      if (self.length === 0) {
        self.$raise($scope.get('IndexError'), "index " + (original) + " outside of array bounds: 0...0")
      }
      else {
        self.$raise($scope.get('IndexError'), "index " + (original) + " outside of array bounds: -" + (self.length) + "..." + (self.length));
      }

    });

    Opal.defn(self, '$fill', TMP_20 = function() {
      var $a, $b, self = this, $iter = TMP_20.$$p, block = $iter || nil, one = nil, two = nil, obj = nil, left = nil, right = nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_20.$$p = null;
      
      var i, length, value;
    
      if (block !== false && block !== nil) {
        if ((($a = args.length > 2) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('ArgumentError'), "wrong number of arguments (" + (args.$length()) + " for 0..2)")}
        $b = args, $a = Opal.to_ary($b), one = ($a[0] == null ? nil : $a[0]), two = ($a[1] == null ? nil : $a[1]), $b;
        } else {
        if ((($a = args.length == 0) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('ArgumentError'), "wrong number of arguments (0 for 1..3)")
        } else if ((($a = args.length > 3) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('ArgumentError'), "wrong number of arguments (" + (args.$length()) + " for 1..3)")}
        $b = args, $a = Opal.to_ary($b), obj = ($a[0] == null ? nil : $a[0]), one = ($a[1] == null ? nil : $a[1]), two = ($a[2] == null ? nil : $a[2]), $b;
      }
      if ((($a = $scope.get('Range')['$==='](one)) !== nil && (!$a.$$is_boolean || $a == true))) {
        if (two !== false && two !== nil) {
          self.$raise($scope.get('TypeError'), "length invalid with range")}
        left = $scope.get('Opal').$coerce_to(one.$begin(), $scope.get('Integer'), "to_int");
        if ((($a = left < 0) !== nil && (!$a.$$is_boolean || $a == true))) {
          left += self.length;}
        if ((($a = left < 0) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('RangeError'), "" + (one.$inspect()) + " out of range")}
        right = $scope.get('Opal').$coerce_to(one.$end(), $scope.get('Integer'), "to_int");
        if ((($a = right < 0) !== nil && (!$a.$$is_boolean || $a == true))) {
          right += self.length;}
        if ((($a = one['$exclude_end?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
          } else {
          right += 1;
        }
        if ((($a = right <= left) !== nil && (!$a.$$is_boolean || $a == true))) {
          return self}
      } else if (one !== false && one !== nil) {
        left = $scope.get('Opal').$coerce_to(one, $scope.get('Integer'), "to_int");
        if ((($a = left < 0) !== nil && (!$a.$$is_boolean || $a == true))) {
          left += self.length;}
        if ((($a = left < 0) !== nil && (!$a.$$is_boolean || $a == true))) {
          left = 0}
        if (two !== false && two !== nil) {
          right = $scope.get('Opal').$coerce_to(two, $scope.get('Integer'), "to_int");
          if ((($a = right == 0) !== nil && (!$a.$$is_boolean || $a == true))) {
            return self}
          right += left;
          } else {
          right = self.length
        }
        } else {
        left = 0;
        right = self.length;
      }
      if ((($a = left > self.length) !== nil && (!$a.$$is_boolean || $a == true))) {
        
        for (i = self.length; i < right; i++) {
          self[i] = nil;
        }
      }
      if ((($a = right > self.length) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.length = right}
      if (block !== false && block !== nil) {
        
        for (length = self.length; left < right; left++) {
          value = block(left);

          if (value === $breaker) {
            return $breaker.$v;
          }

          self[left] = value;
        }

        } else {
        
        for (length = self.length; left < right; left++) {
          self[left] = obj;
        }

      }
      return self;
    });

    Opal.defn(self, '$first', function(count) {
      var self = this;

      
      if (count == null) {
        return self.length === 0 ? nil : self[0];
      }

      count = $scope.get('Opal').$coerce_to(count, $scope.get('Integer'), "to_int");

      if (count < 0) {
        self.$raise($scope.get('ArgumentError'), "negative array size");
      }

      return self.slice(0, count);
    
    });

    Opal.defn(self, '$flatten', function(level) {
      var self = this;

      
      function _flatten(array, level) {
        var result = [],
            i, length,
            item, ary;

        array = (array).$to_a();

        for (i = 0, length = array.length; i < length; i++) {
          item = array[i];

          if (!$scope.get('Opal')['$respond_to?'](item, "to_ary")) {
            result.push(item);
            continue;
          }

          ary = (item).$to_ary();

          if (ary === nil) {
            result.push(item);
            continue;
          }

          if (!ary.$$is_array) {
            self.$raise($scope.get('TypeError'));
          }

          if (ary === self) {
            self.$raise($scope.get('ArgumentError'));
          }

          switch (level) {
          case undefined:
            result.push.apply(result, _flatten(ary));
            break;
          case 0:
            result.push(ary);
            break;
          default:
            result.push.apply(result, _flatten(ary, level - 1));
          }
        }
        return result;
      }

      if (level !== undefined) {
        level = $scope.get('Opal').$coerce_to(level, $scope.get('Integer'), "to_int");
      }

      return _flatten(self, level);
    
    });

    Opal.defn(self, '$flatten!', function(level) {
      var self = this;

      
      var flattened = self.$flatten(level);

      if (self.length == flattened.length) {
        for (var i = 0, length = self.length; i < length; i++) {
          if (self[i] !== flattened[i]) {
            break;
          }
        }

        if (i == length) {
          return nil;
        }
      }

      self.$replace(flattened);

      return self;
    });

    Opal.defn(self, '$hash', function() {
      var self = this;

      
      var top = (Opal.hash_ids == undefined),
          result = ['A'],
          hash_id = self.$object_id(),
          item, i, key;

      try {
        if (top) {
          Opal.hash_ids = {};
        }

        if (Opal.hash_ids.hasOwnProperty(hash_id)) {
          return 'self';
        }

        for (key in Opal.hash_ids) {
          if (Opal.hash_ids.hasOwnProperty(key)) {
            item = Opal.hash_ids[key];
            if (self['$eql?'](item)) {
              return 'self';
            }
          }
        }

        Opal.hash_ids[hash_id] = self;

        for (i = 0; i < self.length; i++) {
          item = self[i];
          result.push(item.$hash());
        }

        return result.join(',');
      } finally {
        if (top) {
          delete Opal.hash_ids;
        }
      }
    
    });

    Opal.defn(self, '$include?', function(member) {
      var self = this;

      
      for (var i = 0, length = self.length; i < length; i++) {
        if ((self[i])['$=='](member)) {
          return true;
        }
      }

      return false;
    
    });

    Opal.defn(self, '$index', TMP_21 = function(object) {
      var self = this, $iter = TMP_21.$$p, block = $iter || nil;

      TMP_21.$$p = null;
      
      var i, length, value;

      if (object != null) {
        for (i = 0, length = self.length; i < length; i++) {
          if ((self[i])['$=='](object)) {
            return i;
          }
        }
      }
      else if (block !== nil) {
        for (i = 0, length = self.length; i < length; i++) {
          if ((value = block(self[i])) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            return i;
          }
        }
      }
      else {
        return self.$enum_for("index");
      }

      return nil;
    
    });

    Opal.defn(self, '$insert', function(index) {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 1;
      if(array_size < 0) array_size = 0;
      var objects = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        objects[$splat_index] = arguments[$splat_index + 1];
      }
      
      index = $scope.get('Opal').$coerce_to(index, $scope.get('Integer'), "to_int");

      if (objects.length > 0) {
        if (index < 0) {
          index += self.length + 1;

          if (index < 0) {
            self.$raise($scope.get('IndexError'), "" + (index) + " is out of bounds");
          }
        }
        if (index > self.length) {
          for (var i = self.length; i < index; i++) {
            self.push(nil);
          }
        }

        self.splice.apply(self, [index, 0].concat(objects));
      }

      return self;
    });

    Opal.defn(self, '$inspect', function() {
      var self = this;

      
      var result = [],
          id     = self.$__id__();

      for (var i = 0, length = self.length; i < length; i++) {
        var item = self['$[]'](i);

        if ((item).$__id__() === id) {
          result.push('[...]');
        }
        else {
          result.push((item).$inspect());
        }
      }

      return '[' + result.join(', ') + ']';

    });

    Opal.defn(self, '$join', function(sep) {
      var $a, self = this;
      if ($gvars[","] == null) $gvars[","] = nil;

      if (sep == null) {
        sep = nil
      }
      if ((($a = self.length === 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        return ""}
      if ((($a = sep === nil) !== nil && (!$a.$$is_boolean || $a == true))) {
        sep = $gvars[","]}
      
      var result = [];
      var i, length, item, tmp;

      for (i = 0, length = self.length; i < length; i++) {
        item = self[i];

        if ($scope.get('Opal')['$respond_to?'](item, "to_str")) {
          tmp = (item).$to_str();

          if (tmp !== nil) {
            result.push((tmp).$to_s());

            continue;
          }
        }

        if ($scope.get('Opal')['$respond_to?'](item, "to_ary")) {
          tmp = (item).$to_ary();

          if (tmp === self) {
            self.$raise($scope.get('ArgumentError'));
          }

          if (tmp !== nil) {
            result.push((tmp).$join(sep));

            continue;
          }
        }

        if ($scope.get('Opal')['$respond_to?'](item, "to_s")) {
          tmp = (item).$to_s();

          if (tmp !== nil) {
            result.push(tmp);

            continue;
          }
        }

        self.$raise($scope.get('NoMethodError').$new("" + ($scope.get('Opal').$inspect(item)) + " doesn't respond to #to_str, #to_ary or #to_s", "to_str"));
      }

      if (sep === nil) {
        return result.join('');
      }
      else {
        return result.join($scope.get('Opal')['$coerce_to!'](sep, $scope.get('String'), "to_str").$to_s());
      }

    });

    Opal.defn(self, '$keep_if', TMP_22 = function() {
      var $a, $b, TMP_23, self = this, $iter = TMP_22.$$p, block = $iter || nil;

      TMP_22.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_23 = function(){var self = TMP_23.$$s || this;

        return self.$size()}, TMP_23.$$s = self, TMP_23), $a).call($b, "keep_if")
      }
      
      for (var i = 0, length = self.length, value; i < length; i++) {
        if ((value = block(self[i])) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          self.splice(i, 1);

          length--;
          i--;
        }
      }
    
      return self;
    });

    Opal.defn(self, '$last', function(count) {
      var self = this;

      
      if (count == null) {
        return self.length === 0 ? nil : self[self.length - 1];
      }

      count = $scope.get('Opal').$coerce_to(count, $scope.get('Integer'), "to_int");

      if (count < 0) {
        self.$raise($scope.get('ArgumentError'), "negative array size");
      }

      if (count > self.length) {
        count = self.length;
      }

      return self.slice(self.length - count, self.length);
    
    });

    Opal.defn(self, '$length', function() {
      var self = this;

      return self.length;
    });

    Opal.alias(self, 'map', 'collect');

    Opal.alias(self, 'map!', 'collect!');

    Opal.defn(self, '$permutation', TMP_24 = function(num) {
      var $a, $b, TMP_25, self = this, $iter = TMP_24.$$p, block = $iter || nil, perm = nil, used = nil;

      TMP_24.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_25 = function(){var self = TMP_25.$$s || this;

        return self.$size()}, TMP_25.$$s = self, TMP_25), $a).call($b, "permutation", num)
      }
      
      var permute, offensive, output;

      if (num === undefined) {
        num = self.length;
      }
      else {
        num = $scope.get('Opal').$coerce_to(num, $scope.get('Integer'), "to_int")
      }

      if (num < 0 || self.length < num) {
        // no permutations, yield nothing
      }
      else if (num === 0) {
        // exactly one permutation: the zero-length array
        ((($a = Opal.yield1(block, [])) === $breaker) ? $breaker.$v : $a)
      }
      else if (num === 1) {
        // this is a special, easy case
        for (var i = 0; i < self.length; i++) {
          ((($a = Opal.yield1(block, [self[i]])) === $breaker) ? $breaker.$v : $a)
        }
      }
      else {
        // this is the general case
        perm = $scope.get('Array').$new(num)
        used = $scope.get('Array').$new(self.length, false)

        permute = function(num, perm, index, used, blk) {
          self = this;
          for(var i = 0; i < self.length; i++){
            if(used['$[]'](i)['$!']()) {
              perm[index] = i;
              if(index < num - 1) {
                used[i] = true;
                permute.call(self, num, perm, index + 1, used, blk);
                used[i] = false;
              }
              else {
                output = [];
                for (var j = 0; j < perm.length; j++) {
                  output.push(self[perm[j]]);
                }
                Opal.yield1(blk, output);
              }
            }
          }
        }

        if ((block !== nil)) {
          // offensive (both definitions) copy.
          offensive = self.slice();
          permute.call(offensive, num, perm, 0, used, block);
        }
        else {
          permute.call(self, num, perm, 0, used, block);
        }
      }

      return self;
    });

    Opal.defn(self, '$pop', function(count) {
      var $a, self = this;

      if ((($a = count === undefined) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = self.length === 0) !== nil && (!$a.$$is_boolean || $a == true))) {
          return nil}
        return self.pop();}
      count = $scope.get('Opal').$coerce_to(count, $scope.get('Integer'), "to_int");
      if ((($a = count < 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "negative array size")}
      if ((($a = self.length === 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        return []}
      if ((($a = count > self.length) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.splice(0, self.length);
        } else {
        return self.splice(self.length - count, self.length);
      }
    });

    Opal.defn(self, '$product', TMP_26 = function() {
      var $a, self = this, $iter = TMP_26.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_26.$$p = null;
      
      var result = (block !== nil) ? null : [],
          n = args.length + 1,
          counters = new Array(n),
          lengths  = new Array(n),
          arrays   = new Array(n),
          i, m, subarray, len, resultlen = 1;

      arrays[0] = self;
      for (i = 1; i < n; i++) {
        arrays[i] = $scope.get('Opal').$coerce_to(args[i - 1], $scope.get('Array'), "to_ary");
      }

      for (i = 0; i < n; i++) {
        len = arrays[i].length;
        if (len === 0) {
          return result || self;
        }
        resultlen *= len;
        if (resultlen > 2147483647) {
          self.$raise($scope.get('RangeError'), "too big to product")
        }
        lengths[i] = len;
        counters[i] = 0;
      }

      outer_loop: for (;;) {
        subarray = [];
        for (i = 0; i < n; i++) {
          subarray.push(arrays[i][counters[i]]);
        }
        if (result) {
          result.push(subarray);
        } else {
          ((($a = Opal.yield1(block, subarray)) === $breaker) ? $breaker.$v : $a)
        }
        m = n - 1;
        counters[m]++;
        while (counters[m] === lengths[m]) {
          counters[m] = 0;
          if (--m < 0) break outer_loop;
          counters[m]++;
        }
      }

      return result || self;

    });

    Opal.defn(self, '$push', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var objects = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        objects[$splat_index] = arguments[$splat_index + 0];
      }
      
      for (var i = 0, length = objects.length; i < length; i++) {
        self.push(objects[i]);
      }
    
      return self;
    });

    Opal.defn(self, '$rassoc', function(object) {
      var self = this;

      
      for (var i = 0, length = self.length, item; i < length; i++) {
        item = self[i];

        if (item.length && item[1] !== undefined) {
          if ((item[1])['$=='](object)) {
            return item;
          }
        }
      }

      return nil;
    
    });

    Opal.defn(self, '$reject', TMP_27 = function() {
      var $a, $b, TMP_28, self = this, $iter = TMP_27.$$p, block = $iter || nil;

      TMP_27.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_28 = function(){var self = TMP_28.$$s || this;

        return self.$size()}, TMP_28.$$s = self, TMP_28), $a).call($b, "reject")
      }
      
      var result = [];

      for (var i = 0, length = self.length, value; i < length; i++) {
        if ((value = block(self[i])) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          result.push(self[i]);
        }
      }
      return result;
    
    });

    Opal.defn(self, '$reject!', TMP_29 = function() {
      var $a, $b, TMP_30, $c, self = this, $iter = TMP_29.$$p, block = $iter || nil, original = nil;

      TMP_29.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_30 = function(){var self = TMP_30.$$s || this;

        return self.$size()}, TMP_30.$$s = self, TMP_30), $a).call($b, "reject!")
      }
      original = self.$length();
      ($a = ($c = self).$delete_if, $a.$$p = block.$to_proc(), $a).call($c);
      if (self.$length()['$=='](original)) {
        return nil
        } else {
        return self
      }
    });

    Opal.defn(self, '$replace', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Array')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        other = other.$to_a()
        } else {
        other = $scope.get('Opal').$coerce_to(other, $scope.get('Array'), "to_ary").$to_a()
      }
      
      self.splice(0, self.length);
      self.push.apply(self, other);
    
      return self;
    });

    Opal.defn(self, '$reverse', function() {
      var self = this;

      return self.slice(0).reverse();
    });

    Opal.defn(self, '$reverse!', function() {
      var self = this;

      return self.reverse();
    });

    Opal.defn(self, '$reverse_each', TMP_31 = function() {
      var $a, $b, TMP_32, $c, self = this, $iter = TMP_31.$$p, block = $iter || nil;

      TMP_31.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_32 = function(){var self = TMP_32.$$s || this;

        return self.$size()}, TMP_32.$$s = self, TMP_32), $a).call($b, "reverse_each")
      }
      ($a = ($c = self.$reverse()).$each, $a.$$p = block.$to_proc(), $a).call($c);
      return self;
    });

    Opal.defn(self, '$rindex', TMP_33 = function(object) {
      var self = this, $iter = TMP_33.$$p, block = $iter || nil;

      TMP_33.$$p = null;
      
      var i, value;

      if (object != null) {
        for (i = self.length - 1; i >= 0; i--) {
          if (i >= self.length) {
            break;
          }
          if ((self[i])['$=='](object)) {
            return i;
          }
        }
      }
      else if (block !== nil) {
        for (i = self.length - 1; i >= 0; i--) {
          if (i >= self.length) {
            break;
          }
          if ((value = block(self[i])) === $breaker) {
            return $breaker.$v;
          }
          if (value !== false && value !== nil) {
            return i;
          }
        }
      }
      else if (object == null) {
        return self.$enum_for("rindex");
      }

      return nil;
    
    });

    Opal.defn(self, '$rotate', function(n) {
      var self = this;

      if (n == null) {
        n = 1
      }
      n = $scope.get('Opal').$coerce_to(n, $scope.get('Integer'), "to_int");
      
      var ary, idx, firstPart, lastPart;

      if (self.length === 1) {
        return self.slice();
      }
      if (self.length === 0) {
        return [];
      }

      ary = self.slice();
      idx = n % ary.length;

      firstPart = ary.slice(idx);
      lastPart = ary.slice(0, idx);
      return firstPart.concat(lastPart);
    
    });

    Opal.defn(self, '$rotate!', function(cnt) {
      var self = this, ary = nil;

      if (cnt == null) {
        cnt = 1
      }
      
      if (self.length === 0 || self.length === 1) {
        return self;
      }
    
      cnt = $scope.get('Opal').$coerce_to(cnt, $scope.get('Integer'), "to_int");
      ary = self.$rotate(cnt);
      return self.$replace(ary);
    });

    (function($base, $super) {
      function $SampleRandom(){}
      var self = $SampleRandom = $klass($base, $super, 'SampleRandom', $SampleRandom);

      var def = self.$$proto, $scope = self.$$scope;

      def.rng = nil;
      Opal.defn(self, '$initialize', function(rng) {
        var self = this;

        return self.rng = rng;
      });

      return (Opal.defn(self, '$rand', function(size) {
        var $a, self = this, random = nil;

        random = $scope.get('Opal').$coerce_to(self.rng.$rand(size), $scope.get('Integer'), "to_int");
        if ((($a = random < 0) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('RangeError'), "random value must be >= 0")}
        if ((($a = random < size) !== nil && (!$a.$$is_boolean || $a == true))) {
          } else {
          self.$raise($scope.get('RangeError'), "random value must be less than Array size")
        }
        return random;
      }), nil) && 'rand';
    })($scope.base, null);

    Opal.defn(self, '$sample', function(count, options) {
      var $a, $b, self = this, o = nil, rng = nil;

      if ((($a = count === undefined) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$at($scope.get('Kernel').$rand(self.length))}
      if ((($a = options === undefined) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = (o = $scope.get('Opal')['$coerce_to?'](count, $scope.get('Hash'), "to_hash"))) !== nil && (!$a.$$is_boolean || $a == true))) {
          options = o;
          count = nil;
          } else {
          options = nil;
          count = $scope.get('Opal').$coerce_to(count, $scope.get('Integer'), "to_int");
        }
        } else {
        count = $scope.get('Opal').$coerce_to(count, $scope.get('Integer'), "to_int");
        options = $scope.get('Opal').$coerce_to(options, $scope.get('Hash'), "to_hash");
      }
      if ((($a = (($b = count !== false && count !== nil) ? count < 0 : count)) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "count must be greater than 0")}
      if (options !== false && options !== nil) {
        rng = options['$[]']("random")}
      if ((($a = (($b = rng !== false && rng !== nil) ? rng['$respond_to?']("rand") : rng)) !== nil && (!$a.$$is_boolean || $a == true))) {
        rng = $scope.get('SampleRandom').$new(rng)
        } else {
        rng = $scope.get('Kernel')
      }
      if (count !== false && count !== nil) {
        } else {
        return self[rng.$rand(self.length)]
      }
      

      var abandon, spin, result, i, j, k, targetIndex, oldValue;

      if (count > self.length) {
        count = self.length;
      }

      switch (count) {
        case 0:
          return [];
          break;
        case 1:
          return [self[rng.$rand(self.length)]];
          break;
        case 2:
          i = rng.$rand(self.length);
          j = rng.$rand(self.length);
          if (i === j) {
            j = i === 0 ? i + 1 : i - 1;
          }
          return [self[i], self[j]];
          break;
        default:
          if (self.length / count > 3) {
            abandon = false;
            spin = 0;

            result = $scope.get('Array').$new(count);
            i = 1;

            result[0] = rng.$rand(self.length);
            while (i < count) {
              k = rng.$rand(self.length);
              j = 0;

              while (j < i) {
                while (k === result[j]) {
                  spin++;
                  if (spin > 100) {
                    abandon = true;
                    break;
                  }
                  k = rng.$rand(self.length);
                }
                if (abandon) { break; }

                j++;
              }

              if (abandon) { break; }

              result[i] = k;

              i++;
            }

            if (!abandon) {
              i = 0;
              while (i < count) {
                result[i] = self[result[i]];
                i++;
              }

              return result;
            }
          }

          result = self.slice();

          for (var c = 0; c < count; c++) {
            targetIndex = rng.$rand(self.length);
            oldValue = result[c];
            result[c] = result[targetIndex];
            result[targetIndex] = oldValue;
          }

          return count === self.length ? result : (result)['$[]'](0, count);
      }
    
    });

    Opal.defn(self, '$select', TMP_34 = function() {
      var $a, $b, TMP_35, self = this, $iter = TMP_34.$$p, block = $iter || nil;

      TMP_34.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_35 = function(){var self = TMP_35.$$s || this;

        return self.$size()}, TMP_35.$$s = self, TMP_35), $a).call($b, "select")
      }
      
      var result = [];

      for (var i = 0, length = self.length, item, value; i < length; i++) {
        item = self[i];

        if ((value = Opal.yield1(block, item)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          result.push(item);
        }
      }

      return result;
    
    });

    Opal.defn(self, '$select!', TMP_36 = function() {
      var $a, $b, TMP_37, $c, self = this, $iter = TMP_36.$$p, block = $iter || nil;

      TMP_36.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_37 = function(){var self = TMP_37.$$s || this;

        return self.$size()}, TMP_37.$$s = self, TMP_37), $a).call($b, "select!")
      }
      
      var original = self.length;
      ($a = ($c = self).$keep_if, $a.$$p = block.$to_proc(), $a).call($c);
      return self.length === original ? nil : self;
    
    });

    Opal.defn(self, '$shift', function(count) {
      var $a, self = this;

      if ((($a = count === undefined) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = self.length === 0) !== nil && (!$a.$$is_boolean || $a == true))) {
          return nil}
        return self.shift();}
      count = $scope.get('Opal').$coerce_to(count, $scope.get('Integer'), "to_int");
      if ((($a = count < 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "negative array size")}
      if ((($a = self.length === 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        return []}
      return self.splice(0, count);
    });

    Opal.alias(self, 'size', 'length');

    Opal.defn(self, '$shuffle', function(rng) {
      var self = this;

      return self.$dup()['$shuffle!'](rng);
    });

    Opal.defn(self, '$shuffle!', function(rng) {
      var self = this;

      
      var randgen, i = self.length, j, tmp;

      if (rng !== undefined) {
        rng = $scope.get('Opal')['$coerce_to?'](rng, $scope.get('Hash'), "to_hash");

        if (rng !== nil) {
          rng = rng['$[]']("random");

          if (rng !== nil && rng['$respond_to?']("rand")) {
            randgen = rng;
          }
        }
      }

      while (i) {
        if (randgen) {
          j = randgen.$rand(i).$to_int();

          if (j < 0) {
            self.$raise($scope.get('RangeError'), "random number too small " + (j))
          }

          if (j >= i) {
            self.$raise($scope.get('RangeError'), "random number too big " + (j))
          }
        }
        else {
          j = Math.floor(Math.random() * i);
        }

        tmp = self[--i];
        self[i] = self[j];
        self[j] = tmp;
      }

      return self;

    });

    Opal.alias(self, 'slice', '[]');

    Opal.defn(self, '$slice!', function(index, length) {
      var self = this;

      
      if (index < 0) {
        index += self.length;
      }

      if (length != null) {
        return self.splice(index, length);
      }

      if (index < 0 || index >= self.length) {
        return nil;
      }

      return self.splice(index, 1)[0];
    
    });

    Opal.defn(self, '$sort', TMP_38 = function() {
      var $a, self = this, $iter = TMP_38.$$p, block = $iter || nil;

      TMP_38.$$p = null;
      if ((($a = self.length > 1) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        return self
      }
      
      if (block === nil) {
        block = function(a, b) {
          return (a)['$<=>'](b);
        };
      }

      try {
        return self.slice().sort(function(x, y) {
          var ret = block(x, y);

          if (ret === $breaker) {
            throw $breaker;
          }
          else if (ret === nil) {
            self.$raise($scope.get('ArgumentError'), "comparison of " + ((x).$inspect()) + " with " + ((y).$inspect()) + " failed");
          }

          return $rb_gt(ret, 0) ? 1 : ($rb_lt(ret, 0) ? -1 : 0);
        });
      }
      catch (e) {
        if (e === $breaker) {
          return $breaker.$v;
        }
        else {
          throw e;
        }
      }

    });

    Opal.defn(self, '$sort!', TMP_39 = function() {
      var $a, $b, self = this, $iter = TMP_39.$$p, block = $iter || nil;

      TMP_39.$$p = null;
      
      var result;

      if ((block !== nil)) {
        result = ($a = ($b = (self.slice())).$sort, $a.$$p = block.$to_proc(), $a).call($b);
      }
      else {
        result = (self.slice()).$sort();
      }

      self.length = 0;
      for(var i = 0, length = result.length; i < length; i++) {
        self.push(result[i]);
      }

      return self;

    });

    Opal.defn(self, '$take', function(count) {
      var self = this;

      
      if (count < 0) {
        self.$raise($scope.get('ArgumentError'));
      }

      return self.slice(0, count);

    });

    Opal.defn(self, '$take_while', TMP_40 = function() {
      var self = this, $iter = TMP_40.$$p, block = $iter || nil;

      TMP_40.$$p = null;
      
      var result = [];

      for (var i = 0, length = self.length, item, value; i < length; i++) {
        item = self[i];

        if ((value = block(item)) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          return result;
        }

        result.push(item);
      }

      return result;
    
    });

    Opal.defn(self, '$to_a', function() {
      var self = this;

      return self;
    });

    Opal.alias(self, 'to_ary', 'to_a');

    Opal.defn(self, '$to_h', function() {
      var self = this;

      
      var i, len = self.length, ary, key, val, hash = $hash2([], {});

      for (i = 0; i < len; i++) {
        ary = $scope.get('Opal')['$coerce_to?'](self[i], $scope.get('Array'), "to_ary");
        if (!ary.$$is_array) {
          self.$raise($scope.get('TypeError'), "wrong element type " + ((ary).$class()) + " at " + (i) + " (expected array)")
        }
        if (ary.length !== 2) {
          self.$raise($scope.get('ArgumentError'), "wrong array length at " + (i) + " (expected 2, was " + ((ary).$length()) + ")")
        }
        key = ary[0];
        val = ary[1];
        Opal.hash_put(hash, key, val);
      }

      return hash;

    });

    Opal.alias(self, 'to_s', 'inspect');

    Opal.defn(self, '$transpose', function() {
      var $a, $b, TMP_41, self = this, result = nil, max = nil;

      if ((($a = self['$empty?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        return []}
      result = [];
      max = nil;
      ($a = ($b = self).$each, $a.$$p = (TMP_41 = function(row){var self = TMP_41.$$s || this, $a, $b, TMP_42;
if (row == null) row = nil;
      if ((($a = $scope.get('Array')['$==='](row)) !== nil && (!$a.$$is_boolean || $a == true))) {
          row = row.$to_a()
          } else {
          row = $scope.get('Opal').$coerce_to(row, $scope.get('Array'), "to_ary").$to_a()
        }
        ((($a = max) !== false && $a !== nil) ? $a : max = row.length);
        if ((($a = (row.length)['$!='](max)) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('IndexError'), "element size differs (" + (row.length) + " should be " + (max))}
        return ($a = ($b = (row.length)).$times, $a.$$p = (TMP_42 = function(i){var self = TMP_42.$$s || this, $a, $b, $c, entry = nil;
if (i == null) i = nil;
        entry = (($a = i, $b = result, ((($c = $b['$[]']($a)) !== false && $c !== nil) ? $c : $b['$[]=']($a, []))));
          return entry['$<<'](row.$at(i));}, TMP_42.$$s = self, TMP_42), $a).call($b);}, TMP_41.$$s = self, TMP_41), $a).call($b);
      return result;
    });

    Opal.defn(self, '$uniq', TMP_43 = function() {
      var self = this, $iter = TMP_43.$$p, block = $iter || nil;

      TMP_43.$$p = null;
      
      var hash = $hash2([], {}), i, length, item, key;

      if (block === nil) {
        for (i = 0, length = self.length; i < length; i++) {
          item = self[i];
          if (Opal.hash_get(hash, item) === undefined) {
            Opal.hash_put(hash, item, item);
          }
        }
      }
      else {
        for (i = 0, length = self.length; i < length; i++) {
          item = self[i];
          key = Opal.yield1(block, item);
          if (Opal.hash_get(hash, key) === undefined) {
            Opal.hash_put(hash, key, item);
          }
        }
      }

      return hash.$values();

    });

    Opal.defn(self, '$uniq!', TMP_44 = function() {
      var self = this, $iter = TMP_44.$$p, block = $iter || nil;

      TMP_44.$$p = null;
      
      var original_length = self.length, hash = $hash2([], {}), i, length, item, key;

      for (i = 0, length = original_length; i < length; i++) {
        item = self[i];
        key = (block === nil ? item : Opal.yield1(block, item));

        if (Opal.hash_get(hash, key) === undefined) {
          Opal.hash_put(hash, key, item);
          continue;
        }

        self.splice(i, 1);
        length--;
        i--;
      }

      return self.length === original_length ? nil : self;

    });

    Opal.defn(self, '$unshift', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var objects = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        objects[$splat_index] = arguments[$splat_index + 0];
      }
      
      for (var i = objects.length - 1; i >= 0; i--) {
        self.unshift(objects[i]);
      }
    
      return self;
    });

    Opal.defn(self, '$values_at', function() {
      var $a, $b, TMP_45, self = this, out = nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      out = [];
      ($a = ($b = args).$each, $a.$$p = (TMP_45 = function(elem){var self = TMP_45.$$s || this, $a, $b, TMP_46, finish = nil, start = nil, i = nil;
if (elem == null) elem = nil;
      if ((($a = elem['$kind_of?']($scope.get('Range'))) !== nil && (!$a.$$is_boolean || $a == true))) {
          finish = $scope.get('Opal').$coerce_to(elem.$last(), $scope.get('Integer'), "to_int");
          start = $scope.get('Opal').$coerce_to(elem.$first(), $scope.get('Integer'), "to_int");
          
          if (start < 0) {
            start = start + self.length;
            return nil;
          }
        
          
          if (finish < 0) {
            finish = finish + self.length;
          }
          if (elem['$exclude_end?']()) {
            finish--;
          }
          if (finish < start) {
            return nil;
          }
        
          return ($a = ($b = start).$upto, $a.$$p = (TMP_46 = function(i){var self = TMP_46.$$s || this;
if (i == null) i = nil;
          return out['$<<'](self.$at(i))}, TMP_46.$$s = self, TMP_46), $a).call($b, finish);
          } else {
          i = $scope.get('Opal').$coerce_to(elem, $scope.get('Integer'), "to_int");
          return out['$<<'](self.$at(i));
        }}, TMP_45.$$s = self, TMP_45), $a).call($b);
      return out;
    });

    return (Opal.defn(self, '$zip', TMP_47 = function() {
      var $a, self = this, $iter = TMP_47.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var others = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        others[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_47.$$p = null;
      
      var result = [], size = self.length, part, o, i, j, jj;

      for (j = 0, jj = others.length; j < jj; j++) {
        o = others[j];
        if (o.$$is_array) {
          continue;
        }
        if (o.$$is_enumerator) {
          if (o.$size() === Infinity) {
            others[j] = o.$take(size);
          } else {
            others[j] = o.$to_a();
          }
          continue;
        }
        others[j] = (((($a = $scope.get('Opal')['$coerce_to?'](o, $scope.get('Array'), "to_ary")) !== false && $a !== nil) ? $a : $scope.get('Opal')['$coerce_to!'](o, $scope.get('Enumerator'), "each"))).$to_a();
      }

      for (i = 0; i < size; i++) {
        part = [self[i]];

        for (j = 0, jj = others.length; j < jj; j++) {
          o = others[j][i];

          if (o == null) {
            o = nil;
          }

          part[j + 1] = o;
        }

        result[i] = part;
      }

      if (block !== nil) {
        for (i = 0; i < size; i++) {
          block(result[i]);
        }

        return nil;
      }

      return result;
    
    }), nil) && 'zip';
  })($scope.base, Array);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/hash"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$require', '$include', '$coerce_to?', '$[]', '$merge!', '$allocate', '$raise', '$==', '$coerce_to!', '$lambda?', '$abs', '$arity', '$call', '$enum_for', '$size', '$inspect', '$flatten', '$eql?', '$default', '$to_proc', '$dup', '$===', '$default_proc', '$default_proc=', '$default=', '$alias_method']);
  self.$require("corelib/enumerable");
  return (function($base, $super) {
    function $Hash(){}
    var self = $Hash = $klass($base, $super, 'Hash', $Hash);

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2, TMP_3, TMP_5, TMP_7, TMP_9, TMP_11, TMP_12, TMP_14, TMP_15, TMP_16, TMP_18, TMP_20, TMP_22;

    def.proc = def.none = nil;
    self.$include($scope.get('Enumerable'));

    def.$$is_hash = true;

    Opal.defs(self, '$[]', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var argv = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        argv[$splat_index] = arguments[$splat_index + 0];
      }
      
      var hash, argc = argv.length, i;

      if (argc === 1) {
        hash = $scope.get('Opal')['$coerce_to?'](argv['$[]'](0), $scope.get('Hash'), "to_hash");
        if (hash !== nil) {
          return self.$allocate()['$merge!'](hash);
        }

        argv = $scope.get('Opal')['$coerce_to?'](argv['$[]'](0), $scope.get('Array'), "to_ary");
        if (argv === nil) {
          self.$raise($scope.get('ArgumentError'), "odd number of arguments for Hash")
        }

        argc = argv.length;
        hash = self.$allocate();

        for (i = 0; i < argc; i++) {
          if (!argv[i].$$is_array) continue;
          switch(argv[i].length) {
          case 1:
            hash.$store(argv[i][0], nil);
            break;
          case 2:
            hash.$store(argv[i][0], argv[i][1]);
            break;
          default:
            self.$raise($scope.get('ArgumentError'), "invalid number of elements (" + (argv[i].length) + " for 1..2)")
          }
        }

        return hash;
      }

      if (argc % 2 !== 0) {
        self.$raise($scope.get('ArgumentError'), "odd number of arguments for Hash")
      }

      hash = self.$allocate();

      for (i = 0; i < argc; i += 2) {
        hash.$store(argv[i], argv[i + 1]);
      }

      return hash;

    });

    Opal.defs(self, '$allocate', function() {
      var self = this;

      
      var hash = new self.$$alloc();

      Opal.hash_init(hash);

      hash.none = nil;
      hash.proc = nil;

      return hash;
    
    });

    Opal.defs(self, '$try_convert', function(obj) {
      var self = this;

      return $scope.get('Opal')['$coerce_to?'](obj, $scope.get('Hash'), "to_hash");
    });

    Opal.defn(self, '$initialize', TMP_1 = function(defaults) {
      var self = this, $iter = TMP_1.$$p, block = $iter || nil;

      TMP_1.$$p = null;
      
      if (defaults !== undefined && block !== nil) {
        self.$raise($scope.get('ArgumentError'), "wrong number of arguments (1 for 0)")
      }
      self.none = (defaults === undefined ? nil : defaults);
      self.proc = block;

      return self;
    });

    Opal.defn(self, '$==', function(other) {
      var self = this;

      
      if (self === other) {
        return true;
      }

      if (!other.$$is_hash) {
        return false;
      }

      if (self.$$keys.length !== other.$$keys.length) {
        return false;
      }

      for (var i = 0, keys = self.$$keys, length = keys.length, key, value, other_value; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          value = self.$$smap[key];
          other_value = other.$$smap[key];
        } else {
          value = key.value;
          other_value = Opal.hash_get(other, key.key);
        }

        if (other_value === undefined || !value['$eql?'](other_value)) {
          return false;
        }
      }

      return true;
    
    });

    Opal.defn(self, '$[]', function(key) {
      var self = this;

      
      var value = Opal.hash_get(self, key);

      if (value !== undefined) {
        return value;
      }

      return self.$default(key);
    
    });

    Opal.defn(self, '$[]=', function(key, value) {
      var self = this;

      
      Opal.hash_put(self, key, value);
      return value;
    
    });

    Opal.defn(self, '$assoc', function(object) {
      var self = this;

      
      for (var i = 0, keys = self.$$keys, length = keys.length, key; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          if ((key)['$=='](object)) {
            return [key, self.$$smap[key]];
          }
        } else {
          if ((key.key)['$=='](object)) {
            return [key.key, key.value];
          }
        }
      }

      return nil;
    
    });

    Opal.defn(self, '$clear', function() {
      var self = this;

      
      Opal.hash_init(self);
      return self;
    
    });

    Opal.defn(self, '$clone', function() {
      var self = this;

      
      var hash = new self.$$class.$$alloc();

      Opal.hash_init(hash);
      Opal.hash_clone(self, hash);

      return hash;
    
    });

    Opal.defn(self, '$default', function(key) {
      var self = this;

      
      if (key !== undefined && self.proc !== nil) {
        return self.proc.$call(self, key);
      }
      return self.none;

    });

    Opal.defn(self, '$default=', function(object) {
      var self = this;

      
      self.proc = nil;
      self.none = object;

      return object;
    
    });

    Opal.defn(self, '$default_proc', function() {
      var self = this;

      return self.proc;
    });

    Opal.defn(self, '$default_proc=', function(proc) {
      var self = this;

      
      if (proc !== nil) {
        proc = $scope.get('Opal')['$coerce_to!'](proc, $scope.get('Proc'), "to_proc");

        if (proc['$lambda?']() && proc.$arity().$abs() !== 2) {
          self.$raise($scope.get('TypeError'), "default_proc takes two arguments");
        }
      }

      self.none = nil;
      self.proc = proc;

      return proc;

    });

    Opal.defn(self, '$delete', TMP_2 = function(key) {
      var self = this, $iter = TMP_2.$$p, block = $iter || nil;

      TMP_2.$$p = null;
      
      var value = Opal.hash_delete(self, key);

      if (value !== undefined) {
        return value;
      }

      if (block !== nil) {
        return block.$call(key);
      }

      return nil;
    
    });

    Opal.defn(self, '$delete_if', TMP_3 = function() {
      var $a, $b, TMP_4, self = this, $iter = TMP_3.$$p, block = $iter || nil;

      TMP_3.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_4 = function(){var self = TMP_4.$$s || this;

        return self.$size()}, TMP_4.$$s = self, TMP_4), $a).call($b, "delete_if")
      }
      
      for (var i = 0, keys = self.$$keys, length = keys.length, key, value, obj; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          value = self.$$smap[key];
        } else {
          value = key.value;
          key = key.key;
        }

        obj = block(key, value);

        if (obj === $breaker) {
          return $breaker.$v;
        }

        if (obj !== false && obj !== nil) {
          if (Opal.hash_delete(self, key) !== undefined) {
            length--;
            i--;
          }
        }
      }

      return self;
    
    });

    Opal.alias(self, 'dup', 'clone');

    Opal.defn(self, '$each', TMP_5 = function() {
      var $a, $b, TMP_6, self = this, $iter = TMP_5.$$p, block = $iter || nil;

      TMP_5.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_6 = function(){var self = TMP_6.$$s || this;

        return self.$size()}, TMP_6.$$s = self, TMP_6), $a).call($b, "each")
      }
      
      for (var i = 0, keys = self.$$keys, length = keys.length, key, value, obj; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          value = self.$$smap[key];
        } else {
          value = key.value;
          key = key.key;
        }

        obj = Opal.yield1(block, [key, value]);

        if (obj === $breaker) {
          return $breaker.$v;
        }
      }

      return self;
    
    });

    Opal.defn(self, '$each_key', TMP_7 = function() {
      var $a, $b, TMP_8, self = this, $iter = TMP_7.$$p, block = $iter || nil;

      TMP_7.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_8 = function(){var self = TMP_8.$$s || this;

        return self.$size()}, TMP_8.$$s = self, TMP_8), $a).call($b, "each_key")
      }
      
      for (var i = 0, keys = self.$$keys, length = keys.length, key; i < length; i++) {
        key = keys[i];

        if (block(key.$$is_string ? key : key.key) === $breaker) {
          return $breaker.$v;
        }
      }

      return self;
    
    });

    Opal.alias(self, 'each_pair', 'each');

    Opal.defn(self, '$each_value', TMP_9 = function() {
      var $a, $b, TMP_10, self = this, $iter = TMP_9.$$p, block = $iter || nil;

      TMP_9.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_10 = function(){var self = TMP_10.$$s || this;

        return self.$size()}, TMP_10.$$s = self, TMP_10), $a).call($b, "each_value")
      }
      
      for (var i = 0, keys = self.$$keys, length = keys.length, key; i < length; i++) {
        key = keys[i];

        if (block(key.$$is_string ? self.$$smap[key] : key.value) === $breaker) {
          return $breaker.$v;
        }
      }

      return self;
    
    });

    Opal.defn(self, '$empty?', function() {
      var self = this;

      return self.$$keys.length === 0;
    });

    Opal.alias(self, 'eql?', '==');

    Opal.defn(self, '$fetch', TMP_11 = function(key, defaults) {
      var self = this, $iter = TMP_11.$$p, block = $iter || nil;

      TMP_11.$$p = null;
      
      var value = Opal.hash_get(self, key);

      if (value !== undefined) {
        return value;
      }

      if (block !== nil) {
        value = block(key);

        if (value === $breaker) {
          return $breaker.$v;
        }

        return value;
      }

      if (defaults !== undefined) {
        return defaults;
      }
    
      return self.$raise($scope.get('KeyError'), "key not found: " + (key.$inspect()));
    });

    Opal.defn(self, '$flatten', function(level) {
      var self = this;

      if (level == null) {
        level = 1
      }
      level = $scope.get('Opal')['$coerce_to!'](level, $scope.get('Integer'), "to_int");
      
      var result = [];

      for (var i = 0, keys = self.$$keys, length = keys.length, key, value; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          value = self.$$smap[key];
        } else {
          value = key.value;
          key = key.key;
        }

        result.push(key);

        if (value.$$is_array) {
          if (level === 1) {
            result.push(value);
            continue;
          }

          result = result.concat((value).$flatten(level - 2));
          continue;
        }

        result.push(value);
      }

      return result;
    
    });

    Opal.defn(self, '$has_key?', function(key) {
      var self = this;

      return Opal.hash_get(self, key) !== undefined;
    });

    Opal.defn(self, '$has_value?', function(value) {
      var self = this;

      
      for (var i = 0, keys = self.$$keys, length = keys.length, key; i < length; i++) {
        key = keys[i];

        if (((key.$$is_string ? self.$$smap[key] : key.value))['$=='](value)) {
          return true;
        }
      }

      return false;
    
    });

    Opal.defn(self, '$hash', function() {
      var self = this;

      
      var top = (Opal.hash_ids === undefined),
          hash_id = self.$object_id(),
          result = ['Hash'],
          key, item;

      try {
        if (top) {
          Opal.hash_ids = {};
        }

        if (Opal.hash_ids.hasOwnProperty(hash_id)) {
          return 'self';
        }

        for (key in Opal.hash_ids) {
          if (Opal.hash_ids.hasOwnProperty(key)) {
            item = Opal.hash_ids[key];
            if (self['$eql?'](item)) {
              return 'self';
            }
          }
        }

        Opal.hash_ids[hash_id] = self;

        for (var i = 0, keys = self.$$keys, length = keys.length; i < length; i++) {
          key = keys[i];

          if (key.$$is_string) {
            result.push([key, self.$$smap[key].$hash()]);
          } else {
            result.push([key.key_hash, key.value.$hash()]);
          }
        }

        return result.sort().join();

      } finally {
        if (top) {
          delete Opal.hash_ids;
        }
      }
    
    });

    Opal.alias(self, 'include?', 'has_key?');

    Opal.defn(self, '$index', function(object) {
      var self = this;

      
      for (var i = 0, keys = self.$$keys, length = keys.length, key, value; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          value = self.$$smap[key];
        } else {
          value = key.value;
          key = key.key;
        }

        if ((value)['$=='](object)) {
          return key;
        }
      }

      return nil;
    
    });

    Opal.defn(self, '$indexes', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      
      var result = [];

      for (var i = 0, length = args.length, key, value; i < length; i++) {
        key = args[i];
        value = Opal.hash_get(self, key);

        if (value === undefined) {
          result.push(self.$default());
          continue;
        }

        result.push(value);
      }

      return result;
    
    });

    Opal.alias(self, 'indices', 'indexes');

    var inspect_ids;

    Opal.defn(self, '$inspect', function() {
      var self = this;

      
      var top = (inspect_ids === undefined),
          hash_id = self.$object_id(),
          result = [];

      try {
        if (top) {
          inspect_ids = {};
        }

        if (inspect_ids.hasOwnProperty(hash_id)) {
          return '{...}';
        }

        inspect_ids[hash_id] = true;

        for (var i = 0, keys = self.$$keys, length = keys.length, key, value; i < length; i++) {
          key = keys[i];

          if (key.$$is_string) {
            value = self.$$smap[key];
          } else {
            value = key.value;
            key = key.key;
          }

          result.push(key.$inspect() + '=>' + value.$inspect());
        }

        return '{' + result.join(', ') + '}';

      } finally {
        if (top) {
          inspect_ids = undefined;
        }
      }
    
    });

    Opal.defn(self, '$invert', function() {
      var self = this;

      
      var hash = Opal.hash();

      for (var i = 0, keys = self.$$keys, length = keys.length, key, value; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          value = self.$$smap[key];
        } else {
          value = key.value;
          key = key.key;
        }

        Opal.hash_put(hash, value, key);
      }

      return hash;
    
    });

    Opal.defn(self, '$keep_if', TMP_12 = function() {
      var $a, $b, TMP_13, self = this, $iter = TMP_12.$$p, block = $iter || nil;

      TMP_12.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_13 = function(){var self = TMP_13.$$s || this;

        return self.$size()}, TMP_13.$$s = self, TMP_13), $a).call($b, "keep_if")
      }
      
      for (var i = 0, keys = self.$$keys, length = keys.length, key, value, obj; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          value = self.$$smap[key];
        } else {
          value = key.value;
          key = key.key;
        }

        obj = block(key, value);

        if (obj === $breaker) {
          return $breaker.$v;
        }

        if (obj === false || obj === nil) {
          if (Opal.hash_delete(self, key) !== undefined) {
            length--;
            i--;
          }
        }
      }

      return self;
    
    });

    Opal.alias(self, 'key', 'index');

    Opal.alias(self, 'key?', 'has_key?');

    Opal.defn(self, '$keys', function() {
      var self = this;

      
      var result = [];

      for (var i = 0, keys = self.$$keys, length = keys.length, key; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          result.push(key);
        } else {
          result.push(key.key);
        }
      }

      return result;
    
    });

    Opal.defn(self, '$length', function() {
      var self = this;

      return self.$$keys.length;
    });

    Opal.alias(self, 'member?', 'has_key?');

    Opal.defn(self, '$merge', TMP_14 = function(other) {
      var $a, $b, self = this, $iter = TMP_14.$$p, block = $iter || nil;

      TMP_14.$$p = null;
      return ($a = ($b = self.$dup())['$merge!'], $a.$$p = block.$to_proc(), $a).call($b, other);
    });

    Opal.defn(self, '$merge!', TMP_15 = function(other) {
      var self = this, $iter = TMP_15.$$p, block = $iter || nil;

      TMP_15.$$p = null;
      
      if (!$scope.get('Hash')['$==='](other)) {
        other = $scope.get('Opal')['$coerce_to!'](other, $scope.get('Hash'), "to_hash");
      }

      var i, other_keys = other.$$keys, length = other_keys.length, key, value, other_value;

      if (block === nil) {
        for (i = 0; i < length; i++) {
          key = other_keys[i];

          if (key.$$is_string) {
            other_value = other.$$smap[key];
          } else {
            other_value = key.value;
            key = key.key;
          }

          Opal.hash_put(self, key, other_value);
        }

        return self;
      }

      for (i = 0; i < length; i++) {
        key = other_keys[i];

        if (key.$$is_string) {
          other_value = other.$$smap[key];
        } else {
          other_value = key.value;
          key = key.key;
        }

        value = Opal.hash_get(self, key);

        if (value === undefined) {
          Opal.hash_put(self, key, other_value);
          continue;
        }

        Opal.hash_put(self, key, block(key, value, other_value));
      }

      return self;

    });

    Opal.defn(self, '$rassoc', function(object) {
      var self = this;

      
      for (var i = 0, keys = self.$$keys, length = keys.length, key, value; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          value = self.$$smap[key];
        } else {
          value = key.value;
          key = key.key;
        }

        if ((value)['$=='](object)) {
          return [key, value];
        }
      }

      return nil;
    
    });

    Opal.defn(self, '$rehash', function() {
      var self = this;

      
      Opal.hash_rehash(self);
      return self;
    
    });

    Opal.defn(self, '$reject', TMP_16 = function() {
      var $a, $b, TMP_17, self = this, $iter = TMP_16.$$p, block = $iter || nil;

      TMP_16.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_17 = function(){var self = TMP_17.$$s || this;

        return self.$size()}, TMP_17.$$s = self, TMP_17), $a).call($b, "reject")
      }
      
      var hash = Opal.hash();

      for (var i = 0, keys = self.$$keys, length = keys.length, key, value, obj; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          value = self.$$smap[key];
        } else {
          value = key.value;
          key = key.key;
        }

        obj = block(key, value);

        if (obj === $breaker) {
          return $breaker.$v;
        }

        if (obj === false || obj === nil) {
          Opal.hash_put(hash, key, value);
        }
      }

      return hash;
    
    });

    Opal.defn(self, '$reject!', TMP_18 = function() {
      var $a, $b, TMP_19, self = this, $iter = TMP_18.$$p, block = $iter || nil;

      TMP_18.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_19 = function(){var self = TMP_19.$$s || this;

        return self.$size()}, TMP_19.$$s = self, TMP_19), $a).call($b, "reject!")
      }
      
      var changes_were_made = false;

      for (var i = 0, keys = self.$$keys, length = keys.length, key, value, obj; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          value = self.$$smap[key];
        } else {
          value = key.value;
          key = key.key;
        }

        obj = block(key, value);

        if (obj === $breaker) {
          return $breaker.$v;
        }

        if (obj !== false && obj !== nil) {
          if (Opal.hash_delete(self, key) !== undefined) {
            changes_were_made = true;
            length--;
            i--;
          }
        }
      }

      return changes_were_made ? self : nil;
    
    });

    Opal.defn(self, '$replace', function(other) {
      var $a, $b, self = this;

      other = $scope.get('Opal')['$coerce_to!'](other, $scope.get('Hash'), "to_hash");
      
      Opal.hash_init(self);

      for (var i = 0, other_keys = other.$$keys, length = other_keys.length, key, value, other_value; i < length; i++) {
        key = other_keys[i];

        if (key.$$is_string) {
          other_value = other.$$smap[key];
        } else {
          other_value = key.value;
          key = key.key;
        }

        Opal.hash_put(self, key, other_value);
      }
    
      if ((($a = other.$default_proc()) !== nil && (!$a.$$is_boolean || $a == true))) {
        (($a = [other.$default_proc()]), $b = self, $b['$default_proc='].apply($b, $a), $a[$a.length-1])
        } else {
        (($a = [other.$default()]), $b = self, $b['$default='].apply($b, $a), $a[$a.length-1])
      }
      return self;
    });

    Opal.defn(self, '$select', TMP_20 = function() {
      var $a, $b, TMP_21, self = this, $iter = TMP_20.$$p, block = $iter || nil;

      TMP_20.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_21 = function(){var self = TMP_21.$$s || this;

        return self.$size()}, TMP_21.$$s = self, TMP_21), $a).call($b, "select")
      }
      
      var hash = Opal.hash();

      for (var i = 0, keys = self.$$keys, length = keys.length, key, value, obj; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          value = self.$$smap[key];
        } else {
          value = key.value;
          key = key.key;
        }

        obj = block(key, value);

        if (obj === $breaker) {
          return $breaker.$v;
        }

        if (obj !== false && obj !== nil) {
          Opal.hash_put(hash, key, value);
        }
      }

      return hash;
    
    });

    Opal.defn(self, '$select!', TMP_22 = function() {
      var $a, $b, TMP_23, self = this, $iter = TMP_22.$$p, block = $iter || nil;

      TMP_22.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_23 = function(){var self = TMP_23.$$s || this;

        return self.$size()}, TMP_23.$$s = self, TMP_23), $a).call($b, "select!")
      }
      
      var result = nil;

      for (var i = 0, keys = self.$$keys, length = keys.length, key, value, obj; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          value = self.$$smap[key];
        } else {
          value = key.value;
          key = key.key;
        }

        obj = block(key, value);

        if (obj === $breaker) {
          return $breaker.$v;
        }

        if (obj === false || obj === nil) {
          if (Opal.hash_delete(self, key) !== undefined) {
            length--;
            i--;
          }
          result = self;
        }
      }

      return result;
    
    });

    Opal.defn(self, '$shift', function() {
      var self = this;

      
      var keys = self.$$keys,
          key;

      if (keys.length > 0) {
        key = keys[0];

        key = key.$$is_string ? key : key.key;

        return [key, Opal.hash_delete(self, key)];
      }

      return self.$default(nil);
    
    });

    Opal.alias(self, 'size', 'length');

    self.$alias_method("store", "[]=");

    Opal.defn(self, '$to_a', function() {
      var self = this;

      
      var result = [];

      for (var i = 0, keys = self.$$keys, length = keys.length, key, value; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          value = self.$$smap[key];
        } else {
          value = key.value;
          key = key.key;
        }

        result.push([key, value]);
      }

      return result;
    
    });

    Opal.defn(self, '$to_h', function() {
      var self = this;

      
      if (self.$$class === Opal.Hash) {
        return self;
      }

      var hash = new Opal.Hash.$$alloc();

      Opal.hash_init(hash);
      Opal.hash_clone(self, hash);

      return hash;
    
    });

    Opal.defn(self, '$to_hash', function() {
      var self = this;

      return self;
    });

    Opal.alias(self, 'to_s', 'inspect');

    Opal.alias(self, 'update', 'merge!');

    Opal.alias(self, 'value?', 'has_value?');

    Opal.alias(self, 'values_at', 'indexes');

    return (Opal.defn(self, '$values', function() {
      var self = this;

      
      var result = [];

      for (var i = 0, keys = self.$$keys, length = keys.length, key; i < length; i++) {
        key = keys[i];

        if (key.$$is_string) {
          result.push(self.$$smap[key]);
        } else {
          result.push(key.value);
        }
      }

      return result;
    
    }), nil) && 'values';
  })($scope.base, null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/number"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  function $rb_times(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs * rhs : lhs['$*'](rhs);
  }
  function $rb_le(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs <= rhs : lhs['$<='](rhs);
  }
  function $rb_ge(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs >= rhs : lhs['$>='](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$require', '$bridge', '$raise', '$class', '$Float', '$respond_to?', '$coerce_to!', '$__coerced__', '$===', '$!', '$>', '$**', '$new', '$<', '$to_f', '$==', '$nan?', '$infinite?', '$enum_for', '$+', '$-', '$gcd', '$lcm', '$/', '$frexp', '$to_i', '$ldexp', '$rationalize', '$*', '$<<', '$to_r', '$-@', '$size', '$<=', '$>=']);
  self.$require("corelib/numeric");
  (function($base, $super) {
    function $Number(){}
    var self = $Number = $klass($base, $super, 'Number', $Number);

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11;

    $scope.get('Opal').$bridge(self, Number);

    Number.prototype.$$is_number = true;

    Opal.defn(self, '$coerce', function(other) {
      var self = this;

      
      if (other === nil) {
        self.$raise($scope.get('TypeError'), "can't convert " + (other.$class()) + " into Float");
      }
      else if (other.$$is_string) {
        return [self.$Float(other), self];
      }
      else if (other['$respond_to?']("to_f")) {
        return [$scope.get('Opal')['$coerce_to!'](other, $scope.get('Float'), "to_f"), self];
      }
      else if (other.$$is_number) {
        return [other, self];
      }
      else {
        self.$raise($scope.get('TypeError'), "can't convert " + (other.$class()) + " into Float");
      }

    });

    Opal.defn(self, '$__id__', function() {
      var self = this;

      return (self * 2) + 1;
    });

    Opal.alias(self, 'object_id', '__id__');

    Opal.defn(self, '$+', function(other) {
      var self = this;

      
      if (other.$$is_number) {
        return self + other;
      }
      else {
        return self.$__coerced__("+", other);
      }
    
    });

    Opal.defn(self, '$-', function(other) {
      var self = this;

      
      if (other.$$is_number) {
        return self - other;
      }
      else {
        return self.$__coerced__("-", other);
      }
    
    });

    Opal.defn(self, '$*', function(other) {
      var self = this;

      
      if (other.$$is_number) {
        return self * other;
      }
      else {
        return self.$__coerced__("*", other);
      }
    
    });

    Opal.defn(self, '$/', function(other) {
      var self = this;

      
      if (other.$$is_number) {
        return self / other;
      }
      else {
        return self.$__coerced__("/", other);
      }
    
    });

    Opal.alias(self, 'fdiv', '/');

    Opal.defn(self, '$%', function(other) {
      var self = this;

      
      if (other.$$is_number) {
        if (other == -Infinity) {
          return other;
        }
        else if (other == 0) {
          self.$raise($scope.get('ZeroDivisionError'), "divided by 0");
        }
        else if (other < 0 || self < 0) {
          return (self % other + other) % other;
        }
        else {
          return self % other;
        }
      }
      else {
        return self.$__coerced__("%", other);
      }
    
    });

    Opal.defn(self, '$&', function(other) {
      var self = this;

      
      if (other.$$is_number) {
        return self & other;
      }
      else {
        return self.$__coerced__("&", other);
      }
    
    });

    Opal.defn(self, '$|', function(other) {
      var self = this;

      
      if (other.$$is_number) {
        return self | other;
      }
      else {
        return self.$__coerced__("|", other);
      }
    
    });

    Opal.defn(self, '$^', function(other) {
      var self = this;

      
      if (other.$$is_number) {
        return self ^ other;
      }
      else {
        return self.$__coerced__("^", other);
      }
    
    });

    Opal.defn(self, '$<', function(other) {
      var self = this;

      
      if (other.$$is_number) {
        return self < other;
      }
      else {
        return self.$__coerced__("<", other);
      }
    
    });

    Opal.defn(self, '$<=', function(other) {
      var self = this;

      
      if (other.$$is_number) {
        return self <= other;
      }
      else {
        return self.$__coerced__("<=", other);
      }
    
    });

    Opal.defn(self, '$>', function(other) {
      var self = this;

      
      if (other.$$is_number) {
        return self > other;
      }
      else {
        return self.$__coerced__(">", other);
      }
    
    });

    Opal.defn(self, '$>=', function(other) {
      var self = this;

      
      if (other.$$is_number) {
        return self >= other;
      }
      else {
        return self.$__coerced__(">=", other);
      }
    
    });

    Opal.defn(self, '$<=>', function(other) {
      var self = this;

      try {
      
      if (other.$$is_number) {
        if (isNaN(self) || isNaN(other)) {
          return nil;
        }

        return self > other ? 1 : (self < other ? -1 : 0);
      }
      else {
        return self.$__coerced__("<=>", other);
      }
    
      } catch ($err) {if (Opal.rescue($err, [$scope.get('ArgumentError')])) {
        try {
          return nil
        } finally {
          Opal.gvars["!"] = Opal.exceptions.pop() || Opal.nil;
        }
        }else { throw $err; }
      }
    });

    Opal.defn(self, '$<<', function(count) {
      var self = this;

      count = $scope.get('Opal')['$coerce_to!'](count, $scope.get('Integer'), "to_int");
      return count > 0 ? self << count : self >> -count;
    });

    Opal.defn(self, '$>>', function(count) {
      var self = this;

      count = $scope.get('Opal')['$coerce_to!'](count, $scope.get('Integer'), "to_int");
      return count > 0 ? self >> count : self << -count;
    });

    Opal.defn(self, '$[]', function(bit) {
      var self = this;

      bit = $scope.get('Opal')['$coerce_to!'](bit, $scope.get('Integer'), "to_int");
      
      if (bit < (($scope.get('Integer')).$$scope.get('MIN')) || bit > (($scope.get('Integer')).$$scope.get('MAX'))) {
        return 0;
      }

      if (self < 0) {
        return (((~self) + 1) >> bit) % 2;
      }
      else {
        return (self >> bit) % 2;
      }

    });

    Opal.defn(self, '$+@', function() {
      var self = this;

      return +self;
    });

    Opal.defn(self, '$-@', function() {
      var self = this;

      return -self;
    });

    Opal.defn(self, '$~', function() {
      var self = this;

      return ~self;
    });

    Opal.defn(self, '$**', function(other) {
      var $a, $b, $c, self = this;

      if ((($a = $scope.get('Integer')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = ((($b = ($scope.get('Integer')['$==='](self))['$!']()) !== false && $b !== nil) ? $b : $rb_gt(other, 0))) !== nil && (!$a.$$is_boolean || $a == true))) {
          return Math.pow(self, other);
          } else {
          return $scope.get('Rational').$new(self, 1)['$**'](other)
        }
      } else if ((($a = (($b = $rb_lt(self, 0)) ? (((($c = $scope.get('Float')['$==='](other)) !== false && $c !== nil) ? $c : $scope.get('Rational')['$==='](other))) : $rb_lt(self, 0))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return $scope.get('Complex').$new(self, 0)['$**'](other.$to_f())
      } else if ((($a = other.$$is_number != null) !== nil && (!$a.$$is_boolean || $a == true))) {
        return Math.pow(self, other);
        } else {
        return self.$__coerced__("**", other)
      }
    });

    Opal.defn(self, '$==', function(other) {
      var self = this;

      
      if (other.$$is_number) {
        return self == Number(other);
      }
      else if (other['$respond_to?']("==")) {
        return other['$=='](self);
      }
      else {
        return false;
      }

    });

    Opal.defn(self, '$abs', function() {
      var self = this;

      return Math.abs(self);
    });

    Opal.defn(self, '$abs2', function() {
      var self = this;

      return Math.abs(self * self);
    });

    Opal.defn(self, '$angle', function() {
      var $a, self = this;

      if ((($a = self['$nan?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self}
      
      if (self == 0) {
        if (1 / self > 0) {
          return 0;
        }
        else {
          return Math.PI;
        }
      }
      else if (self < 0) {
        return Math.PI;
      }
      else {
        return 0;
      }
    
    });

    Opal.alias(self, 'arg', 'angle');

    Opal.alias(self, 'phase', 'angle');

    Opal.defn(self, '$bit_length', function() {
      var $a, self = this;

      if ((($a = $scope.get('Integer')['$==='](self)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('NoMethodError').$new("undefined method `bit_length` for " + (self) + ":Float", "bit_length"))
      }
      
      if (self === 0 || self === -1) {
        return 0;
      }

      var result = 0,
          value  = self < 0 ? ~self : self;

      while (value != 0) {
        result   += 1;
        value  >>>= 1;
      }

      return result;
    
    });

    Opal.defn(self, '$ceil', function() {
      var self = this;

      return Math.ceil(self);
    });

    Opal.defn(self, '$chr', function(encoding) {
      var self = this;

      return String.fromCharCode(self);
    });

    Opal.defn(self, '$denominator', TMP_1 = function() {
      var $a, $b, self = this, $iter = TMP_1.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

      TMP_1.$$p = null;
      $zuper = [];
      for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
        $zuper[$zuper_index] = arguments[$zuper_index];
      }
      if ((($a = ((($b = self['$nan?']()) !== false && $b !== nil) ? $b : self['$infinite?']())) !== nil && (!$a.$$is_boolean || $a == true))) {
        return 1
        } else {
        return Opal.find_super_dispatcher(self, 'denominator', TMP_1, $iter).apply(self, $zuper)
      }
    });

    Opal.defn(self, '$downto', TMP_2 = function(stop) {
      var $a, $b, TMP_3, self = this, $iter = TMP_2.$$p, block = $iter || nil;

      TMP_2.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_3 = function(){var self = TMP_3.$$s || this, $a;

        if ((($a = $scope.get('Numeric')['$==='](stop)) !== nil && (!$a.$$is_boolean || $a == true))) {
            } else {
            self.$raise($scope.get('ArgumentError'), "comparison of " + (self.$class()) + " with " + (stop.$class()) + " failed")
          }
          if ((($a = $rb_gt(stop, self)) !== nil && (!$a.$$is_boolean || $a == true))) {
            return 0
            } else {
            return $rb_plus($rb_minus(self, stop), 1)
          }}, TMP_3.$$s = self, TMP_3), $a).call($b, "downto", stop)
      }
      
      if (!stop.$$is_number) {
        self.$raise($scope.get('ArgumentError'), "comparison of " + (self.$class()) + " with " + (stop.$class()) + " failed")
      }
      for (var i = self; i >= stop; i--) {
        if (block(i) === $breaker) {
          return $breaker.$v;
        }
      }

      return self;
    });

    Opal.alias(self, 'eql?', '==');

    Opal.defn(self, '$equal?', function(other) {
      var $a, self = this;

      return ((($a = self['$=='](other)) !== false && $a !== nil) ? $a : isNaN(self) && isNaN(other));
    });

    Opal.defn(self, '$even?', function() {
      var self = this;

      return self % 2 === 0;
    });

    Opal.defn(self, '$floor', function() {
      var self = this;

      return Math.floor(self);
    });

    Opal.defn(self, '$gcd', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Integer')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('TypeError'), "not an integer")
      }
      
      var min = Math.abs(self),
          max = Math.abs(other);

      while (min > 0) {
        var tmp = min;

        min = max % min;
        max = tmp;
      }

      return max;
    
    });

    Opal.defn(self, '$gcdlcm', function(other) {
      var self = this;

      return [self.$gcd(), self.$lcm()];
    });

    Opal.defn(self, '$integer?', function() {
      var self = this;

      return self % 1 === 0;
    });

    Opal.defn(self, '$is_a?', TMP_4 = function(klass) {
      var $a, $b, self = this, $iter = TMP_4.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

      TMP_4.$$p = null;
      $zuper = [];
      for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
        $zuper[$zuper_index] = arguments[$zuper_index];
      }
      if ((($a = (($b = klass['$==']($scope.get('Fixnum'))) ? $scope.get('Integer')['$==='](self) : klass['$==']($scope.get('Fixnum')))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return true}
      if ((($a = (($b = klass['$==']($scope.get('Integer'))) ? $scope.get('Integer')['$==='](self) : klass['$==']($scope.get('Integer')))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return true}
      if ((($a = (($b = klass['$==']($scope.get('Float'))) ? $scope.get('Float')['$==='](self) : klass['$==']($scope.get('Float')))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return true}
      return Opal.find_super_dispatcher(self, 'is_a?', TMP_4, $iter).apply(self, $zuper);
    });

    Opal.alias(self, 'kind_of?', 'is_a?');

    Opal.defn(self, '$instance_of?', TMP_5 = function(klass) {
      var $a, $b, self = this, $iter = TMP_5.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

      TMP_5.$$p = null;
      $zuper = [];
      for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
        $zuper[$zuper_index] = arguments[$zuper_index];
      }
      if ((($a = (($b = klass['$==']($scope.get('Fixnum'))) ? $scope.get('Integer')['$==='](self) : klass['$==']($scope.get('Fixnum')))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return true}
      if ((($a = (($b = klass['$==']($scope.get('Integer'))) ? $scope.get('Integer')['$==='](self) : klass['$==']($scope.get('Integer')))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return true}
      if ((($a = (($b = klass['$==']($scope.get('Float'))) ? $scope.get('Float')['$==='](self) : klass['$==']($scope.get('Float')))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return true}
      return Opal.find_super_dispatcher(self, 'instance_of?', TMP_5, $iter).apply(self, $zuper);
    });

    Opal.defn(self, '$lcm', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Integer')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('TypeError'), "not an integer")
      }
      
      if (self == 0 || other == 0) {
        return 0;
      }
      else {
        return Math.abs(self * other / self.$gcd(other));
      }
    
    });

    Opal.alias(self, 'magnitude', 'abs');

    Opal.alias(self, 'modulo', '%');

    Opal.defn(self, '$next', function() {
      var self = this;

      return self + 1;
    });

    Opal.defn(self, '$nonzero?', function() {
      var self = this;

      return self == 0 ? nil : self;
    });

    Opal.defn(self, '$numerator', TMP_6 = function() {
      var $a, $b, self = this, $iter = TMP_6.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

      TMP_6.$$p = null;
      $zuper = [];
      for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
        $zuper[$zuper_index] = arguments[$zuper_index];
      }
      if ((($a = ((($b = self['$nan?']()) !== false && $b !== nil) ? $b : self['$infinite?']())) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self
        } else {
        return Opal.find_super_dispatcher(self, 'numerator', TMP_6, $iter).apply(self, $zuper)
      }
    });

    Opal.defn(self, '$odd?', function() {
      var self = this;

      return self % 2 !== 0;
    });

    Opal.defn(self, '$ord', function() {
      var self = this;

      return self;
    });

    Opal.defn(self, '$pred', function() {
      var self = this;

      return self - 1;
    });

    Opal.defn(self, '$quo', TMP_7 = function(other) {
      var $a, self = this, $iter = TMP_7.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

      TMP_7.$$p = null;
      $zuper = [];
      for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
        $zuper[$zuper_index] = arguments[$zuper_index];
      }
      if ((($a = $scope.get('Integer')['$==='](self)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return Opal.find_super_dispatcher(self, 'quo', TMP_7, $iter).apply(self, $zuper)
        } else {
        return $rb_divide(self, other)
      }
    });

    Opal.defn(self, '$rationalize', function(eps) {
      var $a, $b, self = this, f = nil, n = nil;

      
      if (arguments.length > 1) {
        self.$raise($scope.get('ArgumentError'), "wrong number of arguments (" + (arguments.length) + " for 0..1)");
      }

      if ((($a = $scope.get('Integer')['$==='](self)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return $scope.get('Rational').$new(self, 1)
      } else if ((($a = self['$infinite?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$raise($scope.get('FloatDomainError'), "Infinity")
      } else if ((($a = self['$nan?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$raise($scope.get('FloatDomainError'), "NaN")
      } else if ((($a = eps == null) !== nil && (!$a.$$is_boolean || $a == true))) {
        $b = $scope.get('Math').$frexp(self), $a = Opal.to_ary($b), f = ($a[0] == null ? nil : $a[0]), n = ($a[1] == null ? nil : $a[1]), $b;
        f = $scope.get('Math').$ldexp(f, (($scope.get('Float')).$$scope.get('MANT_DIG'))).$to_i();
        n = $rb_minus(n, (($scope.get('Float')).$$scope.get('MANT_DIG')));
        return $scope.get('Rational').$new($rb_times(2, f), (1)['$<<'](($rb_minus(1, n)))).$rationalize($scope.get('Rational').$new(1, (1)['$<<'](($rb_minus(1, n)))));
        } else {
        return self.$to_r().$rationalize(eps)
      }
    });

    Opal.defn(self, '$round', function(ndigits) {
      var $a, $b, self = this, _ = nil, exp = nil;

      if ((($a = $scope.get('Integer')['$==='](self)) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = ndigits == null) !== nil && (!$a.$$is_boolean || $a == true))) {
          return self}
        if ((($a = ($b = $scope.get('Float')['$==='](ndigits), $b !== false && $b !== nil ?ndigits['$infinite?']() : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('RangeError'), "Infinity")}
        ndigits = $scope.get('Opal')['$coerce_to!'](ndigits, $scope.get('Integer'), "to_int");
        if ((($a = $rb_lt(ndigits, (($scope.get('Integer')).$$scope.get('MIN')))) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('RangeError'), "out of bounds")}
        if ((($a = ndigits >= 0) !== nil && (!$a.$$is_boolean || $a == true))) {
          return self}
        ndigits = ndigits['$-@']();
        
        if (0.415241 * ndigits - 0.125 > self.$size()) {
          return 0;
        }

        var f = Math.pow(10, ndigits),
            x = Math.floor((Math.abs(x) + f / 2) / f) * f;

        return self < 0 ? -x : x;

        } else {
        if ((($a = ($b = self['$nan?'](), $b !== false && $b !== nil ?ndigits == null : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('FloatDomainError'), "NaN")}
        ndigits = $scope.get('Opal')['$coerce_to!'](ndigits || 0, $scope.get('Integer'), "to_int");
        if ((($a = $rb_le(ndigits, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
          if ((($a = self['$nan?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
            self.$raise($scope.get('RangeError'), "NaN")
          } else if ((($a = self['$infinite?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
            self.$raise($scope.get('FloatDomainError'), "Infinity")}
        } else if (ndigits['$=='](0)) {
          return Math.round(self)
        } else if ((($a = ((($b = self['$nan?']()) !== false && $b !== nil) ? $b : self['$infinite?']())) !== nil && (!$a.$$is_boolean || $a == true))) {
          return self}
        $b = $scope.get('Math').$frexp(self), $a = Opal.to_ary($b), _ = ($a[0] == null ? nil : $a[0]), exp = ($a[1] == null ? nil : $a[1]), $b;
        if ((($a = $rb_ge(ndigits, $rb_minus(($rb_plus((($scope.get('Float')).$$scope.get('DIG')), 2)), ((function() {if ((($b = $rb_gt(exp, 0)) !== nil && (!$b.$$is_boolean || $b == true))) {
          return $rb_divide(exp, 4)
          } else {
          return $rb_minus($rb_divide(exp, 3), 1)
        } return nil; })())))) !== nil && (!$a.$$is_boolean || $a == true))) {
          return self}
        if ((($a = $rb_lt(ndigits, ((function() {if ((($b = $rb_gt(exp, 0)) !== nil && (!$b.$$is_boolean || $b == true))) {
          return $rb_plus($rb_divide(exp, 3), 1)
          } else {
          return $rb_divide(exp, 4)
        } return nil; })())['$-@']())) !== nil && (!$a.$$is_boolean || $a == true))) {
          return 0}
        return Math.round(self * Math.pow(10, ndigits)) / Math.pow(10, ndigits);
      }
    });

    Opal.defn(self, '$step', TMP_8 = function(limit, step) {
      var $a, self = this, $iter = TMP_8.$$p, block = $iter || nil;

      if (step == null) {
        step = 1
      }
      TMP_8.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.$enum_for("step", limit, step)
      }
      if ((($a = step == 0) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "step cannot be 0")}
      
      var value = self;

      if (limit === Infinity || limit === -Infinity) {
        block(value);
        return self;
      }

      if (step > 0) {
        while (value <= limit) {
          block(value);
          value += step;
        }
      }
      else {
        while (value >= limit) {
          block(value);
          value += step;
        }
      }
    
      return self;
    });

    Opal.alias(self, 'succ', 'next');

    Opal.defn(self, '$times', TMP_9 = function() {
      var self = this, $iter = TMP_9.$$p, block = $iter || nil;

      TMP_9.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        return self.$enum_for("times")
      }
      
      for (var i = 0; i < self; i++) {
        if (block(i) === $breaker) {
          return $breaker.$v;
        }
      }
    
      return self;
    });

    Opal.defn(self, '$to_f', function() {
      var self = this;

      return self;
    });

    Opal.defn(self, '$to_i', function() {
      var self = this;

      return parseInt(self, 10);
    });

    Opal.alias(self, 'to_int', 'to_i');

    Opal.defn(self, '$to_r', function() {
      var $a, $b, self = this, f = nil, e = nil;

      if ((($a = $scope.get('Integer')['$==='](self)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return $scope.get('Rational').$new(self, 1)
        } else {
        $b = $scope.get('Math').$frexp(self), $a = Opal.to_ary($b), f = ($a[0] == null ? nil : $a[0]), e = ($a[1] == null ? nil : $a[1]), $b;
        f = $scope.get('Math').$ldexp(f, (($scope.get('Float')).$$scope.get('MANT_DIG'))).$to_i();
        e = $rb_minus(e, (($scope.get('Float')).$$scope.get('MANT_DIG')));
        return ($rb_times(f, ((($scope.get('Float')).$$scope.get('RADIX'))['$**'](e)))).$to_r();
      }
    });

    Opal.defn(self, '$to_s', function(base) {
      var $a, $b, self = this;

      if (base == null) {
        base = 10
      }
      if ((($a = ((($b = $rb_lt(base, 2)) !== false && $b !== nil) ? $b : $rb_gt(base, 36))) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "base must be between 2 and 36")}
      return self.toString(base);
    });

    Opal.alias(self, 'truncate', 'to_i');

    Opal.alias(self, 'inspect', 'to_s');

    Opal.defn(self, '$divmod', TMP_10 = function(other) {
      var $a, $b, self = this, $iter = TMP_10.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

      TMP_10.$$p = null;
      $zuper = [];
      for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
        $zuper[$zuper_index] = arguments[$zuper_index];
      }
      if ((($a = ((($b = self['$nan?']()) !== false && $b !== nil) ? $b : other['$nan?']())) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$raise($scope.get('FloatDomainError'), "NaN")
      } else if ((($a = self['$infinite?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$raise($scope.get('FloatDomainError'), "Infinity")
        } else {
        return Opal.find_super_dispatcher(self, 'divmod', TMP_10, $iter).apply(self, $zuper)
      }
    });

    Opal.defn(self, '$upto', TMP_11 = function(stop) {
      var $a, $b, TMP_12, self = this, $iter = TMP_11.$$p, block = $iter || nil;

      TMP_11.$$p = null;
      if ((block !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_12 = function(){var self = TMP_12.$$s || this, $a;

        if ((($a = $scope.get('Numeric')['$==='](stop)) !== nil && (!$a.$$is_boolean || $a == true))) {
            } else {
            self.$raise($scope.get('ArgumentError'), "comparison of " + (self.$class()) + " with " + (stop.$class()) + " failed")
          }
          if ((($a = $rb_lt(stop, self)) !== nil && (!$a.$$is_boolean || $a == true))) {
            return 0
            } else {
            return $rb_plus($rb_minus(stop, self), 1)
          }}, TMP_12.$$s = self, TMP_12), $a).call($b, "upto", stop)
      }
      
      if (!stop.$$is_number) {
        self.$raise($scope.get('ArgumentError'), "comparison of " + (self.$class()) + " with " + (stop.$class()) + " failed")
      }
      for (var i = self; i <= stop; i++) {
        if (block(i) === $breaker) {
          return $breaker.$v;
        }
      }

      return self;
    });

    Opal.defn(self, '$zero?', function() {
      var self = this;

      return self == 0;
    });

    Opal.defn(self, '$size', function() {
      var self = this;

      return 4;
    });

    Opal.defn(self, '$nan?', function() {
      var self = this;

      return isNaN(self);
    });

    Opal.defn(self, '$finite?', function() {
      var self = this;

      return self != Infinity && self != -Infinity && !isNaN(self);
    });

    Opal.defn(self, '$infinite?', function() {
      var self = this;

      
      if (self == Infinity) {
        return +1;
      }
      else if (self == -Infinity) {
        return -1;
      }
      else {
        return nil;
      }
    
    });

    Opal.defn(self, '$positive?', function() {
      var self = this;

      return self == Infinity || 1 / self > 0;
    });

    return (Opal.defn(self, '$negative?', function() {
      var self = this;

      return self == -Infinity || 1 / self < 0;
    }), nil) && 'negative?';
  })($scope.base, $scope.get('Numeric'));
  Opal.cdecl($scope, 'Fixnum', $scope.get('Number'));
  (function($base, $super) {
    function $Integer(){}
    var self = $Integer = $klass($base, $super, 'Integer', $Integer);

    var def = self.$$proto, $scope = self.$$scope;

    Opal.defs(self, '$===', function(other) {
      var self = this;

      
      if (!other.$$is_number) {
        return false;
      }

      return (other % 1) === 0;
    
    });

    Opal.cdecl($scope, 'MAX', Math.pow(2, 30) - 1);

    return Opal.cdecl($scope, 'MIN', -Math.pow(2, 30));
  })($scope.base, $scope.get('Numeric'));
  return (function($base, $super) {
    function $Float(){}
    var self = $Float = $klass($base, $super, 'Float', $Float);

    var def = self.$$proto, $scope = self.$$scope, $a;

    Opal.defs(self, '$===', function(other) {
      var self = this;

      return !!other.$$is_number;
    });

    Opal.cdecl($scope, 'INFINITY', Infinity);

    Opal.cdecl($scope, 'MAX', Number.MAX_VALUE);

    Opal.cdecl($scope, 'MIN', Number.MIN_VALUE);

    Opal.cdecl($scope, 'NAN', NaN);

    Opal.cdecl($scope, 'DIG', 15);

    Opal.cdecl($scope, 'MANT_DIG', 53);

    Opal.cdecl($scope, 'RADIX', 2);

    if ((($a = (typeof(Number.EPSILON) !== "undefined")) !== nil && (!$a.$$is_boolean || $a == true))) {
      return Opal.cdecl($scope, 'EPSILON', Number.EPSILON)
      } else {
      return Opal.cdecl($scope, 'EPSILON', 2.2204460492503130808472633361816E-16)
    }
  })($scope.base, $scope.get('Numeric'));
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/range"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_le(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs <= rhs : lhs['$<='](rhs);
  }
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$require', '$include', '$attr_reader', '$<=>', '$raise', '$include?', '$<=', '$<', '$enum_for', '$upto', '$to_proc', '$succ', '$!', '$==', '$===', '$exclude_end?', '$eql?', '$begin', '$end', '$-', '$abs', '$to_i', '$inspect']);
  self.$require("corelib/enumerable");
  return (function($base, $super) {
    function $Range(){}
    var self = $Range = $klass($base, $super, 'Range', $Range);

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2, TMP_3;

    def.begin = def.exclude = def.end = nil;
    self.$include($scope.get('Enumerable'));

    def.$$is_range = true;

    self.$attr_reader("begin", "end");

    Opal.defn(self, '$initialize', function(first, last, exclude) {
      var $a, self = this;

      if (exclude == null) {
        exclude = false
      }
      if ((($a = first['$<=>'](last)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('ArgumentError'))
      }
      self.begin = first;
      self.end = last;
      return self.exclude = exclude;
    });

    Opal.defn(self, '$==', function(other) {
      var self = this;

      
      if (!other.$$is_range) {
        return false;
      }

      return self.exclude === other.exclude &&
             self.begin   ==  other.begin &&
             self.end     ==  other.end;
    
    });

    Opal.defn(self, '$===', function(value) {
      var self = this;

      return self['$include?'](value);
    });

    Opal.defn(self, '$cover?', function(value) {
      var $a, $b, self = this;

      return ($a = $rb_le(self.begin, value), $a !== false && $a !== nil ?((function() {if ((($b = self.exclude) !== nil && (!$b.$$is_boolean || $b == true))) {
        return $rb_lt(value, self.end)
        } else {
        return $rb_le(value, self.end)
      } return nil; })()) : $a);
    });

    Opal.defn(self, '$each', TMP_1 = function() {
      var $a, $b, $c, self = this, $iter = TMP_1.$$p, block = $iter || nil, current = nil, last = nil;

      TMP_1.$$p = null;
      if ((block !== nil)) {
        } else {
        return self.$enum_for("each")
      }
      
      var i, limit, value;

      if (self.begin.$$is_number && self.end.$$is_number) {
        if (self.begin % 1 !== 0 || self.end % 1 !== 0) {
          self.$raise($scope.get('TypeError'), "can't iterate from Float")
        }

        for (i = self.begin, limit = self.end + (function() {if ((($a = self.exclude) !== nil && (!$a.$$is_boolean || $a == true))) {
        return 0
        } else {
        return 1
      } return nil; })(); i < limit; i++) {
          value = block(i);
          if (value === $breaker) { return $breaker.$v; }
        }

        return self;
      }

      if (self.begin.$$is_string && self.end.$$is_string) {
        value = ($a = ($b = self.begin).$upto, $a.$$p = block.$to_proc(), $a).call($b, self.end, self.exclude);

        // The following is a bit hackish: we know that
        // String#upto normally returns self, but may
        // return a different value if there's a `break`
        // statement in the supplied block. We need to
        // propagate this `break` value here, so we
        // test for equality with `@begin` string to
        // determine the return value:
        return value === self.begin ? self : value;
      }

      current = self.begin;
      last = self.end;
      while ((($c = $rb_lt(current, last)) !== nil && (!$c.$$is_boolean || $c == true))) {
      if (Opal.yield1(block, current) === $breaker) return $breaker.$v;
      current = current.$succ();}
      if ((($a = ($c = self.exclude['$!'](), $c !== false && $c !== nil ?current['$=='](last) : $c)) !== nil && (!$a.$$is_boolean || $a == true))) {
        if (Opal.yield1(block, current) === $breaker) return $breaker.$v}
      return self;
    });

    Opal.defn(self, '$eql?', function(other) {
      var $a, $b, self = this;

      if ((($a = $scope.get('Range')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        return false
      }
      return ($a = ($b = self.exclude['$==='](other['$exclude_end?']()), $b !== false && $b !== nil ?self.begin['$eql?'](other.$begin()) : $b), $a !== false && $a !== nil ?self.end['$eql?'](other.$end()) : $a);
    });

    Opal.defn(self, '$exclude_end?', function() {
      var self = this;

      return self.exclude;
    });

    Opal.alias(self, 'first', 'begin');

    Opal.alias(self, 'include?', 'cover?');

    Opal.alias(self, 'last', 'end');

    Opal.defn(self, '$max', TMP_2 = function() {
      var self = this, $iter = TMP_2.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

      TMP_2.$$p = null;
      $zuper = [];
      for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
        $zuper[$zuper_index] = arguments[$zuper_index];
      }
      if (($yield !== nil)) {
        return Opal.find_super_dispatcher(self, 'max', TMP_2, $iter).apply(self, $zuper)
        } else {
        return self.exclude ? self.end - 1 : self.end;
      }
    });

    Opal.alias(self, 'member?', 'cover?');

    Opal.defn(self, '$min', TMP_3 = function() {
      var self = this, $iter = TMP_3.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

      TMP_3.$$p = null;
      $zuper = [];
      for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
        $zuper[$zuper_index] = arguments[$zuper_index];
      }
      if (($yield !== nil)) {
        return Opal.find_super_dispatcher(self, 'min', TMP_3, $iter).apply(self, $zuper)
        } else {
        return self.begin
      }
    });

    Opal.alias(self, 'member?', 'include?');

    Opal.defn(self, '$size', function() {
      var $a, $b, self = this, _begin = nil, _end = nil, infinity = nil;

      _begin = self.begin;
      _end = self.end;
      if ((($a = self.exclude) !== nil && (!$a.$$is_boolean || $a == true))) {
        _end = $rb_minus(_end, 1)}
      if ((($a = ($b = $scope.get('Numeric')['$==='](_begin), $b !== false && $b !== nil ?$scope.get('Numeric')['$==='](_end) : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        return nil
      }
      if ((($a = $rb_lt(_end, _begin)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return 0}
      infinity = (($scope.get('Float')).$$scope.get('INFINITY'));
      if ((($a = ((($b = infinity['$=='](_begin.$abs())) !== false && $b !== nil) ? $b : _end.$abs()['$=='](infinity))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return infinity}
      return ((Math.abs(_end - _begin) + 1)).$to_i();
    });

    Opal.defn(self, '$step', function(n) {
      var self = this;

      if (n == null) {
        n = 1
      }
      return self.$raise($scope.get('NotImplementedError'));
    });

    Opal.defn(self, '$to_s', function() {
      var self = this;

      return self.begin.$inspect() + (self.exclude ? '...' : '..') + self.end.$inspect();
    });

    return Opal.alias(self, 'inspect', 'to_s');
  })($scope.base, null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/proc"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$raise', '$coerce_to!']);
  return (function($base, $super) {
    function $Proc(){}
    var self = $Proc = $klass($base, $super, 'Proc', $Proc);

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2;

    def.$$is_proc = true;

    def.$$is_lambda = false;

    Opal.defs(self, '$new', TMP_1 = function() {
      var self = this, $iter = TMP_1.$$p, block = $iter || nil;

      TMP_1.$$p = null;
      if (block !== false && block !== nil) {
        } else {
        self.$raise($scope.get('ArgumentError'), "tried to create a Proc object without a block")
      }
      return block;
    });

    Opal.defn(self, '$call', TMP_2 = function() {
      var self = this, $iter = TMP_2.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_2.$$p = null;
      
      if (block !== nil) {
        self.$$p = block;
      }

      var result;

      if (self.$$is_lambda) {
        result = self.apply(null, args);
      }
      else {
        result = Opal.yieldX(self, args);
      }

      if (result === $breaker) {
        return $breaker.$v;
      }

      return result;
    
    });

    Opal.alias(self, '[]', 'call');

    Opal.alias(self, '===', 'call');

    Opal.alias(self, 'yield', 'call');

    Opal.defn(self, '$to_proc', function() {
      var self = this;

      return self;
    });

    Opal.defn(self, '$lambda?', function() {
      var self = this;

      return !!self.$$is_lambda;
    });

    Opal.defn(self, '$arity', function() {
      var self = this;

      if (self.$$is_curried) { return -1; }
      if (self.$$arity) { return self.$$arity }
      return self.length;
    });

    Opal.defn(self, '$source_location', function() {
      var self = this;

      if (self.$$is_curried) { return nil; }
      return nil;
    });

    Opal.defn(self, '$binding', function() {
      var self = this;

      if (self.$$is_curried) { self.$raise($scope.get('ArgumentError'), "Can't create Binding") }
      return nil;
    });

    Opal.defn(self, '$parameters', function() {
      var self = this;

      if (self.$$is_curried) { return [["rest"]]; }
      return nil;
    });

    Opal.defn(self, '$curry', function(arity) {
      var self = this;

      
      if (arity === undefined) {
        arity = self.length;
      }
      else {
        arity = $scope.get('Opal')['$coerce_to!'](arity, $scope.get('Integer'), "to_int");
        if (self.$$is_lambda && arity !== self.length) {
          self.$raise($scope.get('ArgumentError'), "wrong number of arguments (" + (arity) + " for " + (self.length) + ")")
        }
      }

      function curried () {
        var args = $slice.call(arguments),
            length = args.length,
            result;

        if (length > arity && self.$$is_lambda && !self.$$is_curried) {
          self.$raise($scope.get('ArgumentError'), "wrong number of arguments (" + (length) + " for " + (arity) + ")")
        }

        if (length >= arity) {
          return self.$call.apply(self, args);
        }

        result = function () {
          return curried.apply(null,
            args.concat($slice.call(arguments)));
        }
        result.$$is_lambda = self.$$is_lambda;
        result.$$is_curried = true;

        return result;
      }

      curried.$$is_lambda = self.$$is_lambda;
      curried.$$is_curried = true;
      return curried;
    
    });

    Opal.defn(self, '$dup', function() {
      var self = this;

      
      var original_proc = self.$$original_proc || self,
          proc = function () {
            return original_proc.apply(this, arguments);
          };

      for (var prop in self) {
        if (self.hasOwnProperty(prop)) {
          proc[prop] = self[prop];
        }
      }

      return proc;
    
    });

    return Opal.alias(self, 'clone', 'dup');
  })($scope.base, Function)
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/method"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$attr_reader', '$class', '$arity', '$new', '$name']);
  (function($base, $super) {
    function $Method(){}
    var self = $Method = $klass($base, $super, 'Method', $Method);

    var def = self.$$proto, $scope = self.$$scope, TMP_1;

    def.method = def.receiver = def.owner = def.name = nil;
    self.$attr_reader("owner", "receiver", "name");

    Opal.defn(self, '$initialize', function(receiver, method, name) {
      var self = this;

      self.receiver = receiver;
      self.owner = receiver.$class();
      self.name = name;
      return self.method = method;
    });

    Opal.defn(self, '$arity', function() {
      var self = this;

      return self.method.$arity();
    });

    Opal.defn(self, '$call', TMP_1 = function() {
      var self = this, $iter = TMP_1.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_1.$$p = null;
      
      self.method.$$p = block;

      return self.method.apply(self.receiver, args);

    });

    Opal.alias(self, '[]', 'call');

    Opal.defn(self, '$unbind', function() {
      var self = this;

      return $scope.get('UnboundMethod').$new(self.owner, self.method, self.name);
    });

    Opal.defn(self, '$to_proc', function() {
      var self = this;

      
      var proc = function () { return self.$call.apply(self, $slice.call(arguments)); };
      proc.$$unbound = self.method;
      proc.$$is_lambda = true;
      return proc;
    
    });

    return (Opal.defn(self, '$inspect', function() {
      var self = this;

      return "#<Method: " + (self.receiver.$class()) + "#" + (self.name) + ">";
    }), nil) && 'inspect';
  })($scope.base, null);
  return (function($base, $super) {
    function $UnboundMethod(){}
    var self = $UnboundMethod = $klass($base, $super, 'UnboundMethod', $UnboundMethod);

    var def = self.$$proto, $scope = self.$$scope;

    def.method = def.name = def.owner = nil;
    self.$attr_reader("owner", "name");

    Opal.defn(self, '$initialize', function(owner, method, name) {
      var self = this;

      self.owner = owner;
      self.method = method;
      return self.name = name;
    });

    Opal.defn(self, '$arity', function() {
      var self = this;

      return self.method.$arity();
    });

    Opal.defn(self, '$bind', function(object) {
      var self = this;

      return $scope.get('Method').$new(object, self.method, self.name);
    });

    return (Opal.defn(self, '$inspect', function() {
      var self = this;

      return "#<UnboundMethod: " + (self.owner.$name()) + "#" + (self.name) + ">";
    }), nil) && 'inspect';
  })($scope.base, null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/variables"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $gvars = Opal.gvars, $hash2 = Opal.hash2;

  Opal.add_stubs(['$new']);
  $gvars["&"] = $gvars["~"] = $gvars["`"] = $gvars["'"] = nil;
  $gvars.LOADED_FEATURES = $gvars["\""] = Opal.loaded_features;
  $gvars.LOAD_PATH = $gvars[":"] = [];
  $gvars["/"] = "\n";
  $gvars[","] = nil;
  Opal.cdecl($scope, 'ARGV', []);
  Opal.cdecl($scope, 'ARGF', $scope.get('Object').$new());
  Opal.cdecl($scope, 'ENV', $hash2([], {}));
  $gvars.VERBOSE = false;
  $gvars.DEBUG = false;
  return $gvars.SAFE = 0;
};

/* Generated by Opal 0.9.2 */
Opal.modules["opal/mini"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice;

  Opal.add_stubs(['$require']);
  self.$require("opal/base");
  self.$require("corelib/nil");
  self.$require("corelib/boolean");
  self.$require("corelib/string");
  self.$require("corelib/comparable");
  self.$require("corelib/enumerable");
  self.$require("corelib/enumerator");
  self.$require("corelib/array");
  self.$require("corelib/hash");
  self.$require("corelib/number");
  self.$require("corelib/range");
  self.$require("corelib/proc");
  self.$require("corelib/method");
  self.$require("corelib/regexp");
  return self.$require("corelib/variables");
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/array/inheritance"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_times(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs * rhs : lhs['$*'](rhs);
  }
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$new', '$allocate', '$initialize', '$to_proc', '$__send__', '$clone', '$respond_to?', '$==', '$eql?', '$inspect', '$hash', '$*', '$class', '$slice', '$uniq', '$flatten', '$-', '$+']);
  (function($base, $super) {
    function $Array(){}
    var self = $Array = $klass($base, $super, 'Array', $Array);

    var def = self.$$proto, $scope = self.$$scope;

    return (Opal.defs(self, '$inherited', function(klass) {
      var self = this, replace = nil;

      replace = $scope.get('Class').$new((($scope.get('Array')).$$scope.get('Wrapper')));
      
      klass.$$proto         = replace.$$proto;
      klass.$$proto.$$class = klass;
      klass.$$alloc         = replace.$$alloc;
      klass.$$parent        = (($scope.get('Array')).$$scope.get('Wrapper'));

      klass.$allocate = replace.$allocate;
      klass.$new      = replace.$new;
      klass["$[]"]    = replace["$[]"];
    
    }), nil) && 'inherited'
  })($scope.base, null);
  return (function($base, $super) {
    function $Wrapper(){}
    var self = $Wrapper = $klass($base, $super, 'Wrapper', $Wrapper);

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5;

    def.literal = nil;
    def.$$is_array = true;

    Opal.defs(self, '$allocate', TMP_1 = function(array) {
      var self = this, $iter = TMP_1.$$p, $yield = $iter || nil, obj = nil;

      if (array == null) {
        array = []
      }
      TMP_1.$$p = null;
      obj = Opal.find_super_dispatcher(self, 'allocate', TMP_1, null, $Wrapper).apply(self, []);
      obj.literal = array;
      return obj;
    });

    Opal.defs(self, '$new', TMP_2 = function() {
      var $a, $b, self = this, $iter = TMP_2.$$p, block = $iter || nil, obj = nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_2.$$p = null;
      obj = self.$allocate();
      ($a = ($b = obj).$initialize, $a.$$p = block.$to_proc(), $a).apply($b, Opal.to_a(args));
      return obj;
    });

    Opal.defs(self, '$[]', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var objects = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        objects[$splat_index] = arguments[$splat_index + 0];
      }
      return self.$allocate(objects);
    });

    Opal.defn(self, '$initialize', TMP_3 = function() {
      var $a, $b, self = this, $iter = TMP_3.$$p, block = $iter || nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_3.$$p = null;
      return self.literal = ($a = ($b = $scope.get('Array')).$new, $a.$$p = block.$to_proc(), $a).apply($b, Opal.to_a(args));
    });

    Opal.defn(self, '$method_missing', TMP_4 = function() {
      var $a, $b, self = this, $iter = TMP_4.$$p, block = $iter || nil, result = nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_4.$$p = null;
      result = ($a = ($b = self.literal).$__send__, $a.$$p = block.$to_proc(), $a).apply($b, Opal.to_a(args));
      if ((($a = result === self.literal) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self
        } else {
        return result
      }
    });

    Opal.defn(self, '$initialize_copy', function(other) {
      var self = this;

      return self.literal = (other.literal).$clone();
    });

    Opal.defn(self, '$respond_to?', TMP_5 = function(name) {
      var $a, self = this, $iter = TMP_5.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

      TMP_5.$$p = null;
      $zuper = [];
      for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
        $zuper[$zuper_index] = arguments[$zuper_index];
      }
      return ((($a = Opal.find_super_dispatcher(self, 'respond_to?', TMP_5, $iter).apply(self, $zuper)) !== false && $a !== nil) ? $a : self.literal['$respond_to?'](name));
    });

    Opal.defn(self, '$==', function(other) {
      var self = this;

      return self.literal['$=='](other);
    });

    Opal.defn(self, '$eql?', function(other) {
      var self = this;

      return self.literal['$eql?'](other);
    });

    Opal.defn(self, '$to_a', function() {
      var self = this;

      return self.literal;
    });

    Opal.defn(self, '$to_ary', function() {
      var self = this;

      return self;
    });

    Opal.defn(self, '$inspect', function() {
      var self = this;

      return self.literal.$inspect();
    });

    Opal.defn(self, '$hash', function() {
      var self = this;

      return self.literal.$hash();
    });

    Opal.defn(self, '$*', function(other) {
      var self = this;

      
      var result = $rb_times(self.literal, other);

      if (result.$$is_array) {
        return self.$class().$allocate(result)
      }
      else {
        return result;
      }

    });

    Opal.defn(self, '$[]', function(index, length) {
      var self = this;

      
      var result = self.literal.$slice(index, length);

      if (result.$$is_array && (index.$$is_range || length !== undefined)) {
        return self.$class().$allocate(result)
      }
      else {
        return result;
      }

    });

    Opal.alias(self, 'slice', '[]');

    Opal.defn(self, '$uniq', function() {
      var self = this;

      return self.$class().$allocate(self.literal.$uniq());
    });

    Opal.defn(self, '$flatten', function(level) {
      var self = this;

      return self.$class().$allocate(self.literal.$flatten(level));
    });

    Opal.defn(self, '$-', function(other) {
      var self = this;

      return $rb_minus(self.literal, other);
    });

    return (Opal.defn(self, '$+', function(other) {
      var self = this;

      return $rb_plus(self.literal, other);
    }), nil) && '+';
  })($scope.get('Array'), null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/string/inheritance"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  function $rb_times(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs * rhs : lhs['$*'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $gvars = Opal.gvars;

  Opal.add_stubs(['$require', '$new', '$allocate', '$initialize', '$to_proc', '$__send__', '$class', '$clone', '$respond_to?', '$==', '$inspect', '$+', '$*', '$map', '$split', '$enum_for', '$each_line', '$to_a', '$%']);
  self.$require("corelib/string");
  (function($base, $super) {
    function $String(){}
    var self = $String = $klass($base, $super, 'String', $String);

    var def = self.$$proto, $scope = self.$$scope;

    return (Opal.defs(self, '$inherited', function(klass) {
      var self = this, replace = nil;

      replace = $scope.get('Class').$new((($scope.get('String')).$$scope.get('Wrapper')));
      
      klass.$$proto         = replace.$$proto;
      klass.$$proto.$$class = klass;
      klass.$$alloc         = replace.$$alloc;
      klass.$$parent        = (($scope.get('String')).$$scope.get('Wrapper'));

      klass.$allocate = replace.$allocate;
      klass.$new      = replace.$new;
    
    }), nil) && 'inherited'
  })($scope.base, null);
  return (function($base, $super) {
    function $Wrapper(){}
    var self = $Wrapper = $klass($base, $super, 'Wrapper', $Wrapper);

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_6, TMP_8;

    def.literal = nil;
    def.$$is_string = true;

    Opal.defs(self, '$allocate', TMP_1 = function(string) {
      var self = this, $iter = TMP_1.$$p, $yield = $iter || nil, obj = nil;

      if (string == null) {
        string = ""
      }
      TMP_1.$$p = null;
      obj = Opal.find_super_dispatcher(self, 'allocate', TMP_1, null, $Wrapper).apply(self, []);
      obj.literal = string;
      return obj;
    });

    Opal.defs(self, '$new', TMP_2 = function() {
      var $a, $b, self = this, $iter = TMP_2.$$p, block = $iter || nil, obj = nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_2.$$p = null;
      obj = self.$allocate();
      ($a = ($b = obj).$initialize, $a.$$p = block.$to_proc(), $a).apply($b, Opal.to_a(args));
      return obj;
    });

    Opal.defs(self, '$[]', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var objects = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        objects[$splat_index] = arguments[$splat_index + 0];
      }
      return self.$allocate(objects);
    });

    Opal.defn(self, '$initialize', function(string) {
      var self = this;

      if (string == null) {
        string = ""
      }
      return self.literal = string;
    });

    Opal.defn(self, '$method_missing', TMP_3 = function() {
      var $a, $b, self = this, $iter = TMP_3.$$p, block = $iter || nil, result = nil, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      TMP_3.$$p = null;
      result = ($a = ($b = self.literal).$__send__, $a.$$p = block.$to_proc(), $a).apply($b, Opal.to_a(args));
      if ((($a = result.$$is_string != null) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = result == self.literal) !== nil && (!$a.$$is_boolean || $a == true))) {
          return self
          } else {
          return self.$class().$allocate(result)
        }
        } else {
        return result
      }
    });

    Opal.defn(self, '$initialize_copy', function(other) {
      var self = this;

      return self.literal = (other.literal).$clone();
    });

    Opal.defn(self, '$respond_to?', TMP_4 = function(name) {
      var $a, self = this, $iter = TMP_4.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

      TMP_4.$$p = null;
      $zuper = [];
      for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
        $zuper[$zuper_index] = arguments[$zuper_index];
      }
      return ((($a = Opal.find_super_dispatcher(self, 'respond_to?', TMP_4, $iter).apply(self, $zuper)) !== false && $a !== nil) ? $a : self.literal['$respond_to?'](name));
    });

    Opal.defn(self, '$==', function(other) {
      var self = this;

      return self.literal['$=='](other);
    });

    Opal.alias(self, 'eql?', '==');

    Opal.alias(self, '===', '==');

    Opal.defn(self, '$to_s', function() {
      var self = this;

      return self.literal;
    });

    Opal.alias(self, 'to_str', 'to_s');

    Opal.defn(self, '$inspect', function() {
      var self = this;

      return self.literal.$inspect();
    });

    Opal.defn(self, '$+', function(other) {
      var self = this;

      return $rb_plus(self.literal, other);
    });

    Opal.defn(self, '$*', function(other) {
      var self = this;

      
      var result = $rb_times(self.literal, other);

      if (result.$$is_string) {
        return self.$class().$allocate(result)
      }
      else {
        return result;
      }

    });

    Opal.defn(self, '$split', function(pattern, limit) {
      var $a, $b, TMP_5, self = this;

      return ($a = ($b = self.literal.$split(pattern, limit)).$map, $a.$$p = (TMP_5 = function(str){var self = TMP_5.$$s || this;
if (str == null) str = nil;
      return self.$class().$allocate(str)}, TMP_5.$$s = self, TMP_5), $a).call($b);
    });

    Opal.defn(self, '$replace', function(string) {
      var self = this;

      return self.literal = string;
    });

    Opal.defn(self, '$each_line', TMP_6 = function(separator) {
      var $a, $b, TMP_7, self = this, $iter = TMP_6.$$p, $yield = $iter || nil;
      if ($gvars["/"] == null) $gvars["/"] = nil;

      if (separator == null) {
        separator = $gvars["/"]
      }
      TMP_6.$$p = null;
      if (($yield !== nil)) {
        } else {
        return self.$enum_for("each_line", separator)
      }
      return ($a = ($b = self.literal).$each_line, $a.$$p = (TMP_7 = function(str){var self = TMP_7.$$s || this, $a;
if (str == null) str = nil;
      return $a = Opal.yield1($yield, self.$class().$allocate(str)), $a === $breaker ? $a : $a}, TMP_7.$$s = self, TMP_7), $a).call($b, separator);
    });

    Opal.defn(self, '$lines', TMP_8 = function(separator) {
      var $a, $b, self = this, $iter = TMP_8.$$p, block = $iter || nil, e = nil;
      if ($gvars["/"] == null) $gvars["/"] = nil;

      if (separator == null) {
        separator = $gvars["/"]
      }
      TMP_8.$$p = null;
      e = ($a = ($b = self).$each_line, $a.$$p = block.$to_proc(), $a).call($b, separator);
      if (block !== false && block !== nil) {
        return self
        } else {
        return e.$to_a()
      }
    });

    return (Opal.defn(self, '$%', function(data) {
      var self = this;

      return self.literal['$%'](data);
    }), nil) && '%';
  })($scope.get('String'), null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/string/encoding"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  var $a, $b, TMP_4, $c, TMP_6, $d, TMP_8, self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $hash2 = Opal.hash2;

  Opal.add_stubs(['$require', '$+', '$[]', '$new', '$to_proc', '$each', '$const_set', '$sub', '$upcase', '$const_get', '$===', '$==', '$name', '$include?', '$names', '$constants', '$raise', '$attr_accessor', '$attr_reader', '$register', '$length', '$bytes', '$to_a', '$each_byte', '$bytesize', '$enum_for', '$force_encoding', '$dup', '$coerce_to!', '$find', '$nil?', '$getbyte']);
  self.$require("corelib/string");
  (function($base, $super) {
    function $Encoding(){}
    var self = $Encoding = $klass($base, $super, 'Encoding', $Encoding);

    var def = self.$$proto, $scope = self.$$scope, TMP_1;

    def.ascii = def.dummy = def.name = nil;
    Opal.defs(self, '$register', TMP_1 = function(name, options) {
      var $a, $b, $c, TMP_2, self = this, $iter = TMP_1.$$p, block = $iter || nil, names = nil, encoding = nil;

      if (options == null) {
        options = $hash2([], {})
      }
      TMP_1.$$p = null;
      names = $rb_plus([name], (((($a = options['$[]']("aliases")) !== false && $a !== nil) ? $a : [])));
      encoding = ($a = ($b = $scope.get('Class')).$new, $a.$$p = block.$to_proc(), $a).call($b, self).$new(name, names, ((($a = options['$[]']("ascii")) !== false && $a !== nil) ? $a : false), ((($a = options['$[]']("dummy")) !== false && $a !== nil) ? $a : false));
      return ($a = ($c = names).$each, $a.$$p = (TMP_2 = function(name){var self = TMP_2.$$s || this;
if (name == null) name = nil;
      return self.$const_set(name.$sub("-", "_"), encoding)}, TMP_2.$$s = self, TMP_2), $a).call($c);
    });

    Opal.defs(self, '$find', function(name) {try {

      var $a, $b, TMP_3, self = this, upcase = nil;

      upcase = name.$upcase();
      ($a = ($b = self.$constants()).$each, $a.$$p = (TMP_3 = function(const$){var self = TMP_3.$$s || this, $a, $b, encoding = nil;
if (const$ == null) const$ = nil;
      encoding = self.$const_get(const$);
        if ((($a = $scope.get('Encoding')['$==='](encoding)) !== nil && (!$a.$$is_boolean || $a == true))) {
          } else {
          return nil;
        }
        if ((($a = ((($b = encoding.$name()['$=='](upcase)) !== false && $b !== nil) ? $b : encoding.$names()['$include?'](upcase))) !== nil && (!$a.$$is_boolean || $a == true))) {
          Opal.ret(encoding)
          } else {
          return nil
        }}, TMP_3.$$s = self, TMP_3), $a).call($b);
      return self.$raise($scope.get('ArgumentError'), "unknown encoding name - " + (name));
      } catch ($returner) { if ($returner === Opal.returner) { return $returner.$v } throw $returner; }
    });

    (function(self) {
      var $scope = self.$$scope, def = self.$$proto;

      return self.$attr_accessor("default_external")
    })(Opal.get_singleton_class(self));

    self.$attr_reader("name", "names");

    Opal.defn(self, '$initialize', function(name, names, ascii, dummy) {
      var self = this;

      self.name = name;
      self.names = names;
      self.ascii = ascii;
      return self.dummy = dummy;
    });

    Opal.defn(self, '$ascii_compatible?', function() {
      var self = this;

      return self.ascii;
    });

    Opal.defn(self, '$dummy?', function() {
      var self = this;

      return self.dummy;
    });

    Opal.defn(self, '$to_s', function() {
      var self = this;

      return self.name;
    });

    Opal.defn(self, '$inspect', function() {
      var $a, self = this;

      return "#<Encoding:" + (self.name) + ((function() {if ((($a = self.dummy) !== nil && (!$a.$$is_boolean || $a == true))) {
        return " (dummy)"
        } else {
        return nil
      } return nil; })()) + ">";
    });

    Opal.defn(self, '$each_byte', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'));
    });

    Opal.defn(self, '$getbyte', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'));
    });

    Opal.defn(self, '$bytesize', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'));
    });

    (function($base, $super) {
      function $EncodingError(){}
      var self = $EncodingError = $klass($base, $super, 'EncodingError', $EncodingError);

      var def = self.$$proto, $scope = self.$$scope;

      return nil;
    })($scope.base, $scope.get('StandardError'));

    return (function($base, $super) {
      function $CompatibilityError(){}
      var self = $CompatibilityError = $klass($base, $super, 'CompatibilityError', $CompatibilityError);

      var def = self.$$proto, $scope = self.$$scope;

      return nil;
    })($scope.base, $scope.get('EncodingError'));
  })($scope.base, null);
  ($a = ($b = $scope.get('Encoding')).$register, $a.$$p = (TMP_4 = function(){var self = TMP_4.$$s || this, TMP_5;

  Opal.def(self, '$each_byte', TMP_5 = function(string) {
      var $a, self = this, $iter = TMP_5.$$p, block = $iter || nil;

      TMP_5.$$p = null;
      
      for (var i = 0, length = string.length; i < length; i++) {
        var code = string.charCodeAt(i);

        if (code <= 0x7f) {
          ((($a = Opal.yield1(block, code)) === $breaker) ? $breaker.$v : $a);
        }
        else {
          var encoded = encodeURIComponent(string.charAt(i)).substr(1).split('%');

          for (var j = 0, encoded_length = encoded.length; j < encoded_length; j++) {
            ((($a = Opal.yield1(block, parseInt(encoded[j], 16))) === $breaker) ? $breaker.$v : $a);
          }
        }
      }
    
    });
    return (Opal.def(self, '$bytesize', function() {
      var self = this;

      return self.$bytes().$length();
    }), nil) && 'bytesize';}, TMP_4.$$s = self, TMP_4), $a).call($b, "UTF-8", $hash2(["aliases", "ascii"], {"aliases": ["CP65001"], "ascii": true}));
  ($a = ($c = $scope.get('Encoding')).$register, $a.$$p = (TMP_6 = function(){var self = TMP_6.$$s || this, TMP_7;

  Opal.def(self, '$each_byte', TMP_7 = function(string) {
      var $a, self = this, $iter = TMP_7.$$p, block = $iter || nil;

      TMP_7.$$p = null;
      
      for (var i = 0, length = string.length; i < length; i++) {
        var code = string.charCodeAt(i);

        ((($a = Opal.yield1(block, code & 0xff)) === $breaker) ? $breaker.$v : $a);
        ((($a = Opal.yield1(block, code >> 8)) === $breaker) ? $breaker.$v : $a);
      }
    
    });
    return (Opal.def(self, '$bytesize', function() {
      var self = this;

      return self.$bytes().$length();
    }), nil) && 'bytesize';}, TMP_6.$$s = self, TMP_6), $a).call($c, "UTF-16LE");
  ($a = ($d = $scope.get('Encoding')).$register, $a.$$p = (TMP_8 = function(){var self = TMP_8.$$s || this, TMP_9;

  Opal.def(self, '$each_byte', TMP_9 = function(string) {
      var $a, self = this, $iter = TMP_9.$$p, block = $iter || nil;

      TMP_9.$$p = null;
      
      for (var i = 0, length = string.length; i < length; i++) {
        ((($a = Opal.yield1(block, string.charCodeAt(i) & 0xff)) === $breaker) ? $breaker.$v : $a);
      }
    
    });
    return (Opal.def(self, '$bytesize', function() {
      var self = this;

      return self.$bytes().$length();
    }), nil) && 'bytesize';}, TMP_8.$$s = self, TMP_8), $a).call($d, "ASCII-8BIT", $hash2(["aliases", "ascii"], {"aliases": ["BINARY"], "ascii": true}));
  return (function($base, $super) {
    function $String(){}
    var self = $String = $klass($base, $super, 'String', $String);

    var def = self.$$proto, $scope = self.$$scope, TMP_10;

    def.encoding = nil;
    String.prototype.encoding = (($scope.get('Encoding')).$$scope.get('UTF_16LE'));

    Opal.defn(self, '$bytes', function() {
      var self = this;

      return self.$each_byte().$to_a();
    });

    Opal.defn(self, '$bytesize', function() {
      var self = this;

      return self.encoding.$bytesize(self);
    });

    Opal.defn(self, '$each_byte', TMP_10 = function() {
      var $a, $b, self = this, $iter = TMP_10.$$p, block = $iter || nil;

      TMP_10.$$p = null;
      if ((block !== nil)) {
        } else {
        return self.$enum_for("each_byte")
      }
      ($a = ($b = self.encoding).$each_byte, $a.$$p = block.$to_proc(), $a).call($b, self);
      return self;
    });

    Opal.defn(self, '$encode', function(encoding) {
      var self = this;

      return self.$dup().$force_encoding(encoding);
    });

    Opal.defn(self, '$encoding', function() {
      var self = this;

      return self.encoding;
    });

    Opal.defn(self, '$force_encoding', function(encoding) {
      var $a, self = this;

      encoding = $scope.get('Opal')['$coerce_to!'](encoding, $scope.get('String'), "to_str");
      encoding = $scope.get('Encoding').$find(encoding);
      if (encoding['$=='](self.encoding)) {
        return self}
      if ((($a = encoding['$nil?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('ArgumentError'), "unknown encoding name - " + (encoding))}
      
      var result = String(self);
      result.encoding = encoding;

      return result;
    
    });

    return (Opal.defn(self, '$getbyte', function(idx) {
      var self = this;

      return self.encoding.$getbyte(self, idx);
    }), nil) && 'getbyte';
  })($scope.base, null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/math"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module;

  Opal.add_stubs(['$new', '$raise', '$Float', '$type_error', '$Integer', '$module_function', '$checked', '$float!', '$===', '$gamma', '$-', '$integer!', '$/', '$infinite?']);
  return (function($base) {
    var $Math, self = $Math = $module($base, 'Math');

    var def = self.$$proto, $scope = self.$$scope, $a;

    Opal.cdecl($scope, 'E', Math.E);

    Opal.cdecl($scope, 'PI', Math.PI);

    Opal.cdecl($scope, 'DomainError', $scope.get('Class').$new($scope.get('StandardError')));

    Opal.defs(self, '$checked', function(method) {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 1;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 1];
      }
      
      if (isNaN(args[0]) || (args.length == 2 && isNaN(args[1]))) {
        return NaN;
      }

      var result = Math[method].apply(null, args);

      if (isNaN(result)) {
        self.$raise($scope.get('DomainError'), "Numerical argument is out of domain - \"" + (method) + "\"");
      }

      return result;
    
    });

    Opal.defs(self, '$float!', function(value) {
      var self = this;

      try {
      return self.$Float(value)
      } catch ($err) {if (Opal.rescue($err, [$scope.get('ArgumentError')])) {
        try {
          return self.$raise($scope.get('Opal').$type_error(value, $scope.get('Float')))
        } finally {
          Opal.gvars["!"] = Opal.exceptions.pop() || Opal.nil;
        }
        }else { throw $err; }
      }
    });

    Opal.defs(self, '$integer!', function(value) {
      var self = this;

      try {
      return self.$Integer(value)
      } catch ($err) {if (Opal.rescue($err, [$scope.get('ArgumentError')])) {
        try {
          return self.$raise($scope.get('Opal').$type_error(value, $scope.get('Integer')))
        } finally {
          Opal.gvars["!"] = Opal.exceptions.pop() || Opal.nil;
        }
        }else { throw $err; }
      }
    });

    self.$module_function();

    Opal.defn(self, '$acos', function(x) {
      var self = this;

      return $scope.get('Math').$checked("acos", $scope.get('Math')['$float!'](x));
    });

    if ((($a = (typeof(Math.acosh) !== "undefined")) !== nil && (!$a.$$is_boolean || $a == true))) {
      } else {
      
      Math.acosh = function(x) {
        return Math.log(x + Math.sqrt(x * x - 1));
      }
    
    }

    Opal.defn(self, '$acosh', function(x) {
      var self = this;

      return $scope.get('Math').$checked("acosh", $scope.get('Math')['$float!'](x));
    });

    Opal.defn(self, '$asin', function(x) {
      var self = this;

      return $scope.get('Math').$checked("asin", $scope.get('Math')['$float!'](x));
    });

    if ((($a = (typeof(Math.asinh) !== "undefined")) !== nil && (!$a.$$is_boolean || $a == true))) {
      } else {
      
      Math.asinh = function(x) {
        return Math.log(x + Math.sqrt(x * x + 1))
      }
    ;
    }

    Opal.defn(self, '$asinh', function(x) {
      var self = this;

      return $scope.get('Math').$checked("asinh", $scope.get('Math')['$float!'](x));
    });

    Opal.defn(self, '$atan', function(x) {
      var self = this;

      return $scope.get('Math').$checked("atan", $scope.get('Math')['$float!'](x));
    });

    Opal.defn(self, '$atan2', function(y, x) {
      var self = this;

      return $scope.get('Math').$checked("atan2", $scope.get('Math')['$float!'](y), $scope.get('Math')['$float!'](x));
    });

    if ((($a = (typeof(Math.atanh) !== "undefined")) !== nil && (!$a.$$is_boolean || $a == true))) {
      } else {
      
      Math.atanh = function(x) {
        return 0.5 * Math.log((1 + x) / (1 - x));
      }
    
    }

    Opal.defn(self, '$atanh', function(x) {
      var self = this;

      return $scope.get('Math').$checked("atanh", $scope.get('Math')['$float!'](x));
    });

    if ((($a = (typeof(Math.cbrt) !== "undefined")) !== nil && (!$a.$$is_boolean || $a == true))) {
      } else {
      
      Math.cbrt = function(x) {
        if (x == 0) {
          return 0;
        }

        if (x < 0) {
          return -Math.cbrt(-x);
        }

        var r  = x,
            ex = 0;

        while (r < 0.125) {
          r *= 8;
          ex--;
        }

        while (r > 1.0) {
          r *= 0.125;
          ex++;
        }

        r = (-0.46946116 * r + 1.072302) * r + 0.3812513;

        while (ex < 0) {
          r *= 0.5;
          ex++;
        }

        while (ex > 0) {
          r *= 2;
          ex--;
        }

        r = (2.0 / 3.0) * r + (1.0 / 3.0) * x / (r * r);
        r = (2.0 / 3.0) * r + (1.0 / 3.0) * x / (r * r);
        r = (2.0 / 3.0) * r + (1.0 / 3.0) * x / (r * r);
        r = (2.0 / 3.0) * r + (1.0 / 3.0) * x / (r * r);

        return r;
      }
    
    }

    Opal.defn(self, '$cbrt', function(x) {
      var self = this;

      return $scope.get('Math').$checked("cbrt", $scope.get('Math')['$float!'](x));
    });

    Opal.defn(self, '$cos', function(x) {
      var self = this;

      return $scope.get('Math').$checked("cos", $scope.get('Math')['$float!'](x));
    });

    if ((($a = (typeof(Math.cosh) !== "undefined")) !== nil && (!$a.$$is_boolean || $a == true))) {
      } else {
      
      Math.cosh = function(x) {
        return (Math.exp(x) + Math.exp(-x)) / 2;
      }
    
    }

    Opal.defn(self, '$cosh', function(x) {
      var self = this;

      return $scope.get('Math').$checked("cosh", $scope.get('Math')['$float!'](x));
    });

    if ((($a = (typeof(Math.erf) !== "undefined")) !== nil && (!$a.$$is_boolean || $a == true))) {
      } else {
      
      Math.erf = function(x) {
        var A1 =  0.254829592,
            A2 = -0.284496736,
            A3 =  1.421413741,
            A4 = -1.453152027,
            A5 =  1.061405429,
            P  =  0.3275911;

        var sign = 1;

        if (x < 0) {
            sign = -1;
        }

        x = Math.abs(x);

        var t = 1.0 / (1.0 + P * x);
        var y = 1.0 - (((((A5 * t + A4) * t) + A3) * t + A2) * t + A1) * t * Math.exp(-x * x);

        return sign * y;
      }
    
    }

    Opal.defn(self, '$erf', function(x) {
      var self = this;

      return $scope.get('Math').$checked("erf", $scope.get('Math')['$float!'](x));
    });

    if ((($a = (typeof(Math.erfc) !== "undefined")) !== nil && (!$a.$$is_boolean || $a == true))) {
      } else {
      
      Math.erfc = function(x) {
        var z = Math.abs(x),
            t = 1.0 / (0.5 * z + 1.0);

        var A1 = t * 0.17087277 + -0.82215223,
            A2 = t * A1 + 1.48851587,
            A3 = t * A2 + -1.13520398,
            A4 = t * A3 + 0.27886807,
            A5 = t * A4 + -0.18628806,
            A6 = t * A5 + 0.09678418,
            A7 = t * A6 + 0.37409196,
            A8 = t * A7 + 1.00002368,
            A9 = t * A8,
            A10 = -z * z - 1.26551223 + A9;

        var a = t * Math.exp(A10);

        if (x < 0.0) {
          return 2.0 - a;
        }
        else {
          return a;
        }
      }
    
    }

    Opal.defn(self, '$erfc', function(x) {
      var self = this;

      return $scope.get('Math').$checked("erfc", $scope.get('Math')['$float!'](x));
    });

    Opal.defn(self, '$exp', function(x) {
      var self = this;

      return $scope.get('Math').$checked("exp", $scope.get('Math')['$float!'](x));
    });

    Opal.defn(self, '$frexp', function(x) {
      var self = this;

      x = $scope.get('Math')['$float!'](x);
      
      if (isNaN(x)) {
        return [NaN, 0];
      }

      var ex   = Math.floor(Math.log(Math.abs(x)) / Math.log(2)) + 1,
          frac = x / Math.pow(2, ex);

      return [frac, ex];
    
    });

    Opal.defn(self, '$gamma', function(n) {
      var self = this;

      n = $scope.get('Math')['$float!'](n);
      
      var i, t, x, value, result, twoN, threeN, fourN, fiveN;

      var G = 4.7421875;

      var P = [
         0.99999999999999709182,
         57.156235665862923517,
        -59.597960355475491248,
         14.136097974741747174,
        -0.49191381609762019978,
         0.33994649984811888699e-4,
         0.46523628927048575665e-4,
        -0.98374475304879564677e-4,
         0.15808870322491248884e-3,
        -0.21026444172410488319e-3,
         0.21743961811521264320e-3,
        -0.16431810653676389022e-3,
         0.84418223983852743293e-4,
        -0.26190838401581408670e-4,
         0.36899182659531622704e-5
      ];


      if (isNaN(n)) {
        return NaN;
      }

      if (n === 0 && 1 / n < 0) {
        return -Infinity;
      }

      if (n === -1 || n === -Infinity) {
        self.$raise($scope.get('DomainError'), "Numerical argument is out of domain - \"gamma\"");
      }

      if ($scope.get('Integer')['$==='](n)) {
        if (n <= 0) {
          return isFinite(n) ? Infinity : NaN;
        }

        if (n > 171) {
          return Infinity;
        }

        value  = n - 2;
        result = n - 1;

        while (value > 1) {
          result *= value;
          value--;
        }

        if (result == 0) {
          result = 1;
        }

        return result;
      }

      if (n < 0.5) {
        return Math.PI / (Math.sin(Math.PI * n) * $scope.get('Math').$gamma($rb_minus(1, n)));
      }

      if (n >= 171.35) {
        return Infinity;
      }

      if (n > 85.0) {
        twoN   = n * n;
        threeN = twoN * n;
        fourN  = threeN * n;
        fiveN  = fourN * n;

        return Math.sqrt(2 * Math.PI / n) * Math.pow((n / Math.E), n) *
          (1 + 1 / (12 * n) + 1 / (288 * twoN) - 139 / (51840 * threeN) -
          571 / (2488320 * fourN) + 163879 / (209018880 * fiveN) +
          5246819 / (75246796800 * fiveN * n));
      }

      n -= 1;
      x  = P[0];

      for (i = 1; i < P.length; ++i) {
        x += P[i] / (n + i);
      }

      t = n + G + 0.5;

      return Math.sqrt(2 * Math.PI) * Math.pow(t, n + 0.5) * Math.exp(-t) * x;
    
    });

    if ((($a = (typeof(Math.hypot) !== "undefined")) !== nil && (!$a.$$is_boolean || $a == true))) {
      } else {
      
      Math.hypot = function(x, y) {
        return Math.sqrt(x * x + y * y)
      }
    ;
    }

    Opal.defn(self, '$hypot', function(x, y) {
      var self = this;

      return $scope.get('Math').$checked("hypot", $scope.get('Math')['$float!'](x), $scope.get('Math')['$float!'](y));
    });

    Opal.defn(self, '$ldexp', function(mantissa, exponent) {
      var self = this;

      mantissa = $scope.get('Math')['$float!'](mantissa);
      exponent = $scope.get('Math')['$integer!'](exponent);
      
      if (isNaN(exponent)) {
        self.$raise($scope.get('RangeError'), "float NaN out of range of integer");
      }

      return mantissa * Math.pow(2, exponent);

    });

    Opal.defn(self, '$lgamma', function(n) {
      var self = this;

      
      if (n == -1) {
        return [Infinity, 1];
      }
      else {
        return [Math.log(Math.abs($scope.get('Math').$gamma(n))), $scope.get('Math').$gamma(n) < 0 ? -1 : 1];
      }

    });

    Opal.defn(self, '$log', function(x, base) {
      var $a, self = this;

      if ((($a = $scope.get('String')['$==='](x)) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('Opal').$type_error(x, $scope.get('Float')))}
      if ((($a = base == null) !== nil && (!$a.$$is_boolean || $a == true))) {
        return $scope.get('Math').$checked("log", $scope.get('Math')['$float!'](x))
        } else {
        if ((($a = $scope.get('String')['$==='](base)) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('Opal').$type_error(base, $scope.get('Float')))}
        return $rb_divide($scope.get('Math').$checked("log", $scope.get('Math')['$float!'](x)), $scope.get('Math').$checked("log", $scope.get('Math')['$float!'](base)));
      }
    });

    if ((($a = (typeof(Math.log10) !== "undefined")) !== nil && (!$a.$$is_boolean || $a == true))) {
      } else {
      
      Math.log10 = function(x) {
        return Math.log(x) / Math.LN10;
      }
    
    }

    Opal.defn(self, '$log10', function(x) {
      var $a, self = this;

      if ((($a = $scope.get('String')['$==='](x)) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('Opal').$type_error(x, $scope.get('Float')))}
      return $scope.get('Math').$checked("log10", $scope.get('Math')['$float!'](x));
    });

    if ((($a = (typeof(Math.log2) !== "undefined")) !== nil && (!$a.$$is_boolean || $a == true))) {
      } else {
      
      Math.log2 = function(x) {
        return Math.log(x) / Math.LN2;
      }
    
    }

    Opal.defn(self, '$log2', function(x) {
      var $a, self = this;

      if ((($a = $scope.get('String')['$==='](x)) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('Opal').$type_error(x, $scope.get('Float')))}
      return $scope.get('Math').$checked("log2", $scope.get('Math')['$float!'](x));
    });

    Opal.defn(self, '$sin', function(x) {
      var self = this;

      return $scope.get('Math').$checked("sin", $scope.get('Math')['$float!'](x));
    });

    if ((($a = (typeof(Math.sinh) !== "undefined")) !== nil && (!$a.$$is_boolean || $a == true))) {
      } else {
      
      Math.sinh = function(x) {
        return (Math.exp(x) - Math.exp(-x)) / 2;
      }
    
    }

    Opal.defn(self, '$sinh', function(x) {
      var self = this;

      return $scope.get('Math').$checked("sinh", $scope.get('Math')['$float!'](x));
    });

    Opal.defn(self, '$sqrt', function(x) {
      var self = this;

      return $scope.get('Math').$checked("sqrt", $scope.get('Math')['$float!'](x));
    });

    Opal.defn(self, '$tan', function(x) {
      var $a, self = this;

      x = $scope.get('Math')['$float!'](x);
      if ((($a = x['$infinite?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        return (($scope.get('Float')).$$scope.get('NAN'))}
      return $scope.get('Math').$checked("tan", $scope.get('Math')['$float!'](x));
    });

    if ((($a = (typeof(Math.tanh) !== "undefined")) !== nil && (!$a.$$is_boolean || $a == true))) {
      } else {
      
      Math.tanh = function(x) {
        if (x == Infinity) {
          return 1;
        }
        else if (x == -Infinity) {
          return -1;
        }
        else {
          return (Math.exp(x) - Math.exp(-x)) / (Math.exp(x) + Math.exp(-x));
        }
      }
    
    }

    Opal.defn(self, '$tanh', function(x) {
      var self = this;

      return $scope.get('Math').$checked("tanh", $scope.get('Math')['$float!'](x));
    });
  })($scope.base)
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/complex"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_times(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs * rhs : lhs['$*'](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $module = Opal.module;

  Opal.add_stubs(['$require', '$===', '$real?', '$raise', '$new', '$*', '$cos', '$sin', '$attr_reader', '$class', '$==', '$real', '$imag', '$Complex', '$-@', '$+', '$__coerced__', '$-', '$nan?', '$/', '$conj', '$abs2', '$quo', '$polar', '$exp', '$log', '$>', '$!=', '$divmod', '$**', '$hypot', '$atan2', '$lcm', '$denominator', '$to_s', '$numerator', '$abs', '$arg', '$rationalize', '$to_f', '$to_i', '$to_r', '$inspect', '$positive?', '$infinite?']);
  self.$require("corelib/numeric");
  (function($base, $super) {
    function $Complex(){}
    var self = $Complex = $klass($base, $super, 'Complex', $Complex);

    var def = self.$$proto, $scope = self.$$scope;

    def.real = def.imag = nil;
    Opal.defs(self, '$rect', function(real, imag) {
      var $a, $b, $c, $d, self = this;

      if (imag == null) {
        imag = 0
      }
      if ((($a = ($b = ($c = ($d = $scope.get('Numeric')['$==='](real), $d !== false && $d !== nil ?real['$real?']() : $d), $c !== false && $c !== nil ?$scope.get('Numeric')['$==='](imag) : $c), $b !== false && $b !== nil ?imag['$real?']() : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('TypeError'), "not a real")
      }
      return self.$new(real, imag);
    });

    (function(self) {
      var $scope = self.$$scope, def = self.$$proto;

      return Opal.alias(self, 'rectangular', 'rect')
    })(Opal.get_singleton_class(self));

    Opal.defs(self, '$polar', function(r, theta) {
      var $a, $b, $c, $d, self = this;

      if (theta == null) {
        theta = 0
      }
      if ((($a = ($b = ($c = ($d = $scope.get('Numeric')['$==='](r), $d !== false && $d !== nil ?r['$real?']() : $d), $c !== false && $c !== nil ?$scope.get('Numeric')['$==='](theta) : $c), $b !== false && $b !== nil ?theta['$real?']() : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('TypeError'), "not a real")
      }
      return self.$new($rb_times(r, $scope.get('Math').$cos(theta)), $rb_times(r, $scope.get('Math').$sin(theta)));
    });

    self.$attr_reader("real", "imag");

    Opal.defn(self, '$initialize', function(real, imag) {
      var self = this;

      if (imag == null) {
        imag = 0
      }
      self.real = real;
      return self.imag = imag;
    });

    Opal.defn(self, '$coerce', function(other) {
      var $a, $b, self = this;

      if ((($a = $scope.get('Complex')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return [other, self]
      } else if ((($a = ($b = $scope.get('Numeric')['$==='](other), $b !== false && $b !== nil ?other['$real?']() : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return [$scope.get('Complex').$new(other, 0), self]
        } else {
        return self.$raise($scope.get('TypeError'), "" + (other.$class()) + " can't be coerced into Complex")
      }
    });

    Opal.defn(self, '$==', function(other) {
      var $a, $b, self = this;

      if ((($a = $scope.get('Complex')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return (($a = self.real['$=='](other.$real())) ? self.imag['$=='](other.$imag()) : self.real['$=='](other.$real()))
      } else if ((($a = ($b = $scope.get('Numeric')['$==='](other), $b !== false && $b !== nil ?other['$real?']() : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return (($a = self.real['$=='](other)) ? self.imag['$=='](0) : self.real['$=='](other))
        } else {
        return other['$=='](self)
      }
    });

    Opal.defn(self, '$-@', function() {
      var self = this;

      return self.$Complex(self.real['$-@'](), self.imag['$-@']());
    });

    Opal.defn(self, '$+', function(other) {
      var $a, $b, self = this;

      if ((($a = $scope.get('Complex')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$Complex($rb_plus(self.real, other.$real()), $rb_plus(self.imag, other.$imag()))
      } else if ((($a = ($b = $scope.get('Numeric')['$==='](other), $b !== false && $b !== nil ?other['$real?']() : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$Complex($rb_plus(self.real, other), self.imag)
        } else {
        return self.$__coerced__("+", other)
      }
    });

    Opal.defn(self, '$-', function(other) {
      var $a, $b, self = this;

      if ((($a = $scope.get('Complex')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$Complex($rb_minus(self.real, other.$real()), $rb_minus(self.imag, other.$imag()))
      } else if ((($a = ($b = $scope.get('Numeric')['$==='](other), $b !== false && $b !== nil ?other['$real?']() : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$Complex($rb_minus(self.real, other), self.imag)
        } else {
        return self.$__coerced__("-", other)
      }
    });

    Opal.defn(self, '$*', function(other) {
      var $a, $b, self = this;

      if ((($a = $scope.get('Complex')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$Complex($rb_minus($rb_times(self.real, other.$real()), $rb_times(self.imag, other.$imag())), $rb_plus($rb_times(self.real, other.$imag()), $rb_times(self.imag, other.$real())))
      } else if ((($a = ($b = $scope.get('Numeric')['$==='](other), $b !== false && $b !== nil ?other['$real?']() : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$Complex($rb_times(self.real, other), $rb_times(self.imag, other))
        } else {
        return self.$__coerced__("*", other)
      }
    });

    Opal.defn(self, '$/', function(other) {
      var $a, $b, $c, $d, $e, self = this;

      if ((($a = $scope.get('Complex')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = ((($b = ((($c = ((($d = (($e = $scope.get('Number')['$==='](self.real), $e !== false && $e !== nil ?self.real['$nan?']() : $e))) !== false && $d !== nil) ? $d : (($e = $scope.get('Number')['$==='](self.imag), $e !== false && $e !== nil ?self.imag['$nan?']() : $e)))) !== false && $c !== nil) ? $c : (($d = $scope.get('Number')['$==='](other.$real()), $d !== false && $d !== nil ?other.$real()['$nan?']() : $d)))) !== false && $b !== nil) ? $b : (($c = $scope.get('Number')['$==='](other.$imag()), $c !== false && $c !== nil ?other.$imag()['$nan?']() : $c)))) !== nil && (!$a.$$is_boolean || $a == true))) {
          return $scope.get('Complex').$new((($scope.get('Float')).$$scope.get('NAN')), (($scope.get('Float')).$$scope.get('NAN')))
          } else {
          return $rb_divide($rb_times(self, other.$conj()), other.$abs2())
        }
      } else if ((($a = ($b = $scope.get('Numeric')['$==='](other), $b !== false && $b !== nil ?other['$real?']() : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$Complex(self.real.$quo(other), self.imag.$quo(other))
        } else {
        return self.$__coerced__("/", other)
      }
    });

    Opal.defn(self, '$**', function(other) {
      var $a, $b, $c, $d, $e, self = this, r = nil, theta = nil, ore = nil, oim = nil, nr = nil, ntheta = nil, x = nil, z = nil, n = nil, div = nil, mod = nil;

      if (other['$=='](0)) {
        return $scope.get('Complex').$new(1, 0)}
      if ((($a = $scope.get('Complex')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        $b = self.$polar(), $a = Opal.to_ary($b), r = ($a[0] == null ? nil : $a[0]), theta = ($a[1] == null ? nil : $a[1]), $b;
        ore = other.$real();
        oim = other.$imag();
        nr = $scope.get('Math').$exp($rb_minus($rb_times(ore, $scope.get('Math').$log(r)), $rb_times(oim, theta)));
        ntheta = $rb_plus($rb_times(theta, ore), $rb_times(oim, $scope.get('Math').$log(r)));
        return $scope.get('Complex').$polar(nr, ntheta);
      } else if ((($a = $scope.get('Integer')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = $rb_gt(other, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
          x = self;
          z = x;
          n = $rb_minus(other, 1);
          while ((($b = n['$!='](0)) !== nil && (!$b.$$is_boolean || $b == true))) {
          while ((($c = ($e = n.$divmod(2), $d = Opal.to_ary($e), div = ($d[0] == null ? nil : $d[0]), mod = ($d[1] == null ? nil : $d[1]), $e, mod['$=='](0))) !== nil && (!$c.$$is_boolean || $c == true))) {
          x = self.$Complex($rb_minus($rb_times(x.$real(), x.$real()), $rb_times(x.$imag(), x.$imag())), $rb_times($rb_times(2, x.$real()), x.$imag()));
          n = div;}
          z = $rb_times(z, x);
          n = $rb_minus(n, 1);}
          return z;
          } else {
          return ($rb_divide($scope.get('Rational').$new(1, 1), self))['$**'](other['$-@']())
        }
      } else if ((($a = ((($b = $scope.get('Float')['$==='](other)) !== false && $b !== nil) ? $b : $scope.get('Rational')['$==='](other))) !== nil && (!$a.$$is_boolean || $a == true))) {
        $b = self.$polar(), $a = Opal.to_ary($b), r = ($a[0] == null ? nil : $a[0]), theta = ($a[1] == null ? nil : $a[1]), $b;
        return $scope.get('Complex').$polar(r['$**'](other), $rb_times(theta, other));
        } else {
        return self.$__coerced__("**", other)
      }
    });

    Opal.defn(self, '$abs', function() {
      var self = this;

      return $scope.get('Math').$hypot(self.real, self.imag);
    });

    Opal.defn(self, '$abs2', function() {
      var self = this;

      return $rb_plus($rb_times(self.real, self.real), $rb_times(self.imag, self.imag));
    });

    Opal.defn(self, '$angle', function() {
      var self = this;

      return $scope.get('Math').$atan2(self.imag, self.real);
    });

    Opal.alias(self, 'arg', 'angle');

    Opal.defn(self, '$conj', function() {
      var self = this;

      return self.$Complex(self.real, self.imag['$-@']());
    });

    Opal.alias(self, 'conjugate', 'conj');

    Opal.defn(self, '$denominator', function() {
      var self = this;

      return self.real.$denominator().$lcm(self.imag.$denominator());
    });

    Opal.alias(self, 'divide', '/');

    Opal.defn(self, '$eql?', function(other) {
      var $a, $b, self = this;

      return ($a = ($b = $scope.get('Complex')['$==='](other), $b !== false && $b !== nil ?self.real.$class()['$=='](self.imag.$class()) : $b), $a !== false && $a !== nil ?self['$=='](other) : $a);
    });

    Opal.defn(self, '$fdiv', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Numeric')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('TypeError'), "" + (other.$class()) + " can't be coerced into Complex")
      }
      return $rb_divide(self, other);
    });

    Opal.defn(self, '$hash', function() {
      var self = this;

      return "Complex:" + (self.real) + ":" + (self.imag);
    });

    Opal.alias(self, 'imaginary', 'imag');

    Opal.defn(self, '$inspect', function() {
      var self = this;

      return "(" + (self.$to_s()) + ")";
    });

    Opal.alias(self, 'magnitude', 'abs');

    Opal.defn(self, '$numerator', function() {
      var self = this, d = nil;

      d = self.$denominator();
      return self.$Complex($rb_times(self.real.$numerator(), ($rb_divide(d, self.real.$denominator()))), $rb_times(self.imag.$numerator(), ($rb_divide(d, self.imag.$denominator()))));
    });

    Opal.alias(self, 'phase', 'arg');

    Opal.defn(self, '$polar', function() {
      var self = this;

      return [self.$abs(), self.$arg()];
    });

    Opal.alias(self, 'quo', '/');

    Opal.defn(self, '$rationalize', function(eps) {
      var $a, self = this;

      
      if (arguments.length > 1) {
        self.$raise($scope.get('ArgumentError'), "wrong number of arguments (" + (arguments.length) + " for 0..1)");
      }

      if ((($a = self.imag['$!='](0)) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('RangeError'), "can't' convert " + (self) + " into Rational")}
      return self.$real().$rationalize(eps);
    });

    Opal.defn(self, '$real?', function() {
      var self = this;

      return false;
    });

    Opal.defn(self, '$rect', function() {
      var self = this;

      return [self.real, self.imag];
    });

    Opal.alias(self, 'rectangular', 'rect');

    Opal.defn(self, '$to_f', function() {
      var self = this;

      if (self.imag['$=='](0)) {
        } else {
        self.$raise($scope.get('RangeError'), "can't convert " + (self) + " into Float")
      }
      return self.real.$to_f();
    });

    Opal.defn(self, '$to_i', function() {
      var self = this;

      if (self.imag['$=='](0)) {
        } else {
        self.$raise($scope.get('RangeError'), "can't convert " + (self) + " into Integer")
      }
      return self.real.$to_i();
    });

    Opal.defn(self, '$to_r', function() {
      var self = this;

      if (self.imag['$=='](0)) {
        } else {
        self.$raise($scope.get('RangeError'), "can't convert " + (self) + " into Rational")
      }
      return self.real.$to_r();
    });

    Opal.defn(self, '$to_s', function() {
      var $a, $b, $c, self = this, result = nil;

      result = self.real.$inspect();
      if ((($a = ((($b = (($c = $scope.get('Number')['$==='](self.imag), $c !== false && $c !== nil ?self.imag['$nan?']() : $c))) !== false && $b !== nil) ? $b : self.imag['$positive?']())) !== nil && (!$a.$$is_boolean || $a == true))) {
        result = $rb_plus(result, "+")
        } else {
        result = $rb_plus(result, "-")
      }
      result = $rb_plus(result, self.imag.$abs().$inspect());
      if ((($a = ($b = $scope.get('Number')['$==='](self.imag), $b !== false && $b !== nil ?(((($c = self.imag['$nan?']()) !== false && $c !== nil) ? $c : self.imag['$infinite?']())) : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        result = $rb_plus(result, "*")}
      return $rb_plus(result, "i");
    });

    return Opal.cdecl($scope, 'I', self.$new(0, 1));
  })($scope.base, $scope.get('Numeric'));
  return (function($base) {
    var $Kernel, self = $Kernel = $module($base, 'Kernel');

    var def = self.$$proto, $scope = self.$$scope;

    Opal.defn(self, '$Complex', function(real, imag) {
      var self = this;

      if (imag == null) {
        imag = nil
      }
      if (imag !== false && imag !== nil) {
        return $scope.get('Complex').$new(real, imag)
        } else {
        return $scope.get('Complex').$new(real, 0)
      }
    })
  })($scope.base);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/rational"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_times(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs * rhs : lhs['$*'](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  function $rb_le(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs <= rhs : lhs['$<='](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $module = Opal.module;

  Opal.add_stubs(['$require', '$to_i', '$==', '$raise', '$<', '$-@', '$new', '$gcd', '$/', '$nil?', '$===', '$reduce', '$to_r', '$equal?', '$!', '$coerce_to!', '$attr_reader', '$to_f', '$numerator', '$denominator', '$<=>', '$-', '$*', '$__coerced__', '$+', '$Rational', '$>', '$**', '$abs', '$ceil', '$with_precision', '$floor', '$to_s', '$<=', '$truncate', '$send', '$convert']);
  self.$require("corelib/numeric");
  (function($base, $super) {
    function $Rational(){}
    var self = $Rational = $klass($base, $super, 'Rational', $Rational);

    var def = self.$$proto, $scope = self.$$scope;

    def.num = def.den = nil;
    Opal.defs(self, '$reduce', function(num, den) {
      var $a, self = this, gcd = nil;

      num = num.$to_i();
      den = den.$to_i();
      if (den['$=='](0)) {
        self.$raise($scope.get('ZeroDivisionError'), "divided by 0")
      } else if ((($a = $rb_lt(den, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
        num = num['$-@']();
        den = den['$-@']();
      } else if (den['$=='](1)) {
        return self.$new(num, den)}
      gcd = num.$gcd(den);
      return self.$new($rb_divide(num, gcd), $rb_divide(den, gcd));
    });

    Opal.defs(self, '$convert', function(num, den) {
      var $a, $b, $c, self = this;

      if ((($a = ((($b = num['$nil?']()) !== false && $b !== nil) ? $b : den['$nil?']())) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('TypeError'), "cannot convert nil into Rational")}
      if ((($a = ($b = $scope.get('Integer')['$==='](num), $b !== false && $b !== nil ?$scope.get('Integer')['$==='](den) : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$reduce(num, den)}
      if ((($a = ((($b = ((($c = $scope.get('Float')['$==='](num)) !== false && $c !== nil) ? $c : $scope.get('String')['$==='](num))) !== false && $b !== nil) ? $b : $scope.get('Complex')['$==='](num))) !== nil && (!$a.$$is_boolean || $a == true))) {
        num = num.$to_r()}
      if ((($a = ((($b = ((($c = $scope.get('Float')['$==='](den)) !== false && $c !== nil) ? $c : $scope.get('String')['$==='](den))) !== false && $b !== nil) ? $b : $scope.get('Complex')['$==='](den))) !== nil && (!$a.$$is_boolean || $a == true))) {
        den = den.$to_r()}
      if ((($a = ($b = den['$equal?'](1), $b !== false && $b !== nil ?($scope.get('Integer')['$==='](num))['$!']() : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return $scope.get('Opal')['$coerce_to!'](num, $scope.get('Rational'), "to_r")
      } else if ((($a = ($b = $scope.get('Numeric')['$==='](num), $b !== false && $b !== nil ?$scope.get('Numeric')['$==='](den) : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return $rb_divide(num, den)
        } else {
        return self.$reduce(num, den)
      }
    });

    self.$attr_reader("numerator", "denominator");

    Opal.defn(self, '$initialize', function(num, den) {
      var self = this;

      self.num = num;
      return self.den = den;
    });

    Opal.defn(self, '$numerator', function() {
      var self = this;

      return self.num;
    });

    Opal.defn(self, '$denominator', function() {
      var self = this;

      return self.den;
    });

    Opal.defn(self, '$coerce', function(other) {
      var self = this, $case = nil;

      return (function() {$case = other;if ($scope.get('Rational')['$===']($case)) {return [other, self]}else if ($scope.get('Integer')['$===']($case)) {return [other.$to_r(), self]}else if ($scope.get('Float')['$===']($case)) {return [other, self.$to_f()]}else { return nil }})();
    });

    Opal.defn(self, '$==', function(other) {
      var $a, self = this, $case = nil;

      return (function() {$case = other;if ($scope.get('Rational')['$===']($case)) {return (($a = self.num['$=='](other.$numerator())) ? self.den['$=='](other.$denominator()) : self.num['$=='](other.$numerator()))}else if ($scope.get('Integer')['$===']($case)) {return (($a = self.num['$=='](other)) ? self.den['$=='](1) : self.num['$=='](other))}else if ($scope.get('Float')['$===']($case)) {return self.$to_f()['$=='](other)}else {return other['$=='](self)}})();
    });

    Opal.defn(self, '$<=>', function(other) {
      var self = this, $case = nil;

      return (function() {$case = other;if ($scope.get('Rational')['$===']($case)) {return $rb_minus($rb_times(self.num, other.$denominator()), $rb_times(self.den, other.$numerator()))['$<=>'](0)}else if ($scope.get('Integer')['$===']($case)) {return $rb_minus(self.num, $rb_times(self.den, other))['$<=>'](0)}else if ($scope.get('Float')['$===']($case)) {return self.$to_f()['$<=>'](other)}else {return self.$__coerced__("<=>", other)}})();
    });

    Opal.defn(self, '$+', function(other) {
      var self = this, $case = nil, num = nil, den = nil;

      return (function() {$case = other;if ($scope.get('Rational')['$===']($case)) {num = $rb_plus($rb_times(self.num, other.$denominator()), $rb_times(self.den, other.$numerator()));
      den = $rb_times(self.den, other.$denominator());
      return self.$Rational(num, den);}else if ($scope.get('Integer')['$===']($case)) {return self.$Rational($rb_plus(self.num, $rb_times(other, self.den)), self.den)}else if ($scope.get('Float')['$===']($case)) {return $rb_plus(self.$to_f(), other)}else {return self.$__coerced__("+", other)}})();
    });

    Opal.defn(self, '$-', function(other) {
      var self = this, $case = nil, num = nil, den = nil;

      return (function() {$case = other;if ($scope.get('Rational')['$===']($case)) {num = $rb_minus($rb_times(self.num, other.$denominator()), $rb_times(self.den, other.$numerator()));
      den = $rb_times(self.den, other.$denominator());
      return self.$Rational(num, den);}else if ($scope.get('Integer')['$===']($case)) {return self.$Rational($rb_minus(self.num, $rb_times(other, self.den)), self.den)}else if ($scope.get('Float')['$===']($case)) {return $rb_minus(self.$to_f(), other)}else {return self.$__coerced__("-", other)}})();
    });

    Opal.defn(self, '$*', function(other) {
      var self = this, $case = nil, num = nil, den = nil;

      return (function() {$case = other;if ($scope.get('Rational')['$===']($case)) {num = $rb_times(self.num, other.$numerator());
      den = $rb_times(self.den, other.$denominator());
      return self.$Rational(num, den);}else if ($scope.get('Integer')['$===']($case)) {return self.$Rational($rb_times(self.num, other), self.den)}else if ($scope.get('Float')['$===']($case)) {return $rb_times(self.$to_f(), other)}else {return self.$__coerced__("*", other)}})();
    });

    Opal.defn(self, '$/', function(other) {
      var self = this, $case = nil, num = nil, den = nil;

      return (function() {$case = other;if ($scope.get('Rational')['$===']($case)) {num = $rb_times(self.num, other.$denominator());
      den = $rb_times(self.den, other.$numerator());
      return self.$Rational(num, den);}else if ($scope.get('Integer')['$===']($case)) {if (other['$=='](0)) {
        return $rb_divide(self.$to_f(), 0.0)
        } else {
        return self.$Rational(self.num, $rb_times(self.den, other))
      }}else if ($scope.get('Float')['$===']($case)) {return $rb_divide(self.$to_f(), other)}else {return self.$__coerced__("/", other)}})();
    });

    Opal.defn(self, '$**', function(other) {
      var $a, $b, self = this, $case = nil;

      return (function() {$case = other;if ($scope.get('Integer')['$===']($case)) {if ((($a = (($b = self['$=='](0)) ? $rb_lt(other, 0) : self['$=='](0))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return (($scope.get('Float')).$$scope.get('INFINITY'))
      } else if ((($a = $rb_gt(other, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$Rational(self.num['$**'](other), self.den['$**'](other))
      } else if ((($a = $rb_lt(other, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$Rational(self.den['$**'](other['$-@']()), self.num['$**'](other['$-@']()))
        } else {
        return self.$Rational(1, 1)
      }}else if ($scope.get('Float')['$===']($case)) {return self.$to_f()['$**'](other)}else if ($scope.get('Rational')['$===']($case)) {if (other['$=='](0)) {
        return self.$Rational(1, 1)
      } else if (other.$denominator()['$=='](1)) {
        if ((($a = $rb_lt(other, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
          return self.$Rational(self.den['$**'](other.$numerator().$abs()), self.num['$**'](other.$numerator().$abs()))
          } else {
          return self.$Rational(self.num['$**'](other.$numerator()), self.den['$**'](other.$numerator()))
        }
      } else if ((($a = (($b = self['$=='](0)) ? $rb_lt(other, 0) : self['$=='](0))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$raise($scope.get('ZeroDivisionError'), "divided by 0")
        } else {
        return self.$to_f()['$**'](other)
      }}else {return self.$__coerced__("**", other)}})();
    });

    Opal.defn(self, '$abs', function() {
      var self = this;

      return self.$Rational(self.num.$abs(), self.den.$abs());
    });

    Opal.defn(self, '$ceil', function(precision) {
      var self = this;

      if (precision == null) {
        precision = 0
      }
      if (precision['$=='](0)) {
        return (($rb_divide(self.num['$-@'](), self.den))['$-@']()).$ceil()
        } else {
        return self.$with_precision("ceil", precision)
      }
    });

    Opal.alias(self, 'divide', '/');

    Opal.defn(self, '$floor', function(precision) {
      var self = this;

      if (precision == null) {
        precision = 0
      }
      if (precision['$=='](0)) {
        return (($rb_divide(self.num['$-@'](), self.den))['$-@']()).$floor()
        } else {
        return self.$with_precision("floor", precision)
      }
    });

    Opal.defn(self, '$hash', function() {
      var self = this;

      return "Rational:" + (self.num) + ":" + (self.den);
    });

    Opal.defn(self, '$inspect', function() {
      var self = this;

      return "(" + (self.$to_s()) + ")";
    });

    Opal.alias(self, 'quo', '/');

    Opal.defn(self, '$rationalize', function(eps) {
      var self = this;

      
      if (arguments.length > 1) {
        self.$raise($scope.get('ArgumentError'), "wrong number of arguments (" + (arguments.length) + " for 0..1)");
      }

      if (eps == null) {
        return self;
      }

      var e = eps.$abs(),
          a = $rb_minus(self, e),
          b = $rb_plus(self, e);

      var p0 = 0,
          p1 = 1,
          q0 = 1,
          q1 = 0,
          p2, q2;

      var c, k, t;

      while (true) {
        c = (a).$ceil();

        if ($rb_le(c, b)) {
          break;
        }

        k  = c - 1;
        p2 = k * p1 + p0;
        q2 = k * q1 + q0;
        t  = $rb_divide(1, ($rb_minus(b, k)));
        b  = $rb_divide(1, ($rb_minus(a, k)));
        a  = t;

        p0 = p1;
        q0 = q1;
        p1 = p2;
        q1 = q2;
      }

      return self.$Rational(c * p1 + p0, c * q1 + q0);

    });

    Opal.defn(self, '$round', function(precision) {
      var $a, self = this, num = nil, den = nil, approx = nil;

      if (precision == null) {
        precision = 0
      }
      if (precision['$=='](0)) {
        } else {
        return self.$with_precision("round", precision)
      }
      if (self.num['$=='](0)) {
        return 0}
      if (self.den['$=='](1)) {
        return self.num}
      num = $rb_plus($rb_times(self.num.$abs(), 2), self.den);
      den = $rb_times(self.den, 2);
      approx = ($rb_divide(num, den)).$truncate();
      if ((($a = $rb_lt(self.num, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return approx['$-@']()
        } else {
        return approx
      }
    });

    Opal.defn(self, '$to_f', function() {
      var self = this;

      return $rb_divide(self.num, self.den);
    });

    Opal.defn(self, '$to_i', function() {
      var self = this;

      return self.$truncate();
    });

    Opal.defn(self, '$to_r', function() {
      var self = this;

      return self;
    });

    Opal.defn(self, '$to_s', function() {
      var self = this;

      return "" + (self.num) + "/" + (self.den);
    });

    Opal.defn(self, '$truncate', function(precision) {
      var $a, self = this;

      if (precision == null) {
        precision = 0
      }
      if (precision['$=='](0)) {
        if ((($a = $rb_lt(self.num, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
          return self.$ceil()
          } else {
          return self.$floor()
        }
        } else {
        return self.$with_precision("truncate", precision)
      }
    });

    return (Opal.defn(self, '$with_precision', function(method, precision) {
      var $a, self = this, p = nil, s = nil;

      if ((($a = $scope.get('Integer')['$==='](precision)) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        self.$raise($scope.get('TypeError'), "not an Integer")
      }
      p = (10)['$**'](precision);
      s = $rb_times(self, p);
      if ((($a = $rb_lt(precision, 1)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return ($rb_divide(s.$send(method), p)).$to_i()
        } else {
        return self.$Rational(s.$send(method), p)
      }
    }), nil) && 'with_precision';
  })($scope.base, $scope.get('Numeric'));
  return (function($base) {
    var $Kernel, self = $Kernel = $module($base, 'Kernel');

    var def = self.$$proto, $scope = self.$$scope;

    Opal.defn(self, '$Rational', function(numerator, denominator) {
      var self = this;

      if (denominator == null) {
        denominator = 1
      }
      return $scope.get('Rational').$convert(numerator, denominator);
    })
  })($scope.base);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/time"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_le(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs <= rhs : lhs['$<='](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $range = Opal.range;

  Opal.add_stubs(['$require', '$include', '$===', '$raise', '$coerce_to!', '$respond_to?', '$to_str', '$to_i', '$new', '$<=>', '$to_f', '$nil?', '$>', '$<', '$strftime', '$year', '$month', '$day', '$+', '$round', '$/', '$-', '$copy_instance_variables', '$initialize_dup', '$is_a?', '$zero?', '$wday', '$utc?', '$mon', '$yday', '$hour', '$min', '$sec', '$rjust', '$ljust', '$zone', '$to_s', '$[]', '$cweek_cyear', '$isdst', '$<=', '$!=', '$==', '$ceil']);
  self.$require("corelib/comparable");
  return (function($base, $super) {
    function $Time(){}
    var self = $Time = $klass($base, $super, 'Time', $Time);

    var def = self.$$proto, $scope = self.$$scope;

    self.$include($scope.get('Comparable'));

    
    var days_of_week = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        short_days   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        short_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        long_months  = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];


    Opal.defs(self, '$at', function(seconds, frac) {
      var self = this;

      
      var result;

      if ($scope.get('Time')['$==='](seconds)) {
        if (frac !== undefined) {
          self.$raise($scope.get('TypeError'), "can't convert Time into an exact number")
        }
        result = new Date(seconds.getTime());
        result.is_utc = seconds.is_utc;
        return result;
      }

      if (!seconds.$$is_number) {
        seconds = $scope.get('Opal')['$coerce_to!'](seconds, $scope.get('Integer'), "to_int");
      }

      if (frac === undefined) {
        return new Date(seconds * 1000);
      }

      if (!frac.$$is_number) {
        frac = $scope.get('Opal')['$coerce_to!'](frac, $scope.get('Integer'), "to_int");
      }

      return new Date(seconds * 1000 + (frac / 1000));

    });

    
    function time_params(year, month, day, hour, min, sec) {
      if (year.$$is_string) {
        year = parseInt(year, 10);
      } else {
        year = $scope.get('Opal')['$coerce_to!'](year, $scope.get('Integer'), "to_int");
      }

      if (month === nil) {
        month = 1;
      } else if (!month.$$is_number) {
        if ((month)['$respond_to?']("to_str")) {
          month = (month).$to_str();
          switch (month.toLowerCase()) {
          case 'jan': month =  1; break;
          case 'feb': month =  2; break;
          case 'mar': month =  3; break;
          case 'apr': month =  4; break;
          case 'may': month =  5; break;
          case 'jun': month =  6; break;
          case 'jul': month =  7; break;
          case 'aug': month =  8; break;
          case 'sep': month =  9; break;
          case 'oct': month = 10; break;
          case 'nov': month = 11; break;
          case 'dec': month = 12; break;
          default: month = (month).$to_i();
          }
        } else {
          month = $scope.get('Opal')['$coerce_to!'](month, $scope.get('Integer'), "to_int");
        }
      }

      if (month < 1 || month > 12) {
        self.$raise($scope.get('ArgumentError'), "month out of range: " + (month))
      }
      month = month - 1;

      if (day === nil) {
        day = 1;
      } else if (day.$$is_string) {
        day = parseInt(day, 10);
      } else {
        day = $scope.get('Opal')['$coerce_to!'](day, $scope.get('Integer'), "to_int");
      }

      if (day < 1 || day > 31) {
        self.$raise($scope.get('ArgumentError'), "day out of range: " + (day))
      }

      if (hour === nil) {
        hour = 0;
      } else if (hour.$$is_string) {
        hour = parseInt(hour, 10);
      } else {
        hour = $scope.get('Opal')['$coerce_to!'](hour, $scope.get('Integer'), "to_int");
      }

      if (hour < 0 || hour > 24) {
        self.$raise($scope.get('ArgumentError'), "hour out of range: " + (hour))
      }

      if (min === nil) {
        min = 0;
      } else if (min.$$is_string) {
        min = parseInt(min, 10);
      } else {
        min = $scope.get('Opal')['$coerce_to!'](min, $scope.get('Integer'), "to_int");
      }

      if (min < 0 || min > 59) {
        self.$raise($scope.get('ArgumentError'), "min out of range: " + (min))
      }

      if (sec === nil) {
        sec = 0;
      } else if (!sec.$$is_number) {
        if (sec.$$is_string) {
          sec = parseInt(sec, 10);
        } else {
          sec = $scope.get('Opal')['$coerce_to!'](sec, $scope.get('Integer'), "to_int");
        }
      }

      if (sec < 0 || sec > 60) {
        self.$raise($scope.get('ArgumentError'), "sec out of range: " + (sec))
      }

      return [year, month, day, hour, min, sec];
    }


    Opal.defs(self, '$new', function(year, month, day, hour, min, sec, utc_offset) {
      var self = this;

      if (month == null) {
        month = nil
      }
      if (day == null) {
        day = nil
      }
      if (hour == null) {
        hour = nil
      }
      if (min == null) {
        min = nil
      }
      if (sec == null) {
        sec = nil
      }
      if (utc_offset == null) {
        utc_offset = nil
      }
      
      var args, result;

      if (year === undefined) {
        return new Date();
      }

      if (utc_offset !== nil) {
        self.$raise($scope.get('ArgumentError'), "Opal does not support explicitly specifying UTC offset for Time")
      }

      args  = time_params(year, month, day, hour, min, sec);
      year  = args[0];
      month = args[1];
      day   = args[2];
      hour  = args[3];
      min   = args[4];
      sec   = args[5];

      result = new Date(year, month, day, hour, min, 0, sec * 1000);
      if (year < 100) {
        result.setFullYear(year);
      }
      return result;
    
    });

    Opal.defs(self, '$local', function(year, month, day, hour, min, sec, millisecond, _dummy1, _dummy2, _dummy3) {
      var self = this;

      if (month == null) {
        month = nil
      }
      if (day == null) {
        day = nil
      }
      if (hour == null) {
        hour = nil
      }
      if (min == null) {
        min = nil
      }
      if (sec == null) {
        sec = nil
      }
      if (millisecond == null) {
        millisecond = nil
      }
      if (_dummy1 == null) {
        _dummy1 = nil
      }
      if (_dummy2 == null) {
        _dummy2 = nil
      }
      if (_dummy3 == null) {
        _dummy3 = nil
      }
      
      var args, result;

      if (arguments.length === 10) {
        args  = $slice.call(arguments);
        year  = args[5];
        month = args[4];
        day   = args[3];
        hour  = args[2];
        min   = args[1];
        sec   = args[0];
      }

      args  = time_params(year, month, day, hour, min, sec);
      year  = args[0];
      month = args[1];
      day   = args[2];
      hour  = args[3];
      min   = args[4];
      sec   = args[5];

      result = new Date(year, month, day, hour, min, 0, sec * 1000);
      if (year < 100) {
        result.setFullYear(year);
      }
      return result;
    
    });

    Opal.defs(self, '$gm', function(year, month, day, hour, min, sec, millisecond, _dummy1, _dummy2, _dummy3) {
      var self = this;

      if (month == null) {
        month = nil
      }
      if (day == null) {
        day = nil
      }
      if (hour == null) {
        hour = nil
      }
      if (min == null) {
        min = nil
      }
      if (sec == null) {
        sec = nil
      }
      if (millisecond == null) {
        millisecond = nil
      }
      if (_dummy1 == null) {
        _dummy1 = nil
      }
      if (_dummy2 == null) {
        _dummy2 = nil
      }
      if (_dummy3 == null) {
        _dummy3 = nil
      }
      
      var args, result;

      if (arguments.length === 10) {
        args  = $slice.call(arguments);
        year  = args[5];
        month = args[4];
        day   = args[3];
        hour  = args[2];
        min   = args[1];
        sec   = args[0];
      }

      args  = time_params(year, month, day, hour, min, sec);
      year  = args[0];
      month = args[1];
      day   = args[2];
      hour  = args[3];
      min   = args[4];
      sec   = args[5];

      result = new Date(Date.UTC(year, month, day, hour, min, 0, sec * 1000));
      if (year < 100) {
        result.setUTCFullYear(year);
      }
      result.is_utc = true;
      return result;
    
    });

    (function(self) {
      var $scope = self.$$scope, def = self.$$proto;

      Opal.alias(self, 'mktime', 'local');
      return Opal.alias(self, 'utc', 'gm');
    })(Opal.get_singleton_class(self));

    Opal.defs(self, '$now', function() {
      var self = this;

      return self.$new();
    });

    Opal.defn(self, '$+', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Time')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        self.$raise($scope.get('TypeError'), "time + time?")}
      
      if (!other.$$is_number) {
        other = $scope.get('Opal')['$coerce_to!'](other, $scope.get('Integer'), "to_int");
      }
      var result = new Date(self.getTime() + (other * 1000));
      result.is_utc = self.is_utc;
      return result;

    });

    Opal.defn(self, '$-', function(other) {
      var $a, self = this;

      if ((($a = $scope.get('Time')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return (self.getTime() - other.getTime()) / 1000}
      
      if (!other.$$is_number) {
        other = $scope.get('Opal')['$coerce_to!'](other, $scope.get('Integer'), "to_int");
      }
      var result = new Date(self.getTime() - (other * 1000));
      result.is_utc = self.is_utc;
      return result;

    });

    Opal.defn(self, '$<=>', function(other) {
      var $a, self = this, r = nil;

      if ((($a = $scope.get('Time')['$==='](other)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$to_f()['$<=>'](other.$to_f())
        } else {
        r = other['$<=>'](self);
        if ((($a = r['$nil?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
          return nil
        } else if ((($a = $rb_gt(r, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
          return -1
        } else if ((($a = $rb_lt(r, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
          return 1
          } else {
          return 0
        }
      }
    });

    Opal.defn(self, '$==', function(other) {
      var self = this;

      return self.$to_f() === other.$to_f();
    });

    Opal.defn(self, '$asctime', function() {
      var self = this;

      return self.$strftime("%a %b %e %H:%M:%S %Y");
    });

    Opal.alias(self, 'ctime', 'asctime');

    Opal.defn(self, '$day', function() {
      var self = this;

      return self.is_utc ? self.getUTCDate() : self.getDate();
    });

    Opal.defn(self, '$yday', function() {
      var self = this, start_of_year = nil, start_of_day = nil, one_day = nil;

      start_of_year = $scope.get('Time').$new(self.$year()).$to_i();
      start_of_day = $scope.get('Time').$new(self.$year(), self.$month(), self.$day()).$to_i();
      one_day = 86400;
      return $rb_plus(($rb_divide(($rb_minus(start_of_day, start_of_year)), one_day)).$round(), 1);
    });

    Opal.defn(self, '$isdst', function() {
      var self = this;

      
      var jan = new Date(self.getFullYear(), 0, 1),
          jul = new Date(self.getFullYear(), 6, 1);
      return self.getTimezoneOffset() < Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    
    });

    Opal.alias(self, 'dst?', 'isdst');

    Opal.defn(self, '$dup', function() {
      var self = this, copy = nil;

      copy = new Date(self.getTime());
      copy.$copy_instance_variables(self);
      copy.$initialize_dup(self);
      return copy;
    });

    Opal.defn(self, '$eql?', function(other) {
      var $a, self = this;

      return ($a = other['$is_a?']($scope.get('Time')), $a !== false && $a !== nil ?(self['$<=>'](other))['$zero?']() : $a);
    });

    Opal.defn(self, '$friday?', function() {
      var self = this;

      return self.$wday() == 5;
    });

    Opal.defn(self, '$hash', function() {
      var self = this;

      return 'Time:' + self.getTime();
    });

    Opal.defn(self, '$hour', function() {
      var self = this;

      return self.is_utc ? self.getUTCHours() : self.getHours();
    });

    Opal.defn(self, '$inspect', function() {
      var $a, self = this;

      if ((($a = self['$utc?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
        return self.$strftime("%Y-%m-%d %H:%M:%S UTC")
        } else {
        return self.$strftime("%Y-%m-%d %H:%M:%S %z")
      }
    });

    Opal.alias(self, 'mday', 'day');

    Opal.defn(self, '$min', function() {
      var self = this;

      return self.is_utc ? self.getUTCMinutes() : self.getMinutes();
    });

    Opal.defn(self, '$mon', function() {
      var self = this;

      return (self.is_utc ? self.getUTCMonth() : self.getMonth()) + 1;
    });

    Opal.defn(self, '$monday?', function() {
      var self = this;

      return self.$wday() == 1;
    });

    Opal.alias(self, 'month', 'mon');

    Opal.defn(self, '$saturday?', function() {
      var self = this;

      return self.$wday() == 6;
    });

    Opal.defn(self, '$sec', function() {
      var self = this;

      return self.is_utc ? self.getUTCSeconds() : self.getSeconds();
    });

    Opal.defn(self, '$succ', function() {
      var self = this;

      
      var result = new Date(self.getTime() + 1000);
      result.is_utc = self.is_utc;
      return result;
    
    });

    Opal.defn(self, '$usec', function() {
      var self = this;

      return self.getMilliseconds() * 1000;
    });

    Opal.defn(self, '$zone', function() {
      var self = this;

      
      var string = self.toString(),
          result;

      if (string.indexOf('(') == -1) {
        result = string.match(/[A-Z]{3,4}/)[0];
      }
      else {
        result = string.match(/\([^)]+\)/)[0].match(/[A-Z]/g).join('');
      }

      if (result == "GMT" && /(GMT\W*\d{4})/.test(string)) {
        return RegExp.$1;
      }
      else {
        return result;
      }
    
    });

    Opal.defn(self, '$getgm', function() {
      var self = this;

      
      var result = new Date(self.getTime());
      result.is_utc = true;
      return result;
    
    });

    Opal.alias(self, 'getutc', 'getgm');

    Opal.defn(self, '$gmtime', function() {
      var self = this;

      
      self.is_utc = true;
      return self;
    
    });

    Opal.alias(self, 'utc', 'gmtime');

    Opal.defn(self, '$gmt?', function() {
      var self = this;

      return self.is_utc === true;
    });

    Opal.defn(self, '$gmt_offset', function() {
      var self = this;

      return -self.getTimezoneOffset() * 60;
    });

    Opal.defn(self, '$strftime', function(format) {
      var self = this;

      
      return format.replace(/%([\-_#^0]*:{0,2})(\d+)?([EO]*)(.)/g, function(full, flags, width, _, conv) {
        var result = "",
            zero   = flags.indexOf('0') !== -1,
            pad    = flags.indexOf('-') === -1,
            blank  = flags.indexOf('_') !== -1,
            upcase = flags.indexOf('^') !== -1,
            invert = flags.indexOf('#') !== -1,
            colons = (flags.match(':') || []).length;

        width = parseInt(width, 10);

        if (zero && blank) {
          if (flags.indexOf('0') < flags.indexOf('_')) {
            zero = false;
          }
          else {
            blank = false;
          }
        }

        switch (conv) {
          case 'Y':
            result += self.$year();
            break;

          case 'C':
            zero    = !blank;
            result += Math.round(self.$year() / 100);
            break;

          case 'y':
            zero    = !blank;
            result += (self.$year() % 100);
            break;

          case 'm':
            zero    = !blank;
            result += self.$mon();
            break;

          case 'B':
            result += long_months[self.$mon() - 1];
            break;

          case 'b':
          case 'h':
            blank   = !zero;
            result += short_months[self.$mon() - 1];
            break;

          case 'd':
            zero    = !blank
            result += self.$day();
            break;

          case 'e':
            blank   = !zero
            result += self.$day();
            break;

          case 'j':
            result += self.$yday();
            break;

          case 'H':
            zero    = !blank;
            result += self.$hour();
            break;

          case 'k':
            blank   = !zero;
            result += self.$hour();
            break;

          case 'I':
            zero    = !blank;
            result += (self.$hour() % 12 || 12);
            break;

          case 'l':
            blank   = !zero;
            result += (self.$hour() % 12 || 12);
            break;

          case 'P':
            result += (self.$hour() >= 12 ? "pm" : "am");
            break;

          case 'p':
            result += (self.$hour() >= 12 ? "PM" : "AM");
            break;

          case 'M':
            zero    = !blank;
            result += self.$min();
            break;

          case 'S':
            zero    = !blank;
            result += self.$sec()
            break;

          case 'L':
            zero    = !blank;
            width   = isNaN(width) ? 3 : width;
            result += self.getMilliseconds();
            break;

          case 'N':
            width   = isNaN(width) ? 9 : width;
            result += (self.getMilliseconds().toString()).$rjust(3, "0");
            result  = (result).$ljust(width, "0");
            break;

          case 'z':
            var offset  = self.getTimezoneOffset(),
                hours   = Math.floor(Math.abs(offset) / 60),
                minutes = Math.abs(offset) % 60;

            result += offset < 0 ? "+" : "-";
            result += hours < 10 ? "0" : "";
            result += hours;

            if (colons > 0) {
              result += ":";
            }

            result += minutes < 10 ? "0" : "";
            result += minutes;

            if (colons > 1) {
              result += ":00";
            }

            break;

          case 'Z':
            result += self.$zone();
            break;

          case 'A':
            result += days_of_week[self.$wday()];
            break;

          case 'a':
            result += short_days[self.$wday()];
            break;

          case 'u':
            result += (self.$wday() + 1);
            break;

          case 'w':
            result += self.$wday();
            break;

          case 'V':
            result += self.$cweek_cyear()['$[]'](0).$to_s().$rjust(2, "0");
            break;

          case 'G':
            result += self.$cweek_cyear()['$[]'](1);
            break;

          case 'g':
            result += self.$cweek_cyear()['$[]'](1)['$[]']($range(-2, -1, false));
            break;

          case 's':
            result += self.$to_i();
            break;

          case 'n':
            result += "\n";
            break;

          case 't':
            result += "\t";
            break;

          case '%':
            result += "%";
            break;

          case 'c':
            result += self.$strftime("%a %b %e %T %Y");
            break;

          case 'D':
          case 'x':
            result += self.$strftime("%m/%d/%y");
            break;

          case 'F':
            result += self.$strftime("%Y-%m-%d");
            break;

          case 'v':
            result += self.$strftime("%e-%^b-%4Y");
            break;

          case 'r':
            result += self.$strftime("%I:%M:%S %p");
            break;

          case 'R':
            result += self.$strftime("%H:%M");
            break;

          case 'T':
          case 'X':
            result += self.$strftime("%H:%M:%S");
            break;

          default:
            return full;
        }

        if (upcase) {
          result = result.toUpperCase();
        }

        if (invert) {
          result = result.replace(/[A-Z]/, function(c) { c.toLowerCase() }).
                          replace(/[a-z]/, function(c) { c.toUpperCase() });
        }

        if (pad && (zero || blank)) {
          result = (result).$rjust(isNaN(width) ? 2 : width, blank ? " " : "0");
        }

        return result;
      });
    
    });

    Opal.defn(self, '$sunday?', function() {
      var self = this;

      return self.$wday() == 0;
    });

    Opal.defn(self, '$thursday?', function() {
      var self = this;

      return self.$wday() == 4;
    });

    Opal.defn(self, '$to_a', function() {
      var self = this;

      return [self.$sec(), self.$min(), self.$hour(), self.$day(), self.$month(), self.$year(), self.$wday(), self.$yday(), self.$isdst(), self.$zone()];
    });

    Opal.defn(self, '$to_f', function() {
      var self = this;

      return self.getTime() / 1000;
    });

    Opal.defn(self, '$to_i', function() {
      var self = this;

      return parseInt(self.getTime() / 1000, 10);
    });

    Opal.alias(self, 'to_s', 'inspect');

    Opal.defn(self, '$tuesday?', function() {
      var self = this;

      return self.$wday() == 2;
    });

    Opal.alias(self, 'tv_sec', 'sec');

    Opal.alias(self, 'tv_usec', 'usec');

    Opal.alias(self, 'utc?', 'gmt?');

    Opal.alias(self, 'gmtoff', 'gmt_offset');

    Opal.alias(self, 'utc_offset', 'gmt_offset');

    Opal.defn(self, '$wday', function() {
      var self = this;

      return self.is_utc ? self.getUTCDay() : self.getDay();
    });

    Opal.defn(self, '$wednesday?', function() {
      var self = this;

      return self.$wday() == 3;
    });

    Opal.defn(self, '$year', function() {
      var self = this;

      return self.is_utc ? self.getUTCFullYear() : self.getFullYear();
    });

    return (Opal.defn(self, '$cweek_cyear', function() {
      var $a, $b, self = this, jan01 = nil, jan01_wday = nil, first_monday = nil, year = nil, offset = nil, week = nil, dec31 = nil, dec31_wday = nil;

      jan01 = $scope.get('Time').$new(self.$year(), 1, 1);
      jan01_wday = jan01.$wday();
      first_monday = 0;
      year = self.$year();
      if ((($a = ($b = $rb_le(jan01_wday, 4), $b !== false && $b !== nil ?jan01_wday['$!='](0) : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        offset = $rb_minus(jan01_wday, 1)
        } else {
        offset = $rb_minus($rb_minus(jan01_wday, 7), 1);
        if (offset['$=='](-8)) {
          offset = -1}
      }
      week = ($rb_divide(($rb_plus(self.$yday(), offset)), 7.0)).$ceil();
      if ((($a = $rb_le(week, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return $scope.get('Time').$new($rb_minus(self.$year(), 1), 12, 31).$cweek_cyear()
      } else if (week['$=='](53)) {
        dec31 = $scope.get('Time').$new(self.$year(), 12, 31);
        dec31_wday = dec31.$wday();
        if ((($a = ($b = $rb_le(dec31_wday, 3), $b !== false && $b !== nil ?dec31_wday['$!='](0) : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
          week = 1;
          year = $rb_plus(year, 1);}}
      return [week, year];
    }), nil) && 'cweek_cyear';
  })($scope.base, Date);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/struct"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  function $rb_ge(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs >= rhs : lhs['$>='](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $hash2 = Opal.hash2;

  Opal.add_stubs(['$require', '$include', '$==', '$[]', '$upcase', '$const_set', '$new', '$unshift', '$each', '$define_struct_attribute', '$class_eval', '$to_proc', '$allocate', '$initialize', '$raise', '$<<', '$members', '$define_method', '$instance_eval', '$each_with_index', '$[]=', '$class', '$hash', '$===', '$<', '$-@', '$size', '$>=', '$coerce_to!', '$include?', '$to_sym', '$instance_of?', '$__id__', '$eql?', '$enum_for', '$length', '$map', '$+', '$join', '$inspect', '$each_pair', '$inject', '$flatten', '$to_a']);
  self.$require("corelib/enumerable");
  return (function($base, $super) {
    function $Struct(){}
    var self = $Struct = $klass($base, $super, 'Struct', $Struct);

    var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_8, TMP_11;

    self.$include($scope.get('Enumerable'));

    Opal.defs(self, '$new', TMP_1 = function(name) {
      var $a, $b, $c, TMP_2, self = this, $iter = TMP_1.$$p, block = $iter || nil, $splat_index = nil, $zuper = nil, $zuper_index = nil;

      var array_size = arguments.length - 1;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 1];
      }
      TMP_1.$$p = null;
      $zuper = [];
      for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
        $zuper[$zuper_index] = arguments[$zuper_index];
      }
      if (self['$==']($scope.get('Struct'))) {
        } else {
        return Opal.find_super_dispatcher(self, 'new', TMP_1, $iter, $Struct).apply(self, $zuper)
      }
      if (name['$[]'](0)['$=='](name['$[]'](0).$upcase())) {
        return $scope.get('Struct').$const_set(name, ($a = self).$new.apply($a, Opal.to_a(args)))
        } else {
        args.$unshift(name);
        return ($b = ($c = $scope.get('Class')).$new, $b.$$p = (TMP_2 = function(){var self = TMP_2.$$s || this, $a, $b, TMP_3, $c;

        ($a = ($b = args).$each, $a.$$p = (TMP_3 = function(arg){var self = TMP_3.$$s || this;
if (arg == null) arg = nil;
          return self.$define_struct_attribute(arg)}, TMP_3.$$s = self, TMP_3), $a).call($b);
          if (block !== false && block !== nil) {
            ($a = ($c = self).$class_eval, $a.$$p = block.$to_proc(), $a).call($c)}
          return (function(self) {
            var $scope = self.$$scope, def = self.$$proto;

            Opal.defn(self, '$new', function() {
              var $a, self = this, instance = nil, $splat_index = nil;

              var array_size = arguments.length - 0;
              if(array_size < 0) array_size = 0;
              var args = new Array(array_size);
              for($splat_index = 0; $splat_index < array_size; $splat_index++) {
                args[$splat_index] = arguments[$splat_index + 0];
              }
              instance = self.$allocate();
              instance.$$data = {};
              ($a = instance).$initialize.apply($a, Opal.to_a(args));
              return instance;
            });
            return Opal.alias(self, '[]', 'new');
          })(Opal.get_singleton_class(self));}, TMP_2.$$s = self, TMP_2), $b).call($c, self);
      }
    });

    Opal.defs(self, '$define_struct_attribute', function(name) {
      var $a, $b, TMP_4, $c, TMP_5, self = this;

      if (self['$==']($scope.get('Struct'))) {
        self.$raise($scope.get('ArgumentError'), "you cannot define attributes to the Struct class")}
      self.$members()['$<<'](name);
      ($a = ($b = self).$define_method, $a.$$p = (TMP_4 = function(){var self = TMP_4.$$s || this;

      return self.$$data[name];}, TMP_4.$$s = self, TMP_4), $a).call($b, name);
      return ($a = ($c = self).$define_method, $a.$$p = (TMP_5 = function(value){var self = TMP_5.$$s || this;
if (value == null) value = nil;
      return self.$$data[name] = value;}, TMP_5.$$s = self, TMP_5), $a).call($c, "" + (name) + "=");
    });

    Opal.defs(self, '$members', function() {
      var $a, self = this;
      if (self.members == null) self.members = nil;

      if (self['$==']($scope.get('Struct'))) {
        self.$raise($scope.get('ArgumentError'), "the Struct class has no members")}
      return ((($a = self.members) !== false && $a !== nil) ? $a : self.members = []);
    });

    Opal.defs(self, '$inherited', function(klass) {
      var $a, $b, TMP_6, self = this, members = nil;
      if (self.members == null) self.members = nil;

      members = self.members;
      return ($a = ($b = klass).$instance_eval, $a.$$p = (TMP_6 = function(){var self = TMP_6.$$s || this;

      return self.members = members}, TMP_6.$$s = self, TMP_6), $a).call($b);
    });

    Opal.defn(self, '$initialize', function() {
      var $a, $b, TMP_7, self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      return ($a = ($b = self.$members()).$each_with_index, $a.$$p = (TMP_7 = function(name, index){var self = TMP_7.$$s || this;
if (name == null) name = nil;if (index == null) index = nil;
      return self['$[]='](name, args['$[]'](index))}, TMP_7.$$s = self, TMP_7), $a).call($b);
    });

    Opal.defn(self, '$members', function() {
      var self = this;

      return self.$class().$members();
    });

    Opal.defn(self, '$hash', function() {
      var self = this;

      return $scope.get('Hash').$new(self.$$data).$hash();
    });

    Opal.defn(self, '$[]', function(name) {
      var $a, self = this;

      if ((($a = $scope.get('Integer')['$==='](name)) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = $rb_lt(name, self.$members().$size()['$-@']())) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('IndexError'), "offset " + (name) + " too small for struct(size:" + (self.$members().$size()) + ")")}
        if ((($a = $rb_ge(name, self.$members().$size())) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('IndexError'), "offset " + (name) + " too large for struct(size:" + (self.$members().$size()) + ")")}
        name = self.$members()['$[]'](name);
      } else if ((($a = $scope.get('String')['$==='](name)) !== nil && (!$a.$$is_boolean || $a == true))) {
        
        if(!self.$$data.hasOwnProperty(name)) {
          self.$raise($scope.get('NameError').$new("no member '" + (name) + "' in struct", name))
        }

        } else {
        self.$raise($scope.get('TypeError'), "no implicit conversion of " + (name.$class()) + " into Integer")
      }
      name = $scope.get('Opal')['$coerce_to!'](name, $scope.get('String'), "to_str");
      return self.$$data[name];
    });

    Opal.defn(self, '$[]=', function(name, value) {
      var $a, self = this;

      if ((($a = $scope.get('Integer')['$==='](name)) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = $rb_lt(name, self.$members().$size()['$-@']())) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('IndexError'), "offset " + (name) + " too small for struct(size:" + (self.$members().$size()) + ")")}
        if ((($a = $rb_ge(name, self.$members().$size())) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$raise($scope.get('IndexError'), "offset " + (name) + " too large for struct(size:" + (self.$members().$size()) + ")")}
        name = self.$members()['$[]'](name);
      } else if ((($a = $scope.get('String')['$==='](name)) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = self.$members()['$include?'](name.$to_sym())) !== nil && (!$a.$$is_boolean || $a == true))) {
          } else {
          self.$raise($scope.get('NameError').$new("no member '" + (name) + "' in struct", name))
        }
        } else {
        self.$raise($scope.get('TypeError'), "no implicit conversion of " + (name.$class()) + " into Integer")
      }
      name = $scope.get('Opal')['$coerce_to!'](name, $scope.get('String'), "to_str");
      return self.$$data[name] = value;
    });

    Opal.defn(self, '$==', function(other) {
      var $a, self = this;

      if ((($a = other['$instance_of?'](self.$class())) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        return false
      }
      
      var recursed1 = {}, recursed2 = {};

      function _eqeq(struct, other) {
        var key, a, b;

        recursed1[(struct).$__id__()] = true;
        recursed2[(other).$__id__()] = true;

        for (key in struct.$$data) {
          a = struct.$$data[key];
          b = other.$$data[key];

          if ($scope.get('Struct')['$==='](a)) {
            if (!recursed1.hasOwnProperty((a).$__id__()) || !recursed2.hasOwnProperty((b).$__id__())) {
              if (!_eqeq(a, b)) {
                return false;
              }
            }
          } else {
            if (!(a)['$=='](b)) {
              return false;
            }
          }
        }

        return true;
      }

      return _eqeq(self, other);

    });

    Opal.defn(self, '$eql?', function(other) {
      var $a, self = this;

      if ((($a = other['$instance_of?'](self.$class())) !== nil && (!$a.$$is_boolean || $a == true))) {
        } else {
        return false
      }
      
      var recursed1 = {}, recursed2 = {};

      function _eqeq(struct, other) {
        var key, a, b;

        recursed1[(struct).$__id__()] = true;
        recursed2[(other).$__id__()] = true;

        for (key in struct.$$data) {
          a = struct.$$data[key];
          b = other.$$data[key];

          if ($scope.get('Struct')['$==='](a)) {
            if (!recursed1.hasOwnProperty((a).$__id__()) || !recursed2.hasOwnProperty((b).$__id__())) {
              if (!_eqeq(a, b)) {
                return false;
              }
            }
          } else {
            if (!(a)['$eql?'](b)) {
              return false;
            }
          }
        }

        return true;
      }

      return _eqeq(self, other);

    });

    Opal.defn(self, '$each', TMP_8 = function() {
      var $a, $b, TMP_9, $c, TMP_10, self = this, $iter = TMP_8.$$p, $yield = $iter || nil;

      TMP_8.$$p = null;
      if (($yield !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_9 = function(){var self = TMP_9.$$s || this;

        return self.$size()}, TMP_9.$$s = self, TMP_9), $a).call($b, "each")
      }
      ($a = ($c = self.$members()).$each, $a.$$p = (TMP_10 = function(name){var self = TMP_10.$$s || this, $a;
if (name == null) name = nil;
      return $a = Opal.yield1($yield, self['$[]'](name)), $a === $breaker ? $a : $a}, TMP_10.$$s = self, TMP_10), $a).call($c);
      return self;
    });

    Opal.defn(self, '$each_pair', TMP_11 = function() {
      var $a, $b, TMP_12, $c, TMP_13, self = this, $iter = TMP_11.$$p, $yield = $iter || nil;

      TMP_11.$$p = null;
      if (($yield !== nil)) {
        } else {
        return ($a = ($b = self).$enum_for, $a.$$p = (TMP_12 = function(){var self = TMP_12.$$s || this;

        return self.$size()}, TMP_12.$$s = self, TMP_12), $a).call($b, "each_pair")
      }
      ($a = ($c = self.$members()).$each, $a.$$p = (TMP_13 = function(name){var self = TMP_13.$$s || this, $a;
if (name == null) name = nil;
      return $a = Opal.yield1($yield, [name, self['$[]'](name)]), $a === $breaker ? $a : $a}, TMP_13.$$s = self, TMP_13), $a).call($c);
      return self;
    });

    Opal.defn(self, '$length', function() {
      var self = this;

      return self.$members().$length();
    });

    Opal.alias(self, 'size', 'length');

    Opal.defn(self, '$to_a', function() {
      var $a, $b, TMP_14, self = this;

      return ($a = ($b = self.$members()).$map, $a.$$p = (TMP_14 = function(name){var self = TMP_14.$$s || this;
if (name == null) name = nil;
      return self['$[]'](name)}, TMP_14.$$s = self, TMP_14), $a).call($b);
    });

    Opal.alias(self, 'values', 'to_a');

    Opal.defn(self, '$inspect', function() {
      var $a, $b, TMP_15, self = this, result = nil;

      result = "#<struct ";
      if (self.$class()['$==']($scope.get('Struct'))) {
        result = $rb_plus(result, "" + (self.$class()) + " ")}
      result = $rb_plus(result, ($a = ($b = self.$each_pair()).$map, $a.$$p = (TMP_15 = function(name, value){var self = TMP_15.$$s || this;
if (name == null) name = nil;if (value == null) value = nil;
      return "" + (name) + "=" + (value.$inspect())}, TMP_15.$$s = self, TMP_15), $a).call($b).$join(", "));
      result = $rb_plus(result, ">");
      return result;
    });

    Opal.alias(self, 'to_s', 'inspect');

    Opal.defn(self, '$to_h', function() {
      var $a, $b, TMP_16, self = this;

      return ($a = ($b = self.$members()).$inject, $a.$$p = (TMP_16 = function(h, name){var self = TMP_16.$$s || this;
if (h == null) h = nil;if (name == null) name = nil;
      h['$[]='](name, self['$[]'](name));
        return h;}, TMP_16.$$s = self, TMP_16), $a).call($b, $hash2([], {}));
    });

    return (Opal.defn(self, '$values_at', function() {
      var $a, $b, TMP_17, self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var args = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        args[$splat_index] = arguments[$splat_index + 0];
      }
      args = ($a = ($b = args).$map, $a.$$p = (TMP_17 = function(arg){var self = TMP_17.$$s || this;
if (arg == null) arg = nil;
      return arg.$$is_range ? arg.$to_a() : arg;}, TMP_17.$$s = self, TMP_17), $a).call($b).$flatten();
      
      var result = [];
      for (var i = 0, len = args.length; i < len; i++) {
        if (!args[i].$$is_number) {
          self.$raise($scope.get('TypeError'), "no implicit conversion of " + ((args[i]).$class()) + " into Integer")
        }
        result.push(self['$[]'](args[i]));
      }
      return result;

    }), nil) && 'values_at';
  })($scope.base, null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/io"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var $a, $b, self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $module = Opal.module, $gvars = Opal.gvars;

  Opal.add_stubs(['$attr_accessor', '$size', '$write', '$join', '$map', '$String', '$empty?', '$concat', '$chomp', '$getbyte', '$getc', '$raise', '$new', '$write_proc=', '$extend']);
  (function($base, $super) {
    function $IO(){}
    var self = $IO = $klass($base, $super, 'IO', $IO);

    var def = self.$$proto, $scope = self.$$scope;

    def.tty = def.closed = nil;
    Opal.cdecl($scope, 'SEEK_SET', 0);

    Opal.cdecl($scope, 'SEEK_CUR', 1);

    Opal.cdecl($scope, 'SEEK_END', 2);

    Opal.defn(self, '$tty?', function() {
      var self = this;

      return self.tty;
    });

    Opal.defn(self, '$closed?', function() {
      var self = this;

      return self.closed;
    });

    self.$attr_accessor("write_proc");

    Opal.defn(self, '$write', function(string) {
      var self = this;

      self.write_proc(string);
      return string.$size();
    });

    self.$attr_accessor("sync", "tty");

    Opal.defn(self, '$flush', function() {
      var self = this;

      return nil;
    });

    (function($base) {
      var $Writable, self = $Writable = $module($base, 'Writable');

      var def = self.$$proto, $scope = self.$$scope;

      Opal.defn(self, '$<<', function(string) {
        var self = this;

        self.$write(string);
        return self;
      });

      Opal.defn(self, '$print', function() {
        var $a, $b, TMP_1, self = this, $splat_index = nil;
        if ($gvars[","] == null) $gvars[","] = nil;

        var array_size = arguments.length - 0;
        if(array_size < 0) array_size = 0;
        var args = new Array(array_size);
        for($splat_index = 0; $splat_index < array_size; $splat_index++) {
          args[$splat_index] = arguments[$splat_index + 0];
        }
        self.$write(($a = ($b = args).$map, $a.$$p = (TMP_1 = function(arg){var self = TMP_1.$$s || this;
if (arg == null) arg = nil;
        return self.$String(arg)}, TMP_1.$$s = self, TMP_1), $a).call($b).$join($gvars[","]));
        return nil;
      });

      Opal.defn(self, '$puts', function() {
        var $a, $b, TMP_2, self = this, newline = nil, $splat_index = nil;
        if ($gvars["/"] == null) $gvars["/"] = nil;

        var array_size = arguments.length - 0;
        if(array_size < 0) array_size = 0;
        var args = new Array(array_size);
        for($splat_index = 0; $splat_index < array_size; $splat_index++) {
          args[$splat_index] = arguments[$splat_index + 0];
        }
        newline = $gvars["/"];
        if ((($a = args['$empty?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.$write($gvars["/"])
          } else {
          self.$write(($a = ($b = args).$map, $a.$$p = (TMP_2 = function(arg){var self = TMP_2.$$s || this;
if (arg == null) arg = nil;
          return self.$String(arg).$chomp()}, TMP_2.$$s = self, TMP_2), $a).call($b).$concat([nil]).$join(newline))
        }
        return nil;
      });
    })($scope.base);

    return (function($base) {
      var $Readable, self = $Readable = $module($base, 'Readable');

      var def = self.$$proto, $scope = self.$$scope;

      Opal.defn(self, '$readbyte', function() {
        var self = this;

        return self.$getbyte();
      });

      Opal.defn(self, '$readchar', function() {
        var self = this;

        return self.$getc();
      });

      Opal.defn(self, '$readline', function(sep) {
        var self = this;
        if ($gvars["/"] == null) $gvars["/"] = nil;

        if (sep == null) {
          sep = $gvars["/"]
        }
        return self.$raise($scope.get('NotImplementedError'));
      });

      Opal.defn(self, '$readpartial', function(integer, outbuf) {
        var self = this;

        if (outbuf == null) {
          outbuf = nil
        }
        return self.$raise($scope.get('NotImplementedError'));
      });
    })($scope.base);
  })($scope.base, null);
  Opal.cdecl($scope, 'STDERR', $gvars.stderr = $scope.get('IO').$new());
  Opal.cdecl($scope, 'STDIN', $gvars.stdin = $scope.get('IO').$new());
  Opal.cdecl($scope, 'STDOUT', $gvars.stdout = $scope.get('IO').$new());
  (($a = [typeof(process) === 'object' ? function(s){process.stdout.write(s)} : function(s){console.log(s)}]), $b = $scope.get('STDOUT'), $b['$write_proc='].apply($b, $a), $a[$a.length-1]);
  (($a = [typeof(process) === 'object' ? function(s){process.stderr.write(s)} : function(s){console.warn(s)}]), $b = $scope.get('STDERR'), $b['$write_proc='].apply($b, $a), $a[$a.length-1]);
  $scope.get('STDOUT').$extend((($scope.get('IO')).$$scope.get('Writable')));
  return $scope.get('STDERR').$extend((($scope.get('IO')).$$scope.get('Writable')));
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/main"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice;

  Opal.add_stubs(['$include']);
  Opal.defs(self, '$to_s', function() {
    var self = this;

    return "main";
  });
  return (Opal.defs(self, '$include', function(mod) {
    var self = this;

    return $scope.get('Object').$include(mod);
  }), nil) && 'include';
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/dir"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$[]']);
  return (function($base, $super) {
    function $Dir(){}
    var self = $Dir = $klass($base, $super, 'Dir', $Dir);

    var def = self.$$proto, $scope = self.$$scope;

    return (function(self) {
      var $scope = self.$$scope, def = self.$$proto, TMP_1;

      Opal.defn(self, '$chdir', TMP_1 = function(dir) {
        var $a, self = this, $iter = TMP_1.$$p, $yield = $iter || nil, prev_cwd = nil;

        TMP_1.$$p = null;
        try {
        prev_cwd = Opal.current_dir;
        Opal.current_dir = dir;
        return $a = Opal.yieldX($yield, []), $a === $breaker ? $a : $a;
        } finally {
        Opal.current_dir = prev_cwd;
        }
      });
      Opal.defn(self, '$pwd', function() {
        var self = this;

        return Opal.current_dir || '.';
      });
      Opal.alias(self, 'getwd', 'pwd');
      return (Opal.defn(self, '$home', function() {
        var $a, self = this;

        return ((($a = $scope.get('ENV')['$[]']("HOME")) !== false && $a !== nil) ? $a : ".");
      }), nil) && 'home';
    })(Opal.get_singleton_class(self))
  })($scope.base, null)
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/file"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $range = Opal.range;

  Opal.add_stubs(['$join', '$compact', '$split', '$==', '$first', '$[]=', '$home', '$each', '$pop', '$<<', '$[]', '$gsub', '$find', '$=~']);
  return (function($base, $super) {
    function $File(){}
    var self = $File = $klass($base, $super, 'File', $File);

    var def = self.$$proto, $scope = self.$$scope;

    Opal.cdecl($scope, 'Separator', Opal.cdecl($scope, 'SEPARATOR', "/"));

    Opal.cdecl($scope, 'ALT_SEPARATOR', nil);

    Opal.cdecl($scope, 'PATH_SEPARATOR', ":");

    return (function(self) {
      var $scope = self.$$scope, def = self.$$proto;

      Opal.defn(self, '$expand_path', function(path, basedir) {
        var $a, $b, TMP_1, self = this, parts = nil, new_parts = nil;

        if (basedir == null) {
          basedir = nil
        }
        path = [basedir, path].$compact().$join($scope.get('SEPARATOR'));
        parts = path.$split($scope.get('SEPARATOR'));
        new_parts = [];
        if (parts.$first()['$==']("~")) {
          parts['$[]='](0, $scope.get('Dir').$home())}
        ($a = ($b = parts).$each, $a.$$p = (TMP_1 = function(part){var self = TMP_1.$$s || this;
if (part == null) part = nil;
        if (part['$==']("..")) {
            return new_parts.$pop()
            } else {
            return new_parts['$<<'](part)
          }}, TMP_1.$$s = self, TMP_1), $a).call($b);
        return new_parts.$join($scope.get('SEPARATOR'));
      });
      Opal.alias(self, 'realpath', 'expand_path');
      Opal.defn(self, '$dirname', function(path) {
        var self = this;

        return self.$split(path)['$[]']($range(0, -2, false));
      });
      Opal.defn(self, '$basename', function(path) {
        var self = this;

        return self.$split(path)['$[]'](-1);
      });
      Opal.defn(self, '$exist?', function(path) {
        var self = this;

        return Opal.modules[path] != null;
      });
      Opal.alias(self, 'exists?', 'exist?');
      Opal.defn(self, '$directory?', function(path) {
        var $a, $b, TMP_2, self = this, files = nil, file = nil;

        files = [];
        
        for (var key in Opal.modules) {
          files.push(key)
        }

        path = path.$gsub((new RegExp("(^." + $scope.get('SEPARATOR') + "+|" + $scope.get('SEPARATOR') + "+$)")));
        file = ($a = ($b = files).$find, $a.$$p = (TMP_2 = function(file){var self = TMP_2.$$s || this;
if (file == null) file = nil;
        return file['$=~']((new RegExp("^" + path)))}, TMP_2.$$s = self, TMP_2), $a).call($b);
        return file;
      });
      Opal.defn(self, '$join', function() {
        var self = this, $splat_index = nil;

        var array_size = arguments.length - 0;
        if(array_size < 0) array_size = 0;
        var paths = new Array(array_size);
        for($splat_index = 0; $splat_index < array_size; $splat_index++) {
          paths[$splat_index] = arguments[$splat_index + 0];
        }
        return paths.$join($scope.get('SEPARATOR')).$gsub((new RegExp("" + $scope.get('SEPARATOR') + "+")), $scope.get('SEPARATOR'));
      });
      return (Opal.defn(self, '$split', function(path) {
        var self = this;

        return path.$split($scope.get('SEPARATOR'));
      }), nil) && 'split';
    })(Opal.get_singleton_class(self));
  })($scope.base, $scope.get('IO'))
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/process"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass;

  Opal.add_stubs(['$to_f', '$now', '$new']);
  (function($base, $super) {
    function $Process(){}
    var self = $Process = $klass($base, $super, 'Process', $Process);

    var def = self.$$proto, $scope = self.$$scope;

    Opal.cdecl($scope, 'CLOCK_REALTIME', 0);

    Opal.cdecl($scope, 'CLOCK_MONOTONIC', 1);

    Opal.defs(self, '$pid', function() {
      var self = this;

      return 0;
    });

    Opal.defs(self, '$times', function() {
      var self = this, t = nil;

      t = $scope.get('Time').$now().$to_f();
      return (($scope.get('Benchmark')).$$scope.get('Tms')).$new(t, t, t, t, t);
    });

    return (Opal.defs(self, '$clock_gettime', function(clock_id, unit) {
      var self = this;

      if (unit == null) {
        unit = nil
      }
      return $scope.get('Time').$now().$to_f();
    }), nil) && 'clock_gettime';
  })($scope.base, null);
  (function($base, $super) {
    function $Signal(){}
    var self = $Signal = $klass($base, $super, 'Signal', $Signal);

    var def = self.$$proto, $scope = self.$$scope;

    return (Opal.defs(self, '$trap', function() {
      var self = this;

      return nil;
    }), nil) && 'trap'
  })($scope.base, null);
  return (function($base, $super) {
    function $GC(){}
    var self = $GC = $klass($base, $super, 'GC', $GC);

    var def = self.$$proto, $scope = self.$$scope;

    return (Opal.defs(self, '$start', function() {
      var self = this;

      return nil;
    }), nil) && 'start'
  })($scope.base, null);
};

/* Generated by Opal 0.9.2 */
Opal.modules["corelib/unsupported"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $module = Opal.module;

  Opal.add_stubs(['$warn', '$raise', '$%', '$module_function']);
  
  var warnings = {};

  function warn(string) {
    if (warnings[string]) {
      return;
    }

    warnings[string] = true;
    self.$warn(string);
  }

  (function($base, $super) {
    function $String(){}
    var self = $String = $klass($base, $super, 'String', $String);

    var def = self.$$proto, $scope = self.$$scope;

    var ERROR = "String#%s not supported. Mutable String methods are not supported in Opal.";

    Opal.defn(self, '$<<', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("<<"));
    });

    Opal.defn(self, '$capitalize!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("capitalize!"));
    });

    Opal.defn(self, '$chomp!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("chomp!"));
    });

    Opal.defn(self, '$chop!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("chop!"));
    });

    Opal.defn(self, '$downcase!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("downcase!"));
    });

    Opal.defn(self, '$gsub!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("gsub!"));
    });

    Opal.defn(self, '$lstrip!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("lstrip!"));
    });

    Opal.defn(self, '$next!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("next!"));
    });

    Opal.defn(self, '$reverse!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("reverse!"));
    });

    Opal.defn(self, '$slice!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("slice!"));
    });

    Opal.defn(self, '$squeeze!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("squeeze!"));
    });

    Opal.defn(self, '$strip!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("strip!"));
    });

    Opal.defn(self, '$sub!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("sub!"));
    });

    Opal.defn(self, '$succ!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("succ!"));
    });

    Opal.defn(self, '$swapcase!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("swapcase!"));
    });

    Opal.defn(self, '$tr!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("tr!"));
    });

    Opal.defn(self, '$tr_s!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("tr_s!"));
    });

    return (Opal.defn(self, '$upcase!', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), (ERROR)['$%']("upcase!"));
    }), nil) && 'upcase!';
  })($scope.base, null);
  (function($base) {
    var $Kernel, self = $Kernel = $module($base, 'Kernel');

    var def = self.$$proto, $scope = self.$$scope;

    var ERROR = "Object freezing is not supported by Opal";

    Opal.defn(self, '$freeze', function() {
      var $a, self = this;

      if ((($a = OPAL_CONFIG.freezing) !== nil && (!$a.$$is_boolean || $a == true))) {
        warn(ERROR);
        } else {
        self.$raise($scope.get('NotImplementedError'), ERROR)
      }
      return self;
    });

    Opal.defn(self, '$frozen?', function() {
      var $a, self = this;

      if ((($a = OPAL_CONFIG.freezing) !== nil && (!$a.$$is_boolean || $a == true))) {
        warn(ERROR);
        } else {
        self.$raise($scope.get('NotImplementedError'), ERROR)
      }
      return false;
    });
  })($scope.base);
  (function($base) {
    var $Kernel, self = $Kernel = $module($base, 'Kernel');

    var def = self.$$proto, $scope = self.$$scope;

    var ERROR = "Object tainting is not supported by Opal";

    Opal.defn(self, '$taint', function() {
      var $a, self = this;

      if ((($a = OPAL_CONFIG.tainting) !== nil && (!$a.$$is_boolean || $a == true))) {
        warn(ERROR);
        } else {
        self.$raise($scope.get('NotImplementedError'), ERROR)
      }
      return self;
    });

    Opal.defn(self, '$untaint', function() {
      var $a, self = this;

      if ((($a = OPAL_CONFIG.tainting) !== nil && (!$a.$$is_boolean || $a == true))) {
        warn(ERROR);
        } else {
        self.$raise($scope.get('NotImplementedError'), ERROR)
      }
      return self;
    });

    Opal.defn(self, '$tainted?', function() {
      var $a, self = this;

      if ((($a = OPAL_CONFIG.tainting) !== nil && (!$a.$$is_boolean || $a == true))) {
        warn(ERROR);
        } else {
        self.$raise($scope.get('NotImplementedError'), ERROR)
      }
      return false;
    });
  })($scope.base);
  (function($base) {
    var $Marshal, self = $Marshal = $module($base, 'Marshal');

    var def = self.$$proto, $scope = self.$$scope;

    var ERROR = "Marshalling is not supported by Opal";

    self.$module_function();

    Opal.defn(self, '$dump', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), ERROR);
    });

    Opal.defn(self, '$load', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), ERROR);
    });

    Opal.defn(self, '$restore', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), ERROR);
    });
  })($scope.base);
  (function($base, $super) {
    function $Module(){}
    var self = $Module = $klass($base, $super, 'Module', $Module);

    var def = self.$$proto, $scope = self.$$scope;

    Opal.defn(self, '$public', function() {
      var self = this, $splat_index = nil;

      var array_size = arguments.length - 0;
      if(array_size < 0) array_size = 0;
      var methods = new Array(array_size);
      for($splat_index = 0; $splat_index < array_size; $splat_index++) {
        methods[$splat_index] = arguments[$splat_index + 0];
      }
      
      if (methods.length === 0) {
        self.$$module_function = false;
      }

      return nil;
    
    });

    Opal.alias(self, 'private', 'public');

    Opal.alias(self, 'protected', 'public');

    Opal.alias(self, 'nesting', 'public');

    Opal.defn(self, '$private_class_method', function() {
      var self = this;

      return self;
    });

    Opal.alias(self, 'public_class_method', 'private_class_method');

    Opal.defn(self, '$private_method_defined?', function(obj) {
      var self = this;

      return false;
    });

    Opal.defn(self, '$private_constant', function() {
      var self = this;

      return nil;
    });

    Opal.alias(self, 'protected_method_defined?', 'private_method_defined?');

    Opal.alias(self, 'public_instance_methods', 'instance_methods');

    return Opal.alias(self, 'public_method_defined?', 'method_defined?');
  })($scope.base, null);
  (function($base) {
    var $Kernel, self = $Kernel = $module($base, 'Kernel');

    var def = self.$$proto, $scope = self.$$scope;

    Opal.defn(self, '$private_methods', function() {
      var self = this;

      return [];
    });

    Opal.alias(self, 'private_instance_methods', 'private_methods');
  })($scope.base);
  return (function($base) {
    var $Kernel, self = $Kernel = $module($base, 'Kernel');

    var def = self.$$proto, $scope = self.$$scope;

    Opal.defn(self, '$eval', function() {
      var self = this;

      return self.$raise($scope.get('NotImplementedError'), "To use Kernel#eval, you must first require 'opal-parser'. " + ("See https://github.com/opal/opal/blob/" + ($scope.get('RUBY_ENGINE_VERSION')) + "/docs/opal_parser.md for details."));
    })
  })($scope.base);
};

/* Generated by Opal 0.9.2 */
(function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice;

  Opal.add_stubs(['$require']);
  self.$require("opal/base");
  self.$require("opal/mini");
  self.$require("corelib/array/inheritance");
  self.$require("corelib/string/inheritance");
  self.$require("corelib/string/encoding");
  self.$require("corelib/math");
  self.$require("corelib/complex");
  self.$require("corelib/rational");
  self.$require("corelib/time");
  self.$require("corelib/struct");
  self.$require("corelib/io");
  self.$require("corelib/main");
  self.$require("corelib/dir");
  self.$require("corelib/file");
  self.$require("corelib/process");
  return self.$require("corelib/unsupported");
})(Opal);

/* Generated by Opal 0.9.2 */
Opal.modules["midilib/info"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module;

  return (function($base) {
    var $MIDI, self = $MIDI = $module($base, 'MIDI');

    var def = self.$$proto, $scope = self.$$scope;

    Opal.cdecl($scope, 'VERSION_MAJOR', 2);

    Opal.cdecl($scope, 'VERSION_MINOR', 0);

    Opal.cdecl($scope, 'VERSION_TWEAK', 5);

    Opal.cdecl($scope, 'Version', "" + ($scope.get('VERSION_MAJOR')) + "." + ($scope.get('VERSION_MINOR')) + "." + ($scope.get('VERSION_TWEAK')));

    Opal.cdecl($scope, 'Copyright', "Copyright (c) 2003-2015 by Jim Menard <jim@jimmenard.com>");
  })($scope.base)
};

/* Generated by Opal 0.9.2 */
Opal.modules["midilib/consts"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module;

  return (function($base) {
    var $MIDI, self = $MIDI = $module($base, 'MIDI');

    var def = self.$$proto, $scope = self.$$scope;

    Opal.cdecl($scope, 'MIDI_CHANNELS', 16);

    Opal.cdecl($scope, 'NOTES_PER_CHANNEL', 128);

    Opal.cdecl($scope, 'META_EVENT', 255);

    Opal.cdecl($scope, 'META_SEQ_NUM', 0);

    Opal.cdecl($scope, 'META_TEXT', 1);

    Opal.cdecl($scope, 'META_COPYRIGHT', 2);

    Opal.cdecl($scope, 'META_SEQ_NAME', 3);

    Opal.cdecl($scope, 'META_INSTRUMENT', 4);

    Opal.cdecl($scope, 'META_LYRIC', 5);

    Opal.cdecl($scope, 'META_MARKER', 6);

    Opal.cdecl($scope, 'META_CUE', 7);

    Opal.cdecl($scope, 'META_MIDI_CHAN_PREFIX', 32);

    Opal.cdecl($scope, 'META_TRACK_END', 47);

    Opal.cdecl($scope, 'META_SET_TEMPO', 81);

    Opal.cdecl($scope, 'META_SMPTE', 84);

    Opal.cdecl($scope, 'META_TIME_SIG', 88);

    Opal.cdecl($scope, 'META_KEY_SIG', 89);

    Opal.cdecl($scope, 'META_SEQ_SPECIF', 127);

    Opal.cdecl($scope, 'NOTE_OFF', 128);

    Opal.cdecl($scope, 'NOTE_ON', 144);

    Opal.cdecl($scope, 'POLY_PRESSURE', 160);

    Opal.cdecl($scope, 'CONTROLLER', 176);

    Opal.cdecl($scope, 'PROGRAM_CHANGE', 192);

    Opal.cdecl($scope, 'CHANNEL_PRESSURE', 208);

    Opal.cdecl($scope, 'PITCH_BEND', 224);

    Opal.cdecl($scope, 'SYSEX', 240);

    Opal.cdecl($scope, 'SONG_POINTER', 242);

    Opal.cdecl($scope, 'SONG_SELECT', 243);

    Opal.cdecl($scope, 'TUNE_REQUEST', 246);

    Opal.cdecl($scope, 'EOX', 247);

    Opal.cdecl($scope, 'CLOCK', 248);

    Opal.cdecl($scope, 'START', 250);

    Opal.cdecl($scope, 'CONTINUE', 251);

    Opal.cdecl($scope, 'STOP', 252);

    Opal.cdecl($scope, 'ACTIVE_SENSE', 254);

    Opal.cdecl($scope, 'SYSTEM_RESET', 255);

    Opal.cdecl($scope, 'CC_MOD_WHEEL', 1);

    Opal.cdecl($scope, 'CC_BREATH_CONTROLLER', 2);

    Opal.cdecl($scope, 'CC_FOOT_CONTROLLER', 4);

    Opal.cdecl($scope, 'CC_PORTAMENTO_TIME', 5);

    Opal.cdecl($scope, 'CC_DATA_ENTRY_MSB', 6);

    Opal.cdecl($scope, 'CC_VOLUME', 7);

    Opal.cdecl($scope, 'CC_BALANCE', 8);

    Opal.cdecl($scope, 'CC_PAN', 10);

    Opal.cdecl($scope, 'CC_EXPRESSION_CONTROLLER', 11);

    Opal.cdecl($scope, 'CC_GEN_PURPOSE_1', 16);

    Opal.cdecl($scope, 'CC_GEN_PURPOSE_2', 17);

    Opal.cdecl($scope, 'CC_GEN_PURPOSE_3', 18);

    Opal.cdecl($scope, 'CC_GEN_PURPOSE_4', 19);

    Opal.cdecl($scope, 'CC_DATA_ENTRY_LSB', 38);

    Opal.cdecl($scope, 'CC_SUSTAIN', 64);

    Opal.cdecl($scope, 'CC_PORTAMENTO', 65);

    Opal.cdecl($scope, 'CC_SUSTENUTO', 66);

    Opal.cdecl($scope, 'CC_SOFT_PEDAL', 67);

    Opal.cdecl($scope, 'CC_HOLD_2', 69);

    Opal.cdecl($scope, 'CC_GEN_PURPOSE_5', 50);

    Opal.cdecl($scope, 'CC_GEN_PURPOSE_6', 51);

    Opal.cdecl($scope, 'CC_GEN_PURPOSE_7', 52);

    Opal.cdecl($scope, 'CC_GEN_PURPOSE_8', 53);

    Opal.cdecl($scope, 'CC_TREMELO_DEPTH', 92);

    Opal.cdecl($scope, 'CC_CHORUS_DEPTH', 93);

    Opal.cdecl($scope, 'CC_DETUNE_DEPTH', 94);

    Opal.cdecl($scope, 'CC_PHASER_DEPTH', 95);

    Opal.cdecl($scope, 'CC_DATA_INCREMENT', 96);

    Opal.cdecl($scope, 'CC_DATA_DECREMENT', 97);

    Opal.cdecl($scope, 'CC_NREG_PARAM_LSB', 98);

    Opal.cdecl($scope, 'CC_NREG_PARAM_MSB', 99);

    Opal.cdecl($scope, 'CC_REG_PARAM_LSB', 100);

    Opal.cdecl($scope, 'CC_REG_PARAM_MSB', 101);

    Opal.cdecl($scope, 'CM_LOCAL_CONTROL', 122);

    Opal.cdecl($scope, 'CM_ALL_NOTES_OFF', 123);

    Opal.cdecl($scope, 'CM_OMNI_MODE_OFF', 124);

    Opal.cdecl($scope, 'CM_OMNI_MODE_ON', 125);

    Opal.cdecl($scope, 'CM_MONO_MODE_ON', 126);

    Opal.cdecl($scope, 'CM_POLY_MODE_ON', 127);

    Opal.cdecl($scope, 'CONTROLLER_NAMES', ["0", "Modulation", "Breath Control", "3", "Foot Controller", "Portamento Time", "Data Entry", "Volume", "Balance", "9", "Pan", "Expression Control", "12", "13", "14", "15", "General Controller 1", "General Controller 2", "General Controller 3", "General Controller 4", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "63", "Sustain Pedal", "Portamento", "Sostenuto", "Soft Pedal", "68", "Hold 2", "70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "General Controller 5", "Tempo Change", "General Controller 7", "General Controller 8", "84", "85", "86", "87", "88", "89", "90", "External Effects Depth", "Tremolo Depth", "Chorus Depth", "Detune (Celeste) Depth", "Phaser Depth", "Data Increment", "Data Decrement", "Non-Registered Param LSB", "Non-Registered Param MSB", "Registered Param LSB", "Registered Param MSB", "102", "103", "104", "105", "106", "107", "108", "109", "110", "111", "112", "113", "114", "115", "116", "117", "118", "119", "120", "Reset All Controllers", "Local Control", "All Notes Off", "Omni Mode Off", "Omni Mode On", "Mono Mode On", "Poly Mode On"]);

    Opal.cdecl($scope, 'GM_PATCH_NAMES', ["Acoustic Grand Piano", "Bright Acoustic Piano", "Electric Grand Piano", "Honky-tonk Piano", "Electric Piano 1", "Electric Piano 2", "Harpsichord", "Clavichord", "Celesta", "Glockenspiel", "Music Box", "Vibraphone", "Marimba", "Xylophone", "Tubular Bells", "Dulcimer", "Drawbar Organ", "Percussive Organ", "Rock Organ", "Church Organ", "Reed Organ", "Accordion", "Harmonica", "Tango Accordion", "Acoustic Guitar (nylon)", "Acoustic Guitar (steel)", "Electric Guitar (jazz)", "Electric Guitar (clean)", "Electric Guitar (muted)", "Overdriven Guitar", "Distortion Guitar", "Guitar harmonics", "Acoustic Bass", "Electric Bass (finger)", "Electric Bass (pick)", "Fretless Bass", "Slap Bass 1", "Slap Bass 2", "Synth Bass 1", "Synth Bass 2", "Violin", "Viola", "Cello", "Contrabass", "Tremolo Strings", "Pizzicato Strings", "Orchestral Harp", "Timpani", "String Ensemble 1", "String Ensemble 2", "SynthStrings 1", "SynthStrings 2", "Choir Aahs", "Voice Oohs", "Synth Voice", "Orchestra Hit", "Trumpet", "Trombone", "Tuba", "Muted Trumpet", "French Horn", "Brass Section", "SynthBrass 1", "SynthBrass 2", "Soprano Sax", "Alto Sax", "Tenor Sax", "Baritone Sax", "Oboe", "English Horn", "Bassoon", "Clarinet", "Piccolo", "Flute", "Recorder", "Pan Flute", "Blown Bottle", "Shakuhachi", "Whistle", "Ocarina", "Lead 1 (square)", "Lead 2 (sawtooth)", "Lead 3 (calliope)", "Lead 4 (chiff)", "Lead 5 (charang)", "Lead 6 (voice)", "Lead 7 (fifths)", "Lead 8 (bass + lead)", "Pad 1 (new age)", "Pad 2 (warm)", "Pad 3 (polysynth)", "Pad 4 (choir)", "Pad 5 (bowed)", "Pad 6 (metallic)", "Pad 7 (halo)", "Pad 8 (sweep)", "FX 1 (rain)", "FX 2 (soundtrack)", "FX 3 (crystal)", "FX 4 (atmosphere)", "FX 5 (brightness)", "FX 6 (goblins)", "FX 7 (echoes)", "FX 8 (sci-fi)", "Sitar", "Banjo", "Shamisen", "Koto", "Kalimba", "Bag pipe", "Fiddle", "Shanai", "Tinkle Bell", "Agogo", "Steel Drums", "Woodblock", "Taiko Drum", "Melodic Tom", "Synth Drum", "Reverse Cymbal", "Guitar Fret Noise", "Breath Noise", "Seashore", "Bird Tweet", "Telephone Ring", "Helicopter", "Applause", "Gunshot"]);

    Opal.cdecl($scope, 'GM_DRUM_NOTE_LOWEST', 35);

    Opal.cdecl($scope, 'GM_DRUM_NOTE_NAMES', ["Acoustic Bass Drum", "Bass Drum 1", "Side Stick", "Acoustic Snare", "Hand Clap", "Electric Snare", "Low Floor Tom", "Closed Hi Hat", "High Floor Tom", "Pedal Hi-Hat", "Low Tom", "Open Hi-Hat", "Low-Mid Tom", "Hi Mid Tom", "Crash Cymbal 1", "High Tom", "Ride Cymbal 1", "Chinese Cymbal", "Ride Bell", "Tambourine", "Splash Cymbal", "Cowbell", "Crash Cymbal 2", "Vibraslap", "Ride Cymbal 2", "Hi Bongo", "Low Bongo", "Mute Hi Conga", "Open Hi Conga", "Low Conga", "High Timbale", "Low Timbale", "High Agogo", "Low Agogo", "Cabasa", "Maracas", "Short Whistle", "Long Whistle", "Short Guiro", "Long Guiro", "Claves", "Hi Wood Block", "Low Wood Block", "Mute Cuica", "Open Cuica", "Mute Triangle", "Open Triangle"]);
  })($scope.base)
};

/* Generated by Opal 0.9.2 */
Opal.modules["midilib/io/midifile"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  function $rb_le(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs <= rhs : lhs['$<='](rhs);
  }
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  var $a, self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $klass = Opal.klass, $module = Opal.module, $range = Opal.range;

  Opal.add_stubs(['$require', '$<', '$getc', '$raise', '$attr_accessor', '$nil?', '$error', '$read_header', '$<=', '$times', '$read_track', '$-', '$readbyte', '$<<', '$tell', '$name', '$class', '$%', '$get_bytes', '$+', '$length', '$s', '$==', '$index', '$[]', '$join', '$collect', '$chr', '$read_mt_header_string', '$read32', '$read16', '$header', '$>', '$start_track', '$read_var_len', '$dup', '$!=', '$zero?', '$&', '$>>', '$nonzero?', '$chan_message', '$===', '$msg_init', '$msg_read', '$meta_event', '$msg_add', '$!', '$handle_sysex', '$msg', '$handle_arbitrary', '$bad_byte', '$end_track', '$sprintf', '$flatten!', '$sequence_number', '$text', '$eot', '$tempo', '$smpte', '$time_signature', '$key_signature', '$sequencer_specific', '$meta_misc', '$note_off', '$note_on', '$pressure', '$controller', '$pitch_bend', '$program', '$chan_pressure', '$sysex', '$arbitrary', '$-@', '$|', '$putc', '$each', '$reverse']);
  self.$require("midilib/consts");
  if ((($a = $rb_lt($scope.get('RUBY_VERSION'), "1.9")) !== nil && (!$a.$$is_boolean || $a == true))) {
    (function($base, $super) {
      function $IO(){}
      var self = $IO = $klass($base, $super, 'IO', $IO);

      var def = self.$$proto, $scope = self.$$scope;

      return (Opal.defn(self, '$readbyte', function() {
        var self = this, c = nil;

        c = self.$getc();
        if (c !== false && c !== nil) {
          } else {
          self.$raise("unexpected EOF")
        }
        return c;
      }), nil) && 'readbyte'
    })($scope.base, null)}
  return (function($base) {
    var $MIDI, self = $MIDI = $module($base, 'MIDI');

    var def = self.$$proto, $scope = self.$$scope;

    (function($base) {
      var $IO, self = $IO = $module($base, 'IO');

      var def = self.$$proto, $scope = self.$$scope;

      (function($base, $super) {
        function $MIDIFile(){}
        var self = $MIDIFile = $klass($base, $super, 'MIDIFile', $MIDIFile);

        var def = self.$$proto, $scope = self.$$scope;

        def.bytes_to_be_read = def.io = def.skip_init = def.ticks_so_far = def.curr_ticks = def.raw_var_num_data = def.no_merge = def.raw_data = def.msg_buf = nil;
        Opal.cdecl($scope, 'MThd_BYTE_ARRAY', [77, 84, 104, 100]);

        Opal.cdecl($scope, 'MTrk_BYTE_ARRAY', [77, 84, 114, 107]);

        Opal.cdecl($scope, 'NUM_DATA_BYTES', [0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 1, 1, 2, 0]);

        self.$attr_accessor("curr_ticks");

        self.$attr_accessor("ticks_so_far");

        self.$attr_accessor("bytes_to_be_read");

        self.$attr_accessor("no_merge");

        self.$attr_accessor("skip_init");

        self.$attr_accessor("raw_time_stamp_data");

        self.$attr_accessor("raw_var_num_data");

        self.$attr_accessor("raw_data");

        Opal.defn(self, '$initialize', function() {
          var self = this;

          self.no_merge = false;
          self.skip_init = true;
          self.io = nil;
          self.bytes_to_be_read = 0;
          return self.msg_buf = nil;
        });

        Opal.defn(self, '$read_from', function(io) {
          var $a, $b, TMP_1, self = this, ntrks = nil;

          if ((($a = io['$nil?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
            self.$error("must specify non-nil input stream")}
          self.io = io;
          ntrks = self.$read_header();
          if ((($a = $rb_le(ntrks, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
            self.$error("No tracks!")}
          return ($a = ($b = ntrks).$times, $a.$$p = (TMP_1 = function(){var self = TMP_1.$$s || this;

          return self.$read_track()}, TMP_1.$$s = self, TMP_1), $a).call($b);
        });

        Opal.defn(self, '$getc', function() {
          var self = this;

          self.bytes_to_be_read = $rb_minus(self.bytes_to_be_read, 1);
          return self.io.$readbyte();
        });

        Opal.defn(self, '$get_bytes', function(n) {
          var $a, $b, TMP_2, self = this, buf = nil;

          buf = [];
          ($a = ($b = n).$times, $a.$$p = (TMP_2 = function(){var self = TMP_2.$$s || this;

          return buf['$<<'](self.$getc())}, TMP_2.$$s = self, TMP_2), $a).call($b);
          return buf;
        });

        Opal.defn(self, '$error', function(str) {
          var self = this, loc = nil;

          loc = $rb_minus(self.io.$tell(), 1);
          return self.$raise("" + (self.$class().$name()) + " error at byte " + (loc) + " (0x" + ("%02x"['$%'](loc)) + "): " + (str));
        });

        Opal.defn(self, '$header', function(format, ntrks, division) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$start_track', function(bytes_to_be_read) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$end_track', function() {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$note_on', function(chan, note, vel) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$note_off', function(chan, note, vel) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$pressure', function(chan, note, press) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$controller', function(chan, control, value) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$pitch_bend', function(chan, msb, lsb) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$program', function(chan, program) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$chan_pressure', function(chan, press) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$sysex', function(msg) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$meta_misc', function(type, msg) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$sequencer_specific', function(type, msg) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$sequence_number', function(num) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$text', function(type, msg) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$eot', function() {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$time_signature', function(numer, denom, clocks, qnotes) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$smpte', function(hour, min, sec, frame, fract) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$tempo', function(microsecs) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$key_signature', function(sharpflat, is_minor) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$arbitrary', function(msg) {
          var self = this;

          return nil;
        });

        Opal.defn(self, '$read_mt_header_string', function(bytes, skip) {
          var $a, $b, $c, TMP_3, self = this, b = nil, bytes_to_read = nil, data = nil, i = nil;

          b = [];
          bytes_to_read = 4;
          while ((($b = true) !== nil && (!$b.$$is_boolean || $b == true))) {
          data = self.$get_bytes(bytes_to_read);
          b = $rb_plus(b, data);
          if ((($b = $rb_lt(b.$length(), 4)) !== nil && (!$b.$$is_boolean || $b == true))) {
            self.$error("unexpected EOF while trying to read header string " + (self.$s()))}
          if (b['$=='](bytes)) {
            return nil}
          if (skip !== false && skip !== nil) {
            i = b['$[]']($range(1, -1, false)).$index(bytes['$[]'](0));
            if ((($b = i['$nil?']()) !== nil && (!$b.$$is_boolean || $b == true))) {
              b = [];
              bytes_to_read = 4;
              } else {
              b = b['$[]']($range(i, -1, false));
              bytes_to_read = $rb_minus(4, i);
            }
            } else {
            self.$error("header string " + (($b = ($c = bytes).$collect, $b.$$p = (TMP_3 = function(b){var self = TMP_3.$$s || this;
if (b == null) b = nil;
            return b.$chr()}, TMP_3.$$s = self, TMP_3), $b).call($c).$join()) + " not found")
          }}
        });

        Opal.defn(self, '$read_header', function() {
          var $a, self = this, format = nil, ntrks = nil, division = nil;

          self.bytes_to_be_read = 0;
          self.$read_mt_header_string($scope.get('MThd_BYTE_ARRAY'), self.skip_init);
          self.bytes_to_be_read = self.$read32();
          format = self.$read16();
          ntrks = self.$read16();
          division = self.$read16();
          self.$header(format, ntrks, division);
          if ((($a = $rb_gt(self.bytes_to_be_read, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
            self.$get_bytes(self.bytes_to_be_read);
            self.bytes_to_be_read = 0;}
          return ntrks;
        });

        Opal.defn(self, '$read_track', function() {
          var $a, $b, $c, self = this, c = nil, c1 = nil, type = nil, needed = nil, sysex_continue = nil, running = nil, status = nil, $case = nil;

          c = c1 = type = needed = 0;
          sysex_continue = false;
          running = false;
          status = 0;
          self.bytes_to_be_read = 0;
          self.$read_mt_header_string($scope.get('MTrk_BYTE_ARRAY'), false);
          self.bytes_to_be_read = self.$read32();
          self.curr_ticks = self.ticks_so_far = 0;
          self.$start_track();
          while ((($b = $rb_gt(self.bytes_to_be_read, 0)) !== nil && (!$b.$$is_boolean || $b == true))) {
          self.curr_ticks = self.$read_var_len();
          self.ticks_so_far = $rb_plus(self.ticks_so_far, self.curr_ticks);
          self.raw_time_stamp_data = self.raw_var_num_data.$dup();
          c = self.$getc();
          if ((($b = (($c = sysex_continue !== false && sysex_continue !== nil) ? c['$!=']($scope.get('EOX')) : sysex_continue)) !== nil && (!$b.$$is_boolean || $b == true))) {
            self.$error("didn't find expected continuation of a sysex")}
          if ((($b = (c['$&'](128))['$zero?']()) !== nil && (!$b.$$is_boolean || $b == true))) {
            if ((($b = status['$zero?']()) !== nil && (!$b.$$is_boolean || $b == true))) {
              self.$error("unexpected running status")}
            running = true;
            } else {
            status = c;
            running = false;
          }
          needed = $scope.get('NUM_DATA_BYTES')['$[]']((status['$>>'](4))['$&'](15));
          if ((($b = needed['$nonzero?']()) !== nil && (!$b.$$is_boolean || $b == true))) {
            c1 = (function() {if (running !== false && running !== nil) {
              return c
              } else {
              return (self.$getc()['$&'](127))
            } return nil; })();
            self.$chan_message(running, status, c1, (function() {if ((($b = ($rb_gt(needed, 1))) !== nil && (!$b.$$is_boolean || $b == true))) {
              return (self.$getc()['$&'](127))
              } else {
              return 0
            } return nil; })());
            continue;}
          $case = c;if ($scope.get('META_EVENT')['$===']($case)) {type = self.$getc();
          self.$msg_init();
          self.$msg_read(self.$read_var_len());
          self.$meta_event(type);}else if ($scope.get('SYSEX')['$===']($case)) {self.$msg_init();
          self.$msg_add($scope.get('SYSEX'));
          c = self.$msg_read(self.$read_var_len());
          if ((($b = ((($c = c['$==']($scope.get('EOX'))) !== false && $c !== nil) ? $c : self.no_merge['$!']())) !== nil && (!$b.$$is_boolean || $b == true))) {
            self.$handle_sysex(self.$msg())
            } else {
            sysex_continue = true
          }}else if ($scope.get('EOX')['$===']($case)) {if ((($b = sysex_continue['$!']()) !== nil && (!$b.$$is_boolean || $b == true))) {
            self.$msg_init()}
          c = self.$msg_read(self.$read_var_len());
          if ((($b = sysex_continue['$!']()) !== nil && (!$b.$$is_boolean || $b == true))) {
            self.$handle_arbitrary(self.$msg())
          } else if (c['$==']($scope.get('EOX'))) {
            self.$handle_sysex(self.$msg());
            sysex_continue = false;}}else {self.$bad_byte(c)}}
          return self.$end_track();
        });

        Opal.defn(self, '$bad_byte', function(c) {
          var self = this;

          return self.$error(self.$sprintf("unexpected byte: 0x%02x", c));
        });

        Opal.defn(self, '$meta_event', function(type) {
          var self = this, m = nil, $case = nil;

          m = self.$msg();
          self.raw_data = [];
          self.raw_data['$<<']($scope.get('META_EVENT'));
          self.raw_data['$<<'](type);
          self.raw_data['$<<'](self.raw_var_num_data);
          self.raw_data['$<<'](m);
          self.raw_data['$flatten!']();
          return (function() {$case = type;if ($scope.get('META_SEQ_NUM')['$===']($case)) {return self.$sequence_number($rb_plus((m['$[]'](0)['$<<'](8)), m['$[]'](1)))}else if ($scope.get('META_TEXT')['$===']($case) || $scope.get('META_COPYRIGHT')['$===']($case) || $scope.get('META_SEQ_NAME')['$===']($case) || $scope.get('META_INSTRUMENT')['$===']($case) || $scope.get('META_LYRIC')['$===']($case) || $scope.get('META_MARKER')['$===']($case) || $scope.get('META_CUE')['$===']($case) || (8)['$===']($case) || (9)['$===']($case) || (10)['$===']($case) || (11)['$===']($case) || (12)['$===']($case) || (13)['$===']($case) || (14)['$===']($case) || (15)['$===']($case)) {return self.$text(type, m)}else if ($scope.get('META_TRACK_END')['$===']($case)) {return self.$eot()}else if ($scope.get('META_SET_TEMPO')['$===']($case)) {return self.$tempo($rb_plus($rb_plus((m['$[]'](0)['$<<'](16)), (m['$[]'](1)['$<<'](8))), m['$[]'](2)))}else if ($scope.get('META_SMPTE')['$===']($case)) {return self.$smpte(m['$[]'](0), m['$[]'](1), m['$[]'](2), m['$[]'](3), m['$[]'](4))}else if ($scope.get('META_TIME_SIG')['$===']($case)) {return self.$time_signature(m['$[]'](0), m['$[]'](1), m['$[]'](2), m['$[]'](3))}else if ($scope.get('META_KEY_SIG')['$===']($case)) {return self.$key_signature(m['$[]'](0), (function() {if (m['$[]'](1)['$=='](0)) {
            return false
            } else {
            return true
          } return nil; })())}else if ($scope.get('META_SEQ_SPECIF')['$===']($case)) {return self.$sequencer_specific(type, m)}else {return self.$meta_misc(type, m)}})();
        });

        Opal.defn(self, '$chan_message', function(running, status, c1, c2) {
          var self = this, chan = nil, $case = nil;

          self.raw_data = [];
          if (running !== false && running !== nil) {
            } else {
            self.raw_data['$<<'](status)
          }
          self.raw_data['$<<'](c1);
          self.raw_data['$<<'](c2);
          chan = status['$&'](15);
          return (function() {$case = (status['$&'](240));if ($scope.get('NOTE_OFF')['$===']($case)) {return self.$note_off(chan, c1, c2)}else if ($scope.get('NOTE_ON')['$===']($case)) {return self.$note_on(chan, c1, c2)}else if ($scope.get('POLY_PRESSURE')['$===']($case)) {return self.$pressure(chan, c1, c2)}else if ($scope.get('CONTROLLER')['$===']($case)) {return self.$controller(chan, c1, c2)}else if ($scope.get('PITCH_BEND')['$===']($case)) {return self.$pitch_bend(chan, c1, c2)}else if ($scope.get('PROGRAM_CHANGE')['$===']($case)) {return self.$program(chan, c1)}else if ($scope.get('CHANNEL_PRESSURE')['$===']($case)) {return self.$chan_pressure(chan, c1)}else {return self.$error("illegal chan message 0x" + ("%02x"['$%']((status['$&'](240)))) + "\n")}})();
        });

        Opal.defn(self, '$handle_sysex', function(msg) {
          var self = this;

          self.raw_data = msg.$dup();
          return self.$sysex(msg);
        });

        Opal.defn(self, '$handle_arbitrary', function(msg) {
          var self = this;

          self.raw_data = msg.$dup();
          return self.$arbitrary(msg);
        });

        Opal.defn(self, '$read16', function() {
          var $a, self = this, val = nil;

          val = $rb_plus((self.$getc()['$<<'](8)), self.$getc());
          if ((($a = (val['$&'](32768))['$nonzero?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
            val = (val['$&'](32767))['$-@']()}
          return val;
        });

        Opal.defn(self, '$read32', function() {
          var $a, self = this, val = nil;

          val = $rb_plus($rb_plus($rb_plus((self.$getc()['$<<'](24)), (self.$getc()['$<<'](16))), (self.$getc()['$<<'](8))), self.$getc());
          if ((($a = (val['$&'](2147483648))['$nonzero?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
            val = (val['$&'](2147483647))['$-@']()}
          return val;
        });

        Opal.defn(self, '$read_var_len', function() {
          var $a, $b, self = this, c = nil, val = nil;

          self.raw_var_num_data = [];
          c = self.$getc();
          self.raw_var_num_data['$<<'](c);
          val = c;
          if ((($a = (val['$&'](128))['$nonzero?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
            val = val['$&'](127);
            while ((($b = true) !== nil && (!$b.$$is_boolean || $b == true))) {
            c = self.$getc();
            self.raw_var_num_data['$<<'](c);
            val = $rb_plus((val['$<<'](7)), (c['$&'](127)));
            if ((($b = (c['$&'](128))['$zero?']()) !== nil && (!$b.$$is_boolean || $b == true))) {
              break;}}}
          return val;
        });

        Opal.defn(self, '$write16', function(val) {
          var $a, self = this;

          if ((($a = $rb_lt(val, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
            val = (val['$-@']())['$|'](32768)}
          self.$putc((val['$>>'](8))['$&'](255));
          return self.$putc(val['$&'](255));
        });

        Opal.defn(self, '$write32', function(val) {
          var $a, self = this;

          if ((($a = $rb_lt(val, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
            val = (val['$-@']())['$|'](2147483648)}
          self.$putc((val['$>>'](24))['$&'](255));
          self.$putc((val['$>>'](16))['$&'](255));
          self.$putc((val['$>>'](8))['$&'](255));
          return self.$putc(val['$&'](255));
        });

        Opal.defn(self, '$write_var_len', function(val) {
          var $a, $b, TMP_4, self = this, buf = nil, value = nil;

          if ((($a = val['$zero?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
            self.$putc(0);
            return nil;}
          buf = [];
          buf['$<<']((val['$&'](127)));
          while ((($b = $rb_gt((value = value['$>>'](7)), 0)) !== nil && (!$b.$$is_boolean || $b == true))) {
          buf['$<<']((val['$&'](127)))['$|'](128)}
          return ($a = ($b = buf.$reverse()).$each, $a.$$p = (TMP_4 = function(b){var self = TMP_4.$$s || this;
if (b == null) b = nil;
          return self.$putc(b)}, TMP_4.$$s = self, TMP_4), $a).call($b);
        });

        Opal.defn(self, '$msg_add', function(c) {
          var self = this;

          return self.msg_buf['$<<'](c);
        });

        Opal.defn(self, '$msg_read', function(n_bytes) {
          var self = this;

          self.msg_buf = $rb_plus(self.msg_buf, self.$get_bytes(n_bytes));
          self.msg_buf['$flatten!']();
          return self.msg_buf['$[]'](-1);
        });

        Opal.defn(self, '$msg_init', function() {
          var self = this;

          return self.msg_buf = [];
        });

        return (Opal.defn(self, '$msg', function() {
          var self = this;

          return self.msg_buf.$dup();
        }), nil) && 'msg';
      })($scope.base, null)
    })($scope.base)
  })($scope.base);
};

/* Generated by Opal 0.9.2 */
Opal.modules["midilib/utils"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module, $klass = Opal.klass;

  Opal.add_stubs(['$%', '$/', '$[]', '$-', '$<<', '$&', '$>>', '$>', '$+', '$reverse!']);
  return (function($base) {
    var $MIDI, self = $MIDI = $module($base, 'MIDI');

    var def = self.$$proto, $scope = self.$$scope;

    (function($base, $super) {
      function $Utils(){}
      var self = $Utils = $klass($base, $super, 'Utils', $Utils);

      var def = self.$$proto, $scope = self.$$scope;

      Opal.cdecl($scope, 'NOTE_NAMES', ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]);

      Opal.defs($scope.get('Utils'), '$note_to_s', function(num) {
        var self = this, note = nil, octave = nil;

        note = num['$%'](12);
        octave = $rb_divide(num, 12);
        return "" + ($scope.get('NOTE_NAMES')['$[]'](note)) + ($rb_minus(octave, 1));
      });

      return (Opal.defs($scope.get('Utils'), '$as_var_len', function(val) {
        var $a, $b, self = this, buffer = nil;

        buffer = [];
        buffer['$<<']((val['$&'](127)));
        val = (val['$>>'](7));
        while ((($b = $rb_gt(val, 0)) !== nil && (!$b.$$is_boolean || $b == true))) {
        buffer['$<<'](($rb_plus(128, (val['$&'](127)))));
        val = (val['$>>'](7));}
        return buffer['$reverse!']();
      }), nil) && 'as_var_len';
    })($scope.base, null)
  })($scope.base)
};

/* Generated by Opal 0.9.2 */
Opal.modules["midilib/event"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_ge(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs >= rhs : lhs['$>='](rhs);
  }
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  function $rb_times(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs * rhs : lhs['$*'](rhs);
  }
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module, $klass = Opal.klass;

  Opal.add_stubs(['$require', '$attr_accessor', '$attr_reader', '$protected', '$raise', '$%', '$-', '$>=', '$/', '$+', '$<=>', '$time_from_start', '$to_s', '$number_to_s', '$<<', '$channel_to_s', '$[]', '$pch_oct', '$note_to_s', '$&', '$>>', '$as_var_len', '$length', '$flatten', '$join', '$collect', '$chr', '$ord', '$split', '$data=', '$bytes_as_str', '$===', '$str_as_bytes', '$data_as_str', '$*', '$to_f', '$mpq_to_bpm', '$**', '$!', '$>', '$minor_key?', '$sharpflat']);
  self.$require("midilib/consts");
  self.$require("midilib/utils");
  return (function($base) {
    var $MIDI, self = $MIDI = $module($base, 'MIDI');

    var def = self.$$proto, $scope = self.$$scope;

    (function($base, $super) {
      function $Event(){}
      var self = $Event = $klass($base, $super, 'Event', $Event);

      var def = self.$$proto, $scope = self.$$scope;

      def.time_from_start = def.print_decimal_numbers = def.print_channel_numbers_from_one = def.delta_time = nil;
      self.$attr_accessor("delta_time");

      self.$attr_accessor("time_from_start");

      self.$attr_reader("status");

      self.$attr_accessor("print_note_names");

      self.$attr_accessor("print_decimal_numbers");

      self.$attr_accessor("print_channel_numbers_from_one");

      Opal.defn(self, '$initialize', function(status, delta_time) {
        var self = this;

        if (status == null) {
          status = 0
        }
        if (delta_time == null) {
          delta_time = 0
        }
        self.status = status;
        self.delta_time = delta_time;
        return self.time_from_start = 0;
      });

      self.$protected("initialize");

      Opal.defn(self, '$data_as_bytes', function() {
        var self = this;

        return self.$raise("subclass responsibility");
      });

      Opal.defn(self, '$quantize_to', function(boundary) {
        var $a, self = this, diff = nil;

        diff = self.time_from_start['$%'](boundary);
        self.time_from_start = $rb_minus(self.time_from_start, diff);
        if ((($a = $rb_ge(diff, $rb_divide(boundary, 2))) !== nil && (!$a.$$is_boolean || $a == true))) {
          return self.time_from_start = $rb_plus(self.time_from_start, boundary)
          } else {
          return nil
        }
      });

      Opal.defn(self, '$<=>', function(an_event) {
        var self = this;

        return self.time_from_start['$<=>'](an_event.$time_from_start());
      });

      Opal.defn(self, '$number_to_s', function(val) {
        var $a, self = this;

        return (function() {if ((($a = self.print_decimal_numbers) !== nil && (!$a.$$is_boolean || $a == true))) {
          return val.$to_s()
          } else {
          return ("%02x"['$%'](val))
        } return nil; })();
      });

      Opal.defn(self, '$channel_to_s', function(val) {
        var $a, self = this;

        if ((($a = self.print_channel_numbers_from_one) !== nil && (!$a.$$is_boolean || $a == true))) {
          val = $rb_plus(val, 1)}
        return self.$number_to_s(val);
      });

      return (Opal.defn(self, '$to_s', function() {
        var self = this;

        return "" + (self.delta_time) + ": ";
      }), nil) && 'to_s';
    })($scope.base, null);

    (function($base, $super) {
      function $ChannelEvent(){}
      var self = $ChannelEvent = $klass($base, $super, 'ChannelEvent', $ChannelEvent);

      var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_2;

      def.channel = nil;
      self.$attr_accessor("channel");

      Opal.defn(self, '$initialize', TMP_1 = function(status, channel, delta_time) {
        var self = this, $iter = TMP_1.$$p, $yield = $iter || nil;

        TMP_1.$$p = null;
        Opal.find_super_dispatcher(self, 'initialize', TMP_1, null).apply(self, [status, delta_time]);
        return self.channel = channel;
      });

      self.$protected("initialize");

      return (Opal.defn(self, '$to_s', TMP_2 = function() {
        var self = this, $iter = TMP_2.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_2.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_2, $iter).apply(self, $zuper)['$<<']("ch " + (self.$channel_to_s(self.channel)) + " ");
      }), nil) && 'to_s';
    })($scope.base, $scope.get('Event'));

    (function($base, $super) {
      function $NoteEvent(){}
      var self = $NoteEvent = $klass($base, $super, 'NoteEvent', $NoteEvent);

      var def = self.$$proto, $scope = self.$$scope, TMP_3;

      def.note = def.print_note_names = def.status = def.channel = def.velocity = nil;
      self.$attr_accessor("note", "velocity");

      Opal.defn(self, '$initialize', TMP_3 = function(status, channel, note, velocity, delta_time) {
        var self = this, $iter = TMP_3.$$p, $yield = $iter || nil;

        TMP_3.$$p = null;
        Opal.find_super_dispatcher(self, 'initialize', TMP_3, null).apply(self, [status, channel, delta_time]);
        self.note = note;
        return self.velocity = velocity;
      });

      self.$protected("initialize");

      Opal.cdecl($scope, 'PITCHES', ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]);

      Opal.defn(self, '$pch_oct', function(val) {
        var self = this, pch = nil, oct = nil;

        if (val == null) {
          val = self.note
        }
        pch = val['$%'](12);
        oct = $rb_minus(($rb_divide(val, 12)), 1);
        return "" + ($scope.get('PITCHES')['$[]'](pch)) + (oct);
      });

      Opal.defn(self, '$note_to_s', function() {
        var $a, self = this;

        return (function() {if ((($a = self.print_note_names) !== nil && (!$a.$$is_boolean || $a == true))) {
          return self.$pch_oct(self.note)
          } else {
          return self.$number_to_s(self.note)
        } return nil; })();
      });

      return (Opal.defn(self, '$data_as_bytes', function() {
        var self = this, data = nil;

        data = [];
        data['$<<'](($rb_plus(self.status, self.channel)));
        data['$<<'](self.note);
        return data['$<<'](self.velocity);
      }), nil) && 'data_as_bytes';
    })($scope.base, $scope.get('ChannelEvent'));

    (function($base, $super) {
      function $NoteOn(){}
      var self = $NoteOn = $klass($base, $super, 'NoteOn', $NoteOn);

      var def = self.$$proto, $scope = self.$$scope, TMP_4, TMP_5;

      def.velocity = nil;
      self.$attr_accessor("off");

      Opal.defn(self, '$initialize', TMP_4 = function(channel, note, velocity, delta_time) {
        var self = this, $iter = TMP_4.$$p, $yield = $iter || nil;

        if (channel == null) {
          channel = 0
        }
        if (note == null) {
          note = 64
        }
        if (velocity == null) {
          velocity = 64
        }
        if (delta_time == null) {
          delta_time = 0
        }
        TMP_4.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_4, null).apply(self, [$scope.get('NOTE_ON'), channel, note, velocity, delta_time]);
      });

      return (Opal.defn(self, '$to_s', TMP_5 = function() {
        var self = this, $iter = TMP_5.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_5.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_5, $iter).apply(self, $zuper)['$<<']("on " + (self.$note_to_s()) + " " + (self.$number_to_s(self.velocity)));
      }), nil) && 'to_s';
    })($scope.base, $scope.get('NoteEvent'));

    Opal.cdecl($scope, 'NoteOnEvent', $scope.get('NoteOn'));

    (function($base, $super) {
      function $NoteOff(){}
      var self = $NoteOff = $klass($base, $super, 'NoteOff', $NoteOff);

      var def = self.$$proto, $scope = self.$$scope, TMP_6, TMP_7;

      def.velocity = nil;
      self.$attr_accessor("on");

      Opal.defn(self, '$initialize', TMP_6 = function(channel, note, velocity, delta_time) {
        var self = this, $iter = TMP_6.$$p, $yield = $iter || nil;

        if (channel == null) {
          channel = 0
        }
        if (note == null) {
          note = 64
        }
        if (velocity == null) {
          velocity = 64
        }
        if (delta_time == null) {
          delta_time = 0
        }
        TMP_6.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_6, null).apply(self, [$scope.get('NOTE_OFF'), channel, note, velocity, delta_time]);
      });

      return (Opal.defn(self, '$to_s', TMP_7 = function() {
        var self = this, $iter = TMP_7.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_7.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_7, $iter).apply(self, $zuper)['$<<']("off " + (self.$note_to_s()) + " " + (self.$number_to_s(self.velocity)));
      }), nil) && 'to_s';
    })($scope.base, $scope.get('NoteEvent'));

    Opal.cdecl($scope, 'NoteOffEvent', $scope.get('NoteOff'));

    (function($base, $super) {
      function $PolyPressure(){}
      var self = $PolyPressure = $klass($base, $super, 'PolyPressure', $PolyPressure);

      var def = self.$$proto, $scope = self.$$scope, TMP_8, TMP_9;

      def.velocity = def.channel = nil;
      Opal.defn(self, '$initialize', TMP_8 = function(channel, note, value, delta_time) {
        var self = this, $iter = TMP_8.$$p, $yield = $iter || nil;

        if (channel == null) {
          channel = 0
        }
        if (note == null) {
          note = 64
        }
        if (value == null) {
          value = 0
        }
        if (delta_time == null) {
          delta_time = 0
        }
        TMP_8.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_8, null).apply(self, [$scope.get('POLY_PRESSURE'), channel, note, value, delta_time]);
      });

      Opal.defn(self, '$pressure', function() {
        var self = this;

        return self.velocity;
      });

      Opal.defn(self, '$pressure=', function(val) {
        var self = this;

        return self.velocity = val;
      });

      return (Opal.defn(self, '$to_s', TMP_9 = function() {
        var self = this, $iter = TMP_9.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_9.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_9, $iter).apply(self, $zuper)['$<<']("poly press " + (self.$channel_to_s(self.channel)) + " " + (self.$note_to_s()) + " " + (self.$number_to_s(self.velocity)));
      }), nil) && 'to_s';
    })($scope.base, $scope.get('NoteEvent'));

    (function($base, $super) {
      function $Controller(){}
      var self = $Controller = $klass($base, $super, 'Controller', $Controller);

      var def = self.$$proto, $scope = self.$$scope, TMP_10, TMP_11;

      def.status = def.channel = def.controller = def.value = nil;
      self.$attr_accessor("controller", "value");

      Opal.defn(self, '$initialize', TMP_10 = function(channel, controller, value, delta_time) {
        var self = this, $iter = TMP_10.$$p, $yield = $iter || nil;

        if (channel == null) {
          channel = 0
        }
        if (controller == null) {
          controller = 0
        }
        if (value == null) {
          value = 0
        }
        if (delta_time == null) {
          delta_time = 0
        }
        TMP_10.$$p = null;
        Opal.find_super_dispatcher(self, 'initialize', TMP_10, null).apply(self, [$scope.get('CONTROLLER'), channel, delta_time]);
        self.controller = controller;
        return self.value = value;
      });

      Opal.defn(self, '$data_as_bytes', function() {
        var self = this, data = nil;

        data = [];
        data['$<<'](($rb_plus(self.status, self.channel)));
        data['$<<'](self.controller);
        return data['$<<'](self.value);
      });

      return (Opal.defn(self, '$to_s', TMP_11 = function() {
        var self = this, $iter = TMP_11.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_11.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_11, $iter).apply(self, $zuper)['$<<']("cntl " + (self.$number_to_s(self.controller)) + " " + (self.$number_to_s(self.value)));
      }), nil) && 'to_s';
    })($scope.base, $scope.get('ChannelEvent'));

    (function($base, $super) {
      function $ProgramChange(){}
      var self = $ProgramChange = $klass($base, $super, 'ProgramChange', $ProgramChange);

      var def = self.$$proto, $scope = self.$$scope, TMP_12, TMP_13;

      def.status = def.channel = def.program = nil;
      self.$attr_accessor("program");

      Opal.defn(self, '$initialize', TMP_12 = function(channel, program, delta_time) {
        var self = this, $iter = TMP_12.$$p, $yield = $iter || nil;

        if (channel == null) {
          channel = 0
        }
        if (program == null) {
          program = 0
        }
        if (delta_time == null) {
          delta_time = 0
        }
        TMP_12.$$p = null;
        Opal.find_super_dispatcher(self, 'initialize', TMP_12, null).apply(self, [$scope.get('PROGRAM_CHANGE'), channel, delta_time]);
        return self.program = program;
      });

      Opal.defn(self, '$data_as_bytes', function() {
        var self = this, data = nil;

        data = [];
        data['$<<'](($rb_plus(self.status, self.channel)));
        return data['$<<'](self.program);
      });

      return (Opal.defn(self, '$to_s', TMP_13 = function() {
        var self = this, $iter = TMP_13.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_13.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_13, $iter).apply(self, $zuper)['$<<']("prog " + (self.$number_to_s(self.program)));
      }), nil) && 'to_s';
    })($scope.base, $scope.get('ChannelEvent'));

    (function($base, $super) {
      function $ChannelPressure(){}
      var self = $ChannelPressure = $klass($base, $super, 'ChannelPressure', $ChannelPressure);

      var def = self.$$proto, $scope = self.$$scope, TMP_14, TMP_15;

      def.status = def.channel = def.pressure = nil;
      self.$attr_accessor("pressure");

      Opal.defn(self, '$initialize', TMP_14 = function(channel, pressure, delta_time) {
        var self = this, $iter = TMP_14.$$p, $yield = $iter || nil;

        if (channel == null) {
          channel = 0
        }
        if (pressure == null) {
          pressure = 0
        }
        if (delta_time == null) {
          delta_time = 0
        }
        TMP_14.$$p = null;
        Opal.find_super_dispatcher(self, 'initialize', TMP_14, null).apply(self, [$scope.get('CHANNEL_PRESSURE'), channel, delta_time]);
        return self.pressure = pressure;
      });

      Opal.defn(self, '$data_as_bytes', function() {
        var self = this, data = nil;

        data = [];
        data['$<<'](($rb_plus(self.status, self.channel)));
        return data['$<<'](self.pressure);
      });

      return (Opal.defn(self, '$to_s', TMP_15 = function() {
        var self = this, $iter = TMP_15.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_15.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_15, $iter).apply(self, $zuper)['$<<']("chan press " + (self.$number_to_s(self.pressure)));
      }), nil) && 'to_s';
    })($scope.base, $scope.get('ChannelEvent'));

    (function($base, $super) {
      function $PitchBend(){}
      var self = $PitchBend = $klass($base, $super, 'PitchBend', $PitchBend);

      var def = self.$$proto, $scope = self.$$scope, TMP_16, TMP_17;

      def.status = def.channel = def.value = nil;
      self.$attr_accessor("value");

      Opal.defn(self, '$initialize', TMP_16 = function(channel, value, delta_time) {
        var self = this, $iter = TMP_16.$$p, $yield = $iter || nil;

        if (channel == null) {
          channel = 0
        }
        if (value == null) {
          value = 0
        }
        if (delta_time == null) {
          delta_time = 0
        }
        TMP_16.$$p = null;
        Opal.find_super_dispatcher(self, 'initialize', TMP_16, null).apply(self, [$scope.get('PITCH_BEND'), channel, delta_time]);
        return self.value = value;
      });

      Opal.defn(self, '$data_as_bytes', function() {
        var self = this, data = nil;

        data = [];
        data['$<<'](($rb_plus(self.status, self.channel)));
        data['$<<']((self.value['$&'](127)));
        return data['$<<'](((self.value['$>>'](7))['$&'](127)));
      });

      return (Opal.defn(self, '$to_s', TMP_17 = function() {
        var self = this, $iter = TMP_17.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_17.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_17, $iter).apply(self, $zuper)['$<<']("pb " + (self.$number_to_s(self.value)));
      }), nil) && 'to_s';
    })($scope.base, $scope.get('ChannelEvent'));

    (function($base, $super) {
      function $SystemCommon(){}
      var self = $SystemCommon = $klass($base, $super, 'SystemCommon', $SystemCommon);

      var def = self.$$proto, $scope = self.$$scope, TMP_18;

      return (Opal.defn(self, '$initialize', TMP_18 = function(status, delta_time) {
        var self = this, $iter = TMP_18.$$p, $yield = $iter || nil;

        TMP_18.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_18, null).apply(self, [status, delta_time]);
      }), nil) && 'initialize'
    })($scope.base, $scope.get('Event'));

    (function($base, $super) {
      function $SystemExclusive(){}
      var self = $SystemExclusive = $klass($base, $super, 'SystemExclusive', $SystemExclusive);

      var def = self.$$proto, $scope = self.$$scope, TMP_19, TMP_20;

      def.status = def.data = nil;
      self.$attr_accessor("data");

      Opal.defn(self, '$initialize', TMP_19 = function(data, delta_time) {
        var self = this, $iter = TMP_19.$$p, $yield = $iter || nil;

        if (delta_time == null) {
          delta_time = 0
        }
        TMP_19.$$p = null;
        Opal.find_super_dispatcher(self, 'initialize', TMP_19, null).apply(self, [$scope.get('SYSEX'), delta_time]);
        return self.data = data;
      });

      Opal.defn(self, '$data_as_bytes', function() {
        var self = this, data = nil;

        data = [];
        data['$<<'](self.status);
        data['$<<']($scope.get('Utils').$as_var_len(self.data.$length()));
        data['$<<'](self.data);
        data['$<<']($scope.get('EOX'));
        return data.$flatten();
      });

      return (Opal.defn(self, '$to_s', TMP_20 = function() {
        var self = this, $iter = TMP_20.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_20.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_20, $iter).apply(self, $zuper)['$<<']("sys ex");
      }), nil) && 'to_s';
    })($scope.base, $scope.get('SystemCommon'));

    (function($base, $super) {
      function $SongPointer(){}
      var self = $SongPointer = $klass($base, $super, 'SongPointer', $SongPointer);

      var def = self.$$proto, $scope = self.$$scope, TMP_21, TMP_22;

      def.status = def.pointer = nil;
      self.$attr_accessor("pointer");

      Opal.defn(self, '$initialize', TMP_21 = function(pointer, delta_time) {
        var self = this, $iter = TMP_21.$$p, $yield = $iter || nil;

        if (pointer == null) {
          pointer = 0
        }
        if (delta_time == null) {
          delta_time = 0
        }
        TMP_21.$$p = null;
        Opal.find_super_dispatcher(self, 'initialize', TMP_21, null).apply(self, [$scope.get('SONG_POINTER'), delta_time]);
        return self.pointer = pointer;
      });

      Opal.defn(self, '$data_as_bytes', function() {
        var self = this, data = nil;

        data = [];
        data['$<<'](self.status);
        data['$<<'](((self.pointer['$>>'](8))['$&'](255)));
        return data['$<<']((self.pointer['$&'](255)));
      });

      return (Opal.defn(self, '$to_s', TMP_22 = function() {
        var self = this, $iter = TMP_22.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_22.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_22, $iter).apply(self, $zuper)['$<<']("song ptr " + (self.$number_to_s(self.pointer)));
      }), nil) && 'to_s';
    })($scope.base, $scope.get('SystemCommon'));

    (function($base, $super) {
      function $SongSelect(){}
      var self = $SongSelect = $klass($base, $super, 'SongSelect', $SongSelect);

      var def = self.$$proto, $scope = self.$$scope, TMP_23, TMP_24;

      def.status = def.song = nil;
      self.$attr_accessor("song");

      Opal.defn(self, '$initialize', TMP_23 = function(song, delta_time) {
        var self = this, $iter = TMP_23.$$p, $yield = $iter || nil;

        if (song == null) {
          song = 0
        }
        if (delta_time == null) {
          delta_time = 0
        }
        TMP_23.$$p = null;
        Opal.find_super_dispatcher(self, 'initialize', TMP_23, null).apply(self, [$scope.get('SONG_SELECT'), delta_time]);
        return self.song = song;
      });

      Opal.defn(self, '$data_as_bytes', function() {
        var self = this, data = nil;

        data = [];
        data['$<<'](self.status);
        return data['$<<'](self.song);
      });

      return (Opal.defn(self, '$to_s', TMP_24 = function() {
        var self = this, $iter = TMP_24.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_24.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_24, $iter).apply(self, $zuper)['$<<']("song sel " + (self.$number_to_s(self.song)));
      }), nil) && 'to_s';
    })($scope.base, $scope.get('SystemCommon'));

    (function($base, $super) {
      function $TuneRequest(){}
      var self = $TuneRequest = $klass($base, $super, 'TuneRequest', $TuneRequest);

      var def = self.$$proto, $scope = self.$$scope, TMP_25, TMP_26;

      def.status = nil;
      Opal.defn(self, '$initialize', TMP_25 = function(delta_time) {
        var self = this, $iter = TMP_25.$$p, $yield = $iter || nil;

        if (delta_time == null) {
          delta_time = 0
        }
        TMP_25.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_25, null).apply(self, [$scope.get('TUNE_REQUEST'), delta_time]);
      });

      Opal.defn(self, '$data_as_bytes', function() {
        var self = this, data = nil;

        data = [];
        return data['$<<'](self.status);
      });

      return (Opal.defn(self, '$to_s', TMP_26 = function() {
        var self = this, $iter = TMP_26.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_26.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_26, $iter).apply(self, $zuper)['$<<']("tune req");
      }), nil) && 'to_s';
    })($scope.base, $scope.get('SystemCommon'));

    (function($base, $super) {
      function $Realtime(){}
      var self = $Realtime = $klass($base, $super, 'Realtime', $Realtime);

      var def = self.$$proto, $scope = self.$$scope, TMP_27, TMP_28;

      def.status = nil;
      Opal.defn(self, '$initialize', TMP_27 = function(status, delta_time) {
        var self = this, $iter = TMP_27.$$p, $yield = $iter || nil;

        TMP_27.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_27, null).apply(self, [status, delta_time]);
      });

      Opal.defn(self, '$data_as_bytes', function() {
        var self = this, data = nil;

        data = [];
        return data['$<<'](self.status);
      });

      return (Opal.defn(self, '$to_s', TMP_28 = function() {
        var self = this, $iter = TMP_28.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_28.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_28, $iter).apply(self, $zuper)['$<<']("realtime " + (self.$number_to_s(self.status)));
      }), nil) && 'to_s';
    })($scope.base, $scope.get('Event'));

    (function($base, $super) {
      function $Clock(){}
      var self = $Clock = $klass($base, $super, 'Clock', $Clock);

      var def = self.$$proto, $scope = self.$$scope, TMP_29, TMP_30;

      Opal.defn(self, '$initialize', TMP_29 = function(delta_time) {
        var self = this, $iter = TMP_29.$$p, $yield = $iter || nil;

        if (delta_time == null) {
          delta_time = 0
        }
        TMP_29.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_29, null).apply(self, [$scope.get('CLOCK'), delta_time]);
      });

      return (Opal.defn(self, '$to_s', TMP_30 = function() {
        var self = this, $iter = TMP_30.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_30.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_30, $iter).apply(self, $zuper)['$<<']("clock");
      }), nil) && 'to_s';
    })($scope.base, $scope.get('Realtime'));

    (function($base, $super) {
      function $Start(){}
      var self = $Start = $klass($base, $super, 'Start', $Start);

      var def = self.$$proto, $scope = self.$$scope, TMP_31, TMP_32;

      Opal.defn(self, '$initialize', TMP_31 = function(delta_time) {
        var self = this, $iter = TMP_31.$$p, $yield = $iter || nil;

        if (delta_time == null) {
          delta_time = 0
        }
        TMP_31.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_31, null).apply(self, [$scope.get('START'), delta_time]);
      });

      return (Opal.defn(self, '$to_s', TMP_32 = function() {
        var self = this, $iter = TMP_32.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_32.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_32, $iter).apply(self, $zuper)['$<<']("start");
      }), nil) && 'to_s';
    })($scope.base, $scope.get('Realtime'));

    (function($base, $super) {
      function $Continue(){}
      var self = $Continue = $klass($base, $super, 'Continue', $Continue);

      var def = self.$$proto, $scope = self.$$scope, TMP_33, TMP_34;

      Opal.defn(self, '$initialize', TMP_33 = function(delta_time) {
        var self = this, $iter = TMP_33.$$p, $yield = $iter || nil;

        if (delta_time == null) {
          delta_time = 0
        }
        TMP_33.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_33, null).apply(self, [$scope.get('CONTINUE'), delta_time]);
      });

      return (Opal.defn(self, '$to_s', TMP_34 = function() {
        var self = this, $iter = TMP_34.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_34.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_34, $iter).apply(self, $zuper)['$<<']("continue");
      }), nil) && 'to_s';
    })($scope.base, $scope.get('Realtime'));

    (function($base, $super) {
      function $Stop(){}
      var self = $Stop = $klass($base, $super, 'Stop', $Stop);

      var def = self.$$proto, $scope = self.$$scope, TMP_35, TMP_36;

      Opal.defn(self, '$initialize', TMP_35 = function(delta_time) {
        var self = this, $iter = TMP_35.$$p, $yield = $iter || nil;

        if (delta_time == null) {
          delta_time = 0
        }
        TMP_35.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_35, null).apply(self, [$scope.get('STOP'), delta_time]);
      });

      return (Opal.defn(self, '$to_s', TMP_36 = function() {
        var self = this, $iter = TMP_36.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_36.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_36, $iter).apply(self, $zuper)['$<<']("stop");
      }), nil) && 'to_s';
    })($scope.base, $scope.get('Realtime'));

    (function($base, $super) {
      function $ActiveSense(){}
      var self = $ActiveSense = $klass($base, $super, 'ActiveSense', $ActiveSense);

      var def = self.$$proto, $scope = self.$$scope, TMP_37, TMP_38;

      Opal.defn(self, '$initialize', TMP_37 = function(delta_time) {
        var self = this, $iter = TMP_37.$$p, $yield = $iter || nil;

        if (delta_time == null) {
          delta_time = 0
        }
        TMP_37.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_37, null).apply(self, [$scope.get('ACTIVE_SENSE'), delta_time]);
      });

      return (Opal.defn(self, '$to_s', TMP_38 = function() {
        var self = this, $iter = TMP_38.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_38.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_38, $iter).apply(self, $zuper)['$<<']("act sens");
      }), nil) && 'to_s';
    })($scope.base, $scope.get('Realtime'));

    (function($base, $super) {
      function $SystemReset(){}
      var self = $SystemReset = $klass($base, $super, 'SystemReset', $SystemReset);

      var def = self.$$proto, $scope = self.$$scope, TMP_39, TMP_40;

      Opal.defn(self, '$initialize', TMP_39 = function(delta_time) {
        var self = this, $iter = TMP_39.$$p, $yield = $iter || nil;

        if (delta_time == null) {
          delta_time = 0
        }
        TMP_39.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_39, null).apply(self, [$scope.get('SYSTEM_RESET'), delta_time]);
      });

      return (Opal.defn(self, '$to_s', TMP_40 = function() {
        var self = this, $iter = TMP_40.$$p, $yield = $iter || nil, $zuper = nil, $zuper_index = nil;

        TMP_40.$$p = null;
        $zuper = [];
        for($zuper_index = 0; $zuper_index < arguments.length; $zuper_index++) {
          $zuper[$zuper_index] = arguments[$zuper_index];
        }
        return Opal.find_super_dispatcher(self, 'to_s', TMP_40, $iter).apply(self, $zuper)['$<<']("sys reset");
      }), nil) && 'to_s';
    })($scope.base, $scope.get('Realtime'));

    (function($base, $super) {
      function $MetaEvent(){}
      var self = $MetaEvent = $klass($base, $super, 'MetaEvent', $MetaEvent);

      var def = self.$$proto, $scope = self.$$scope, $a, TMP_44, TMP_45;

      def.status = def.meta_type = def.data = nil;
      self.$attr_reader("meta_type");

      self.$attr_reader("data");

      Opal.defs(self, '$bytes_as_str', function(bytes) {
        var $a, $b, TMP_41, self = this;

        if (bytes !== false && bytes !== nil) {
          return ($a = ($b = bytes).$collect, $a.$$p = (TMP_41 = function(byte$){var self = TMP_41.$$s || this;
if (byte$ == null) byte$ = nil;
          return byte$.$chr()}, TMP_41.$$s = self, TMP_41), $a).call($b).$join()
          } else {
          return nil
        }
      });

      if ((($a = $rb_ge($scope.get('RUBY_VERSION'), "1.9")) !== nil && (!$a.$$is_boolean || $a == true))) {
        Opal.defs(self, '$str_as_bytes', function(str) {
          var $a, $b, TMP_42, self = this;

          return ($a = ($b = str.$split(/(?:)/)).$collect, $a.$$p = (TMP_42 = function(chr){var self = TMP_42.$$s || this;
if (chr == null) chr = nil;
          return chr.$ord()}, TMP_42.$$s = self, TMP_42), $a).call($b);
        })
        } else {
        Opal.defs(self, '$str_as_bytes', function(str) {
          var $a, $b, TMP_43, self = this;

          return ($a = ($b = str.$split(/(?:)/)).$collect, $a.$$p = (TMP_43 = function(chr){var self = TMP_43.$$s || this;
if (chr == null) chr = nil;
          return chr['$[]'](0)}, TMP_43.$$s = self, TMP_43), $a).call($b);
        })
      }

      Opal.defn(self, '$initialize', TMP_44 = function(meta_type, data, delta_time) {
        var $a, $b, self = this, $iter = TMP_44.$$p, $yield = $iter || nil;

        if (data == null) {
          data = nil
        }
        if (delta_time == null) {
          delta_time = 0
        }
        TMP_44.$$p = null;
        Opal.find_super_dispatcher(self, 'initialize', TMP_44, null).apply(self, [$scope.get('META_EVENT'), delta_time]);
        self.meta_type = meta_type;
        return (($a = [(data)]), $b = self, $b['$data='].apply($b, $a), $a[$a.length-1]);
      });

      Opal.defn(self, '$data_as_bytes', function() {
        var $a, self = this, data = nil;

        data = [];
        data['$<<'](self.status);
        data['$<<'](self.meta_type);
        data['$<<'](((function() {if ((($a = self.data) !== nil && (!$a.$$is_boolean || $a == true))) {
          return $scope.get('Utils').$as_var_len(self.data.$length())
          } else {
          return 0
        } return nil; })()));
        if ((($a = self.data) !== nil && (!$a.$$is_boolean || $a == true))) {
          data['$<<'](self.data)}
        return data.$flatten();
      });

      Opal.defn(self, '$data_as_str', function() {
        var self = this;

        return $scope.get('MetaEvent').$bytes_as_str(self.data);
      });

      Opal.defn(self, '$data=', function(data) {
        var self = this, $case = nil;

        return (function() {$case = data;if ($scope.get('String')['$===']($case)) {return self.data = $scope.get('MetaEvent').$str_as_bytes(data)}else {return self.data = data}})();
      });

      return (Opal.defn(self, '$to_s', TMP_45 = function() {
        var self = this, $iter = TMP_45.$$p, $yield = $iter || nil, str = nil, $case = nil;

        TMP_45.$$p = null;
        str = Opal.find_super_dispatcher(self, 'to_s', TMP_45, null).apply(self, []);
        str['$<<']("meta " + (self.$number_to_s(self.meta_type)) + " ");
        $case = self.meta_type;if ($scope.get('META_SEQ_NUM')['$===']($case)) {str['$<<']("sequence number")}else if ($scope.get('META_TEXT')['$===']($case)) {str['$<<']("text: " + (self.$data_as_str()))}else if ($scope.get('META_COPYRIGHT')['$===']($case)) {str['$<<']("copyright: " + (self.$data_as_str()))}else if ($scope.get('META_SEQ_NAME')['$===']($case)) {str['$<<']("sequence or track name: " + (self.$data_as_str()))}else if ($scope.get('META_INSTRUMENT')['$===']($case)) {str['$<<']("instrument name: " + (self.$data_as_str()))}else if ($scope.get('META_LYRIC')['$===']($case)) {str['$<<']("lyric: " + (self.$data_as_str()))}else if ($scope.get('META_MARKER')['$===']($case)) {str['$<<']("marker: " + (self.$data_as_str()))}else if ($scope.get('META_CUE')['$===']($case)) {str['$<<']("cue point: " + (self.data))}else if ($scope.get('META_TRACK_END')['$===']($case)) {str['$<<']("track end")}else if ($scope.get('META_SMPTE')['$===']($case)) {str['$<<']("smpte")}else if ($scope.get('META_TIME_SIG')['$===']($case)) {str['$<<']("time signature")}else if ($scope.get('META_KEY_SIG')['$===']($case)) {str['$<<']("key signature")}else if ($scope.get('META_SEQ_SPECIF')['$===']($case)) {str['$<<']("sequence specific")}else {str['$<<']("(other)")}
        return str;
      }), nil) && 'to_s';
    })($scope.base, $scope.get('Event'));

    (function($base, $super) {
      function $Marker(){}
      var self = $Marker = $klass($base, $super, 'Marker', $Marker);

      var def = self.$$proto, $scope = self.$$scope, TMP_46;

      return (Opal.defn(self, '$initialize', TMP_46 = function(msg, delta_time) {
        var self = this, $iter = TMP_46.$$p, $yield = $iter || nil;

        if (delta_time == null) {
          delta_time = 0
        }
        TMP_46.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_46, null).apply(self, [$scope.get('META_MARKER'), msg, delta_time]);
      }), nil) && 'initialize'
    })($scope.base, $scope.get('MetaEvent'));

    (function($base, $super) {
      function $Tempo(){}
      var self = $Tempo = $klass($base, $super, 'Tempo', $Tempo);

      var def = self.$$proto, $scope = self.$$scope, TMP_47;

      def.data = def.status = def.meta_type = nil;
      Opal.cdecl($scope, 'MICROSECS_PER_MINUTE', $rb_times(1000000, 60));

      Opal.defs($scope.get('Tempo'), '$bpm_to_mpq', function(bpm) {
        var self = this;

        return $rb_divide($scope.get('MICROSECS_PER_MINUTE'), bpm);
      });

      Opal.defs($scope.get('Tempo'), '$mpq_to_bpm', function(mpq) {
        var self = this;

        return $rb_divide($scope.get('MICROSECS_PER_MINUTE').$to_f(), mpq.$to_f());
      });

      Opal.defn(self, '$initialize', TMP_47 = function(msecs_per_qnote, delta_time) {
        var self = this, $iter = TMP_47.$$p, $yield = $iter || nil;

        if (delta_time == null) {
          delta_time = 0
        }
        TMP_47.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_47, null).apply(self, [$scope.get('META_SET_TEMPO'), msecs_per_qnote, delta_time]);
      });

      Opal.defn(self, '$tempo', function() {
        var self = this;

        return self.data;
      });

      Opal.defn(self, '$tempo=', function(val) {
        var self = this;

        return self.data = val;
      });

      Opal.defn(self, '$data_as_bytes', function() {
        var self = this, data = nil;

        data = [];
        data['$<<'](self.status);
        data['$<<'](self.meta_type);
        data['$<<'](3);
        data['$<<'](((self.data['$>>'](16))['$&'](255)));
        data['$<<'](((self.data['$>>'](8))['$&'](255)));
        return data['$<<']((self.data['$&'](255)));
      });

      return (Opal.defn(self, '$to_s', function() {
        var self = this;

        return "tempo " + (self.data) + " msecs per qnote (" + ($scope.get('Tempo').$mpq_to_bpm(self.data)) + " bpm)";
      }), nil) && 'to_s';
    })($scope.base, $scope.get('MetaEvent'));

    (function($base, $super) {
      function $TimeSig(){}
      var self = $TimeSig = $klass($base, $super, 'TimeSig', $TimeSig);

      var def = self.$$proto, $scope = self.$$scope, TMP_48;

      def.status = def.meta_type = def.data = nil;
      Opal.defn(self, '$initialize', TMP_48 = function(numer, denom, clocks, qnotes, delta_time) {
        var self = this, $iter = TMP_48.$$p, $yield = $iter || nil;

        if (delta_time == null) {
          delta_time = 0
        }
        TMP_48.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_48, null).apply(self, [$scope.get('META_TIME_SIG'), [numer, denom, clocks, qnotes], delta_time]);
      });

      Opal.defn(self, '$data_as_bytes', function() {
        var self = this, data = nil;

        data = [];
        data['$<<'](self.status);
        data['$<<'](self.meta_type);
        data['$<<'](4);
        data['$<<'](self.data['$[]'](0));
        data['$<<'](self.data['$[]'](1));
        data['$<<'](self.data['$[]'](2));
        return data['$<<'](self.data['$[]'](3));
      });

      Opal.defn(self, '$measure_duration', function(ppqn) {
        var self = this;

        return $rb_divide(($rb_times($rb_times(4, ppqn), self.data['$[]'](0))), ((2)['$**'](self.data['$[]'](1))));
      });

      Opal.defn(self, '$numerator', function() {
        var self = this;

        return self.data['$[]'](0);
      });

      Opal.defn(self, '$denominator', function() {
        var self = this;

        return self.data['$[]'](1);
      });

      Opal.defn(self, '$metronome_ticks', function() {
        var self = this;

        return self.data['$[]'](2);
      });

      return (Opal.defn(self, '$to_s', function() {
        var self = this;

        return "time sig " + (self.data['$[]'](0)) + "/" + ((2)['$**'](self.data['$[]'](1)));
      }), nil) && 'to_s';
    })($scope.base, $scope.get('MetaEvent'));

    (function($base, $super) {
      function $KeySig(){}
      var self = $KeySig = $klass($base, $super, 'KeySig', $KeySig);

      var def = self.$$proto, $scope = self.$$scope, TMP_49;

      def.status = def.meta_type = def.data = nil;
      Opal.defn(self, '$initialize', TMP_49 = function(sharpflat, is_minor, delta_time) {
        var self = this, $iter = TMP_49.$$p, $yield = $iter || nil;

        if (delta_time == null) {
          delta_time = 0
        }
        TMP_49.$$p = null;
        return Opal.find_super_dispatcher(self, 'initialize', TMP_49, null).apply(self, [$scope.get('META_KEY_SIG'), [sharpflat, is_minor], delta_time]);
      });

      Opal.defn(self, '$data_as_bytes', function() {
        var $a, self = this, data = nil;

        data = [];
        data['$<<'](self.status);
        data['$<<'](self.meta_type);
        data['$<<'](2);
        data['$<<'](self.data['$[]'](0));
        return data['$<<'](((function() {if ((($a = self.data['$[]'](1)) !== nil && (!$a.$$is_boolean || $a == true))) {
          return 1
          } else {
          return 0
        } return nil; })()));
      });

      Opal.defn(self, '$minor_key?', function() {
        var self = this;

        return self.data['$[]'](1);
      });

      Opal.defn(self, '$major_key?', function() {
        var self = this;

        return self.data['$[]'](1)['$!']();
      });

      Opal.defn(self, '$sharpflat', function() {
        var $a, self = this;

        if ((($a = $rb_gt(self.data['$[]'](0), 7)) !== nil && (!$a.$$is_boolean || $a == true))) {
          return $rb_minus(self.data['$[]'](0), 256)
          } else {
          return self.data['$[]'](0)
        }
      });

      return (Opal.defn(self, '$to_s', function() {
        var $a, self = this, majorkeys = nil, minorkeys = nil;

        majorkeys = ["C flat", "G flat", "D flat", "A flat", "E flat", "B flat", "F", "C", "G", "D", "A", "E", "B", "F#", "C#"];
        minorkeys = ["a flat", "e flat", "b flat", "f", "c", "g", "d", "a", "e", "b", "f#", "c#", "g#", "d#", "a#"];
        if ((($a = self['$minor_key?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
          return "key sig " + (minorkeys['$[]']($rb_plus(self.$sharpflat(), 7))) + " minor"
          } else {
          return "key sig " + (majorkeys['$[]']($rb_plus(self.$sharpflat(), 7))) + " major"
        }
      }), nil) && 'to_s';
    })($scope.base, $scope.get('MetaEvent'));
  })($scope.base);
};

/* Generated by Opal 0.9.2 */
Opal.modules["midilib/track"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_le(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs <= rhs : lhs['$<='](rhs);
  }
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module, $klass = Opal.klass, $range = Opal.range;

  Opal.add_stubs(['$require', '$==', '$lambda', '$<=>', '$<=', '$size', '$dup', '$map', '$mergesort', '$to_proc', '$split', '$merge', '$protected', '$-', '$floor', '$/', '$length', '$[]', '$+', '$empty?', '$call', '$first', '$<<', '$shift', '$concat', '$include', '$attr_accessor', '$attr_reader', '$new', '$detect', '$kind_of?', '$meta_type', '$data_as_str', '$data=', '$[]=', '$bytes_as_str', '$===', '$str_as_bytes', '$merge_event_lists', '$recalc_times', '$recalc_delta_from_times', '$note_to_delta', '$length_to_delta', '$to_i', '$each', '$quantize_to', '$time_from_start', '$delta_time', '$time_from_start=', '$delta_time=', '$alias_method']);
  self.$require("midilib/event");
  return (function($base) {
    var $MIDI, self = $MIDI = $module($base, 'MIDI');

    var def = self.$$proto, $scope = self.$$scope;

    (function($base, $super) {
      function $Array(){}
      var self = $Array = $klass($base, $super, 'Array', $Array);

      var def = self.$$proto, $scope = self.$$scope, TMP_1, TMP_4;

      Opal.defn(self, '$mergesort', TMP_1 = function() {
        var $a, $b, TMP_2, $c, TMP_3, $d, self = this, $iter = TMP_1.$$p, cmp = $iter || nil, halves = nil;

        TMP_1.$$p = null;
        if (cmp['$=='](nil)) {
          cmp = ($a = ($b = self).$lambda, $a.$$p = (TMP_2 = function(a, b){var self = TMP_2.$$s || this;
if (a == null) a = nil;if (b == null) b = nil;
          return a['$<=>'](b)}, TMP_2.$$s = self, TMP_2), $a).call($b)}
        if ((($a = $rb_le(self.$size(), 1)) !== nil && (!$a.$$is_boolean || $a == true))) {
          return self.$dup()
          } else {
          halves = ($a = ($c = self.$split()).$map, $a.$$p = (TMP_3 = function(half){var self = TMP_3.$$s || this, $a, $b;
if (half == null) half = nil;
          return ($a = ($b = half).$mergesort, $a.$$p = cmp.$to_proc(), $a).call($b)}, TMP_3.$$s = self, TMP_3), $a).call($c);
          return ($a = ($d = self).$merge, $a.$$p = cmp.$to_proc(), $a).apply($d, Opal.to_a(halves));
        }
      });

      self.$protected();

      Opal.defn(self, '$split', function() {
        var self = this, n = nil;

        n = $rb_minus(($rb_divide(self.$length(), 2)).$floor(), 1);
        return [self['$[]']($range(0, n, false)), self['$[]']($range($rb_plus(n, 1), -1, false))];
      });

      return (Opal.defn(self, '$merge', TMP_4 = function(first, second) {
        var $a, $b, $c, self = this, $iter = TMP_4.$$p, predicate = $iter || nil, result = nil;

        TMP_4.$$p = null;
        result = [];
        while (!((($b = ((($c = first['$empty?']()) !== false && $c !== nil) ? $c : second['$empty?']())) !== nil && (!$b.$$is_boolean || $b == true)))) {
        if ((($b = $rb_le(predicate.$call(first.$first(), second.$first()), 0)) !== nil && (!$b.$$is_boolean || $b == true))) {
          result['$<<'](first.$shift())
          } else {
          result['$<<'](second.$shift())
        }}
        return result.$concat(first).$concat(second);
      }), nil) && 'merge';
    })($scope.get('MIDI'), Opal.get('Array'));

    (function($base, $super) {
      function $Track(){}
      var self = $Track = $klass($base, $super, 'Track', $Track);

      var def = self.$$proto, $scope = self.$$scope, TMP_12;

      def.events = def.instrument = def.sequence = nil;
      self.$include($scope.get('Enumerable'));

      Opal.cdecl($scope, 'UNNAMED', "Unnamed");

      self.$attr_accessor("events", "channels_used");

      self.$attr_reader("sequence");

      Opal.defn(self, '$initialize', function(sequence) {
        var self = this;

        self.sequence = sequence;
        self.events = $scope.get('Array').$new();
        return self.channels_used = 0;
      });

      Opal.defn(self, '$name', function() {
        var $a, $b, TMP_5, self = this, event = nil;

        event = ($a = ($b = self.events).$detect, $a.$$p = (TMP_5 = function(e){var self = TMP_5.$$s || this, $a;
if (e == null) e = nil;
        return ($a = e['$kind_of?']($scope.get('MetaEvent')), $a !== false && $a !== nil ?e.$meta_type()['$==']($scope.get('META_SEQ_NAME')) : $a)}, TMP_5.$$s = self, TMP_5), $a).call($b);
        if (event !== false && event !== nil) {
          return event.$data_as_str()
          } else {
          return $scope.get('UNNAMED')
        }
      });

      Opal.defn(self, '$name=', function(name) {
        var $a, $b, TMP_6, $c, self = this, event = nil;

        event = ($a = ($b = self.events).$detect, $a.$$p = (TMP_6 = function(e){var self = TMP_6.$$s || this, $a;
if (e == null) e = nil;
        return ($a = e['$kind_of?']($scope.get('MetaEvent')), $a !== false && $a !== nil ?e.$meta_type()['$==']($scope.get('META_SEQ_NAME')) : $a)}, TMP_6.$$s = self, TMP_6), $a).call($b);
        if (event !== false && event !== nil) {
          return (($a = [name]), $c = event, $c['$data='].apply($c, $a), $a[$a.length-1])
          } else {
          event = $scope.get('MetaEvent').$new($scope.get('META_SEQ_NAME'), name, 0);
          return self.events['$[]='](0, 0, event);
        }
      });

      Opal.defn(self, '$instrument', function() {
        var self = this;

        return $scope.get('MetaEvent').$bytes_as_str(self.instrument);
      });

      Opal.defn(self, '$instrument=', function(str_or_bytes) {
        var self = this, $case = nil;

        return self.instrument = (function() {$case = str_or_bytes;if ($scope.get('String')['$===']($case)) {return $scope.get('MetaEvent').$str_as_bytes(str_or_bytes)}else {return str_or_bytes}})();
      });

      Opal.defn(self, '$merge', function(event_list) {
        var self = this;

        return self.events = self.$merge_event_lists(self.events, event_list);
      });

      Opal.defn(self, '$merge_event_lists', function(list1, list2) {
        var self = this, list = nil;

        self.$recalc_times(0, list1);
        self.$recalc_times(0, list2);
        list = $rb_plus(list1, list2);
        self.$recalc_delta_from_times(0, list);
        return list;
      });

      Opal.defn(self, '$quantize', function(length_or_note) {
        var $a, $b, TMP_7, self = this, delta = nil, $case = nil;

        delta = (function() {$case = length_or_note;if ($scope.get('String')['$===']($case)) {return self.sequence.$note_to_delta(length_or_note)}else {return self.sequence.$length_to_delta(length_or_note.$to_i())}})();
        ($a = ($b = self.events).$each, $a.$$p = (TMP_7 = function(event){var self = TMP_7.$$s || this;
if (event == null) event = nil;
        return event.$quantize_to(delta)}, TMP_7.$$s = self, TMP_7), $a).call($b);
        return self.$recalc_delta_from_times();
      });

      Opal.defn(self, '$recalc_times', function(starting_at, list) {
        var $a, $b, TMP_8, self = this, t = nil;

        if (starting_at == null) {
          starting_at = 0
        }
        if (list == null) {
          list = self.events
        }
        t = (function() {if ((($a = (starting_at['$=='](0))) !== nil && (!$a.$$is_boolean || $a == true))) {
          return 0
          } else {
          return list['$[]']($rb_minus(starting_at, 1)).$time_from_start()
        } return nil; })();
        return ($a = ($b = list['$[]']($range(starting_at, -1, false))).$each, $a.$$p = (TMP_8 = function(e){var self = TMP_8.$$s || this, $a, $b;
if (e == null) e = nil;
        t = $rb_plus(t, e.$delta_time());
          return (($a = [t]), $b = e, $b['$time_from_start='].apply($b, $a), $a[$a.length-1]);}, TMP_8.$$s = self, TMP_8), $a).call($b);
      });

      Opal.defn(self, '$recalc_delta_from_times', function(starting_at, list) {
        var $a, $b, TMP_9, $c, TMP_10, self = this, prev_time_from_start = nil;

        if (starting_at == null) {
          starting_at = 0
        }
        if (list == null) {
          list = self.events
        }
        prev_time_from_start = 0;
        list['$[]=']($range(starting_at, -1, false), ($a = ($b = (($scope.get('MIDI')).$$scope.get('Array')).$new(list['$[]']($range(starting_at, -1, false)))).$mergesort, $a.$$p = (TMP_9 = function(e1, e2){var self = TMP_9.$$s || this;
if (e1 == null) e1 = nil;if (e2 == null) e2 = nil;
        return e1.$time_from_start()['$<=>'](e2.$time_from_start())}, TMP_9.$$s = self, TMP_9), $a).call($b));
        return ($a = ($c = list['$[]']($range(starting_at, -1, false))).$each, $a.$$p = (TMP_10 = function(e){var self = TMP_10.$$s || this, $a, $b;
if (e == null) e = nil;
        (($a = [$rb_minus(e.$time_from_start(), prev_time_from_start)]), $b = e, $b['$delta_time='].apply($b, $a), $a[$a.length-1]);
          return prev_time_from_start = e.$time_from_start();}, TMP_10.$$s = self, TMP_10), $a).call($c);
      });

      Opal.defn(self, '$each', TMP_12 = function() {
        var $a, $b, TMP_11, self = this, $iter = TMP_12.$$p, $yield = $iter || nil;

        TMP_12.$$p = null;
        return ($a = ($b = self.events).$each, $a.$$p = (TMP_11 = function(event){var self = TMP_11.$$s || this, $a;
if (event == null) event = nil;
        return $a = Opal.yield1($yield, event), $a === $breaker ? $a : $a}, TMP_11.$$s = self, TMP_11), $a).call($b);
      });

      return self.$alias_method("sort", "recalc_delta_from_times");
    })($scope.base, null);
  })($scope.base);
};

/* Generated by Opal 0.9.2 */
Opal.modules["midilib/io/seqreader"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module, $klass = Opal.klass, $gvars = Opal.gvars;

  Opal.add_stubs(['$require', '$new', '$format=', '$ppqn=', '$call', '$<<', '$tracks', '$each', '$make_note_off', '$recalc_times', '$channels_used=', '$length', '$==', '$note_off', '$events', '$track_uses_channel', '$each_with_index', '$note', '$channel', '$delete_at', '$puts', '$+', '$off=', '$on=', '$===', '$instrument=', '$time_signature', '$|']);
  self.$require("midilib/io/midifile");
  self.$require("midilib/track");
  self.$require("midilib/event");
  return (function($base) {
    var $MIDI, self = $MIDI = $module($base, 'MIDI');

    var def = self.$$proto, $scope = self.$$scope;

    (function($base) {
      var $IO, self = $IO = $module($base, 'IO');

      var def = self.$$proto, $scope = self.$$scope;

      (function($base, $super) {
        function $SeqReader(){}
        var self = $SeqReader = $klass($base, $super, 'SeqReader', $SeqReader);

        var def = self.$$proto, $scope = self.$$scope, TMP_1;

        def.seq = def.update_block = def.ntrks = def.track = def.pending = def.chan_mask = def.curr_ticks = nil;
        Opal.defn(self, '$initialize', TMP_1 = function(seq, proc) {
          var self = this, $iter = TMP_1.$$p, $yield = $iter || nil;

          if (proc == null) {
            proc = nil
          }
          TMP_1.$$p = null;
          Opal.find_super_dispatcher(self, 'initialize', TMP_1, null).apply(self, []);
          self.seq = seq;
          self.track = nil;
          self.chan_mask = 0;
          return self.update_block = (function() {if (($yield !== nil)) {
            return $scope.get('Proc').$new()
            } else {
            return proc
          } return nil; })();
        });

        Opal.defn(self, '$header', function(format, ntrks, division) {
          var $a, $b, self = this;

          (($a = [format]), $b = self.seq, $b['$format='].apply($b, $a), $a[$a.length-1]);
          (($a = [division]), $b = self.seq, $b['$ppqn='].apply($b, $a), $a[$a.length-1]);
          self.ntrks = ntrks;
          if ((($a = self.update_block) !== nil && (!$a.$$is_boolean || $a == true))) {
            return self.update_block.$call(nil, self.ntrks, 0)
            } else {
            return nil
          }
        });

        Opal.defn(self, '$start_track', function() {
          var self = this;

          self.track = $scope.get('Track').$new(self.seq);
          self.seq.$tracks()['$<<'](self.track);
          return self.pending = [];
        });

        Opal.defn(self, '$end_track', function() {
          var $a, $b, TMP_2, $c, self = this;

          ($a = ($b = self.pending).$each, $a.$$p = (TMP_2 = function(on){var self = TMP_2.$$s || this;
if (on == null) on = nil;
          return self.$make_note_off(on, 64)}, TMP_2.$$s = self, TMP_2), $a).call($b);
          self.pending = nil;
          self.track.$recalc_times();
          (($a = [self.chan_mask]), $c = self.track, $c['$channels_used='].apply($c, $a), $a[$a.length-1]);
          if ((($a = self.update_block) !== nil && (!$a.$$is_boolean || $a == true))) {
            return self.update_block.$call(self.track, self.ntrks, self.seq.$tracks().$length())
            } else {
            return nil
          }
        });

        Opal.defn(self, '$note_on', function(chan, note, vel) {
          var self = this, on = nil;

          if (vel['$=='](0)) {
            self.$note_off(chan, note, 64);
            return nil;}
          on = $scope.get('NoteOn').$new(chan, note, vel, self.curr_ticks);
          self.track.$events()['$<<'](on);
          self.pending['$<<'](on);
          return self.$track_uses_channel(chan);
        });

        Opal.defn(self, '$note_off', function(chan, note, vel) {try {

          var $a, $b, TMP_3, self = this;
          if ($gvars.DEBUG == null) $gvars.DEBUG = nil;
          if ($gvars.stderr == null) $gvars.stderr = nil;

          ($a = ($b = self.pending).$each_with_index, $a.$$p = (TMP_3 = function(on, i){var self = TMP_3.$$s || this, $a, $b;
            if (self.pending == null) self.pending = nil;
if (on == null) on = nil;if (i == null) i = nil;
          if ((($a = (($b = on.$note()['$=='](note)) ? on.$channel()['$=='](chan) : on.$note()['$=='](note))) !== nil && (!$a.$$is_boolean || $a == true))) {
              self.$make_note_off(on, vel);
              self.pending.$delete_at(i);
              Opal.ret(nil);
              } else {
              return nil
            }}, TMP_3.$$s = self, TMP_3), $a).call($b);
          if ((($a = $gvars.DEBUG) !== nil && (!$a.$$is_boolean || $a == true))) {
            return $gvars.stderr.$puts($rb_plus("note off with no earlier note on (ch " + (chan) + ", note", " " + (note) + ", vel " + (vel) + ")"))
            } else {
            return nil
          }
          } catch ($returner) { if ($returner === Opal.returner) { return $returner.$v } throw $returner; }
        });

        Opal.defn(self, '$make_note_off', function(on, vel) {
          var $a, $b, self = this, off = nil;

          off = $scope.get('NoteOff').$new(on.$channel(), on.$note(), vel, self.curr_ticks);
          self.track.$events()['$<<'](off);
          (($a = [off]), $b = on, $b['$off='].apply($b, $a), $a[$a.length-1]);
          return (($a = [on]), $b = off, $b['$on='].apply($b, $a), $a[$a.length-1]);
        });

        Opal.defn(self, '$pressure', function(chan, note, press) {
          var self = this;

          self.track.$events()['$<<']($scope.get('PolyPressure').$new(chan, note, press, self.curr_ticks));
          return self.$track_uses_channel(chan);
        });

        Opal.defn(self, '$controller', function(chan, control, value) {
          var self = this;

          self.track.$events()['$<<']($scope.get('Controller').$new(chan, control, value, self.curr_ticks));
          return self.$track_uses_channel(chan);
        });

        Opal.defn(self, '$pitch_bend', function(chan, lsb, msb) {
          var self = this;

          self.track.$events()['$<<']($scope.get('PitchBend').$new(chan, $rb_plus((msb['$<<'](7)), lsb), self.curr_ticks));
          return self.$track_uses_channel(chan);
        });

        Opal.defn(self, '$program', function(chan, program) {
          var self = this;

          self.track.$events()['$<<']($scope.get('ProgramChange').$new(chan, program, self.curr_ticks));
          return self.$track_uses_channel(chan);
        });

        Opal.defn(self, '$chan_pressure', function(chan, press) {
          var self = this;

          self.track.$events()['$<<']($scope.get('ChannelPressure').$new(chan, press, self.curr_ticks));
          return self.$track_uses_channel(chan);
        });

        Opal.defn(self, '$sysex', function(msg) {
          var self = this;

          return self.track.$events()['$<<']($scope.get('SystemExclusive').$new(msg, self.curr_ticks));
        });

        Opal.defn(self, '$meta_misc', function(type, msg) {
          var self = this;

          return self.track.$events()['$<<']($scope.get('MetaEvent').$new(type, msg, self.curr_ticks));
        });

        Opal.defn(self, '$text', function(type, msg) {
          var $a, $b, self = this, $case = nil;
          if ($gvars.DEBUG == null) $gvars.DEBUG = nil;
          if ($gvars.stderr == null) $gvars.stderr = nil;

          return (function() {$case = type;if ($scope.get('META_TEXT')['$===']($case) || $scope.get('META_LYRIC')['$===']($case) || $scope.get('META_CUE')['$===']($case)) {return self.track.$events()['$<<']($scope.get('MetaEvent').$new(type, msg, self.curr_ticks))}else if ($scope.get('META_SEQ_NAME')['$===']($case) || $scope.get('META_COPYRIGHT')['$===']($case)) {return self.track.$events()['$<<']($scope.get('MetaEvent').$new(type, msg, 0))}else if ($scope.get('META_INSTRUMENT')['$===']($case)) {return (($a = [msg]), $b = self.track, $b['$instrument='].apply($b, $a), $a[$a.length-1])}else if ($scope.get('META_MARKER')['$===']($case)) {return self.track.$events()['$<<']($scope.get('Marker').$new(msg, self.curr_ticks))}else {if ((($a = $gvars.DEBUG) !== nil && (!$a.$$is_boolean || $a == true))) {
            return $gvars.stderr.$puts("text = " + (msg) + ", type = " + (type))
            } else {
            return nil
          }}})();
        });

        Opal.defn(self, '$time_signature', function(numer, denom, clocks, qnotes) {
          var self = this;

          self.seq.$time_signature(numer, denom, clocks, qnotes);
          return self.track.$events()['$<<']($scope.get('TimeSig').$new(numer, denom, clocks, qnotes, self.curr_ticks));
        });

        Opal.defn(self, '$tempo', function(microsecs) {
          var self = this;

          return self.track.$events()['$<<']($scope.get('Tempo').$new(microsecs, self.curr_ticks));
        });

        Opal.defn(self, '$key_signature', function(sharpflat, is_minor) {
          var self = this;

          return self.track.$events()['$<<']($scope.get('KeySig').$new(sharpflat, is_minor, self.curr_ticks));
        });

        return (Opal.defn(self, '$track_uses_channel', function(chan) {
          var self = this;

          return self.chan_mask = self.chan_mask['$|'](((1)['$<<'](chan)));
        }), nil) && 'track_uses_channel';
      })($scope.base, $scope.get('MIDIFile'))
    })($scope.base)
  })($scope.base);
};

/* Generated by Opal 0.9.2 */
Opal.modules["midilib/io/seqwriter"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  function $rb_ge(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs >= rhs : lhs['$>='](rhs);
  }
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module, $klass = Opal.klass;

  Opal.add_stubs(['$require', '$new', '$write_header', '$call', '$length', '$tracks', '$each_with_index', '$write_track', '$print', '$write32', '$write16', '$ppqn', '$tell', '$write_instrument', '$instrument', '$each', '$!', '$kind_of?', '$write_var_len', '$delta_time', '$data_as_bytes', '$[]', '$possibly_munge_due_to_running_status_byte', '$+', '$write_bytes', '$events', '$seek', '$>=', '$&', '$!=', '$==', '$[]=', '$as_var_len', '$<', '$|', '$-@', '$putc', '$>>']);
  self.$require("midilib/event");
  self.$require("midilib/utils");
  return (function($base) {
    var $MIDI, self = $MIDI = $module($base, 'MIDI');

    var def = self.$$proto, $scope = self.$$scope;

    (function($base) {
      var $IO, self = $IO = $module($base, 'IO');

      var def = self.$$proto, $scope = self.$$scope;

      (function($base, $super) {
        function $SeqWriter(){}
        var self = $SeqWriter = $klass($base, $super, 'SeqWriter', $SeqWriter);

        var def = self.$$proto, $scope = self.$$scope, TMP_1;

        def.update_block = def.seq = def.io = def.bytes_written = nil;
        Opal.defn(self, '$initialize', TMP_1 = function(seq, proc) {
          var self = this, $iter = TMP_1.$$p, $yield = $iter || nil;

          if (proc == null) {
            proc = nil
          }
          TMP_1.$$p = null;
          self.seq = seq;
          return self.update_block = (function() {if (($yield !== nil)) {
            return $scope.get('Proc').$new()
            } else {
            return proc
          } return nil; })();
        });

        Opal.defn(self, '$write_to', function(io) {
          var $a, $b, TMP_2, self = this;

          self.io = io;
          self.bytes_written = 0;
          self.$write_header();
          if ((($a = self.update_block) !== nil && (!$a.$$is_boolean || $a == true))) {
            self.update_block.$call(nil, self.seq.$tracks().$length(), 0)}
          return ($a = ($b = self.seq.$tracks()).$each_with_index, $a.$$p = (TMP_2 = function(track, i){var self = TMP_2.$$s || this, $a;
            if (self.update_block == null) self.update_block = nil;
            if (self.seq == null) self.seq = nil;
if (track == null) track = nil;if (i == null) i = nil;
          self.$write_track(track);
            if ((($a = self.update_block) !== nil && (!$a.$$is_boolean || $a == true))) {
              return self.update_block.$call(track, self.seq.$tracks().$length(), i)
              } else {
              return nil
            }}, TMP_2.$$s = self, TMP_2), $a).call($b);
        });

        Opal.defn(self, '$write_header', function() {
          var self = this;

          self.io.$print("MThd");
          self.$write32(6);
          self.$write16(1);
          self.$write16(self.seq.$tracks().$length());
          return self.$write16(self.seq.$ppqn());
        });

        Opal.defn(self, '$write_track', function(track) {
          var $a, $b, TMP_3, self = this, track_size_file_pos = nil, prev_event = nil, prev_status = nil, event = nil;

          self.io.$print("MTrk");
          track_size_file_pos = self.io.$tell();
          self.$write32(0);
          self.bytes_written = 0;
          self.$write_instrument(track.$instrument());
          prev_event = nil;
          prev_status = 0;
          ($a = ($b = track.$events()).$each, $a.$$p = (TMP_3 = function(event){var self = TMP_3.$$s || this, $a, data = nil, status = nil;
            if (self.bytes_written == null) self.bytes_written = nil;
if (event == null) event = nil;
          if ((($a = event['$kind_of?']($scope.get('Realtime'))['$!']()) !== nil && (!$a.$$is_boolean || $a == true))) {
              self.$write_var_len(event.$delta_time())}
            data = event.$data_as_bytes();
            status = data['$[]'](0);
            status = self.$possibly_munge_due_to_running_status_byte(data, prev_status);
            self.bytes_written = $rb_plus(self.bytes_written, self.$write_bytes(data));
            prev_event = event;
            return prev_status = status;}, TMP_3.$$s = self, TMP_3), $a).call($b);
          event = $scope.get('MetaEvent').$new($scope.get('META_TRACK_END'));
          self.$write_var_len(0);
          self.bytes_written = $rb_plus(self.bytes_written, self.$write_bytes(event.$data_as_bytes()));
          self.io.$seek(track_size_file_pos);
          self.$write32(self.bytes_written);
          return self.io.$seek(0, ((Opal.get('IO')).$$scope.get('SEEK_END')));
        });

        Opal.defn(self, '$possibly_munge_due_to_running_status_byte', function(data, prev_status) {
          var $a, $b, self = this, status = nil, chan = nil;

          status = data['$[]'](0);
          if ((($a = ((($b = $rb_ge(status, 240)) !== false && $b !== nil) ? $b : $rb_ge(prev_status, 240))) !== nil && (!$a.$$is_boolean || $a == true))) {
            return status}
          chan = (status['$&'](15));
          if ((($a = chan['$!=']((prev_status['$&'](15)))) !== nil && (!$a.$$is_boolean || $a == true))) {
            return status}
          status = (status['$&'](240));
          prev_status = (prev_status['$&'](240));
          if (status['$=='](prev_status)) {
            data['$[]='](0, 1, []);
            return $rb_plus(status, chan);
          } else if ((($a = (($b = status['$==']($scope.get('NOTE_OFF'))) ? data['$[]'](2)['$=='](64) : status['$==']($scope.get('NOTE_OFF')))) !== nil && (!$a.$$is_boolean || $a == true))) {
            data['$[]='](2, 0);
            status = $rb_plus($scope.get('NOTE_ON'), chan);
            if (prev_status['$==']($scope.get('NOTE_ON'))) {
              data['$[]='](0, 1, [])
              } else {
              data['$[]='](0, status)
            }
            return status;
            } else {
            return $rb_plus(status, chan)
          }
        });

        Opal.defn(self, '$write_instrument', function(instrument) {
          var self = this, event = nil, data = nil;

          event = $scope.get('MetaEvent').$new($scope.get('META_INSTRUMENT'), instrument);
          self.$write_var_len(0);
          data = event.$data_as_bytes();
          return self.bytes_written = $rb_plus(self.bytes_written, self.$write_bytes(data));
        });

        Opal.defn(self, '$write_var_len', function(val) {
          var self = this, buffer = nil;

          buffer = $scope.get('Utils').$as_var_len(val);
          return self.bytes_written = $rb_plus(self.bytes_written, self.$write_bytes(buffer));
        });

        Opal.defn(self, '$write16', function(val) {
          var $a, self = this, buffer = nil;

          if ((($a = $rb_lt(val, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
            val = (val['$-@']()['$|'](32768))}
          buffer = [];
          self.io.$putc((val['$>>'](8))['$&'](255));
          self.io.$putc(val['$&'](255));
          return self.bytes_written = $rb_plus(self.bytes_written, 2);
        });

        Opal.defn(self, '$write32', function(val) {
          var $a, self = this;

          if ((($a = $rb_lt(val, 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
            val = (val['$-@']()['$|'](2147483648))}
          self.io.$putc((val['$>>'](24))['$&'](255));
          self.io.$putc((val['$>>'](16))['$&'](255));
          self.io.$putc((val['$>>'](8))['$&'](255));
          self.io.$putc(val['$&'](255));
          return self.bytes_written = $rb_plus(self.bytes_written, 4);
        });

        return (Opal.defn(self, '$write_bytes', function(bytes) {
          var $a, $b, TMP_4, self = this;

          ($a = ($b = bytes).$each, $a.$$p = (TMP_4 = function(b){var self = TMP_4.$$s || this;
            if (self.io == null) self.io = nil;
if (b == null) b = nil;
          return self.io.$putc(b)}, TMP_4.$$s = self, TMP_4), $a).call($b);
          return bytes.$length();
        }), nil) && 'write_bytes';
      })($scope.base, null)
    })($scope.base)
  })($scope.base);
};

/* Generated by Opal 0.9.2 */
Opal.modules["midilib/measure"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  function $rb_ge(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs >= rhs : lhs['$>='](rhs);
  }
  function $rb_le(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs <= rhs : lhs['$<='](rhs);
  }
  function $rb_times(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs * rhs : lhs['$*'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module, $klass = Opal.klass;

  Opal.add_stubs(['$require', '$attr_reader', '$-', '$+', '$**', '$/', '$to_f', '$>=', '$time_from_start', '$<=', '$detect', '$contains_event?', '$measure_for_event', '$start', '$*', '$metronome_ticks', '$sprintf', '$measure_number', '$to_i']);
  self.$require("midilib/consts");
  return (function($base) {
    var $MIDI, self = $MIDI = $module($base, 'MIDI');

    var def = self.$$proto, $scope = self.$$scope;

    (function($base, $super) {
      function $Measure(){}
      var self = $Measure = $klass($base, $super, 'Measure', $Measure);

      var def = self.$$proto, $scope = self.$$scope;

      def.numerator = def.denominator = def.metronome_ticks = def.measure_number = def.start = def.end = nil;
      self.$attr_reader("numerator");

      self.$attr_reader("denominator");

      self.$attr_reader("start");

      self.$attr_reader("end");

      self.$attr_reader("measure_number");

      self.$attr_reader("metronome_ticks");

      Opal.defn(self, '$initialize', function(meas_no, start_time, duration, numer, denom, met_ticks) {
        var self = this;

        self.measure_number = meas_no;
        self.start = start_time;
        self.end = $rb_minus($rb_plus(start_time, duration), 1);
        self.numerator = numer;
        self.denominator = denom;
        return self.metronome_ticks = met_ticks;
      });

      Opal.defn(self, '$to_s', function() {
        var self = this, t = nil, m = nil;

        t = "" + (self.numerator) + "/" + ((2)['$**'](self.denominator));
        m = $rb_divide(self.metronome_ticks.$to_f(), 24);
        return "measure " + (self.measure_number) + "  " + (self.start) + "-" + (self.end) + "  " + (t) + "   " + (m) + " qs metronome";
      });

      return (Opal.defn(self, '$contains_event?', function(e) {
        var $a, self = this;

        return ($a = ($rb_ge(e.$time_from_start(), self.start)), $a !== false && $a !== nil ?($rb_le(e.$time_from_start(), self.end)) : $a);
      }), nil) && 'contains_event?';
    })($scope.base, null);

    (function($base, $super) {
      function $Measures(){}
      var self = $Measures = $klass($base, $super, 'Measures', $Measures);

      var def = self.$$proto, $scope = self.$$scope, TMP_1;

      def.ppqd = nil;
      self.$attr_reader("max_time");

      self.$attr_reader("ppqd");

      Opal.defn(self, '$initialize', TMP_1 = function(max_time, ppqd) {
        var self = this, $iter = TMP_1.$$p, $yield = $iter || nil;

        TMP_1.$$p = null;
        Opal.find_super_dispatcher(self, 'initialize', TMP_1, null).apply(self, [0]);
        self.max_time = max_time;
        return self.ppqd = ppqd;
      });

      Opal.defn(self, '$measure_for_event', function(e) {
        var $a, $b, TMP_2, self = this;

        return ($a = ($b = self).$detect, $a.$$p = (TMP_2 = function(m){var self = TMP_2.$$s || this;
if (m == null) m = nil;
        return m['$contains_event?'](e)}, TMP_2.$$s = self, TMP_2), $a).call($b);
      });

      return (Opal.defn(self, '$to_mbt', function(e) {
        var self = this, m = nil, b = nil;

        m = self.$measure_for_event(e);
        b = $rb_divide(($rb_minus(e.$time_from_start().$to_f(), m.$start().$to_f())), self.ppqd);
        b = $rb_times(b, $rb_divide(24, m.$metronome_ticks()));
        return self.$sprintf("%d:%02d:%03d", m.$measure_number(), $rb_plus(b.$to_i(), 1), $rb_times(($rb_minus(b, b.$to_i())), self.ppqd));
      }), nil) && 'to_mbt';
    })($scope.base, $scope.get('Array'));
  })($scope.base);
};

/* Generated by Opal 0.9.2 */
Opal.modules["midilib/sequence"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_times(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs * rhs : lhs['$*'](rhs);
  }
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $module = Opal.module, $klass = Opal.klass, $hash2 = Opal.hash2, $gvars = Opal.gvars;

  Opal.add_stubs(['$require', '$include', '$attr_accessor', '$new', '$nil?', '$empty?', '$detect', '$kind_of?', '$events', '$first', '$mpq_to_bpm', '$tempo', '$alias_method', '$*', '$/', '$to_f', '$beats_per_minute', '$length_to_delta', '$note_to_length', '$strip!', '$=~', '$[]', '$raise', '$to_i', '$name', '$name=', '$read_from', '$write_to', '$each', '$<<', '$>', '$time_from_start', '$sort', '$<=>', '$time_from_start=', '$-', '$%', '$+', '$upto', '$numerator', '$denominator', '$metronome_ticks', '$measure_duration']);
  self.$require("midilib/io/seqreader");
  self.$require("midilib/io/seqwriter");
  self.$require("midilib/measure.rb");
  return (function($base) {
    var $MIDI, self = $MIDI = $module($base, 'MIDI');

    var def = self.$$proto, $scope = self.$$scope;

    (function($base, $super) {
      function $Sequence(){}
      var self = $Sequence = $klass($base, $super, 'Sequence', $Sequence);

      var def = self.$$proto, $scope = self.$$scope, TMP_2, TMP_3, TMP_5;

      def.tracks = def.ppqn = def.reader_class = def.writer_class = nil;
      self.$include($scope.get('Enumerable'));

      Opal.cdecl($scope, 'UNNAMED', "Unnamed Sequence");

      Opal.cdecl($scope, 'DEFAULT_TEMPO', 120);

      Opal.cdecl($scope, 'NOTE_TO_LENGTH', $hash2(["whole", "half", "quarter", "eighth", "8th", "sixteenth", "16th", "thirty second", "thirtysecond", "32nd", "sixty fourth", "sixtyfourth", "64th"], {"whole": 4.0, "half": 2.0, "quarter": 1.0, "eighth": 0.5, "8th": 0.5, "sixteenth": 0.25, "16th": 0.25, "thirty second": 0.125, "thirtysecond": 0.125, "32nd": 0.125, "sixty fourth": 0.0625, "sixtyfourth": 0.0625, "64th": 0.0625}));

      self.$attr_accessor("tracks");

      self.$attr_accessor("ppqn");

      self.$attr_accessor("format");

      self.$attr_accessor("numer", "denom", "clocks", "qnotes");

      self.$attr_accessor("reader_class");

      self.$attr_accessor("writer_class");

      Opal.defn(self, '$initialize', function() {
        var self = this;

        self.tracks = $scope.get('Array').$new();
        self.ppqn = 480;
        self.numer = 4;
        self.denom = 2;
        self.clocks = 24;
        self.qnotes = 8;
        self.reader_class = (($scope.get('IO')).$$scope.get('SeqReader'));
        return self.writer_class = (($scope.get('IO')).$$scope.get('SeqWriter'));
      });

      Opal.defn(self, '$time_signature', function(numer, denom, clocks, qnotes) {
        var self = this;

        self.numer = numer;
        self.denom = denom;
        self.clocks = clocks;
        return self.qnotes = qnotes;
      });

      Opal.defn(self, '$beats_per_minute', function() {
        var $a, $b, TMP_1, self = this, event = nil;

        if ((($a = ((($b = self.tracks['$nil?']()) !== false && $b !== nil) ? $b : self.tracks['$empty?']())) !== nil && (!$a.$$is_boolean || $a == true))) {
          return $scope.get('DEFAULT_TEMPO')}
        event = ($a = ($b = self.tracks.$first().$events()).$detect, $a.$$p = (TMP_1 = function(e){var self = TMP_1.$$s || this;
if (e == null) e = nil;
        return e['$kind_of?']((($scope.get('MIDI')).$$scope.get('Tempo')))}, TMP_1.$$s = self, TMP_1), $a).call($b);
        return (function() {if (event !== false && event !== nil) {
          return ($scope.get('Tempo').$mpq_to_bpm(event.$tempo()))
          } else {
          return $scope.get('DEFAULT_TEMPO')
        } return nil; })();
      });

      self.$alias_method("bpm", "beats_per_minute");

      self.$alias_method("tempo", "beats_per_minute");

      Opal.defn(self, '$pulses_to_seconds', function(pulses) {
        var self = this;

        return $rb_times(($rb_divide($rb_divide(pulses.$to_f(), self.ppqn.$to_f()), self.$beats_per_minute())), 60.0);
      });

      Opal.defn(self, '$note_to_delta', function(name) {
        var self = this;

        return self.$length_to_delta(self.$note_to_length(name));
      });

      Opal.defn(self, '$note_to_length', function(name) {
        var $a, $b, self = this, dotted = nil, note_name = nil, triplet = nil, mult = nil, len = nil;

        name['$strip!']();
        name['$=~'](/^(dotted)?(.*?)(triplet)?$/);
        $a = [(($b = $gvars['~']) === nil ? nil : $b['$[]'](1)), (($b = $gvars['~']) === nil ? nil : $b['$[]'](2)), (($b = $gvars['~']) === nil ? nil : $b['$[]'](3))], dotted = $a[0], note_name = $a[1], triplet = $a[2], $a;
        note_name['$strip!']();
        mult = 1.0;
        if (dotted !== false && dotted !== nil) {
          mult = 1.5}
        if (triplet !== false && triplet !== nil) {
          mult = $rb_divide(mult, 3.0)}
        len = $scope.get('NOTE_TO_LENGTH')['$[]'](note_name);
        if (len !== false && len !== nil) {
          } else {
          self.$raise("Sequence.note_to_length: \"" + (note_name) + "\" not understood in \"" + (name) + "\"")
        }
        return $rb_times(len, mult);
      });

      Opal.defn(self, '$length_to_delta', function(length) {
        var self = this;

        return ($rb_times(self.ppqn, length)).$to_i();
      });

      Opal.defn(self, '$name', function() {
        var $a, self = this;

        if ((($a = self.tracks['$empty?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
          return $scope.get('UNNAMED')}
        return self.tracks.$first().$name();
      });

      Opal.defn(self, '$name=', function(name) {
        var $a, $b, self = this;

        if ((($a = self.tracks['$empty?']()) !== nil && (!$a.$$is_boolean || $a == true))) {
          return nil}
        return (($a = [name]), $b = self.tracks.$first(), $b['$name='].apply($b, $a), $a[$a.length-1]);
      });

      Opal.defn(self, '$read', TMP_2 = function(io, proc) {
        var self = this, $iter = TMP_2.$$p, $yield = $iter || nil, reader = nil;

        if (proc == null) {
          proc = nil
        }
        TMP_2.$$p = null;
        reader = self.reader_class.$new(self, (function() {if (($yield !== nil)) {
          return $scope.get('Proc').$new()
          } else {
          return proc
        } return nil; })());
        return reader.$read_from(io);
      });

      Opal.defn(self, '$write', TMP_3 = function(io, proc) {
        var self = this, $iter = TMP_3.$$p, $yield = $iter || nil, writer = nil;

        if (proc == null) {
          proc = nil
        }
        TMP_3.$$p = null;
        writer = self.writer_class.$new(self, (function() {if (($yield !== nil)) {
          return $scope.get('Proc').$new()
          } else {
          return proc
        } return nil; })());
        return writer.$write_to(io);
      });

      Opal.defn(self, '$each', TMP_5 = function() {
        var $a, $b, TMP_4, self = this, $iter = TMP_5.$$p, $yield = $iter || nil;

        TMP_5.$$p = null;
        return ($a = ($b = self.tracks).$each, $a.$$p = (TMP_4 = function(track){var self = TMP_4.$$s || this, $a;
if (track == null) track = nil;
        return $a = Opal.yield1($yield, track), $a === $breaker ? $a : $a}, TMP_4.$$s = self, TMP_4), $a).call($b);
      });

      return (Opal.defn(self, '$get_measures', function() {
        var $a, $b, TMP_6, $c, TMP_8, $d, TMP_9, self = this, time_sigs = nil, max_pos = nil, t = nil, measure_length = nil, oldnumer = nil, olddenom = nil, oldbeats = nil, measures = nil, curr_pos = nil, curr_meas_no = nil;

        time_sigs = [];
        max_pos = 0;
        ($a = ($b = self.tracks).$each, $a.$$p = (TMP_6 = function(t){var self = TMP_6.$$s || this, $a, $b, TMP_7;
if (t == null) t = nil;
        return ($a = ($b = t).$each, $a.$$p = (TMP_7 = function(e){var self = TMP_7.$$s || this, $a;
if (e == null) e = nil;
          if ((($a = e['$kind_of?']((($scope.get('MIDI')).$$scope.get('TimeSig')))) !== nil && (!$a.$$is_boolean || $a == true))) {
              time_sigs['$<<'](e)}
            if ((($a = $rb_gt(e.$time_from_start(), max_pos)) !== nil && (!$a.$$is_boolean || $a == true))) {
              return max_pos = e.$time_from_start()
              } else {
              return nil
            }}, TMP_7.$$s = self, TMP_7), $a).call($b)}, TMP_6.$$s = self, TMP_6), $a).call($b);
        ($a = ($c = time_sigs).$sort, $a.$$p = (TMP_8 = function(x, y){var self = TMP_8.$$s || this;
if (x == null) x = nil;if (y == null) y = nil;
        return x.$time_from_start()['$<=>'](y.$time_from_start())}, TMP_8.$$s = self, TMP_8), $a).call($c);
        t = (($scope.get('MIDI')).$$scope.get('TimeSig')).$new(4, 2, 24, 8, 0);
        (($a = [max_pos]), $d = t, $d['$time_from_start='].apply($d, $a), $a[$a.length-1]);
        time_sigs['$<<'](t);
        measure_length = $rb_times(self.ppqn, 4);
        $a = [4, 2, 24], oldnumer = $a[0], olddenom = $a[1], oldbeats = $a[2], $a;
        measures = (($scope.get('MIDI')).$$scope.get('Measures')).$new(max_pos, self.ppqn);
        curr_pos = 0;
        curr_meas_no = 1;
        ($a = ($d = time_sigs).$each, $a.$$p = (TMP_9 = function(te){var self = TMP_9.$$s || this, $a, $b, TMP_10, meas_count = nil;
          if (self.ppqn == null) self.ppqn = nil;
if (te == null) te = nil;
        meas_count = $rb_divide(($rb_minus(te.$time_from_start(), curr_pos)), measure_length);
          if ((($a = $rb_gt(($rb_minus(te.$time_from_start(), curr_pos))['$%'](measure_length), 0)) !== nil && (!$a.$$is_boolean || $a == true))) {
            meas_count = $rb_plus(meas_count, 1)}
          ($a = ($b = (1)).$upto, $a.$$p = (TMP_10 = function(i){var self = TMP_10.$$s || this;
if (i == null) i = nil;
          measures['$<<']((($scope.get('MIDI')).$$scope.get('Measure')).$new(curr_meas_no, curr_pos, measure_length, oldnumer, olddenom, oldbeats));
            curr_meas_no = $rb_plus(curr_meas_no, 1);
            return curr_pos = $rb_plus(curr_pos, measure_length);}, TMP_10.$$s = self, TMP_10), $a).call($b, meas_count);
          $a = [te.$numerator(), te.$denominator(), te.$metronome_ticks()], oldnumer = $a[0], olddenom = $a[1], oldbeats = $a[2], $a;
          return measure_length = te.$measure_duration(self.ppqn);}, TMP_9.$$s = self, TMP_9), $a).call($d);
        return measures;
      }), nil) && 'get_measures';
    })($scope.base, null)
  })($scope.base);
};

/* Generated by Opal 0.9.2 */
Opal.modules["midilib"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice;

  Opal.add_stubs(['$require']);
  self.$require("midilib/info");
  self.$require("midilib/sequence");
  self.$require("midilib/track");
  self.$require("midilib/io/seqreader");
  return self.$require("midilib/io/seqwriter");
};

/* Generated by Opal 0.9.2 */
Opal.modules["module_template"] = function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice;

  Opal.add_stubs(['$strftime', '$new', '$join']);
  return (Opal.defn(Opal.Object, '$module_header', function(title, play_order, ornaments_txt) {
    var self = this;

    return "[Module]\nVortexTrackerII=0\nVersion=3.5\nTitle=" + (title) + "\nAuthor=oisee/siril^4d " + ($scope.get('Time').$new().$strftime("%Y.%m.%d")) + "\nNoteTable=4\nChipFreq=1750000\nSpeed=4\nPlayOrder=" + (play_order) + "\nArgList=" + ($scope.get('ARGV').$join(" ")) + "\n\n" + (ornaments_txt) + "\n\n[Sample1]\nTnE +000_ +00_ F_\nTnE +000_ +00_ F_\nTnE +000_ +00_ F_\nTnE +000_ +00_ D_\nTnE +000_ +00_ B_\nTnE +000_ +00_ B_ L\n\n[Sample2]\nTnE +000_ +00_ F_ L\n\n[Sample3]\nTnE +001_ +00_ F_\nTnE +002_ +00_ F_\nTnE +001_ +00_ E_\nTnE +002_ +00_ E_\nTnE +000_ +00_ E_ L\nTnE -001_ +00_ E_\nTnE -002_ +00_ E_\nTnE -001_ +00_ E_\nTnE +000_ +00_ E_\nTnE +001_ +00_ E_\nTnE +002_ +00_ E_\nTnE +001_ +00_ E_\n\n[Sample4]\nTnE +002_ +00_ D_\nTnE +002_ +00_ D_\nTnE +002_ +00_ C_\nTnE +002_ +00_ B_\nTnE +002_ +00_ A_ L\nTnE +002_ +00_ A_\nTnE +002_ +00_ A_\nTnE +002_ +00_ A_\nTnE +002_ +00_ A_\nTnE +002_ +00_ A_\nTnE +002_ +00_ A_\nTnE +002_ +00_ A_\n\n[Sample5]\nTnE +000_ +00_ F_\nTnE +000_ +00_ F_\ntne +000_ +00_ 0_ L\n\n[Sample6]\nTnE -001_ +00_ F_ L\n\n[Sample7]\nTnE +006_ +00_ F_ L\n\n[Sample8]\ntNe +000_ +00_ F_\ntNe +000_ +00_ B_\ntNe +000_ +00_ 7_\ntNe +000_ +00_ 6- L\n\n[Sample9]\nTnE +080_ +00_ F_\nTnE +100_ +00_ E_\nTnE +180_ +00_ E_\nTnE +200_ +00_ E_\nTnE +240_ +00_ D_\nTnE +280_ +00_ D_\nTnE +2C0_ +00_ D_\nTnE +300_ +00_ C_\nTnE +300_ +00_ C_\nTnE +340_ +00_ C_\nTnE +340_ +00_ C_\nTnE +380_ +00_ B_\nTnE +380_ +00_ B_\nTnE +400_ +00_ B_\nTnE +400_ +00_ B_\nTnE +480_ +00_ A_\nTnE +500_ +00_ 9_\nTnE +580_ +00_ 7_\nTnE +600_ +00_ 4_\nTnE +680_ +00_ 1_\nTnE +000_ +00_ 0_ L\n\n[Sample10]\nTne +1C0_ +00_ F_\nTne +280_ +00_ E_\nTne +380_ +00_ C_\nTne +440_ +00_ A_\nTne +480_ +00_ 8_\nTnE +000_ +00_ 0_ L\n\n[Sample11]\nTNe +200_ -0A_ F_\ntNe +000_ +0F_ A_\nTNe +200_ -07_ E_\ntNe +000_ +0E_ B- L\n\n[Sample12]\nTNE +0A0_ +05_ F_\nTNE +140_ +02_ D_\nTNE +140_ +02_ B_\nTNE +100_ +00_ A_ L\nTNE +140_ +00_ A_\nTNE +200_ +00_ A-\n\n[Sample13]\nTne +200_ +00_ F_\nTne +2C0_ +00_ F_\nTne +380_ +00_ E_\nTne +500_ +00_ C_\nTne +520_ +00_ 9_\ntne +000_ +00_ 0_ L\n\n[Sample14]\nTNE -100_ +00_ F_\nTNE -100_ +00_ D_\nTNE -100_ +00_ A_\nTNE -100_ +00_ 5_\ntne +000_ +00_ 0_ L\n\n[Sample15]\nTNE -100_ +00_ 5_\nTNE -100_ +00_ 8_\nTNE -100_ +00_ B_\nTNE -100_ +00_ F_\nTNe -100_ +00_ 9- L\n\n[Sample16]\nTnE +000_ +00_ C_\nTnE +000_ +00_ E_\nTnE +000_ +00_ F_\nTnE +000_ +00_ F_\nTnE +000_ +00_ E_\nTnE +000_ +00_ D_\nTnE +000_ +00_ C_\nTnE +000_ +00_ C_ L\nTnE +001_ +00_ C_\nTnE +002_ +00_ C_\nTnE +003_ +00_ C_\nTnE +001_ +00_ C_\nTnE +000_ +00_ C_\nTnE -001_ +00_ C_\nTnE -002_ +00_ C_\nTnE -003_ +00_ C_\nTnE -001_ +00_ C_\nTnE +000_ +00_ C_\nTnE +000_ +00_ C_\n\n[Sample17]\nTne +1C0_ +00_ F_\nTne +280_ +00_ D_\nTne +380_ +00_ 7_\nTNE +000_ +00_ 0_ L\n\n[Sample18]\nTnE -00C_ +00_ 0_ L\n\n[Sample19]\nTNe +000_ +00_ F_\nTNe +000_ +00_ C_\nTNe +000_ +00_ 6_\nTNe +000_ +01_ A- L\n\n[Sample20]\nTNE +140_ +00_ F_\ntNE +000_ +00_ B- L\n\n[Sample21]\ntNE +000_ +00_ D_\ntNE +000_ +00_ 8_\ntNE +000_ +00_ 1_\nTNE +000_ +00_ 0_ L\n\n[Sample22]\nTnE +000_ +00_ D_ L\nTnE +000_ +00_ D_\ntne +000_ +00_ 9_\ntne +000_ +00_ 9_\nTnE +000_ +00_ D_\nTnE +000_ +00_ D_\ntne +000_ +00_ 9_\ntne +000_ +00_ 9_\nTnE +000_ +00_ D_\nTnE +000_ +00_ D_\nTnE +000_ +00_ D_\nTnE +000_ +00_ D_\nTnE +000_ +00_ D_\nTnE +000_ +00_ D_\ntne +000_ +00_ 9_\ntne +000_ +00_ 9_\n\n[Sample23]\nTnE +000_ +00_ F_ L\nTnE +010_ +01_ F_\nTnE +010_ +01_ F_\nTnE +010_ +01_ F_\nTnE +010_ +01_ F_\nTnE +000_ +00_ F_\nTnE +000_ +00_ F_\nTnE -010_ -01_ F_\nTnE -010_ -01_ F_\nTnE -010_ -01_ F_\nTnE -010_ -01_ F_\nTnE +000_ +00_ F_\n\n[Sample24]\nTNe +000_ -01_ C_\nTNe +000_ -01_ D_\nTNe +000_ -01_ E_\nTNe +000_ -01_ F_\nTNe +000_ -01_ F_\nTNe +000_ -01_ F_\nTNe +000_ -01_ F_\nTNe +000_ -01_ F_\nTNe +000_ -01_ E_\nTNe +000_ -01_ E_\nTNe +000_ -01_ E_\nTNe +000_ -01_ F_\nTNe +000_ -01_ F_ L\n\n[Sample25]\nTNE +000_ +00_ F_\nTNE +000_ +00_ F_ L\nTNE +000_ +00_ F_\nTNE +000_ +00_ F_\nTNE +000_ +00_ F-\n\n[Sample26]\ntne +000_ +00_ 0_ L\n\n[Sample27]\nTnE +100_ +05_ F_\nTnE +200_ +02_ A_\nTnE +300_ +02_ 7_\nTNE +400_ +00_ 3- L\n\n[Sample28]\ntne +000_ +00_ 0_ L\n\n[Sample29]\ntnE +000_ +00_ 0_ L\n\n[Sample30]\nTNE +000_ +00_ C+ L\n\n[Sample31]\nTNe +1C0_ +00_ F_\nTne +280_ +00_ E_\nTne +380_ +00_ C_\nTne +440_ +00_ A_\nTne +480_ +00_ 8_\nTnE +000_ +00_ 0_ L";
  }), nil) && 'module_header'
};

/* Generated by Opal 0.9.2 */
(function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  function $rb_plus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs + rhs : lhs['$+'](rhs);
  }
  function $rb_times(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs * rhs : lhs['$*'](rhs);
  }
  function $rb_minus(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs - rhs : lhs['$-'](rhs);
  }
  function $rb_gt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs > rhs : lhs['$>'](rhs);
  }
  function $rb_divide(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs / rhs : lhs['$/'](rhs);
  }
  function $rb_lt(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs < rhs : lhs['$<'](rhs);
  }
  function $rb_ge(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs >= rhs : lhs['$>='](rhs);
  }
  function $rb_le(lhs, rhs) {
    return (typeof(lhs) === 'number' && typeof(rhs) === 'number') ? lhs <= rhs : lhs['$<='](rhs);
  }
  var $a, $b, TMP_1, $c, TMP_42, $d, TMP_44, $e, TMP_48, $f, TMP_51, $g, TMP_52, $h, TMP_53, $i, TMP_55, $j, TMP_56, $k, TMP_61, $l, TMP_63, $m, TMP_64, $n, TMP_67, $o, TMP_69, $p, TMP_72, $q, TMP_77, $r, TMP_79, $s, TMP_80, $t, TMP_81, self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice, $hash2 = Opal.hash2, $klass = Opal.klass, $range = Opal.range, $gvars = Opal.gvars, i = nil, seq = nil, vmod = nil, rmod = nil, penalties = nil, statistic = nil, key_notes = nil, good_key = nil, pmod = nil, ornaments = nil, orn = nil, ornament_counter = nil, lmod = nil, dmod = nil, mmod = nil, abs_index = nil, text_lines = nil, empty_note = nil, pforms = nil, penote = nil, patterns = nil, hashed_patterns = nil, wet_patterns = nil, dry_patterns = nil, map_patterns = nil, use_patterns = nil, wet_play_order = nil, wet_play_order_txt = nil, ornaments_txt = nil, txt_file = nil;
  if ($gvars.set == null) $gvars.set = nil;

  Opal.add_stubs(['$require', '$inject', '$[]=', '$to_s', '$+', '$[]', '$*', '$attr_reader', '$attr_accessor', '$map', '$to_i', '$-', '$split', '$flatten', '$!=', '$delete!', '$==', '$upcase', '$puts', '$inspect', '$per_beat', '$>', '$%', '$/', '$pattern_size', '$<<', '$new', '$open', '$read', '$to_f', '$ppqn', '$sequence', '$cpr', '$note', '$<', '$repitch', '$include', '$<=>', '$note2enote', '$erepitch', '$>=', '$envelope_sample', '$envelope_changes_volume', '$envelope_dsample', '$cool_envelope', '$sample', '$envelope', '$ornament', '$volume', '$type', '$note_is_empty', '$note_is_stop', '$note_is_real', '$clone', '$volume=', '$kind', '$envelope=', '$note2txt', '$===', '$enote_is_real', '$epitch', '$eoct', '$join', '$sort', '$uniq', '$min', '$type=', '$each', '$delete_if', '$max', '$size', '$abs', '$max_offset', '$times', '$orn_repeat', '$sample=', '$note=', '$load_sequence', '$time_from_start', '$off', '$max_row=', '$max_row', '$per_delay', '$per_delay2', '$start', '$sources', '$each_with_index', '$chan_settings', '$print', '$real_key', '$index', '$diatonic_transpose', '$flat_cell_poly', '$flat_cell_mono', '$flat_cell_drum', '$squize_ornament', '$<=', '$samples', '$ornaments', '$note2drum', '$kind=', '$mix_options', '$sources_mix', '$oct', '$print_note', '$print_enote', '$slice', '$skip_lines', '$invert', '$out_file', '$module_header']);
  self.$require("midilib");
  Opal.cdecl($scope, 'PITCHES', ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"]);
  Opal.cdecl($scope, 'PARAMS', [".", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"]);
  i = 0;
  Opal.cdecl($scope, 'S', ($a = ($b = $scope.get('PARAMS')).$inject, $a.$$p = (TMP_1 = function(result, p){var self = TMP_1.$$s || this;
if (result == null) result = nil;if (p == null) p = nil;
  result['$[]='](p.$to_s(), i);
    i = $rb_plus(i, 1);
    return result;}, TMP_1.$$s = self, TMP_1), $a).call($b, $hash2([], {})));
  Opal.cdecl($scope, 'ENV_OFFSETS', [24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 12, 12, 24, 0, 12, 12, 12, 12, 12, 12, 12, 12, 0, 0, 12, -12, 0, 0, 0, 0, 0, -12, 0, 0, -12, -12, 0, -24, -12, -12, -12, -12, -12, -24, -12, -12, -24, -24, -12, -36, -24, -24, -24, -24, -24, -36, -24, -24, -24, -48, -24, -48, -36, -36, -36, -36, -36, -48, -36, -36, -36, -52, -36, -52, -48, -48, -48, -48, -48, -52, -48, -48, -48, -60, -48, -60, -52, -52, -52, -52, -52, -60, -52, -52, -52, -72, -52, -72, -60, -60, -60, -60, -60, -72, -60, -60, -60, -84, -60]);
  Opal.cdecl($scope, 'ENV_OFFSETS_old', [24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 12, 12, 24, 12, 12, 12, 12, 12, 12, 12, 12, 12, 0, 0, 24, 0, 0, 0, 0, 0, 0, 0, 0, 0, -12, -12, 0, -7, -7, 0, -7, -1, -12, -1, -12, 0, -14, -19, -1, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -12, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -24, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36, -36]);
  Opal.cdecl($scope, 'ENV_FORMS', [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 12, 12, 10, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12]);
  Opal.cdecl($scope, 'H1', $scope.get('S')['$[]']("8"));
  Opal.cdecl($scope, 'H2', $scope.get('S')['$[]']("L"));
  Opal.cdecl($scope, 'K1', $scope.get('S')['$[]']("9"));
  Opal.cdecl($scope, 'K2', $scope.get('S')['$[]']("A"));
  Opal.cdecl($scope, 'K3', $scope.get('S')['$[]']("D"));
  Opal.cdecl($scope, 'K4', $scope.get('S')['$[]']("H"));
  Opal.cdecl($scope, 'K5', $scope.get('S')['$[]']("R"));
  Opal.cdecl($scope, 'CL', $scope.get('S')['$[]']("B"));
  Opal.cdecl($scope, 'S1', $scope.get('S')['$[]']("C"));
  Opal.cdecl($scope, 'S2', $scope.get('S')['$[]']("K"));
  Opal.cdecl($scope, 'S3', $scope.get('S')['$[]']("V"));
  Opal.cdecl($scope, 'P1', $scope.get('S')['$[]']("E"));
  Opal.cdecl($scope, 'P2', $scope.get('S')['$[]']("F"));
  Opal.cdecl($scope, 'TM', $scope.get('S')['$[]']("J"));
  Opal.cdecl($scope, 'N1', $scope.get('S')['$[]']("O"));
  Opal.cdecl($scope, 'N2', $scope.get('S')['$[]']("P"));
  Opal.cdecl($scope, 'N3', $scope.get('S')['$[]']("U"));
  Opal.cdecl($scope, 'NOTE2DRUM_SAMPLE', [$scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K2'), $scope.get('K5'), $scope.get('S1'), $scope.get('CL'), $scope.get('S3'), $scope.get('K1'), $scope.get('TM'), $scope.get('K1'), $scope.get('H2'), $scope.get('K1'), $scope.get('K5'), $scope.get('K1'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('TM'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2'), $scope.get('H2')]);
  Opal.cdecl($scope, 'NOTE2DRUM_NOTE', [$rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 6), $rb_times(12, 4), $rb_plus($rb_times(12, 9), 11), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 4), $rb_plus($rb_times(12, 5), 3), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_plus($rb_times(12, 9), 11), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5), $rb_times(12, 5)]);
  Opal.cdecl($scope, 'DEFAULT_MIDI_TEST_FILE', "./test/tottoro_example.mid");
  (function($base, $super) {
    function $Setup(){}
    var self = $Setup = $klass($base, $super, 'Setup', $Setup);

    var def = self.$$proto, $scope = self.$$scope;

    def.sources_mix = def.chan_settings = def.diatonic_transpose = def.in_file = def.cool_envelope = def.envelope_changes_volume = def.clocks_per_row = nil;
    self.$attr_reader("in_file", "out_file", "sources_mix", "samples", "ornaments", "sources", "per_beat", "per_delay", "per_delay2", "pattern_size", "skip_lines", "diatonic_transpose", "real_key", "sequence", "clocks_per_row", "cpr", "chan_settings", "mix_options", "orn_repeat", "max_offset", "cool_envelope", "envelope_changes_volume", "envelope_sample", "envelope_dsample");

    self.$attr_accessor("max_row");

    Opal.defn(self, '$initialize', function() {
      var $a, $b, TMP_2, $c, TMP_4, $d, TMP_6, $e, TMP_8, $f, TMP_10, $g, $h, self = this, source_mapping = nil, pattern_size0 = nil, de_text = nil;

      self.max_row = 0;
      self.in_file = ((($a = $scope.get('ARGV')['$[]'](0)) !== false && $a !== nil) ? $a : $scope.get('DEFAULT_MIDI_TEST_FILE'));
      source_mapping = ((($a = $scope.get('ARGV')['$[]'](1)) !== false && $a !== nil) ? $a : "1d-2me-3p,4m[uf]-5m[2]+,5m[6]-6me[2]+-3p[3]+-2mew+");
      self.sources_mix = ($a = ($b = source_mapping.$split(",")).$map, $a.$$p = (TMP_2 = function(s){var self = TMP_2.$$s || this, $a, $b, TMP_3;
if (s == null) s = nil;
      return ($a = ($b = s.$split("-")).$map, $a.$$p = (TMP_3 = function(x){var self = TMP_3.$$s || this;
if (x == null) x = nil;
        return ($rb_minus(x.$to_i(), 1)).$to_i()}, TMP_3.$$s = self, TMP_3), $a).call($b)}, TMP_2.$$s = self, TMP_2), $a).call($b);
      self.chan_settings = ($a = ($c = source_mapping.$split(",")).$map, $a.$$p = (TMP_4 = function(s){var self = TMP_4.$$s || this, $a, $b, TMP_5;
if (s == null) s = nil;
      return ($a = ($b = s.$split("-")).$map, $a.$$p = (TMP_5 = function(x){var self = TMP_5.$$s || this, $a;
if (x == null) x = nil;
        if ((($a = x['$[]'](/\[(.+)\]/)['$!='](nil)) !== nil && (!$a.$$is_boolean || $a == true))) {
            x['$[]='](/\[(.+)\]/, "")}
          x['$delete!']("0-9[]+");
          if (x.$to_s()['$==']("")) {
            return "m"
            } else {
            return x.$to_s()
          }}, TMP_5.$$s = self, TMP_5), $a).call($b)}, TMP_4.$$s = self, TMP_4), $a).call($c).$flatten();
      self.mix_options = ($a = ($d = source_mapping.$split(",")).$map, $a.$$p = (TMP_6 = function(s){var self = TMP_6.$$s || this, $a, $b, TMP_7;
if (s == null) s = nil;
      return ($a = ($b = s.$split("-")).$map, $a.$$p = (TMP_7 = function(x){var self = TMP_7.$$s || this;
if (x == null) x = nil;
        x['$delete!']("0-9a-zA-Z[]");
          if (x.$to_s()['$==']("")) {
            return "-"
            } else {
            return x.$to_s()
          }}, TMP_7.$$s = self, TMP_7), $a).call($b)}, TMP_6.$$s = self, TMP_6), $a).call($d).$flatten();
      self.sources = self.sources_mix.$flatten();
      self.samples = ($a = ($e = source_mapping.$split(",")).$map, $a.$$p = (TMP_8 = function(s){var self = TMP_8.$$s || this, $a, $b, TMP_9;
if (s == null) s = nil;
      return ($a = ($b = s.$split("-")).$map, $a.$$p = (TMP_9 = function(x){var self = TMP_9.$$s || this, t = nil, r = nil;
if (x == null) x = nil;
        t = x['$[]'](/\[(.+)\]/);
          t = (function() {if (nil['$=='](t)) {
            return nil
            } else {
            return t['$delete!']("[]").$to_s().$upcase()['$[]']($range(0, 0, false))
          } return nil; })();
          return r = (function() {if ($scope.get('S')['$[]'](t)['$=='](nil)) {
            return 2
            } else {
            return $scope.get('S')['$[]'](t)
          } return nil; })();}, TMP_9.$$s = self, TMP_9), $a).call($b)}, TMP_8.$$s = self, TMP_8), $a).call($e).$flatten();
      self.$puts("chan_settings: " + (self.chan_settings.$inspect()));
      self.ornaments = ($a = ($f = source_mapping.$split(",")).$map, $a.$$p = (TMP_10 = function(s){var self = TMP_10.$$s || this, $a, $b, TMP_11;
if (s == null) s = nil;
      return ($a = ($b = s.$split("-")).$map, $a.$$p = (TMP_11 = function(x){var self = TMP_11.$$s || this, t = nil, r = nil;
if (x == null) x = nil;
        t = x['$[]'](/\[(.+)\]/);
          t = (function() {if (nil['$=='](t)) {
            return nil
            } else {
            return t['$delete!']("[]").$to_s().$upcase()['$[]']($range(1, 1, false))
          } return nil; })();
          return r = (function() {if ($scope.get('S')['$[]'](t)['$=='](nil)) {
            return 0
            } else {
            return $scope.get('S')['$[]'](t)
          } return nil; })();}, TMP_11.$$s = self, TMP_11), $a).call($b)}, TMP_10.$$s = self, TMP_10), $a).call($f).$flatten();
      self.per_beat = (((($a = $scope.get('ARGV')['$[]'](2)) !== false && $a !== nil) ? $a : 4)).$to_i();
      self.per_delay = (((($a = $scope.get('ARGV')['$[]'](3)) !== false && $a !== nil) ? $a : 3)).$to_i();
      self.per_delay2 = (((($a = $scope.get('ARGV')['$[]'](4)) !== false && $a !== nil) ? $a : 6)).$to_i();
      pattern_size0 = $rb_times(self.$per_beat(), 64);
      while ((($g = ($h = $rb_gt(pattern_size0, 127), $h !== false && $h !== nil ?pattern_size0['$%'](2)['$=='](0) : $h)) !== nil && (!$g.$$is_boolean || $g == true))) {
      pattern_size0 = $rb_divide(pattern_size0, 2)}
      self.pattern_size = (((($a = $scope.get('ARGV')['$[]'](5)) !== false && $a !== nil) ? $a : pattern_size0)).$to_i();
      self.pattern_size = (function() {if ((($a = (self.$pattern_size()['$=='](0))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return pattern_size0
        } else {
        return self.$pattern_size()
      } return nil; })();
      self.skip_lines = (((($a = $scope.get('ARGV')['$[]'](6)) !== false && $a !== nil) ? $a : 0)).$to_i();
      self.orn_repeat = (((($a = $scope.get('ARGV')['$[]'](7)) !== false && $a !== nil) ? $a : 1)).$to_i();
      self.max_offset = (((($a = $scope.get('ARGV')['$[]'](8)) !== false && $a !== nil) ? $a : 12)).$to_i();
      self.diatonic_transpose = (((($a = $scope.get('ARGV')['$[]'](9)) !== false && $a !== nil) ? $a : 0)).$to_i();
      if ((($a = (self.diatonic_transpose['$=='](0))) !== nil && (!$a.$$is_boolean || $a == true))) {
        de_text = ""
        } else {
        de_text = "d"['$<<'](self.diatonic_transpose.$to_s())
      }
      self.out_file = ""['$<<'](self.in_file)['$<<'](de_text)['$<<']("e.txt");
      self.real_key = (((($a = $scope.get('ARGV')['$[]'](10)) !== false && $a !== nil) ? $a : 13)).$to_i();
      self.cool_envelope = true;
      self.envelope_changes_volume = false;
      self.envelope_sample = (function() {if ((($a = self.cool_envelope) !== nil && (!$a.$$is_boolean || $a == true))) {
        return 2
        } else {
        return 29
      } return nil; })();
      return self.envelope_dsample = (function() {if ((($a = self.envelope_changes_volume) !== nil && (!$a.$$is_boolean || $a == true))) {
        return 18
        } else {
        return 2
      } return nil; })();
    });

    return (Opal.defn(self, '$load_sequence', function() {
      var $a, $b, TMP_12, self = this;

      self.sequence = (($scope.get('MIDI')).$$scope.get('Sequence')).$new();
      ($a = ($b = $scope.get('File')).$open, $a.$$p = (TMP_12 = function(file){var self = TMP_12.$$s || this, $a, $b, TMP_13;
        if (self.sequence == null) self.sequence = nil;
if (file == null) file = nil;
      return ($a = ($b = self.sequence).$read, $a.$$p = (TMP_13 = function(track, num_tracks, index){var self = TMP_13.$$s || this;
if (track == null) track = nil;if (num_tracks == null) num_tracks = nil;if (index == null) index = nil;
        return self.$puts("track " + (track) + ", num_tracks " + (num_tracks) + ", index " + (index))}, TMP_13.$$s = self, TMP_13), $a).call($b, file)}, TMP_12.$$s = self, TMP_12), $a).call($b, self.in_file, "rb");
      self.clocks_per_row = $rb_divide(self.$sequence().$ppqn().$to_f(), self.$per_beat().$to_f());
      return self.cpr = self.clocks_per_row;
    }), nil) && 'load_sequence';
  })($scope.base, null);
  (function($base, $super) {
    function $VModule(){}
    var self = $VModule = $klass($base, $super, 'VModule', $VModule);

    var def = self.$$proto, $scope = self.$$scope;

    self.$attr_accessor("vchannels");

    return (Opal.defn(self, '$initialize', function() {
      var self = this;

      return self.vchannels = [];
    }), nil) && 'initialize';
  })($scope.base, null);
  (function($base, $super) {
    function $VChannel(){}
    var self = $VChannel = $klass($base, $super, 'VChannel', $VChannel);

    var def = self.$$proto, $scope = self.$$scope;

    self.$attr_accessor("cells");

    return (Opal.defn(self, '$initialize', function() {
      var self = this;

      return self.cells = [];
    }), nil) && 'initialize';
  })($scope.base, null);
  (function($base, $super) {
    function $VNote(){}
    var self = $VNote = $klass($base, $super, 'VNote', $VNote);

    var def = self.$$proto, $scope = self.$$scope;

    def.off = def.start = nil;
    self.$attr_accessor("note", "volume", "start", "off", "len");

    Opal.defn(self, '$initialize', function(note, start, off, volume) {
      var self = this, cpr = nil;
      if ($gvars.set == null) $gvars.set = nil;

      cpr = $gvars.set.$cpr();
      self.note = note;
      self.start = ($rb_plus($rb_divide(start.$to_f(), cpr), 0.5)).$to_i();
      self.off = ($rb_plus($rb_divide(off.$to_f(), cpr), 0.5)).$to_i();
      self.len = $rb_minus(self.off, self.start);
      return self.volume = volume;
    });

    return (Opal.defn(self, '$to_s', function() {
      var $a, self = this, pch = nil, oct = nil;

      pch = self.$note()['$%'](12);
      oct = (function() {if ((($a = ($rb_lt(($rb_minus(($rb_divide(self.$note(), 12)), 1)), 1))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return (($rb_divide(self.$note(), 12)))
        } else {
        return ($rb_minus(($rb_divide(self.$note(), 12)), 1))
      } return nil; })();
      return "" + ($scope.get('PITCHES')['$[]'](pch)) + (oct) + " ";
    }), nil) && 'to_s';
  })($scope.base, null);
  (function($base, $super) {
    function $FNote(){}
    var self = $FNote = $klass($base, $super, 'FNote', $FNote);

    var def = self.$$proto, $scope = self.$$scope;

    def.note = def.oct = def.type = def.pitch = nil;
    self.$attr_accessor("note", "volume", "type");

    self.$attr_reader("pitch", "oct");

    Opal.defn(self, '$initialize', function(note, volume, type) {
      var self = this;

      self.note = note;
      self.volume = volume;
      self.type = type;
      return self.$repitch();
    });

    Opal.defn(self, '$repitch', function() {
      var $a, self = this;

      self.pitch = self.note['$%'](12);
      self.oct = (function() {if ((($a = ($rb_lt(($rb_minus(($rb_divide(self.note, 12)), 1)), 1))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return (($rb_divide(self.note, 12)))
        } else {
        return ($rb_minus(($rb_divide(self.note, 12)), 1))
      } return nil; })();
      return self.oct = (function() {if ((($a = ($rb_gt(($rb_minus(($rb_divide(self.note, 12)), 1)), 8))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return 8
        } else {
        return self.oct
      } return nil; })();
    });

    Opal.defn(self, '$note=', function(newval) {
      var self = this;

      self.note = newval;
      return self.$repitch();
    });

    Opal.defn(self, '$to_s', function() {
      var self = this;

      if (self.type['$==']("r")) {
        return "R-- "
        } else {
        return "" + ($scope.get('PITCHES')['$[]'](self.pitch)) + (self.oct) + " " + (self.type) + " "
      }
    });

    self.$include($scope.get('Comparable'));

    return (Opal.defn(self, '$<=>', function(another) {
      var self = this;

      return self.note['$<=>'](another.$note());
    }), nil) && '<=>';
  })($scope.base, null);
  (function($base, $super) {
    function $LNote(){}
    var self = $LNote = $klass($base, $super, 'LNote', $LNote);

    var def = self.$$proto, $scope = self.$$scope;

    def.kind = def.volume = def.note = def.oct = def.enote = def.eoct = def.type = def.pitch = nil;
    self.$attr_accessor("note", "enote", "sample", "envelope", "ornament", "volume", "type", "kind");

    self.$attr_reader("pitch", "oct", "epitch", "eoct", "notetxt", "enotetxt");

    Opal.defn(self, '$initialize', function(note, sample, envelope, ornament, volume, type, kind) {
      var self = this;

      self.note = note;
      self.pnote = note;
      self.sample = sample;
      self.envelope = envelope;
      self.ornament = ornament;
      self.volume = volume;
      self.type = type;
      self.kind = kind;
      self.$repitch();
      self.$note2enote();
      return self.$erepitch();
    });

    Opal.defn(self, '$renew', function() {
      var self = this;

      self.$repitch();
      self.$note2enote();
      return self.$erepitch();
    });

    Opal.defn(self, '$note2enote', function() {
      var $a, self = this;
      if ($gvars.set == null) $gvars.set = nil;

      if (self.kind['$==']("e")) {
        if ((($a = $rb_ge(self.volume, 15)) !== nil && (!$a.$$is_boolean || $a == true))) {
          self.envelope = $scope.get('ENV_FORMS')['$[]'](self.$note());
          self.sample = $gvars.set.$envelope_sample();
          } else {
          self.envelope = (function() {if ((($a = $gvars.set.$envelope_changes_volume()) !== nil && (!$a.$$is_boolean || $a == true))) {
            return $scope.get('ENV_FORMS')['$[]'](self.$note())
            } else {
            return 15
          } return nil; })();
          self.sample = $gvars.set.$envelope_dsample();
          self.pnote = (function() {if ((($a = $gvars.set.$envelope_changes_volume()) !== nil && (!$a.$$is_boolean || $a == true))) {
            return 119
            } else {
            return self.$note()
          } return nil; })();
        }
        return self.enote = (function() {if ((($a = $gvars.set.$cool_envelope()) !== nil && (!$a.$$is_boolean || $a == true))) {
          return $rb_plus(self.note, $scope.get('ENV_OFFSETS')['$[]'](self.note))
          } else {
          return self.note
        } return nil; })();
        } else {
        return self.enote = -1
      }
    });

    Opal.defn(self, '$repitch', function() {
      var $a, self = this;

      self.pitch = self.note['$%'](12);
      self.oct = (function() {if ((($a = ($rb_lt(($rb_minus(($rb_divide(self.note, 12)), 1)), 1))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return (($rb_divide(self.note, 12)))
        } else {
        return ($rb_minus(($rb_divide(self.note, 12)), 1))
      } return nil; })();
      return self.oct = (function() {if ((($a = ($rb_gt(($rb_minus(($rb_divide(self.note, 12)), 1)), 8))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return 8
        } else {
        return self.oct
      } return nil; })();
    });

    Opal.defn(self, '$erepitch', function() {
      var $a, self = this;

      self.epitch = self.enote['$%'](12);
      self.eoct = (function() {if ((($a = ($rb_lt(($rb_minus(($rb_divide(self.enote, 12)), 1)), 1))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return (($rb_divide(self.enote, 12)))
        } else {
        return ($rb_minus(($rb_divide(self.enote, 12)), 1))
      } return nil; })();
      return self.eoct = (function() {if ((($a = ($rb_gt(($rb_minus(($rb_divide(self.enote, 12)), 1)), 8))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return 8
        } else {
        return self.eoct
      } return nil; })();
    });

    Opal.defn(self, '$note=', function(newval) {
      var self = this;

      self.note = newval;
      self.$repitch();
      self.$note2enote();
      return self.$erepitch();
    });

    Opal.defn(self, '$kind=', function(newval) {
      var self = this;

      self.kind = newval;
      self.$repitch();
      self.$note2enote();
      return self.$erepitch();
    });

    Opal.defn(self, '$volume=', function(newval) {
      var self = this;

      self.volume = newval;
      self.$repitch();
      self.$note2enote();
      return self.$erepitch();
    });

    Opal.defn(self, '$envelope=', function(newval) {
      var self = this;

      self.envelope = newval;
      self.$repitch();
      self.$note2enote();
      return self.$erepitch();
    });

    Opal.defn(self, '$to_s', function() {
      var self = this;

      if (self.type['$==']("r")) {
        return "R--"
      } else if (self.type['$=='](".")) {
        return "---"
        } else {
        return "" + ($scope.get('PITCHES')['$[]'](self.pitch)) + (self.oct)
      }
    });

    self.$include($scope.get('Comparable'));

    return (Opal.defn(self, '$<=>', function(another) {
      var self = this;

      return self.note['$<=>'](another.$note());
    }), nil) && '<=>';
  })($scope.base, null);
  Opal.defn(Opal.Object, '$note2txt', function(note) {
    var self = this, text = nil;

    return text = "" + (note.$to_s()) + " " + ($scope.get('PARAMS')['$[]'](note.$sample())) + ($scope.get('PARAMS')['$[]'](note.$envelope()['$%'](16))) + ($scope.get('PARAMS')['$[]'](note.$ornament()['$%'](16))) + ($scope.get('PARAMS')['$[]'](note.$volume())) + " ....";
  });
  Opal.defn(Opal.Object, '$note_is_real', function(note) {
    var $a, $b, self = this;

    return (($a = ($b = nil['$!='](note), $b !== false && $b !== nil ?note.$type()['$!=']("r") : $b), $a !== false && $a !== nil ?note.$type()['$!='](".") : $a));
  });
  Opal.defn(Opal.Object, '$note_is_stop', function(note) {
    var $a, self = this;

    return (($a = nil['$!='](note), $a !== false && $a !== nil ?note.$type()['$==']("r") : $a));
  });
  Opal.defn(Opal.Object, '$note_is_empty', function(note) {
    var $a, self = this;

    return (((($a = nil['$=='](note)) !== false && $a !== nil) ? $a : note.$type()['$=='](".")));
  });
  Opal.defn(Opal.Object, '$print_note', function(note) {
    var $a, $b, $c, $d, self = this, text = nil;

    if ((($a = self.$note_is_empty(note)) !== nil && (!$a.$$is_boolean || $a == true))) {
      text = "--- ." + ($scope.get('PARAMS')['$[]'](note.$envelope()['$%'](16))) + ".. ...."
    } else if ((($a = self.$note_is_stop(note)) !== nil && (!$a.$$is_boolean || $a == true))) {
      text = "R-- .... ...."
    } else if ((($a = self.$note_is_real(note)) !== nil && (!$a.$$is_boolean || $a == true))) {
      note = note.$clone();
      (($a = [(function() {if ((($c = ((((($d = ($rb_lt(note.$volume(), 1))) !== false && $d !== nil) ? $d : ($rb_gt(note.$volume(), 15)))))) !== nil && (!$c.$$is_boolean || $c == true))) {
        return 15
        } else {
        return note.$volume()
      } return nil; })()]), $b = note, $b['$volume='].apply($b, $a), $a[$a.length-1]);
      if (note.$kind()['$==']("p")) {
        (($a = [15]), $b = note, $b['$envelope='].apply($b, $a), $a[$a.length-1]);
        text = self.$note2txt(note);
      } else if (note.$kind()['$==']("e")) {
        text = self.$note2txt(note)
      } else if (note.$kind()['$==']("d")) {
        (($a = [15]), $b = note, $b['$envelope='].apply($b, $a), $a[$a.length-1]);
        text = self.$note2txt(note);
      } else if (note.$kind()['$==']("m")) {
        (($a = [15]), $b = note, $b['$envelope='].apply($b, $a), $a[$a.length-1]);
        text = self.$note2txt(note);
        } else {
        text = self.$note2txt(note)
      }}
    return text;
  });
  Opal.defn(Opal.Object, '$enote_is_real', function(note) {
    var $a, $b, $c, $d, self = this;

    return (($a = ($b = ($c = ($d = nil['$!='](note), $d !== false && $d !== nil ?note.$kind()['$==']("e") : $d), $c !== false && $c !== nil ?note.$type()['$!=']("r") : $c), $b !== false && $b !== nil ?note.$type()['$!='](".") : $b), $a !== false && $a !== nil ?($range(1, 14, false))['$==='](note.$envelope()) : $a));
  });
  Opal.defn(Opal.Object, '$print_enote', function(note) {
    var $a, self = this, text = nil;

    if ((($a = self.$enote_is_real(note)) !== nil && (!$a.$$is_boolean || $a == true))) {
      return text = " " + ($scope.get('PITCHES')['$[]'](note.$epitch())) + (note.$eoct())
      } else {
      return text = "...."
    }
  });
  Opal.defn(Opal.Object, '$flat_cell_poly', function(cell) {
    var $a, $b, TMP_14, $c, TMP_15, $d, $e, TMP_16, TMP_17, $f, TMP_18, $g, $h, TMP_19, TMP_20, $i, $j, TMP_21, self = this, event = nil, ncell = nil, $case = nil, fnote = nil;

    event = ($a = ($b = cell).$map, $a.$$p = (TMP_14 = function(note){var self = TMP_14.$$s || this;
if (note == null) note = nil;
    return note.$type()}, TMP_14.$$s = self, TMP_14), $a).call($b).$uniq().$sort().$join();
    ncell = [];
    $case = event;if ("c"['$===']($case)) {ncell = []}else if ("r"['$===']($case)) {fnote = cell.$min().$clone();
    (($a = ["r"]), $c = fnote, $c['$type='].apply($c, $a), $a[$a.length-1]);
    ncell = [fnote];}else if ("s"['$===']($case)) {ncell = cell}else if ("cr"['$===']($case)) {ncell = ($a = ($c = ($d = ($e = cell).$delete_if, $d.$$p = (TMP_16 = function(fnote){var self = TMP_16.$$s || this;
if (fnote == null) fnote = nil;
    return fnote.$type()['$==']("r")}, TMP_16.$$s = self, TMP_16), $d).call($e)).$each, $a.$$p = (TMP_15 = function(fnote){var self = TMP_15.$$s || this, $a, $b;
if (fnote == null) fnote = nil;
    return (($a = ["s"]), $b = fnote, $b['$type='].apply($b, $a), $a[$a.length-1])}, TMP_15.$$s = self, TMP_15), $a).call($c)}else if ("cs"['$===']($case)) {ncell = ($a = ($d = cell).$each, $a.$$p = (TMP_17 = function(fnote){var self = TMP_17.$$s || this, $a, $b;
if (fnote == null) fnote = nil;
    return (($a = ["s"]), $b = fnote, $b['$type='].apply($b, $a), $a[$a.length-1])}, TMP_17.$$s = self, TMP_17), $a).call($d)}else if ("rs"['$===']($case)) {ncell = ($a = ($f = ($g = ($h = cell).$delete_if, $g.$$p = (TMP_19 = function(fnote){var self = TMP_19.$$s || this;
if (fnote == null) fnote = nil;
    return fnote.$type()['$==']("r")}, TMP_19.$$s = self, TMP_19), $g).call($h)).$each, $a.$$p = (TMP_18 = function(fnote){var self = TMP_18.$$s || this, $a, $b;
if (fnote == null) fnote = nil;
    return (($a = ["s"]), $b = fnote, $b['$type='].apply($b, $a), $a[$a.length-1])}, TMP_18.$$s = self, TMP_18), $a).call($f)}else if ("crs"['$===']($case)) {ncell = ($a = ($g = ($i = ($j = cell).$delete_if, $i.$$p = (TMP_21 = function(fnote){var self = TMP_21.$$s || this;
if (fnote == null) fnote = nil;
    return fnote.$type()['$==']("r")}, TMP_21.$$s = self, TMP_21), $i).call($j)).$each, $a.$$p = (TMP_20 = function(fnote){var self = TMP_20.$$s || this, $a, $b;
if (fnote == null) fnote = nil;
    return (($a = ["s"]), $b = fnote, $b['$type='].apply($b, $a), $a[$a.length-1])}, TMP_20.$$s = self, TMP_20), $a).call($g)}
    return ncell;
  });
  Opal.defn(Opal.Object, '$flat_cell_mono', function(cell) {
    var $a, $b, TMP_22, $c, TMP_23, $d, $e, TMP_24, TMP_25, $f, TMP_26, $g, $h, TMP_27, TMP_28, $i, $j, TMP_29, self = this, event = nil, ncell = nil, $case = nil, fnote = nil;

    event = ($a = ($b = cell).$map, $a.$$p = (TMP_22 = function(note){var self = TMP_22.$$s || this;
if (note == null) note = nil;
    return note.$type()}, TMP_22.$$s = self, TMP_22), $a).call($b).$uniq().$sort().$join();
    ncell = [];
    $case = event;if ("c"['$===']($case)) {ncell = []}else if ("r"['$===']($case)) {fnote = cell.$min().$clone();
    (($a = ["r"]), $c = fnote, $c['$type='].apply($c, $a), $a[$a.length-1]);
    ncell = [fnote];}else if ("s"['$===']($case)) {ncell = []['$<<'](cell.$max())}else if ("cr"['$===']($case)) {ncell = []['$<<']((($a = ($c = ($d = ($e = cell).$delete_if, $d.$$p = (TMP_24 = function(fnote){var self = TMP_24.$$s || this;
if (fnote == null) fnote = nil;
    return fnote.$type()['$==']("r")}, TMP_24.$$s = self, TMP_24), $d).call($e)).$each, $a.$$p = (TMP_23 = function(fnote){var self = TMP_23.$$s || this, $a, $b;
if (fnote == null) fnote = nil;
    return (($a = ["s"]), $b = fnote, $b['$type='].apply($b, $a), $a[$a.length-1])}, TMP_23.$$s = self, TMP_23), $a).call($c)).$max())}else if ("cs"['$===']($case)) {ncell = []['$<<']((($a = ($d = cell).$each, $a.$$p = (TMP_25 = function(fnote){var self = TMP_25.$$s || this, $a, $b;
if (fnote == null) fnote = nil;
    return (($a = ["s"]), $b = fnote, $b['$type='].apply($b, $a), $a[$a.length-1])}, TMP_25.$$s = self, TMP_25), $a).call($d)).$max())}else if ("rs"['$===']($case)) {ncell = []['$<<']((($a = ($f = ($g = ($h = cell).$delete_if, $g.$$p = (TMP_27 = function(fnote){var self = TMP_27.$$s || this;
if (fnote == null) fnote = nil;
    return fnote.$type()['$==']("r")}, TMP_27.$$s = self, TMP_27), $g).call($h)).$each, $a.$$p = (TMP_26 = function(fnote){var self = TMP_26.$$s || this, $a, $b;
if (fnote == null) fnote = nil;
    return (($a = ["s"]), $b = fnote, $b['$type='].apply($b, $a), $a[$a.length-1])}, TMP_26.$$s = self, TMP_26), $a).call($f)).$max())}else if ("crs"['$===']($case)) {ncell = []['$<<']((($a = ($g = ($i = ($j = cell).$delete_if, $i.$$p = (TMP_29 = function(fnote){var self = TMP_29.$$s || this;
if (fnote == null) fnote = nil;
    return fnote.$type()['$==']("r")}, TMP_29.$$s = self, TMP_29), $i).call($j)).$each, $a.$$p = (TMP_28 = function(fnote){var self = TMP_28.$$s || this, $a, $b;
if (fnote == null) fnote = nil;
    return (($a = ["s"]), $b = fnote, $b['$type='].apply($b, $a), $a[$a.length-1])}, TMP_28.$$s = self, TMP_28), $a).call($g)).$max())}
    return ncell;
  });
  Opal.defn(Opal.Object, '$flat_cell_drum', function(cell) {
    var $a, $b, TMP_30, $c, TMP_31, $d, $e, TMP_32, TMP_33, $f, TMP_34, $g, $h, TMP_35, TMP_36, $i, $j, TMP_37, self = this, event = nil, ncell = nil, $case = nil, fnote = nil;

    event = ($a = ($b = cell).$map, $a.$$p = (TMP_30 = function(note){var self = TMP_30.$$s || this;
if (note == null) note = nil;
    return note.$type()}, TMP_30.$$s = self, TMP_30), $a).call($b).$uniq().$sort().$join();
    ncell = [];
    $case = event;if ("c"['$===']($case)) {ncell = []}else if ("r"['$===']($case)) {fnote = cell.$min().$clone();
    (($a = ["r"]), $c = fnote, $c['$type='].apply($c, $a), $a[$a.length-1]);
    ncell = [fnote];}else if ("s"['$===']($case)) {ncell = []['$<<'](cell.$min())}else if ("cr"['$===']($case)) {ncell = []['$<<']((($a = ($c = ($d = ($e = cell).$delete_if, $d.$$p = (TMP_32 = function(fnote){var self = TMP_32.$$s || this;
if (fnote == null) fnote = nil;
    return fnote.$type()['$==']("r")}, TMP_32.$$s = self, TMP_32), $d).call($e)).$each, $a.$$p = (TMP_31 = function(fnote){var self = TMP_31.$$s || this, $a, $b;
if (fnote == null) fnote = nil;
    return (($a = ["s"]), $b = fnote, $b['$type='].apply($b, $a), $a[$a.length-1])}, TMP_31.$$s = self, TMP_31), $a).call($c)).$min())}else if ("cs"['$===']($case)) {ncell = []['$<<']((($a = ($d = cell).$each, $a.$$p = (TMP_33 = function(fnote){var self = TMP_33.$$s || this, $a, $b;
if (fnote == null) fnote = nil;
    return (($a = ["s"]), $b = fnote, $b['$type='].apply($b, $a), $a[$a.length-1])}, TMP_33.$$s = self, TMP_33), $a).call($d)).$min())}else if ("rs"['$===']($case)) {ncell = []['$<<']((($a = ($f = ($g = ($h = cell).$delete_if, $g.$$p = (TMP_35 = function(fnote){var self = TMP_35.$$s || this;
if (fnote == null) fnote = nil;
    return fnote.$type()['$==']("r")}, TMP_35.$$s = self, TMP_35), $g).call($h)).$each, $a.$$p = (TMP_34 = function(fnote){var self = TMP_34.$$s || this, $a, $b;
if (fnote == null) fnote = nil;
    return (($a = ["s"]), $b = fnote, $b['$type='].apply($b, $a), $a[$a.length-1])}, TMP_34.$$s = self, TMP_34), $a).call($f)).$min())}else if ("crs"['$===']($case)) {ncell = []['$<<']((($a = ($g = ($i = ($j = cell).$delete_if, $i.$$p = (TMP_37 = function(fnote){var self = TMP_37.$$s || this;
if (fnote == null) fnote = nil;
    return fnote.$type()['$==']("r")}, TMP_37.$$s = self, TMP_37), $i).call($j)).$each, $a.$$p = (TMP_36 = function(fnote){var self = TMP_36.$$s || this, $a, $b;
if (fnote == null) fnote = nil;
    return (($a = ["s"]), $b = fnote, $b['$type='].apply($b, $a), $a[$a.length-1])}, TMP_36.$$s = self, TMP_36), $a).call($g)).$min())}
    return ncell;
  });
  Opal.defn(Opal.Object, '$squize_ornament', function(base_note, orn) {
    var $a, $b, TMP_38, $c, TMP_39, $d, TMP_40, self = this, sorted = nil, mid = nil, mediana = nil, min_offset = nil, new_base_note = nil, new_orn = nil, orn_txt = nil;

    sorted = orn.$sort();
    mid = $rb_divide(orn.$size(), 2);
    mediana = sorted['$[]'](mid);
    ($a = ($b = orn).$delete_if, $a.$$p = (TMP_38 = function(offset){var self = TMP_38.$$s || this;
      if ($gvars.set == null) $gvars.set = nil;
if (offset == null) offset = nil;
    return $rb_gt(($rb_minus(offset, mediana)).$abs(), $gvars.set.$max_offset())}, TMP_38.$$s = self, TMP_38), $a).call($b);
    min_offset = orn.$min();
    new_base_note = $rb_plus(base_note, min_offset);
    new_orn = ($a = ($c = orn).$map, $a.$$p = (TMP_39 = function(x){var self = TMP_39.$$s || this;
if (x == null) x = nil;
    return $rb_minus(x, min_offset)}, TMP_39.$$s = self, TMP_39), $a).call($c);
    orn_txt = "L";
    ($a = ($d = new_orn).$each, $a.$$p = (TMP_40 = function(x){var self = TMP_40.$$s || this, $a, $b, TMP_41;
      if ($gvars.set == null) $gvars.set = nil;
if (x == null) x = nil;
    return ($a = ($b = $gvars.set.$orn_repeat()).$times, $a.$$p = (TMP_41 = function(){var self = TMP_41.$$s || this;

      return orn_txt['$<<'](x.$to_s())['$<<'](",")}, TMP_41.$$s = self, TMP_41), $a).call($b)}, TMP_40.$$s = self, TMP_40), $a).call($d);
    orn_txt['$[]='](-1, "");
    return [new_base_note, orn_txt];
  });
  Opal.defn(Opal.Object, '$note2drum', function(note) {
    var $a, $b, self = this;

    (($a = [$scope.get('NOTE2DRUM_SAMPLE')['$[]'](note.$note())]), $b = note, $b['$sample='].apply($b, $a), $a[$a.length-1]);
    (($a = [$scope.get('NOTE2DRUM_NOTE')['$[]'](note.$note())]), $b = note, $b['$note='].apply($b, $a), $a[$a.length-1]);
    return note;
  });
  $gvars.set = $scope.get('Setup').$new();
  $gvars.set.$load_sequence();
  seq = $gvars.set.$sequence();
  vmod = [];
  ($a = ($c = seq).$each, $a.$$p = (TMP_42 = function(track){var self = TMP_42.$$s || this, $a, $b, TMP_43, vchan = nil;
if (track == null) track = nil;
  self.$puts("   track:" + (track));
    vchan = [];
    ($a = ($b = track).$each, $a.$$p = (TMP_43 = function(eve){var self = TMP_43.$$s || this, $a, $b, $c, vnote = nil;
      if ($gvars.set == null) $gvars.set = nil;
if (eve == null) eve = nil;
    if ((($a = (($b = (((($c = eve.$note) && !$c.$$stub) || eve['$respond_to_missing?']('note') ? 'method' : nil)), $b !== false && $b !== nil ?(((($c = eve.$off) && !$c.$$stub) || eve['$respond_to_missing?']('off') ? 'method' : nil)) : $b))) !== nil && (!$a.$$is_boolean || $a == true))) {
        vnote = $scope.get('VNote').$new(eve.$note(), eve.$time_from_start(), eve.$off().$time_from_start(), 15);
        vchan['$<<'](vnote);
        return (($a = [[$gvars.set.$max_row(), [vnote.$off(), $rb_plus(vnote.$off(), $gvars.set.$per_delay()), $rb_plus(vnote.$off(), $gvars.set.$per_delay2())].$max()].$max()]), $b = $gvars.set, $b['$max_row='].apply($b, $a), $a[$a.length-1]);
        } else {
        return nil
      }}, TMP_43.$$s = self, TMP_43), $a).call($b);
    if ((($a = ([]['$!='](vchan))) !== nil && (!$a.$$is_boolean || $a == true))) {
      return vmod['$<<'](vchan)
      } else {
      return nil
    }}, TMP_42.$$s = self, TMP_42), $a).call($c);
  self.$puts("max_row:" + ($gvars.set.$max_row()));
  rmod = [];
  ($a = ($d = $gvars.set.$sources()).$each, $a.$$p = (TMP_44 = function(vchan_index){var self = TMP_44.$$s || this, $a, $b, TMP_45, $c, TMP_46, rchan = nil;
    if ($gvars.set == null) $gvars.set = nil;
if (vchan_index == null) vchan_index = nil;
  self.$puts("vchan:" + (vchan_index));
    rchan = ($a = ($b = $scope.get('Array')).$new, $a.$$p = (TMP_45 = function(){var self = TMP_45.$$s || this;

    return []}, TMP_45.$$s = self, TMP_45), $a).call($b, $rb_plus($gvars.set.$max_row(), 1));
    ($a = ($c = vmod['$[]'](vchan_index)).$each, $a.$$p = (TMP_46 = function(vnote){var self = TMP_46.$$s || this, $a, $b, TMP_47;
if (vnote == null) vnote = nil;
    rchan['$[]'](vnote.$start())['$<<']($scope.get('FNote').$new(vnote.$note(), vnote.$volume(), "s"));
      rchan['$[]'](vnote.$off())['$<<']($scope.get('FNote').$new(vnote.$note(), vnote.$volume(), "r"));
      return ($a = ($b = ($range($rb_plus(vnote.$start(), 1), vnote.$off(), true))).$each, $a.$$p = (TMP_47 = function(i){var self = TMP_47.$$s || this;
if (i == null) i = nil;
      return rchan['$[]'](i)['$<<']($scope.get('FNote').$new(vnote.$note(), vnote.$volume(), "c"))}, TMP_47.$$s = self, TMP_47), $a).call($b);}, TMP_46.$$s = self, TMP_46), $a).call($c);
    return rmod['$<<'](rchan);}, TMP_44.$$s = self, TMP_44), $a).call($d);
  self.$puts("--- detecting base note (for major)---");
  Opal.cdecl($scope, 'SCALE_PENALTY', [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0]);
  penalties = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  statistic = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  key_notes = [];
  ($a = ($e = rmod).$each_with_index, $a.$$p = (TMP_48 = function(vchan, vchan_i){var self = TMP_48.$$s || this, $a, $b, TMP_49;
    if ($gvars.set == null) $gvars.set = nil;
if (vchan == null) vchan = nil;if (vchan_i == null) vchan_i = nil;
  self.$puts("vchan:" + (vchan_i));
    self.$puts("" + ($gvars.set.$chan_settings()['$[]'](vchan_i)));
    return ($a = ($b = vchan).$each_with_index, $a.$$p = (TMP_49 = function(vcell, vcell_i){var self = TMP_49.$$s || this, $a, $b, TMP_50;
      if ($gvars.set == null) $gvars.set = nil;
if (vcell == null) vcell = nil;if (vcell_i == null) vcell_i = nil;
    if ((($a = (nil['$!=']($gvars.set.$chan_settings()['$[]'](vchan_i)['$[]']("s")))) !== nil && (!$a.$$is_boolean || $a == true))) {
        return ($a = ($b = vcell).$each, $a.$$p = (TMP_50 = function(vnote){var self = TMP_50.$$s || this, $a, $b;
if (vnote == null) vnote = nil;
        if ((($a = (($b = nil['$!='](vnote), $b !== false && $b !== nil ?vnote.$type()['$==']("s") : $b))) !== nil && (!$a.$$is_boolean || $a == true))) {
            return key_notes['$<<'](vnote.$note())
            } else {
            return nil
          }}, TMP_50.$$s = self, TMP_50), $a).call($b)
        } else {
        return nil
      }}, TMP_49.$$s = self, TMP_49), $a).call($b);}, TMP_48.$$s = self, TMP_48), $a).call($e);
  self.$puts("key notes: ---{");
  self.$puts("key notes: ---}");
  ($a = ($f = key_notes).$each, $a.$$p = (TMP_51 = function(pitch){var self = TMP_51.$$s || this, $a, $b;
if (pitch == null) pitch = nil;
  return ($a = pitch['$%'](12), $b = statistic, $b['$[]=']($a, $rb_plus($b['$[]']($a), 1)))}, TMP_51.$$s = self, TMP_51), $a).call($f);
  self.$puts("statistic: ---{");
  ($a = ($g = statistic).$each, $a.$$p = (TMP_52 = function(count){var self = TMP_52.$$s || this;
if (count == null) count = nil;
  return self.$print("" + (count) + " ")}, TMP_52.$$s = self, TMP_52), $a).call($g);
  self.$puts("\nstatistic: ---}");
  ($a = ($h = (12)).$times, $a.$$p = (TMP_53 = function(key_i){var self = TMP_53.$$s || this, $a, $b, TMP_54;
if (key_i == null) key_i = nil;
  return ($a = ($b = statistic).$each_with_index, $a.$$p = (TMP_54 = function(count, pitch){var self = TMP_54.$$s || this, $a, $b;
if (count == null) count = nil;if (pitch == null) pitch = nil;
    return ($a = key_i, $b = penalties, $b['$[]=']($a, $rb_plus($b['$[]']($a), $rb_times(count, $scope.get('SCALE_PENALTY')['$[]'](($rb_minus(pitch, key_i))['$%'](12))))))}, TMP_54.$$s = self, TMP_54), $a).call($b)}, TMP_53.$$s = self, TMP_53), $a).call($h);
  self.$puts("penalties: ---{");
  ($a = ($i = penalties).$each, $a.$$p = (TMP_55 = function(count){var self = TMP_55.$$s || this;
if (count == null) count = nil;
  return self.$print("" + (count) + " ")}, TMP_55.$$s = self, TMP_55), $a).call($i);
  self.$puts("penalties: ---}");
  if ((($a = ($rb_gt($gvars.set.$real_key(), 12))) !== nil && (!$a.$$is_boolean || $a == true))) {
    good_key = penalties.$index(penalties.$min())
    } else {
    good_key = $gvars.set.$real_key()['$%'](12)
  }
  self.$puts("good_key:" + (good_key));
  if ((($a = ($gvars.set.$diatonic_transpose()['$!='](0))) !== nil && (!$a.$$is_boolean || $a == true))) {
    Opal.cdecl($scope, 'DIATONIC_UP', [2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 1]);
    Opal.cdecl($scope, 'DIATONIC_DOWN', [-1, -2, -2, -2, -2, -1, -2, -2, -2, -2, -2, -2]);
    ($a = ($j = rmod).$each_with_index, $a.$$p = (TMP_56 = function(rchan, rchan_i){var self = TMP_56.$$s || this, $a, $b, TMP_57, pchan = nil;
if (rchan == null) rchan = nil;if (rchan_i == null) rchan_i = nil;
    self.$puts("rchan:" + (rchan_i));
      pchan = [];
      return ($a = ($b = rchan).$each_with_index, $a.$$p = (TMP_57 = function(rcell, rcell_i){var self = TMP_57.$$s || this, $a, $b, TMP_58;
if (rcell == null) rcell = nil;if (rcell_i == null) rcell_i = nil;
      return ($a = ($b = rcell).$each, $a.$$p = (TMP_58 = function(rnote){var self = TMP_58.$$s || this, $a, $b, TMP_59, $c, TMP_60, d_transpose = nil;
          if ($gvars.set == null) $gvars.set = nil;
if (rnote == null) rnote = nil;
        d_transpose = $gvars.set.$diatonic_transpose().$abs();
          if ((($a = ($rb_gt($gvars.set.$diatonic_transpose(), 0))) !== nil && (!$a.$$is_boolean || $a == true))) {
            return ($a = ($b = d_transpose).$times, $a.$$p = (TMP_59 = function(){var self = TMP_59.$$s || this, $a, $b;

            return (($a = [$rb_plus(rnote.$note(), $scope.get('DIATONIC_UP')['$[]'](($rb_minus(rnote.$note(), good_key))['$%'](12)))]), $b = rnote, $b['$note='].apply($b, $a), $a[$a.length-1])}, TMP_59.$$s = self, TMP_59), $a).call($b)
            } else {
            return ($a = ($c = d_transpose).$times, $a.$$p = (TMP_60 = function(){var self = TMP_60.$$s || this, $a, $b;

            return (($a = [$rb_plus(rnote.$note(), $scope.get('DIATONIC_DOWN')['$[]'](($rb_minus(rnote.$note(), good_key))['$%'](12)))]), $b = rnote, $b['$note='].apply($b, $a), $a[$a.length-1])}, TMP_60.$$s = self, TMP_60), $a).call($c)
          }}, TMP_58.$$s = self, TMP_58), $a).call($b)}, TMP_57.$$s = self, TMP_57), $a).call($b);}, TMP_56.$$s = self, TMP_56), $a).call($j);}
  self.$puts("--- flatting polynotes ---");
  pmod = [];
  ($a = ($k = rmod).$each_with_index, $a.$$p = (TMP_61 = function(rchan, rchan_i){var self = TMP_61.$$s || this, $a, $b, TMP_62, pchan = nil;
if (rchan == null) rchan = nil;if (rchan_i == null) rchan_i = nil;
  self.$puts("rchan:" + (rchan_i));
    pchan = [];
    ($a = ($b = rchan).$each_with_index, $a.$$p = (TMP_62 = function(rcell, rcell_i){var self = TMP_62.$$s || this, $a, pcell = nil;
      if ($gvars.set == null) $gvars.set = nil;
if (rcell == null) rcell = nil;if (rcell_i == null) rcell_i = nil;
    if ((($a = (nil['$!=']($gvars.set.$chan_settings()['$[]'](rchan_i)['$[]']("p")))) !== nil && (!$a.$$is_boolean || $a == true))) {
        pcell = self.$flat_cell_poly(rcell)
      } else if ((($a = (nil['$!=']($gvars.set.$chan_settings()['$[]'](rchan_i)['$[]']("m")))) !== nil && (!$a.$$is_boolean || $a == true))) {
        pcell = self.$flat_cell_mono(rcell)
      } else if ((($a = (nil['$!=']($gvars.set.$chan_settings()['$[]'](rchan_i)['$[]']("d")))) !== nil && (!$a.$$is_boolean || $a == true))) {
        pcell = self.$flat_cell_drum(rcell)}
      return pchan['$<<'](pcell);}, TMP_62.$$s = self, TMP_62), $a).call($b);
    return pmod['$<<'](pchan);}, TMP_61.$$s = self, TMP_61), $a).call($k);
  self.$puts("--- making ornaments ---");
  ornaments = $hash2([], {});
  orn = "L";
  ($a = ($l = $gvars.set.$orn_repeat()).$times, $a.$$p = (TMP_63 = function(){var self = TMP_63.$$s || this;

  return orn['$<<']((0).$to_s())['$<<'](",")}, TMP_63.$$s = self, TMP_63), $a).call($l);
  orn['$[]='](-1, "");
  ornaments['$[]='](orn, 0);
  ornament_counter = 1;
  lmod = [];
  ($a = ($m = pmod).$each_with_index, $a.$$p = (TMP_64 = function(pchan, pchan_i){var self = TMP_64.$$s || this, $a, $b, TMP_65, lchan = nil;
if (pchan == null) pchan = nil;if (pchan_i == null) pchan_i = nil;
  self.$puts("pchan:" + (pchan_i));
    lchan = [];
    ($a = ($b = pchan).$each_with_index, $a.$$p = (TMP_65 = function(pcell, pcell_i){var self = TMP_65.$$s || this, $a, $b, TMP_66, $c, min_note = nil, base_note = nil, proto_orn = nil, lnote = nil;
      if ($gvars.set == null) $gvars.set = nil;
if (pcell == null) pcell = nil;if (pcell_i == null) pcell_i = nil;
    if ((($a = []['$!='](pcell)) !== nil && (!$a.$$is_boolean || $a == true))) {
        min_note = pcell.$min();
        base_note = pcell.$min().$note();
        proto_orn = ($a = ($b = pcell.$uniq().$sort()).$map, $a.$$p = (TMP_66 = function(fnote){var self = TMP_66.$$s || this;
if (fnote == null) fnote = nil;
        return $rb_minus(fnote.$note(), base_note)}, TMP_66.$$s = self, TMP_66), $a).call($b).$uniq();
        $c = self.$squize_ornament(base_note, proto_orn), $a = Opal.to_ary($c), base_note = ($a[0] == null ? nil : $a[0]), orn = ($a[1] == null ? nil : $a[1]), $c;
        if ((($a = (nil['$=='](ornaments['$[]'](orn)))) !== nil && (!$a.$$is_boolean || $a == true))) {
          ornaments['$[]='](orn, ornament_counter);
          ornament_counter = $rb_plus(ornament_counter, 1);}
        if ((($a = (nil['$!=']($gvars.set.$chan_settings()['$[]'](pchan_i)['$[]']("p")))) !== nil && (!$a.$$is_boolean || $a == true))) {
          base_note = (function() {if ((($a = (($c = ($rb_ge(base_note, ($rb_times(12, 6)))), $c !== false && $c !== nil ?ornaments['$[]'](orn)['$!='](0) : $c))) !== nil && (!$a.$$is_boolean || $a == true))) {
            return $rb_minus(base_note, 12)
            } else {
            return base_note
          } return nil; })();
          base_note = (function() {if ((($a = (($c = ($rb_le(base_note, ($rb_times(12, 4)))), $c !== false && $c !== nil ?ornaments['$[]'](orn)['$!='](0) : $c))) !== nil && (!$a.$$is_boolean || $a == true))) {
            return $rb_plus(base_note, 12)
            } else {
            return base_note
          } return nil; })();
          lnote = $scope.get('LNote').$new(base_note, $gvars.set.$samples()['$[]'](pchan_i), 0, ornaments['$[]'](orn), 15, min_note.$type(), "p");
        } else if ((($a = (nil['$!=']($gvars.set.$chan_settings()['$[]'](pchan_i)['$[]']("m")))) !== nil && (!$a.$$is_boolean || $a == true))) {
          lnote = $scope.get('LNote').$new(base_note, $gvars.set.$samples()['$[]'](pchan_i), 0, $gvars.set.$ornaments()['$[]'](pchan_i), 15, min_note.$type(), "m")
        } else if ((($a = (nil['$!=']($gvars.set.$chan_settings()['$[]'](pchan_i)['$[]']("d")))) !== nil && (!$a.$$is_boolean || $a == true))) {
          lnote = self.$note2drum($scope.get('LNote').$new(base_note, 0, 0, 0, 15, min_note.$type(), "d"))}
        if ((($a = (nil['$!=']($gvars.set.$chan_settings()['$[]'](pchan_i)['$[]']("e")))) !== nil && (!$a.$$is_boolean || $a == true))) {
          (($a = ["e"]), $c = lnote, $c['$kind='].apply($c, $a), $a[$a.length-1])}
        } else {
        lnote = nil
      }
      return lchan['$<<'](lnote);}, TMP_65.$$s = self, TMP_65), $a).call($b);
    return lmod['$<<'](lchan);}, TMP_64.$$s = self, TMP_64), $a).call($m);
  self.$puts("--- making delay ---");
  dmod = [];
  ($a = ($n = lmod).$each_with_index, $a.$$p = (TMP_67 = function(lchan, lchan_i){var self = TMP_67.$$s || this, $a, $b, TMP_68, dchan = nil;
if (lchan == null) lchan = nil;if (lchan_i == null) lchan_i = nil;
  self.$puts("lchan:" + (lchan_i));
    dchan = lchan.$clone();
    ($a = ($b = lchan).$each_with_index, $a.$$p = (TMP_68 = function(lnote, lnote_i){var self = TMP_68.$$s || this, $a, $b, $c, dnote = nil, dnote2 = nil;
      if ($gvars.set == null) $gvars.set = nil;
if (lnote == null) lnote = nil;if (lnote_i == null) lnote_i = nil;
    if ((($a = ($b = ($c = (nil['$!='](lnote)), $c !== false && $c !== nil ?(nil['$==']($gvars.set.$chan_settings()['$[]'](lchan_i)['$[]']("u"))) : $c), $b !== false && $b !== nil ?(nil['$==']($gvars.set.$chan_settings()['$[]'](lchan_i)['$[]']("w"))) : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        dnote = lnote.$clone();
        (($a = [$rb_times(dnote.$volume(), 0.7)]), $b = dnote, $b['$volume='].apply($b, $a), $a[$a.length-1]);
        dnote2 = dnote.$clone();
        (($a = [$rb_times(dnote.$volume(), 0.7)]), $b = dnote2, $b['$volume='].apply($b, $a), $a[$a.length-1]);
        if ((($a = (((($b = nil['$=='](dchan['$[]']($rb_plus(lnote_i, $gvars.set.$per_delay2())))) !== false && $b !== nil) ? $b : "r"['$=='](dchan['$[]']($rb_plus(lnote_i, $gvars.set.$per_delay2())).$type())))) !== nil && (!$a.$$is_boolean || $a == true))) {
          dchan['$[]=']($rb_plus(lnote_i, $gvars.set.$per_delay2()), dnote2)}
        if ((($a = (((($b = nil['$=='](dchan['$[]']($rb_plus(lnote_i, $gvars.set.$per_delay())))) !== false && $b !== nil) ? $b : "r"['$=='](dchan['$[]']($rb_plus(lnote_i, $gvars.set.$per_delay())).$type())))) !== nil && (!$a.$$is_boolean || $a == true))) {
          return dchan['$[]=']($rb_plus(lnote_i, $gvars.set.$per_delay()), dnote)
          } else {
          return nil
        }
      } else if ((($a = ($b = ($c = (nil['$!='](lnote)), $c !== false && $c !== nil ?(nil['$==']($gvars.set.$chan_settings()['$[]'](lchan_i)['$[]']("u"))) : $c), $b !== false && $b !== nil ?(nil['$!=']($gvars.set.$chan_settings()['$[]'](lchan_i)['$[]']("w"))) : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        dnote = lnote.$clone();
        (($a = [$rb_times(dnote.$volume(), 0.7)]), $b = dnote, $b['$volume='].apply($b, $a), $a[$a.length-1]);
        dnote2 = dnote.$clone();
        (($a = [$rb_times(dnote.$volume(), 0.7)]), $b = dnote2, $b['$volume='].apply($b, $a), $a[$a.length-1]);
        if ((($a = (((($b = nil['$=='](dchan['$[]']($rb_plus(lnote_i, $rb_times($gvars.set.$per_delay2(), 2))))) !== false && $b !== nil) ? $b : "r"['$=='](dchan['$[]']($rb_plus(lnote_i, $rb_times($gvars.set.$per_delay2(), 2))).$type())))) !== nil && (!$a.$$is_boolean || $a == true))) {
          dchan['$[]=']($rb_plus(lnote_i, $rb_times($gvars.set.$per_delay2(), 2)), dnote2)}
        if ((($a = (((($b = nil['$=='](dchan['$[]']($rb_plus(lnote_i, $rb_times($gvars.set.$per_delay(), 2))))) !== false && $b !== nil) ? $b : "r"['$=='](dchan['$[]']($rb_plus(lnote_i, $rb_times($gvars.set.$per_delay(), 2))).$type())))) !== nil && (!$a.$$is_boolean || $a == true))) {
          return dchan['$[]=']($rb_plus(lnote_i, $rb_times($gvars.set.$per_delay(), 2)), dnote)
          } else {
          return nil
        }
        } else {
        return nil
      }}, TMP_68.$$s = self, TMP_68), $a).call($b);
    return dmod['$<<'](dchan);}, TMP_67.$$s = self, TMP_67), $a).call($n);
  lmod = dmod;
  self.$puts("--- mixing channels ---");
  mmod = [];
  abs_index = 0;
  ($a = ($o = $gvars.set.$sources_mix()).$each_with_index, $a.$$p = (TMP_69 = function(s, s_i){var self = TMP_69.$$s || this, $a, $b, TMP_70, mchan = nil;
if (s == null) s = nil;if (s_i == null) s_i = nil;
  self.$puts("" + (abs_index));
    mchan = [];
    ($a = ($b = s).$each_with_index, $a.$$p = (TMP_70 = function(lc, lc_i){var self = TMP_70.$$s || this, $a, $b, TMP_71, lchan = nil, lchan_i = nil;
if (lc == null) lc = nil;if (lc_i == null) lc_i = nil;
    lchan = lmod['$[]'](abs_index);
      lchan_i = abs_index;
      self.$puts("mixing lchan:" + (lchan_i) + " into " + (s_i));
      ($a = ($b = lchan).$each_with_index, $a.$$p = (TMP_71 = function(lnote, lnote_i){var self = TMP_71.$$s || this, $a, $b, $c, mnote = nil;
        if ($gvars.set == null) $gvars.set = nil;
if (lnote == null) lnote = nil;if (lnote_i == null) lnote_i = nil;
      if ($gvars.set.$mix_options()['$[]'](lchan_i)['$==']("-")) {
          if ((($a = nil['$!='](lnote)) !== nil && (!$a.$$is_boolean || $a == true))) {
            mnote = lnote.$clone();
            if ((($a = (((($b = ((($c = nil['$=='](mchan['$[]'](lnote_i))) !== false && $c !== nil) ? $c : "r"['$=='](mchan['$[]'](lnote_i).$type()))) !== false && $b !== nil) ? $b : $rb_lt(mchan['$[]'](lnote_i).$volume(), lnote.$volume())))) !== nil && (!$a.$$is_boolean || $a == true))) {
              return mchan['$[]='](lnote_i, mnote)
            } else if ((($a = (((($b = ((($c = nil['$=='](mchan['$[]']($rb_plus(lnote_i, 1)))) !== false && $c !== nil) ? $c : "r"['$=='](mchan['$[]']($rb_plus(lnote_i, 1)).$type()))) !== false && $b !== nil) ? $b : $rb_lt(mchan['$[]'](lnote_i).$volume(), lnote.$volume())))) !== nil && (!$a.$$is_boolean || $a == true))) {
              return mchan['$[]=']($rb_plus(lnote_i, 1), mnote)
            } else if ((($a = (((($b = ((($c = nil['$=='](mchan['$[]']($rb_plus(lnote_i, 2)))) !== false && $c !== nil) ? $c : "r"['$=='](mchan['$[]']($rb_plus(lnote_i, 2)).$type()))) !== false && $b !== nil) ? $b : $rb_lt(mchan['$[]'](lnote_i).$volume(), lnote.$volume())))) !== nil && (!$a.$$is_boolean || $a == true))) {
              return mchan['$[]=']($rb_plus(lnote_i, 2), mnote)
            } else if ((($a = (((($b = ((($c = nil['$=='](mchan['$[]']($rb_plus(lnote_i, 3)))) !== false && $c !== nil) ? $c : "r"['$=='](mchan['$[]']($rb_plus(lnote_i, 3)).$type()))) !== false && $b !== nil) ? $b : $rb_lt(mchan['$[]'](lnote_i).$volume(), lnote.$volume())))) !== nil && (!$a.$$is_boolean || $a == true))) {
              return mchan['$[]=']($rb_plus(lnote_i, 3), mnote)
              } else {
              return nil
            }
            } else {
            return nil
          }
        } else if ($gvars.set.$mix_options()['$[]'](lchan_i)['$==']("+")) {
          if ((($a = nil['$!='](lnote)) !== nil && (!$a.$$is_boolean || $a == true))) {
            mnote = lnote.$clone();
            if ((($a = (((($b = ((($c = nil['$=='](mchan['$[]'](lnote_i))) !== false && $c !== nil) ? $c : "r"['$=='](mchan['$[]'](lnote_i).$type()))) !== false && $b !== nil) ? $b : $rb_lt(mchan['$[]'](lnote_i).$volume(), lnote.$volume())))) !== nil && (!$a.$$is_boolean || $a == true))) {
              return mchan['$[]='](lnote_i, mnote)
              } else {
              return nil
            }
            } else {
            return nil
          }
          } else {
          return nil
        }}, TMP_71.$$s = self, TMP_71), $a).call($b);
      return abs_index = $rb_plus(abs_index, 1);}, TMP_70.$$s = self, TMP_70), $a).call($b);
    return mmod['$[]='](s_i, mchan);}, TMP_69.$$s = self, TMP_69), $a).call($o);
  lmod = mmod;
  self.$puts("--- render into text ---");
  text_lines = [];
  empty_note = $scope.get('LNote').$new(-1, 0, 0, 0, 0, ".", "");
  pforms = [15, 15, 15];
  penote = empty_note;
  ($a = ($p = $gvars.set.$max_row()).$times, $a.$$p = (TMP_72 = function(row_i){var self = TMP_72.$$s || this, $a, $b, TMP_73, $c, TMP_74, $d, TMP_75, $e, TMP_76, cnotes = nil, cenote = nil, cforms = nil, noteA = nil, noteB = nil, noteC = nil, env = nil, text_line = nil;
if (row_i == null) row_i = nil;
  cnotes = [];
    ($a = ($b = ($range(0, 2, false))).$each, $a.$$p = (TMP_73 = function(i){var self = TMP_73.$$s || this;
if (i == null) i = nil;
    return cnotes['$<<'](lmod['$[]'](i)['$[]'](row_i))}, TMP_73.$$s = self, TMP_73), $a).call($b);
    cnotes = ($a = ($c = cnotes).$map, $a.$$p = (TMP_74 = function(x){var self = TMP_74.$$s || this, $a;
if (x == null) x = nil;
    return x = (function() {if ((($a = nil['$!='](x)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return x
        } else {
        return empty_note.$clone()
      } return nil; })()}, TMP_74.$$s = self, TMP_74), $a).call($c);
    cenote = empty_note.$clone();
    cforms = pforms.$clone();
    ($a = ($d = cnotes).$each_with_index, $a.$$p = (TMP_75 = function(x, cn_i){var self = TMP_75.$$s || this, $a;
if (x == null) x = nil;if (cn_i == null) cn_i = nil;
    if ((($a = self.$enote_is_real(x)) !== nil && (!$a.$$is_boolean || $a == true))) {
        cenote = (function() {if ((($a = $rb_gt(x, cenote)) !== nil && (!$a.$$is_boolean || $a == true))) {
          return x
          } else {
          return cenote
        } return nil; })()}
      if ((($a = self.$note_is_real(x)) !== nil && (!$a.$$is_boolean || $a == true))) {
        return cforms['$[]='](cn_i, x.$envelope())
        } else {
        return nil
      }}, TMP_75.$$s = self, TMP_75), $a).call($d);
    ($a = ($e = ($range(0, 2, false))).$each, $a.$$p = (TMP_76 = function(i){var self = TMP_76.$$s || this, $a, $b, $c;
if (i == null) i = nil;
    if ((($a = ($b = ($c = self.$enote_is_real(cnotes['$[]'](i)), $c !== false && $c !== nil ?self.$enote_is_real(cenote) : $c), $b !== false && $b !== nil ?cnotes['$[]'](i).$epitch()['$!='](cenote.$epitch()) : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        (($a = ["m"]), $b = cnotes['$[]'](i), $b['$kind='].apply($b, $a), $a[$a.length-1])
      } else if ((($a = ($b = ($c = self.$enote_is_real(cnotes['$[]'](i)), $c !== false && $c !== nil ?self.$enote_is_real(cenote) : $c), $b !== false && $b !== nil ?cnotes['$[]'](i).$epitch()['$=='](cenote.$epitch()) : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = $rb_ge(($rb_minus(cenote.$oct(), cnotes['$[]'](i).$oct())), 1)) !== nil && (!$a.$$is_boolean || $a == true))) {
          (($a = [$rb_plus(cnotes['$[]'](i).$note(), 12)]), $b = cnotes['$[]'](i), $b['$note='].apply($b, $a), $a[$a.length-1])}}
      if ((($a = ($b = self.$enote_is_real(cenote), $b !== false && $b !== nil ?cenote.$volume()['$=='](15) : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
        if ((($a = ($b = ($c = self.$note_is_empty(cnotes['$[]'](i)), $c !== false && $c !== nil ?($range(1, 14, false))['$==='](pforms['$[]'](i)) : $c), $b !== false && $b !== nil ?penote.$epitch()['$!='](cenote.$epitch()) : $b)) !== nil && (!$a.$$is_boolean || $a == true))) {
          return (($a = [15]), $b = cnotes['$[]'](i), $b['$envelope='].apply($b, $a), $a[$a.length-1])
          } else {
          return nil
        }
        } else {
        return nil
      }}, TMP_76.$$s = self, TMP_76), $a).call($e);
    noteA = self.$print_note(cnotes['$[]'](0));
    noteB = self.$print_note(cnotes['$[]'](1));
    noteC = self.$print_note(cnotes['$[]'](2));
    env = self.$print_enote(cenote);
    text_line = "" + (env) + "|..|" + (noteA) + "|" + (noteB) + "|" + (noteC);
    text_lines['$<<'](text_line);
    if ((($a = self.$enote_is_real(cenote)) !== nil && (!$a.$$is_boolean || $a == true))) {
      penote = cenote}
    return pforms = cforms;}, TMP_72.$$s = self, TMP_72), $a).call($p);
  patterns = (function() {if (($gvars.set.$max_row()['$%']($gvars.set.$pattern_size()))['$=='](0)) {
    return ($rb_divide($gvars.set.$max_row(), $gvars.set.$pattern_size()))
    } else {
    return $rb_plus(($rb_divide($gvars.set.$max_row(), $gvars.set.$pattern_size())), 1)
  } return nil; })();
  hashed_patterns = $hash2([], {});
  wet_patterns = [];
  dry_patterns = [];
  map_patterns = $hash2([], {});
  use_patterns = $hash2([], {});
  wet_play_order = [];
  ($a = ($q = patterns).$times, $a.$$p = (TMP_77 = function(i){var self = TMP_77.$$s || this, $a, $b, TMP_78, pattern_text = nil, txt = nil;
    if ($gvars.set == null) $gvars.set = nil;
if (i == null) i = nil;
  pattern_text = "";
    txt = text_lines.$slice($rb_plus($gvars.set.$skip_lines(), $rb_times(i, $gvars.set.$pattern_size())), $gvars.set.$pattern_size());
    if ((($a = nil['$!='](txt)) !== nil && (!$a.$$is_boolean || $a == true))) {
      ($a = ($b = txt).$each, $a.$$p = (TMP_78 = function(text_line){var self = TMP_78.$$s || this;
if (text_line == null) text_line = nil;
      return pattern_text['$<<'](text_line)['$<<']("\n")}, TMP_78.$$s = self, TMP_78), $a).call($b)}
    self.$puts("===pattern: " + (i));
    if ((($a = (nil['$=='](hashed_patterns['$[]'](pattern_text)))) !== nil && (!$a.$$is_boolean || $a == true))) {
      use_patterns['$[]='](i, true);
      self.$puts("new pattern: " + (i));
      hashed_patterns['$[]='](pattern_text, i);
      wet_patterns['$<<'](pattern_text);
      return wet_play_order['$<<'](i);
      } else {
      use_patterns['$[]='](i, false);
      self.$puts("pattern " + (i) + " is equal to " + (hashed_patterns['$[]'](pattern_text)));
      wet_patterns['$<<'](pattern_text);
      return wet_play_order['$<<'](hashed_patterns['$[]'](pattern_text));
    }}, TMP_77.$$s = self, TMP_77), $a).call($q);
  wet_play_order_txt = "L";
  ($a = ($r = wet_play_order).$each, $a.$$p = (TMP_79 = function(pattern_num){var self = TMP_79.$$s || this;
if (pattern_num == null) pattern_num = nil;
  return wet_play_order_txt['$<<'](pattern_num.$to_s())['$<<'](",")}, TMP_79.$$s = self, TMP_79), $a).call($r);
  wet_play_order_txt['$[]='](-1, "");
  ornaments_txt = "";
  self.$puts("ornaments.inspect: " + (ornaments.$inspect()));
  ornaments = ornaments.$invert();
  self.$puts("ornaments.inspect: " + (ornaments.$inspect()));
  ($a = ($s = ornaments.$sort()).$map, $a.$$p = (TMP_80 = function(v, k){var self = TMP_80.$$s || this, $a;
if (v == null) v = nil;if (k == null) k = nil;
  if ((($a = v['$!='](0)) !== nil && (!$a.$$is_boolean || $a == true))) {
      ornaments_txt['$<<']("\n[Ornament" + (v) + "]\n");
      return ornaments_txt['$<<'](k.$to_s())['$<<']("\n");
      } else {
      return nil
    }}, TMP_80.$$s = self, TMP_80), $a).call($s);
  self.$require("./autosiril"+ '/../' + "./module_template.rb");
  txt_file = $scope.get('File').$open($gvars.set.$out_file(), "w");
  txt_file.$puts(self.$module_header($scope.get('ARGV')['$[]'](1).$to_s(), wet_play_order_txt, ornaments_txt));
  return ($a = ($t = wet_patterns).$each_with_index, $a.$$p = (TMP_81 = function(pattern_text, i){var self = TMP_81.$$s || this, $a, $b;
if (pattern_text == null) pattern_text = nil;if (i == null) i = nil;
  if ((($a = (($b = use_patterns['$[]'](i), $b !== false && $b !== nil ?""['$!='](pattern_text) : $b))) !== nil && (!$a.$$is_boolean || $a == true))) {
      txt_file.$puts("\n[Pattern" + (i) + "]");
      return txt_file.$puts(pattern_text);
      } else {
      return nil
    }}, TMP_81.$$s = self, TMP_81), $a).call($t);
})(Opal);

/* Generated by Opal 0.9.2 */
(function(Opal) {
  Opal.dynamic_require_severity = "error";
  var OPAL_CONFIG = { method_missing: true, arity_check: false, freezing: true, tainting: true };
  var self = Opal.top, $scope = Opal, nil = Opal.nil, $breaker = Opal.breaker, $slice = Opal.slice;

  Opal.add_stubs(['$exit']);
  return $scope.get('Kernel').$exit()
})(Opal);
