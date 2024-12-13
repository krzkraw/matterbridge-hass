/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */

import { WebSocket, WebSocketServer } from 'ws';
import { HomeAssistant } from './homeAssistant'; // Adjust the import path as necessary
import { jest } from '@jest/globals';
import { AnsiLogger, CYAN, db, LogLevel } from 'matterbridge/logger';
import { wait } from 'matterbridge/utils';

// let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;

// Spy on and mock the AnsiLogger.log method
const loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
  // console.error(`Mocked AnsiLogger.log: ${level} - ${message}`, ...parameters);
});

describe('HomeAssistant', () => {
  let server: WebSocketServer;
  let homeAssistant: HomeAssistant;
  const wsUrl = 'ws://localhost:8123';
  const accessToken = 'testAccessToken';
  const reconnectTimeoutTime = 120;
  const path = '/api/websocket';

  let client: WebSocket;

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
          ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: {} }));
        } else if (msg.type === 'get_services') {
          ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: {} }));
        } else if (msg.type === 'config/device_registry/list') {
          ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: [] }));
        } else if (msg.type === 'config/entity_registry/list') {
          ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: [] }));
        } else if (msg.type === 'get_states') {
          ws.send(JSON.stringify({ id: msg.id, type: 'result', success: true, result: [] }));
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    //
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
    homeAssistant = new HomeAssistant(wsUrl, accessToken, reconnectTimeoutTime);
    expect(homeAssistant).toBeInstanceOf(HomeAssistant);
  });

  it('should log error if not connected to HomeAssistant', () => {
    homeAssistant.fetch('get_states', 1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'Fetch error: not connected to Home Assistant');
    homeAssistant.callService('light', 'turn_on', 'myentityid', {}, 1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'CallService error: not connected to Home Assistant');
  });

  it('should log error for async if not connected to HomeAssistant', async () => {
    try {
      await homeAssistant.fetchAsync('get_states', 1000);
    } catch (error: any) {
      //
    }
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'FetchAsync error: not connected to Home Assistant');
    try {
      await homeAssistant.callServiceAsync('light', 'turn_on', 'myentityid', {}, 1000);
    } catch (error: any) {
      //
    }
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'CallServiceAsync error: not connected to Home Assistant');
  });

  it('should log error if ws is not connected to HomeAssistant', () => {
    homeAssistant.connected = true;
    homeAssistant.fetch('get_states', 1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'Fetch error: WebSocket not open');
    homeAssistant.callService('light', 'turn_on', 'myentityid', {}, 1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'CallService error: WebSocket not open');
    homeAssistant.connected = false;
  });

  it('should log error for async if ws is not connected to HomeAssistant', async () => {
    homeAssistant.connected = true;
    try {
      await homeAssistant.fetchAsync('get_states', 1000);
    } catch (error: any) {
      //
    }
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'FetchAsync error: WebSocket not open');
    try {
      await homeAssistant.callServiceAsync('light', 'turn_on', 'myentityid', {}, 1000);
    } catch (error: any) {
      //
    }
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'CallServiceAsync error: WebSocket not open');
    homeAssistant.connected = false;
  });

  it('should establish a WebSocket connection to Home Assistant', async () => {
    await new Promise((resolve) => {
      homeAssistant.on('connected', () => {
        resolve(undefined);
      });
      homeAssistant.connect();
    });

    expect(homeAssistant.connected).toBe(true);
    expect(homeAssistant.ws).not.toBeNull();
    expect((homeAssistant as any).reconnectTimeoutTime).toBe(120 * 1000);
    expect((homeAssistant as any).pingInterval).not.toBeNull();
    expect((homeAssistant as any).pingTimeout).toBeNull();
    expect((homeAssistant as any).reconnectTimeout).toBeNull();
  });

  it('should parse messages from Home Assistant', async () => {
    for (const client of server.clients) {
      client.send(JSON.stringify({ type: 'event' }));
      await wait(100);
      client.send(
        JSON.stringify({
          type: 'event',
          event: { event_type: 'state_changed', data: { entity_id: 'myentityid', new_state: { entity_id: 'myentityid' } } },
          id: (homeAssistant as any).eventsSubscribeId,
        }),
      );
      await wait(100);
      homeAssistant.hassEntities.set('myentityid', { entity_id: 'myentityid', device_id: 'mydeviceid' } as any);
      client.send(
        JSON.stringify({
          type: 'event',
          event: { event_type: 'state_changed', data: { entity_id: 'myentityid', new_state: { entity_id: 'myentityid' } } },
          id: (homeAssistant as any).eventsSubscribeId,
        }),
      );
      await wait(100);
      homeAssistant.hassDevices.set('mydeviceid', { device_id: 'mydeviceid' } as any);
      client.send(
        JSON.stringify({
          type: 'event',
          event: { event_type: 'state_changed', data: { entity_id: 'myentityid', new_state: { entity_id: 'myentityid' } } },
          id: (homeAssistant as any).eventsSubscribeId,
        }),
      );
      client.send(JSON.stringify({ type: 'event', event: { event_type: 'call_service' }, id: (homeAssistant as any).eventsSubscribeId }));
      client.send(JSON.stringify({ type: 'event', event: { event_type: 'device_registry_updated' }, id: (homeAssistant as any).eventsSubscribeId }));
      client.send(JSON.stringify({ type: 'event', event: { event_type: 'entity_registry_updated' }, id: (homeAssistant as any).eventsSubscribeId }));
    }
    await wait(500);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'Event response missing event data');
  });

  it('should fetch from HomeAssistant', () => {
    homeAssistant.fetch('get_states', 1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Fetching ${CYAN}get_states${db} id ${CYAN}1000${db}...`);
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
    const states = await homeAssistant.fetchAsync('config/device_registry/list', 1000);
    expect(states).toEqual([]);
  });

  it('should get the entities asyncronously from Home Assistant', async () => {
    const states = await homeAssistant.fetchAsync('config/entity_registry/list', 1000);
    expect(states).toEqual([]);
  });

  it('should get the states asyncronously from Home Assistant', async () => {
    const states = await homeAssistant.fetchAsync('get_states', 1000);
    expect(states).toEqual([]);
  });

  it('should close the WebSocket connection to Home Assistant', async () => {
    await new Promise((resolve) => {
      homeAssistant.on('disconnected', () => {
        resolve(undefined);
      });
      homeAssistant.close();
    });

    expect(homeAssistant.connected).toBe(false);
    expect(homeAssistant.ws).toBeNull();
    expect((homeAssistant as any).pingInterval).toBeNull();
    expect((homeAssistant as any).pingTimeout).toBeNull();
    expect((homeAssistant as any).reconnectTimeout).toBeNull();
  });

  it('should send ping to Home Assistant', async () => {
    homeAssistant = new HomeAssistant(wsUrl, accessToken, reconnectTimeoutTime);

    jest.useFakeTimers();

    await new Promise((resolve) => {
      homeAssistant.on('connected', () => {
        resolve(undefined);
      });
      homeAssistant.connect();
    });

    expect(homeAssistant.connected).toBe(true);
    expect(homeAssistant.ws).not.toBeNull();
    expect((homeAssistant as any).reconnectTimeoutTime).toBe(120 * 1000);
    expect((homeAssistant as any).pingInterval).not.toBeNull();
    expect((homeAssistant as any).pingTimeout).toBeNull();
    expect((homeAssistant as any).reconnectTimeout).toBeNull();

    jest.advanceTimersByTime(30000);

    await new Promise((resolve) => {
      homeAssistant.on('pong', () => {
        resolve(undefined);
      });
    });

    expect((homeAssistant as any).pingTimeout).toBeNull();

    homeAssistant.startReconnect();

    jest.useRealTimers();

    homeAssistant.close();
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
