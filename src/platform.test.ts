/* eslint-disable no-console */

const MATTER_PORT = 0;
const NAME = 'Platform';
const HOMEDIR = path.join('jest', NAME);

import * as fs from 'node:fs';
import * as path from 'node:path';
import { rmSync } from 'node:fs';

import { jest } from '@jest/globals';
import { bridgedNode, colorTemperatureLight, dimmableOutlet, Matterbridge, MatterbridgeEndpoint, PlatformConfig } from 'matterbridge';
import { EndpointNumber } from 'matterbridge/matter/types';
import { wait } from 'matterbridge/utils';
import { AnsiLogger, db, dn, idn, LogLevel, nf, rs, CYAN, ign, wr, er, or } from 'matterbridge/logger';
import { BooleanState, BridgedDeviceBasicInformation, FanControl, IlluminanceMeasurement, OccupancySensing, WindowCovering } from 'matterbridge/matter/clusters';

import { HomeAssistantPlatform } from './platform.js';
import { HassArea, HassConfig, HassDevice, HassEntity, HassLabel, HassServices, HassState, HomeAssistant } from './homeAssistant.js';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logging

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

const readMockHomeAssistantFile = () => {
  const filePath = path.join('mock', 'homeassistant.json');
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data) as {
      devices: HassDevice[];
      entities: HassEntity[];
      areas: HassArea[];
      labels: HassLabel[];
      states: HassState[];
      config: HassConfig;
      services: HassServices;
    };
  } catch (error) {
    console.error('Error reading or parsing homeassistant.json:', error);
    return null;
  }
};

// Cleanup the test environment
rmSync(HOMEDIR, { recursive: true, force: true });

