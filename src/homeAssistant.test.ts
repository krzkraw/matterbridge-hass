/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */

/* eslint-disable jest/no-commented-out-tests */
import { WebSocket, WebSocketServer } from 'ws';
import { HomeAssistant } from './homeAssistant'; // Adjust the import path as necessary
import { jest } from '@jest/globals';

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
    //
  });

  beforeAll(() => {
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

  /*
  it('should handle WebSocket messages', (done) => {
    server.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'auth_required' }));
      ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message.toString());
        if (parsedMessage.type === 'auth') {
          ws.send(JSON.stringify({ type: 'auth_ok' }));
        }
      });
    });

    homeAssistant.connect();

    setTimeout(() => {
      homeAssistant['ws'].onmessage({
        data: JSON.stringify({ type: 'result', success: true }),
      } as WebSocket.MessageEvent);

      setTimeout(() => {
        // Add your assertions here
        done();
      }, 100);
    }, 100);
  });

  it('should log an error when WebSocket message parsing fails', (done) => {
    const logErrorSpy = jest.spyOn(homeAssistant['log'], 'error');

    server.on('connection', (ws) => {
      ws.send('invalid JSON');
    });

    homeAssistant.connect();

    setTimeout(() => {
      expect(logErrorSpy).toHaveBeenCalledWith('Error parsing WebSocket.MessageEvent:', expect.any(SyntaxError));
      done();
    }, 100);
  });

  it('should log a message when already connected', (done) => {
    const logInfoSpy = jest.spyOn(homeAssistant['log'], 'info');

    server.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'auth_required' }));
      ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message.toString());
        if (parsedMessage.type === 'auth') {
          ws.send(JSON.stringify({ type: 'auth_ok' }));
        }
      });
    });

    homeAssistant.connect();

    setTimeout(() => {
      homeAssistant.connect();
      expect(logInfoSpy).toHaveBeenCalledWith('Already connected to Home Assistant');
      done();
    }, 100);
  });
  */
});
