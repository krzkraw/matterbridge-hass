// Home Assistant WebSocket Client Tests

/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */

import { WebSocket, WebSocketServer } from 'ws';
import { HassArea, HassConfig, HassDevice, HassEntity, HassServices, HassState, HomeAssistant } from './homeAssistant'; // Adjust the import path as necessary
import { jest } from '@jest/globals';
import { AnsiLogger, CYAN, db, LogLevel } from 'matterbridge/logger';
import { wait } from 'matterbridge/utils';

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
  const accessToken = 'testAccessToken';
  const reconnectTimeoutTime = 120;
  const reconnectRetries = 10;
  const path = '/api/websocket';

  const device_registry_response: HassDevice[] = [];
  const entity_registry_response: HassEntity[] = [];
  const area_registry_response: HassArea[] = [];
  const states_response: HassState[] = [];
  const services_response: HassServices = {};
  const config_response: HassConfig = {} as HassConfig;

  beforeAll(async () => {
    server = new WebSocketServer({ port: 8123, path });

    server.on('connection', (ws, req) => {
      const ip = req.socket.remoteAddress;
      console.log('WebSocket server new client connected:', ip);

      // Simulate sending "auth_required" when the client connects
      ws.send(JSON.stringify({ type: 'auth_required' }));

      ws.on('message', (message) => {
        const msg = JSON.parse(message.toString());
        console.log('WebSocket server received a message:', msg);
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
        console.log('WebSocket server listening on', wsUrl + path);
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
    client = new WebSocket(wsUrl + path);
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

  it('fetch should log error if not connected to HomeAssistant', () => {
    homeAssistant.fetch('get_states', 1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'Fetch error: not connected to Home Assistant');
  });

  it('callService should log error if not connected to HomeAssistant', () => {
    homeAssistant.callService('light', 'turn_on', 'myentityid', {}, 1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'CallService error: not connected to Home Assistant');
  });

  it('fetch should log error if ws is not connected to HomeAssistant', () => {
    homeAssistant.connected = true;
    homeAssistant.fetch('get_states', 1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'Fetch error: WebSocket not open');
    homeAssistant.connected = false;
  });

  it('callService should log error if ws is not connected to HomeAssistant', () => {
    homeAssistant.connected = true;
    homeAssistant.callService('light', 'turn_on', 'myentityid', {}, 1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'CallService error: WebSocket not open');
    homeAssistant.connected = false;
  });

  it('fetchAsync should log error for async if not connected to HomeAssistant', async () => {
    try {
      await homeAssistant.fetchAsync('get_states', 1000);
    } catch (error: any) {
      //
    }
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'FetchAsync error: not connected to Home Assistant');
  });

  it('callServiceAsync should log error for async if not connected to HomeAssistant', async () => {
    try {
      await homeAssistant.callServiceAsync('light', 'turn_on', 'myentityid', {}, 1000);
    } catch (error: any) {
      //
    }
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'CallServiceAsync error: not connected to Home Assistant');
  });

  it('fetchAsync should log error for async if ws is not connected to HomeAssistant', async () => {
    homeAssistant.connected = true;
    try {
      await homeAssistant.fetchAsync('get_states', 1000);
    } catch (error: any) {
      //
    }
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'FetchAsync error: WebSocket not open');
    homeAssistant.connected = false;
  });

  it('callServiceAsync should log error for async if ws is not connected to HomeAssistant', async () => {
    homeAssistant.connected = true;
    try {
      await homeAssistant.callServiceAsync('light', 'turn_on', 'myentityid', {}, 1000);
    } catch (error: any) {
      //
    }
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'CallServiceAsync error: WebSocket not open');
    homeAssistant.connected = false;
  });

  it('should establish a WebSocket connection to Home Assistant', async () => {
    await new Promise<void>((resolve) => {
      const connectHandler = () => {
        resolve();
      };
      homeAssistant.once('connected', connectHandler);
      homeAssistant.connect();
    });

    expect(homeAssistant.connected).toBe(true);
    expect(homeAssistant.ws).not.toBeNull();
    expect((homeAssistant as any).reconnectTimeoutTime).toBe(120 * 1000);
    expect((homeAssistant as any).reconnectRetries).toBe(10);
    expect((homeAssistant as any).pingInterval).not.toBeNull();
    expect((homeAssistant as any).pingTimeout).toBeNull();
    expect((homeAssistant as any).reconnectTimeout).toBeNull();

    expect(server.clients.size).toBe(1);
    client = Array.from(server.clients)[0];
  });

  it('should not establish a new WebSocket connection to Home Assistant', async () => {
    homeAssistant.connect();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Already connected to Home Assistant`);
  });

  it('should log error if cannot parse message from Home Assistant', async () => {
    client.send('invalid message');
    await wait(100);
    // eslint-disable-next-line no-useless-escape
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Error parsing WebSocket message: SyntaxError: Unexpected token 'i', \"invalid message\" is not valid JSON`);
  });

  it('should log error if result messages from Home Assistant has success false', async () => {
    homeAssistant.once('error', (error) => {
      expect(error).toBe('WebSocket response error: unknown error');
    });
    client.send(JSON.stringify({ type: 'result', success: false }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket response error: WebSocket response error: unknown error`);
  });

  it('should log error if event messages from Home Assistant are missing data', async () => {
    client.send(JSON.stringify({ type: 'event' }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'Event response missing event data');
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

  it('should log error if unknown event messages from Home Assistant are missing data', async () => {
    client.send(JSON.stringify({ type: 'event', event: { event_type: 'unknown' } }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `*Unknown event type ${CYAN}unknown${db} received id ${CYAN}undefined${db}`);
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
    client.send(
      JSON.stringify({
        type: 'event',
        event: { event_type: 'state_changed', data: { entity_id: 'myentityid', old_state: { entity_id: 'myentityid' }, new_state: { entity_id: 'myentityid' } } },
        id: (homeAssistant as any).eventsSubscribeId,
      }),
    );
    await wait(100);
    expect(homeAssistant.hassStates.get('myentityid')).toBeDefined();
  });

  it('should parse call_service event messages from Home Assistant', async () => {
    client.send(JSON.stringify({ type: 'event', event: { event_type: 'call_service' }, id: (homeAssistant as any).eventsSubscribeId }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Event ${CYAN}call_service${db} received id ${CYAN}${(homeAssistant as any).eventsSubscribeId}${db}`);
  });

  it('should parse device_registry_updated event messages from Home Assistant', async () => {
    device_registry_response.push({ id: 'mydeviceid', name: 'My Device' } as HassDevice);
    client.send(JSON.stringify({ type: 'event', event: { event_type: 'device_registry_updated' }, id: (homeAssistant as any).eventsSubscribeId }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Event ${CYAN}device_registry_updated${db} received id ${CYAN}${(homeAssistant as any).eventsSubscribeId}${db}`);
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Received 1 devices.`);
    expect(homeAssistant.hassDevices.get('mydeviceid')).toBeDefined();
    expect(homeAssistant.hassDevices.get('mydeviceid')?.name).toBe('My Device');
    device_registry_response.splice(0, device_registry_response.length); // Clear the response for next tests
  });

  it('should parse entity_registry_updated event messages from Home Assistant', async () => {
    entity_registry_response.push({ entity_id: 'myentityid', device_id: 'mydeviceid' } as HassEntity);
    client.send(JSON.stringify({ type: 'event', event: { event_type: 'entity_registry_updated' }, id: (homeAssistant as any).eventsSubscribeId }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Event ${CYAN}entity_registry_updated${db} received id ${CYAN}${(homeAssistant as any).eventsSubscribeId}${db}`);
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Received 1 entities.`);
    expect(homeAssistant.hassEntities.get('myentityid')).toBeDefined();
    expect(homeAssistant.hassEntities.get('myentityid')?.device_id).toBe('mydeviceid');
    entity_registry_response.splice(0, entity_registry_response.length); // Clear the response for next tests
  });

  it('should parse area_registry_updated event messages from Home Assistant', async () => {
    area_registry_response.push({ area_id: 'myareaid', name: 'My Area' } as HassArea);
    client.send(JSON.stringify({ type: 'event', event: { event_type: 'area_registry_updated' }, id: (homeAssistant as any).eventsSubscribeId }));
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Event ${CYAN}area_registry_updated${db} received id ${CYAN}${(homeAssistant as any).eventsSubscribeId}${db}`);
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Received 1 areas.`);
    expect(homeAssistant.hassAreas.get('myareaid')).toBeDefined();
    expect(homeAssistant.hassAreas.get('myareaid')?.name).toBe('My Area');
    area_registry_response.splice(0, area_registry_response.length); // Clear the response for next tests
  });

  it('should fetch from HomeAssistant', () => {
    homeAssistant.fetch('get_states', 1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Fetching ${CYAN}get_states${db} id ${CYAN}1000${db}...`);

    jest.clearAllMocks();
    homeAssistant.fetch('get_states');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Fetching ${CYAN}get_states${db} id ${CYAN}${(homeAssistant as any).nextId - 1}${db}...`);
  });

  it('should call_service from HomeAssistant', () => {
    homeAssistant.callService('light', 'turn_on', 'myentityid', {}, 1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Calling service ${CYAN}light.turn_on${db} for entity ${CYAN}myentityid${db}`));

    jest.clearAllMocks();
    homeAssistant.callService('light', 'turn_on', 'myentityid', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Calling service ${CYAN}light.turn_on${db} for entity ${CYAN}myentityid${db}`));
  });

  it('should request call_service from Home Assistant', async () => {
    await new Promise((resolve) => {
      homeAssistant.on('call_service', () => {
        resolve(undefined);
      });
      homeAssistant.callService('light', 'turn_on', 'myentityid');
    });

    expect(homeAssistant).toBeDefined();
  });

  it('should request async call_service from Home Assistant', async () => {
    await homeAssistant.callServiceAsync('light', 'turn_on', 'myentityid');
    expect(homeAssistant).toBeDefined();
  });

  it('should get the devices asyncronously from Home Assistant', async () => {
    device_registry_response.push({ id: 'mydeviceid', name: 'My Device' } as HassDevice);
    const devices = await homeAssistant.fetchAsync('config/device_registry/list', 1000);
    expect(devices).toEqual([{ id: 'mydeviceid', name: 'My Device' }]);
    device_registry_response.splice(0, device_registry_response.length); // Clear the response for next tests
  });

  it('should get the entities asyncronously from Home Assistant', async () => {
    entity_registry_response.push({ entity_id: 'myentityid', device_id: 'mydeviceid' } as HassEntity);
    const entities = await homeAssistant.fetchAsync('config/entity_registry/list', 1000);
    expect(entities).toEqual([{ entity_id: 'myentityid', device_id: 'mydeviceid' }]);
    entity_registry_response.splice(0, entity_registry_response.length); // Clear the response for next tests
  });

  it('should get the areas asyncronously from Home Assistant', async () => {
    const areas = await homeAssistant.fetchAsync('config/area_registry/list', 1000);
    expect(areas).toEqual([]);
  });

  it('should get the states asyncronously from Home Assistant', async () => {
    const states = await homeAssistant.fetchAsync('get_states', 1000);
    expect(states).toEqual([]);
  });

  it('should get the config asyncronously from Home Assistant', async () => {
    const config = await homeAssistant.fetchAsync('get_config', 1000);
    expect(config).toEqual({});
  });

  it('should get the services asyncronously from Home Assistant', async () => {
    const services = await homeAssistant.fetchAsync('get_services', 1000);
    expect(services).toEqual({});
  });

  it('should close the WebSocket connection to Home Assistant', async () => {
    (homeAssistant as any).reconnectTimeoutTime = 0; // Disable reconnect for this test
    (homeAssistant as any).reconnectRetries = 0; // Disable reconnect for this test

    await new Promise((resolve) => {
      homeAssistant.on('disconnected', (message) => {
        expect(message).toBe('WebSocket connection closed');
        resolve(undefined);
      });
      homeAssistant.close();
    });

    expect(homeAssistant.connected).toBe(false);
    expect(homeAssistant.ws).toBeNull();
    expect((homeAssistant as any).pingInterval).toBeNull();
    expect((homeAssistant as any).pingTimeout).toBeNull();
    expect((homeAssistant as any).reconnectTimeout).toBeNull();
    homeAssistant.removeAllListeners(); // Remove all listeners to avoid memory leaks
  });

  it('should react to connection events with Home Assistant', async () => {
    homeAssistant = new HomeAssistant(wsUrl, accessToken, reconnectTimeoutTime, reconnectRetries);

    jest.useFakeTimers();

    await new Promise<void>((resolve) => {
      homeAssistant.once('connected', () => {
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
    homeAssistant.startReconnect();

    jest.clearAllMocks();
    jest.advanceTimersByTime(reconnectTimeoutTime * 1000);

    jest.useRealTimers();

    await new Promise<void>((resolve) => {
      homeAssistant.once('connected', () => {
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
      homeAssistant.once('connected', () => {
        resolve(undefined);
      });
      homeAssistant.connect();
    });

    expect(homeAssistant.connected).toBe(true);
    expect(homeAssistant.ws).not.toBeNull();
    expect((homeAssistant as any).pingInterval).not.toBeNull();
    expect((homeAssistant as any).pingTimeout).toBeNull();
    expect((homeAssistant as any).reconnectTimeout).toBeNull();

    jest.advanceTimersByTime(30000);

    await new Promise((resolve) => {
      homeAssistant.once('pong', () => {
        resolve(undefined);
      });
    });

    expect((homeAssistant as any).pingTimeout).toBeNull();

    homeAssistant.startReconnect();
    expect((homeAssistant as any).reconnectTimeout).toBe(null);

    jest.useRealTimers();

    (homeAssistant as any).pingInterval = setInterval(() => {}, 30000);
    (homeAssistant as any).pingTimeout = setTimeout(() => {}, 30000);

    homeAssistant.close();

    expect((homeAssistant as any).pingInterval).toBeNull();
    expect((homeAssistant as any).pingTimeout).toBeNull();

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
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `WebSocket error connecting to Home Assistant: Error: ENOENT: no such file or directory, open 'C:\\Users\\lligu\\GitHub\\matterbridge-hass\\invalid\\cert.pem'`,
    );
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

  it('should get config from Home Assistant', async () => {
    homeAssistant = new HomeAssistant(wsUrl, accessToken, reconnectTimeoutTime);
    homeAssistant.connect();

    await new Promise((resolve) => {
      homeAssistant.on('config', () => {
        homeAssistant.close();
        resolve(undefined);
      });
    });

    expect(homeAssistant.connected).toBe(false);
  });

  it('should get services from Home Assistant', async () => {
    homeAssistant = new HomeAssistant(wsUrl, accessToken, reconnectTimeoutTime);
    homeAssistant.connect();

    await new Promise((resolve) => {
      homeAssistant.on('services', () => {
        homeAssistant.close();
        resolve(undefined);
      });
    });

    expect(homeAssistant.connected).toBe(false);
  });

  it('should get config/device_registry/list from Home Assistant', async () => {
    homeAssistant = new HomeAssistant(wsUrl, accessToken, reconnectTimeoutTime);
    homeAssistant.connect();

    await new Promise((resolve) => {
      homeAssistant.on('devices', () => {
        homeAssistant.close();
        resolve(undefined);
      });
    });

    expect(homeAssistant.connected).toBe(false);
  });

  it('should get config/entity_registry/list from Home Assistant', async () => {
    homeAssistant = new HomeAssistant(wsUrl, accessToken, reconnectTimeoutTime);
    homeAssistant.connect();

    await new Promise((resolve) => {
      homeAssistant.on('entities', () => {
        homeAssistant.close();
        resolve(undefined);
      });
    });

    expect(homeAssistant.connected).toBe(false);
  });

  it('should get config/area_registry/list from Home Assistant', async () => {
    homeAssistant = new HomeAssistant(wsUrl, accessToken, reconnectTimeoutTime);
    homeAssistant.connect();

    await new Promise((resolve) => {
      homeAssistant.on('areas', () => {
        homeAssistant.close();
        resolve(undefined);
      });
    });

    expect(homeAssistant.connected).toBe(false);
  });

  it('should get get_states from Home Assistant', async () => {
    homeAssistant = new HomeAssistant(wsUrl, accessToken, reconnectTimeoutTime);
    homeAssistant.connect();

    await new Promise((resolve) => {
      homeAssistant.on('states', () => {
        homeAssistant.close();
        resolve(undefined);
      });
    });

    expect(homeAssistant.connected).toBe(false);
  });

  it('should get subscribe_events from Home Assistant', async () => {
    homeAssistant = new HomeAssistant(wsUrl, accessToken, reconnectTimeoutTime);
    homeAssistant.connect();

    await new Promise((resolve) => {
      homeAssistant.on('subscribed', () => {
        homeAssistant.close();
        resolve(undefined);
      });
    });

    expect(homeAssistant.connected).toBe(false);
  });
});
