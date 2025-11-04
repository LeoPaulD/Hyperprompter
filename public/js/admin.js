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

// ==================== GESTION IA ====================
class AIManager {
    constructor(textareaId, apiBaseUrl = '/api/mammouth') {
        this.textarea = document.getElementById(textareaId);
        this.apiBaseUrl = apiBaseUrl;
        this.commands = [];
        
        if (!this.textarea) {
            console.error('❌ Textarea introuvable:', textareaId);
            return;
        }
        
        this.loadCommands();
    }

    // Obtenir la sélection ou tout le texte
    getSelectedText() {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        return this.textarea.value.substring(start, end);
    }

    // Remplacer la sélection
    replaceSelection(newText) {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const before = this.textarea.value.substring(0, start);
        const after = this.textarea.value.substring(end);
        
        this.textarea.value = before + newText + after;
        
        // Repositionner le curseur
        const newPosition = start + newText.length;
        this.textarea.setSelectionRange(newPosition, newPosition);
        this.textarea.focus();
    }

    // Obtenir tout le texte
    getValue() {
        return this.textarea.value;
    }

    // Définir tout le texte
    setValue(text) {
        this.textarea.value = text;
    }

    async loadCommands() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/commands`);
            const data = await response.json();
            
            if (data.commands) {
                this.commands = data.commands;
                this.renderCommands();
                console.log('✅ Commandes IA chargées:', this.commands.length);
            }
        } catch (error) {
            console.error('❌ Erreur chargement commandes:', error);
            this.showStatus('❌ Erreur', 'error');
        }
    }

    renderCommands() {
        const menuContent = document.getElementById('aiMenuContent');
        if (!menuContent) return;

        menuContent.innerHTML = this.commands.map(cmd => `
            <button class="ai-command" 
                    data-command="${cmd.id}" 
                    title="${cmd.description || ''}">
                ${cmd.icon || '✨'} ${cmd.name}
            </button>
        `).join('');

        this.showStatus('✅ Prêt', 'ready');
    }

    showStatus(text, type = 'info') {
        const statusEl = document.getElementById('aiStatus');
        if (statusEl) {
            statusEl.textContent = text;
            statusEl.className = `ai-status ${type}`;
        }
    }

    showLoader(text = 'Traitement...') {
        const loader = document.getElementById('aiLoader');
        const loaderText = document.getElementById('aiLoaderText');
        
        if (loader) loader.style.display = 'flex';
        if (loaderText) loaderText.textContent = text;
        this.showStatus('⏳ En cours...', 'loading');
    }

    hideLoader() {
        const loader = document.getElementById('aiLoader');
        if (loader) loader.style.display = 'none';
        this.showStatus('✅ Prêt', 'ready');
    }

    async executeCommand(commandId, customPrompt = null) {
        const selectedText = this.getSelectedText();
        const fullText = this.getValue();
        const textToProcess = selectedText || fullText;

        if (!textToProcess.trim()) {
            alert('⚠️ Veuillez entrer ou sélectionner du texte');
            return;
        }

        const command = this.commands.find(cmd => cmd.id === commandId);
        if (!command && !customPrompt) {
            throw new Error(`Commande inconnue: ${commandId}`);
        }

        try {
            this.showLoader(command ? command.name : 'Traitement personnalisé...');

            const response = await fetch(`${this.apiBaseUrl}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: commandId,
                    text: textToProcess,
                    customPrompt: customPrompt
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur API');
            }

            const result = data.content || data.result;
            
            if (!result) {
                throw new Error('L\'API n\'a pas retourné de résultat');
            }

            // Remplacer le texte
            if (selectedText) {
                this.replaceSelection(result);
            } else {
                this.setValue(result);
            }

            this.showNotification('✅ Commande exécutée avec succès');
            console.log('✅ Commande exécutée:', commandId);

        } catch (error) {
            console.error('❌ Erreur exécution commande:', error);
            this.showNotification(`❌ ${error.message}`, 'error');
            this.showStatus('❌ Erreur', 'error');
        } finally {
            this.hideLoader();
        }
    }

    showNotification(message, type = 'success') {
        const notif = document.getElementById('notification');
        if (notif) {
            notif.textContent = message;
            notif.className = `notification ${type} show`;
            setTimeout(() => notif.classList.remove('show'), 3000);
        } else {
            alert(message);
        }
    }
}

// ==================== INITIALISATION ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initialisation de l\'admin...');
    new PrompterAdmin();
    // 1. Initialiser l'AI Manager (textarea simple)
    window.aiManager = new AIManager('textEditor');
    console.log('✅ AI Manager initialisé');

    // 2. Toggle menu IA
    const aiBtn = document.getElementById('aiBtn');
    const aiMenu = document.getElementById('aiMenu');

    if (aiBtn && aiMenu) {
        aiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = aiMenu.style.display !== 'none';
            aiMenu.style.display = isVisible ? 'none' : 'block';
            console.log('🖱️ Menu IA:', isVisible ? 'fermé' : 'ouvert');
        });

        // Fermer si clic ailleurs
        document.addEventListener('click', (e) => {
            if (!aiMenu.contains(e.target) && e.target !== aiBtn) {
                aiMenu.style.display = 'none';
            }
        });

        console.log('✅ Event listeners IA configurés');
    }

    // 3. Event delegation pour les commandes IA
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('ai-command')) {
            const command = e.target.dataset.command;
            
            if (command === 'custom') {
                const customPrompt = document.getElementById('customPrompt')?.value;
                if (!customPrompt) {
                    alert('⚠️ Veuillez entrer une instruction');
                    return;
                }
                await window.aiManager.executeCommand('custom', customPrompt);
            } else {
                await window.aiManager.executeCommand(command);
            }
        }
    });

    // 4. Bouton Enregistrer
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveText);
    }

    // 5. Raccourcis clavier
    const textarea = document.getElementById('textEditor');
    if (textarea) {
        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveText();
            }
        });
    }

    // 6. Charger le texte initial
    loadInitialText();
});

// Fonction pour sauvegarder
async function saveText() {
    const textarea = document.getElementById('textEditor');
    const saveStatus = document.getElementById('saveStatus');
    
    try {
        saveStatus.textContent = '💾 Enregistrement...';
        saveStatus.className = 'save-status';
        
        const response = await fetch('/api/text', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: textarea.value })
        });

        const data = await response.json();
        
        if (data.success) {
            saveStatus.textContent = '✅ Enregistré';
            saveStatus.className = 'save-status success';
            setTimeout(() => saveStatus.textContent = '', 2000);
        }
    } catch (error) {
        console.error('Erreur sauvegarde:', error);
        saveStatus.textContent = '❌ Erreur';
        saveStatus.className = 'save-status error';
    }
}

// Fonction pour charger le texte
async function loadInitialText() {
    const textarea = document.getElementById('textEditor');
    try {
        const response = await fetch('/api/state');
        const state = await response.json();
        if (state.text) {
            textarea.value = state.text;
        }
    } catch (error) {
        console.error('Erreur chargement texte:', error);
    }
}
