/* net.js — multiplayer layer for t-rex-runner (bypass observer)
 * Reads the local Runner instance's score & running state, syncs them to a
 * WebSocket relay, and renders a 2-4 player progress HUD. No game code edits. */
(function () {
  var WS_URL_DEFAULT = 'wss://trex-multiplayer.onrender.com'; // default public relay
  var wsUrlInput = document.getElementById('mp-ws');
  var roomInput = document.getElementById('mp-room-input');
  var joinBtn = document.getElementById('mp-join');
  var createBtn = document.getElementById('mp-create');
  var leaveBtn = document.getElementById('mp-leave');
  var inviteEl = document.getElementById('mp-invite');
  var inviteLinkEl = document.getElementById('mp-invite-link');
  var copyBtn = document.getElementById('mp-copy');
  var countEl = document.getElementById('mp-count');
  var playersEl = document.getElementById('mp-players');
  var statusEl = document.getElementById('mp-status');
  var liveDot = document.getElementById('mp-live-dot');

  var me = null;       // my player id (random)
  var ws = null;
  var room = null;
  var players = {};    // id -> {name, score, alive, last}
  var lastSent = 0;

  // v2 storage key: clears the stale 'mp-ws-url' that may hold the old
  // 'wss://YOUR-SERVER' default from the first release
  try {
    localStorage.removeItem('mp-ws-url');
    var saved = localStorage.getItem('mp-ws-url-v2');
    if (saved) wsUrlInput.value = saved;
  } catch (e) {}
  // default: public relay baked in; override via ?server=wss://... or saved pref
  if (!wsUrlInput.value) {
    var q = new URLSearchParams(location.search).get('server');
    wsUrlInput.value = q || WS_URL_DEFAULT;
  }

  function id() {
    if (me) return me;
    me = 'p' + Math.random().toString(36).slice(2, 8);
    return me;
  }

  function send(obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  function myName() {
    var n = null;
    try { n = localStorage.getItem('mp-name'); } catch (e) {}
    if (!n) {
      n = 'P-' + Math.random().toString(36).slice(2, 5).toUpperCase();
      try { localStorage.setItem('mp-name', n); } catch (e) {}
    }
    return n;
  }

  function connect() {
    var url = wsUrlInput.value.trim();
    if (!url) return;
    try { localStorage.setItem('mp-ws-url-v2', url); } catch (e) {}
    room = roomInput.value.trim().toUpperCase() || 'LOBBY';
    statusEl.textContent = 'Connecting ' + url + ' …';
    try { ws = new WebSocket(url); } catch (e) { statusEl.textContent = 'Bad URL'; return; }

    ws.onopen = function () {
      send({ t: 'join', room: room, id: id(), name: myName() });
      statusEl.textContent = 'Room ' + room + ' — connected';
      if (liveDot) liveDot.className = 'mp-dot';
      // invite link: current server + room, so friends land pre-filled
      var base = location.href.split('?')[0];
      var srv = encodeURIComponent(wsUrlInput.value.trim());
      inviteLinkEl.href = base + '?room=' + encodeURIComponent(room) + '&server=' + srv;
      inviteLinkEl.textContent = inviteLinkEl.href;
      inviteEl.style.display = 'block';
    };
    ws.onclose = function () {
      statusEl.textContent = 'Disconnected';
      if (liveDot) liveDot.className = 'mp-dot off';
      ws = null;
    };
    ws.onerror = function () { statusEl.textContent = 'Connection error'; };
    ws.onmessage = function (ev) {
      var m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'state') {
        players = m.players || {};
        render();
      }
    };
  }

  joinBtn.onclick = function () {
    if (ws) { try { ws.close(); } catch (e) {} ws = null; }
    connect();
  };
  createBtn.onclick = function () {
    // random 4-char code, then join it
    var code = '';
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (var i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    roomInput.value = code;
    joinBtn.onclick();
  };
  copyBtn.onclick = function () {
    var url = inviteLinkEl.href;
    if (navigator.clipboard) navigator.clipboard.writeText(url);
    else {
      var ta = document.createElement('textarea'); ta.value = url;
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    }
    copyBtn.textContent = 'Copied!';
    setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1500);
  };
  leaveBtn.onclick = function () {
    if (ws) { try { ws.close(); } catch (e) {} ws = null; }
    players = {}; render(); statusEl.textContent = 'Not connected';
    inviteEl.style.display = 'none';
  };
  // pre-fill room & auto-join from URL (?room=CODE&server=wss://...)
  (function () {
    var q = new URLSearchParams(location.search);
    var r = q.get('room');
    if (r) roomInput.value = r.toUpperCase().slice(0, 8);
    if (r) joinBtn.onclick();
  })();
  roomInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') joinBtn.onclick();
  });

  // heartbeat + game state (bypass, no game-code edits)
  // Sends every 500ms regardless of game state so the server never prunes
  // a connected-but-idle player (waiting in lobby, not started yet, crashed).
  setInterval(function () {
    if (!ws || ws.readyState !== 1) return;
    var now = Date.now();
    if (now - lastSent < 400) return;
    var score = 0, alive = true;
    try {
      var r = window.Runner && Runner.instance_;
      if (r) {
        if (r.distanceMeter) {
          var raw = r.distanceMeter.getActualDistance(Math.ceil(r.distanceRan));
          score = typeof raw === 'number' ? raw : 0;
        }
        if (r.crashed) alive = false;
      }
    } catch (e) {}
    lastSent = now;
    send({ t: 'update', room: room, id: id(), score: score, alive: alive });
  }, 500);

  // prune stale players (10s)
  setInterval(function () {
    var now = Date.now(); var dirty = false;
    Object.keys(players).forEach(function (pid) {
      if (players[pid] && now - (players[pid].last || 0) > 10000) {
        delete players[pid]; dirty = true;
      }
    });
    if (dirty) render();
  }, 5000);

  function render() {
    var ids = Object.keys(players).sort(function (a, b) {
      return (players[b].score || 0) - (players[a].score || 0);
    });
    countEl.textContent = ids.length + '/4' + (ids.length >= 4 ? ' (full)' : '');
    var html = '';
    var maxScore = 1;
    ids.forEach(function (pid) {
      var s = players[pid].score || 0;
      if (s > maxScore) maxScore = s;
    });
    ids.slice(0, 4).forEach(function (pid) {
      var p = players[pid];
      var pct = Math.min(100, Math.round((p.score || 0) / maxScore * 100));
      html += '<div class="mp-row' + (p.alive ? '' : ' dead') + '">'
        + '<span class="mp-tag">' + escapeHtml(p.name || pid) + (pid === me ? ' <span class="me">you</span>' : '') + '</span>'
        + '<div class="mp-bar-wrap"><div class="mp-bar" style="width:' + pct + '%"></div></div>'
        + '<span class="mp-score">' + (p.score || 0) + '</span>'
        + '</div>';
    });
    playersEl.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();
