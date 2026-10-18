(function (global) {     
  'use strict';

  var V = global.SfcSim;

  function h(tag) {
    return document.createElement(tag);
  }

  function renderAST(ast, vm, container) {
    var frag = document.createDocumentFragment();
    renderNodes(ast, vm, frag);
    if (container) {
      container.innerHTML = '';
      container.appendChild(frag);
    }
    return frag;
  }

  function renderNodes(nodes, vm, parent) {
    for (var i = 0; i < nodes.length; i++) {
      renderNode(nodes[i], vm, parent);
    }
  }

  function renderNode(node, vm, parent) {
    if (!node) return;
    if (node.type === 'Text') renderText(node, vm, parent);
    else if (node.type === 'IfGroup') renderIfGroup(node, vm, parent);
    else if (node.type === 'Element') renderElement(node, vm, parent);
  }

  function toDisplay(v) {
    if (v === undefined || v === null) return '';
    return String(v);
  }

  function renderText(node, vm, parent) {
    var raw = node.expression;
    var parts = [];
    var re = /\{\{([\s\S]+?)\}\}/g;
    var last = 0;
    var m;
    var hasInterp = false;
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) parts.push({ static: raw.slice(last, m.index) });
      parts.push({ expr: m[1].trim() });
      last = m.index + m[0].length;
      hasInterp = true;
    }
    if (last < raw.length) parts.push({ static: raw.slice(last) });

    if (!hasInterp) {
      parent.appendChild(document.createTextNode(raw));
      return;
    }

    var span = h('span');
    var R = global.SfcSim.Reactivity;
    new R.Subscriber(vm, function () {
      var s = '';
      parts.forEach(function (p) {
        s += p.static !== undefined ? p.static : toDisplay(vm.evalExpr(p.expr));
      });
      if (span.textContent !== s) span.textContent = s;
    }, null, {});
    parent.appendChild(span);
  }

  function renderIfGroup(group, vm, parent) {
    var anchor = document.createComment('v-if');
    parent.appendChild(anchor);
    var R = global.SfcSim.Reactivity;
    var mounted = null;   

    function resolveBranch() {
      for (var i = 0; i < group.branches.length; i++) {
        var b = group.branches[i];
        if (b.expr === null) return b;
        if (vm.evalExpr(b.expr)) return b;
      }
      return null;
    }

    new R.Subscriber(vm, function () {
      var branch = resolveBranch();
      var wantEl = branch ? branch.el : null;
      if (mounted && mounted.__branchEl !== wantEl) {
        if (mounted.parentNode) mounted.parentNode.removeChild(mounted);
        mounted = null;
      }
      if (!mounted && branch) {
        var holder = h('span');
        holder.style.display = 'contents';   
        renderElement(branch.el, vm, holder);
        holder.__branchEl = wantEl;
        parent.insertBefore(holder, anchor.nextSibling);
        mounted = holder;
      }
    }, null, {});
  }

  function renderFor(el, dir, vm, parent) {
    var anchor = document.createComment('v-for');
    parent.appendChild(anchor);
    var R = global.SfcSim.Reactivity;
    var parsed = parseForExpr(dir.value);
    if (!parsed) return;   
    var rendered = [];     

    new R.Subscriber(vm, function () {
      var list;
      try { list = vm.evalExpr(parsed.list); } catch (e) { list = []; }
      if (list == null) list = [];
      if (typeof list === 'string') list = list.split('');            
      if (!Array.isArray(list) && typeof list === 'object') {
        list = Object.keys(list).map(function (k) { return list[k]; });   
      }
      if (!Array.isArray(list)) list = [];

      rendered.forEach(function (r) { if (r.parentNode) r.parentNode.removeChild(r); });
      rendered = [];

      for (var i = 0; i < list.length; i++) {
        var itemScope = Object.create(vm);
        try { itemScope[parsed.item] = list[i]; } catch (e) { }
        if (parsed.index) { try { itemScope[parsed.index] = i; } catch (e) { } }
        var holder = h('span');
        holder.style.display = 'contents';
        renderElement(el, itemScope, holder, true);   
        parent.insertBefore(holder, anchor);
        rendered.push(holder);
      }
    }, null, {});
  }

  function parseForExpr(expr) {
    var m = String(expr).match(/^\s*\(?\s*([\w$]+)\s*(?:,\s*([\w$]+))?\s*\)?\s+(?:in|of)\s+([\s\S]+)\s*$/);
    if (!m) return null;
    return { item: m[1], index: m[2] || null, list: m[3].trim() };
  }

  function renderElement(el, vm, parent, skipFor) {
    if (!skipFor) {
      for (var di = 0; di < el.directives.length; di++) {
        if (el.directives[di].name === 'for') {
          renderFor(el, el.directives[di], vm, parent);
          return;
        }
      }
    }

    var compDef = resolveComponent(el.tag, vm);
    if (compDef) {
      renderComponentTag(el, compDef, vm, parent);
      return;
    }

    var dom = h(el.tag);

    Object.keys(el.plainAttrs).forEach(function (name) {
      var v = el.plainAttrs[name];
      if (name === 'class') {
        dom.className = v;
      } else if (name === 'style') {
        dom.style.cssText = v;
      } else if (name === 'value') {
        dom.value = v;
      } else if (name === 'checked' || name === 'disabled' || name === 'selected' || name === 'readonly') {
        if (v !== false) dom[name] = true;
      } else {
        dom.setAttribute(name, v);
      }
    });

    var R = global.SfcSim.Reactivity;

    var bindKeys = Object.keys(el.bindings);
    if (bindKeys.length) {
      new R.Subscriber(vm, function () {
        bindKeys.forEach(function (prop) {
          applyBinding(dom, prop, vm.evalExpr(el.bindings[prop]), el);
        });
      }, null, {});
    }

    el.directives.forEach(function (dir) {
      if (dir.name === 'show') {
        new R.Subscriber(vm, function () {
          var v = vm.evalExpr(dir.value);
          dom.style.display = v ? '' : 'none';
        }, null, {});
      } else if (dir.name === 'html') {
        new R.Subscriber(vm, function () {
          dom.innerHTML = toDisplay(vm.evalExpr(dir.value));
        }, null, {});
      } else if (dir.name === 'text') {
        new R.Subscriber(vm, function () {
          dom.textContent = toDisplay(vm.evalExpr(dir.value));
        }, null, {});
      }
    });

    Object.keys(el.events).forEach(function (evName) {
      var base = evName.split('.')[0];
      dom.addEventListener(base, function (evt) {
        invokeHandler(vm, el.events[evName], evt);
      });
    });

    var modelDir = null;
    el.directives.forEach(function (dir) { if (dir.name === 'model') modelDir = dir; });
    if (modelDir) setupVModel(dom, el, modelDir, vm);

    if (el.children && el.children.length) {
      renderNodes(el.children, vm, dom);
    }
    parent.appendChild(dom);
  }

  function applyBinding(dom, prop, val, el) {
    if (val === undefined || val === null) val = '';
    if (prop === 'class') {
      var cls = normalizeClass(val);
      var staticCls = (el && el.plainAttrs && el.plainAttrs['class']) ? el.plainAttrs['class'] : '';
      dom.className = (staticCls + ' ' + cls).trim();
    } else if (prop === 'style') {
      var css = normalizeStyle(val);
      var staticStyle = (el && el.plainAttrs && el.plainAttrs.style) ? el.plainAttrs.style : '';
      dom.style.cssText = staticStyle ? staticStyle + ';' + css : css;
    } else if (prop === 'value') {
      if (document.activeElement !== dom || dom.value !== String(val)) dom.value = val;
    } else if (prop === 'checked') {
      dom.checked = !!val;
    } else if (prop === 'disabled' || prop === 'readonly' || prop === 'selected') {
      dom[prop] = !!val;
    } else if (prop === 'src' || prop === 'href') {
      dom.setAttribute(prop, val);
    } else {
      try { dom.setAttribute(prop, val); } catch (e) {  }
    }
  }

  function normalizeClass(v) {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(normalizeClass).filter(Boolean).join(' ');
    if (typeof v === 'object') {
      return Object.keys(v).filter(function (k) { return v[k]; }).join(' ');
    }
    return String(v);
  }

  function normalizeStyle(v) {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
      return Object.keys(v).map(function (k) {
        var prop = k.replace(/([A-Z])/g, '-$1').toLowerCase();   
        var val = v[k];
        var noPx = /^(opacity|z-index|zIndex|font-weight|fontWeight|line-height|lineHeight|flex|flex-grow|flexGrow|flex-shrink|flexShrink|order)$/.test(k);
        if (typeof val === 'number' && !noPx) val = val + 'px';
        return prop + ':' + val;
      }).join(';');
    }
    return String(v);
  }

  function invokeHandler(vm, expr, evt) {
    var e = String(expr).trim();
    var callExpr;
    if (/^[\w$]+\s*\([\s\S]*\)$/.test(e)) {
      callExpr = e;                    
    } else if (/^[\w$]+$/.test(e)) {
      callExpr = e + '($event)';       
    } else {
      callExpr = e;                    
    }
    try {
      var fn = new Function('$event', 'with (this) { ' + callExpr + ' }');
      fn.call(vm, evt);
    } catch (err) {
      vm.$onError(err);
    }
  }

  function setupVModel(dom, el, dir, vm) {
    var expr = dir.value;
    var tag = el.tag;
    var type = String(el.plainAttrs.type || el.bindings.type || '').toLowerCase();
    var R = global.SfcSim.Reactivity;

    if (tag === 'input' && type === 'checkbox') {
      var hasValue = (el.bindings && el.bindings.value != null) ||
                     (el.plainAttrs && el.plainAttrs.value != null);
      if (hasValue) {
        dom.addEventListener('change', function () {
          var list = vm.evalExpr(expr);
          var v = dom.value;
          if (dom.checked) {
            if (Array.isArray(list)) {
              if (list.indexOf(v) < 0) list.push(v);
            } else {
              vm.assignExpr(expr, [v]);
            }
          } else if (Array.isArray(list)) {
            var at = list.indexOf(v);
            if (at >= 0) list.splice(at, 1);
          }
        });
        new R.Subscriber(vm, function () {
          var list = vm.evalExpr(expr);
          dom.checked = Array.isArray(list) ? list.indexOf(dom.value) >= 0 : !!list;
        }, null, {});
      } else {
        dom.addEventListener('change', function () { vm.assignExpr(expr, dom.checked); });
        new R.Subscriber(vm, function () { dom.checked = !!vm.evalExpr(expr); }, null, {});
      }
    } else if (tag === 'input' && type === 'radio') {
      dom.addEventListener('change', function () {
        if (dom.checked) vm.assignExpr(expr, dom.value);
      });
      new R.Subscriber(vm, function () {
        var v = vm.evalExpr(expr);
        dom.checked = String(v) === dom.value;
      }, null, {});
    } else if (tag === 'select') {
      dom.addEventListener('change', function () { vm.assignExpr(expr, dom.value); });
      new R.Subscriber(vm, function () {
        var v = vm.evalExpr(expr);
        dom.value = v === undefined ? '' : v;
      }, null, {});
    } else {
      dom.addEventListener('input', function () { vm.assignExpr(expr, dom.value); });
      new R.Subscriber(vm, function () {
        var v = vm.evalExpr(expr);
        v = (v === undefined || v === null) ? '' : String(v);
        if (document.activeElement === dom) {
          if (dom.value !== v) {
            var s = dom.selectionStart;
            dom.value = v;
            try { dom.setSelectionRange(s, s); } catch (e) { }
          }
        } else {
          dom.value = v;
        }
      }, null, {});
    }
  }

  function resolveComponent(tag, vm) {
    var name = global.SfcSim.dashToCamel(tag);
    var capitalized = name.charAt(0).toUpperCase() + name.slice(1);
    if (vm._components) {
      if (vm._components[name]) return vm._components[name];
      if (vm._components[capitalized]) return vm._components[capitalized];
    }
    return null;
  }

  function renderComponentTag(el, compDef, vm, parent) {
    var propsData = {};
    Object.keys(el.plainAttrs).forEach(function (k) {
      if (k !== 'class' && k !== 'style') propsData[k] = el.plainAttrs[k];
    });
    Object.keys(el.bindings).forEach(function (k) {
      propsData[k] = vm.evalExpr(el.bindings[k]);
    });
    var holder = h('span');
    holder.style.display = 'contents';
    parent.appendChild(holder);
    var childVm = new global.SfcSim.Vue(compDef, propsData, vm, holder);
  }

  V.renderAST = renderAST;
  V.renderNodes = renderNodes;
})(typeof window !== 'undefined' ? window : globalThis);
