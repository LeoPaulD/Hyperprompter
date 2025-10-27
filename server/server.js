const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// État global du prompteur
let prompteurState = {
  text: '# Bienvenue sur le prompteur\n\nCommencez à écrire votre texte...',
  speed: 2,
  position: 0,
  isPlaying: false,
  isMirrored: false,
  isInverted: false
};

// Diffusion aux clients WebSocket
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// WebSocket
wss.on('connection', (ws) => {
  console.log('Nouveau client connecté');
  
  // Envoyer l'état actuel au nouveau client
  ws.send(JSON.stringify({
    type: 'init',
    state: prompteurState
  }));

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    console.log('Message reçu:', data.type);
    
    // Mettre à jour l'état
    if (data.state) {
      prompteurState = { ...prompteurState, ...data.state };
    }
    
    // Diffuser à tous les clients
    broadcast({
      type: data.type,
      state: prompteurState
    });
  });

  ws.on('close', () => {
    console.log('Client déconnecté');
  });
});

// API REST

// GET - Récupérer l'état
app.get('/api/state', (req, res) => {
  res.json(prompteurState);
});

// POST - Mettre à jour le texte
app.post('/api/text', (req, res) => {
  prompteurState.text = req.body.text;
  broadcast({ type: 'text-update', state: prompteurState });
  res.json({ success: true });
});

// POST - Contrôles de lecture
app.post('/api/control/:action', (req, res) => {
    const { action } = req.params;
    
    switch(action) {
      case 'play':
        prompteurState.isPlaying = true;
        break;
      case 'pause':
       
        prompteurState.isPlaying = false;
        
        // NE PAS modifier la position lors de la pause
        break;
      case 'forward':
        prompteurState.position = Math.max(0, prompteurState.position + 100);
        prompteurState.isPlaying = false; // Pause lors du saut manuel
        break;
      case 'backward':
        prompteurState.position = Math.max(0, prompteurState.position - 100);
        prompteurState.isPlaying = false; // Pause lors du saut manuel
        break;
      case 'reset':
        prompteurState.position = 0;
        prompteurState.isPlaying = false;
        break;
    }
    
    broadcast({ type: 'control', state: prompteurState });
    res.json({ success: true, state: prompteurState });
  });

// POST - Régler la vitesse
app.post('/api/speed', (req, res) => {
  prompteurState.speed = parseFloat(req.body.speed);
  broadcast({ type: 'speed-update', state: prompteurState });
  res.json({ success: true });
});

// POST - Activer/désactiver le miroir
app.post('/api/mirror', (req, res) => {
  prompteurState.isMirrored = req.body.enabled;
  broadcast({ type: 'mirror-update', state: prompteurState });
  res.json({ success: true });
});

// POST - Activer/désactiver l'inversion
app.post('/api/invert', (req, res) => {
  prompteurState.isInverted = req.body.enabled;
  broadcast({ type: 'invert-update', state: prompteurState });
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📝 Interface admin: http://localhost:${PORT}/`);
  console.log(`📺 Prompteur: http://localhost:${PORT}/prompteur.html`);
});
