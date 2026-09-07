// TrucnksCISCO - WebView Window Manager for Packet Tracer
function htmlWindow() {
  this.webviewId = "TrucnksCISCO_WebView";
  this.webview = null;
}

htmlWindow.prototype.cleanUp = function () {
  if (this.webview) {
    this.webview.unregisterEvent("closed", this, this.windowClosed);
  }
};

htmlWindow.prototype.show = function () {
  try {
    if (webViewManager.getWebView(this.webviewId) == null) {
      this.webview = webViewManager.createWebView(
        "TrucnksCISCO - Trunk & VLAN Automation",
        "theInterface",
        false,
        520,
        640,
        false
      );
      this.webview.registerEvent("closed", this, this.windowClosed);
    }
    this.webview.show();
  } catch (e) {
    // Fallback if webViewManager not initialized
  }
};

htmlWindow.prototype.windowClosed = function () {
  this.cleanUp();
};

var htmlWindowInstance = new htmlWindow();
