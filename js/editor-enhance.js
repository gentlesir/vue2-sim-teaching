(function () {
  'use strict';

  var editor = document.getElementById('codeEditor');
  if (!editor) return;   

  var PAIRS = { '(': ')', '[': ']', '{': '}', "'": "'", '"': '"', '`': '`' };

  function insertText(text) {
    var s = editor.selectionStart;
    var en = editor.selectionEnd;
    editor.value = editor.value.slice(0, s) + text + editor.value.slice(en);
    editor.selectionStart = editor.selectionEnd = s + text.length;
    if (window.SfcSimEditorHighlight) window.SfcSimEditorHighlight();
  }

  editor.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      insertText('  ');
      return;
    }

    if (PAIRS[e.key]) {
      var s = editor.selectionStart;
      var en = editor.selectionEnd;
      var close = PAIRS[e.key];
      e.preventDefault();

      if (s === en) {
        if (e.key === "'" || e.key === '"' || e.key === '`') {
          var before = editor.value.slice(s - 1, s);
          var after = editor.value.slice(s, s + 1);
          if (/[\w]/.test(before) || /[\w]/.test(after)) {
            insertText(e.key);
            return;
          }
          if (after === e.key) {
            editor.selectionStart = editor.selectionEnd = s + 1;
            return;
          }
        }
        insertText(e.key + close);
        editor.selectionStart = editor.selectionEnd = s + 1;   
      } else {
        var sel = editor.value.slice(s, en);
        var nv = editor.value.slice(0, s) + e.key + sel + close + editor.value.slice(en);
        editor.value = nv;
        editor.selectionStart = s + 1;
        editor.selectionEnd = en + 1;   
        if (window.SfcSimEditorHighlight) window.SfcSimEditorHighlight();
      }
      return;
    }

    if (e.key === ')' || e.key === ']' || e.key === '}') {
      var s2 = editor.selectionStart;
      if (s2 === editor.selectionEnd && editor.value[s2] === e.key) {
        e.preventDefault();
        editor.selectionStart = editor.selectionEnd = s2 + 1;
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      var s3 = editor.selectionStart;
      var lineStart = editor.value.lastIndexOf('\n', s3 - 1) + 1;
      var line = editor.value.slice(lineStart, s3);
      var indent = (line.match(/^\s*/) || [''])[0];
      var prev = editor.value.slice(s3 - 1, s3);
      var extra = (prev === '{' || prev === '>' || prev === '(') ? '  ' : '';
      insertText('\n' + indent + extra);
      return;
    }

    if (e.key === 'Backspace') {
      var s4 = editor.selectionStart;
      if (s4 !== editor.selectionEnd) return;   
      var c1 = editor.value.slice(s4 - 1, s4);  
      var c2 = editor.value.slice(s4, s4 + 1);  
      if (PAIRS[c1] && PAIRS[c1] === c2) {
        e.preventDefault();
        editor.value = editor.value.slice(0, s4 - 1) + editor.value.slice(s4 + 1);
        editor.selectionStart = editor.selectionEnd = s4 - 1;
        if (window.SfcSimEditorHighlight) window.SfcSimEditorHighlight();
      }
    }
  });
})();
