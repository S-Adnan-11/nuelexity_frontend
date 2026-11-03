// Apply appearance before CSS/React paint. Reading a preference never creates one.
(function () {
  var choice;
  try { choice = localStorage.getItem('nuelexity:theme'); } catch (_) {}
  var theme = choice === 'light' || choice === 'dark' ? choice :
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#F4F5EF' : '#111916';
})();
