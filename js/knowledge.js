(function (global) {    
  'use strict';

  var V = global.SfcSim = global.SfcSim || {};
  var data = V.KNOWLEDGE_DATA;
  var FILE = 'js/knowledge.json';

  function warn(msg) {
    if (global.console && console.warn) console.warn('[知识点档案] ' + msg);
  }

  function build(groups) {
    if (!groups || !groups.length) {
      warn(FILE + ' 没有读到数据，或格式不对。第一行应为：'
        + '(window.SfcSim = window.SfcSim || {}).KNOWLEDGE_DATA = [ ... ];');
      return [];
    }
    var out = [];
    for (var gi = 0; gi < groups.length; gi++) {
      var g = groups[gi];
      if (!g || typeof g.title !== 'string') {
        warn('第 ' + (gi + 1) + ' 组缺少 title，已跳过');
        continue;
      }
      var items = [];
      var list = g.items || [];
      for (var ii = 0; ii < list.length; ii++) {
        var it = list[ii];
        if (!it || typeof it.name !== 'string' || typeof it.code !== 'string') {
          warn('组「' + g.title + '」第 ' + (ii + 1) + ' 个案例缺少 name 或 code，已跳过');
          continue;
        }
        items.push({
          name: it.name,
          desc: typeof it.desc === 'string' ? it.desc : '',
          code: it.code
        });
      }
      if (!items.length) warn('组「' + g.title + '」没有任何可用案例');
      out.push({
        title: g.title,
        icon: typeof g.icon === 'string' ? g.icon : '\ud83d\udcd8',   
        items: items
      });
    }
    return out;
  }

  var KNOWLEDGE = build(data);

  var n = 0;
  for (var i = 0; i < KNOWLEDGE.length; i++) n += KNOWLEDGE[i].items.length;
  if (global.console && console.info) {
    console.info('[知识点档案] 加载完成：' + KNOWLEDGE.length + ' 组 / ' + n + ' 例（来自 ' + FILE + '）');
  }

  V.KNOWLEDGE = KNOWLEDGE;
})(typeof window !== 'undefined' ? window : globalThis);
