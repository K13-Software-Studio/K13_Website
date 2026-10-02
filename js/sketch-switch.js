/* sketch loader switch: before first paint, so the real page never flashes before its mask */
try{if(!matchMedia("(prefers-reduced-motion: reduce)").matches&&(!sessionStorage.getItem("k13-sk")||/[?&]sketch/.test(location.search))&&!location.hash)document.documentElement.classList.add("sk-on")}catch(e){}
