// Applies the saved theme before first paint to avoid a light/dark flash.
try {
  var t = localStorage.getItem("itai.theme");
  if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
} catch (e) {}
