(function (global) {    
  'use strict';

  var R = global.SfcSim.Reactivity;
  var DepList = R.DepList;
  var Subscriber = R.Subscriber;
  var deferFlush = R.deferFlush;
  var walkDeep = R.walkDeep;
  var V = global.SfcSim;

  var uid = 0;

  function Vue(options, propsData, parent, mountEl) {
    options = options || {};
    var self = this;
    this.$options = options;
    this.$parent = parent || null;
    this.$uid = uid++;
    this.$el = null;
    this.hostEl = mountEl || null;
    this.subList = [];
    this.$onError = function (e) {
      if (V._errorHandler) V._errorHandler(e, self);
    };

    this.propStore = {};
    var propDefs = options.props || [];
    if (Array.isArray(propDefs)) {
      propDefs.forEach(function (name) {
        self.propStore[name] = propsData ? propsData[name] : undefined;
      });
    } else if (propDefs && typeof propDefs === 'object') {
      Object.keys(propDefs).forEach(function (name) {
        var def = propDefs[name];
        var val = (propsData && propsData[name] !== undefined)
          ? propsData[name]
          : (def && def.default !== undefined
              ? (typeof def.default === 'function' ? def.default() : def.default)
              : undefined);
        self.propStore[name] = val;
      });
    }
    walkDeep(this.propStore);
    aliasProps(self, 'propStore');   

    this.dataStore = {};
    var dataFn = options.data;
    var dataObj;
    try {
      dataObj = typeof dataFn === 'function' ? (dataFn.call(self) || {}) : (dataFn || {});
    } catch (e) {
      dataObj = {};
      self.$onError(e);
    }
    Object.keys(dataObj).forEach(function (k) { self.dataStore[k] = dataObj[k]; });
    walkDeep(this.dataStore);          
    aliasProps(self, 'dataStore');     

    var methods = options.methods || {};
    Object.keys(methods).forEach(function (name) {
      if (typeof methods[name] === 'function') {
        self[name] = methods[name].bind(self);   
      }
    });

    this.computedDeps = {};
    var computed = options.computed || {};
    Object.keys(computed).forEach(function (name) {
      var def = computed[name];
      var getter = typeof def === 'function' ? def : (def && def.get);
      var setter = (def && typeof def === 'object') ? def.set : null;
      var subscriber = new Subscriber(self, getter, null, { lazy: true });   
      self.computedDeps[name] = subscriber;
      defineComputed(self, name, setter);
    });

    var watches = options.watch || {};
    Object.keys(watches).forEach(function (key) {
      var def = watches[key];
      var handler;
      var opts = {};
      if (typeof def === 'function') {
        handler = def;   
      } else if (typeof def === 'string' && typeof self[def] === 'function') {
        handler = self[def].bind(self);   
      } else if (def && typeof def === 'object') {
        handler = typeof def.handler === 'string' ? self[def.handler].bind(self) : def.handler;
        opts.deep = !!def.deep;
        opts.immediate = !!def.immediate;
      }
      if (typeof handler !== 'function') return;
      var w = new Subscriber(self, function () {
        return self.evalExpr(key);    
      }, function (nv, ov) {
        try { handler.call(self, nv, ov); } catch (e) { self.$onError(e); }
      }, { sync: false, deep: opts.deep, user: true });
      self.subList.push(w);
      if (opts.immediate) {
        try { handler.call(self, w.value, undefined); } catch (e) { self.$onError(e); }
      }
    });

    this._components = {};
    var comps = options.components || {};
    Object.keys(comps).forEach(function (name) {
      self._components[V.dashToCamel(name)] = comps[name];
      self._components[name] = comps[name];
    });

    callHook(self, 'created');

    if (typeof self.paint === 'function') {
      this.paintSub = new Subscriber(self, function () {
        return self.paint();
      }, null, {});
    }

    deferFlush(function () {
      callHook(self, 'mounted');
    });
  }

  function defineComputed(vm, name, setter) {
    Object.defineProperty(vm, name, {
      enumerable: true,
      configurable: true,
      get: function () {
        var w = vm.computedDeps[name];
        if (w.dirty) w.evaluate();       
        if (DepList.target && DepList.target !== w) {
          w.deps.slice().forEach(function (d) { d.depend(); });
        }
        return w.value;
      },
      set: function (v) {
        if (setter) setter.call(vm, v);   
      }
    });
  }

  function aliasProps(vm, sourceKey) {
    Object.keys(vm[sourceKey]).forEach(function (k) {
      if (k in vm) return;   
      Object.defineProperty(vm, k, {
        enumerable: true,
        configurable: true,
        get: function () { return vm[sourceKey][k]; },
        set: function (v) { vm[sourceKey][k] = v; }
      });
    });
  }

  function callHook(vm, name) {
    var hook = vm.$options[name];
    if (typeof hook === 'function') {
      try { hook.call(vm); } catch (e) { vm.$onError(e); }
    }
  }

  function dashToCamel(s) {
    return String(s).replace(/-(\w)/g, function (_, c) { return c ? c.toUpperCase() : ''; });
  }

  Vue.prototype.evalExpr = function (expr) {
    var cache = this._exprCache;
    if (!cache) cache = this._exprCache = {};   
    var fn = cache[expr];
    if (!fn) {
      try {
        fn = cache[expr] = new Function('__ctx', 'with (__ctx) { return (' + expr + '); }');
      } catch (e) {
        fn = cache[expr] = function () { return undefined; };   
      }
    }
    try {
      return fn(this);
    } catch (e) {
      return undefined;   
    }
  };

  Vue.prototype.assignExpr = function (expr, value) {
    try {
      var fn = new Function('__val', 'with (this) { ' + expr.trim() + ' = __val; }');
      fn.call(this, value);
    } catch (e) {
      this.$onError(e);
    }
  };

  Vue.prototype.$nextTick = function (cb) { deferFlush(cb); };

  Vue.prototype.$set = function (obj, key, val) {
    if (Array.isArray(obj)) {
      obj.splice(key, 1, val);   
      return val;
    }
    if (obj && typeof obj === 'object') {
      obj[key] = val;
      if (!(key in obj) || !(Object.getOwnPropertyDescriptor(obj, key) || {}).get) {
        R.trackProp(obj, key, val);   
      }
      if (obj.__ob__) obj.__ob__.dep.notify();
    }
    return val;
  };

  Vue.prototype.$destroy = function () {
    callHook(this, 'destroyed');
  };

  V.Vue = Vue;
  V.callHook = callHook;
  V.dashToCamel = dashToCamel;
})(typeof window !== 'undefined' ? window : globalThis);
