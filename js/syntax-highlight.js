(function () {
  'use strict';

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function segment(src) {
    var segs = [];
    var re = /<(template|script|style)\b[^>]*>|<\/\s*(template|script|style)\s*>/gi;
    var m;
    var current = null;   
    var last = 0;
    while ((m = re.exec(src)) !== null) {
      if (m[1]) {
        segs.push({ type: current, text: src.slice(last, m.index) });
        segs.push({ type: 'blocktag', text: m[0] });
        current = m[1].toLowerCase();
        last = m.index + m[0].length;
      } else if (m[2]) {
        segs.push({ type: current, text: src.slice(last, m.index) });
        segs.push({ type: 'blocktag', text: m[0] });
        current = null;
        last = m.index + m[0].length;
      }
    }
    segs.push({ type: current, text: src.slice(last) });
    return segs;
  }

  function hlJS(s) {
    var out = esc(s);
    out = out.replace(/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, '<span class="tok-str">$1</span>');
    out = out.replace(/(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g, '<span class="tok-cmt">$1</span>');
    out = out.replace(/\b(export|default|function|return|var|let|const|if|else|for|while|new|this|true|false|null|undefined|typeof|of|in)\b/g, '<span class="tok-kw">$1</span>');
    out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="tok-num">$1</span>');
    out = out.replace(/\b(data|methods|computed|watch|components|props|created|mounted|destroyed)\b(?=\s*:)/g, '<span class="tok-attr">$1</span>');
    return out;
  }

  function hlCSS(s) {
    var out = esc(s);
    out = out.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-cmt">$1</span>');
    out = out.replace(/([\w-]+)(\s*:)/g, '<span class="tok-attr">$1</span>$2');
    out = out.replace(/(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw)?\b)/g, '<span class="tok-num">$1</span>');
    return out;
  }

  function hlTemplate(s) {
    var out = esc(s);
    out = out.replace(/([\w:@.\-]+)(=)("[^"]*")/g, function (m0, name, eq, val) {
      var cls = /^(v-|@|:)/.test(name) ? 'tok-mustache' : 'tok-attr';
      return '<span class="' + cls + '">' + name + '</span>' + eq + '<span class="tok-str">' + val + '</span>';
    });
    out = out.replace(/(\s)(v-[\w-]+|scoped)(?=[\s&]|$)/gm, '$1<span class="tok-mustache">$2</span>');
    out = out.replace(/\{\{([\s\S]+?)\}\}/g, '<span class="tok-mustache">{{$1}}</span>');
    out = out.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tok-cmt">$1</span>');
    out = out.replace(/(&lt;\/?)([a-zA-Z][\w-]*)/g, function (m0, lt, tag) {
      var cls = /^[A-Z]/.test(tag) ? 'tok-comp' : 'tok-tag';
      return lt + '<span class="' + cls + '">' + tag + '</span>';
    });
    return out;
  }

  function highlight(src) {
    var segs = segment(src);
    var html = '';
    segs.forEach(function (seg) {
      if (seg.type === 'template') html += hlTemplate(seg.text);
      else if (seg.type === 'script') html += hlJS(seg.text);
      else if (seg.type === 'style') html += hlCSS(seg.text);
      else if (seg.type === 'blocktag') html += '<span class="tok-block">' + esc(seg.text) + '</span>';
      else html += esc(seg.text);
    });
    return html;
  }

  var editor = document.getElementById('codeEditor');
  var hlCode = document.getElementById('hlCode');

  function preScrollSync() {
    var pre = hlCode ? hlCode.parentNode : null;
    if (pre) {
      pre.scrollTop = editor.scrollTop;
      pre.scrollLeft = editor.scrollLeft;
    }
  }

  function syncHighlight() {
    if (!editor || !hlCode) return;
    hlCode.innerHTML = highlight(editor.value) + '\n';   
    preScrollSync();
  }

  if (editor) {
    editor.addEventListener('scroll', preScrollSync);
  }

  window.SfcSimEditorHighlight = syncHighlight;
  window.SfcSimHighlight = { highlight: highlight };
})();
