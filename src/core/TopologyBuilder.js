// TrucnksCISCO - Topology Builder for Cisco Packet Tracer
const { TrunkEngine } = require("./TrunkEngine");
const { DeviceCatalog } = require("./DeviceCatalog");

class TopologyBuilder {
  constructor(name = "Enterprise_Trunk_Topology") {
    this.name = name;
    this.devices = [];
    this.links = [];
    this.configs = new Map(); // deviceName -> IOS commands array
    this.vlans = [];
  }

  addVlan(id, name) {
    this.vlans.push({ id: Number(id), name: String(name) });
    return this;
  }

  addDevice(name, model, x, y) {
    const spec = DeviceCatalog[model] || { model, type: 1, role: "switch" };
    const device = { name, model, x, y, spec };
    this.devices.push(device);
    return this;
  }

  addTrunkLink(dev1Name, dev1Iface, dev2Name, dev2Iface, options = {}) {
    const {
      allowedVlans,
      nativeVlan,
      linkType = "straight", // or cross
      description
    } = options;

    const dev1 = this.devices.find((d) => d.name === dev1Name);
    const dev2 = this.devices.find((d) => d.name === dev2Name);

    if (!dev1 || !dev2) {
      throw new Error(`Device not found in topology: ${dev1Name} or ${dev2Name}`);
    }

    // Register physical link
    this.links.push({
      from: dev1Name,
      fromInterface: dev1Iface,
      to: dev2Name,
      toInterface: dev2Iface,
      linkType,
      isTrunk: true,
      allowedVlans,
      nativeVlan
    });

    // Generate IOS trunk configuration for dev1
    const dev1NeedsEncapsulation = dev1.spec.needsManualEncapsulationCommand;
    const trunk1Cmds = TrunkEngine.generateTrunkConfig({
      interface: dev1Iface,
      allowedVlans,
      nativeVlan,
      needsEncapsulation: dev1NeedsEncapsulation,
      description: description || `Trunk to ${dev2Name} [${dev2Iface}]`
    });
    this.appendConfig(dev1Name, trunk1Cmds);

    // If dev2 is a switch, generate IOS trunk config for dev2
    if (dev2.spec.role.includes("switch")) {
      const dev2NeedsEncapsulation = dev2.spec.needsManualEncapsulationCommand;
      const trunk2Cmds = TrunkEngine.generateTrunkConfig({
        interface: dev2Iface,
        allowedVlans,
        nativeVlan,
        needsEncapsulation: dev2NeedsEncapsulation,
        description: description || `Trunk to ${dev1Name} [${dev1Iface}]`
      });
      this.appendConfig(dev2Name, trunk2Cmds);
    }

    return this;
  }

  addAccessLink(switchName, switchIface, hostName, hostIface, vlanId, options = {}) {
    this.links.push({
      from: switchName,
      fromInterface: switchIface,
      to: hostName,
      toInterface: hostIface,
      linkType: "straight",
      isTrunk: false,
      vlanId
    });

    const accessCmds = TrunkEngine.generateAccessConfig(switchIface, vlanId, {
      description: options.description || `Access port for ${hostName}`,
      enablePortfast: true,
      bpduGuard: true
    });
    this.appendConfig(switchName, accessCmds);

    return this;
  }

  appendConfig(deviceName, commands) {
    if (!this.configs.has(deviceName)) {
      this.configs.set(deviceName, []);
    }
    const current = this.configs.get(deviceName);
    this.configs.set(deviceName, current.concat(commands));
  }

  /**
   * Applies all defined VLANs to all switches in the topology.
   */
  applyVlansToAllSwitches() {
    if (this.vlans.length === 0) return this;
    const vlanCmds = TrunkEngine.generateVlanBatch(this.vlans);

    for (const dev of this.devices) {
      if (dev.spec.role.includes("switch")) {
        this.appendConfig(dev.name, vlanCmds);
      }
    }
    return this;
  }

  /**
   * Generates step-by-step tool calls to inject this entire topology into Packet Tracer.
   * @returns {Array<{tool: string, args: Object}>}
   */
  toPacketTracerToolCalls() {
    const calls = [];

    // 1. Create devices
    for (const dev of this.devices) {
      calls.push({
        tool: "addDevice",
        args: {
          deviceName: dev.name,
          deviceModel: dev.model,
          x: dev.x,
          y: dev.y
        }
      });
    }

    // 2. Create physical cabling links
    for (const link of this.links) {
      calls.push({
        tool: "addLink",
        args: {
          device1Name: link.from,
          device1Interface: link.fromInterface,
          device2Name: link.to,
          device2Interface: link.toInterface,
          linkType: link.linkType
        }
      });
    }

    // 3. Inject IOS configurations
    for (const [deviceName, commands] of this.configs.entries()) {
      calls.push({
        tool: "configureIosDevice",
        args: {
          deviceName,
          commands: commands.join("\n")
        }
      });
    }

    return calls;
  }

  /**
   * Builds a standard reference trunk topology (2 Switches + 1 Router RoaS + 2 PCs).
   */
  static buildStandardTrunkDemo() {
    const topo = new TopologyBuilder("Demo_Trunk_802.1Q");

    // Define VLANs
    topo.addVlan(10, "Sales")
      .addVlan(20, "Engineering")
      .addVlan(99, "Management_Native");

    // Add Devices
    topo.addDevice("Switch_Distribution", "3560-24PS", 350, 150)
      .addDevice("Switch_Access", "2960-24TT", 350, 350)
      .addDevice("Router_Core", "2911", 350, 20)
      .addDevice("PC_Sales", "PC-PT", 200, 480)
      .addDevice("PC_Eng", "PC-PT", 500, 480);

    // Apply VLAN definitions to switches
    topo.applyVlansToAllSwitches();

    // Trunk between Distribution (3560) and Access (2960)
    topo.addTrunkLink(
      "Switch_Distribution",
      "GigabitEthernet0/1",
      "Switch_Access",
      "GigabitEthernet0/1",
      {
        allowedVlans: "10,20,99",
        nativeVlan: 99,
        description: "Trunk Link Dist->Access"
      }
    );

    // Trunk between Router and Distribution Switch (Router-on-a-stick)
    topo.links.push({
      from: "Router_Core",
      fromInterface: "GigabitEthernet0/0",
      to: "Switch_Distribution",
      toInterface: "GigabitEthernet0/2",
      linkType: "straight",
      isTrunk: true
    });

    // Configure switchport trunk on Switch_Distribution G0/2 to router
    topo.appendConfig(
      "Switch_Distribution",
      TrunkEngine.generateTrunkConfig({
        interface: "GigabitEthernet0/2",
        allowedVlans: "10,20,99",
        nativeVlan: 99,
        needsEncapsulation: true,
        description: "Uplink Trunk to Router_Core"
      })
    );

    // Configure RoaS on Router_Core
    topo.appendConfig(
      "Router_Core",
      TrunkEngine.generateRouterOnAStick("GigabitEthernet0/0", [
        { vlan: 10, ip: "192.168.10.1", netmask: "255.255.255.0" },
        { vlan: 20, ip: "192.168.20.1", netmask: "255.255.255.0" },
        { vlan: 99, ip: "192.168.99.1", netmask: "255.255.255.0", isNative: true }
      ])
    );

    // Access ports on Switch_Access
    topo.addAccessLink("Switch_Access", "FastEthernet0/10", "PC_Sales", "FastEthernet0", 10);
    topo.addAccessLink("Switch_Access", "FastEthernet0/20", "PC_Eng", "FastEthernet0", 20);

    return topo;
  }
}

module.exports = { TopologyBuilder };
