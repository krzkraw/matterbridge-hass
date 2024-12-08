import {
  AtLeastOne,
  ClusterClientObj,
  ClusterId,
  ClusterServerObj,
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
} from 'matterbridge';
import { db, debugStringify, idn, ign, nf, rs } from 'matterbridge/logger';

interface MutableDeviceInterface {
  tagList: Semtag[];
  deviceTypes: DeviceTypeDefinition[];
  clusterServersIds: ClusterId[];
  clusterServersObjs: ClusterServerObj[];
  clusterClientsIds: ClusterId[];
  clusterClientsObjs: ClusterClientObj[];
}

export class MutableDevice {
  protected readonly mutableDevice = new Map<string, MutableDeviceInterface>();

  constructor(
    protected readonly _matterbridge: Matterbridge,
    protected readonly _deviceName: string,
    protected readonly _composedType: string | undefined = undefined,
  ) {
    this.initializeEndpoint('');
  }

  // Getters
  get matterbridge(): Matterbridge {
    return this._matterbridge;
  }

  get deviceName(): string {
    return this._deviceName;
  }

  get composedType(): string | undefined {
    return this._composedType;
  }

  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  get(endpoint: string = ''): MutableDeviceInterface {
    return this.mutableDevice.get(endpoint) as MutableDeviceInterface;
  }

  private initializeEndpoint(endpoint: string) {
    if (!this.mutableDevice.has(endpoint)) {
      this.mutableDevice.set(endpoint, {
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

  addClusterServerObjs(endpoint: string, ...clusterServerObj: ClusterServerObj[]) {
    const device = this.initializeEndpoint(endpoint);
    device.clusterServersObjs.push(...clusterServerObj);
  }

  async create() {
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

    // Filter out duplicate clusters and clusters objects on all endpoints
    for (const [endpoint, device] of this.mutableDevice) {
      // Filter out duplicate server clusters and server clusters objects. Remove the cluster server id when a cluster server object is present.
      const deviceClusterServersMap = new Map<ClusterId, ClusterId>();
      device.clusterServersIds.forEach((clusterServer) => {
        deviceClusterServersMap.set(clusterServer, clusterServer);
      });
      const deviceClusterServersObjMap = new Map<ClusterId, ClusterServerObj>();
      device.clusterServersObjs.forEach((clusterServerObj) => {
        deviceClusterServersMap.delete(clusterServerObj.id);
        deviceClusterServersObjMap.set(clusterServerObj.id, clusterServerObj);
      });
      device.clusterServersIds = Array.from(deviceClusterServersMap.values());
      device.clusterServersObjs = Array.from(deviceClusterServersObjMap.values());

      /* Uncomment when they are released
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

      this._matterbridge.log.debug(
        `Device ${idn}${this._deviceName}${rs}${db} endpoint: ${ign}${endpoint === '' ? 'main' : endpoint}${rs}${db} => ` +
          `${nf}tagList: ${debugStringify(device.tagList)} deviceTypes: ${debugStringify(device.deviceTypes)} clusterServersIds: ${debugStringify(device.clusterServersIds)}`,
      );
    }

    // Create the mutable device for the main endpoint
    const mainEndpoint = this.mutableDevice.get('') as MutableDeviceInterface;
    const matterbridgeDevice = await this.createMutableDevice(mainEndpoint.deviceTypes as AtLeastOne<DeviceTypeDefinition>, { uniqueStorageKey: this._deviceName }, true);

    // Add the cluster objects to the main endpoint
    mainEndpoint.clusterServersObjs.forEach((clusterServerObj) => {
      matterbridgeDevice.addClusterServer(clusterServerObj);
    });

    // Add the cluster ids to the main endpoint
    matterbridgeDevice.addClusterServerFromList(matterbridgeDevice, mainEndpoint.clusterServersIds);
    matterbridgeDevice.addRequiredClusterServers(matterbridgeDevice);

    // Add the Fixed Label cluster to the main endpoint
    if (this.composedType) await matterbridgeDevice.addFixedLabel('composed', this.composedType);

    // Create the child endpoints
    for (const [endpoint, device] of this.mutableDevice) {
      if (endpoint === '') continue;
      const child = matterbridgeDevice.addChildDeviceType(endpoint, device.deviceTypes as AtLeastOne<DeviceTypeDefinition>, { tagList: device.tagList }, true);
      device.clusterServersObjs.forEach((clusterServerObj) => {
        child.addClusterServer(clusterServerObj);
      });
      child.addClusterServerFromList(child, device.clusterServersIds);
      child.addRequiredClusterServers(child);
    }
    return matterbridgeDevice;
  }
}
