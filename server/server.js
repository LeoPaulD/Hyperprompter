const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { google } = require('googleapis');
const { URL } = require('url');
const session = require('express-session');
const cookieParser = require('cookie-parser');

// IMPORTANT: Replace with your actual credentials
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback';

const app = express();
app.use(cookieParser());
app.use(session({
  secret: 'your_secret_key', // Replace with a real secret key
  resave: false,
  saveUninitialized: true,
}));
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
  webcamBlur: 3,              // 📹 Ajout (3px de flou)
  mode: 'prompter',
  youtubeUrl: '',
  youtubeSpeed: 2,
  youtubeFontSize: 22
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

    if (data.type === 'mode-toggle') {
      prompteurState.mode = prompteurState.mode === 'prompter' ? 'youtube' : 'prompter';
      broadcast({ type: 'mode-toggle', state: prompteurState });
    }
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
  const speed = parseFloat(req.body.speed);

  if (isNaN(speed) || speed < 0.5 || speed > 10) {
    return res.status(400).json({
      success: false,
      error: 'La vitesse doit être un nombre entre 0.5 et 10'
    });
  }

  prompteurState.speed = speed;
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

// ========== API REST - GOOGLE AUTH ==========

// Step 1: Redirect to Google's OAuth 2.0 server
app.get('/api/auth/google', (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly'
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  res.redirect(url);
});

// Step 2: Handle the OAuth 2.0 server response
app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
  try {
    const { tokens } = await oauth2Client.getToken(code);
    req.session.tokens = tokens;
    res.redirect('/');
  } catch (error) {
    console.error('Error authenticating with Google:', error);
    res.status(500).send('Authentication failed');
  }
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  if (req.session.tokens) {
    res.json({ connected: true });
  } else {
    res.json({ connected: false });
  }
});

// Sign out
app.post('/api/auth/signout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

function getAuthenticatedClient(req) {
  if (!req.session.tokens) return null;
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
  oauth2Client.setCredentials(req.session.tokens);
  return oauth2Client;
}

// ========== YOUTUBE API ==========

let liveChatId = null;
let nextPageToken = null;
let pollingInterval = null;

const youtube = google.youtube('v3');

async function getLiveChatId(auth, videoId) {
  try {
    const response = await youtube.videos.list({
      auth: auth,
      part: 'liveStreamingDetails',
      id: videoId,
    });

    const video = response.data.items[0];
    if (video && video.liveStreamingDetails) {
      return video.liveStreamingDetails.activeLiveChatId;
    }
  } catch (error) {
    console.error('Error fetching live chat ID:', error);
  }
  return null;
}

async function fetchChatMessages(auth) {
  if (!liveChatId) return;

  try {
    const response = await youtube.liveChatMessages.list({
      auth: auth,
      liveChatId: liveChatId,
      part: 'snippet,authorDetails',
      pageToken: nextPageToken,
    });

    const { items, nextPageToken: newNextPageToken, pollingIntervalMillis } = response.data;
    items.forEach(item => {
      broadcast({
        type: 'youtube-message',
        message: {
          author: item.authorDetails.displayName,
          message: item.snippet.displayMessage,
        },
      });
    });

    nextPageToken = newNextPageToken;

    // Adjust polling interval
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(fetchChatMessages, pollingIntervalMillis);

  } catch (error) {
    console.error('Error fetching chat messages:', error);
  }
}

app.post('/api/youtube/start', async (req, res) => {
  const { videoUrl } = req.body;
  const auth = getAuthenticatedClient(req);
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  prompteurState.youtubeUrl = videoUrl;
  const videoId = new URL(videoUrl).searchParams.get('v');
  if (!videoId) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  liveChatId = await getLiveChatId(auth, videoId);
  if (liveChatId) {
    nextPageToken = null;
    if (pollingInterval) clearInterval(pollingInterval);
    const fetchAndPoll = () => fetchChatMessages(auth);
    fetchAndPoll();
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Live chat not found' });
  }
});

app.post('/api/youtube/stop', (req, res) => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  liveChatId = null;
  nextPageToken = null;
  res.json({ success: true });
});

// ========== DÉMARRAGE SERVEUR ==========

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📝 Interface admin: http://localhost:${PORT}/`);
  console.log(`📺 Prompteur: http://localhost:${PORT}/prompteur.html`);
});
