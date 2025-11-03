class Prompteur {
    constructor() {
        this.ws = null;
        this.state = {
            text: '',
            speed: 2,
            position: 0,
            isPlaying: false,
            isMirrored: false,
            isInverted: false,
            webcamEnabled: false, // 📹 Ajout
            mode: 'prompter', // prompter or youtube
            youtubeSpeed: 2,
            youtubeFontSize: 22
        };
        this.animationFrame = null;
        this.lastUpdateTime = 0;
        this.youtubeScrollInterval = null;
        this.wrapper = document.getElementById('prompteur-wrapper');
        this.container = document.getElementById('prompteur-container');
        this.content = document.getElementById('prompteur-content');
        this.webcamVideo = document.getElementById('webcam'); // 📹 Ajout
        this.webcamStream = null; // 📹 Ajout

        this.init();
    }

    init() {
        this.setupWebSocket();
        this.setupKeyboardControls();
        this.setupFullscreenListener();
    }

    // ========== FULLSCREEN ==========

    setupFullscreenListener() {
        window.addEventListener('message', (event) => {
            if (event.data.action === 'requestFullscreen') {
                this.enterFullscreen();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'F11' || (e.key === 'f' && e.ctrlKey)) {
                e.preventDefault();
                this.toggleFullscreen();
            }
            if (e.key === 'Escape' && document.fullscreenElement) {
                this.exitFullscreen();
            }
        });
    }

    enterFullscreen() {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().catch(err => {
                console.error('Erreur plein écran:', err);
            });
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
    }

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.enterFullscreen();
        } else {
            this.exitFullscreen();
        }
    }

    // ========== WEBSOCKET ==========

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('✅ Prompteur connecté');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleServerMessage(data);
        };

        this.ws.onclose = () => {
            console.log('❌ Prompteur déconnecté - Reconnexion...');
            setTimeout(() => this.setupWebSocket(), 3000);
        };

        this.ws.onerror = (error) => {
            console.error('Erreur WebSocket:', error);
        };
    }

    handleServerMessage(data) {
        if (data.state) {
            const prevState = { ...this.state };
            Object.assign(this.state, data.state);
            
            // Texte
            if (prevState.text !== this.state.text) {
                this.updateContent();
            }
            
            // Position (seulement si pas en lecture)
            if (prevState.position !== this.state.position && !this.state.isPlaying) {
                this.updatePosition();
            }
            
            // Play/Pause
            if (prevState.isPlaying !== this.state.isPlaying) {
                if (this.state.isPlaying) {
                    this.startScrolling();
                } else {
                    this.stopScrolling();
                }
            }
            
            // Miroir
            if (prevState.isMirrored !== this.state.isMirrored) {
                console.log('🪞 Mode miroir:', this.state.isMirrored);
                document.body.classList.toggle('mirrored', this.state.isMirrored);
            }
            
            // Inversion
            if (prevState.isInverted !== this.state.isInverted) {
                console.log('🔄 Mode inversé:', this.state.isInverted);
                document.body.classList.toggle('inverted', this.state.isInverted);
            }

            // 📹 Webcam
            if (prevState.webcamEnabled !== this.state.webcamEnabled) {
                console.log('📹 Webcam:', this.state.webcamEnabled);
                this.toggleWebcam(this.state.webcamEnabled);
            }
        }

        if (data.type === 'mode-toggle') {
            this.toggleMode();
        }

        if (data.type === 'youtube-message') {
            this.displayYouTubeMessage(data.message);
        }

        if (data.type === 'youtube-speed-update' || data.type === 'youtube-font-size-update') {
            this.updateYouTubeStyles();
        }
    }

    updateYouTubeStyles() {
        const commentsContainer = document.getElementById('youtube-comments-container');
        commentsContainer.style.fontSize = `${this.state.youtubeFontSize}px`;
        // Speed will be handled by adjusting the scroll interval
        this.stopYouTubeScrolling();
        this.startYouTubeScrolling();
    }

    displayYouTubeMessage(message) {
        const commentsContainer = document.getElementById('youtube-comments-content');
        const isScrolledToBottom = commentsContainer.scrollHeight - commentsContainer.clientHeight <= commentsContainer.scrollTop + 1;

        const messageElement = document.createElement('div');
        messageElement.classList.add('youtube-comment');
        messageElement.innerHTML = `
            <span class="author">${message.author}</span>:
            <span class="message">${message.message}</span>
        `;
        commentsContainer.appendChild(messageElement);

        if (isScrolledToBottom) {
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        const commentsContainer = document.getElementById('youtube-comments-container');
        commentsContainer.scrollTop = commentsContainer.scrollHeight;
    }

    toggleMode() {
        this.state.mode = this.state.mode === 'prompter' ? 'youtube' : 'prompter';
        const prompterWrapper = document.getElementById('prompteur-wrapper');
        const youtubeWrapper = document.getElementById('youtube-comments-wrapper');

        if (this.state.mode === 'prompter') {
            prompterWrapper.style.display = 'block';
            youtubeWrapper.style.display = 'none';
            this.stopYouTubeScrolling();
        } else {
            prompterWrapper.style.display = 'none';
            youtubeWrapper.style.display = 'block';
            this.startYouTubeScrolling();
        }
    }

    startYouTubeScrolling() {
        if (this.youtubeScrollInterval) clearInterval(this.youtubeScrollInterval);
        const scrollAmount = this.state.youtubeSpeed / 2;
        this.youtubeScrollInterval = setInterval(() => {
            const commentsContainer = document.getElementById('youtube-comments-container');
            commentsContainer.scrollTop += scrollAmount;
        }, 50);
    }

    stopYouTubeScrolling() {
        if (this.youtubeScrollInterval) {
            clearInterval(this.youtubeScrollInterval);
            this.youtubeScrollInterval = null;
        }
    }

    // ========== WEBCAM 📹 ==========

    async toggleWebcam(enabled) {
        if (enabled) {
            await this.startWebcam();
        } else {
            this.stopWebcam();
        }
    }

    async startWebcam() {
        try {
            console.log('📹 Démarrage webcam...');
            
            // Demander l'accès à la webcam
            this.webcamStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });

            // Attacher le stream à la vidéo
            this.webcamVideo.srcObject = this.webcamStream;
            
            // Attendre que la vidéo soit prête
            await this.webcamVideo.play();
            
            // Afficher avec transition
            this.webcamVideo.classList.add('active');
            
            console.log('✅ Webcam activée');
        } catch (error) {
            console.error('❌ Erreur webcam:', error);
            
            // Afficher un message à l'utilisateur
            if (error.name === 'NotAllowedError') {
                alert('⚠️ Permission webcam refusée.\n\nAutorise l\'accès dans les paramètres de ton navigateur.');
            } else if (error.name === 'NotFoundError') {
                alert('⚠️ Aucune webcam trouvée.');
            } else {
                alert('⚠️ Erreur lors de l\'activation de la webcam.');
            }
        }
    }

    stopWebcam() {
        console.log('📹 Arrêt webcam...');
        
        // Masquer avec transition
        this.webcamVideo.classList.remove('active');
        
        // Arrêter le stream
        if (this.webcamStream) {
            this.webcamStream.getTracks().forEach(track => track.stop());
            this.webcamStream = null;
        }
        
        // Vider la source
        this.webcamVideo.srcObject = null;
        
        console.log('✅ Webcam désactivée');
    }

    // ========== CONTENT ==========

    updateContent() {
        const html = MarkdownParser.parse(this.state.text);
        this.content.innerHTML = html;
    }

    updatePosition() {
        this.state.position = Math.max(0, this.state.position);
        this.content.style.transform = `translateY(-${this.state.position}px)`;
    }

    startScrolling() {
        this.stopScrolling();
        this.lastUpdateTime = performance.now();
        
        const scroll = (currentTime) => {
            if (!this.state.isPlaying) return;
            
            const deltaTime = currentTime - this.lastUpdateTime;
            this.lastUpdateTime = currentTime;
            
            this.state.position += (this.state.speed * deltaTime) / 16.67;
            
            const maxScroll = this.content.scrollHeight - window.innerHeight + (window.innerHeight * 0.4);
            
            if (this.state.position >= maxScroll) {
                this.state.position = maxScroll;
                this.stopScrolling();
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({ 
                        type: 'control',
                        state: { isPlaying: false, position: this.state.position }
                    }));
                }
            }
            
            this.updatePosition();
            
            if (this.state.isPlaying) {
                this.animationFrame = requestAnimationFrame(scroll);
            }
        };
        
        this.animationFrame = requestAnimationFrame(scroll);
    }

    stopScrolling() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case ' ':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.state.position = Math.max(0, this.state.position - 50);
                    this.updatePosition();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.state.position += 50;
                    this.updatePosition();
                    break;
                case 'Home':
                case 'r':
                case 'R':
                    e.preventDefault();
                    this.state.position = 0;
                    this.updatePosition();
                    break;
                case '+':
                case '=':
                    e.preventDefault();
                    this.state.speed = Math.min(10, this.state.speed + 0.5);
                    console.log('Vitesse:', this.state.speed);
                    break;
                case '-':
                case '_':
                    e.preventDefault();
                    this.state.speed = Math.max(0.5, this.state.speed - 0.5);
                    console.log('Vitesse:', this.state.speed);
                    break;
                case 'm':
                case 'M':
                    e.preventDefault();
                    this.state.isMirrored = !this.state.isMirrored;
                    document.body.classList.toggle('mirrored', this.state.isMirrored);
                    console.log('🪞 Miroir togglé:', this.state.isMirrored);
                    break;
                case 'i':
                case 'I':
                    e.preventDefault();
                    this.state.isInverted = !this.state.isInverted;
                    document.body.classList.toggle('inverted', this.state.isInverted);
                    console.log('🔄 Inversion togglée:', this.state.isInverted);
                    break;
                case 'w':
                case 'W':
                    e.preventDefault();
                    this.state.webcamEnabled = !this.state.webcamEnabled;
                    this.toggleWebcam(this.state.webcamEnabled);
                    console.log('📹 Webcam togglée:', this.state.webcamEnabled);
                    break;
            }
        });
    }

    togglePlay() {
        this.state.isPlaying = !this.state.isPlaying;
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ 
                type: 'control',
                state: { isPlaying: this.state.isPlaying }
            }));
        }
        
        if (this.state.isPlaying) {
            this.startScrolling();
        } else {
            this.stopScrolling();
        }
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    new Prompteur();
});