describe('HassPlatform', () => {
  const mockLog = {
    fatal: jest.fn((message: string, ...parameters: any[]) => {}),
    error: jest.fn((message: string, ...parameters: any[]) => {}),
    warn: jest.fn((message: string, ...parameters: any[]) => {}),
    notice: jest.fn((message: string, ...parameters: any[]) => {}),
    info: jest.fn((message: string, ...parameters: any[]) => {}),
    debug: jest.fn((message: string, ...parameters: any[]) => {}),
  } as unknown as AnsiLogger;

  const mockMatterbridge = {
    matterbridgeDirectory: HOMEDIR + '/.matterbridge',
    matterbridgePluginDirectory: HOMEDIR + '/Matterbridge',
    systemInformation: {
      ipv4Address: undefined,
      ipv6Address: undefined,
      osRelease: 'xx.xx.xx.xx.xx.xx',
      nodeVersion: '22.1.10',
    },
    log: mockLog,
    matterbridgeVersion: '3.1.0',
    getDevices: jest.fn(() => []),
    getPlugins: jest.fn(() => []),
    addBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {}),
    removeBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {}),
    removeAllBridgedEndpoints: jest.fn(async (pluginName: string) => {}),
  } as unknown as Matterbridge;

  const mockConfig = {
    name: 'matterbridge-hass',
    type: 'DynamicPlatform',
    host: 'http://homeassistant.local:8123',
    token: 'long-lived token',
    certificatePath: undefined,
    rejectUnauthorized: true,
    reconnectTimeout: 60,
    reconnectRetries: 10,
    filterByArea: '',
    filterByLabel: '',
    whiteList: [],
    blackList: [],
    entityBlackList: [],
    deviceEntityBlackList: {},
    debug: false,
    unregisterOnShutdown: false,
  } as PlatformConfig;

  // let mockHomeAssistant: HomeAssistant;
  let haPlatform: HomeAssistantPlatform;

  const mockData = readMockHomeAssistantFile();
  if (!mockData) {
    throw new Error('Failed to read or parse mock homeassistant.json file');
  }

  const setAttributeSpy = jest.spyOn(MatterbridgeEndpoint.prototype, 'setAttribute');

  jest.spyOn(Matterbridge.prototype, 'addBridgedEndpoint').mockImplementation((pluginName: string, device: MatterbridgeEndpoint) => {
    console.log(`Mocked Matterbridge.addBridgedEndpoint: ${pluginName} ${device.name}`);
    return Promise.resolve();
  });
  jest.spyOn(Matterbridge.prototype, 'removeBridgedEndpoint').mockImplementation((pluginName: string, device: MatterbridgeEndpoint) => {
    console.log(`Mocked Matterbridge.removeBridgedEndpoint: ${pluginName} ${device.name}`);
    return Promise.resolve();
  });
  jest.spyOn(Matterbridge.prototype, 'removeAllBridgedEndpoints').mockImplementation((pluginName: string) => {
    console.log(`Mocked Matterbridge.removeAllBridgedEndpoints: ${pluginName}`);
    return Promise.resolve();
  });

  const connectSpy = jest.spyOn(HomeAssistant.prototype, 'connect').mockImplementation(() => {
    console.log(`Mocked HomeAssistant.connect`);
    return Promise.resolve('2024.09.1');
  });
  const closeSpy = jest.spyOn(HomeAssistant.prototype, 'close').mockImplementation(() => {
    console.log(`Mocked HomeAssistant.close`);
    return Promise.resolve();
  });
  const subscribeSpy = jest.spyOn(HomeAssistant.prototype, 'subscribe').mockImplementation((event?: string) => {
    console.log(`Mocked HomeAssistant.subscribe: ${event}`);
    return Promise.resolve(15);
  });
  const fetchDataSpy = jest.spyOn(HomeAssistant.prototype, 'fetchData').mockImplementation(() => {
    console.log(`Mocked HomeAssistant.fetchData`);
    return Promise.resolve();
  });
  const fetchSpy = jest.spyOn(HomeAssistant.prototype, 'fetch').mockImplementation((type: string, timeout = 5000) => {
    console.log(`Mocked HomeAssistant.fetch: ${type}`);
    if (type === 'config/device_registry/list') {
      return Promise.resolve(mockData.devices);
    } else if (type === 'config/entity_registry/list') {
      return Promise.resolve(mockData.entities);
    } else if (type === 'get_states') {
      return Promise.resolve(mockData.states);
    }
    return Promise.resolve(mockData.config);
  });
  const callServiceSpy = jest
    .spyOn(HomeAssistant.prototype, 'callService')
    .mockImplementation((domain: string, service: string, entityId: string, serviceData: Record<string, any> = {}, id?: number) => {
      console.log(`Mocked HomeAssistant.callService: domain ${domain} service ${service} entityId ${entityId}`);
      return Promise.resolve({} as any);
    });

  beforeAll(() => {
    // Spy on and mock the AnsiLogger.log method
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });

    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // console.error(`Mocked console.log: ${args}`);
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    if (haPlatform) {
      haPlatform.haSubscriptionId = 1;
      haPlatform.ha.connected = true;
      haPlatform.ha.hassConfig = {} as HassConfig;
      haPlatform.ha.hassServices = {} as HassServices;
      haPlatform.ha.hassDevices.clear();
      haPlatform.ha.hassEntities.clear();
      // haPlatform.ha.hassAreas.clear();
      // haPlatform.ha.hassLabels.clear();
      haPlatform.ha.hassStates.clear();
    }
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should not initialize platform with config name', () => {
    mockConfig.host = '';
    mockConfig.token = '';
    expect(() => new HomeAssistantPlatform(mockMatterbridge, mockLog, mockConfig)).toThrow('Host and token must be defined in the configuration');
    mockConfig.host = 'http://homeassistant.local:8123';
    mockConfig.token = '';
    expect(() => new HomeAssistantPlatform(mockMatterbridge, mockLog, mockConfig)).toThrow('Host and token must be defined in the configuration');
    mockConfig.host = '';
    mockConfig.token = 'long-lived token';
    expect(() => new HomeAssistantPlatform(mockMatterbridge, mockLog, mockConfig)).toThrow('Host and token must be defined in the configuration');
  });

  it('should initialize platform with config name', async () => {
    mockConfig.host = 'http://homeassistant.local:8123';
    mockConfig.token = 'long-lived token';
    haPlatform = new HomeAssistantPlatform(mockMatterbridge, mockLog, mockConfig);
    expect(mockLog.debug).toHaveBeenCalledWith(`MatterbridgeDynamicPlatform loaded`);

    await new Promise<void>((resolve) => {
      haPlatform.ha.once('error', (error) => {
        if (error === 'Test error') resolve();
      });
      haPlatform.ha.emit('error', 'Test error');
    });
  });

  it('should not initialize platform with wrong version', () => {
    mockMatterbridge.matterbridgeVersion = '1.5.5';
    expect(() => new HomeAssistantPlatform(mockMatterbridge, mockLog, mockConfig)).toThrow();
    mockMatterbridge.matterbridgeVersion = '3.1.0';
  });

  it('should validate with white and black list', () => {
    haPlatform.config.whiteList = ['white1', 'white2', 'white3'];
    haPlatform.config.blackList = ['black1', 'black2', 'black3'];
    expect(haPlatform.validateDevice('white1')).toBe(true);
    expect(haPlatform.validateDevice('black2')).toBe(false);
    expect(haPlatform.validateDevice(['white1', 'black2'])).toBe(false);
    expect(haPlatform.validateDevice('xDevice')).toBe(false);
    expect(haPlatform.validateDevice('')).toBe(false);
  });

  it('should validate with white list', () => {
    haPlatform.config.whiteList = ['white1', 'white2', 'white3'];
    haPlatform.config.blackList = [];
    expect(haPlatform.validateDevice('white1')).toBe(true);
    expect(haPlatform.validateDevice('black2')).toBe(false);
    expect(haPlatform.validateDevice(['white1', 'black2'])).toBe(true);
    expect(haPlatform.validateDevice('xDevice')).toBe(false);
    expect(haPlatform.validateDevice('')).toBe(false);
  });

  it('should validate with black list', () => {
    haPlatform.config.whiteList = [];
    haPlatform.config.blackList = ['black1', 'black2', 'black3'];
    expect(haPlatform.validateDevice('whiteDevice')).toBe(true);
    expect(haPlatform.validateDevice('black1')).toBe(false);
    expect(haPlatform.validateDevice('black2')).toBe(false);
    expect(haPlatform.validateDevice('black3')).toBe(false);
    expect(haPlatform.validateDevice(['x', 'y', 'z'])).toBe(true);
    expect(haPlatform.validateDevice(['x', 'y', 'z', 'black3'])).toBe(false);
    expect(haPlatform.validateDevice('xDevice')).toBe(true);
    expect(haPlatform.validateDevice('')).toBe(true);
  });

  it('should validate with no white and black list', () => {
    haPlatform.config.whiteList = [];
    haPlatform.config.blackList = [];
    expect(haPlatform.validateDevice('whiteDevice')).toBe(true);
    expect(haPlatform.validateDevice(['whiteDevice', '123456'])).toBe(true);
    expect(haPlatform.validateDevice('blackDevice')).toBe(true);
    expect(haPlatform.validateDevice(['blackDevice', '123456'])).toBe(true);
    expect(haPlatform.validateDevice('')).toBe(true);
  });

  it('should validate with entity black list', () => {
    haPlatform.config.entityBlackList = ['blackEntity'];
    haPlatform.config.deviceEntityBlackList = {};
    expect(haPlatform.validateEntity('any', 'whiteEntity')).toBe(true);
    expect(haPlatform.validateEntity('any', 'blackEntity')).toBe(false);
    expect(haPlatform.validateEntity('any', '')).toBe(true);

    haPlatform.config.entityBlackList = [];
    haPlatform.config.deviceEntityBlackList = {};
  });

  it('should validate with device entity black list and entity black list', () => {
    haPlatform.config.entityBlackList = ['blackEntity'];
    haPlatform.config.deviceEntityBlackList = {
      device1: ['blackEntityDevice1'],
    };
    expect(haPlatform.validateEntity('any', 'whiteEntity')).toBe(true);
    expect(haPlatform.validateEntity('any', 'blackEntity')).toBe(false);
    expect(haPlatform.validateEntity('any', 'blackEntityDevice1')).toBe(true);
    expect(haPlatform.validateEntity('any', '')).toBe(true);

    expect(haPlatform.validateEntity('device1', 'whiteEntity')).toBe(true);
    expect(haPlatform.validateEntity('device1', 'blackEntity')).toBe(false);
    expect(haPlatform.validateEntity('device1', 'blackEntityDevice1')).toBe(false);
    expect(haPlatform.validateEntity('device1', '')).toBe(true);

    haPlatform.config.entityBlackList = [];
    haPlatform.config.deviceEntityBlackList = {};
  });

  it('should set areas', () => {
    haPlatform.ha.hassAreas.clear();
    haPlatform.ha.hassAreas.set('area1', {
      area_id: 'area1',
      name: 'Living Room',
    } as HassArea);
    haPlatform.ha.hassAreas.set('area2', {
      area_id: 'area2',
      name: 'Kitchen',
    } as HassArea);
    expect(haPlatform.ha.hassAreas.size).toBe(2);
    expect(haPlatform.ha.hassAreas.get('area1')).toEqual({
      area_id: 'area1',
      name: 'Living Room',
    });
    expect(haPlatform.ha.hassAreas.get('area2')).toEqual({
      area_id: 'area2',
      name: 'Kitchen',
    });
  });

  it('should set labels', () => {
    haPlatform.ha.hassLabels.clear();
    haPlatform.ha.hassLabels.set('label1', {
      label_id: 'label1',
      name: 'Label 1',
      description: 'This is label 1',
    } as HassLabel);
    haPlatform.ha.hassLabels.set('label2', {
      label_id: 'label2',
      name: 'Label 2',
      description: 'This is label 2',
    } as HassLabel);
    expect(haPlatform.ha.hassLabels.size).toBe(2);
    expect(haPlatform.ha.hassLabels.get('label1')).toEqual({
      label_id: 'label1',
      name: 'Label 1',
      description: 'This is label 1',
    });
    expect(haPlatform.ha.hassLabels.get('label2')).toEqual({
      label_id: 'label2',
      name: 'Label 2',
      description: 'This is label 2',
    });
  });

  it('returns true if no filters are set', () => {
    mockConfig.filterByArea = '';
    haPlatform.labelIdFilter = '';
    expect(haPlatform.isValidAreaLabel('area1', ['foo'])).toBe(true);
  });

  it('returns false if filterByArea is set and areaId is null', () => {
    mockConfig.filterByArea = 'Living Room';
    haPlatform.labelIdFilter = '';
    expect(haPlatform.isValidAreaLabel(null, ['foo'])).toBe(false);
  });

  it('returns false if filterByArea is set and areaId does not match', () => {
    mockConfig.filterByArea = 'Living Room';
    haPlatform.labelIdFilter = '';
    expect(haPlatform.isValidAreaLabel('area2', ['foo'])).toBe(false);
  });

  it('returns true if filterByArea is set and areaId matches', () => {
    mockConfig.filterByArea = 'Living Room';
    haPlatform.labelIdFilter = '';
    expect(haPlatform.isValidAreaLabel('area1', ['foo'])).toBe(true);
  });

  it('returns false if filterByLabel is set and labels is empty', () => {
    mockConfig.filterByArea = 'Living Room';
    haPlatform.labelIdFilter = 'important';
    expect(haPlatform.isValidAreaLabel('area1', [])).toBe(false);
  });

  it('returns false if filterByLabel is set and label does not match', () => {
    mockConfig.filterByArea = 'Living Room';
    haPlatform.labelIdFilter = 'important';
    expect(haPlatform.isValidAreaLabel('area1', ['foo', 'bar'])).toBe(false);
  });

  it('returns true if filterByLabel is set and label matches', () => {
    mockConfig.filterByArea = 'Living Room';
    haPlatform.labelIdFilter = 'important';
    expect(haPlatform.isValidAreaLabel('area1', ['foo', 'important', 'bar'])).toBe(true);
  });

  it('returns true if both filters are set and both match', () => {
    mockConfig.filterByArea = 'Living Room';
    haPlatform.labelIdFilter = 'important';
    expect(haPlatform.isValidAreaLabel('area1', ['important'])).toBe(true);
  });

  it('returns false if both filters are set and only area matches', () => {
    mockConfig.filterByArea = 'Living Room';
    haPlatform.labelIdFilter = 'important';
    expect(haPlatform.isValidAreaLabel('area1', ['foo'])).toBe(false);
  });

  it('returns false if both filters are set and only label matches', () => {
    mockConfig.filterByArea = 'Living Room';
    haPlatform.labelIdFilter = 'important';
    expect(haPlatform.isValidAreaLabel('area2', ['important'])).toBe(false);
  });

  it('should clear areas, labels and reset filters', () => {
    haPlatform.ha.hassAreas.clear();
    expect(haPlatform.ha.hassAreas.size).toBe(0);
    haPlatform.ha.hassLabels.clear();
    expect(haPlatform.ha.hassLabels.size).toBe(0);
    mockConfig.filterByArea = '';
    mockConfig.filterByLabel = '';
    haPlatform.labelIdFilter = '';
  });

  it('should call commandHandler', async () => {
    expect(haPlatform).toBeDefined();
    const device = new MatterbridgeEndpoint(bridgedNode, { uniqueStorageKey: 'dimmableDoubleOutlet' }, true);
    expect(device).toBeDefined();
    if (!device) return;

    const child1 = device.addChildDeviceTypeWithClusterServer('switch.switch_switch_1', [dimmableOutlet], [], { endpointId: EndpointNumber(1) });
    expect(child1).toBeDefined();
    child1.number = EndpointNumber(1);

    const child2 = device.addChildDeviceTypeWithClusterServer('switch.switch_switch_2', [dimmableOutlet], [], { endpointId: EndpointNumber(2) });
    expect(child2).toBeDefined();
    child2.number = EndpointNumber(2);

    const child3 = device.addChildDeviceTypeWithClusterServer('light.light_light_3', [colorTemperatureLight], [], { endpointId: EndpointNumber(3) });
    expect(child3).toBeDefined();
    child3.number = EndpointNumber(3);

    await haPlatform.commandHandler({ endpoint: child1, request: {}, cluster: 'onOff', attributes: {} }, '', 'on');
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`${db}Received matter command ${ign}on${rs}${db} for endpoint ${or}${child1.uniqueStorageKey}${db}:${or}${child1.number}${db}`),
    );
    expect(callServiceSpy).toHaveBeenCalledWith('switch', 'turn_on', 'switch.switch_switch_1', undefined);

    await haPlatform.commandHandler({ endpoint: child2, request: {}, cluster: 'onOff', attributes: {} }, '', 'off');
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`${db}Received matter command ${ign}off${rs}${db} for endpoint ${or}${child2.uniqueStorageKey}${db}:${or}${child2.number}${db}`),
    );
    expect(callServiceSpy).toHaveBeenCalledWith('switch', 'turn_off', 'switch.switch_switch_2', undefined);

    await haPlatform.commandHandler({ endpoint: child3, request: { level: 100 }, cluster: 'levelControl', attributes: {} }, '', 'moveToLevel');
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`${db}Received matter command ${ign}moveToLevel${rs}${db} for endpoint ${or}${child3.uniqueStorageKey}${db}:${or}${child3.number}${db}`),
    );
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining(`Command ${ign}moveToLevel${rs}${wr} not supported`));
    expect(callServiceSpy).toHaveBeenCalledWith('light', 'turn_on', 'light.light_light_3', expect.objectContaining({ brightness: 100 }));

    await haPlatform.commandHandler({ endpoint: child3, request: { level: 100 }, cluster: 'levelControl', attributes: {} }, '', 'moveToLevelWithOnOff');
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`${db}Received matter command ${ign}moveToLevelWithOnOff${rs}${db} for endpoint ${or}${child3.uniqueStorageKey}${db}:${or}${child3.number}${db}`),
    );
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining(`Command ${ign}moveToLevelWithOnOff${rs}${wr} not supported`));
    expect(callServiceSpy).toHaveBeenCalledWith('light', 'turn_on', 'light.light_light_3', expect.objectContaining({ brightness: 100 }));

    await haPlatform.commandHandler({ endpoint: child3, request: { colorTemperatureMireds: 300 }, cluster: 'colorControl', attributes: {} }, '', 'moveToColorTemperature');
    expect(callServiceSpy).toHaveBeenCalledWith('light', 'turn_on', 'light.light_light_3', expect.objectContaining({ color_temp: 300 }));

    await haPlatform.commandHandler({ endpoint: child3, request: { colorX: 0.5, colorY: 0.5 }, cluster: 'colorControl', attributes: {} }, '', 'moveToColor');
    expect(callServiceSpy).toHaveBeenCalledWith('light', 'turn_on', 'light.light_light_3', expect.objectContaining({ xy_color: [0.5, 0.5] }));

    await haPlatform.commandHandler({ endpoint: child3, request: { hue: 50 }, cluster: 'colorControl', attributes: { currentSaturation: { value: 50 } } }, '', 'moveToHue');
    expect(callServiceSpy).toHaveBeenCalledWith('light', 'turn_on', 'light.light_light_3', expect.objectContaining({ hs_color: [71, 20] }));

    await haPlatform.commandHandler({ endpoint: child3, request: { saturation: 50 }, cluster: 'colorControl', attributes: { currentHue: { value: 50 } } }, '', 'moveToSaturation');
    expect(callServiceSpy).toHaveBeenCalledWith('light', 'turn_on', 'light.light_light_3', expect.objectContaining({ hs_color: [71, 20] }));

    await haPlatform.commandHandler({ endpoint: child3, request: { hue: 50, saturation: 50 }, cluster: 'colorControl', attributes: {} }, '', 'moveToHueAndSaturation');
    expect(callServiceSpy).toHaveBeenCalledWith('light', 'turn_on', 'light.light_light_3', expect.objectContaining({ hs_color: [71, 20] }));

    callServiceSpy.mockClear();
    await haPlatform.commandHandler({ endpoint: child2, request: {}, cluster: 'onOff', attributes: {} }, '', 'unknown');
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`${db}Received matter command ${ign}unknown${rs}${db} for endpoint ${or}${child2.uniqueStorageKey}${db}:${or}${child2.number}${db}`),
    );
    expect(callServiceSpy).not.toHaveBeenCalled();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining(`Command ${ign}unknown${rs}${wr} not supported`));
  });

  it('should call subscribeHandler', async () => {
    expect(haPlatform).toBeDefined();
    const device = new MatterbridgeEndpoint(bridgedNode, { uniqueStorageKey: 'test' }, true);
    expect(device).toBeDefined();
    if (!device) return;
    expect(haPlatform.matterbridgeDevices.size).toBe(0);
    haPlatform.matterbridgeDevices.set('123456789', device);

    haPlatform.subscribeHandler({} as any, {} as any, undefined, undefined, {} as any);
    expect(mockLog.debug).toHaveBeenCalledWith(`Subscribe handler: Matterbridge device undefined for undefined not found`);

    haPlatform.subscribeHandler({ device_id: '123456789', entity_id: 'notvalid' } as any, {} as any, undefined, undefined, {} as any);
    expect(mockLog.debug).toHaveBeenCalledWith(`Subscribe handler: Endpoint notvalid for device 123456789 not found`);

    haPlatform.matterbridgeDevices.clear();
  });

  it('should call updateHandler', async () => {
    expect(haPlatform).toBeDefined();
    const device = new MatterbridgeEndpoint(bridgedNode, { uniqueStorageKey: 'dimmableDoubleOutlet' }, true);
    expect(device).toBeDefined();
    if (!device) return;

    const child1 = device.addChildDeviceTypeWithClusterServer('switch.switch_switch_1', [dimmableOutlet], [], { endpointId: EndpointNumber(1) });
    expect(child1).toBeDefined();
    child1.number = EndpointNumber(1);

    const child2 = device.addChildDeviceTypeWithClusterServer('switch.switch_switch_2', [dimmableOutlet], [], { endpointId: EndpointNumber(2) });
    expect(child2).toBeDefined();
    child2.number = EndpointNumber(2);

    const child3 = device.addChildDeviceTypeWithClusterServer('light.light_light_3', [colorTemperatureLight], [], { endpointId: EndpointNumber(3) });
    expect(child3).toBeDefined();
    child3.number = EndpointNumber(3);

    expect(haPlatform.matterbridgeDevices.size).toBe(0);
    haPlatform.matterbridgeDevices.set('dimmableDoubleOutlet', device);

    jest.clearAllMocks();
    await haPlatform.updateHandler('notadevice', 'notanentity', { state: 'off' } as HassState, { state: 'on' } as HassState);
    expect(mockLog.debug).toHaveBeenCalledWith(`Update handler: Matterbridge device notadevice for notanentity not found`);

    jest.clearAllMocks();
    await haPlatform.updateHandler('dimmableDoubleOutlet', 'notanentity', { state: 'off' } as HassState, { state: 'on' } as HassState);
    expect(mockLog.debug).toHaveBeenCalledWith(`Update handler: Endpoint notanentity for dimmableDoubleOutlet not found`);

    jest.clearAllMocks();
    await haPlatform.updateHandler('dimmableDoubleOutlet', 'switch.switch_switch_1', { state: 'off' } as HassState, { state: 'on' } as HassState);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`${db}Received update event from Home Assistant device ${idn}${device?.deviceName}${rs}${db} entity ${CYAN}switch.switch_switch_1${db}`),
    );

    haPlatform.matterbridgeDevices.delete('dimmableDoubleOutlet');
    expect(haPlatform.matterbridgeDevices.size).toBe(0);
  });

  it('should fail calling onStart with reason', async () => {
    connectSpy.mockImplementationOnce(() => {
      console.log(`Mocked connect failure`);
      return Promise.reject(new Error('Connection failed'));
    });
    expect(haPlatform).toBeDefined();
    await haPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.error).toHaveBeenCalledWith(`Error connecting to Home Assistant at ${CYAN}http://homeassistant.local:8123${nf}: Error: Connection failed`);
  });

  it('should call onStart with reason', async () => {
    expect(haPlatform).toBeDefined();
    await haPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Started platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    await wait(100);
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Payload successfully written to`));
  });

  it('should call onStart with reason and fail save payload', async () => {
    expect(haPlatform).toBeDefined();
    (haPlatform as any).savePayload(mockMatterbridge.matterbridgePluginDirectory);
    await wait(100);
    expect(mockLog.error).toHaveBeenCalledWith(expect.stringContaining(`Error writing payload to`));
  });

  it('should receive events from ha', async () => {
    haPlatform.ha.emit('connected', '2024.09.1');
    await new Promise((resolve) => setTimeout(resolve, 100)); // Allow async event handling to complete
    expect(mockLog.notice).toHaveBeenCalledWith(`Connected to Home Assistant 2024.09.1`);
    expect(mockLog.info).toHaveBeenCalledWith(`Fetched data from Home Assistant successfully`);
    expect(mockLog.info).toHaveBeenCalledWith(`Subscribed to Home Assistant events successfully with id 15`);

    jest.clearAllMocks();
    fetchDataSpy.mockImplementationOnce(() => {
      return Promise.reject(new Error('FetchData failed'));
    });
    subscribeSpy.mockImplementationOnce(() => {
      return Promise.reject(new Error('Subscribe failed'));
    });
    haPlatform.ha.emit('connected', '2024.09.1');
    await new Promise((resolve) => setTimeout(resolve, 100)); // Allow async event handling to complete
    expect(mockLog.notice).toHaveBeenCalledWith(`Connected to Home Assistant 2024.09.1`);
    expect(mockLog.error).toHaveBeenCalledWith(`Error fetching data from Home Assistant: Error: FetchData failed`);
    expect(mockLog.error).toHaveBeenCalledWith(`Error subscribing to Home Assistant events: Error: Subscribe failed`);

    haPlatform.ha.emit('disconnected', 'Jest test');
    expect(mockLog.warn).toHaveBeenCalledWith(`Disconnected from Home Assistant`);
    haPlatform.ha.emit('subscribed');
    expect(mockLog.info).toHaveBeenCalledWith(`Subscribed to Home Assistant events`);
    haPlatform.ha.emit('config', { unit_system: { temperature: '°C', pressure: 'Pa' } } as unknown as HassConfig);
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining(`Configuration received from Home Assistant`));
    haPlatform.ha.emit('services', {} as unknown as HassServices);
    expect(mockLog.info).toHaveBeenCalledWith(`Services received from Home Assistant`);
    haPlatform.ha.emit('states', []);
    expect(mockLog.info).toHaveBeenCalledWith(`States received from Home Assistant`);
    haPlatform.ha.emit('devices', []);
    expect(mockLog.info).toHaveBeenCalledWith(`Devices received from Home Assistant`);
    haPlatform.ha.emit('entities', []);
    expect(mockLog.info).toHaveBeenCalledWith(`Entities received from Home Assistant`);
    haPlatform.ha.emit('areas', []);
    expect(mockLog.info).toHaveBeenCalledWith(`Areas received from Home Assistant`);
    haPlatform.ha.emit('labels', []);
    expect(mockLog.info).toHaveBeenCalledWith(`Labels received from Home Assistant`);
  });

  it('should not register any devices and individual entities with label filter name', async () => {
    expect(haPlatform).toBeDefined();

    (mockData.devices as HassDevice[]).forEach((d) => haPlatform.ha.hassDevices.set(d.id, d));
    (mockData.entities as HassEntity[]).forEach((e) => haPlatform.ha.hassEntities.set(e.id, e));
    (mockData.states as HassState[]).forEach((s) => haPlatform.ha.hassStates.set(s.entity_id, s));
    (mockData.areas as HassArea[]).forEach((a) => haPlatform.ha.hassAreas.set(a.area_id, a));
    (mockData.labels as HassLabel[]).forEach((l) => haPlatform.ha.hassLabels.set(l.label_id, l));

    mockConfig.filterByArea = '';
    mockConfig.filterByLabel = 'not existing';
    haPlatform.config.filterByArea = '';
    haPlatform.config.filterByLabel = 'not existing';

    haPlatform.ha.emit('labels', Array.from(haPlatform.ha.hassLabels.values()));
    await new Promise((resolve) => setTimeout(resolve, 100)); // Allow async event handling to complete
    expect(mockLog.warn).toHaveBeenCalledWith(`Label "not existing" not found in Home Assistant. Filter by label is disabled.`);
    jest.clearAllMocks();

    mockConfig.filterByArea = '';
    mockConfig.filterByLabel = 'label_id_1';
    haPlatform.config.filterByArea = '';
    haPlatform.config.filterByLabel = 'label_id_1';

    haPlatform.ha.emit('labels', Array.from(haPlatform.ha.hassLabels.values()));
    await new Promise((resolve) => setTimeout(resolve, 100)); // Allow async event handling to complete
    expect(mockLog.info).toHaveBeenCalledWith(`Filtering by label_id: ${CYAN}label_id_1${nf}`);

    // Reset configuration and filters to test filter on device
    jest.clearAllMocks();
    mockConfig.filterByArea = '';
    mockConfig.filterByLabel = 'Label 1';
    mockConfig.applyFiltersToDeviceEntities = false;
    haPlatform.config.filterByArea = '';
    haPlatform.config.filterByLabel = 'Label 1';
    haPlatform.config.applyFiltersToDeviceEntities = false;

    haPlatform.ha.emit('labels', Array.from(haPlatform.ha.hassLabels.values()));
    await new Promise((resolve) => setTimeout(resolve, 100)); // Allow async event handling to complete
    expect(mockLog.info).toHaveBeenCalledWith(`Filtering by label_id: ${CYAN}label_id_1${nf}`);
    jest.clearAllMocks();

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`doesn't have the label`));
    expect(haPlatform.matterbridgeDevices.size).toBe(0);

    // Reset configuration and filters to test filter on device entities
    jest.clearAllMocks();
    (mockData.devices as HassDevice[]).forEach((d) => haPlatform.ha.hassDevices.set(d.id, { ...d, labels: ['label_id_1'] }));
    mockConfig.filterByArea = '';
    mockConfig.filterByLabel = 'Label 1';
    mockConfig.applyFiltersToDeviceEntities = true;
    haPlatform.config.filterByArea = '';
    haPlatform.config.filterByLabel = 'Label 1';
    haPlatform.config.applyFiltersToDeviceEntities = true;

    haPlatform.ha.emit('labels', Array.from(haPlatform.ha.hassLabels.values()));
    await new Promise((resolve) => setTimeout(resolve, 100)); // Allow async event handling to complete
    expect(mockLog.info).toHaveBeenCalledWith(`Filtering by label_id: ${CYAN}label_id_1${nf}`);
    jest.clearAllMocks();

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`doesn't have the label`));
    expect(haPlatform.matterbridgeDevices.size).toBe(0);

    mockConfig.filterByArea = '';
    mockConfig.filterByLabel = '';
    mockConfig.applyFiltersToDeviceEntities = false;
    haPlatform.config.filterByArea = '';
    haPlatform.config.filterByLabel = '';
    haPlatform.config.applyFiltersToDeviceEntities = false;
    haPlatform.labelIdFilter = '';
  });

  it('should not register any devices and individual entities with white lists', async () => {
    expect(haPlatform).toBeDefined();

    (mockData.devices as HassDevice[]).forEach((d) => haPlatform.ha.hassDevices.set(d.id, d));
    (mockData.entities as HassEntity[]).forEach((e) => haPlatform.ha.hassEntities.set(e.id, e));
    (mockData.states as HassState[]).forEach((s) => haPlatform.ha.hassStates.set(s.entity_id, s));
    (mockData.areas as HassArea[]).forEach((a) => haPlatform.ha.hassAreas.set(a.area_id, a));

    mockConfig.individualEntityWhiteList = ['No entities'];
    mockConfig.whiteList = ['No devices'];

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(haPlatform.matterbridgeDevices.size).toBe(0);

    mockConfig.individualEntityWhiteList = [];
    mockConfig.whiteList = [];
  });

  it('should not register an individual entity with device_id', async () => {
    expect(haPlatform).toBeDefined();

    const entity = {
      id: '0123456789abcdef',
      entity_id: 'scene.turn_off_all_lights',
      original_name: 'Turn off all lights',
      // domain: 'scene',
      name: 'turn_off_all_lights',
      device_id: 'device1',
    } as unknown as HassEntity;
    haPlatform.ha.hassEntities.set(entity.id, entity);

    await haPlatform.onStart('Test reason');

    expect(mockLog.debug).toHaveBeenCalledWith(`Individual entity ${CYAN}${entity.entity_id}${db} is a device entity. Skipping...`);
  });

  it('should not register an individual entity with no name', async () => {
    expect(haPlatform).toBeDefined();

    const entity = {
      id: '0123456789abcdef',
      entity_id: 'scene.turn_off_all_lights',
      device_id: null,
    } as unknown as HassEntity;
    haPlatform.ha.hassEntities.set(entity.id, entity);
    haPlatform.ha.hassStates.set(entity.entity_id, {
      state: 'off',
    } as HassState);

    await haPlatform.onStart('Test reason');

    expect(mockLog.debug).toHaveBeenCalledWith(`Individual entity ${CYAN}${entity.entity_id}${db} has no valid name. Skipping...`);
  });

  it('should not register an individual entity with the same name', async () => {
    expect(haPlatform).toBeDefined();

    const entity = {
      id: '0123456789abcdef',
      entity_id: 'scene.turn_off_all_lights',
      device_id: null,
      name: 'Turn off all lights',
    } as unknown as HassEntity;
    haPlatform.ha.hassEntities.set(entity.id, entity);
    haPlatform.ha.hassStates.set(entity.entity_id, {
      state: 'off',
    } as HassState);
    (haPlatform as any)._registeredEndpointsByName.set(entity.name, entity);
    await haPlatform.onStart('Test reason');

    expect(mockLog.warn).toHaveBeenCalledWith(`Individual entity ${CYAN}${entity.name}${wr} already exists as a registered device. Please change the name in Home Assistant`);
    (haPlatform as any)._registeredEndpointsByName.delete(entity.name);
  });

  it('should register a Scene entity', async () => {
    expect(haPlatform).toBeDefined();

    let entity: HassEntity | undefined;
    (mockData.entities as HassEntity[]).forEach((e) => {
      if (e.original_name === 'Turn off all lights') entity = e;
    });
    expect(entity).toBeDefined();
    if (!entity) return;
    haPlatform.ha.hassDevices.clear();
    haPlatform.ha.hassEntities.set(entity.id, entity);
    haPlatform.ha.hassStates.set(entity.entity_id, {
      state: 'off',
    } as HassState);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(
      `Creating device for individual entity ${idn}${entity.original_name}${rs}${nf} domain ${CYAN}scene${nf} name ${CYAN}turn_off_all_lights${nf}`,
    );
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${entity.original_name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    jest.clearAllMocks();
    expect(haPlatform.matterbridgeDevices.size).toBe(1);
    expect(haPlatform.matterbridgeDevices.get(entity.entity_id)).toBeDefined();
    await haPlatform.updateHandler(entity.entity_id, entity.entity_id, { state: 'off' } as HassState, { state: 'on' } as HassState);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Received update event from Home Assistant device`));

    const device = haPlatform.matterbridgeDevices.get(entity.entity_id);
    expect(device).toBeDefined();
    if (!device) return;
    expect(haPlatform.endpointNames.get(entity.entity_id)).toBe('');
    await device.executeCommandHandler('on', {}, 'onOff', {}, device);
    await device.executeCommandHandler('off', {}, 'onOff', {}, device);

    jest.clearAllMocks();
    await haPlatform.onConfigure();
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining(`Configuring platform`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`on individual entity`));
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining(`Configured platform`));
  });

  it('should register a Script entity', async () => {
    expect(haPlatform).toBeDefined();

    let entity: HassEntity | undefined;
    (mockData.entities as HassEntity[]).forEach((e) => {
      if (e.original_name === 'Increase brightness') entity = e;
    });
    expect(entity).toBeDefined();
    if (!entity) return;
    haPlatform.ha.hassEntities.set(entity.id, entity);
    haPlatform.ha.hassDevices.clear();
    haPlatform.ha.hassStates.clear();
    haPlatform.ha.hassStates.set(entity.entity_id, {
      state: 'off',
    } as HassState);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(
      `Creating device for individual entity ${idn}${entity.original_name}${rs}${nf} domain ${CYAN}script${nf} name ${CYAN}increase_brightness${nf}`,
    );
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${entity.original_name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    jest.clearAllMocks();
    expect(haPlatform.matterbridgeDevices.size).toBe(2);
    expect(haPlatform.matterbridgeDevices.get(entity.entity_id)).toBeDefined();
    await haPlatform.updateHandler(entity.entity_id, entity.entity_id, { state: 'off' } as HassState, { state: 'on' } as HassState);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Received update event from Home Assistant device`));

    const device = haPlatform.matterbridgeDevices.get(entity.entity_id);
    expect(device).toBeDefined();
    if (!device) return;
    expect(haPlatform.endpointNames.get(entity.entity_id)).toBe('');
    await device.executeCommandHandler('on', {}, 'onOff', {}, device);
    await device.executeCommandHandler('off', {}, 'onOff', {}, device);
  });

  it('should register an Automation entity', async () => {
    expect(haPlatform).toBeDefined();

    let entity: HassEntity | undefined;
    (mockData.entities as HassEntity[]).forEach((e) => {
      if (e.original_name === 'Turn off all switches') entity = e;
    });
    expect(entity).toBeDefined();
    if (!entity) return;
    haPlatform.ha.hassEntities.set(entity.id, entity);
    haPlatform.ha.hassDevices.clear();
    haPlatform.ha.hassStates.clear();
    haPlatform.ha.hassStates.set(entity.entity_id, {
      state: 'off',
    } as HassState);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(
      `Creating device for individual entity ${idn}${entity.original_name}${rs}${nf} domain ${CYAN}automation${nf} name ${CYAN}turn_off_all_switches${nf}`,
    );
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${entity.original_name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    jest.clearAllMocks();
    expect(haPlatform.matterbridgeDevices.size).toBe(3);
    expect(haPlatform.matterbridgeDevices.get(entity.entity_id)).toBeDefined();
    await haPlatform.updateHandler(entity.entity_id, entity.entity_id, { state: 'off' } as HassState, { state: 'on' } as HassState);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Received update event from Home Assistant device`));

    const device = haPlatform.matterbridgeDevices.get(entity.entity_id);
    expect(device).toBeDefined();
    if (!device) return;
    expect(haPlatform.endpointNames.get(entity.entity_id)).toBe('');
    await device.executeCommandHandler('on', {}, 'onOff', {}, device);
    await device.executeCommandHandler('off', {}, 'onOff', {}, device);
  });

  it('should register an Boolean helper entity', async () => {
    expect(haPlatform).toBeDefined();

    let entity: HassEntity | undefined;
    (mockData.entities as HassEntity[]).forEach((e) => {
      if (e.original_name === 'Boolean helper') entity = e;
    });
    expect(entity).toBeDefined();
    if (!entity) return;
    haPlatform.ha.hassEntities.set(entity.id, entity);
    haPlatform.ha.hassDevices.clear();
    haPlatform.ha.hassStates.clear();
    haPlatform.ha.hassStates.set(entity.entity_id, {
      state: 'off',
    } as HassState);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(
      `Creating device for individual entity ${idn}${entity.original_name}${rs}${nf} domain ${CYAN}input_boolean${nf} name ${CYAN}boolean_helper${nf}`,
    );
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${entity.original_name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    jest.clearAllMocks();
    expect(haPlatform.matterbridgeDevices.size).toBe(4);
    expect(haPlatform.matterbridgeDevices.get(entity.entity_id)).toBeDefined();
    await haPlatform.updateHandler(entity.entity_id, entity.entity_id, { state: 'off' } as HassState, { state: 'on' } as HassState);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Received update event from Home Assistant device`));

    const device = haPlatform.matterbridgeDevices.get(entity.entity_id);
    expect(device).toBeDefined();
    if (!device) return;
    expect(haPlatform.endpointNames.get(entity.entity_id)).toBe('');
    await device.executeCommandHandler('on', {}, 'onOff', {}, device);
    await device.executeCommandHandler('off', {}, 'onOff', {}, device);
  });

  it('should register an Button helper entity', async () => {
    expect(haPlatform).toBeDefined();

    let entity: HassEntity | undefined;
    (mockData.entities as HassEntity[]).forEach((e) => {
      if (e.original_name === 'Button helper') entity = e;
    });
    expect(entity).toBeDefined();
    if (!entity) return;
    haPlatform.ha.hassEntities.set(entity.id, entity);
    haPlatform.ha.hassDevices.clear();
    haPlatform.ha.hassStates.clear();
    haPlatform.ha.hassStates.set(entity.entity_id, {
      state: 'off',
    } as HassState);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(
      `Creating device for individual entity ${idn}${entity.original_name}${rs}${nf} domain ${CYAN}input_button${nf} name ${CYAN}button_helper${nf}`,
    );
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${entity.original_name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    jest.clearAllMocks();
    expect(haPlatform.matterbridgeDevices.size).toBe(5);
    expect(haPlatform.matterbridgeDevices.get(entity.entity_id)).toBeDefined();
    await haPlatform.updateHandler(entity.entity_id, entity.entity_id, { state: 'off' } as HassState, { state: 'on' } as HassState);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Received update event from Home Assistant device`));

    const device = haPlatform.matterbridgeDevices.get(entity.entity_id);
    expect(device).toBeDefined();
    if (!device) return;
    expect(haPlatform.endpointNames.get(entity.entity_id)).toBe('');
    await device.executeCommandHandler('on', {}, 'onOff', {}, device);
    await device.executeCommandHandler('off', {}, 'onOff', {}, device);
  });

  it('should register an Switch template entity', async () => {
    expect(haPlatform).toBeDefined();

    let entity: HassEntity | undefined;
    (mockData.entities as HassEntity[]).forEach((e) => {
      if (e.original_name === 'My Template Switch') entity = e;
    });
    expect(entity).toBeDefined();
    if (!entity) return;
    haPlatform.ha.hassEntities.set(entity.id, entity);
    haPlatform.ha.hassDevices.clear();
    haPlatform.ha.hassStates.clear();
    haPlatform.ha.hassStates.set(entity.entity_id, {
      state: 'off',
    } as HassState);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(
      `Creating device for individual entity ${idn}${entity.original_name}${rs}${nf} domain ${CYAN}switch${nf} name ${CYAN}my_template_switch${nf}`,
    );
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${entity.original_name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    jest.clearAllMocks();
    expect(haPlatform.matterbridgeDevices.size).toBe(6);
    expect(haPlatform.matterbridgeDevices.get(entity.entity_id)).toBeDefined();
    await haPlatform.updateHandler(entity.entity_id, entity.entity_id, { state: 'off' } as HassState, { state: 'on' } as HassState);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Received update event from Home Assistant device`));

    const device = haPlatform.matterbridgeDevices.get(entity.entity_id);
    expect(device).toBeDefined();
    if (!device) return;
    expect(haPlatform.endpointNames.get(entity.entity_id)).toBe('');
    await device.executeCommandHandler('on', {}, 'onOff', {}, device);
    await device.executeCommandHandler('off', {}, 'onOff', {}, device);
  });

  it('should not register a Switch device if entry_type is service', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Switch') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    device.entry_type = 'service'; // Simulate a service entry type
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    expect(mockLog.debug).toHaveBeenCalledWith(`Device ${CYAN}${device.name}${db} is a service. Skipping...`);
    device.entry_type = null;
  });

  it('should not register a Switch device if has no name', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Switch') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    device.name = null; // Simulate no name
    device.name_by_user = null; // Simulate no user-defined name
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    expect(mockLog.debug).toHaveBeenCalledWith(`Device ${CYAN}${device.name}${db} has not valid name. Skipping...`);
    device.name = 'Switch';
  });

  it('should not register a Switch device if has no entities', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Switch') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);

    await haPlatform.onStart('Test reason');

    expect(mockLog.debug).toHaveBeenCalledWith(`Device ${CYAN}${device.name}${db} has no entities. Skipping...`);
  });

  it('should not register a Switch device if has the same name', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Switch') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    (haPlatform as any)._registeredEndpointsByName.set(device.name, device);

    await haPlatform.onStart('Test reason');
    await new Promise((resolve) => setTimeout(resolve, 100)); // Allow async event handling to complete

    expect(mockLog.warn).toHaveBeenCalledWith(`Device ${CYAN}${device.name}${wr} already exists as a registered device. Please change the name in Home Assistant`);

    (haPlatform as any)._registeredEndpointsByName.delete(device.name);
  });

  it('should not register a Switch device if has no state', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Switch') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    // for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');
    await new Promise((resolve) => setTimeout(resolve, 100)); // Allow async event handling to complete

    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`state not found. Skipping...`));
  });

  it('should register a Switch device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Switch') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
      }
    }

    const mbdevice = haPlatform.matterbridgeDevices.get('85476b52c919e7d58a779155c476fdb0');
    expect(mbdevice).toBeDefined();
    if (!mbdevice) return;
    const child = mbdevice.getChildEndpointByName('switchswitch_switch');
    expect(child).toBeDefined();
    if (!child) return;
    await child.executeCommandHandler('on', {}, 'onOff', {}, child);
    await child.executeCommandHandler('off', {}, 'onOff', {}, child);
  });

  it('should register a Light (on/off) device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Light (on/off)') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
      }
    }
  });

  it('should register a Dimmer device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Dimmer') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
      }
    }
  });

  it('should register a Light (HS) device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Light (HS)') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
      }
    }
  });

  it('should register a Light (XY) device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Light (XY)') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
      }
    }
  });

  it('should register a Light (CT) device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Light (CT)') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
      }
    }
  });

  it('should register a Light (XY, HS and CT) device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Light (XY, HS and CT)') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
      }
    }
  });

  it('should register a Outlet device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Outlet') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
      }
    }
  });

  it('should register a Lock device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Lock') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
      }
    }
  });

  it('should register a Fan device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Fan') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    const mbDevice = haPlatform.matterbridgeDevices.get('1adb7198570f7bf0662d99618def644e');
    expect(mbDevice).toBeDefined();
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`- subscribe: ${CYAN}FanControl${db}:${CYAN}fanMode${db}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    jest.clearAllMocks();
    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
      }
    }
    const state = {
      entity_id: 'fan.fan_fan',
      state: 'unknownstate',
      last_changed: '',
      last_reported: '',
      last_updated: '',
      attributes: {},
    } as HassState;
    await haPlatform.updateHandler(device.id, 'fan.fan_fan', state, state);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Received update event from Home Assistant device`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining(`Update state ${CYAN}fan${wr}:${CYAN}unknownstate${wr} not supported for entity fan.fan_fan`));
    expect(setAttributeSpy).toHaveBeenCalledWith(FanControl.Cluster.id, 'fanMode', expect.anything(), expect.anything());

    const child = mbDevice?.getChildEndpointByName('fanfan_fan');
    expect(child).toBeDefined();
    // console.error('Event of FanCluster', child?.events['fanControl']['fanMode$Changed']['#observers']);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // await mbDevice.act((agent) => agent['fanControl'].events['fanMode$Changed'].emit({}, agent.context));
  });

  it('should register a Thermostat heat_cool device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Thermostat') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    const mbDevice = haPlatform.matterbridgeDevices.get('3898c5aa5d1c14b05406b7007d8d347f');
    expect(mbDevice).toBeDefined();
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`- subscribe: ${CYAN}Thermostat${db}:${CYAN}systemMode${db}`);
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Subscribed endpoint`));
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
      }
    }

    /*
    await wait(1000); // wait for the thermostat to be configured
    const child = mbDevice?.getChildEndpointByName('climatethermostat_thermostat');
    expect(child).toBeDefined();
    console.error('Event of ThermostatCluster', child?.events['thermostat']);
    console.error('Event of ThermostatCluster:systemMode$Changed', child?.events['thermostat']['systemMode$Changed']);
    console.error('Observers of ThermostatCluster', child?.events['thermostat']['systemMode$Changed']['#observers']);
    */
  });

  it('should register a Thermostat heat device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Thermostat (Heat)') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    // expect(mockLog.debug).toHaveBeenCalledWith(`- subscribe: ${CYAN}Thermostat (Heat)${db}:${CYAN}systemMode${db} check ${CYAN}true${db}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
      }
    }
  });

  it('should register a Cover device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Cover') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    const mbDevice = haPlatform.matterbridgeDevices.get('b684c54436937eea8bfd0884cf4b4547');
    expect(mbDevice).toBeDefined();
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    jest.clearAllMocks();
    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
        // console.error(`Updating state for ${state.entity_id} with value ${debugStringify(state)}`);
      }
    }
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Received update event from Home Assistant device`));
    expect(setAttributeSpy).toHaveBeenCalledWith(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths', expect.anything(), expect.anything());
  });

  it('should register a Contact device from ha', async () => {
    expect(haPlatform).toBeDefined();

    let device: HassDevice | undefined;
    (mockData.devices as HassDevice[]).forEach((d) => {
      if (d.name === 'Eve door') device = d;
    });
    expect(device).toBeDefined();
    if (!device) return;
    haPlatform.ha.hassDevices.set(device.id, device);
    for (const entity of mockData.entities) if (entity.device_id === device.id) haPlatform.ha.hassEntities.set(entity.entity_id, entity);
    for (const state of mockData.states) if (haPlatform.ha.hassEntities.has(state.entity_id)) haPlatform.ha.hassStates.set(state.entity_id, state);

    await haPlatform.onStart('Test reason');

    const mbDevice = haPlatform.matterbridgeDevices.get('426162cdc13e45802d5a132299630d21');
    // console.error(haPlatform.matterbridgeDevices.keys());
    expect(mbDevice).toBeDefined();
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${device.name}${rs}${nf} id ${CYAN}${device.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${device.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();

    await haPlatform.onConfigure();
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`for device ${CYAN}${device.id}${db}`));

    jest.clearAllMocks();
    for (const state of mockData.states) {
      if (haPlatform.ha.hassEntities.has(state.entity_id)) {
        await haPlatform.updateHandler(device.id, state.entity_id, state, state);
      }
    }
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`${db}Received update event from Home Assistant device`));
    expect(setAttributeSpy).toHaveBeenCalledWith(BooleanState.Cluster.id, 'stateValue', expect.anything(), expect.anything());
  });

  it('should register a switch device from ha', async () => {
    expect(haPlatform).toBeDefined();

    haPlatform.ha.hassDevices.set(switchDevice.id, switchDevice as unknown as HassDevice);
    haPlatform.ha.hassEntities.set(switchDeviceEntity.entity_id, switchDeviceEntity as unknown as HassEntity);
    haPlatform.ha.hassStates.set(switchDeviceEntityState.entity_id, switchDeviceEntityState as unknown as HassState);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${switchDevice.name}${rs}${nf} id ${CYAN}${switchDevice.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${switchDevice.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled(); // Duplicated device name
  });

  it('should not register a switch device from ha without states', async () => {
    expect(haPlatform).toBeDefined();

    haPlatform.ha.hassDevices.set(switchDevice.id, switchDevice as unknown as HassDevice);
    haPlatform.ha.hassEntities.set(switchDeviceEntity.entity_id, switchDeviceEntity as unknown as HassEntity);
    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    // expect(mockLog.debug).toHaveBeenCalledWith(`Lookup device ${CYAN}${switchDevice.name}${db} entity ${CYAN}${switchDeviceEntity.entity_id}${db}: state not found`);
    expect(mockLog.debug).not.toHaveBeenCalledWith(`Registering device ${dn}${switchDevice.name}${db}...`);
  });

  it('should register a thermo auto device from ha', async () => {
    expect(haPlatform).toBeDefined();

    haPlatform.ha.hassDevices.set(autoDevice.id, autoDevice as unknown as HassDevice);
    haPlatform.ha.hassEntities.set(autoDeviceEntity.entity_id, autoDeviceEntity as unknown as HassEntity);
    haPlatform.ha.hassStates.set(autoDeviceEntityState.entity_id, autoDeviceEntityState as unknown as HassState);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${autoDevice.name}${rs}${nf} id ${CYAN}${autoDevice.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${autoDevice.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();
  });

  it('should register a thermo heat device from ha', async () => {
    expect(haPlatform).toBeDefined();

    haPlatform.ha.hassDevices.set(heatDevice.id, heatDevice as unknown as HassDevice);
    haPlatform.ha.hassEntities.set(heatDeviceEntity.entity_id, heatDeviceEntity as unknown as HassEntity);
    haPlatform.ha.hassStates.set(heatDeviceEntityState.entity_id, heatDeviceEntityState as unknown as HassState);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${heatDevice.name}${rs}${nf} id ${CYAN}${heatDevice.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${heatDevice.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled();
  });

  it('should register a thermo cool device from ha', async () => {
    expect(haPlatform).toBeDefined();

    haPlatform.ha.hassDevices.set(coolDevice.id, coolDevice as unknown as HassDevice);
    haPlatform.ha.hassEntities.set(coolDeviceEntity.entity_id, coolDeviceEntity as unknown as HassEntity);
    haPlatform.ha.hassStates.set(coolDeviceEntityState.entity_id, coolDeviceEntityState as unknown as HassState);

    await haPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${coolDevice.name}${rs}${nf} id ${CYAN}${coolDevice.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${coolDevice.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled(); // Duplicated device name
  });

  it('should register a contact sensor device from ha', async () => {
    expect(haPlatform).toBeDefined();

    haPlatform.ha.hassDevices.set(contactSensorDevice.id, contactSensorDevice as unknown as HassDevice);
    haPlatform.ha.hassEntities.set(contactSensorEntity.entity_id, contactSensorEntity as unknown as HassEntity);
    haPlatform.ha.hassStates.set(contactSensorEntityState.entity_id, contactSensorEntityState as unknown as HassState);

    await haPlatform.onStart('Test reason');

    const mbDevice = haPlatform.matterbridgeDevices.get('38ff72694f19502223744fbb8bfcdef9');
    expect(mbDevice).toBeDefined();
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${contactSensorDevice.name}${rs}${nf} id ${CYAN}${contactSensorDevice.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${contactSensorDevice.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled(); // Duplicated device name

    contactSensorEntityState.state = 'off';
    await haPlatform.updateHandler(contactSensorDevice.id, contactSensorEntity.entity_id, contactSensorEntityState as HassState, contactSensorEntityState as HassState);
    expect(setAttributeSpy).toHaveBeenCalledWith(BooleanState.Cluster.id, 'stateValue', true, expect.anything());

    jest.clearAllMocks();
    contactSensorEntityState.state = 'on';
    await haPlatform.updateHandler(contactSensorDevice.id, contactSensorEntity.entity_id, contactSensorEntityState as HassState, contactSensorEntityState as HassState);
    expect(setAttributeSpy).toHaveBeenCalledWith(BooleanState.Cluster.id, 'stateValue', false, expect.anything());

    jest.clearAllMocks();
    const oldState = { ...contactSensorEntityState };
    contactSensorEntityState.state = 'unavailable';
    await haPlatform.updateHandler(contactSensorDevice.id, contactSensorEntity.entity_id, oldState as HassState, contactSensorEntityState as HassState);
    expect(setAttributeSpy).toHaveBeenCalledWith(BridgedDeviceBasicInformation.Cluster.id, 'reachable', false, expect.anything());

    jest.clearAllMocks();
    oldState.state = 'unavailable';
    contactSensorEntityState.state = 'off';
    await haPlatform.updateHandler(contactSensorDevice.id, contactSensorEntity.entity_id, oldState as HassState, contactSensorEntityState as HassState);
    expect(setAttributeSpy).toHaveBeenCalledWith(BridgedDeviceBasicInformation.Cluster.id, 'reachable', true, expect.anything());

    jest.clearAllMocks();
    contactSensorEntityState.attributes.device_class = 'cold';
    await haPlatform.updateHandler(contactSensorDevice.id, contactSensorEntity.entity_id, contactSensorEntityState as HassState, contactSensorEntityState as HassState);
    expect(setAttributeSpy).toHaveBeenCalledWith(BooleanState.Cluster.id, 'stateValue', false, expect.anything());

    jest.clearAllMocks();
    contactSensorEntityState.attributes.device_class = 'moisture';
    await haPlatform.updateHandler(contactSensorDevice.id, contactSensorEntity.entity_id, contactSensorEntityState as HassState, contactSensorEntityState as HassState);
    expect(setAttributeSpy).toHaveBeenCalledWith(BooleanState.Cluster.id, 'stateValue', false, expect.anything());
  });

  it('should register a motion sensor device from ha', async () => {
    expect(haPlatform).toBeDefined();

    haPlatform.ha.hassDevices.set(motionSensorDevice.id, motionSensorDevice as unknown as HassDevice);
    haPlatform.ha.hassEntities.set(motionSensorOccupancyEntity.entity_id, motionSensorOccupancyEntity as unknown as HassEntity);
    haPlatform.ha.hassEntities.set(motionSensorIlluminanceEntity.entity_id, motionSensorIlluminanceEntity as unknown as HassEntity);
    haPlatform.ha.hassStates.set(motionSensorOccupancyEntityState.entity_id, motionSensorOccupancyEntityState as unknown as HassState);
    haPlatform.ha.hassStates.set(motionSensorIlluminanceEntityState.entity_id, motionSensorIlluminanceEntityState as unknown as HassState);

    await haPlatform.onStart('Test reason');

    const mbDevice = haPlatform.matterbridgeDevices.get('38fc72694c39502223744fbb8bfcdef0');
    expect(mbDevice).toBeDefined();
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Creating device ${idn}${motionSensorDevice.name}${rs}${nf} id ${CYAN}${motionSensorDevice.id}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(`Registering device ${dn}${motionSensorDevice.name}${db}...`);
    expect(mockMatterbridge.addBridgedEndpoint).toHaveBeenCalled(); // Duplicated device name

    motionSensorOccupancyEntityState.state = 'off';
    await haPlatform.updateHandler(
      motionSensorDevice.id,
      motionSensorOccupancyEntity.entity_id,
      motionSensorOccupancyEntityState as unknown as HassState,
      motionSensorOccupancyEntityState as unknown as HassState,
    );
    expect(setAttributeSpy).toHaveBeenCalledWith(OccupancySensing.Cluster.id, 'occupancy', { occupied: false }, expect.anything());
    motionSensorIlluminanceEntityState.state = 2500;
    await haPlatform.updateHandler(
      motionSensorDevice.id,
      motionSensorIlluminanceEntity.entity_id,
      motionSensorIlluminanceEntityState as unknown as HassState,
      motionSensorIlluminanceEntityState as unknown as HassState,
    );
    expect(setAttributeSpy).toHaveBeenCalledWith(IlluminanceMeasurement.Cluster.id, 'measuredValue', 33979, expect.anything());
    (motionSensorIlluminanceEntityState.state as any) = 'unknownstate';
    await haPlatform.updateHandler(
      motionSensorDevice.id,
      motionSensorOccupancyEntity.entity_id,
      motionSensorIlluminanceEntityState as unknown as HassState,
      motionSensorIlluminanceEntityState as unknown as HassState,
    );
    (motionSensorIlluminanceEntityState.attributes.device_class as any) = 'unknownclass';
    await haPlatform.updateHandler(
      motionSensorDevice.id,
      motionSensorIlluminanceEntity.entity_id,
      motionSensorIlluminanceEntityState as unknown as HassState,
      motionSensorIlluminanceEntityState as unknown as HassState,
    );
  });

  it('should call onConfigure', async () => {
    haPlatform.ha.hassEntities.set(switchDeviceEntity.entity_id, switchDeviceEntity as unknown as HassEntity);
    haPlatform.ha.hassEntities.set(contactSensorEntity.entity_id, contactSensorEntity as unknown as HassEntity);
    haPlatform.ha.hassEntities.set(motionSensorOccupancyEntity.entity_id, motionSensorOccupancyEntity as unknown as HassEntity);
    haPlatform.ha.hassStates.set(switchDeviceEntityState.entity_id, switchDeviceEntityState as unknown as HassState);
    haPlatform.ha.hassStates.set(contactSensorEntityState.entity_id, contactSensorEntityState as unknown as HassState);
    haPlatform.ha.hassStates.set(motionSensorOccupancyEntityState.entity_id, motionSensorOccupancyEntityState as unknown as HassState);

    await haPlatform.onConfigure();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for async updateHandler operations to complete
    expect(mockLog.info).toHaveBeenCalledWith(`Configuring platform ${idn}${mockConfig.name}${rs}${nf}...`);
    expect(mockLog.info).toHaveBeenCalledWith(`Configured platform ${idn}${mockConfig.name}${rs}${nf}`);
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Configuring state`));
  });

  it('should call onConfigure and throw an error', async () => {
    jest.spyOn(HomeAssistantPlatform.prototype, 'updateHandler').mockImplementationOnce(() => {
      throw new Error('Test error');
    });
    haPlatform.ha.hassEntities.set(switchDeviceEntity.entity_id, switchDeviceEntity as unknown as HassEntity);
    haPlatform.ha.hassEntities.set(contactSensorEntity.entity_id, contactSensorEntity as unknown as HassEntity);
    haPlatform.ha.hassEntities.set(motionSensorOccupancyEntity.entity_id, motionSensorOccupancyEntity as unknown as HassEntity);
    haPlatform.ha.hassStates.set(switchDeviceEntityState.entity_id, switchDeviceEntityState as unknown as HassState);
    haPlatform.ha.hassStates.set(contactSensorEntityState.entity_id, contactSensorEntityState as unknown as HassState);
    haPlatform.ha.hassStates.set(motionSensorOccupancyEntityState.entity_id, motionSensorOccupancyEntityState as unknown as HassState);
    await haPlatform.onConfigure();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for async updateHandler operations to complete
    expect(mockLog.info).toHaveBeenCalledWith(`Configuring platform ${idn}${mockConfig.name}${rs}${nf}...`);
    expect(mockLog.error).toHaveBeenCalledWith(`Error configuring platform ${idn}${mockConfig.name}${rs}${er}: Error: Test error`);
  });

  it('should call onChangeLoggerLevel and log a partial message', async () => {
    await haPlatform.onChangeLoggerLevel(LogLevel.DEBUG);
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining(`Logger level changed to ${LogLevel.DEBUG}`));
  });

  it('should call onShutdown with reason', async () => {
    await haPlatform.onShutdown('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Home Assistant connection closed`);
    expect(mockMatterbridge.removeAllBridgedEndpoints).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for async updateHandler operations to complete
  }, 20000);

  it('should call onShutdown with reason and log error', async () => {
    closeSpy.mockImplementationOnce(() => {
      throw new Error('Test reason');
    });

    await haPlatform.onShutdown('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.error).toHaveBeenCalledWith(`Error closing Home Assistant connection: Error: Test reason`);
    expect(mockMatterbridge.removeAllBridgedEndpoints).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for async updateHandler operations to complete
  }, 20000);

  it('should call onShutdown and unregister', async () => {
    mockConfig.unregisterOnShutdown = true;
    await haPlatform.onShutdown('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockMatterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for async updateHandler operations to complete
  }, 20000);
});

const switchDevice = {
  area_id: null,
  configuration_url: null,
  config_entries: ['01J6J7D7EADB8KNX8XBDYDNB1B'],
  connections: [],
  created_at: 1725044472.632472,
  disabled_by: null,
  entry_type: null,
  hw_version: '1.0.0',
  id: 'd80898f83188759ed7329e97df00ee6a',
  identifiers: [
    ['matter', 'deviceid_CAD2FA0F285B2850-000000000000001C-230'],
    ['matter', 'deviceid_CAD2FA0F285B2850-000000000000001F-2'],
    ['matter', 'serial_0x23452164'],
  ],
  labels: [],
  manufacturer: 'Luligu',
  model: 'Matterbridge Switch',
  model_id: null,
  modified_at: 1726500210.074452,
  name_by_user: null,
  name: 'Switch mock',
  primary_config_entry: '01J6J7D7EADB8KNX8XBDYDNB1B',
  serial_number: '0x23452164',
  sw_version: '1.0.0',
  via_device_id: '09f9d3f59a339f12b621d15dce10bf4f',
};

const switchDeviceEntity = {
  area_id: null,
  categories: {},
  config_entry_id: '01J6J7D7EADB8KNX8XBDYDNB1B',
  created_at: 1726500210.089665,
  device_id: 'd80898f83188759ed7329e97df00ee6a',
  disabled_by: null,
  entity_category: null,
  entity_id: 'switch.switch_switch_2',
  has_entity_name: true,
  hidden_by: null,
  icon: null,
  id: '0b25a337cb83edefb1d310450ad2b0aa',
  labels: [],
  modified_at: 1726500210.093338,
  name: null,
  options: { conversation: { should_expose: true } },
  original_name: 'Switch',
  platform: 'matter',
  translation_key: 'switch',
  unique_id: 'CAD2FA0F285B2850-000000000000001F-2-2-MatterSwitch-6-0',
};

const switchDeviceEntityState = {
  entity_id: 'switch.switch_switch_2',
  state: 'on',
  attributes: { device_class: 'outlet', friendly_name: 'Switch Switch' },
  last_changed: '2024-09-18T18:09:20.344470+00:00',
  last_reported: '2024-09-18T18:09:20.344470+00:00',
  last_updated: '2024-09-18T18:09:20.344470+00:00',
  context: { id: '01J83564ER52RJF78N4S96YHG8', parent_id: null, user_id: null },
};

const autoDevice = {
  area_id: null,
  id: 'd80898f83188759ed7329e97df00ee6f',
  labels: [],
  manufacturer: 'Luligu',
  model: 'Matterbridge Switch',
  model_id: null,
  name_by_user: null,
  name: 'Thermo auto',
  serial_number: '0x23452164',
};

const autoDeviceEntity = {
  area_id: null,
  device_id: 'd80898f83188759ed7329e97df00ee6f',
  entity_id: 'climate.thermo-auto',
  id: '0b25a337cb83edefb1d310450ad2b0aa',
  name: null,
};

const autoDeviceEntityState = {
  entity_id: 'climate.thermo-auto',
  state: 'heat',
  attributes: {
    hvac_modes: ['off', 'heat', 'cool', 'auto'],
    min_temp: 7,
    max_temp: 50,
    current_temperature: 19,
    temperature: 20,
    target_temp_high: null,
    target_temp_low: null,
    friendly_name: 'Thermostat',
  },
};

const heatDevice = {
  area_id: null,
  id: 'd80898f83188759ed7329e97df00ee6a',
  labels: [],
  manufacturer: 'Luligu',
  model: 'Matterbridge Switch',
  model_id: null,
  name_by_user: null,
  name: 'Thermo heat',
  serial_number: '0x23452164',
};

const heatDeviceEntity = {
  area_id: null,
  device_id: 'd80898f83188759ed7329e97df00ee6a',
  entity_id: 'climate.thermo',
  id: '0b25a337cb83edefb1d310450ad2b0aa',
  name: null,
};

const heatDeviceEntityState = {
  entity_id: 'climate.thermo',
  state: 'heat',
  attributes: {
    hvac_modes: ['off', 'heat'],
    min_temp: 7,
    max_temp: 50,
    current_temperature: 19,
    temperature: 20,
    target_temp_high: null,
    target_temp_low: null,
    friendly_name: 'Thermostat',
  },
};

const coolDevice = {
  area_id: null,
  id: 'd80898f83188759ed7329e97df00ee6a',
  labels: [],
  manufacturer: 'Luligu',
  model: 'Matterbridge Switch',
  model_id: null,
  name_by_user: null,
  name: 'Thermo cool',
  serial_number: '0x23452164',
};

const coolDeviceEntity = {
  area_id: null,
  device_id: 'd80898f83188759ed7329e97df00ee6a',
  entity_id: 'climate.thermo',
  id: '0b25a337cb83edefb1d310450ad2b0aa',
  name: null,
};

const coolDeviceEntityState = {
  entity_id: 'climate.thermo',
  state: 'cool',
  attributes: {
    hvac_modes: ['off', 'cool'],
    min_temp: 7,
    max_temp: 50,
    current_temperature: 19,
    temperature: 20,
    target_temp_high: null,
    target_temp_low: null,
    friendly_name: 'Thermostat',
  },
};

const contactSensorDevice = {
  area_id: null,
  hw_version: '1.0.0',
  id: '38ff72694f19502223744fbb8bfcdef9',
  labels: [],
  manufacturer: 'Eve Systems',
  model: 'Eve door',
  model_id: null,
  name_by_user: null,
  name: 'Eve door contact',
  serial_number: '0x85483499',
  sw_version: '3.2.1',
};
const contactSensorEntity = {
  area_id: null,
  device_id: contactSensorDevice.id,
  entity_category: null,
  entity_id: 'binary_sensor.eve_door_contact',
  has_entity_name: true,
  icon: null,
  id: '767f48a9d7986368765fd272711eb8e7',
  labels: [],
  name: null,
  original_name: 'Door',
  platform: 'matter',
};
const contactSensorEntityState = {
  entity_id: contactSensorEntity.entity_id,
  state: 'on',
  attributes: {
    device_class: 'door',
    friendly_name: 'Eve door contact',
  },
  last_changed: '2025-05-29T11:40:02.628762+00:00',
  last_reported: '2025-05-29T11:40:02.628762+00:00',
  last_updated: '2025-05-29T11:40:02.628762+00:00',
};

const motionSensorDevice = {
  area_id: null,
  hw_version: '1.0.0',
  id: '38fc72694c39502223744fbb8bfcdef0',
  labels: [],
  manufacturer: 'Eve Systems',
  model: 'Eve motion',
  model_id: null,
  name_by_user: null,
  name: 'Eve motion occupancy illuminance',
  serial_number: '0x85483499',
  sw_version: '3.2.1',
};
const motionSensorOccupancyEntity = {
  area_id: null,
  device_id: motionSensorDevice.id,
  entity_category: null,
  entity_id: 'binary_sensor.eve_motion_occupancy_x',
  has_entity_name: true,
  icon: null,
  id: '767f48a9d7986368765fd272711eb8e5',
  labels: [],
  name: null,
  original_name: 'Occupancy',
  platform: 'matter',
};
const motionSensorOccupancyEntityState = {
  entity_id: motionSensorOccupancyEntity.entity_id,
  state: 'on',
  attributes: {
    device_class: 'occupancy',
    friendly_name: 'Eve motion Occupancy',
  },
  last_changed: '2025-05-29T11:40:02.628762+00:00',
  last_reported: '2025-05-29T11:40:02.628762+00:00',
  last_updated: '2025-05-29T11:40:02.628762+00:00',
};
const motionSensorIlluminanceEntity = {
  area_id: null,
  device_id: motionSensorDevice.id,
  entity_category: null,
  entity_id: 'sensor.eve_motion_illuminance_x',
  has_entity_name: true,
  icon: null,
  id: '767f48a9d79863687621d272711eb8e9',
  labels: [],
  name: null,
  original_name: 'Illuminance',
  platform: 'matter',
};
const motionSensorIlluminanceEntityState = {
  entity_id: motionSensorIlluminanceEntity.entity_id,
  state: 480.5,
  attributes: {
    state_class: 'measurement',
    device_class: 'illuminance',
    friendly_name: 'Eve motion Illuminance',
  },
  last_changed: '2025-05-29T11:40:02.628762+00:00',
  last_reported: '2025-05-29T11:40:02.628762+00:00',
  last_updated: '2025-05-29T11:40:02.628762+00:00',
};
