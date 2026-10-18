(function (global) {      

  'use strict';

  var V = global.SfcSim = global.SfcSim || {};

  function parseAttrs(raw) {
    var attrs = {};
    var re = /([\w-]+)\s*=\s*("[^"]*"|'[^']*')|([\w-]+)/g;
    var m;
    while ((m = re.exec(raw)) !== null) {
      if (m[1]) {
        attrs[m[1]] = m[2].slice(1, -1);
      } else if (m[3]) {
        attrs[m[3]] = true;
      }
    }
    return attrs;
  }

  function splitBlocks(source) {
    var blocks = [];
    var re = /<\s*(template|script|style)\b([^>]*)>/gi;
    var m;
    while ((m = re.exec(source)) !== null) {
      var type = m[1].toLowerCase();               
      var attrs = parseAttrs(m[2] || '');          
      var contentStart = m.index + m[0].length;    

      var closeRe = new RegExp('<\\s*(?:' + type + ')\\b|<\\s*/\\s*' + type + '\\s*>', 'gi');
      closeRe.lastIndex = contentStart;
      var depth = 1;
      var closeStart = -1;
      var closeEnd = -1;
      var cm;
      while ((cm = closeRe.exec(source)) !== null) {
        if (cm[0].indexOf('</') === 0) {
          depth--;
          if (depth === 0) {
            closeStart = cm.index;
            closeEnd = cm.index + cm[0].length;
            break;
          }
        } else {
          depth++;
        }
      }

      if (closeEnd < 0) {
        closeStart = source.length;
        closeEnd = source.length;
      }

      blocks.push({
        type: type,
        attrs: attrs,
        lang: attrs.lang || (type === 'script' ? 'js' : 'css'),
        scoped: attrs.scoped !== undefined,      
        content: source.slice(contentStart, closeStart),
        start: m.index,
        end: closeEnd
      });

      re.lastIndex = closeEnd;
    }
    return { blocks: blocks, source: source };
  }

  function extractOptions(scriptSrc) {
    if (!scriptSrc) return '{}';
    var s = scriptSrc;
    s = s.replace(/^\s*import\s+[^;\n]+;?\s*$/gm, '');

    var m = s.match(/export\s+default\s*/);
    if (m) {
      s = s.slice(m.index + m[0].length);
    } else {
      var i = s.indexOf('{');
      if (i >= 0) s = s.slice(i);
    }

    var depth = 0;
    var end = -1;
    var inStr = null;    
    var esc = false;     
    for (var j = 0; j < s.length; j++) {
      var ch = s[j];
      if (esc) { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (inStr) {
        if (ch === inStr) inStr = null;   
        continue;
      }
      if (ch === '\'' || ch === '"' || ch === '`') { inStr = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { end = j; break; }
      }
    }
    if (end >= 0) s = s.slice(0, end + 1);
    return s.trim() || '{}';
  }

  function cleanScript(scriptSrc) {
    if (!scriptSrc) return '__exports__.default = {};';
    var s = scriptSrc.replace(/^\s*import\s+[^;\n]+;?\s*$/gm, '');
    if (/export\s+default/.test(s)) {
      s = s.replace(/export\s+default/, '__exports__.default =');
    } else {
      s = '__exports__.default = ' + extractOptions(s) + ';';
    }
    return s;
  }

  V.splitBlocks = splitBlocks;
  V.extractOptions = extractOptions;
  V.cleanScript = cleanScript;

})(typeof window !== 'undefined' ? window : globalThis);
