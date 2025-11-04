const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const cors = require('cors');
require('dotenv').config(); 
const mammouthService = require('./mammouth'); // 🆕


const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));
// 🆕 Servir node_modules depuis le dossier server
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));


function calculateSlideCount(text) {
  if (!text || text.trim() === '') return 1;
  const count = (text.match(/---/g) || []).length + 1;
  console.log(`📊 Calcul slides: ${count} détectés`);
  return count;
}

// État global du prompteur
let prompteurState = {
  text: '# Bienvenue sur le prompteur\n\nCommencez à écrire votre texte...',
  speed: 2,
  position: 0,
  isPlaying: false,
  isMirrored: false,
  isInverted: false,
  webcamEnabled: false,
  webcamOpacity: 0.3,
  webcamBlur: 3,
  // 🆕 Ajouts pour Reveal.js
  presentationMode: false,  // Mode présentation activé/désactivé
  currentSlide: 0,          // Index du slide actuel
  totalSlides: 1            // Nombre total de slides
};

// ========== API REST - MAMMOUTH AI ==========

// GET - Liste des commandes disponibles
app.get('/api/mammouth/commands', (req, res) => {
  const commands = mammouthService.getAvailableCommands();
  res.json({ 
    success: true, 
    commands,
    configured: mammouthService.isConfigured()
  });
});

