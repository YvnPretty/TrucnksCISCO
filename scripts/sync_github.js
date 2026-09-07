#!/usr/bin/env node
// TrucnksCISCO - GitHub Sync Utility
// Allows pushing the TrucnksCISCO project to https://github.com/YvnPretty/TrucnksCISCO.git
// Reads credentials securely from environment variables or .env file.

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");

// Cargar .env si existe
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...vals] = trimmed.split("=");
      if (key && vals.length) {
        process.env[key.trim()] = vals.join("=").trim();
      }
    }
  });
}

const GITHUB_TOKEN = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_REPO_OWNER || "YvnPretty";
const REPO = process.env.GITHUB_REPO_NAME || "TrucnksCISCO";

console.log(`
╔══════════════════════════════════════════════════════════════╗
║               SINCRONIZACIÓN CON GITHUB                      ║
║     Repositorio: https://github.com/${OWNER}/${REPO}     ║
╚══════════════════════════════════════════════════════════════╝
`);

if (!GITHUB_TOKEN || GITHUB_TOKEN === "tu_nuevo_token_aqui") {
  console.log(`
[AVISO DE CONFIGURACIÓN REQUERIDA]
Para sincronizar automáticamente con GitHub:
1. Revoca en GitHub el token expuesto anteriormente por seguridad.
2. Genera un nuevo token en: https://github.com/settings/tokens
3. Añade tu token a un archivo .env en la raíz de TrucnksCISCO:
   GITHUB_PAT=tu_token_aqui

--- Instrucciones para sincronizar mediante Git estándar (en tu terminal): ---
  cd /home/yvngmolly/.gemini/antigravity/scratch/TrucnksCISCO
  git init
  git add .
  git commit -m "feat: Initial commit of TrucnksCISCO tool"
  git branch -M main
  git remote add origin https://<TU_TOKEN>@github.com/${OWNER}/${REPO}.git
  git push -u origin main
`);
  process.exit(0);
}

console.log(`[OK] Token detectado para el usuario/repo: ${OWNER}/${REPO}`);
console.log(`[INFO] Puedes ejecutar el git push local o sincronizar los archivos.`);
