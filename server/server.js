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
  isInverted: false,
  webcamEnabled: false,      // 📹 Ajout
  webcamOpacity: 0.3,        // 📹 Ajout (30% visible)
  webcamBlur: 3              // 📹 Ajout (3px de flou)
};

// Diffusion aux clients WebSocket
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// ========== WEBSOCKET ==========

wss.on('connection', (ws) => {
  console.log('✅ Nouveau client connecté');

  // Envoyer l'état actuel au nouveau client
  ws.send(JSON.stringify({
    type: 'init',
    state: prompteurState
  }));

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    console.log('📨 Message reçu:', data.type);

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
    console.log('❌ Client déconnecté');
  });
});

// ========== API REST - ÉTAT ==========

// GET - Récupérer l'état
app.get('/api/state', (req, res) => {
  res.json(prompteurState);
});

// ========== API REST - TEXTE ==========

// POST - Mettre à jour le texte
app.post('/api/text', (req, res) => {
  prompteurState.text = req.body.text;
  broadcast({ type: 'text-update', state: prompteurState });
  res.json({ success: true });
});

// ========== API REST - CONTRÔLES ==========

// POST - Contrôles de lecture
app.post('/api/control/:action', (req, res) => {
  const { action } = req.params;

  switch(action) {
    case 'play':
      prompteurState.isPlaying = true;
      break;
    case 'pause':
      prompteurState.isPlaying = false;
      break;
    case 'forward':
      prompteurState.position = Math.max(0, prompteurState.position + 100);
      prompteurState.isPlaying = false;
      break;
    case 'backward':
      prompteurState.position = Math.max(0, prompteurState.position - 100);
      prompteurState.isPlaying = false;
      break;
    case 'reset':
      prompteurState.position = 0;
      prompteurState.isPlaying = false;
      break;
  }

  broadcast({ type: 'control', state: prompteurState });
  res.json({ success: true, state: prompteurState });
});

// ========== API REST - VITESSE ==========

// POST - Régler la vitesse
app.post('/api/speed', (req, res) => {
  prompteurState.speed = parseFloat(req.body.speed);
  broadcast({ type: 'speed-update', state: prompteurState });
  res.json({ success: true });
});

// ========== API REST - MIROIR/INVERSION ==========

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

// ========== API REST - WEBCAM 📹 ==========

// POST - Activer/désactiver la webcam
app.post('/api/webcam', (req, res) => {
  console.log('📹 Requête webcam reçue:', req.body);
  
  if (typeof req.body.enabled !== 'boolean') {
    return res.status(400).json({ 
      success: false, 
      error: 'Le paramètre "enabled" doit être true ou false' 
    });
  }
  
  prompteurState.webcamEnabled = req.body.enabled;
  broadcast({ type: 'webcam-update', state: prompteurState });
  
  console.log('✅ Webcam changée:', prompteurState.webcamEnabled);
  
  res.json({ 
    success: true,
    webcamEnabled: prompteurState.webcamEnabled 
  });
});

// POST - Toggle webcam (plus pratique pour Companion)
app.post('/api/webcam/toggle', (req, res) => {
  prompteurState.webcamEnabled = !prompteurState.webcamEnabled;
  broadcast({ type: 'webcam-update', state: prompteurState });
  
  console.log('✅ Webcam toggled:', prompteurState.webcamEnabled);
  
  res.json({ 
    success: true, 
    webcamEnabled: prompteurState.webcamEnabled 
  });
});

// POST - Régler l'opacité de la webcam
app.post('/api/webcam/opacity', (req, res) => {
  const opacity = parseFloat(req.body.opacity);
  
  if (isNaN(opacity) || opacity < 0 || opacity > 1) {
    return res.status(400).json({ 
      success: false, 
      error: 'L\'opacité doit être entre 0 et 1' 
    });
  }
  
  prompteurState.webcamOpacity = opacity;
  broadcast({ type: 'webcam-opacity-update', state: prompteurState });
  
  res.json({ 
    success: true, 
    opacity: prompteurState.webcamOpacity 
  });
});

// POST - Régler le flou de la webcam
app.post('/api/webcam/blur', (req, res) => {
  const blur = parseInt(req.body.blur);
  
  if (isNaN(blur) || blur < 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Le flou doit être un nombre positif' 
    });
  }
  
  prompteurState.webcamBlur = blur;
  broadcast({ type: 'webcam-blur-update', state: prompteurState });
  
  res.json({ 
    success: true, 
    blur: prompteurState.webcamBlur 
  });
});

// ========== DÉMARRAGE SERVEUR ==========

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📝 Interface admin: http://localhost:${PORT}/`);
  console.log(`📺 Prompteur: http://localhost:${PORT}/prompteur.html`);
});
