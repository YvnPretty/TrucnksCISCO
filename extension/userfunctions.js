// TrucnksCISCO - Packet Tracer IPC Automation Engine
// Designed for Cisco Packet Tracer 8.x / 9.x Scripting Environment

function fail(prefix, err) {
  var msg = (err && (err.message || String(err))) || "unknown error";
  return { success: false, error: prefix ? prefix + ": " + msg : msg };
}

addDevice = function (deviceName, deviceModel, x, y) {
  try {
    var deviceType = allDeviceTypes[deviceModel];
    if (deviceType === undefined) {
      return {
        success: false,
        error: "Unknown device model: " + deviceModel
      };
    }

    var workspace = ipc.appWindow().getActiveWorkspace().getLogicalWorkspace();
    var originalDeviceName = workspace.addDevice(deviceType, deviceModel, x || 100, y || 100);

    if (!originalDeviceName) {
      return {
        success: false,
        error: "Failed to add device " + deviceName + " (" + deviceModel + ")"
      };
    }

    var device = ipc.network().getDevice(originalDeviceName);
    if (device) {
      device.setName(deviceName);
      if (deviceType <= 1 || deviceType === 16) {
        device.skipBoot();
      }
    }

    return {
      success: true,
      message: "Device " + deviceName + " added successfully",
      deviceName: deviceName,
      model: deviceModel
    };
  } catch (error) {
    return fail("Error adding device", error);
  }
};

addLink = function (device1Name, device1Interface, device2Name, device2Interface, linkType) {
  try {
    var linkTypeValue = allLinkTypes[linkType] !== undefined ? allLinkTypes[linkType] : 8100;

    var result = ipc
      .appWindow()
      .getActiveWorkspace()
      .getLogicalWorkspace()
      .createLink(
        device1Name,
        device1Interface,
        device2Name,
        device2Interface,
        linkTypeValue
      );

    if (result !== true) {
      return {
        success: false,
        error: "Failed to create link between " + device1Name + ":" + device1Interface + " and " + device2Name + ":" + device2Interface
      };
    }

    return {
      success: true,
      message: "Link created between " + device1Name + ":" + device1Interface + " and " + device2Name + ":" + device2Interface
    };
  } catch (error) {
    return fail("Error creating link", error);
  }
};

configureIosDevice = function (deviceName, commands) {
  try {
    var device = ipc.network().getDevice(deviceName);
    if (!device) {
      return {
        success: false,
        error: "Device " + deviceName + " not found"
      };
    }

    device.skipBoot();
    var commandsArray = Array.isArray(commands) ? commands : String(commands).split("\n");
    device.enterCommand("!", "global");

    var executedCount = 0;
    for (var c = 0; c < commandsArray.length; c++) {
      var cmd = commandsArray[c].trim();
      if (cmd && !cmd.startsWith("!")) {
        device.enterCommand(cmd, "");
        executedCount++;
      }
    }

    device.enterCommand("write memory", "enable");

    return {
      success: true,
      message: "Configuration applied to " + deviceName + " (" + executedCount + " commands executed)",
      commandsCount: executedCount
    };
  } catch (error) {
    return fail("Error configuring IOS device " + deviceName, error);
  }
};

configureTrunkPort = function (deviceName, interfaceName, allowedVlans, nativeVlan, encapsulation) {
  try {
    var cmds = [
      "enable",
      "configure terminal",
      "interface " + interfaceName
    ];

    if (encapsulation) {
      cmds.push("switchport trunk encapsulation " + encapsulation);
    }
    cmds.push("switchport mode trunk");
    cmds.push("switchport nonegotiate");

    if (nativeVlan) {
      cmds.push("switchport trunk native vlan " + nativeVlan);
    }
    if (allowedVlans) {
      cmds.push("switchport trunk allowed vlan " + allowedVlans);
    }
    cmds.push("no shutdown");
    cmds.push("end");
    cmds.push("write memory");

    return configureIosDevice(deviceName, cmds.join("\n"));
  } catch (error) {
    return fail("Error configuring trunk on " + deviceName, error);
  }
};

