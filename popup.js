// Chrome扩展程序popup交互逻辑
document.addEventListener('DOMContentLoaded', function() {
  // 获取导出按钮元素
  const exportBtn = document.querySelector('.export-btn');
  
  // 监听导出按钮点击事件
  exportBtn.addEventListener('click', function() {
    // 当前版本仅显示提示信息，无实际导出功能
    alert('导出功能暂未实现，这是一个演示界面。');
  });
  
  // 可以在这里添加其他交互逻辑
  console.log('Chrome扩展程序popup已加载');
});