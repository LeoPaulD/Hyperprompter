const fetch = require('node-fetch');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

class MammouthService {
  constructor() {
    this.apiKey = process.env.MAMMOUTH_API_KEY;
    this.model = process.env.MAMMOUTH_MODEL || 'gpt-4.1';
    this.baseUrl = 'https://api.mammouth.ai/v1/chat/completions';

    // Charger les commandes depuis le JSON
    const commandsPath = path.join(__dirname, 'prompts', 'commands.json');
    this.commands = JSON.parse(fs.readFileSync(commandsPath, 'utf8')).commands;

    console.log('🤖 Service Mammouth AI initialisé');
    console.log(`📋 ${Object.keys(this.commands).length} commandes disponibles`);
  }

  /**
   * Vérifie si l'API est configurée
   */
  isConfigured() {
    return !!this.apiKey && this.apiKey !== 'votre_cle_api_ici';
  }

  /**
   * Liste toutes les commandes disponibles
   */
  getAvailableCommands() {
    return Object.entries(this.commands).map(([key, cmd]) => ({
      id: key,
      name: cmd.name,
      description: cmd.description
    }));
  }

  /**
   * Nettoie le prompt pour éviter les filtres de contenu
   */
  sanitizePrompt(prompt) {
    return prompt
      .replace(/\b(strict|force|must|obligatoire)\b/gi, match => {
        const replacements = {
          'strict': 'attentif',
          'force': 'encourage',
          'must': 'devrait',
          'obligatoire': 'recommandé'
        };
        return replacements[match.toLowerCase()] || match;
      });
  }

  /**
   * Appelle l'API Mammouth AI avec retry et gestion d'erreurs
   */
  async call(commandKey, userText, customPrompt = null) {
    if (!this.isConfigured()) {
      throw new Error('API Mammouth non configurée. Vérifiez votre fichier .env');
    }

    const command = this.commands[commandKey];
    if (!command && !customPrompt) {
      throw new Error(`Commande inconnue: ${commandKey}`);
    }

    let systemPrompt = customPrompt || command.system;
    const temperature = command?.temperature || 0.7;
    const maxRetries = 3;
    const retryDelay = 1000;

    console.log(`🤖 Appel Mammouth AI: ${command?.name || 'Custom'}`);
    console.log(`📝 Texte (${userText.length} car.): ${userText.substring(0, 100)}...`);

    // Tentatives avec retry
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Nettoyer le prompt si ce n'est pas la première tentative
        if (attempt > 1) {
          systemPrompt = this.sanitizePrompt(systemPrompt);
          console.log(`🔄 Tentative ${attempt}/${maxRetries} avec prompt assoupli`);
        } else {
          console.log(`🔄 Tentative ${attempt}/${maxRetries}`);
        }

        const headers = {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        };

        const data = {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: userText
            }
          ],
          temperature: attempt > 1 ? Math.min(temperature + 0.1, 1.0) : temperature,
          max_tokens: parseInt(process.env.MAMMOUTH_MAX_TOKENS) || 2000
        };

        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(data),
        });

        const responseText = await response.text();
        
        if (!response.ok) {
          // Détecter les erreurs de politique de contenu
          if (responseText.includes('content management policy') || 
              responseText.includes('ContentPolicyViolationError')) {
            
            console.warn(`⚠️ Tentative ${attempt}: Filtré par politique de contenu`);
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
              continue; // Réessayer
            } else {
              throw new Error('Contenu bloqué par les filtres après plusieurs tentatives. Essayez de reformuler votre texte.');
            }
          }

          // Autre erreur API
          throw new Error(`Erreur API (${response.status}): ${responseText.substring(0, 500)}`);
        }

        const result = JSON.parse(responseText);
        
        if (!result.choices || !result.choices[0] || !result.choices[0].message) {
          throw new Error('Réponse API invalide : pas de contenu');
        }

        const content = result.choices[0].message.content;

        console.log('✅ Réponse reçue');
        console.log(`📊 Tokens: ${result.usage?.total_tokens || 'N/A'}`);
        console.log(`📝 Résultat (${content.length} car.): ${content.substring(0, 100)}...`);

        return {
          success: true,
          content: content,
          usage: result.usage,
          model: result.model
        };

      } catch (error) {
        console.error(`❌ Tentative ${attempt} échouée:`, error.message);

        // Si c'est la dernière tentative, propager l'erreur
        if (attempt === maxRetries) {
          throw new Error(`Échec après ${maxRetries} tentatives: ${error.message}`);
        }

        // Attendre avant de réessayer
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  /**
   * Améliore le texte du prompteur
   */
  async ameliorerTexte(text) {
    return this.call('ameliorer_texte', text);
  }

  /**
   * Résume le texte
   */
  async resumer(text) {
    return this.call('resumer', text);
  }

  /**
   * Génère un plan structuré
   */
  async genererPlan(text) {
    return this.call('generer_plan', text);
  }

  /**
   * Corrige l'orthographe
   */
  async corrigerOrthographe(text) {
    return this.call('corriger_orthographe', text);
  }

  /**
   * Transforme en présentation
   */
  async transformerPresentation(text) {
    return this.call('transformer_presentation', text);
  }

  /**
   * Développe le texte
   */
  async developper(text) {
    return this.call('developper', text);
  }

  /**
   * Simplifie le texte
   */
  async simplifier(text) {
    return this.call('simplifier', text);
  }

  /**
   * Commande personnalisée
   */
  async custom(text, prompt) {
    return this.call('custom', text, prompt);
  }
}

module.exports = new MammouthService();
