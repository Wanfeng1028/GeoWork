// GeoWork Electron - Runtime IPC
// Routes runtime:api calls to Go Core HTTP API

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import https from 'https';
import http from 'http';
import { URL } from 'url';

export const ALLOWED_CHANNELS = new Set<string>(['runtime:api', 'cloud:api']);

const CORE_URL = process.env.GEOWORK_CORE_URL || 'http://127.0.0.1:8765';
const CLOUD_URL = process.env.GEOWORK_CLOUD_URL || 'http://127.0.0.1:8767';

interface HttpError {
  message: string;
  status: number;
}

interface HttpResponse {
  error?: string;
  status?: number;
  [key: string]: unknown;
}

function httpRequest(url: string, method: string, body?: Record<string, unknown>): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHTTPS = parsedUrl.protocol.startsWith('https');
    const lib = isHTTPS ? https : http;

    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : (isHTTPS ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };

    const req = lib.request(options, (res: http.IncomingMessage) => {
      let data = '';
      res.on('data', (chunk: Buffer | string) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed as HttpResponse);
        } catch {
          resolve({ raw: data });
        }
      });
    });

    req.on('error', (error: Error) => {
      reject({ message: error.message, status: 500 });
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject({ message: 'Request timeout', status: 504 });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

export function registerRuntimeIPC() {
  ipcMain.handle('runtime:api', async (
    _event: IpcMainInvokeEvent,
    method: string,
    path: string,
    body?: Record<string, unknown>
  ) => {
    const url = `${CORE_URL}${path}`;

    try {
      const response = await httpRequest(url, method, body);
      return response;
    } catch (error: unknown) {
      const err = error as HttpError;
      console.error(`[IPC] Error forwarding to Go Core: ${url}`, err);
      return {
        error: err.message || 'Failed to connect to Go Core Runtime',
        status: err.status || 500,
      };
    }
  });

  // Cloud API proxy -> http://127.0.0.1:8767
  ipcMain.handle('cloud:api', async (
    _event: IpcMainInvokeEvent,
    method: string,
    path: string,
    body?: Record<string, unknown>
  ) => {
    const url = `${CLOUD_URL}${path}`;

    try {
      const response = await httpRequest(url, method, body);
      return response;
    } catch (error: unknown) {
      const err = error as HttpError;
      console.error(`[IPC] Error forwarding to Cloud: ${url}`, err);
      return {
        error: err.message || 'Failed to connect to Cloud API',
        status: err.status || 500,
      };
    }
  });
}
