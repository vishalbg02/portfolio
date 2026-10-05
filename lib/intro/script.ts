/**
 * The opening sequence's one inline script (docs/INTRO.md). It runs in <head>, before the first paint, and decides
 * whether the intro plays. It sets `html[data-intro]` to:
 *
 *  - "play"  → the home page, first visit this session, motion allowed, a decent connection, no hash or ?nointro/?tour;
 *  - "skip"  → anything else (inner pages, a second visit, reduced motion, Save-Data or 2G, a deep link);
 *  - "done"  → the visitor clicked, tapped, pressed a key, scrolled or used the wheel while it played (fades at once);
 *  - "ended" → it finished by itself.
 *
 * The overlay only exists under "play" (opt-in, so a script error or JS turned off can never show it), and CSS removes
 * it by itself at 1.8 s whatever happens. The face and the dissolve are pure CSS; nothing here waits for React.
 *
 * Plain ES5 in a string, run as-is by tests/unit/intro-script.test.ts (in a VM with a fake window), so the tested logic
 * is exactly the shipped logic. Keep it small: it is part of every page's HTML.
 */
export const INTRO_KEY = "intro:v1";
/** Set by "Replay intro" (palette, terminal): the next home page plays it again, marked as a replay. */
export const REPLAY_KEY = "intro:replay";
export const INTRO_MS = 1800;

export const INTRO_SCRIPT = `(function(){var d=document.documentElement,s="skip",w=window;try{var l=location,q=l.search,c=navigator.connection||{},seen=0,again=0;try{seen=sessionStorage.getItem("${INTRO_KEY}");again=sessionStorage.getItem("${REPLAY_KEY}");sessionStorage.removeItem("${REPLAY_KEY}")}catch(e){}if(l.pathname==="/"&&!l.hash&&!/[?&](nointro|tour)(=|&|$)/.test(q)&&!w.matchMedia("(prefers-reduced-motion: reduce)").matches&&(again||!c.saveData&&!/2g$/.test(c.effectiveType||"")&&!seen)){s="play";if(again)d.setAttribute("data-intro-replay","");try{sessionStorage.setItem("${INTRO_KEY}","1")}catch(e){}if(/[?&]c=/.test(q))d.setAttribute("data-intro-quiet","")}}catch(e){s="skip"}d.setAttribute("data-intro",s);if(s!=="play")return;var t0=Date.now(),ev=["pointerdown","keydown","wheel","touchmove","scroll"],off=function(){for(var i=0;i<ev.length;i++)w.removeEventListener(ev[i],skip,true)},skip=function(){if(d.getAttribute("data-intro")!=="play")return;w.__introSkippedAt=Date.now()-t0;d.setAttribute("data-intro","done");off()};for(var i=0;i<ev.length;i++)w.addEventListener(ev[i],skip,{capture:true,passive:true});w.setTimeout(function(){if(d.getAttribute("data-intro")==="play")d.setAttribute("data-intro","ended");off()},${INTRO_MS})})();`;
