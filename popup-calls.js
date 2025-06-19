if (!window.location.pathname.includes('login') && !window.location.pathname.includes('register')) {
  const pseudo = localStorage.getItem('pseudo');
  if (!pseudo) return;

  const socket = new WebSocket(location.protocol === 'https:' ? 'wss://' + location.hostname : 'ws://' + location.hostname + ':3000');

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "register", username: pseudo }));
  });

  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'incoming_call') {
      showCallPopup(data.from);
    }
  });

  function showCallPopup(from) {
    if (document.getElementById('call-popup')) return;

    const popup = document.createElement('div');
    popup.id = 'call-popup';
    popup.style.position = 'fixed';
    popup.style.bottom = '20px';
    popup.style.right = '20px';
    popup.style.background = '#222';
    popup.style.color = 'white';
    popup.style.padding = '20px';
    popup.style.borderRadius = '10px';
    popup.style.boxShadow = '0 0 10px black';
    popup.style.zIndex = 9999;
    popup.innerHTML = `
      <p>📞 Appel entrant de <strong>${from}</strong></p>
      <button id="accept-call">✅ Accepter</button>
      <button id="decline-call">❌ Refuser</button>
    `;

    document.body.appendChild(popup);

    document.getElementById('accept-call').onclick = () => {
      localStorage.setItem('contactAppel', from);
      socket.send(JSON.stringify({
        type: 'call_accepted',
        from: pseudo,
        to: from
      }));
      popup.remove();
      window.location.href = 'call.html';
    };

    document.getElementById('decline-call').onclick = () => {
      socket.send(JSON.stringify({
        type: 'call_cancel',
        from: pseudo,
        to: from
      }));
      popup.remove();
    };
  }
}
