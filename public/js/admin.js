class PrompterAdmin {
    constructor() {
        this.ws = null;
        this.state = {
            text: '',
            speed: 2,
            position: 0,
            isPlaying: false,
            isMirrored: false,
            isInverted: false
        };
        
        this.init();
    }

    init() {
        this.setupWebSocket();
        this.setupEventListeners();
        this.loadSavedText();
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('✅ Connecté au serveur');
            this.updateConnectionStatus(true);
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        };

        this.ws.onclose = () => {
            console.log('❌ Déconnecté du serveur');
            this.updateConnectionStatus(false);
            // Reconnexion automatique
            setTimeout(() => this.setupWebSocket(), 3000);
        };

        this.ws.onerror = (error) => {
            console.error('Erreur WebSocket:', error);
        };
    }

    handleServerMessage(data) {
        if (data.state) {
            this.state = { ...this.state, ...data.state };
            this.updateUI();
        }
    }

    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('connectionStatus');
        const statusText = document.getElementById('connectionText');
        
        if (connected) {
            statusDot.classList.remove('disconnected');
            statusDot.classList.add('connected');
            statusText.textContent = 'Connecté';
        } else {
            statusDot.classList.remove('connected');
            statusDot.classList.add('disconnected');
            statusText.textContent = 'Déconnecté';
        }
    }

    updateUI() {
        // Vitesse
        document.getElementById('speedValue').textContent = `${this.state.speed}x`;
        document.getElementById('speedSlider').value = this.state.speed;
        
        // Checkboxes
        document.getElementById('mirrorToggle').checked = this.state.isMirrored;
        document.getElementById('invertToggle').checked = this.state.isInverted;
        
        // Informations
        document.getElementById('positionInfo').textContent = Math.round(this.state.position);
        document.getElementById('playingInfo').textContent = this.state.isPlaying ? '▶️ Lecture' : '⏸️ Pause';
        
        // Feedback visuel sur les boutons
        const playBtn = document.getElementById('playBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        
        if (this.state.isPlaying) {
            playBtn.style.opacity = '0.5';
            pauseBtn.style.opacity = '1';
        } else {
            playBtn.style.opacity = '1';
            pauseBtn.style.opacity = '0.5';
        }
    }
    

    setupEventListeners() {
        // Bouton ouvrir prompteur
        document.getElementById('openPrompterBtn').addEventListener('click', () => {
            window.open('/prompteur.html', 'prompteur', 'width=1920,height=1080');
        });

        // Import/Export
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.importFile(e.target.files[0]);
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportFile();
        });

        // Mise à jour du texte
        document.getElementById('updateTextBtn').addEventListener('click', () => {
            this.updateText();
        });

        // Contrôles de lecture
        document.getElementById('playBtn').addEventListener('click', () => {
            this.sendControl('play');
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.sendControl('pause');
        });

        document.getElementById('resetBtn').addEventListener('click', () => {
            this.sendControl('reset');
        });

        document.getElementById('forwardBtn').addEventListener('click', () => {
            this.sendControl('forward');
        });

        document.getElementById('backwardBtn').addEventListener('click', () => {
            this.sendControl('backward');
        });

        // Vitesse
        document.getElementById('speedSlider').addEventListener('input', (e) => {
            this.updateSpeed(parseFloat(e.target.value));
        });

        // Options d'affichage
        document.getElementById('mirrorToggle').addEventListener('change', (e) => {
            this.toggleMirror(e.target.checked);
        });

        document.getElementById('invertToggle').addEventListener('change', (e) => {
            this.toggleInvert(e.target.checked);
        });

        // Sauvegarde automatique
        document.getElementById('textEditor').addEventListener('input', () => {
            this.saveText();
        });
    }

    sendMessage(type, data = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...data }));
        }
    }

    updateText() {
        const text = document.getElementById('textEditor').value;
        this.state.text = text;
        this.sendMessage('text-update', { state: { text } });
        this.saveText();
        
        // Feedback visuel
        const btn = document.getElementById('updateTextBtn');
        btn.textContent = '✓ Texte mis à jour !';
        setTimeout(() => {
            btn.textContent = '✓ Mettre à jour le prompteur';
        }, 2000);
    }

    sendControl(action) {
        fetch(`/api/control/${action}`, { method: 'POST' })
            .then(res => res.json())
            .then(data => console.log('Contrôle envoyé:', action))
            .catch(err => console.error('Erreur:', err));
    }

    updateSpeed(speed) {
        this.state.speed = speed;
        document.getElementById('speedValue').textContent = `${speed}x`;
        
        fetch('/api/speed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ speed })
        });
    }

    toggleMirror(enabled) {
        this.state.isMirrored = enabled;
        fetch('/api/mirror', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });
    }

    toggleInvert(enabled) {
        this.state.isInverted = enabled;
        fetch('/api/invert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });
    }

    importFile(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            document.getElementById('textEditor').value = text;
            this.updateText();
        };
        reader.readAsText(file);
    }

    exportFile() {
        const text = document.getElementById('textEditor').value;
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prompteur-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }

    saveText() {
        const text = document.getElementById('textEditor').value;
        localStorage.setItem('prompteur-text', text);
    }

    loadSavedText() {
        const saved = localStorage.getItem('prompteur-text');
        if (saved) {
            document.getElementById('textEditor').value = saved;
        }
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    new PrompterAdmin();
});
