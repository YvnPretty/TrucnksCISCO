// TrucnksCISCO - Cisco IOS Trunk & VLAN Automation Engine
// Generates, parses, and validates production Cisco IOS commands for Packet Tracer & real switches

class TrunkEngine {
  /**
   * Generates IOS commands to configure a trunk port on a Cisco switch.
   * @param {Object} options
   * @param {string} options.interface - Interface name (e.g. 'GigabitEthernet0/1', 'FastEthernet0/24')
   * @param {string|number[]} [options.allowedVlans] - List or range of allowed VLANs (e.g. '10,20,30' or '10-50')
   * @param {number} [options.nativeVlan] - Native VLAN ID (defaults to 1 or custom)
   * @param {boolean} [options.needsEncapsulation=false] - If true (e.g. 3560/3650), emits dot1q encapsulation first
   * @param {boolean} [options.disableDTP=true] - Emits 'switchport nonegotiate' to secure the trunk
   * @param {string} [options.description] - Interface description
   * @param {boolean} [options.portfastTrunk=false] - Emits spanning-tree portfast trunk
   * @returns {string[]} Array of IOS commands
   */
  static generateTrunkConfig(options) {
    const {
      interface: ifName,
      allowedVlans,
      nativeVlan,
      needsEncapsulation = false,
      disableDTP = true,
      description,
      portfastTrunk = false,
    } = options;

    if (!ifName) {
      throw new Error("Interface name is required for trunk configuration.");
    }

    const commands = [
      "enable",
      "configure terminal",
      `interface ${ifName}`,
    ];

    if (description) {
      commands.push(`description ${description}`);
    }

    // Switches como el Cisco Catalyst 3560 requieren especificar dot1q antes de 'mode trunk'
    if (needsEncapsulation) {
      commands.push("switchport trunk encapsulation dot1q");
    }

    commands.push("switchport mode trunk");

    if (disableDTP) {
      commands.push("switchport nonegotiate");
    }

    if (nativeVlan) {
      commands.push(`switchport trunk native vlan ${nativeVlan}`);
    }

    if (allowedVlans) {
      const allowedStr = Array.isArray(allowedVlans) ? allowedVlans.join(",") : String(allowedVlans);
      commands.push(`switchport trunk allowed vlan ${allowedStr}`);
    }

    if (portfastTrunk) {
      commands.push("spanning-tree portfast trunk");
    }

    commands.push("no shutdown");
    commands.push("exit");
    commands.push("end");
    commands.push("write memory");

    return commands;
  }

  /**
   * Generates IOS commands to configure an access port for a specific VLAN.
   * @param {string} ifName - Interface name
   * @param {number} vlanId - Target VLAN ID
   * @param {Object} [options]
   * @returns {string[]}
   */
  static generateAccessConfig(ifName, vlanId, options = {}) {
    const { description, enablePortfast = true, bpduGuard = true } = options;
    const commands = [
      "enable",
      "configure terminal",
      `interface ${ifName}`,
    ];

    if (description) commands.push(`description ${description}`);
    commands.push("switchport mode access");
    commands.push(`switchport access vlan ${vlanId}`);

    if (enablePortfast) {
      commands.push("spanning-tree portfast");
      if (bpduGuard) {
        commands.push("spanning-tree bpduguard enable");
      }
    }

    commands.push("no shutdown");
    commands.push("exit");
    commands.push("end");
    commands.push("write memory");

    return commands;
  }

  /**
   * Generates VLAN database creation commands.
   * @param {Array<{id: number, name: string}>} vlans - Array of VLANs to create
   * @returns {string[]}
   */
  static generateVlanBatch(vlans) {
    const commands = [
      "enable",
      "configure terminal",
    ];

    for (const v of vlans) {
      commands.push(`vlan ${v.id}`);
      if (v.name) {
        commands.push(`name ${v.name.replace(/\s+/g, "_")}`);
      }
      commands.push("exit");
    }

    commands.push("end");
    commands.push("write memory");
    return commands;
  }

  /**
   * Generates Router-on-a-Stick (RoaS) subinterface trunk configurations for a Cisco Router.
   * @param {string} physicalInterface - e.g. 'GigabitEthernet0/0'
   * @param {Array<{vlan: number, ip: string, netmask: string, isNative?: boolean}>} subinterfaces
   * @returns {string[]}
   */
  static generateRouterOnAStick(physicalInterface, subinterfaces) {
    const commands = [
      "enable",
      "configure terminal",
      `interface ${physicalInterface}`,
      "no ip address",
      "no shutdown",
      "exit",
    ];

    for (const sub of subinterfaces) {
      const subIfName = `${physicalInterface}.${sub.vlan}`;
      commands.push(`interface ${subIfName}`);
      if (sub.isNative) {
        commands.push(`encapsulation dot1Q ${sub.vlan} native`);
      } else {
        commands.push(`encapsulation dot1Q ${sub.vlan}`);
      }
      commands.push(`ip address ${sub.ip} ${sub.netmask}`);
      commands.push("no shutdown");
      commands.push("exit");
    }

    commands.push("end");
    commands.push("write memory");
    return commands;
  }

  /**
   * Generates Multilayer Switch Inter-VLAN Routing (SVI) configuration.
   * @param {Array<{vlan: number, ip: string, netmask: string}>} svis
   * @returns {string[]}
   */
  static generateMultilayerSwitchSvi(svis) {
    const commands = [
      "enable",
      "configure terminal",
      "ip routing",
    ];

    for (const svi of svis) {
      commands.push(`interface Vlan${svi.vlan}`);
      commands.push(`ip address ${svi.ip} ${svi.netmask}`);
      commands.push("no shutdown");
      commands.push("exit");
    }

    commands.push("end");
    commands.push("write memory");
    return commands;
  }

  /**
   * Generates EtherChannel / LACP Trunk bundle configuration.
   * @param {number} channelNumber - Port-Channel ID (e.g. 1)
   * @param {string[]} physicalInterfaces - Array of interfaces (e.g. ['FastEthernet0/1', 'FastEthernet0/2'])
   * @param {Object} trunkOptions - Allowed VLANs, native VLAN, etc.
   * @returns {string[]}
   */
  static generateEtherChannelTrunk(channelNumber, physicalInterfaces, trunkOptions = {}) {
    const commands = [
      "enable",
      "configure terminal",
    ];

    for (const iface of physicalInterfaces) {
      commands.push(`interface ${iface}`);
      commands.push(`channel-group ${channelNumber} mode active`);
      commands.push("exit");
    }

    commands.push(`interface Port-channel ${channelNumber}`);
    if (trunkOptions.needsEncapsulation) {
      commands.push("switchport trunk encapsulation dot1q");
    }
    commands.push("switchport mode trunk");
    if (trunkOptions.allowedVlans) {
      commands.push(`switchport trunk allowed vlan ${trunkOptions.allowedVlans}`);
    }
    if (trunkOptions.nativeVlan) {
      commands.push(`switchport trunk native vlan ${trunkOptions.nativeVlan}`);
    }
    commands.push("no shutdown");
    commands.push("exit");
    commands.push("end");
    commands.push("write memory");

    return commands;
  }

  /**
   * Returns standard Cisco IOS audit and verification commands.
   * @returns {string[]}
   */
  static getAuditCommands() {
    return [
      "show interfaces trunk",
      "show vlan brief",
      "show interfaces switchport",
      "show etherchannel summary",
      "show ip interface brief",
    ];
  }
}

module.exports = { TrunkEngine };
