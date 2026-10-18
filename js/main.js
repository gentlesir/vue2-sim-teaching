(function (global) {    
  'use strict';

  var V = global.SfcSim;

  V.Vue.prototype.paint = function () {
    var vm = this;
    var options = vm.$options;
    var tpl = options.template;
    if (!tpl && vm.tplSrc) tpl = vm.tplSrc;
    if (!tpl) return;
    if (!vm._ast) {
      vm._ast = V.buildAst(tpl);
    }
    var mountEl = vm.hostEl;
    if (!mountEl) return;
    mountEl.innerHTML = '';
    var frag = V.renderAST(vm._ast, vm, null);
    mountEl.appendChild(frag);
    vm.$el = mountEl;
  };

  function createApp(opts) {
    var errorHandler = opts.onError || function () {};
    V._errorHandler = errorHandler;

    function run(source) {
      var sfc = V.splitBlocks(source);
      var templateBlock = null;
      var scriptBlock = null;
      var styleBlocks = [];
      sfc.blocks.forEach(function (b) {
        if (b.type === 'template') { if (!templateBlock) templateBlock = b; }
        else if (b.type === 'script') { if (!scriptBlock) scriptBlock = b; }
        else if (b.type === 'style') styleBlocks.push(b);
      });
      if (!templateBlock) throw new Error('缺少 <template> 块');
      if (!scriptBlock) throw new Error('缺少 <script> 块（需要 export default {...}）');

      var scriptSrc = V.cleanScript(scriptBlock.content);
      var options;
      try {
        options = new Function('__exports__', scriptSrc + ';\nreturn __exports__.default;')({});
      } catch (e) {
        throw new Error('script 解析失败: ' + e.message);
      }
      if (!options || typeof options !== 'object') {
        throw new Error('export default 必须是对象');
      }

      options.template = templateBlock.content;
      var vm = new V.Vue(options, null, null, opts.container);

      injectStyles(styleBlocks, opts.styleTarget || document.head);
      return vm;
    }

    return { run: run };
  }

  function injectStyles(styleBlocks, styleTarget) {
    styleBlocks.forEach(function (b) {
      var el = document.createElement('style');
      el.setAttribute('data-sfc-sim', '1');   
      el.textContent = b.content;
      (styleTarget || document.head).appendChild(el);
    });
  }

  function clearStyles(styleTarget) {
    var target = styleTarget || document.head;
    var els = target.querySelectorAll('style[data-sfc-sim="1"]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].parentNode) els[i].parentNode.removeChild(els[i]);
    }
  }

  V.createApp = createApp;
  V.clearStyles = clearStyles;
})(typeof window !== 'undefined' ? window : globalThis);
