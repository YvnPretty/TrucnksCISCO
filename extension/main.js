// TrucnksCISCO - Packet Tracer Extension Entry Point
function builder() {
  this.m_builderUuid = "";
  this.errors = [];
}

builder.prototype.init = function () {
  try {
    var menu = ipc.appWindow().getMenuBar().getExtensionsPopupMenu();
    this.m_builderUuid = menu.insertItem("", "TrucnksCISCO Automation");
    var menuItem = menu.getMenuItemByUuid(this.m_builderUuid);
    menuItem.registerEvent("onClicked", this, this.menuClicked);
  } catch (err) {
    this.errors.push("Failed to init menu: " + (err ? err.message : String(err)));
  }
};

builder.prototype.cleanUp = function () {
  try {
    var menu = ipc.appWindow().getMenuBar().getExtensionsPopupMenu();
    menu.removeItem(this.m_builderUuid);
  } catch (_) {}
};

builder.prototype.menuClicked = function () {
  if (typeof htmlWindowInstance === "undefined") {
    htmlWindowInstance = new htmlWindow();
  }
  htmlWindowInstance.show();
};

var main = new builder();
main.init();
