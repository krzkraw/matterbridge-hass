/* eslint-disable jest/no-conditional-expect */
// Home Assistant WebSocket Client Tests

/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */

import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { WebSocket, WebSocketServer } from 'ws';
import { AnsiLogger, CYAN, db, LogLevel } from 'matterbridge/logger';
import { wait } from 'matterbridge/utils';

import { HassArea, HassConfig, HassDevice, HassEntity, HassServices, HassState, HomeAssistant } from './homeAssistant'; // Adjust the import path as necessary

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

describe('HomeAssistant', () => {
  let server: WebSocketServer;
  let client: WebSocket;
  let homeAssistant: HomeAssistant;
  const wsUrl = 'ws://localhost:8123';
  const apiPath = '/api/websocket';
  const accessToken = 'testAccessToken';
  const reconnectTimeoutTime = 120;
  const reconnectRetries = 10;

  const device_registry_response: HassDevice[] = [];
  const entity_registry_response: HassEntity[] = [];
  const area_registry_response: HassArea[] = [];
  const states_response: HassState[] = [];
  const services_response: HassServices = {};
  const config_response: HassConfig = {} as HassConfig;

  beforeAll(async () => {
    server = new WebSocketServer({ port: 8123, path: apiPath });

    server.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress;
      // console.log('WebSocket server new client connected:', ip);

      // Simulate sending "auth_required" when the client connects
      ws.send(JSON.stringify({ type: 'auth_required' }));

      ws.on('message', (message) => {
        const msg = JSON.parse(message.toString());
        // console.log('WebSocket server received a message:', msg);
        if (msg.type === 'auth' && msg.access_token === accessToken) {
          ws.send(JSON.stringify({ type: 'auth_ok' }));
        } else if (msg.type === 'ping') {
          ws.send(JSON.stringify({ id: msg.id, type: 'pong', success: true, result: {} }));
        } else if (msg.type === 'get_config') {
          ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: config_response }));
        } else if (msg.type === 'get_services') {
          ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: services_response }));
        } else if (msg.type === 'config/device_registry/list') {
          ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: device_registry_response }));
        } else if (msg.type === 'config/entity_registry/list') {
          ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: entity_registry_response }));
        } else if (msg.type === 'config/area_registry/list') {
          ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: area_registry_response }));
        } else if (msg.type === 'get_states') {
          ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: states_response }));
        } else if (msg.type === 'subscribe_events') {
          ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true }));
        } else if (msg.type === 'call_service') {
          ws.send(JSON.stringify({ id: (homeAssistant as any).eventsSubscribeId, type: 'event', success: true, event: { event_type: 'call_service' } }));
          ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: {} }));
        }
      });
    });

    server.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    await new Promise((resolve) => {
      server.on('listening', () => {
        console.log('WebSocket server listening on', wsUrl + apiPath);
        resolve(undefined);
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    //
  });

  afterAll(async () => {
    for (const client of server.clients) {
      client.terminate();
    }

    await new Promise((resolve) => {
      server.close(() => {
        resolve(undefined);
      });
    });
  });

  it('client should connect', async () => {
    client = new WebSocket(wsUrl + apiPath);
    expect(client).toBeInstanceOf(WebSocket);

    return new Promise((resolve) => {
      client.on('open', () => {
        console.log('WebSocket client connected');
        resolve(undefined);
      });
    });
  });

  it('client should close', async () => {
    expect(client).toBeInstanceOf(WebSocket);

    return new Promise((resolve) => {
      client.on('close', () => {
        console.log('WebSocket client closed');
        resolve(undefined);
      });
      client.close();
    });
  });

  it('should create an instance of HomeAssistant', () => {
    homeAssistant = new HomeAssistant(wsUrl, accessToken, reconnectTimeoutTime, reconnectRetries);
    expect(homeAssistant).toBeDefined();
    expect(homeAssistant.wsUrl).toBe(wsUrl);
    expect(homeAssistant.wsAccessToken).toBe(accessToken);
    expect((homeAssistant as any).reconnectTimeoutTime).toBe(reconnectTimeoutTime * 1000);
    expect((homeAssistant as any).reconnectRetries).toBe(reconnectRetries);
    expect(homeAssistant).toBeInstanceOf(HomeAssistant);
  });

  it('fetchAsync should log error for async if not connected to HomeAssistant', async () => {
    try {
      await homeAssistant.fetch('get_states', undefined, 1000);
    } catch (error) {
      expect(error.message).toBe('FetchAsync error: not connected to Home Assistant');
    }
  });

  it('callServiceAsync should log error for async if not connected to HomeAssistant', async () => {
    try {
      await homeAssistant.callService('light', 'turn_on', 'myentityid', {}, undefined, 1000);
    } catch (error) {
      expect(error.message).toBe('CallServiceAsync error: not connected to Home Assistant');
    }
  });

  it('fetchAsync should log error for async if ws is not connected to HomeAssistant', async () => {
    homeAssistant.connected = true;
    try {
      await homeAssistant.fetch('get_states', undefined, 1000);
    } catch (error) {
      expect(error.message).toBe('FetchAsync error: WebSocket not open');
    }
    homeAssistant.connected = false;
  });

  it('callServiceAsync should log error for async if ws is not connected to HomeAssistant', async () => {
    homeAssistant.connected = true;
    try {
      await homeAssistant.callService('light', 'turn_on', 'myentityid', {}, undefined, 1000);
    } catch (error) {
      expect(error.message).toBe('CallServiceAsync error: WebSocket not open');
    }
    homeAssistant.connected = false;
  });

  it('should establish a WebSocket connection to Home Assistant', async () => {
    await new Promise<void>((resolve) => {
      homeAssistant.once('started', () => {
        resolve();
      });
      homeAssistant.connect();
    });

    expect(homeAssistant.connected).toBe(true);
    expect(homeAssistant.ws).not.toBeNull();
    expect((homeAssistant as any).reconnectTimeoutTime).toBe(120 * 1000);
    expect((homeAssistant as any).reconnectRetries).toBe(10);
    expect((homeAssistant as any).pingInterval).not.toBeNull();
    expect((homeAssistant as any).pingTimeout).toBeNull();
    expect((homeAssistant as any).reconnectTimeout).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Connecting to Home Assistant on ${homeAssistant.wsUrl}...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket connection established`);

    expect(server.clients.size).toBe(1);
    client = Array.from(server.clients)[0];
  });

  it('should not establish a new WebSocket connection to Home Assistant', async () => {
    homeAssistant.connect();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Already connected to Home Assistant`);
  });

  it('should log error if cannot parse message from Home Assistant', async () => {
    client.send('invalid message');
    await wait(1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error parsing WebSocket message: SyntaxError: Unexpected token`));
  });

  it('should log error if result messages from Home Assistant has success false', async () => {
    homeAssistant.once('error', (error) => {
      expect(error).toBe('WebSocket response error: unknown error');
    });
    client.send(JSON.stringify({ type: 'result', success: false }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket response error: WebSocket response error: unknown error`);
  });

  it('should update the devices from Home Assistant', async () => {
    client.send(JSON.stringify({ type: 'result', id: (homeAssistant as any).devicesFetchId, success: true, result: [{ id: 'mydeviceid', name: 'My Device' }] }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Received 1 devices.`);
    expect(homeAssistant.hassDevices.get('mydeviceid')).toBeDefined();
    expect(homeAssistant.hassDevices.get('mydeviceid')?.name).toBe('My Device');
    homeAssistant.hassDevices.clear(); // Clear the devices for next tests
  });

  it('should update the entities from Home Assistant', async () => {
    client.send(JSON.stringify({ type: 'result', id: (homeAssistant as any).entitiesFetchId, success: true, result: [{ entity_id: 'myentityid', device_id: 'mydeviceid' }] }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Received 1 entities.`);
    expect(homeAssistant.hassEntities.get('myentityid')).toBeDefined();
    expect(homeAssistant.hassEntities.get('myentityid')?.device_id).toBe('mydeviceid');
    homeAssistant.hassEntities.clear(); // Clear the entities for next tests
  });

  it('should update the areas from Home Assistant', async () => {
    client.send(JSON.stringify({ type: 'result', id: (homeAssistant as any).areasFetchId, success: true, result: [{ area_id: 'myareaid', name: 'My Area' }] }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Received 1 areas.`);
    expect(homeAssistant.hassAreas.get('myareaid')).toBeDefined();
    expect(homeAssistant.hassAreas.get('myareaid')?.name).toBe('My Area');
    homeAssistant.hassAreas.clear(); // Clear the areas for next tests
  });

  it('should update the states from Home Assistant', async () => {
    client.send(JSON.stringify({ type: 'result', id: (homeAssistant as any).statesFetchId, success: true, result: [{ entity_id: 'myentityid', state: 'on' }] }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Received 1 states.`);
    expect(homeAssistant.hassStates.get('myentityid')).toBeDefined();
    expect(homeAssistant.hassStates.get('myentityid')?.state).toBe('on');
    homeAssistant.hassStates.clear(); // Clear the states for next tests
  });

  it('should update the config from Home Assistant', async () => {
    client.send(JSON.stringify({ type: 'result', id: (homeAssistant as any).configFetchId, success: true, result: { some_config: 'value' } }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Received config.`);
    expect(homeAssistant.hassConfig).toEqual({ some_config: 'value' });
  });

  it('should update the services from Home Assistant', async () => {
    client.send(JSON.stringify({ type: 'result', id: (homeAssistant as any).servicesFetchId, success: true, result: { some_service: 'value' } }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Received services.`);
    expect(homeAssistant.hassServices).toEqual({ some_service: 'value' });
  });

  it('should subscribe to events from Home Assistant', async () => {
    client.send(JSON.stringify({ type: 'result', id: (homeAssistant as any).eventsSubscribeId, success: true }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Subscribed to events.`);
    expect(homeAssistant.subscribed).toBe(true);
  });

  it('should log unknown result from Home Assistant', async () => {
    client.send(JSON.stringify({ type: 'result', id: -1, success: true }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Unknown result received id -1`);
  });

  it('should log react to pong from Home Assistant', async () => {
    expect((homeAssistant as any).pingTimeout).toBeNull();
    await new Promise<void>((resolve) => {
      homeAssistant.once('pong', () => {
        resolve();
      });
      client.send(JSON.stringify({ type: 'pong', id: -2, success: true }));
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Home Assistant pong received with id -2`);
    expect((homeAssistant as any).pingTimeout).toBeNull();
  });

  it('should log error if event messages from Home Assistant are missing data', async () => {
    homeAssistant.once('error', (error) => {
      expect(error).toBe('WebSocket event response missing event data for id undefined');
    });
    client.send(JSON.stringify({ type: 'event' }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'WebSocket event response missing event data for id undefined');
  });

  it('should parse state_changed event messages from Home Assistant', async () => {
    client.send(
      JSON.stringify({
        type: 'event',
        event: { event_type: 'state_changed', data: { entity_id: 'myentityid', new_state: { entity_id: 'myentityid' } } },
        id: (homeAssistant as any).eventsSubscribeId,
      }),
    );
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Entity id ${CYAN}myentityid${db} not found processing event`);
    jest.clearAllMocks();

    homeAssistant.hassEntities.set('myentityid', { entity_id: 'myentityid', device_id: 'mydeviceid' } as any);
    await new Promise<void>((resolve) => {
      homeAssistant.once('event', () => {
        resolve();
      });
      client.send(
        JSON.stringify({
          type: 'event',
          event: { event_type: 'state_changed', data: { entity_id: 'myentityid', old_state: { entity_id: 'myentityid' }, new_state: { entity_id: 'myentityid' } } },
          id: (homeAssistant as any).eventsSubscribeId,
        }),
      );
    });
    expect(homeAssistant.hassStates.get('myentityid')).toEqual({ entity_id: 'myentityid' });
  });

  it('should parse call_service event messages from Home Assistant', async () => {
    await new Promise<void>((resolve) => {
      homeAssistant.once('call_service', () => {
        resolve();
      });
      client.send(JSON.stringify({ type: 'event', event: { event_type: 'call_service' }, id: (homeAssistant as any).eventsSubscribeId }));
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Event ${CYAN}call_service${db} received id ${CYAN}${(homeAssistant as any).eventsSubscribeId}${db}`);
  });

  it('should parse device_registry_updated event messages from Home Assistant', async () => {
    device_registry_response.push({ id: 'mydeviceid', name: 'My Device' } as HassDevice);
    await new Promise<void>((resolve) => {
      homeAssistant.once('devices', () => {
        resolve();
      });
      client.send(JSON.stringify({ type: 'event', event: { event_type: 'device_registry_updated' }, id: (homeAssistant as any).eventsSubscribeId }));
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Event ${CYAN}device_registry_updated${db} received id ${CYAN}${(homeAssistant as any).eventsSubscribeId}${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Received 1 devices.`);
    expect(homeAssistant.hassDevices.get('mydeviceid')).toBeDefined();
    expect(homeAssistant.hassDevices.get('mydeviceid')?.name).toBe('My Device');
    device_registry_response.splice(0, device_registry_response.length); // Clear the response for next tests
  });

  it('should parse entity_registry_updated event messages from Home Assistant', async () => {
    entity_registry_response.push({ entity_id: 'myentityid', device_id: 'mydeviceid' } as HassEntity);
    await new Promise<void>((resolve) => {
      homeAssistant.once('entities', () => {
        resolve();
      });
      client.send(JSON.stringify({ type: 'event', event: { event_type: 'entity_registry_updated' }, id: (homeAssistant as any).eventsSubscribeId }));
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Event ${CYAN}entity_registry_updated${db} received id ${CYAN}${(homeAssistant as any).eventsSubscribeId}${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Received 1 entities.`);
    expect(homeAssistant.hassEntities.get('myentityid')).toBeDefined();
    expect(homeAssistant.hassEntities.get('myentityid')?.device_id).toBe('mydeviceid');
    entity_registry_response.splice(0, entity_registry_response.length); // Clear the response for next tests
  });

  it('should parse area_registry_updated event messages from Home Assistant', async () => {
    area_registry_response.push({ area_id: 'myareaid', name: 'My Area' } as HassArea);
    await new Promise<void>((resolve) => {
      homeAssistant.once('areas', () => {
        resolve();
      });
      client.send(JSON.stringify({ type: 'event', event: { event_type: 'area_registry_updated' }, id: (homeAssistant as any).eventsSubscribeId }));
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Event ${CYAN}area_registry_updated${db} received id ${CYAN}${(homeAssistant as any).eventsSubscribeId}${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Received 1 areas.`);
    expect(homeAssistant.hassAreas.get('myareaid')).toBeDefined();
    expect(homeAssistant.hassAreas.get('myareaid')?.name).toBe('My Area');
    area_registry_response.splice(0, area_registry_response.length); // Clear the response for next tests
  });

  it('should log error if unknown event messages from Home Assistant', async () => {
    client.send(JSON.stringify({ type: 'event', event: { event_type: 'unknown' } }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `*Unknown event type ${CYAN}unknown${db} received id ${CYAN}undefined${db}`);
  });

  it('should react to pong from websocket', async () => {
    expect((homeAssistant as any).pingTimeout).toBeNull();
    client.pong();
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket pong received`);
    expect((homeAssistant as any).pingTimeout).toBeNull();
  });

  it('should get the devices asyncronously from Home Assistant', async () => {
    device_registry_response.push({ id: 'mydeviceid', name: 'My Device' } as HassDevice);
    const devices = await homeAssistant.fetch('config/device_registry/list');
    expect(devices).toEqual([{ id: 'mydeviceid', name: 'My Device' }]);
    device_registry_response.splice(0, device_registry_response.length); // Clear the response for next tests
  });

  it('should get the entities asyncronously from Home Assistant', async () => {
    entity_registry_response.push({ entity_id: 'myentityid', device_id: 'mydeviceid' } as HassEntity);
    const entities = await homeAssistant.fetch('config/entity_registry/list', undefined, 1000);
    expect(entities).toEqual([{ entity_id: 'myentityid', device_id: 'mydeviceid' }]);
    entity_registry_response.splice(0, entity_registry_response.length); // Clear the response for next tests
  });

  it('should get the areas asyncronously from Home Assistant', async () => {
    const areas = await homeAssistant.fetch('config/area_registry/list', undefined, 1000);
    expect(areas).toEqual([]);
  });

  it('should get the states asyncronously from Home Assistant', async () => {
    const states = await homeAssistant.fetch('get_states', undefined, 1000);
    expect(states).toEqual([]);
  });

  it('should get the config asyncronously from Home Assistant', async () => {
    const config = await homeAssistant.fetch('get_config', undefined, 1000);
    expect(config).toEqual({});
  });

  it('should get the services asyncronously from Home Assistant', async () => {
    const services = await homeAssistant.fetch('get_services', undefined, 1000);
    expect(services).toEqual({});
  });

  it('should request async call_service from Home Assistant', async () => {
    const response = await homeAssistant.callService('light', 'turn_on', 'myentityid');
    expect(response).toEqual({});
  });

  it('should request async call_service with params from Home Assistant', async () => {
    const response = await homeAssistant.callService('light', 'turn_on', 'myentityid', {}, undefined, 1000);
    expect(response).toEqual({});
  });

  it('should close the WebSocket connection to Home Assistant on error', async () => {
    (homeAssistant as any).startPing();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Ping interval already started`);
    await new Promise<void>((resolve) => {
      homeAssistant.on('disconnected', () => {
        resolve();
      });
      client.close(undefined, 'Bye');
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket connection closed. Reason:  Code: 1005 Clean: true Type: close`);
    expect((homeAssistant as any).reconnectTimeout).not.toBeNull();
    homeAssistant.close();
    expect((homeAssistant as any).reconnectTimeout).toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closing Home Assistant connection...`);
    expect(homeAssistant.connected).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Home Assistant connection closed`);
    expect(homeAssistant.connected).toBe(false);
    expect(homeAssistant.ws).toBeNull();
    expect((homeAssistant as any).pingInterval).toBeNull();
    expect((homeAssistant as any).pingTimeout).toBeNull();
    expect((homeAssistant as any).reconnectTimeout).toBeNull();
    homeAssistant.removeAllListeners(); // Remove all listeners to avoid memory leaks
  });

  it('should not connect if wsUrl is not ws:// or wss://', async () => {
    homeAssistant = new HomeAssistant('http://localhost:8123', accessToken, reconnectTimeoutTime, reconnectRetries);

    await new Promise((resolve) => {
      homeAssistant.once('error', () => {
        homeAssistant.close();
        resolve(undefined);
      });
      homeAssistant.connect();
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `WebSocket error connecting to Home Assistant: Error: Invalid WebSocket URL: http://localhost:8123. It must start with ws:// or wss://`,
    );
    expect(homeAssistant.connected).toBe(false);
    homeAssistant.close();
    homeAssistant.removeAllListeners(); // Remove all listeners to avoid memory leaks
  });

  it('should not connect if wsUrl is wss:// and certificate are not present', async () => {
    homeAssistant = new HomeAssistant('wss://localhost:8123', accessToken, reconnectTimeoutTime, reconnectRetries, './invalid/cert.pem');

    await new Promise((resolve) => {
      homeAssistant.once('error', () => {
        homeAssistant.close();
        resolve(undefined);
      });
      homeAssistant.connect();
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Loading CA certificate from ./invalid/cert.pem...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`WebSocket error connecting to Home Assistant: Error: ENOENT`));
    expect(homeAssistant.connected).toBe(false);
    homeAssistant.close();
    homeAssistant.removeAllListeners(); // Remove all listeners to avoid memory leaks
  });

  it('should not connect if wsUrl is wss:// and certificate are not correct', async () => {
    homeAssistant = new HomeAssistant('wss://localhost:8123', accessToken, reconnectTimeoutTime, reconnectRetries, './mock/homeassistant.crt');

    await new Promise((resolve) => {
      homeAssistant.once('error', () => {
        homeAssistant.close();
        resolve(undefined);
      });
      homeAssistant.connect();
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Loading CA certificate from ./mock/homeassistant.crt...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `CA certificate loaded successfully`);
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`WebSocket error:`));
    expect(homeAssistant.connected).toBe(false);
    homeAssistant.close();
    homeAssistant.removeAllListeners(); // Remove all listeners to avoid memory leaks
  });

  it('should react to connection events with Home Assistant', async () => {
    homeAssistant = new HomeAssistant(wsUrl, accessToken, reconnectTimeoutTime, reconnectRetries);

    jest.useFakeTimers();

    await new Promise<void>((resolve) => {
      homeAssistant.once('started', () => {
        resolve();
      });
      homeAssistant.connect();
    });
    expect(homeAssistant.connected).toBe(true);
    expect(homeAssistant.ws).not.toBeNull();
    expect((homeAssistant as any).reconnectTimeoutTime).toBe(reconnectTimeoutTime * 1000);
    expect((homeAssistant as any).reconnectRetries).toBe(reconnectRetries);
    expect((homeAssistant as any).pingInterval).not.toBeNull();
    expect((homeAssistant as any).pingTimeout).toBeNull();
    expect((homeAssistant as any).reconnectTimeout).toBeNull();
    expect(server.clients.size).toBe(1);
    client = Array.from(server.clients)[0];

    jest.clearAllMocks();
    (homeAssistant as any).startPing();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Ping interval already started`);

    jest.clearAllMocks();
    await new Promise<void>((resolve) => {
      homeAssistant.once('disconnected', () => {
        resolve();
      });
      client.close(undefined, 'Bye');
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'WebSocket connection closed. Reason:  Code: 1005 Clean: true Type: close');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Reconnecting in 120 seconds...`);
    expect((homeAssistant as any).reconnectTimeout).not.toBeNull();
    expect((homeAssistant as any).reconnectRetries).toBe(reconnectRetries);

    jest.clearAllMocks();
    (homeAssistant as any).startReconnect();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Reconnecting already in progress.');

    jest.clearAllMocks();
    jest.advanceTimersByTime(reconnectTimeoutTime * 1000);

    jest.useRealTimers();

    await new Promise<void>((resolve) => {
      homeAssistant.once('started', () => {
        resolve();
      });
    });
    expect(homeAssistant.connected).toBe(true);
    expect(homeAssistant.ws).not.toBeNull();

    jest.clearAllMocks();
    await new Promise<void>((resolve) => {
      const errorHandler = () => {
        resolve();
      };
      homeAssistant.once('error', errorHandler);
      homeAssistant.ws?.emit('error', new Error('Test error'));
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'WebSocket error: Test error type: error');

    homeAssistant.close();
    homeAssistant.removeAllListeners(); // Remove all listeners to avoid memory leaks
  });

  it('should send ping to Home Assistant', async () => {
    homeAssistant = new HomeAssistant(wsUrl, accessToken, 0, 0);
    expect((homeAssistant as any).reconnectTimeoutTime).toBe(0);
    expect((homeAssistant as any).reconnectRetries).toBe(0);

    jest.useFakeTimers();

    await new Promise((resolve) => {
      homeAssistant.once('started', () => {
        resolve(undefined);
      });
      homeAssistant.connect();
    });

    expect(homeAssistant.connected).toBe(true);
    expect(homeAssistant.ws).not.toBeNull();
    expect((homeAssistant as any).pingInterval).not.toBeNull();
    expect((homeAssistant as any).pingTimeout).toBeNull();
    expect((homeAssistant as any).reconnectTimeout).toBeNull();

    jest.advanceTimersByTime((homeAssistant as any).pingIntervalTime);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Sending WebSocket ping...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Sending Home Assistant ping id`));
    expect((homeAssistant as any).pingTimeout).not.toBeNull();

    jest.advanceTimersByTime((homeAssistant as any).pingTimeoutTime);

    jest.useRealTimers();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'Ping timeout. Closing connection...');

    (homeAssistant as any).pingInterval = setInterval(() => {}, 30000);
    (homeAssistant as any).pingTimeout = setTimeout(() => {}, 30000);

    homeAssistant.close();
    expect((homeAssistant as any).pingInterval).toBeNull();
    expect((homeAssistant as any).pingTimeout).toBeNull();
    homeAssistant.removeAllListeners(); // Remove all listeners to avoid memory leaks
  });
});

describe('HomeAssistant with ssl', () => {
  let httpsServer: https.Server;
  let server: WebSocketServer;
  let client: WebSocket;
  let homeAssistant: HomeAssistant;
  const accessToken = 'testAccessToken';
  const reconnectTimeoutTime = 120;
  const reconnectRetries = 10;
  const wsUrl = 'wss://localhost:8123';
  const apiPath = '/api/websocket';

  beforeAll(async () => {
    const serverOptions = {
      cert: fs.readFileSync(path.join('mock', 'homeassistant.crt')),
      key: fs.readFileSync(path.join('mock', 'homeassistant.key')),
    };
    httpsServer = https.createServer(serverOptions);
    server = new WebSocketServer({ server: httpsServer, path: apiPath });
    server.on('connection', (socket, request) => {
      const ip = request.socket.remoteAddress;
      console.log('WebSocket ssl server new client connected:', ip);
      socket.send(JSON.stringify({ type: 'auth_required' }));
      socket.on('message', (message) => {
        const msg = JSON.parse(message.toString());
        console.log('WebSocket ssl server received a message:', msg);
        if (msg.type === 'auth' && msg.access_token === accessToken) {
          socket.send(JSON.stringify({ type: 'auth_ok' }));
        } else if (msg.type === 'ping') {
          socket.send(JSON.stringify({ id: msg.id, type: 'pong', success: true, result: {} }));
        } else if (msg.type === 'get_config') {
          socket.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: {} }));
        } else if (msg.type === 'get_services') {
          socket.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: {} }));
        } else if (msg.type === 'config/device_registry/list') {
          socket.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: [] }));
        } else if (msg.type === 'config/entity_registry/list') {
          socket.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: [] }));
        } else if (msg.type === 'config/area_registry/list') {
          socket.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: [] }));
        } else if (msg.type === 'get_states') {
          socket.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: [] }));
        } else if (msg.type === 'subscribe_events') {
          socket.send(JSON.stringify({ id: msg.id, type: 'result', success: true }));
        } else if (msg.type === 'call_service') {
          socket.send(JSON.stringify({ id: (homeAssistant as any).eventsSubscribeId, type: 'event', success: true, event: { event_type: 'call_service' } }));
          socket.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: {} }));
        }
      });
    });

    await new Promise<void>((resolve) => {
      httpsServer.listen(8123, () => {
        console.log(`🛰️  Test WSS server running on port 8123`);
        resolve();
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    for (const client of server.clients) {
      client.close();
    }
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    await new Promise<void>((resolve) => {
      httpsServer.close(() => {
        resolve();
      });
    });
  });

  it('client should connect', async () => {
    client = new WebSocket(wsUrl + apiPath, {
      rejectUnauthorized: false,
    });

    expect(client).toBeInstanceOf(WebSocket);

    await new Promise<void>((resolve) => {
      client.once('open', () => {
        console.log('WebSocket client connected');
        resolve();
      });
    });
    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it('client should close', async () => {
    expect(client).toBeInstanceOf(WebSocket);

    return new Promise<void>((resolve) => {
      client.once('close', () => {
        console.log('WebSocket client closed');
        resolve();
      });
      client.close();
    });
  });

  it('should connect to Home Assistant with ssl', async () => {
    homeAssistant = new HomeAssistant('wss://localhost:8123', accessToken, reconnectTimeoutTime, reconnectRetries, undefined, false);

    // jest.restoreAllMocks();

    await new Promise<void>((resolve) => {
      homeAssistant.once('started', () => {
        resolve();
      });
      homeAssistant.connect();
    });

    expect(homeAssistant.subscribed).toBe(true);
  });

  it('should have start pingpong', async () => {
    expect((homeAssistant as any).pingInterval).not.toBeNull();
    expect((homeAssistant as any).pingTimeout).toBeNull();
  });

  it('should disconnect from Home Assistant with ssl', async () => {
    expect(homeAssistant.connected).toBe(true);

    await new Promise<void>((resolve) => {
      homeAssistant.once('disconnected', () => {
        resolve();
      });
      homeAssistant.close();
    });

    homeAssistant.removeAllListeners(); // Remove all listeners to avoid memory leaks
  });
});
