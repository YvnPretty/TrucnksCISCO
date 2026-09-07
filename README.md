# TrucnksCISCO 🌐

Herramienta avanzada de gestión, despliegue y automatización de **enlaces troncales (Trunk 802.1Q)**, **VLANs**, **EtherChannel** y **enrutamiento Inter-VLAN** para **Cisco Packet Tracer**, basada en la arquitectura y protocolo de [ph0Void/cisco-magament](https://github.com/ph0Void/cisco-magament).

---

## 🚀 Características Principales

- ⚡ **Generador de Enlaces Troncales IOS**: Sintaxis validada para switches Catalyst (2960, 3560 con encapsulación dot1q, 3650) y routers (RoaS en 2911, 1941).
- 🔄 **Servidor Bridge en Tiempo Real (Puerto 7531)**: Comunicación bidireccional mediante WebSockets nativos RFC 6455 y API REST entre el panel de control y Cisco Packet Tracer sin dependencias externas pesadas.
- 🧩 **Extensión Nativa para Cisco Packet Tracer**: Scripting de extensiones (`extension/`) con HUD integrado para inyectar topologías y comandos IOS en caliente (`addDevice`, `addLink`, `configureIosDevice`, `configureTrunkPort`).
- 🛠️ **CLI y Modo Simulación**: Ejecución independiente de Packet Tracer para previsualizar, auditar y exportar scripts de configuración `.ios`.
- 🔒 **Diseño Seguro**: Aislamiento estricto de secretos y credenciales mediante `.env` y `.gitignore`.

---

## 📂 Estructura del Proyecto

```
TrucnksCISCO/
├── bin/
│   └── trucnks-cisco.js       # CLI principal y ejecutor de la herramienta
├── src/
│   ├── core/
│   │   ├── TrunkEngine.js     # Motor generador de comandos Cisco IOS (Trunks, VLANs, RoaS)
│   │   ├── TopologyBuilder.js # Ensamblado de topologías y llamadas a Packet Tracer
│   │   └── DeviceCatalog.js   # Especificaciones de hardware Cisco (2960, 3560, 2911...)
│   └── server/
│       └── BridgeServer.js    # Servidor WebSocket y REST API en puerto 7531
├── extension/
│   ├── main.js                # Entrada de la extensión para el menú de Packet Tracer
│   ├── window.js              # Gestor de WebView
│   ├── devices.js             # Mapeo de tipos numéricos de dispositivos PT
│   ├── links.js               # Mapeo de tipos de cables (straight, cross, fiber)
│   ├── runcode.js             # Evaluador seguro de IPC
│   ├── userfunctions.js       # Funciones de control de topología en Packet Tracer
│   └── interface/
│       ├── index.html         # Interfaz HUD oscura dentro de Packet Tracer
│       ├── index.css          # Estilos del HUD
│       └── interface.js       # Cliente WebSocket conectando al Bridge
├── scripts/
│   └── sync_github.js         # Utilidad para sincronización con el repo remoto
├── .env.example               # Plantilla de variables de entorno
├── .gitignore                 # Protección contra fugas de credenciales
└── package.json               # Configuración del paquete
```

---

## ⚙️ Uso Rápido

### 1. Iniciar el Servidor Bridge
Inicia el servidor puente en el puerto `7531` para sincronizar con Packet Tracer:
```bash
node bin/trucnks-cisco.js start-bridge
```

Accede al panel web de control en:
`http://127.0.0.1:7531`

### 2. Probar y Validar Configuraciones Troncales
Genera en pantalla las configuraciones para switches L2, L3, EtherChannel y Router-on-a-Stick:
```bash
node bin/trucnks-cisco.js test-trunk
```

### 3. Exportar Topología Completa a Cisco IOS
Genera un script `.ios` listo para copiar y pegar en switches y routers:
```bash
node bin/trucnks-cisco.js export-demo
```
El archivo se guardará en `output/demo_trunk_topology.ios`.

### 4. Auditoría y Comandos de Verificación
Visualiza los comandos clave para diagnosticar el estado de tus troncales:
```bash
node bin/trucnks-cisco.js audit
```

---

## 🔌 Integración con Cisco Packet Tracer

1. Abre **Cisco Packet Tracer** (versión 8 o superior).
2. Ve a la barra superior: **Extensions -> Scripting -> Script Projects PRJ**.
3. Carga los archivos ubicados en la carpeta `extension/` de este proyecto.
4. En el menú superior aparecerá la opción **TrucnksCISCO Automation**. Al hacer clic, se abrirá el HUD que se conectará automáticamente al Bridge (`ws://127.0.0.1:7531`).
5. A partir de ese momento, cualquier comando o topología desplegada desde el Bridge se dibujará y configurará automáticamente en el lienzo de Packet Tracer.

---

## 🔐 Seguridad de Credenciales

> **Aviso Importante**: Nunca guardes contraseñas, tokens de GitHub o credenciales de red en archivos rastreados por Git. Usa siempre el archivo `.env` para almacenar secretos locales y mantén activo el archivo `.gitignore`.