configureVlan = function (deviceName, vlanId, vlanName) {
  try {
    var cmds = [
      "enable",
      "configure terminal",
      "vlan " + vlanId
    ];
    if (vlanName) {
      cmds.push("name " + vlanName);
    }
    cmds.push("exit");
    cmds.push("end");
    cmds.push("write memory");

    return configureIosDevice(deviceName, cmds.join("\n"));
  } catch (error) {
    return fail("Error configuring VLAN on " + deviceName, error);
  }
};

configurePcIp = function (deviceName, dhcpEnabled, ipaddress, subnetMask, defaultGateway, dnsServer) {
  try {
    var device = ipc.network().getDevice(deviceName);
    if (!device) {
      return { success: false, error: "Device " + deviceName + " not found" };
    }

    var port = device.getPort("FastEthernet0");
    if (!port) {
      return { success: false, error: "FastEthernet0 port not found on " + deviceName };
    }

    if (dhcpEnabled !== undefined && dhcpEnabled !== null) {
      device.setDhcpFlag(dhcpEnabled);
    }
    if (ipaddress && subnetMask) port.setIpSubnetMask(ipaddress, subnetMask);
    if (defaultGateway) port.setDefaultGateway(defaultGateway);
    if (dnsServer) port.setDnsServerIp(dnsServer);

    return {
      success: true,
      message: "IP configuration applied to " + deviceName
    };
  } catch (error) {
    return fail("Error configuring PC IP", error);
  }
};

getNetwork = function () {
  try {
    var deviceCount = ipc.network().getDeviceCount();
    var devices = [];
    var connections = [];

    var inUseSet = {};
    var linkCount = ipc.network().getLinkCount();
    for (var li = 0; li < linkCount; li++) {
      var link = ipc.network().getLinkAt(li);
      if (link) {
        var p1 = link.getPort1();
        var p2 = link.getPort2();
        if (p1) inUseSet[p1.getName()] = true;
        if (p2) inUseSet[p2.getName()] = true;
      }
    }

    var portOwner = {};
    for (var i = 0; i < deviceCount; i++) {
      var device = ipc.network().getDeviceAt(i);
      if (!device) continue;
      var devName = device.getName();

      var interfaces = [];
      var portCount = device.getPortCount();
      for (var j = 0; j < portCount; j++) {
        var port = device.getPortAt(j);
        if (port) {
          var pname = port.getName();
          portOwner[pname] = devName;
          interfaces.push({
            name: pname,
            in_use: inUseSet[pname] === true
          });
        }
      }

      devices.push({
        name: devName,
        model: device.getModel ? device.getModel() : "Unknown",
        type: device.getType ? device.getType() : -1,
        interfaces: interfaces
      });
    }

    for (var k = 0; k < linkCount; k++) {
      var lnk = ipc.network().getLinkAt(k);
      if (!lnk) continue;

      var port1 = lnk.getPort1();
      var port2 = lnk.getPort2();
      if (!port1 || !port2) continue;

      var p1Name = port1.getName();
      var p2Name = port2.getName();

      var dev1 = portOwner[p1Name] || "";
      var dev2 = portOwner[p2Name] || "";

      if (dev1 && dev2) {
        connections.push({
          from: dev1,
          fromInterface: p1Name,
          to: dev2,
          toInterface: p2Name,
          type: lnk.getConnectionType ? lnk.getConnectionType() : 8100
        });
      }
    }

    return {
      success: true,
      result: {
        deviceCount: devices.length,
        connectionCount: connections.length,
        devices: devices,
        connections: connections
      }
    };
  } catch (error) {
    return fail("Error inspecting network", error);
  }
};

removeDevice = function (deviceNames) {
  try {
    var list = Array.isArray(deviceNames) ? deviceNames : [deviceNames];
    var workspace = ipc.appWindow().getActiveWorkspace().getLogicalWorkspace();
    var successCount = 0;

    for (var i = 0; i < list.length; i++) {
      var dname = list[i];
      if (workspace.removeDevice(dname) === true) {
        successCount++;
      }
    }

    return {
      success: true,
      message: "Removed " + successCount + " of " + list.length + " devices",
      removedCount: successCount
    };
  } catch (error) {
    return fail("Error removing devices", error);
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    addDevice,
    addLink,
    configureIosDevice,
    configureTrunkPort,
    configureVlan,
    configurePcIp,
    getNetwork,
    removeDevice
  };
}