// POST - Exécuter une commande
app.post('/api/mammouth/execute', async (req, res) => {
  try {
    const { command, text, customPrompt } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Le texte est requis' 
      });
    }

    let result;

    // Exécuter la commande appropriée
    switch(command) {
      case 'ameliorer_texte':
        result = await mammouthService.ameliorerTexte(text);
        break;
      case 'resumer':
        result = await mammouthService.resumer(text);
        break;
      case 'generer_plan':
        result = await mammouthService.genererPlan(text);
        break;
      case 'corriger_orthographe':
        result = await mammouthService.corrigerOrthographe(text);
        break;
      case 'transformer_presentation':
        result = await mammouthService.transformerPresentation(text);
        break;
      case 'developper':
        result = await mammouthService.developper(text);
        break;
      case 'simplifier':
        result = await mammouthService.simplifier(text);
        break;
      case 'custom':
        if (!customPrompt) {
          return res.status(400).json({ 
            success: false, 
            error: 'Le prompt personnalisé est requis' 
          });
        }
        result = await mammouthService.custom(text, customPrompt);
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          error: `Commande inconnue: ${command}` 
        });
    }

    res.json(result);

  } catch (error) {
    console.error('❌ Erreur Mammouth:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET - Statut de l'API
app.get('/api/mammouth/status', (req, res) => {
  res.json({
    configured: mammouthService.isConfigured(),
    model: process.env.MAMMOUTH_MODEL || 'gpt-4.1'
  });
});

prompteurState.totalSlides = calculateSlideCount(prompteurState.text);
console.log(`✅ État initial: ${prompteurState.totalSlides} slide(s)`);

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
// POST - Mettre à jour le texte
app.post('/api/text', (req, res) => {
  prompteurState.text = req.body.text;

  // 🔧 Calculer le nombre de slides avec la fonction
  prompteurState.totalSlides = calculateSlideCount(prompteurState.text);

  console.log(`📝 Texte mis à jour (${prompteurState.totalSlides} slides détectés)`);

  broadcast({ type: 'text-update', state: prompteurState });
  res.json({ 
    success: true, 
    totalSlides: prompteurState.totalSlides 
  });
});


// ========== API REST - TEXTE ==========

// POST - Mettre à jour le texte
app.post('/api/text', (req, res) => {
  prompteurState.text = req.body.text;
  
  // 🆕 Calculer le nombre de slides (séparés par ---)
  const slideCount = (prompteurState.text.match(/---/g) || []).length + 1;
  prompteurState.totalSlides = slideCount;
  
  console.log(`📝 Texte mis à jour (${slideCount} slides détectés)`);
  
  broadcast({ type: 'text-update', state: prompteurState });
  res.json({ success: true, totalSlides: slideCount });
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

// ========== API REST - MODE PRÉSENTATION 🎯 ==========

// POST - Toggle mode présentation
app.post('/api/presentation/toggle', (req, res) => {
  prompteurState.presentationMode = !prompteurState.presentationMode;

  if (prompteurState.presentationMode) {
    // 🔧 Recalculer les slides à chaque activation
    prompteurState.totalSlides = calculateSlideCount(prompteurState.text);
    prompteurState.isPlaying = false;
    prompteurState.currentSlide = 0;
    
    console.log(`🎨 Mode PRÉSENTATION activé (${prompteurState.totalSlides} slides)`);
  } else {
    console.log('📜 Mode PROMPTEUR activé');
  }

  broadcast({ 
    type: 'presentation-toggle', 
    state: prompteurState 
  });

  res.json({ 
    success: true, 
    presentationMode: prompteurState.presentationMode,
    currentSlide: prompteurState.currentSlide,
    totalSlides: prompteurState.totalSlides
  });
});


// POST - Slide suivant
app.post('/api/presentation/next', (req, res) => {
  if (!prompteurState.presentationMode) {
    return res.status(400).json({ 
      success: false, 
      error: 'Mode présentation non activé' 
    });
  }

  // Ne pas dépasser le dernier slide
  if (prompteurState.currentSlide < prompteurState.totalSlides - 1) {
    prompteurState.currentSlide++;
    console.log(`➡️ Slide ${prompteurState.currentSlide + 1} / ${prompteurState.totalSlides}`);
  } else {
    console.log('⚠️ Déjà au dernier slide');
  }
  
  broadcast({ 
    type: 'slide-change', 
    direction: 'next',
    state: prompteurState
  });
  
  res.json({ 
    success: true, 
    currentSlide: prompteurState.currentSlide,
    totalSlides: prompteurState.totalSlides
  });
});

// POST - Slide précédent
app.post('/api/presentation/prev', (req, res) => {
  if (!prompteurState.presentationMode) {
    return res.status(400).json({ 
      success: false, 
      error: 'Mode présentation non activé' 
    });
  }

  if (prompteurState.currentSlide > 0) {
    prompteurState.currentSlide--;
    console.log(`⬅️ Slide ${prompteurState.currentSlide + 1} / ${prompteurState.totalSlides}`);
  } else {
    console.log('⚠️ Déjà au premier slide');
  }
  
  broadcast({ 
    type: 'slide-change', 
    direction: 'prev',
    state: prompteurState
  });
  
  res.json({ 
    success: true, 
    currentSlide: prompteurState.currentSlide,
    totalSlides: prompteurState.totalSlides
  });
});

// POST - Aller à un slide spécifique
app.post('/api/presentation/goto', (req, res) => {
  if (!prompteurState.presentationMode) {
    return res.status(400).json({ 
      success: false, 
      error: 'Mode présentation non activé' 
    });
  }

  const slideIndex = parseInt(req.body.slideIndex);

  if (isNaN(slideIndex) || slideIndex < 0 || slideIndex >= prompteurState.totalSlides) {
    return res.status(400).json({ 
      success: false, 
      error: `Le numéro de slide doit être entre 0 et ${prompteurState.totalSlides - 1}` 
    });
  }

  prompteurState.currentSlide = slideIndex;
  console.log(`🎯 Aller au slide ${slideIndex + 1}`);
  
  broadcast({ 
    type: 'slide-change', 
    direction: 'goto',
    state: prompteurState
  });
  
  res.json({ 
    success: true, 
    currentSlide: prompteurState.currentSlide 
  });
});

// GET - État du mode présentation
app.get('/api/presentation/state', (req, res) => {
  res.json({
    presentationMode: prompteurState.presentationMode,
    currentSlide: prompteurState.currentSlide,
    totalSlides: prompteurState.totalSlides
  });
});

// ========== DÉMARRAGE SERVEUR ==========

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📝 Interface admin: http://localhost:${PORT}/`);
  console.log(`📺 Prompteur: http://localhost:${PORT}/prompteur.html`);
  console.log(`🎨 Mode présentation: ${prompteurState.presentationMode ? 'ON' : 'OFF'}`);
});
