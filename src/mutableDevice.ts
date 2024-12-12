/**
 * This file contains the class MutableDevice.
 *
 * @file src\mutableDevice.ts
 * @author Luca Liguori
 * @date 2024-12-08
 * @version 0.0.1
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. *
 */

import { createHash, randomBytes } from 'crypto';
import {
  AtLeastOne,
  BridgedDeviceBasicInformationCluster,
  ClusterClientObj,
  ClusterId,
  ClusterRegistry,
  ClusterServer,
  ClusterServerObj,
  ClusterType,
  colorTemperatureLight,
  colorTemperatureSwitch,
  DeviceTypeDefinition,
  dimmableLight,
  dimmableOutlet,
  dimmableSwitch,
  EndpointOptions,
  Matterbridge,
  MatterbridgeDevice,
  MatterbridgeEndpoint,
  onOffLight,
  onOffOutlet,
  onOffSwitch,
  Semtag,
  VendorId,
} from 'matterbridge';
import { db, debugStringify, idn, ign, rs } from 'matterbridge/logger';
import { CYAN } from 'node-ansi-logger';

interface MutableDeviceInterface {
  endpoint?: MatterbridgeDevice;
  friendlyName: string;
  tagList: Semtag[];
  deviceTypes: DeviceTypeDefinition[];
  clusterServersIds: ClusterId[];
  clusterServersObjs: ClusterServerObj<ClusterType>[];
  clusterClientsIds: ClusterId[];
  clusterClientsObjs: ClusterClientObj<ClusterType>[];
}

export class MutableDevice {
  protected readonly mutableDevice = new Map<string, MutableDeviceInterface>();
  protected readonly matterbridge: Matterbridge;

  deviceName: string;
  serialNumber: string;
  vendorId: VendorId;
  vendorName: string;
  productName: string;
  softwareVersion: number;
  softwareVersionString: string;
  hardwareVersion: number;
  hardwareVersionString: string;

  composedType: string | undefined = undefined;

  constructor(
    matterbridge: Matterbridge,
    deviceName: string,
    serialNumber?: string,
    vendorId = 0xfff1,
    vendorName = 'Matterbridge',
    productName = 'Matterbridge Device',
    softwareVersion?: number,
    softwareVersionString?: string,
    hardwareVersion?: number,
    hardwareVersionString?: string,
  ) {
    this.matterbridge = matterbridge;
    this.deviceName = deviceName;
    this.serialNumber = serialNumber ?? '0x' + randomBytes(8).toString('hex');
    this.vendorId = VendorId(vendorId);
    this.vendorName = vendorName;
    this.productName = productName;
    this.softwareVersion = softwareVersion ?? parseInt(matterbridge.matterbridgeVersion.replace(/\D/g, ''));
    this.softwareVersionString = softwareVersionString ?? matterbridge.matterbridgeVersion;
    this.hardwareVersion = hardwareVersion ?? parseInt(this.matterbridge.systemInformation.nodeVersion.replace(/\D/g, ''));
    this.hardwareVersionString = hardwareVersionString ?? this.matterbridge.systemInformation.nodeVersion;
    this.initializeEndpoint('');
  }

  has(endpoint: string): boolean {
    return this.mutableDevice.has(endpoint);
  }

  get(endpoint = ''): MutableDeviceInterface {
    if (this.mutableDevice.get(endpoint) === undefined) throw new Error(`Device ${endpoint} is not defined`);
    return this.mutableDevice.get(endpoint) as MutableDeviceInterface;
  }

  getEndpoint(endpoint = ''): MatterbridgeDevice {
    if (this.mutableDevice.get(endpoint)?.endpoint === undefined) throw new Error(`Device ${endpoint} endpoint is not defined`);
    return this.mutableDevice.get(endpoint)?.endpoint as MatterbridgeDevice;
  }

  private initializeEndpoint(endpoint: string) {
    if (!this.mutableDevice.has(endpoint)) {
      this.mutableDevice.set(endpoint, {
        friendlyName: endpoint,
        tagList: [],
        deviceTypes: [],
        clusterServersIds: [],
        clusterServersObjs: [],
        clusterClientsIds: [],
        clusterClientsObjs: [],
      });
    }
    return this.mutableDevice.get(endpoint) as MutableDeviceInterface;
  }

