(function (global) {
  'use strict';

  var V = global.SfcSim = global.SfcSim || {};


  var VOID_TAGS = ['br', 'hr', 'img', 'input', 'meta', 'link',
    'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];

  function isVoidTag(tag) {
    return VOID_TAGS.indexOf(tag) >= 0;
  }

  function findTagEnd(html, start) {
    var inQuote = null;
    for (var i = start; i < html.length; i++) {
      var ch = html[i];
      if (inQuote) {
        if (ch === inQuote) inQuote = null;    
        continue;
      }
      if (ch === '"' || ch === "'") { inQuote = ch; continue; }
      if (ch === '>') return i;
    }
    return -1;   
  }

  function parseAttrs(raw) {
    var attrs = {};
    var re = /([\w:@.\-]+)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;
    var m;
    while ((m = re.exec(raw)) !== null) {
      var name = m[1];
      if (!name) continue;
      var val = m[2];
      if (val === undefined) { attrs[name] = true; continue; }   
      if (val[0] === '"' || val[0] === "'") val = val.slice(1, -1);   
      attrs[name] = val;
    }
    return attrs;
  }

  function parseHTML(html) {
    var nodes = [];      
    var stack = [];      
    var i = 0;
    var len = html.length;

    function currentParent() {
      return stack.length ? stack[stack.length - 1].node : null;
    }
    function addNode(node) {
      var p = currentParent();
      if (p) p.children.push(node);
      else nodes.push(node);
    }

    while (i < len) {
      var lt = html.indexOf('<', i);
      if (lt < 0) {
        var rest = html.slice(i);
        if (rest.trim()) addNode({ type: 'Text', text: rest });
        break;
      }
      if (lt > i) {
        var text = html.slice(i, lt);
        if (text.trim()) addNode({ type: 'Text', text: text });
      }

      if (html.slice(lt, lt + 4) === '<!--') {
        var ce = html.indexOf('-->', lt);
        i = ce < 0 ? len : ce + 3;
        continue;
      }

      if (html.slice(lt, lt + 2) === '</') {
        var gt2 = html.indexOf('>', lt);
        if (gt2 < 0) break;
        var tagName2 = html.slice(lt + 2, gt2).trim().toLowerCase();
        for (var k = stack.length - 1; k >= 0; k--) {
          if (stack[k].tag === tagName2) { stack.length = k; break; }
        }
        i = gt2 + 1;
        continue;
      }

      var gt = findTagEnd(html, lt);
      if (gt < 0) break;    
      var tagSrc = html.slice(lt + 1, gt);
      var selfClosing = /\/$/.test(tagSrc);       
      if (selfClosing) tagSrc = tagSrc.slice(0, -1);
      var sp = tagSrc.match(/^[\w-]+/);
      var tagName = sp ? sp[0].toLowerCase() : '';
      var attrsRaw = tagSrc.slice(tagName.length);

      var node = {
        type: 'Element',
        tag: tagName,
        attrs: parseAttrs(attrsRaw),
        children: []
      };
      addNode(node);
      i = gt + 1;

      if (!selfClosing && !isVoidTag(tagName)) {
        stack.push({ node: node, tag: tagName });
      }
    }
    return nodes;
  }

  function processNodes(nodes) {
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];

      if (n.type === 'Text') {
        if (!n.text.trim()) continue;
        out.push({ type: 'Text', expression: n.text });
        continue;
      }

      var el = {
        type: 'Element',
        tag: n.tag,
        directives: [],    
        bindings: {},      
        events: {},        
        plainAttrs: {},    
        children: processNodes(n.children)
      };

      var attrs = n.attrs;
      var ifGroup = null;   
      Object.keys(attrs).forEach(function (name) {
        var val = attrs[name] === true ? '' : attrs[name];

        if (name === 'v-if') {
          ifGroup = { kind: 'if', expr: val, el: el };
        } else if (name === 'v-else-if') {
          ifGroup = { kind: 'elseif', expr: val, el: el };
        } else if (name === 'v-else') {
          ifGroup = { kind: 'else', expr: null, el: el };
        } else if (name === 'v-for' || name.indexOf('v-for.') === 0) {
          el.directives.push({ name: 'for', arg: null, value: val, modifiers: name.split('.').slice(1) });
        } else if (name === 'v-show') {
          el.directives.push({ name: 'show', arg: null, value: val, modifiers: [] });
        } else if (name === 'v-model') {
          el.directives.push({ name: 'model', arg: null, value: val, modifiers: [] });
        } else if (name === 'v-html') {
          el.directives.push({ name: 'html', arg: null, value: val, modifiers: [] });
        } else if (name === 'v-text') {
          el.directives.push({ name: 'text', arg: null, value: val, modifiers: [] });
        } else if (name === 'v-pre') {
          el.directives.push({ name: 'pre', arg: null, value: '', modifiers: [] });
        } else if (name.indexOf('v-bind:') === 0 || name[0] === ':') {
          var prop = name.indexOf('v-bind:') === 0 ? name.slice(7) : name.slice(1);
          el.bindings[prop] = val;
        } else if (name.indexOf('v-on:') === 0 || name[0] === '@') {
          var ev = name.indexOf('v-on:') === 0 ? name.slice(5) : name.slice(1);
          el.events[ev] = val;
        } else if (name === 'v-slot' || name.indexOf('v-slot:') === 0) {
          el.directives.push({ name: 'slot', arg: name === 'v-slot' ? 'default' : name.slice(7), value: val, modifiers: [] });
        } else if (name.indexOf('v-') === 0) {
          el.directives.push({ name: name.slice(2), arg: null, value: val, modifiers: [], custom: true });
        } else {
          el.plainAttrs[name] = val;
        }
      });

      if (ifGroup) {
        var prev = out.length ? out[out.length - 1] : null;
        if (ifGroup.kind === 'if') {
          el.ifChain = [{ expr: ifGroup.expr, el: el }];
          out.push({ type: 'IfGroup', branches: el.ifChain, els: [el] });
          continue;   
        }
        if (prev && prev.type === 'IfGroup') {
          prev.branches.push({ expr: ifGroup.expr, el: el });
          prev.els.push(el);
          continue;
        }
        out.push(el);
        continue;
      }
      out.push(el);
    }
    return out;
  }

  function buildAst(tpl) {
    var raw = parseHTML(tpl);
    return processNodes(raw);
  }

  V.buildAst = buildAst;
  V.parseHTML = parseHTML;
})(typeof window !== 'undefined' ? window : globalThis);
