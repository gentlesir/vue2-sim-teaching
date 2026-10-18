(function () {
  'use strict';

  if (window.SFC_BLOCKED) return;

  var V = window.SfcSim;
  var QUIZ = (V && V.QUIZ) || [];
  var RECORD_KEY = 'sfc_quiz';   

  var preview = document.getElementById('previewScreen');     
  var consoleBody = document.getElementById('consoleBody');   
  var logCount = document.getElementById('logCount');
  var listEl = document.getElementById('quizList');           
  var paperEl = document.getElementById('paper');             
  var paperName = document.getElementById('paperName');
  var paperScore = document.getElementById('paperScore');
  var paperReq = document.getElementById('paperReq');
  var gradeEl = document.getElementById('gradeResult');       
  var totalEl = document.getElementById('totalScore');        
  var btnGrade = document.getElementById('btnGrade');         
  var btnRun = document.getElementById('btnRun');             
  var btnReset = document.getElementById('btnReset');         
  var btnRef = document.getElementById('btnRef');             
  var btnExport = document.getElementById('btnExport');       

  var logN = 0;
  var current = null;          
  var refMode = false;         
  var records = loadRecords(); 

  document.getElementById('quizCount').textContent = QUIZ.length;


  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function norm(s) {
    return String(s == null ? '' : s).replace(/\s+/g, '');
  }

  function blankRe() { return /%%(\d+)%%/g; }

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

  function myAccount() {
    return (window.SFC_USER_KEY && window.SFC_USER_KEY.account) || 'anonymous';
  }

  function loadRecords() {
    var all = {};
    try {
      var raw = window.localStorage.getItem(RECORD_KEY);
      all = raw ? (JSON.parse(raw) || {}) : {};
    } catch (e) {
      all = {};   
    }
    var mine = all[myAccount()];
    return (mine && typeof mine === 'object') ? mine : {};
  }

  function saveRecords() {
    try {
      var raw = window.localStorage.getItem(RECORD_KEY);
      var all = raw ? (JSON.parse(raw) || {}) : {};
      all[myAccount()] = records;
      window.localStorage.setItem(RECORD_KEY, JSON.stringify(all));
    } catch (e) {
      addLog('warn', '成绩无法保存到 localStorage（浏览器限制），本次仅在当前页面有效');
    }
  }

  function renderList() {
    listEl.innerHTML = '';
    var order = [];
    var buckets = {};
    QUIZ.forEach(function (item) {
      if (!buckets[item.group]) { buckets[item.group] = []; order.push(item.group); }
      buckets[item.group].push(item);
    });

    order.forEach(function (groupName) {
      var groupBox = document.createElement('div');
      groupBox.className = 'kb-group';

      var t = document.createElement('div');
      t.className = 'kb-group-title';
      var pts = buckets[groupName].reduce(function (a, it) { return a + it.score; }, 0);
      t.innerHTML = '<span class="arrow">&#9660;</span>' + esc(groupName) +
        '<span class="gcnt">' + buckets[groupName].length + ' 题 / ' + pts + ' 分</span>';
      t.addEventListener('click', function () { groupBox.classList.toggle('collapsed'); });

      var wrap = document.createElement('div');
      wrap.className = 'kb-items';

      buckets[groupName].forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'kb-item';
        row.setAttribute('data-id', item.id);
        var nm = document.createElement('span');
        nm.className = 'nm';
        nm.innerHTML = esc(item.name) + '<span class="d">' + esc(item.desc) + ' · ' + item.blanks.length + ' 空</span>';
        row.appendChild(nm);
        var sc = document.createElement('span');
        sc.className = 'sc';
        row.appendChild(sc);
        row.addEventListener('click', function () { select(item.id); });
        wrap.appendChild(row);
      });

      groupBox.appendChild(t);
      groupBox.appendChild(wrap);
      listEl.appendChild(groupBox);
    });
    paintScores();
  }

  function paintScores() {
    var rows = listEl.querySelectorAll('.kb-item');
    for (var i = 0; i < rows.length; i++) {
      var id = rows[i].getAttribute('data-id');
      var item = byId(id);
      var rec = records[id];
      var sc = rows[i].querySelector('.sc');
      sc.classList.remove('full', 'part', 'zero');
      if (!item) continue;
      if (!rec) {
        sc.textContent = '未做';
      } else {
        sc.textContent = rec.score + ' 分';
        sc.classList.add(rec.score >= item.score ? 'full' : (rec.score > 0 ? 'part' : 'zero'));
      }
      rows[i].classList.toggle('active', !!current && current.id === id);
    }

    var full = 0;
    var sum = 0;
    var done = 0;
    QUIZ.forEach(function (it) {
      full += it.score;
      var r = records[it.id];
      if (r) { done++; sum += Math.min(r.score, it.score); }
    });
    totalEl.innerHTML = done
      ? '总分 <b>' + sum + '</b> / ' + full + ' · 已完成 ' + done + '/' + QUIZ.length +
        ' · 平均 ' + (sum / done).toFixed(1)
      : '总分 — / ' + full + ' · 已完成 0/' + QUIZ.length;
  }

  function byId(id) {
    for (var i = 0; i < QUIZ.length; i++) if (QUIZ[i].id === id) return QUIZ[i];
    return null;
  }

  function renderPaper(item, answers) {
    var lines = item.code.split('\n');
    var html = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var cls = '';
      if (line.indexOf('✎') >= 0) cls = 'cmt';
      else if (/^\s*(<\/?(template|script|style)>|export default \{)\s*$/.test(line)) cls = 'blk';
      var out = '';
      if (cls) out += '<span class="' + cls + '">';
      out += esc(line).replace(blankRe(), function (m, n) {
        return inputHtml(item, n, answers);
      });
      if (cls) out += '</span>';
      html.push('<span class="ln">' + (i + 1) + '</span>' + out);
    }
    paperEl.innerHTML = html.join('\n');
    bindBlanks(item);
  }

  function inputHtml(item, n, answers) {
    var blank = null;
    for (var i = 0; i < item.blanks.length; i++) if (String(item.blanks[i].i) === String(n)) blank = item.blanks[i];
    if (!blank) return esc('%%' + n + '%%');   

    var val = answers ? blank.answers[0]
      : (item._draft && item._draft[n] != null ? item._draft[n] : '');
    var w = Math.min(30, Math.max(6, String(answers ? blank.answers[0] : (val || blank.answers[0])).length + 2));
    return '<input class="blank' + (answers ? ' ref' : '') + '" data-n="' + n + '"' +
      ' data-line="' + lineOf(item, n) + '"' +
      ' style="width:' + w + 'ch"' +
      ' spellcheck="false" autocomplete="off"' +
      ' title="空' + n + '：' + esc(blank.tip) + '"' +
      ' value="' + esc(val) + '">';
  }

  function lineOf(item, n) {
    var lines = item.code.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('%%' + n + '%%') >= 0) return i + 1;
    }
    return 0;
  }

  function inputs() {
    return paperEl.querySelectorAll('.blank');
  }

  function bindBlanks(item) {
    var list = inputs();
    for (var i = 0; i < list.length; i++) {
      (function (el) {
        el.addEventListener('input', function () {
          item._draft = item._draft || {};
          item._draft[el.getAttribute('data-n')] = el.value;
          el.classList.remove('good', 'bad');   
        });
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            var next = null;
            var all = inputs();
            for (var j = 0; j < all.length; j++) {
              if (all[j] === el) { next = all[j + 1]; break; }
            }
            if (next) next.focus(); else btnGrade.focus();
          }
        });
      })(list[i]);
    }
  }

  function select(id) {
    var item = byId(id);
    if (!item) return;
    current = item;
    item._draft = item._draft || {};
    refMode = false;
    btnRef.textContent = '显示参考答案';
    paperName.textContent = item.group + ' · ' + item.name;
    var rec = records[item.id];
    paperScore.textContent = (rec
      ? '本次得分 ' + rec.score + ' / ' + item.score + '（历史最好）'
      : '本题满分 ' + item.score + ' 分 · ' + item.blanks.length + ' 个空');
    paperReq.innerHTML = '<span class="tag">题目要求</span>' + esc(item.require);
    gradeEl.innerHTML = '';
    renderPaper(item, null);
    resetPreview();
    paintScores();
    addLog('info', '已选择《' + item.name + '》，补全 ' + item.blanks.length + ' 个空位后点「判分并运行」');
    var first = paperEl.querySelector('.blank');
    if (first) first.focus();   
  }

  function resetPreview() {
    preview.innerHTML = '';
    if (V && V.clearStyles) V.clearStyles(document.head);
  }

  function assemble(item) {
    var vals = {};
    var list = inputs();
    for (var i = 0; i < list.length; i++) vals[list[i].getAttribute('data-n')] = list[i].value;
    return item.code
      .split('\n')
      .filter(function (l) { return l.indexOf('✎') < 0; })
      .join('\n')
      .replace(blankRe(), function (m, n) { return vals[n] != null ? vals[n] : ''; });
  }

  function runCode(source) {
    resetPreview();
    try {
      var factory = V.createApp({
        container: preview,
        styleTarget: document.head,
        onError: function (e) { addLog('error', e.message); }
      });
      factory.run(source);
      return true;
    } catch (e) {
      addLog('error', '代码无法运行：' + e.message);   
      return false;
    }
  }

  function grade(item) {
    var result = [];
    var correct = 0;
    var list = inputs();
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      var n = el.getAttribute('data-n');
      var blank = null;
      for (var j = 0; j < item.blanks.length; j++) if (String(item.blanks[j].i) === String(n)) blank = item.blanks[j];

      var ok = false;
      var typed = el.value;
      if (blank) {
        for (var k = 0; k < blank.answers.length; k++) {
          if (norm(typed) === norm(blank.answers[k])) { ok = true; break; }
        }
      }

      el.classList.remove('good', 'bad', 'ref');
      if (refMode) el.classList.add('ref');
      else el.classList.add(ok ? 'good' : 'bad');

      if (ok) correct++;
      result.push({ n: n, ok: ok, blank: blank, line: el.getAttribute('data-line'), typed: typed });
    }

    var raw = item.score * correct / item.blanks.length;
    var score = Math.round(raw * 10) / 10;
    if (refMode) score = 0;   

    gradeEl.innerHTML = gradeHtml(item, result, correct, score);
    paperScore.textContent = refMode
      ? '已看参考答案 · 本题按 0 分记（点「重做本题」重新作答）'
      : '本次得分 ' + score + ' / ' + item.score + ' · 答对 ' + correct + '/' + item.blanks.length + ' 空';

    if (!refMode) {
      var old = records[item.id];
      if (!old || score > old.score) {
        records[item.id] = { score: score, correct: correct, total: item.blanks.length, at: Date.now() };
        saveRecords();
        addLog('info', '《' + item.name + '》得分 ' + score + ' / ' + item.score + '（答对 ' + correct + '/' + item.blanks.length + ' 空），已记录');
      } else {
        addLog('info', '《' + item.name + '》本次 ' + score + ' 分，历史最好 ' + old.score + ' 分，成绩保留最好一次');
      }
    } else {
      addLog('warn', '参考答案模式下不计分，点「重做本题」后可正常判分');
    }
    paintScores();
    return score;
  }

  function gradeHtml(item, result, correct, score) {
    var rows = [];
    rows.push('<div class="row sum">' +
      (correct === item.blanks.length
        ? '<span class="ok">' + item.name + '：全对，得 ' + score + ' / ' + item.score + ' 分</span>'
        : '<span class="no">' + item.name + '：答对 ' + correct + '/' + item.blanks.length + ' 空，得 ' + score + ' / ' + item.score + ' 分</span>') +
      '</div>');
    result.forEach(function (r) {
      if (r.ok) {
        rows.push('<div class="row"><span class="ok">&#10003; 空' + r.n + '</span><span>（第 ' + r.line + ' 行）正确</span></div>');
      } else {
        rows.push('<div class="row"><span class="no">&#10007; 空' + r.n + '</span>' +
          '<span>第 ' + r.line + ' 行' + (norm(r.typed) ? '，你填的是 ' + esc(r.typed) : '，还没填') +
          ' —— 要求：' + esc(r.blank ? r.blank.tip : '') + '</span></div>');
      }
    });
    return rows.join('');
  }

  btnGrade.addEventListener('click', function () {
    if (!current) { addLog('warn', '先在左侧选择知识点'); return; }
    var item = current;
    grade(item);
    var ok = runCode(assemble(item));
    if (ok) addLog('info', '运行成功，右侧为补全后代码的实际渲染效果');
  });

  btnRun.addEventListener('click', function () {
    if (!current) { addLog('warn', '先在左侧选择知识点'); return; }
    var ok = runCode(assemble(current));
    if (ok) addLog('info', '运行成功（本按钮不判分、不记录成绩）');
  });

  btnReset.addEventListener('click', function () {
    if (!current) return;
    current._draft = {};   
    refMode = false;
    btnRef.textContent = '显示参考答案';
    gradeEl.innerHTML = '';
    renderPaper(current, null);
    resetPreview();
    paperScore.textContent = '本题满分 ' + current.score + ' 分 · ' + current.blanks.length + ' 个空';
    addLog('info', '《' + current.name + '》已清空，重新作答');
    var first = paperEl.querySelector('.blank');
    if (first) first.focus();
  });

  btnRef.addEventListener('click', function () {
    if (!current) return;
    if (!refMode) {
      refMode = true;
      btnRef.textContent = '收回参考答案';
      renderPaper(current, true);
      gradeEl.innerHTML = '';
      paperScore.textContent = '正在显示参考答案（' + current.blanks.length + ' 个空已填好），本次不计分';
      addLog('warn', '参考答案已填入空位；点「判分并运行」可看到它能正常跑起来，但成绩按 0 分记');
    } else {
      refMode = false;
      btnRef.textContent = '显示参考答案';
      current._draft = {};
      renderPaper(current, null);
      resetPreview();
      paperScore.textContent = '本题满分 ' + current.score + ' 分 · ' + current.blanks.length + ' 个空';
      addLog('info', '参考答案已收回，可重新作答');
    }
  });

  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      btnGrade.click();
    }
  });

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t]/.test(s)) s = "'" + s;
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function csvRow(arr) { return arr.map(csvCell).join(','); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function fmtFull(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function fmtFileName(d) {
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes());
  }
  function safeName(s) { return String(s || '').replace(/[\\/:*?"<>|,\s]/g, '_'); }

  function buildCsv(user, quiz, recs, now) {
    var L = [];
    var sumScore = 0;
    var sumFull = 0;
    var sumOk = 0;
    var sumBlank = 0;
    var done = 0;
    quiz.forEach(function (it) { sumFull += it.score; sumBlank += it.blanks.length; });

    L.push(csvRow(['前端组件语法教学与智能测试系统 · 成绩表']));
    L.push(csvRow(['姓名', user && user.name, '账号', user && user.account, '手机号', user && user.phone]));
    L.push(csvRow(['导出时间', fmtFull(now), '题目数', quiz.length, '空位总数', sumBlank, '满分合计', sumFull]));
    L.push('');
    L.push(csvRow(['序号', '分组', '知识点', '说明', '满分', '得分', '答对空数', '空位总数', '状态', '最近判分时间']));

    quiz.forEach(function (it, i) {
      var r = recs[it.id];
      var score = r ? r.score : 0;
      var okN = r ? r.correct : 0;
      var status = !r ? '未作答' : (r.correct >= it.blanks.length ? '全对' : '部分正确');
      if (r) { done++; sumScore += score; sumOk += okN; }
      L.push(csvRow([
        i + 1, it.group, it.name, it.desc, it.score, score, okN, it.blanks.length, status,
        r && r.at ? fmtFull(new Date(r.at)) : ''
      ]));
    });

    L.push(csvRow(['', '', '合计', '', sumFull, sumScore, sumOk, sumBlank,
      '已完成 ' + done + '/' + quiz.length, '']));
    L.push(csvRow(['说明', '每题按空均分计分，成绩保留该账号历次判分的最好一次；参考答案模式不计分', '', '', '', '', '', '', '', '']));
    return L.join('\r\n') + '\r\n';   
  }

  function exportCsv() {
    if (!QUIZ.length) { addLog('warn', '题库为空，无法导出'); return; }
    var user = window.SFC_USER_KEY || {};
    var now = new Date();
    var csv = buildCsv(user, QUIZ, records, now);
    var text = '\ufeff' + csv;   
    var fname = '前端组件语法教学与智能测试系统成绩-' + safeName(user.name) + '-' + safeName(user.account) +
      '-' + fmtFileName(now) + '.csv';
    var doneN = QUIZ.filter(function (it) { return !!records[it.id]; }).length;
    try {
      var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fname;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
      addLog('info', '已导出成绩：' + fname + '（已判分 ' + doneN + '/' + QUIZ.length + ' 题）');
    } catch (e) {
      addLog('warn', '当前浏览器不允许直接下载，改为新窗口打开 CSV 文本');
      try {
        var win = window.open('data:text/csv;charset=utf-8,' + encodeURIComponent(text));
        if (!win) {
          console.log(text);
          addLog('error', '新窗口被拦截，已在控制台输出 CSV 全文，可手动复制');
        }
      } catch (e2) {
        console.log(text);
        addLog('error', '导出失败，已在控制台输出 CSV 全文');
      }
    }
  }

  if (btnExport) btnExport.addEventListener('click', exportCsv);

  (function () {
    var box = document.getElementById('userInfo');
    var btnLogout = document.getElementById('btnLogout');
    var u = window.SFC_USER_KEY;

    if (btnLogout) {
      btnLogout.addEventListener('click', function () {
        if (!window.confirm('确定退出 ' + (u ? u.name : '当前账号') + ' 的登录吗？')) return;
        try { window.localStorage.removeItem('sfc_user'); } catch (e) { }
        window.location.replace('login.html');   
      });
    }
    if (!box || !u) return;

    function item(label, value) {
      return '<i>' + label + '</i><i class="v">' + esc(value) + '</i>';
    }
    box.innerHTML = '<i class="at">&#9679;</i>' +
      item('账号', u.account) + item('姓名', u.name) + item('手机号', u.phone);
    box.title = '登录时间：' + (u.loginTimeText || '');
    if (btnLogout) btnLogout.title = '当前登录：' + u.name + '（' + u.account + '）';
  })();

  renderList();
  if (QUIZ.length) select(QUIZ[0].id);   

  if (V) {
    V.QUIZ_ENGINE = {
      norm: norm,
      assemble: assemble,
      lineOf: lineOf,
      buildCsv: buildCsv,
      check: function (item, values) {
        var ok = 0;
        item.blanks.forEach(function (b) {
          var v = values[b.i] != null ? values[b.i] : '';
          for (var k = 0; k < b.answers.length; k++) if (norm(v) === norm(b.answers[k])) { ok++; return; }
        });
        return { correct: ok, total: item.blanks.length };
      }
    };
  }
})();
