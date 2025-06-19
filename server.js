const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const usersPath = './users.json';
const messagesPath = './messages.json';

function readJSON(file) {
  try {
    if (!fs.existsSync(file)) fs.writeFileSync(file, '{}');
    const content = fs.readFileSync(file, 'utf-8');
    return JSON.parse(content || '{}');
  } catch (err) {
    console.error(`Erreur lecture JSON ${file} :`, err);
    return {};
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getChatKey(user1, user2) {
  return [user1, user2].sort().join('__');
}

// --- AUTH ---

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(usersPath);
  if (users[username] && users[username].password === password) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON(usersPath);
  if (users[username]) {
    return res.json({ success: false, message: 'Nom déjà pris' });
  }
  users[username] = { password, contacts: [] };
  writeJSON(usersPath, users);
  res.json({ success: true });
});

// --- CONTACTS ---

app.post('/check-user', (req, res) => {
  const { username } = req.body;
  const users = readJSON(usersPath);
  res.json({ exists: !!users[username] });
});

app.post('/add-contact', (req, res) => {
  const { me, contact } = req.body;
  const users = readJSON(usersPath);
  if (!users[me] || !users[contact]) return res.json({ success: false });
  if (!users[me].contacts.includes(contact)) users[me].contacts.push(contact);
  if (!users[contact].contacts.includes(me)) users[contact].contacts.push(me);
  writeJSON(usersPath, users);
  res.json({ success: true });
});

app.post('/get-contacts', (req, res) => {
  const { username } = req.body;
  const users = readJSON(usersPath);
  if (users[username]) res.json({ contacts: users[username].contacts });
  else res.json({ contacts: [] });
});

// --- MESSAGES ---

app.post('/send-message', (req, res) => {
  const { from, to, message } = req.body;
  const messages = readJSON(messagesPath);
  const key = getChatKey(from, to);
  if (!messages[key]) messages[key] = [];
  messages[key].push({ from, message, date: new Date().toISOString() });
  writeJSON(messagesPath, messages);
  res.json({ success: true });
});

app.post('/get-messages', (req, res) => {
  const { user1, user2 } = req.body;
  const messages = readJSON(messagesPath);
  const key = getChatKey(user1, user2);
  res.json({ messages: messages[key] || [] });
});

// --- SALON VOCAL WEBRTC via WebSocket ---

const rooms = {}; // roomId => array of WebSocket clients

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }

    if (data.type === 'join_room') {
      currentRoom = data.roomId;
      if (!rooms[currentRoom]) rooms[currentRoom] = [];
      rooms[currentRoom].push(ws);

      // Notifie les autres membres du salon
      rooms[currentRoom].forEach(client => {
        if (client !== ws) client.send(JSON.stringify({ type: 'peer_joined' }));
      });
    }

    if (data.type === 'signal') {
      if (!currentRoom) return;
      rooms[currentRoom].forEach(client => {
        if (client !== ws) client.send(JSON.stringify({ type: 'signal', signal: data.signal }));
      });
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom] = rooms[currentRoom].filter(c => c !== ws);
      rooms[currentRoom].forEach(client => client.send(JSON.stringify({ type: 'peer_left' })));
    }
  });
});

// ROUTE PAR DÉFAUT : login.html

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// LANCEMENT SERVEUR

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});
