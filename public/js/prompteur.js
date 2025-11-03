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
            webcamEnabled: false,
            presentationMode: false,  // 🎨 Mode présentation
            currentSlide: 0,
            totalSlides: 0
        };
        this.animationFrame = null;
        this.lastUpdateTime = 0;
        
        // DOM Elements - Prompteur
        this.wrapper = document.getElementById('prompteur-wrapper');
        this.container = document.getElementById('prompteur-container');
        this.content = document.getElementById('prompteur-content');
        this.webcamVideo = document.getElementById('webcam');
        this.webcamStream = null;
        
        // DOM Elements - Reveal.js
        this.presentationContainer = document.getElementById('presentation-container');
        this.revealSlides = document.getElementById('reveal-slides');
        this.modeIndicator = document.getElementById('mode-indicator');
        this.revealInstance = null;

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
                if (this.state.presentationMode) {
                    this.generateRevealSlides();
                } else {
                    this.updateContent();
                }
            }

            // Position (seulement si pas en lecture et pas en mode présentation)
            if (prevState.position !== this.state.position && 
                !this.state.isPlaying && 
                !this.state.presentationMode) {
                this.updatePosition();
            }

            // Play/Pause
            if (prevState.isPlaying !== this.state.isPlaying) {
                if (this.state.isPlaying && !this.state.presentationMode) {
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

            // Webcam
            if (prevState.webcamEnabled !== this.state.webcamEnabled) {
                console.log('📹 Webcam:', this.state.webcamEnabled);
                this.toggleWebcam(this.state.webcamEnabled);
            }

            // 🎨 Mode Présentation
            if (prevState.presentationMode !== this.state.presentationMode) {
                console.log('🎨 Mode présentation:', this.state.presentationMode);
                this.togglePresentationMode();
            }
        }

        // 🎨 Navigation Reveal.js
        if (data.type === 'presentation-navigate') {
            this.navigateReveal(data.direction);
        }

        if (data.type === 'presentation-goto') {
            this.gotoSlide(data.slideIndex, data.fragmentIndex);
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

            this.webcamStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });

            this.webcamVideo.srcObject = this.webcamStream;
            await this.webcamVideo.play();
            this.webcamVideo.classList.add('active');

            console.log('✅ Webcam activée');
        } catch (error) {
            console.error('❌ Erreur webcam:', error);

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

        this.webcamVideo.classList.remove('active');

        if (this.webcamStream) {
            this.webcamStream.getTracks().forEach(track => track.stop());
            this.webcamStream = null;
        }

        this.webcamVideo.srcObject = null;
        console.log('✅ Webcam désactivée');
    }

    // ========== CONTENT (PROMPTEUR) ==========

    updateContent() {
        const html = MarkdownParser.parse(this.state.text);
        this.content.innerHTML = html;
    }

    updatePosition() {
        this.state.position = Math.max(0, this.state.position);
        this.content.style.transform = `translateY(-${this.state.position}px)`;
    }

    startScrolling() {
        if (this.state.presentationMode) return; // Pas de scroll en mode présentation

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

    // ========== REVEAL.JS 🎨 ==========

    togglePresentationMode() {
        if (this.state.presentationMode) {
            // ===== ACTIVER MODE PRÉSENTATION =====
            console.log('🎨 Activation mode Présentation');
            
            // 1️⃣ Cacher complètement le prompteur
            this.wrapper.style.display = 'none';
            
            // 2️⃣ Arrêter le scroll si actif
            this.stopScrolling();
            
           
            
            // 4️⃣ Afficher le container de présentation
            this.presentationContainer.style.display = 'block';
            
            // 5️⃣ Générer les slides
            if (!this.revealInstance) {
                this.initReveal();
            } else {
                this.initReveal();
                this.generateRevealSlides();
                this.revealInstance.sync();
            }
            
            // 6️⃣ Indicateur visuel
            this.showModeIndicator('📊 Mode Présentation');
            
        } else {
            // ===== RETOUR MODE PROMPTEUR =====
            console.log('📜 Retour mode Prompteur');
            
            // 1️⃣ Cacher le container de présentation
            this.presentationContainer.style.display = 'none';
            
            // 2️⃣ Réafficher le prompteur
            this.wrapper.style.display = 'block';
            
            // 3️⃣ Réafficher la webcam si elle était active
            if (this.state.webcamEnabled && this.webcamVideo) {
                this.webcamVideo.style.display = 'block';
            }
            
            // 4️⃣ Mettre à jour le contenu
            this.updateContent();
            

            document.body.style.setProperty('background', '#000', 'important');
            document.body.style.setProperty('color', '#FFF', 'important');
            // 5️⃣ Remettre la position à zéro
            this.state.position = 0;
            this.updatePosition();
            
            // 6️⃣ Indicateur visuel
            this.showModeIndicator('📜 Mode Prompteur');
        }
    }
    

    initReveal() {
        console.log('🎨 Initialisation Reveal.js...');
        
        this.generateRevealSlides();

        this.revealInstance = new Reveal({
            hash: false,
            controls: true,
            progress: true,
            center: true,
            transition: 'slide',
            width: 1920,
            height: 1080,
            margin: 0.04,
            plugins: [ RevealMarkdown, RevealHighlight ]
        });

        this.revealInstance.initialize().then(() => {
            console.log('✅ Reveal.js initialisé');

            // Écouter les changements de slides
            this.revealInstance.on('slidechanged', (event) => {
                this.state.currentSlide = event.indexh;
                this.state.totalSlides = this.revealInstance.getTotalSlides();

                console.log(`📊 Slide ${event.indexh + 1} / ${this.state.totalSlides}`);

                // Envoyer au serveur via WebSocket
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'slide-changed',
                        state: {
                            currentSlide: this.state.currentSlide,
                            totalSlides: this.state.totalSlides
                        }
                    }));
                }
            });
        });
    }

    generateRevealSlides() {
        console.log('🎨 Génération des slides...');

        const slides = this.parseMarkdownToSlides(this.state.text);

        this.revealSlides.innerHTML = slides.map(slide => `
            <section data-markdown>
                <textarea data-template>
${slide}
                </textarea>
            </section>
        `).join('');

        if (this.revealInstance) {
            this.revealInstance.sync();
            this.revealInstance.slide(this.state.currentSlide);
        }

        console.log(`✅ ${slides.length} slides générés`);
    }

    parseMarkdownToSlides(markdown) {
        let slides = [];

        // Méthode 1 : Séparer par "---"
        if (markdown.includes('\n---\n')) {
            slides = markdown.split('\n---\n');
        } 
        // Méthode 2 : Séparer par H1 (#)
        else {
            const lines = markdown.split('\n');
            let currentSlide = '';

            lines.forEach(line => {
                if (line.startsWith('# ') && currentSlide.trim()) {
                    slides.push(currentSlide.trim());
                    currentSlide = line + '\n';
                } else {
                    currentSlide += line + '\n';
                }
            });

            if (currentSlide.trim()) {
                slides.push(currentSlide.trim());
            }
        }

        // Si aucun slide trouvé, retourner le markdown complet
        return slides.length > 0 ? slides : [markdown];
    }

    navigateReveal(direction) {
        if (!this.revealInstance) return;

        console.log(`🎨 Navigation: ${direction}`);

        switch(direction) {
            case 'next':
                this.revealInstance.next();
                break;
            case 'prev':
                this.revealInstance.prev();
                break;
            case 'up':
                this.revealInstance.up();
                break;
            case 'down':
                this.revealInstance.down();
                break;
            case 'first':
                this.revealInstance.slide(0);
                break;
            case 'last':
                const total = this.revealInstance.getTotalSlides();
                this.revealInstance.slide(total - 1);
                break;
        }
    }

    gotoSlide(slideIndex, fragmentIndex = 0) {
        if (this.revealInstance) {
            console.log(`🎨 Aller au slide ${slideIndex}`);
            this.revealInstance.slide(slideIndex, fragmentIndex);
        }
    }

    showModeIndicator(text) {
        if (!this.modeIndicator) return;

        this.modeIndicator.textContent = text;
        this.modeIndicator.classList.add('show');

        setTimeout(() => {
            this.modeIndicator.classList.remove('show');
        }, 2000);
    }

    // ========== KEYBOARD CONTROLS ==========

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            // Les raccourcis Reveal.js sont gérés automatiquement en mode présentation
            if (this.state.presentationMode) {
                // Touche P pour revenir au mode prompteur
                if (e.key === 'p' || e.key === 'P') {
                    e.preventDefault();
                    this.togglePresentationModeViaKey();
                }
                return; // Laisser Reveal.js gérer les autres touches
            }

            // Contrôles du prompteur classique
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
                    console.log('⚡ Vitesse:', this.state.speed);
                    break;
                case '-':
                case '_':
                    e.preventDefault();
                    this.state.speed = Math.max(0.5, this.state.speed - 0.5);
                    console.log('⚡ Vitesse:', this.state.speed);
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
                case 'p':
                case 'P':
                    e.preventDefault();
                    this.togglePresentationModeViaKey();
                    break;
            }
        });
    }

    togglePlay() {
        if (this.state.presentationMode) return; // Pas de play/pause en mode présentation

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

    togglePresentationModeViaKey() {
        this.state.presentationMode = !this.state.presentationMode;

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'presentation-toggle',
                state: { presentationMode: this.state.presentationMode }
            }));
        }

        this.togglePresentationMode();
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    new Prompteur();
});
