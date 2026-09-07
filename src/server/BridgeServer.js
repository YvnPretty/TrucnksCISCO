// TrucnksCISCO - High-Performance Pure Node.js Bridge Server
// Implements WebSocket RFC 6455 protocol and REST API on Port 7531 with zero external dependencies.

const http = require("node:http");
const crypto = require("node:crypto");
const EventEmitter = require("node:events");
const { TrunkEngine } = require("../core/TrunkEngine");
const { TopologyBuilder } = require("../core/TopologyBuilder");

class BridgeServer extends EventEmitter {
  constructor(port = 7531) {
    super();
    this.port = port;
    this.server = null;
    this.ptSocket = null; // Connected Packet Tracer WebSocket client
    this.pendingCalls = new Map(); // tool_call_id -> { resolve, reject, timeout }
    this.callCounter = 0;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleHttpRequest(req, res));

      this.server.on("upgrade", (req, socket, head) => {
        this.handleWebSocketUpgrade(req, socket, head);
      });

      this.server.on("error", (err) => {
        reject(err);
      });

      this.server.listen(this.port, "0.0.0.0", () => {
        console.log(`[TrucnksCISCO] Servidor Bridge escuchando en http://127.0.0.1:${this.port}`);
        console.log(`[TrucnksCISCO] Esperando conexión de la extensión de Cisco Packet Tracer...`);
        resolve(this);
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.ptSocket) {
        try { this.ptSocket.destroy(); } catch (_) {}
      }
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  // --- WebSocket RFC 6455 Handling ---
  handleWebSocketUpgrade(req, socket, head) {
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = crypto
      .createHash("sha1")
      .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");

    const responseHeaders = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey}`,
      "\r\n",
    ].join("\r\n");

    socket.write(responseHeaders);

    const client = {
      socket,
      id: crypto.randomUUID(),
      buffer: Buffer.alloc(0),
    };

    console.log(`[TrucnksCISCO] Cliente WebSocket conectado desde Packet Tracer [ID: ${client.id}]`);
    this.ptSocket = client;
    this.emit("pt_connected", client);

    socket.on("data", (chunk) => {
      client.buffer = Buffer.concat([client.buffer, chunk]);
      this.processWebSocketFrames(client);
    });

    socket.on("close", () => {
      console.log(`[TrucnksCISCO] Packet Tracer desconectado [ID: ${client.id}]`);
      if (this.ptSocket === client) {
        this.ptSocket = null;
      }
      this.emit("pt_disconnected", client);
    });

    socket.on("error", (err) => {
      console.error(`[TrucnksCISCO] Error en socket PT: ${err.message}`);
    });
  }

  sendWebSocketMessage(client, payloadObj) {
    if (!client || client.socket.destroyed) return;
    const jsonStr = JSON.stringify(payloadObj);
    const payload = Buffer.from(jsonStr, "utf8");
    const length = payload.length;

    let header;
    if (length <= 125) {
      header = Buffer.from([0x81, length]);
    } else if (length <= 65535) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }

    client.socket.write(Buffer.concat([header, payload]));
  }

  processWebSocketFrames(client) {
    while (client.buffer.length >= 2) {
      const byte1 = client.buffer[0];
      const byte2 = client.buffer[1];

      const isFinal = (byte1 & 0x80) !== 0;
      const opcode = byte1 & 0x0f;
      const isMasked = (byte2 & 0x80) !== 0;
      let payloadLength = byte2 & 0x7f;

      let offset = 2;

      if (payloadLength === 126) {
        if (client.buffer.length < 4) return;
        payloadLength = client.buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLength === 127) {
        if (client.buffer.length < 10) return;
        payloadLength = Number(client.buffer.readBigUInt64BE(2));
        offset = 10;
      }

      let maskKey = null;
      if (isMasked) {
        if (client.buffer.length < offset + 4) return;
        maskKey = client.buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      if (client.buffer.length < offset + payloadLength) return;

      const payload = client.buffer.subarray(offset, offset + payloadLength);
      client.buffer = client.buffer.subarray(offset + payloadLength);

      if (isMasked && maskKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i % 4];
        }
      }

      // Handle Opcode
      if (opcode === 0x08) {
        // Close frame
        client.socket.end();
        return;
      } else if (opcode === 0x09) {
        // Ping frame -> send Pong
        const pong = Buffer.from([0x8a, 0x00]);
        client.socket.write(pong);
      } else if (opcode === 0x01 || opcode === 0x02) {
        // Text or Binary data
        try {
          const text = payload.toString("utf8");
          const msg = JSON.parse(text);
          this.handleIncomingMessage(msg);
        } catch (e) {
          console.error("[TrucnksCISCO] Error procesando JSON de WebSocket:", e.message);
        }
      }
    }
  }

  handleIncomingMessage(msg) {
    if (msg.type === "tool_result") {
      const callId = msg.tool_call_id;
      const pending = this.pendingCalls.get(callId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingCalls.delete(callId);
        pending.resolve(msg.result);
      }
    } else if (msg.type === "register") {
      console.log(`[TrucnksCISCO] Extensión registrada: ${msg.client} con capacidades: ${msg.capabilities?.join(", ")}`);
    }
  }

  /**
   * Invokes a tool inside Packet Tracer and waits for execution.
   */
  invokeTool(toolName, toolInput = {}, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
      if (!this.ptSocket) {
        return reject(new Error("Cisco Packet Tracer no está conectado al Bridge. Abre Packet Tracer y carga la extensión TrucnksCISCO."));
      }

      const callId = `call_${Date.now()}_${++this.callCounter}`;
      const timeout = setTimeout(() => {
        this.pendingCalls.delete(callId);
        reject(new Error(`Timeout esperando respuesta de Packet Tracer para '${toolName}' (${timeoutMs}ms)`));
      }, timeoutMs);

      this.pendingCalls.set(callId, { resolve, reject, timeout });

      this.sendWebSocketMessage(this.ptSocket, {
        type: "tool_call",
        tool_call_id: callId,
        tool_name: toolName,
        tool_input: toolInput,
      });
    });
  }

  // --- HTTP Request Dispatcher ---
  handleHttpRequest(req, res) {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    if (req.method === "GET" && pathname === "/") {
      this.serveDashboard(res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/status") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "online",
        service: "TrucnksCISCO Bridge Server",
        version: "1.0.0",
        port: this.port,
        packetTracerConnected: this.ptSocket !== null,
        clientId: this.ptSocket ? this.ptSocket.id : null,
      }));
      return;
    }

    if (req.method === "POST" && pathname === "/api/generate-trunk") {
      this.readJsonBody(req, (err, body) => {
        if (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: err.message }));
          return;
        }

        try {
          const commands = TrunkEngine.generateTrunkConfig(body);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, commands, script: commands.join("\n") }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/tool") {
      this.readJsonBody(req, async (err, body) => {
        if (err || !body || !body.tool) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Missing 'tool' in request body" }));
          return;
        }

        try {
          const result = await this.invokeTool(body.tool, body.args || {});
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, result }));
        } catch (e) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/deploy-demo") {
      const demo = TopologyBuilder.buildStandardTrunkDemo();
      const calls = demo.toPacketTracerToolCalls();

      if (!this.ptSocket) {
        // Standalone simulation mode
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          mode: "dry-run (PT not connected)",
          message: "Topología generada en modo simulación (Copia los comandos o conecta Packet Tracer)",
          devicesCount: demo.devices.length,
          linksCount: demo.links.length,
          toolCallsCount: calls.length,
          sampleCommands: Array.from(demo.configs.entries()).map(([dev, cmds]) => ({
            device: dev,
            commands: cmds
          }))
        }));
        return;
      }

      // Live deployment to Packet Tracer
      (async () => {
        try {
          const results = [];
          for (const call of calls) {
            const r = await this.invokeTool(call.tool, call.args);
            results.push({ tool: call.tool, result: r });
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, deployed: true, stepsCount: results.length }));
        } catch (e) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      })();
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: "Route not found" }));
  }

  readJsonBody(req, callback) {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", () => {
      try {
        const parsed = raw ? JSON.parse(raw) : {};
        callback(null, parsed);
      } catch (e) {
        callback(e);
      }
    });
  }

  serveDashboard(res) {
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>TrucnksCISCO Control Center</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 2rem; max-width: 900px; margin: auto; }
    h1 { color: #38bdf8; display: flex; align-items: center; gap: 10px; }
    .badge { background: #0284c7; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
    .card { background: #131c2e; border: 1px solid #1e293b; padding: 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; }
    .status { font-weight: bold; color: ${this.ptSocket ? "#22c55e" : "#ef4444"}; }
    button { background: #0284c7; color: white; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 600; }
    button:hover { background: #0369a1; }
    pre { background: #050811; padding: 1rem; border-radius: 6px; overflow-x: auto; color: #a5f3fc; }
  </style>
</head>
<body>
  <h1>TrucnksCISCO <span class="badge">v1.0.0</span></h1>
  <p>Herramienta de Automatización de Enlaces Troncales y VLANs en Cisco Packet Tracer.</p>
  <div class="card">
    <h3>Estado de Conexión</h3>
    <p>Puerto del Bridge: <strong>7531</strong></p>
    <p>Estado Packet Tracer: <span class="status">${this.ptSocket ? "CONECTADO EN VIVO" : "ESPERANDO CONEXIÓN..."}</span></p>
  </div>
  <div class="card">
    <h3>Topología de Demostración</h3>
    <p>Genera una topología multicapa con switches 3560, 2960, router 2911 con RoaS y troncales 802.1Q.</p>
    <button onclick="deployDemo()">Desplegar / Simular Topología</button>
    <pre id="output">Haz clic en el botón para ver la salida...</pre>
  </div>
  <script>
    async function deployDemo() {
      const out = document.getElementById('output');
      out.textContent = 'Enviando solicitud...';
      try {
        const res = await fetch('/api/deploy-demo', { method: 'POST' });
        const json = await res.json();
        out.textContent = JSON.stringify(json, null, 2);
      } catch (err) {
        out.textContent = 'Error: ' + err.message;
      }
    }
  </script>
</body>
</html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  }
}

module.exports = { BridgeServer };
