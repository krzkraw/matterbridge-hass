/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Matterbridge, MatterbridgeDevice, MatterbridgeEndpoint, PlatformConfig } from 'matterbridge';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { HomeAssistantPlatform } from './platform.js';
import initializePlugin from './index';
import { jest } from '@jest/globals';

describe('initializePlugin', () => {
  let mockMatterbridge: Matterbridge;
  let mockLog: AnsiLogger;
  let mockConfig: PlatformConfig;

  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;

  beforeAll(() => {
    mockMatterbridge = {
      matterbridgeDirectory: './jest/matterbridge',
      matterbridgePluginDirectory: './jest/plugins',
      systemInformation: { ipv4Address: undefined, osRelease: 'xx.xx.xx.xx.xx.xx', nodeVersion: '22.1.10' },
      matterbridgeVersion: '1.7.3',
      edge: false,
      log: mockLog,
      getDevices: jest.fn(() => {
        // console.log('getDevices called');
        return [];
      }),
      getPlugins: jest.fn(() => {
        // console.log('getPlugins called');
        return [];
      }),
      addBridgedDevice: jest.fn(async (pluginName: string, device: MatterbridgeDevice) => {
        // console.log('addBridgedDevice called');
      }),
      addBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {
        // console.log('addBridgedEndpoint called');
        // await aggregator.add(device);
      }),
      removeBridgedDevice: jest.fn(async (pluginName: string, device: MatterbridgeDevice) => {
        // console.log('removeBridgedDevice called');
      }),
      removeBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {
        // console.log('removeBridgedEndpoint called');
      }),
      removeAllBridgedDevices: jest.fn(async (pluginName: string) => {
        // console.log('removeAllBridgedDevices called');
      }),
      removeAllBridgedEndpoints: jest.fn(async (pluginName: string) => {
        // console.log('removeAllBridgedEndpoints called');
      }),
    } as unknown as Matterbridge;

    mockLog = {
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

    mockConfig = {
      'name': 'matterbridge-hass',
      'type': 'DynamicPlatform',
      'blackList': [],
      'whiteList': [],
      'host': 'http://homeassistant.local:8123',
      'token': 'long-lived token',
      'debug': false,
      'unregisterOnShutdown': false,
    } as PlatformConfig;

    // Spy on and mock the AnsiLogger.log method
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.error(`Mocked AnsiLogger.log: ${level} - ${message}`, ...parameters);
    });

    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // console.error('Mocked console.log', args);
    });
  });

  it('should return an instance of HomeAssistantPlatform', () => {
    const platform = initializePlugin(mockMatterbridge, mockLog, mockConfig);
    expect(platform).toBeInstanceOf(HomeAssistantPlatform);
  });
});
