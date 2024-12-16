/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Matterbridge,
  Semtag,
  DeviceTypeDefinition,
  ClusterId,
  ClusterServerObj,
  ClusterClientObj,
  MatterbridgeDevice,
  MatterbridgeEndpoint,
  bridgedNode,
  powerSource,
  electricalSensor,
  PowerSourceCluster,
  BridgedDeviceBasicInformationCluster,
  onOffOutlet,
  OnOffCluster,
  onOffLight,
  dimmableLight,
  colorTemperatureLight,
  onOffSwitch,
  dimmableSwitch,
  dimmableOutlet,
  colorTemperatureSwitch,
  IdentifyCluster,
  GroupsCluster,
  LevelControlCluster,
  ColorControlCluster,
  DescriptorCluster,
  FixedLabelCluster,
  temperatureSensor,
} from 'matterbridge';
import { MutableDevice } from './mutableDevice';
import { jest } from '@jest/globals';
import { AnsiLogger } from 'matterbridge/logger';

describe('MutableDevice', () => {
  const mockLog = {
    fatal: jest.fn((message: string, ...parameters: any[]) => {
      // console.error('mockLog.fatal', message, parameters);
    }),
    error: jest.fn((message: string, ...parameters: any[]) => {
      // console.error('mockLog.error', message, parameters);
    }),
    warn: jest.fn((message: string, ...parameters: any[]) => {
      // console.error('mockLog.warn', message, parameters);
    }),
    notice: jest.fn((message: string, ...parameters: any[]) => {
      // console.error('mockLog.notice', message, parameters);
    }),
    info: jest.fn((message: string, ...parameters: any[]) => {
      // console.error('mockLog.info', message, parameters);
    }),
    debug: jest.fn((message: string, ...parameters: any[]) => {
      // console.error('mockLog.debug', message, parameters);
    }),
  } as unknown as AnsiLogger;

  const mockMatterbridge = {
    addBridgedDevice: jest.fn(async (pluginName: string, device: MatterbridgeDevice) => {
      // console.error('addBridgedDevice called');
    }),
    addBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {
      device.number = 100;
      // console.error('addBridgedEndpoint called');
    }),
    removeBridgedDevice: jest.fn(async (pluginName: string, device: MatterbridgeDevice) => {
      // console.error('removeBridgedDevice called');
    }),
    removeBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {
      // console.error('removeBridgedEndpoint called');
    }),
    removeAllBridgedDevices: jest.fn(async (pluginName: string) => {
      // console.error('removeAllBridgedDevices called');
    }),
    removeAllBridgedEndpoints: jest.fn(async (pluginName: string) => {
      // console.error('removeAllBridgedEndpoints called');
    }),
    edge: false,
    log: mockLog,
    matterbridgeDirectory: '',
    matterbridgePluginDirectory: 'temp',
    systemInformation: { ipv4Address: '192.168.1.100', osRelease: 'xx.xx.xx.xx.xx.xx', nodeVersion: '22.1.10' },
    matterbridgeVersion: '1.6.5',
  } as unknown as Matterbridge;

  beforeAll(() => {
    //
  });

  it('should initialize with an empty mutableDevice', () => {
    const mutableDevice = new MutableDevice(mockMatterbridge, 'Test Device');
    expect(mutableDevice).toBeInstanceOf(MutableDevice);
    expect((mutableDevice as any).matterbridge).toBe(mockMatterbridge);
    expect(mutableDevice.deviceName).toBe('Test Device');
    expect(mutableDevice.composedType).toBeUndefined();
  });

  it('should throw error', async () => {
    const mutableDevice = new MutableDevice(mockMatterbridge, 'Test Device');
    expect(mutableDevice).toBeInstanceOf(MutableDevice);
    expect(() => mutableDevice.get('none')).toThrow();
    expect(() => mutableDevice.getEndpoint()).toThrow();
    await expect(mutableDevice.createChildEndpoint('none')).rejects.toThrow();
    mutableDevice.addDeviceTypes('', bridgedNode);
    expect(mutableDevice.has('')).toBeTruthy();
    mutableDevice.addDeviceTypes('child1', onOffSwitch, dimmableSwitch, colorTemperatureSwitch);
    expect(mutableDevice.has('child1')).toBeTruthy();
    expect(mutableDevice.setFriendlyName('child1', 'Child')).toBe(mutableDevice);
    await expect(mutableDevice.createChildEndpoints()).rejects.toThrow();
    await expect(mutableDevice.createClusters('')).rejects.toThrow();
    await mutableDevice.createMainEndpoint();
    await expect(mutableDevice.createChildEndpoint('none')).rejects.toThrow();
    expect(mutableDevice.getEndpoint()).toBeDefined();
    // await expect(mutableDevice.createClusters('')).rejects.toThrow();
    mutableDevice.addDeviceTypes('one', temperatureSensor);
    expect(await mutableDevice.createChildEndpoint('one')).toBeDefined();
    mutableDevice.addDeviceTypes('two', temperatureSensor);
    mutableDevice.addTagLists('two', { mfgCode: null, namespaceId: 1, tag: 1, label: 'Test' });
    await expect(mutableDevice.createClusters('two')).rejects.toThrow();
    expect(await mutableDevice.createChildEndpoint('two')).toBeDefined();
  });

  it('should create a mutableDevice', async () => {
    mockMatterbridge.edge = false;
    const mutableDevice = new MutableDevice(mockMatterbridge, 'Test Device');
    expect(mutableDevice).toBeInstanceOf(MutableDevice);
    expect((mutableDevice as any).matterbridge).toBe(mockMatterbridge);
    expect(mutableDevice.deviceName).toBe('Test Device');
    expect(mutableDevice.composedType).toBeUndefined();

    mutableDevice.addDeviceTypes('', bridgedNode);
    const device = await mutableDevice.create();
    expect(device).toBeDefined();
    expect(device).toBeInstanceOf(MatterbridgeDevice);
    mockMatterbridge.edge = false;
  });

  it('should create a mutableDevice on edge', async () => {
    mockMatterbridge.edge = true;
    const mutableDevice = new MutableDevice(mockMatterbridge, 'Test Device');
    expect(mutableDevice).toBeInstanceOf(MutableDevice);
    expect((mutableDevice as any).matterbridge).toBe(mockMatterbridge);
    expect(mutableDevice.deviceName).toBe('Test Device');
    expect(mutableDevice.composedType).toBeUndefined();

    mutableDevice.addDeviceTypes('', bridgedNode);
    const device = await mutableDevice.create();
    expect(device).toBeDefined();
    expect(device).toBeInstanceOf(MatterbridgeEndpoint);
    mockMatterbridge.edge = false;
  });

  it('should add a BridgedDeviceBasicInformationCluster', async () => {
    const mutableDevice = new MutableDevice(mockMatterbridge, 'Test Device');
    mutableDevice.addDeviceTypes('', bridgedNode);
    await mutableDevice.createMainEndpoint();
    mutableDevice.addBridgedDeviceBasicInformationClusterServer();

    // expect(mutableDevice.has('')).toBeTruthy();
    expect(mutableDevice.get()).toBeDefined();
    expect(mutableDevice.get().tagList).toHaveLength(0);
  });

  it('should add a tagList', () => {
    const mutableDevice = new MutableDevice(mockMatterbridge, 'Test Device');
    mutableDevice.addTagLists('', { mfgCode: null, namespaceId: 1, tag: 1, label: 'Test' });

    expect(mutableDevice.get()).toBeDefined();
    expect(mutableDevice.get().tagList).toHaveLength(1);
  });

  it('should add a device type', () => {
    const mutableDevice = new MutableDevice(mockMatterbridge, 'Test Device');
    mutableDevice.addDeviceTypes('', bridgedNode);

    expect(mutableDevice.get()).toBeDefined();
    expect(mutableDevice.get().tagList).toHaveLength(0);
    expect(mutableDevice.get().deviceTypes).toContain(bridgedNode);
    expect(mutableDevice.get().deviceTypes).not.toContain(powerSource);
  });

  it('should add a device types', () => {
    const mutableDevice = new MutableDevice(mockMatterbridge, 'Test Device');
    mutableDevice.addDeviceTypes('', bridgedNode, powerSource);

    expect(mutableDevice.get()).toBeDefined();
    expect(mutableDevice.get().tagList).toHaveLength(0);
    expect(mutableDevice.get().deviceTypes).toContain(bridgedNode);
    expect(mutableDevice.get().deviceTypes).toContain(powerSource);
    expect(mutableDevice.get().deviceTypes).not.toContain(electricalSensor);
  });

  it('should add a cluster ids', () => {
    const mutableDevice = new MutableDevice(mockMatterbridge, 'Test Device');
    mutableDevice.addDeviceTypes('', bridgedNode, powerSource);
    mutableDevice.addClusterServerIds('', PowerSourceCluster.id);

    expect(mutableDevice.get()).toBeDefined();
    expect(mutableDevice.get().clusterServersIds).toContain(PowerSourceCluster.id);
    expect(mutableDevice.get().clusterServersIds).not.toContain(BridgedDeviceBasicInformationCluster.id);
  });

  it('should add a cluster objects', () => {
    const mutableDevice = new MutableDevice(mockMatterbridge, 'Test Device');
    mutableDevice.addDeviceTypes('', bridgedNode, powerSource);
    mutableDevice.addClusterServerIds('', PowerSourceCluster.id);

    const onOff = new MatterbridgeDevice(onOffOutlet);
    mutableDevice.addClusterServerObjs('', onOff.getDefaultOnOffClusterServer(false) as unknown as ClusterServerObj);

    expect(mutableDevice.get()).toBeDefined();
    expect(mutableDevice.get().clusterServersObjs).toHaveLength(1);
  });

  it('should create a MatterbridgeDevice', async () => {
    const mutableDevice = new MutableDevice(mockMatterbridge, 'Test Device');
    expect(mutableDevice.composedType).toBeUndefined();

    mutableDevice.addDeviceTypes('', bridgedNode, powerSource);
    mutableDevice.addDeviceTypes('', bridgedNode, powerSource);
    mutableDevice.addDeviceTypes('', onOffSwitch, dimmableSwitch, colorTemperatureSwitch);
    mutableDevice.addDeviceTypes('', onOffOutlet, dimmableOutlet);
    mutableDevice.addDeviceTypes('', onOffLight, dimmableLight, colorTemperatureLight);
    mutableDevice.addClusterServerIds('', PowerSourceCluster.id);
    mutableDevice.addClusterServerIds('', PowerSourceCluster.id, OnOffCluster.id);

    const onOff = new MatterbridgeDevice(onOffOutlet);
    mutableDevice.addClusterServerObjs('', onOff.getDefaultOnOffClusterServer(false) as unknown as ClusterServerObj);
    expect(mutableDevice.get().deviceTypes).toHaveLength(12);
    expect(mutableDevice.get().clusterServersIds).toHaveLength(3);
    expect(mutableDevice.get().clusterServersObjs).toHaveLength(1);

    const device = await mutableDevice.create();
    expect(device).toBeDefined();
    expect(mutableDevice.get().deviceTypes).toHaveLength(5);
    expect(mutableDevice.get().clusterServersIds).toHaveLength(1);
    expect(mutableDevice.get().clusterServersObjs).toHaveLength(2); // OnOff and BridgedDeviceBasicInformation

    expect(device.getAllClusterServers()).toHaveLength(8);
    expect(device.getClusterServerById(BridgedDeviceBasicInformationCluster.id)).toBeTruthy();
    expect(device.getClusterServerById(DescriptorCluster.id)).toBeTruthy();
    expect(device.getClusterServerById(PowerSourceCluster.id)).toBeTruthy();
    expect(device.getClusterServerById(IdentifyCluster.id)).toBeTruthy();
    expect(device.getClusterServerById(GroupsCluster.id)).toBeTruthy();
    expect(device.getClusterServerById(OnOffCluster.id)).toBeTruthy();
    expect(device.getClusterServerById(LevelControlCluster.id)).toBeTruthy();
    expect(device.getClusterServerById(ColorControlCluster.id)).toBeTruthy();
  });

  it('should create a MatterbridgeDevice with child endpoint', async () => {
    const mutableDevice = new MutableDevice(mockMatterbridge, 'Test Device');

    mutableDevice.composedType = 'Switch';
    mutableDevice.addDeviceTypes('', bridgedNode, powerSource);

    const onOff = (await (mutableDevice as any).createMutableDevice(onOffOutlet)) as MatterbridgeDevice;

    mutableDevice.addDeviceTypes('child1', onOffSwitch, dimmableSwitch, colorTemperatureSwitch);
    mutableDevice.addClusterServerIds('child1', OnOffCluster.id);
    mutableDevice.addClusterServerObjs(
      'child1',
      onOff.getDefaultOnOffClusterServer(false) as unknown as ClusterServerObj,
      onOff.getDefaultLevelControlClusterServer(100) as unknown as ClusterServerObj,
    );
    expect(mutableDevice.get('child1').deviceTypes).toHaveLength(3);
    expect(mutableDevice.get('child1').clusterServersIds).toHaveLength(1);
    expect(mutableDevice.get('child1').clusterServersObjs).toHaveLength(2);

    mutableDevice.addDeviceTypes('child2', onOffOutlet);
    mutableDevice.addClusterServerObjs('child2', onOff.getDefaultOnOffClusterServer(false) as unknown as ClusterServerObj);
    mutableDevice.addTagLists('child2', { mfgCode: null, namespaceId: 1, tag: 1, label: 'Test' });
    expect(mutableDevice.get('child2').deviceTypes).toHaveLength(1);
    expect(mutableDevice.get('child2').clusterServersIds).toHaveLength(0);
    expect(mutableDevice.get('child2').clusterServersObjs).toHaveLength(1);

    const device = await mutableDevice.create();
    expect(device).toBeDefined();

    expect(mutableDevice.get().deviceTypes).toHaveLength(2);
    expect(mutableDevice.get().clusterServersIds).toHaveLength(0);
    expect(mutableDevice.get().clusterServersObjs).toHaveLength(1); // BridgedDeviceBasicInformation
    expect(device.getAllClusterServers()).toHaveLength(4);
    expect(device.getClusterServerById(DescriptorCluster.id)).toBeTruthy();
    expect(device.getClusterServerById(BridgedDeviceBasicInformationCluster.id)).toBeTruthy();
    expect(device.getClusterServerById(PowerSourceCluster.id)).toBeTruthy();
    expect(device.getClusterServerById(FixedLabelCluster.id)).toBeTruthy();
    expect(device.getChildEndpoints()).toHaveLength(2);

    expect(mutableDevice.get('child1').deviceTypes).toHaveLength(1);
    expect(mutableDevice.get('child1').clusterServersIds).toHaveLength(0);
    expect(mutableDevice.get('child1').clusterServersObjs).toHaveLength(2);
    expect(mutableDevice.getEndpoint('child1').getAllClusterServers()).toHaveLength(7);

    expect(mutableDevice.get('child2').deviceTypes).toHaveLength(1);
    expect(mutableDevice.get('child2').clusterServersIds).toHaveLength(0);
    expect(mutableDevice.get('child2').clusterServersObjs).toHaveLength(1);
    expect(mutableDevice.getEndpoint('child1').getAllClusterServers()).toHaveLength(7);

    expect(mutableDevice.getEndpoint()).toBeDefined();
    expect(mutableDevice.getEndpoint('child1')).toBeDefined();
    expect(mutableDevice.getEndpoint('child2')).toBeDefined();
    mutableDevice.logMutableDevice();
  });
});
