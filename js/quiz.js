(function (global) {
  'use strict';

  var V = global.SfcSim = global.SfcSim || {};
  var data = V.QUIZ_DATA;
  var FILE = 'js/quiz.json';
  var TOKEN = /%%(\d+)%%/g;   

  function warn(msg) {
    if (global.console && console.warn) console.warn('[测试题库] ' + msg);
  }

  function tokensIn(code) {
    var set = {};
    var m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(code))) set[m[1]] = 1;
    return Object.keys(set);
  }

  function build(list) {
    if (!list || !list.length) {
      warn(FILE + ' 没有读到数据，或格式不对。第一行应为：'
        + '(window.SfcSim = window.SfcSim || {}).QUIZ_DATA = [ ... ];');
      return [];
    }
    var out = [];
    var seen = {};
    for (var qi = 0; qi < list.length; qi++) {
      var q = list[qi];
      if (!q || typeof q.id !== 'string' || typeof q.name !== 'string' || typeof q.code !== 'string') {
        warn('第 ' + (qi + 1) + ' 题缺少 id / name / code，已跳过');
        continue;
      }
      if (seen[q.id]) {
        warn('题目 id「' + q.id + '」重复，后出现的已跳过');
        continue;
      }
      seen[q.id] = 1;

      var blanks = [];
      var bl = q.blanks || [];
      for (var bi = 0; bi < bl.length; bi++) {
        var b = bl[bi];
        if (!b || typeof b.i !== 'number' || !b.answers || !b.answers.length) {
          warn('题「' + q.name + '」第 ' + (bi + 1) + ' 个空缺少 i 或 answers，已跳过');
          continue;
        }
        blanks.push({
          i: b.i,
          answers: b.answers.map(String),
          tip: typeof b.tip === 'string' ? b.tip : ''
        });
      }
      if (!blanks.length) {
        warn('题「' + q.name + '」没有任何可用空位，已跳过');
        continue;
      }

      var tk = tokensIn(q.code);
      if (tk.length !== blanks.length) {
        warn('题「' + q.name + '」题面有 ' + tk.length + ' 个 %%n%% 标记，blanks 却有 '
          + blanks.length + ' 个，请检查数据');
      }

      out.push({
        id: q.id,
        group: typeof q.group === 'string' ? q.group : '未分组',
        name: q.name,
        desc: typeof q.desc === 'string' ? q.desc : '',
        score: (typeof q.score === 'number' && q.score > 0) ? q.score : 10,   
        require: typeof q.require === 'string' ? q.require : '',
        code: q.code,
        blanks: blanks
      });
    }
    return out;
  }

  var QUIZ = build(data);

  var n = 0;
  for (var i = 0; i < QUIZ.length; i++) n += QUIZ[i].blanks.length;
  if (global.console && console.info) {
    console.info('[测试题库] 加载完成：' + QUIZ.length + ' 题 / ' + n + ' 空（来自 ' + FILE + '）');
  }

  V.QUIZ = QUIZ;
})(typeof window !== 'undefined' ? window : globalThis);
