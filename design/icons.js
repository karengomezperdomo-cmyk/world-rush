/* Icon sprite injected into every mock (works from file:// too). Stroke icons on a 24px grid, square caps. */
(function () {
  var s =
    '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>' +
    '<symbol id="home" viewBox="0 0 24 24"><path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z"/></symbol>' +
    '<symbol id="trophy" viewBox="0 0 24 24"><path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4M12 14v4M8 21h8M10 18h4"/></symbol>' +
    '<symbol id="help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 9.5A3 3 0 0 1 15 10c0 2-3 2-3 4M12 17.5v.5"/></symbol>' +
    '<symbol id="gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></symbol>' +
    '<symbol id="user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2"/></symbol>' +
    '<symbol id="gamepad" viewBox="0 0 24 24"><path d="M6 8h12a4 4 0 0 1 4 4v3a3 3 0 0 1-5 2l-2-2H9l-2 2a3 3 0 0 1-5-2v-3a4 4 0 0 1 4-4zM8 10.5v3M6.5 12h3M16 11.5v.5M18 13v.5"/></symbol>' +
    '<symbol id="clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>' +
    '<symbol id="bars" viewBox="0 0 24 24"><path d="M5 20V11M12 20V4M19 20v-6"/></symbol>' +
    '<symbol id="lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></symbol>' +
    '<symbol id="play" viewBox="0 0 24 24"><path d="M6 3v18l15-9z" fill="currentColor" stroke="none"/></symbol>' +
    '<symbol id="pause" viewBox="0 0 24 24"><path d="M7 4v16M17 4v16" stroke-width="4"/></symbol>' +
    '<symbol id="volume" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12"/></symbol>' +
    '<symbol id="volume-off" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"/></symbol>' +
    '<symbol id="chevron" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></symbol>' +
    '<symbol id="check" viewBox="0 0 24 24"><path d="m4 12 5 5L20 6"/></symbol>' +
    '<symbol id="flag" viewBox="0 0 24 24"><path d="M5 22V3M5 4h13l-3 4 3 4H5"/></symbol>' +
    '<symbol id="calendar" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16"/><path d="M3 10h18M8 3v4M16 3v4"/></symbol>' +
    '<symbol id="refresh" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/></symbol>' +
    '<symbol id="share" viewBox="0 0 24 24"><path d="M12 3v12M7 8l5-5 5 5M5 14v7h14v-7"/></symbol>' +
    '<symbol id="wifi-off" viewBox="0 0 24 24"><path d="M2 8.8a15 15 0 0 1 4-2.4M22 8.8a15 15 0 0 0-9-3.7M5 12.5a10 10 0 0 1 3-1.9M19 12.5a10 10 0 0 0-5.2-2.3M8.5 16a5 5 0 0 1 4-1.7M12 20h.01M3 3l18 18"/></symbol>' +
    '<symbol id="alert" viewBox="0 0 24 24"><path d="M12 3 2 21h20zM12 10v5M12 18v.5"/></symbol>' +
    '<symbol id="lean-back" viewBox="0 0 24 24"><path d="M5 12a7 7 0 1 1 2 5M5 12l-2-3M5 12l3-1.5"/></symbol>' +
    '<symbol id="lean-fwd" viewBox="0 0 24 24"><path d="M19 12a7 7 0 1 0-2 5M19 12l2-3M19 12l-3-1.5"/></symbol>' +
    '<symbol id="brake" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none"/></symbol>' +
    '<symbol id="gas" viewBox="0 0 24 24"><path d="m6 5 7 7-7 7M13 5l7 7-7 7"/></symbol>' +
    '<symbol id="ring" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/></symbol>' +
    '<symbol id="crown" viewBox="0 0 24 24"><path d="M3 8l5 4 4-7 4 7 5-4-2 11H5z" fill="currentColor" stroke="none"/></symbol>' +
    '<symbol id="signal" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4"/><rect x="5" y="5" width="3" height="7"/><rect x="10" y="2.5" width="3" height="9.5"/><rect x="15" y="0" width="3" height="12"/></symbol>' +
    '<symbol id="wifi" viewBox="0 0 17 12"><path d="M8.5 2.3a10 10 0 0 1 7 2.8l1-1.2A11.6 11.6 0 0 0 8.5.6 11.6 11.6 0 0 0 .5 3.9l1 1.2a10 10 0 0 1 7-2.8zm0 3.6a6.2 6.2 0 0 1 4.3 1.7l1-1.2a7.8 7.8 0 0 0-10.6 0l1 1.2A6.2 6.2 0 0 1 8.5 5.9zM8.5 9.4a2.4 2.4 0 0 1 1.6.6L8.5 12 6.9 10a2.4 2.4 0 0 1 1.6-.6z"/></symbol>' +
    '<symbol id="battery" viewBox="0 0 27 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".5"/><rect x="2" y="2" width="19" height="8" rx="2"/><path d="M24 4v4c.9-.3 1.5-1.1 1.5-2S24.900 4.300 24 4z" opacity=".5"/></symbol>' +
    '</defs></svg>';
  document.body.insertAdjacentHTML('afterbegin', s);
})();