  private async createMutableDevice(
    definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>,
    options: EndpointOptions = {},
    debug = false,
  ): Promise<MatterbridgeDevice> {
    let device: MatterbridgeDevice;
    if (this.matterbridge.edge === true) device = new MatterbridgeEndpoint(definition, options, debug) as unknown as MatterbridgeDevice;
    else device = new MatterbridgeDevice(definition, options, debug);
    return device;
  }

  setFriendlyName(endpoint: string, friendlyName: string) {
    const device = this.initializeEndpoint(endpoint);
    device.friendlyName = friendlyName;
  }

  addTagLists(endpoint: string, ...tagList: Semtag[]) {
    const device = this.initializeEndpoint(endpoint);
    device.tagList.push(...tagList);
  }

  addDeviceTypes(endpoint: string, ...deviceTypes: DeviceTypeDefinition[]) {
    const device = this.initializeEndpoint(endpoint);
    device.deviceTypes.push(...deviceTypes);
  }

  addClusterServerIds(endpoint: string, ...clusterServerIds: ClusterId[]) {
    const device = this.initializeEndpoint(endpoint);
    device.clusterServersIds.push(...clusterServerIds);
  }

  addClusterServerObjs(endpoint: string, ...clusterServerObj: ClusterServerObj<ClusterType>[]) {
    const device = this.initializeEndpoint(endpoint);
    device.clusterServersObjs.push(...clusterServerObj);
  }

  private createUniqueId(param1: string, param2: string, param3: string, param4: string) {
    const hash = createHash('md5');
    hash.update(param1 + param2 + param3 + param4);
    return hash.digest('hex');
  }

  addBridgedDeviceBasicInformationClusterServer() {
    const device = this.getEndpoint('');
    device.log.logName = this.deviceName;
    device.deviceName = this.deviceName;
    device.serialNumber = this.serialNumber;
    device.uniqueId = this.createUniqueId(this.deviceName, this.serialNumber, this.vendorName, this.productName);
    device.productId = undefined;
    device.productName = this.productName;
    device.vendorId = this.vendorId;
    device.vendorName = this.vendorName;
    device.softwareVersion = this.softwareVersion;
    device.softwareVersionString = this.softwareVersionString;
    device.hardwareVersion = this.hardwareVersion;
    device.hardwareVersionString = this.hardwareVersionString;

    this.addClusterServerObjs(
      '',
      ClusterServer(
        BridgedDeviceBasicInformationCluster,
        {
          vendorId: this.vendorId,
          vendorName: this.vendorName.slice(0, 32),
          productName: this.productName.slice(0, 32),
          productLabel: this.deviceName.slice(0, 64),
          nodeLabel: this.deviceName.slice(0, 32),
          serialNumber: this.serialNumber.slice(0, 32),
          uniqueId: this.createUniqueId(this.deviceName, this.serialNumber, this.vendorName, this.productName),
          softwareVersion: this.softwareVersion,
          softwareVersionString: this.softwareVersionString.slice(0, 64),
          hardwareVersion: this.hardwareVersion,
          hardwareVersionString: this.hardwareVersionString.slice(0, 64),
          reachable: true,
        },
        {},
        {
          startUp: true,
          shutDown: true,
          leave: true,
          reachableChanged: true,
        },
      ) as unknown as ClusterServerObj,
    );
  }

  async create() {
    await this.createMainEndpoint();
    await this.createChildEndpoints();
    await this.createClusters();
    const mainDevice = this.mutableDevice.get('') as MutableDeviceInterface;
    return mainDevice.endpoint as MatterbridgeDevice;
  }

