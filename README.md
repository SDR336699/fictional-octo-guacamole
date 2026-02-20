# Rent Pro

Rent Pro est une plateforme SaaS nouvelle génération pour agences de location de voitures au Maroc, avec web + mobile synchronisés sur la même base de données.

## Fonctionnalités incluses
- Gestion digitale des clients, véhicules et locations.
- Scan CIN/passeport via upload d'image + OCR (`tesseract.js`).
- Génération automatique de contrats de location en PDF.
- Signature électronique stockée en base.
- Interface multilingue par défaut en français, avec bascule arabe/anglais.
- Montants en MAD et données adaptées au contexte marocain (villes, identité, etc.).

## Architecture
- `apps/api`: API Express + Prisma + PostgreSQL.
- `apps/web`: Application web React (Vite).
- `apps/mobile`: Application mobile Expo React Native.
- `prisma/schema.prisma`: Schéma partagé, source de vérité pour web/mobile.

## Démarrage local
```bash
npm install
cp apps/api/.env.example apps/api/.env
npm --workspace @rentpro/api run prisma:generate
npm --workspace @rentpro/api run prisma:migrate
npm run dev:api
npm run dev:web
npm run dev:mobile
```

## Déploiement Railway (web backend)
1. Créer un projet Railway et connecter ce repository.
2. Ajouter un service PostgreSQL.
3. Définir les variables:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `PORT=4000`
4. Commande de build: `npm install && npm --workspace @rentpro/api run build`
5. Start command: `npm --workspace @rentpro/api run start`

## Lien de téléchargement mobile (prêt à produire)
Le projet mobile est compatible avec **EAS Build**.

Exemples de commandes:
```bash
npm i -g eas-cli
cd apps/mobile
eas login
eas build -p android --profile production
eas build -p ios --profile production
```
Après build, Expo/EAS fournit un lien téléchargeable APK/IPA à partager avec vos clients/agences.

## Identifiants de bootstrap
Au premier démarrage:
- Email: `admin@rentpro.ma`
- Mot de passe: `Admin@123`
