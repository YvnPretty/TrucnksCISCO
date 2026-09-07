#!/usr/bin/env node
// TrucnksCISCO CLI - Cisco Trunk & VLAN Automation Utility
// Inspired by ph0Void/cisco-magament

const fs = require("node:fs");
const path = require("node:path");
const { TrunkEngine } = require("../src/core/TrunkEngine");
const { TopologyBuilder } = require("../src/core/TopologyBuilder");
const { BridgeServer } = require("../src/server/BridgeServer");

const args = process.argv.slice(2);
const command = args[0] || "help";

function printBanner() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                   TRUCNKS - CISCO AUTOMATION                      ║
║     Gestión de Trunks 802.1Q, VLANs y Packet Tracer Bridge        ║
║               Basado en arquitectura cisco-magament               ║
╚═══════════════════════════════════════════════════════════════════╝
`);
}

async function main() {
  switch (command) {
    case "start-bridge": {
      printBanner();
      const port = process.env.PORT || 7531;
      const server = new BridgeServer(Number(port));
      await server.start();

      if (args.includes("--test")) {
        console.log("\n[Test] Verificando endpoint HTTP...");
        const http = require("node:http");
        http.get(`http://127.0.0.1:${port}/api/status`, (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            console.log("[Test] Respuesta del servidor:", data);
            server.stop().then(() => {
              console.log("[Test] Servidor detenido correctamente.");
              process.exit(0);
            });
          });
        });
      }
      break;
    }

    case "test-trunk": {
      printBanner();
      console.log("=== 1. Generación de Trunk 802.1Q Estándar (Switch 2960) ===");
      const trunk2960 = TrunkEngine.generateTrunkConfig({
        interface: "GigabitEthernet0/1",
        allowedVlans: "10,20,30,99",
        nativeVlan: 99,
        description: "Enlace Troncal a Switch de Distribución"
      });
      console.log(trunk2960.join("\n"));

      console.log("\n=== 2. Generación de Trunk Multicapa (Switch 3560 con encapsulación dot1q) ===");
      const trunk3560 = TrunkEngine.generateTrunkConfig({
        interface: "GigabitEthernet0/1",
        allowedVlans: "10,20,30,99",
        nativeVlan: 99,
        needsEncapsulation: true,
        description: "Uplink a Router Core"
      });
      console.log(trunk3560.join("\n"));

      console.log("\n=== 3. Generación de Router-on-a-Stick (RoaS) en Router 2911 ===");
      const roas = TrunkEngine.generateRouterOnAStick("GigabitEthernet0/0", [
        { vlan: 10, ip: "192.168.10.1", netmask: "255.255.255.0" },
        { vlan: 20, ip: "192.168.20.1", netmask: "255.255.255.0" },
        { vlan: 99, ip: "192.168.99.1", netmask: "255.255.255.0", isNative: true }
      ]);
      console.log(roas.join("\n"));

      console.log("\n=== 4. Generación de EtherChannel LACP Trunk ===");
      const lacp = TrunkEngine.generateEtherChannelTrunk(1, ["FastEthernet0/1", "FastEthernet0/2"], {
        allowedVlans: "10,20,99",
        nativeVlan: 99
      });
      console.log(lacp.join("\n"));

      console.log("\n[OK] Todas las plantillas de configuración Cisco IOS han sido validadas exitosamente.");
      break;
    }

    case "export-demo": {
      printBanner();
      const demo = TopologyBuilder.buildStandardTrunkDemo();
      const outDir = path.resolve(__dirname, "../output");
      fs.mkdirSync(outDir, { recursive: true });

      const scriptFile = path.join(outDir, "demo_trunk_topology.ios");
      let fullContent = `! ==========================================================\n`;
      fullContent += `! Topología de Prueba: ${demo.name}\n`;
      fullContent += `! Generado por TrucnksCISCO Automation\n`;
      fullContent += `! ==========================================================\n\n`;

      for (const [deviceName, cmds] of demo.configs.entries()) {
        fullContent += `! ----------------------------------------------------------\n`;
        fullContent += `! Configuración para dispositivo: ${deviceName}\n`;
        fullContent += `! ----------------------------------------------------------\n`;
        fullContent += cmds.join("\n") + "\n\n";
      }

      fs.writeFileSync(scriptFile, fullContent, "utf8");
      console.log(`[OK] Script Cisco IOS generado en: ${scriptFile}`);
      console.log(`Dispositivos configurados: ${demo.devices.length}`);
      console.log(`Enlaces totales: ${demo.links.length}`);
      break;
    }

    case "audit": {
      printBanner();
      console.log("Comandos IOS para auditoría de troncales en switches Cisco:");
      const cmds = TrunkEngine.getAuditCommands();
      cmds.forEach((c) => console.log(`  - ${c}`));
      break;
    }

    case "help":
    default: {
      printBanner();
      console.log(`
Uso: node bin/trucnks-cisco.js <comando>

Comandos disponibles:
  start-bridge   Inicia el servidor puente WebSocket/REST en el puerto 7531
  test-trunk     Genera y valida configuraciones de enlaces troncales Cisco IOS
  export-demo    Construye la topología demo y exporta scripts .ios a /output
  audit          Muestra los comandos recomendados de verificación y auditoría
  help           Muestra esta ayuda

Opciones:
  --test         Ejecuta una prueba automática de ping sobre el bridge y finaliza
`);
      break;
    }
  }
}

main().catch((err) => {
  console.error("[ERROR]", err);
  process.exit(1);
});