  private removeDuplicateAndSupersetDeviceTypes() {
    // Remove duplicates and superset device types on all endpoints
    for (const device of this.mutableDevice.values()) {
      const deviceTypesMap = new Map<number, DeviceTypeDefinition>();
      device.deviceTypes.forEach((deviceType) => {
        deviceTypesMap.set(deviceType.code, deviceType);
      });
      if (deviceTypesMap.has(onOffSwitch.code) && deviceTypesMap.has(dimmableSwitch.code)) deviceTypesMap.delete(onOffSwitch.code);
      if (deviceTypesMap.has(dimmableSwitch.code) && deviceTypesMap.has(colorTemperatureSwitch.code)) deviceTypesMap.delete(dimmableSwitch.code);
      if (deviceTypesMap.has(onOffOutlet.code) && deviceTypesMap.has(dimmableOutlet.code)) deviceTypesMap.delete(onOffOutlet.code);
      if (deviceTypesMap.has(onOffLight.code) && deviceTypesMap.has(dimmableLight.code)) deviceTypesMap.delete(onOffLight.code);
      if (deviceTypesMap.has(dimmableLight.code) && deviceTypesMap.has(colorTemperatureLight.code)) deviceTypesMap.delete(dimmableLight.code);
      device.deviceTypes = Array.from(deviceTypesMap.values());
    }
  }

  async createMainEndpoint() {
    // Remove duplicates and superset device types on all endpoints
    this.removeDuplicateAndSupersetDeviceTypes();

    // Create the mutable device for the main endpoint
    const mainDevice = this.mutableDevice.get('') as MutableDeviceInterface;
    mainDevice.friendlyName = this.deviceName;
    mainDevice.endpoint = await this.createMutableDevice(mainDevice.deviceTypes as AtLeastOne<DeviceTypeDefinition>, { uniqueStorageKey: this.deviceName }, true);
    mainDevice.endpoint.log.logName = this.deviceName;
    return mainDevice.endpoint;
  }

  async createChildEndpoint(endpoint: string) {
    // Remove duplicates and superset device types on all endpoints
    this.removeDuplicateAndSupersetDeviceTypes();

    // Get the main endpoint
    const mainDevice = this.mutableDevice.get('') as MutableDeviceInterface;
    if (!mainDevice.endpoint) throw new Error('Main endpoint is not defined. Call createMainEndpoint() first.');

    // Create the child endpoint
    const device = this.mutableDevice.get(endpoint) as MutableDeviceInterface;
    if (!device) throw new Error(`Device ${endpoint} is not defined.`);
    device.endpoint = mainDevice.endpoint.addChildDeviceType(
      endpoint,
      device.deviceTypes as AtLeastOne<DeviceTypeDefinition>,
      device.tagList.length ? { tagList: device.tagList } : {},
      true,
    );
    device.endpoint.log.logName = device.friendlyName;
    return device.endpoint;
  }

  async createChildEndpoints() {
    // Remove duplicates and superset device types on all endpoints
    this.removeDuplicateAndSupersetDeviceTypes();

    // Get the main endpoint
    const mainDevice = this.mutableDevice.get('') as MutableDeviceInterface;
    if (!mainDevice.endpoint) throw new Error('Main endpoint is not defined. Call createMainEndpoint() first.');

    // Create the child endpoints
    for (const [endpoint, device] of this.mutableDevice.entries().filter(([endpoint]) => endpoint !== '')) {
      device.endpoint = mainDevice.endpoint.addChildDeviceType(
        endpoint,
        device.deviceTypes as AtLeastOne<DeviceTypeDefinition>,
        device.tagList.length ? { tagList: device.tagList } : {},
        true,
      );
    }
    return this;
  }

  private removeDuplicateClusterServers() {
    // Filter out duplicate clusters and clusters objects on all endpoints
    for (const device of this.mutableDevice.values()) {
      // Filter out duplicate server clusters and server clusters objects. Remove the cluster server id when a cluster server object is present.
      const deviceClusterServersIdMap = new Map<ClusterId, ClusterId>();
      device.clusterServersIds.forEach((clusterServerId) => {
        deviceClusterServersIdMap.set(clusterServerId, clusterServerId);
      });
      const deviceClusterServersObjMap = new Map<ClusterId, ClusterServerObj>();
      device.clusterServersObjs.forEach((clusterServerObj) => {
        deviceClusterServersIdMap.delete(clusterServerObj.id);
        deviceClusterServersObjMap.set(clusterServerObj.id, clusterServerObj);
      });
      device.clusterServersIds = Array.from(deviceClusterServersIdMap.values());
      device.clusterServersObjs = Array.from(deviceClusterServersObjMap.values());

      // TODO: Uncomment when they are released in matter.js
      /*
      // Filter out duplicate client clusters and client clusters objects. Remove the cluster client id when a cluster client object is present.
      const deviceClusterClientsMap = new Map<ClusterId, ClusterId>();
      device.clusterClientsIds.forEach((clusterClient) => {
        deviceClusterClientsMap.set(clusterClient, clusterClient);
      });
      const deviceClusterClientsObjMap = new Map<ClusterId, ClusterClientObj>();
      device.clusterClientsObjs.forEach((clusterClientObj) => {
        deviceClusterClientsMap.delete(clusterClientObj.id);
        deviceClusterClientsObjMap.set(clusterClientObj.id, clusterClientObj);
      });
      device.clusterClientsIds = Array.from(deviceClusterClientsMap.values());
      device.clusterClientsObjs = Array.from(deviceClusterClientsObjMap.values());
      */
    }
  }

