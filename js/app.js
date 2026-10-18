(function () {
  'use strict';

  if (window.SFC_BLOCKED) return;

  var V = window.SfcSim;

  var editor = document.getElementById('codeEditor');       
  var preview = document.getElementById('previewScreen');   
  var consoleBody = document.getElementById('consoleBody'); 
  var logCount = document.getElementById('logCount');       
  var kbBody = document.getElementById('kbBody');           
  var app = null;      
  var logN = 0;        

  function addLog(type, msg) {
    logN++;
    logCount.textContent = logN + ' 条';
    var line = document.createElement('div');
    line.className = 'log-line ' + type;
    var tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = type === 'error' ? 'ERR' : (type === 'warn' ? 'WRN' : 'LOG');
    var m = document.createElement('span');
    m.className = 'msg';
    m.textContent = String(msg);   
    line.appendChild(tag);
    line.appendChild(m);
    consoleBody.appendChild(line);
    consoleBody.scrollTop = consoleBody.scrollHeight;   
  }

  function run() {
    consoleBody.innerHTML = '';
    logN = 0;
    logCount.textContent = '0 条';
    preview.innerHTML = '';
    V.clearStyles(document.head);

    var source = editor.value;
    try {
      var appFactory = V.createApp({
        container: preview,          
        styleTarget: document.head,  
        onError: function (e) { addLog('error', e.message); }   
      });
      app = appFactory.run(source);
      addLog('info', '运行成功');
      console.log('[app.js] 代码跑完了，DOM 节点数：', preview.querySelectorAll('*').length);
    } catch (e) {
      addLog('error', e.message);   
    }
  }

  function renderKB() {
    var data = (window.SfcSim && window.SfcSim.KNOWLEDGE) || [];
    data.forEach(function (group) {
      var g = document.createElement('div');
      g.className = 'kb-group';

      var title = document.createElement('div');
      title.className = 'kb-group-title';
      title.innerHTML = '<span class="arrow">&#9660;</span>' + group.title;

      var items = document.createElement('div');
      items.className = 'kb-items';

      (group.items || []).forEach(function (it) {
        var d = document.createElement('div');
        d.className = 'kb-item';
        d.innerHTML = it.name + '<span class="d">' + (it.desc || '') + '</span>';
        d.addEventListener('click', function () {
          editor.value = it.code;
          if (window.SfcSimEditorHighlight) window.SfcSimEditorHighlight();
          run();
          var all = kbBody.querySelectorAll('.kb-item.active');
          for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
          d.classList.add('active');
        });
        items.appendChild(d);
      });

      title.addEventListener('click', function () {
        g.classList.toggle('collapsed');
      });

      g.appendChild(title);
      g.appendChild(items);
      kbBody.appendChild(g);
    });
  }

  document.getElementById('btnRun').addEventListener('click', run);

  document.getElementById('btnClear').addEventListener('click', function () {
    editor.value = '';
    preview.innerHTML = '';
    V.clearStyles(document.head);
    if (window.SfcSimEditorHighlight) window.SfcSimEditorHighlight();
  });

  editor.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      run();
    }
  });

  var t = null;
  editor.addEventListener('input', function () {
    clearTimeout(t);
    t = setTimeout(function () {
      if (window.SfcSimEditorHighlight) window.SfcSimEditorHighlight();
    }, 120);
  });

  renderKB();
  var firstGroup = (window.SfcSim.KNOWLEDGE || [])[0];
  if (firstGroup && firstGroup.items && firstGroup.items[0]) {
    editor.value = firstGroup.items[0].code;
    if (window.SfcSimEditorHighlight) window.SfcSimEditorHighlight();
    run();
  }

})();
