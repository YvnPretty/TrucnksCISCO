// TrucnksCISCO - Packet Tracer HUD & Bridge Client
(function () {
  var WS_URL = "ws://127.0.0.1:7531/pt-bridge";
  var HTTP_FALLBACK_URL = "http://127.0.0.1:7531/api/pt-poll";

  var $statusDot = document.getElementById("status-dot");
  var $statusText = document.getElementById("status-text");
  var $toolCount = document.getElementById("tool-count");
  var $log = document.getElementById("log");
  var $btnReconnect = document.getElementById("btn-reconnect");
  var $btnScan = document.getElementById("btn-scan");
  var $btnClear = document.getElementById("btn-clear-log");

  var socket = null;
  var toolCount = 0;
  var isConnected = false;

  function log(msg, type) {
    if (!$log) return;
    var div = document.createElement("div");
    div.className = "line " + (type || "info");
    var ts = new Date().toTimeString().slice(0, 8);
    div.innerHTML = '<span class="ts">' + ts + "</span> " + escapeHtml(msg);
    $log.appendChild(div);
    $log.scrollTop = $log.scrollHeight;
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function setStatus(online, text) {
    isConnected = online;
    if ($statusDot) {
      $statusDot.className = "dot " + (online ? "connected" : "disconnected");
    }
    if ($statusText) {
      $statusText.textContent = text || (online ? "Conectado al Bridge" : "Desconectado");
    }
  }

  function executeInPacketTracer(fnName, args) {
    try {
      if (typeof window[fnName] === "function") {
        return window[fnName].apply(null, args);
      }
      // Si está en contexto de scripting externo de Packet Tracer
      if (typeof external !== "undefined" && typeof external.runCode === "function") {
        var callStr = "return " + fnName + "(" + args.map(JSON.stringify).join(",") + ");";
        return JSON.parse(external.runCode(callStr));
      }
      return { success: false, error: "Función " + fnName + " no encontrada en el contexto de Packet Tracer." };
    } catch (e) {
      return { success: false, error: e.message || String(e) };
    }
  }

  function connect() {
    setStatus(false, "Conectando...");
    log("Iniciando conexión con TrucnksCISCO Bridge en " + WS_URL, "info");

    try {
      socket = new WebSocket(WS_URL);

      socket.onopen = function () {
        setStatus(true, "Conectado (Puerto 7531)");
        log("¡Conexión establecida con TrucnksCISCO Bridge!", "success");
        socket.send(JSON.stringify({
          type: "register",
          client: "cisco-packet-tracer",
          capabilities: ["addDevice", "addLink", "configureIosDevice", "configureTrunkPort", "configureVlan", "getNetwork"]
        }));
      };

      socket.onmessage = function (event) {
        try {
          var data = JSON.parse(event.data);
          handleIncomingRequest(data);
        } catch (err) {
          log("Error analizando mensaje: " + err.message, "error");
        }
      };

      socket.onclose = function () {
        setStatus(false, "Desconectado");
        log("Conexión cerrada. Reintentando en 4 segundos...", "error");
        setTimeout(connect, 4000);
      };

      socket.onerror = function () {
        setStatus(false, "Error de Red");
      };
    } catch (err) {
      log("WebSocket no soportado o error de inicio: " + err.message, "error");
      setTimeout(connect, 5000);
    }
  }

  function handleIncomingRequest(data) {
    if (data.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", time: Date.now() }));
      return;
    }

    if (data.type === "tool_call") {
      toolCount++;
      if ($toolCount) $toolCount.textContent = String(toolCount);

      var toolName = data.tool_name;
      var toolInput = data.tool_input || {};
      var callId = data.tool_call_id;

      log("Ejecutando acción: " + toolName + " | Params: " + JSON.stringify(toolInput), "info");

      var args = [];
      if (toolName === "addDevice") {
        args = [toolInput.deviceName, toolInput.deviceModel, toolInput.x, toolInput.y];
      } else if (toolName === "addLink") {
        args = [toolInput.device1Name, toolInput.device1Interface, toolInput.device2Name, toolInput.device2Interface, toolInput.linkType];
      } else if (toolName === "configureIosDevice") {
        args = [toolInput.deviceName, toolInput.commands];
      } else if (toolName === "configureTrunkPort") {
        args = [toolInput.deviceName, toolInput.interfaceName, toolInput.allowedVlans, toolInput.nativeVlan, toolInput.encapsulation];
      } else if (toolName === "configureVlan") {
        args = [toolInput.deviceName, toolInput.vlanId, toolInput.vlanName];
      } else if (toolName === "getNetwork") {
        args = [];
      } else {
        args = [toolInput];
      }

      var result = executeInPacketTracer(toolName, args);
      var isSuccess = result && result.success !== false;

      log("Resultado [" + toolName + "]: " + (isSuccess ? "Éxito" : "Fallo"), isSuccess ? "success" : "error");

      socket.send(JSON.stringify({
        type: "tool_result",
        tool_call_id: callId,
        tool_name: toolName,
        result: result
      }));
    }
  }

  if ($btnReconnect) {
    $btnReconnect.addEventListener("click", function () {
      if (socket) socket.close();
      connect();
    });
  }

  if ($btnScan) {
    $btnScan.addEventListener("click", function () {
      log("Ejecutando auditoría de topología local...", "info");
      var net = executeInPacketTracer("getNetwork", []);
      log("Dispositivos detectados: " + (net.result ? net.result.deviceCount : 0), "success");
    });
  }

  if ($btnClear) {
    $btnClear.addEventListener("click", function () {
      if ($log) $log.innerHTML = "";
    });
  }

  connect();
})();
