(()=>{
"use strict";
if(!document.querySelector('script[data-iv-nav-order="1"]')){
  const s=document.createElement("script");
  s.src="inovtec-navigation-order.js?v=20260815-2";
  s.dataset.ivNavOrder="1";
  s.async=false;
  document.head.appendChild(s);
}
const mode=(new URLSearchParams(location.search).get("mode")||"").toLowerCase();
if(mode==="conges"&&!document.querySelector('script[data-iv-conges-full-list="1"]')){
  const s=document.createElement("script");
  s.src="inovtec-conges-full-list.js?v=20260825-1";
  s.dataset.ivCongesFullList="1";
  s.async=false;
  document.head.appendChild(s);
}
})();
