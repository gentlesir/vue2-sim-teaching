(function (global) {
  'use strict';

  var V = global.SfcSim = global.SfcSim || {};
  var uid = 0;   

  function DepList() {
    this.id = uid++;
    this.subs = [];   
  }
  DepList.prototype.depend = function () {
    if (DepList.target) {
      if (this.subs.indexOf(DepList.target) < 0) this.subs.push(DepList.target);
      if (DepList.target.deps.indexOf(this) < 0) DepList.target.deps.push(this);
    }
  };
  DepList.prototype.notify = function () {
    var subs = this.subs.slice();
    for (var i = 0; i < subs.length; i++) subs[i].update();
  };
  DepList.target = null;      
  var subStack = [];   
  function pushTarget(subscriber) {
    subStack.push(DepList.target);
    DepList.target = subscriber;
  }
  function popTarget() {
    DepList.target = subStack.pop();
  }

  function Subscriber(vm, getter, cb, options) {
    options = options || {};
    this.vm = vm;
    this.getter = getter;      
    this.cb = cb;              
    this.deps = [];            
    this.id = uid++;
    this.lazy = !!options.lazy;   
    this.dirty = this.lazy;       
    this.sync = !!options.sync;   
    this.deep = !!options.deep;   
    this.user = !!options.user;   
    this.value = this.lazy ? undefined : this.get();
  }
  Subscriber.prototype.get = function () {
    pushTarget(this);
    var value;
    try {
      value = this.getter.call(this.vm);
    } catch (e) {
      if (this.user && this.vm.$onError) this.vm.$onError(e);
      else throw e;
      value = undefined;
    } finally {
      if (this.deep) traverse(value);   
      popTarget();
    }
    return value;
  };
  Subscriber.prototype.update = function () {
    if (this.lazy) {
      this.dirty = true;    
      return;
    }
    if (this.sync) this.run();
    else enqueueSub(this);   
  };
  Subscriber.prototype.evaluate = function () {
    this.value = this.get();
    this.dirty = false;
  };
  Subscriber.prototype.run = function () {
    var oldVal = this.value;
    this.value = this.get();
    if (this.user && this.cb && this.value !== oldVal) {
      try { this.cb.call(this.vm, this.value, oldVal); }
      catch (e) { if (this.vm.$onError) this.vm.$onError(e); }
    }
  };

  function traverse(val) {
    if (!val || typeof val !== 'object') return;
    if (Array.isArray(val)) {
      for (var i = 0; i < val.length; i++) traverse(val[i]);
      return;
    }
    if (val.__ob__) {
      if (val.__ob__._traversing) return;   
      val.__ob__._traversing = true;
      Object.keys(val).forEach(function (k) { traverse(val[k]); });
      val.__ob__._traversing = false;
    }
  }

  var queue = [];       
  var queueIds = {};    
  var waiting = false;
  function enqueueSub(subscriber) {
    if (queueIds[subscriber.id]) return;
    queueIds[subscriber.id] = true;
    queue.push(subscriber);
    if (!waiting) {
      waiting = true;
      deferFlush(flushQueue);
    }
  }
  function flushQueue() {
    var q = queue.slice();
    queue.length = 0;
    queueIds = {};
    waiting = false;
    q.sort(function (a, b) { return a.id - b.id; });   
    for (var i = 0; i < q.length; i++) {
      try { q[i].run(); } catch (e) {  }
    }
  }

  var tickCallbacks = [];
  var pending = false;
  function deferFlush(cb) {
    tickCallbacks.push(cb);
    if (!pending) {
      pending = true;
      setTimeout(function () {
        pending = false;
        var cbs = tickCallbacks.slice();
        tickCallbacks.length = 0;
        for (var i = 0; i < cbs.length; i++) {
          try { cbs[i](); } catch (e) {  }
        }
      }, 0);
    }
  }

  function walkDeep(value) {
    if (!value || typeof value !== 'object') return value;   
    if (value.__ob__) return value;                          
    if (Array.isArray(value)) return observeArray(value);
    return observeObject(value);
  }

  function observeObject(obj) {
    if (obj.__ob__) return obj;
    Object.defineProperty(obj, '__ob__', {
      value: { dep: new DepList(), _traversing: false },
      enumerable: false,     
      configurable: true,
      writable: true
    });
    Object.keys(obj).forEach(function (key) {
      trackProp(obj, key, obj[key]);
    });
    return obj;
  }

  function observeArray(arr) {
    if (arr.__ob__) return arr;
    Object.defineProperty(arr, '__ob__', {
      value: { dep: new DepList(), _traversing: false },
      enumerable: false,
      configurable: true,
      writable: true
    });
    var MUT = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'];
    MUT.forEach(function (m) {
      var orig = Array.prototype[m];
      arr[m] = function () {
        var r = orig.apply(arr, arguments);
        var inserted;
        if (m === 'push' || m === 'unshift') inserted = Array.prototype.slice.call(arguments);
        else if (m === 'splice') inserted = Array.prototype.slice.call(arguments, 2);
        if (inserted) inserted.forEach(function (v) { walkDeep(v); });
        arr.__ob__.dep.notify();
        return r;
      };
    });
    arr.forEach(function (v) { walkDeep(v); });
    return arr;
  }

  function trackProp(obj, key, val) {
    var dep = new DepList();
    walkDeep(val);   
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      get: function () {
        dep.depend();                                     
        if (val && val.__ob__) val.__ob__.dep.depend();   
        return val;
      },
      set: function (newVal) {
        if (newVal === val) return;    
        val = newVal;
        walkDeep(val);                  
        dep.notify();                  
      }
    });
  }

  V.Reactivity = {
    DepList: DepList,
    Subscriber: Subscriber,
    pushTarget: pushTarget,
    popTarget: popTarget,
    deferFlush: deferFlush,
    walkDeep: walkDeep,
    trackProp: trackProp
  };
})(typeof window !== 'undefined' ? window : globalThis);