  async createClusters() {
    // Filter out duplicate clusters and clusters objects on all endpoints
    this.removeDuplicateClusterServers();

    // Get the main endpoint
    const mainDevice = this.mutableDevice.get('') as MutableDeviceInterface;
    if (!mainDevice.endpoint) throw new Error('Main endpoint is not defined');

    // Add the cluster objects to the main endpoint
    this.addBridgedDeviceBasicInformationClusterServer();
    for (const clusterServerObj of mainDevice.clusterServersObjs) {
      mainDevice.endpoint.addClusterServer(clusterServerObj);
    }

    // Add the cluster ids to the main endpoint
    mainDevice.endpoint.addClusterServerFromList(mainDevice.endpoint, mainDevice.clusterServersIds);
    mainDevice.endpoint.addRequiredClusterServers(mainDevice.endpoint);

    // Add the Fixed Label cluster to the main endpoint
    if (this.composedType) await mainDevice.endpoint.addFixedLabel('composed', this.composedType);

    // Add clusters to the child endpoints
    for (const [endpoint, device] of this.mutableDevice) {
      if (endpoint === '') continue;
      if (!device.endpoint) throw new Error('Child endpoint is not defined');
      for (const clusterServerObj of device.clusterServersObjs) {
        device.endpoint.addClusterServer(clusterServerObj);
      }
      device.endpoint.addClusterServerFromList(device.endpoint, device.clusterServersIds);
      device.endpoint.addRequiredClusterServers(device.endpoint);
    }
    return this;
  }

  logMutableDevice() {
    this.matterbridge.log.debug(
      `Device ${idn}${this.deviceName}${rs}${db} serial number ${CYAN}${this.serialNumber}${rs}${db} vendor id ${CYAN}${this.vendorId}${rs}${db} ` +
        `vendor name ${CYAN}${this.vendorName}${rs}${db} product name ${CYAN}${this.productName}${rs}${db} software version ${CYAN}${this.softwareVersion}${rs}${db} ` +
        `software version string ${CYAN}${this.softwareVersionString}${rs}${db} hardware version ${CYAN}${this.hardwareVersion}${rs}${db} hardware version string ${CYAN}${this.hardwareVersionString}`,
    );
    for (const [endpoint, device] of this.mutableDevice) {
      const deviceTypes = device.deviceTypes.map((d) => '0x' + d.code.toString(16) + '-' + d.name);
      const clusterServersIds = device.clusterServersIds.map((clusterServerId) => '0x' + clusterServerId.toString(16) + '-' + ClusterRegistry.get(clusterServerId)?.name);
      const clusterServersObjsIds = device.clusterServersObjs.map(
        (clusterServerObj) => '0x' + clusterServerObj.id.toString(16) + '-' + ClusterRegistry.get(clusterServerObj.id)?.name,
      );
      this.matterbridge.log.debug(
        `- endpoint: ${ign}${endpoint === '' ? 'main' : endpoint}${rs}${db} => friendlyName ${CYAN}${device.friendlyName}${db} ` +
          `${db}tagList: ${debugStringify(device.tagList)}${db} deviceTypes: ${debugStringify(deviceTypes)}${db} ` +
          `clusterServersIds: ${debugStringify(clusterServersIds)}${db} clusterServersObjs: ${debugStringify(clusterServersObjsIds)}${db}`,
      );
    }
    return this;
  }
}
