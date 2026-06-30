# 🎬 Rysao — Studio de clips IA

Transforme une **musique** en **clip vidéo IA** (qualité réaliste, jusqu'en 4K selon le modèle).
Tu choisis le **type de clip** et le **personnage**, l'app analyse ta musique, construit les
prompts plan par plan, et génère la vidéo via les meilleurs moteurs d'IA du marché (**Replicate**).

> ⚙️ Comment ça marche vraiment ?
> La génération vidéo ultra-réaliste demande des modèles d'IA gigantesques (Kling, Luma,
> MiniMax, Wan…). Personne ne les fait tourner « à la maison ». Cette app ne réinvente pas le
> moteur : elle **orchestre** ces modèles via l'API Replicate — analyse audio, choix créatifs,
> construction des prompts, génération multi-plans, suivi en temps réel. C'est exactement
> l'architecture des outils « AI music video » du marché.

---

## ✨ Fonctionnalités

- 🎵 **Analyse audio dans le navigateur** : durée, BPM estimé, énergie → suggestion d'ambiance
- 🎨 **7 styles de clip** : concert, cinématique, anime, néon/cyberpunk, nature, abstrait, rétro
- 🧑‍🎤 **Personnage personnalisable** : description, type, tenue + **image de référence** (cohérence du visage d'un plan à l'autre via l'image-to-video)
- 🎚️ **Réglages** : choix du moteur, format (16:9 / 9:16 / 1:1), durée des plans, nombre de plans
- ⚡ **Génération multi-plans en parallèle** avec suivi d'état en direct
- 🧪 **Mode démo** intégré pour tester toute l'interface **sans dépenser un centime**

---

## 🚀 Démarrage

```bash
# 1. Installer
npm install

# 2. Configurer
cp .env.example .env
#   -> ouvre .env et colle ta clé Replicate (REPLICATE_API_TOKEN)
#   -> par défaut DEMO_MODE=true : l'UI marche sans clé, en mode simulé

# 3. Lancer
npm start
#   -> http://localhost:3000
```

### Passer en génération réelle

1. Crée un compte sur **https://replicate.com** et récupère une clé :
   https://replicate.com/account/api-tokens
2. Dans `.env` :
   ```
   REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxx
   DEMO_MODE=false
   ```
3. Relance `npm start`. Le badge en haut à droite passe sur **● Live · Replicate**.

---

## 🤖 Modèles disponibles

Configurés dans [`models.js`](./models.js) — faciles à étendre :

| Clé        | Modèle                         | Image de réf. | Durée max |
|------------|--------------------------------|:-------------:|:---------:|
| `kling-2.1`| Kling v2.1 (réaliste)          | ✅            | 10 s      |
| `kling-1.6`| Kling v1.6 Standard (rapide)   | ✅            | 10 s      |
| `minimax`  | MiniMax Hailuo (video-01)      | ✅            | 6 s       |
| `wan-2.1`  | Wan 2.1 (open-source)          | ❌            | 5 s       |
| `luma-ray` | Luma Ray 2 (720p)              | ✅            | 9 s       |

> 💡 Pour ajouter un modèle, copie un bloc dans `models.js` et adapte `buildInput()`
> aux champs d'entrée attendus par le modèle sur sa page Replicate.

---

## 💰 Coûts (génération réelle)

Les API vidéo facturent généralement **~0,2 à 0,7 $ par seconde** de vidéo générée.
Un clip de 4 plans × 5 s ≈ 20 s ≈ quelques euros. Un vrai clip complet de 3 min peut
coûter plusieurs centaines d'euros. Le **mode démo** existe justement pour tout tester avant.

---

## 🗺️ Architecture

```
server.js          API Express : /config, /plan, /generate, /status — garde la clé côté serveur
models.js          Registre des modèles Replicate + adaptateurs d'entrée
promptBuilder.js   Construit les prompts (style + personnage + ambiance + audio) par plan
public/
  index.html       Interface en assistant (5 étapes)
  styles.css       Thème
  audio.js         Analyse audio (Web Audio API) : durée, BPM, ambiance
  app.js           État, navigation, appels API, polling, rendu des vidéos
```

## 🧭 Pistes d'évolution

- 🎞️ **Montage automatique** : assembler les plans calés sur le beat (FFmpeg côté serveur)
- 🔁 **Cohérence de personnage** renforcée (seeds fixes, character refs)
- 📝 **Transcription des paroles** (Whisper) pour des prompts par couplet/refrain
- ⬆️ **Upscale 4K** (Topaz / Real-ESRGAN) en post-traitement
- 💾 Sauvegarde des projets et files d'attente de génération

---

Fait avec ◈ par Rysao.
