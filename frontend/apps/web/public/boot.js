(function () {
  var d = document.documentElement;
  d.classList.add("js");
  var reduce = false;
  try {
    reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) d.setAttribute("data-reduced", "");
  } catch (e) {}
  // First landing visit this session: show the preloader before first paint (brief Act 0).
  try {
    if (location.pathname === "/" && !reduce) {
      d.setAttribute("data-preload", sessionStorage.getItem("kitty:preloaded") ? "return" : "first");
    }
  } catch (e) {}
})();
