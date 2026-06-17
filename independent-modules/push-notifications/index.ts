import * as crypto from 'node:crypto';
import * as http2 from 'node:http2';

export interface FCMConfig {
  clientEmail: string;
  privateKey: string;
  projectId: string;
}

export interface APNsConfig {
  teamId: string;
  keyId: string;
  privateKey: string; // .p8 certificate text
  sandbox?: boolean;  // use sandbox.push.apple.com
}

export class PushNotificationService {
  private fcmConfig?: FCMConfig;
  private apnsConfig?: APNsConfig;
  private fcmAccessToken?: string;
  private fcmTokenExpiry = 0;
  private http2Connect: any;

  constructor(config: { fcm?: FCMConfig; apns?: APNsConfig; http2Connect?: any }) {
    this.fcmConfig = config.fcm;
    this.apnsConfig = config.apns;
    this.http2Connect = config.http2Connect || http2.connect;
  }

  // --- GOOGLE FCM V1 SERVICE ---

  /**
   * Send a push notification to an Android device (FCM v1).
   */
  async sendFCM(
    deviceToken: string,
    notification: { title: string; body: string },
    data?: Record<string, string>
  ): Promise<any> {
    if (!this.fcmConfig) {
      throw new Error('FCM is not configured.');
    }

    const accessToken = await this.getFCMAccessToken();
    const url = `https://fcm.googleapis.com/v1/projects/${this.fcmConfig.projectId}/messages:send`;

    const body = {
      message: {
        token: deviceToken,
        notification,
        ...(data ? { data } : {})
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`FCM push failed: ${errorText}`);
    }

    return res.json();
  }

  private async getFCMAccessToken(): Promise<string> {
    if (this.fcmAccessToken && Date.now() < this.fcmTokenExpiry) {
      return this.fcmAccessToken;
    }

    if (!this.fcmConfig) {
      throw new Error('FCM is not configured.');
    }

    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;

    const payload = {
      iss: this.fcmConfig.clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp,
      iat
    };

    const jwt = this.signRS256JWT(payload, this.fcmConfig.privateKey);

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      }).toString()
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch FCM OAuth token: ${errorText}`);
    }

    const data: any = await res.json();
    this.fcmAccessToken = data.access_token;
    this.fcmTokenExpiry = Date.now() + (data.expires_in || 3600) * 1000 - 60000; // cache with 1-min buffer
    return this.fcmAccessToken!;
  }

  private signRS256JWT(payload: any, privateKey: string): string {
    const header = { alg: 'RS256', typ: 'JWT' };
    const base64Url = (obj: any) =>
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const signatureInput = `${base64Url(header)}.${base64Url(payload)}`;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);

    const signature = sign.sign(privateKey, 'base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${signatureInput}.${signature}`;
  }

  // --- APPLE APNS SERVICE ---

  /**
   * Send a push notification to an iOS device (APNs over HTTP/2).
   */
  async sendAPNs(
    deviceToken: string,
    options: {
      topic: string; // App Bundle ID, e.g. "gov.np.message"
      title: string;
      body: string;
      badge?: number;
      sound?: string;
      data?: Record<string, any>;
    }
  ): Promise<void> {
    if (!this.apnsConfig) {
      throw new Error('APNs is not configured.');
    }

    const jwt = this.signES256JWT(this.apnsConfig.teamId, this.apnsConfig.keyId, this.apnsConfig.privateKey);
    const host = this.apnsConfig.sandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';

    const payload = {
      aps: {
        alert: {
          title: options.title,
          body: options.body
        },
        ...(options.badge !== undefined ? { badge: options.badge } : {}),
        sound: options.sound || 'default'
      },
      ...(options.data || {})
    };

    return new Promise((resolve, reject) => {
      const client = this.http2Connect(`https://${host}:443`);

      client.on('error', (err: any) => reject(err));

      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        'authorization': `bearer ${jwt}`,
        'apns-topic': options.topic,
        'apns-push-type': 'alert',
        'content-type': 'application/json'
      });

      req.on('response', (headers: any) => {
        const status = headers[':status'];
        if (status !== 200) {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', () => {
            client.close();
            reject(new Error(`APNs request failed with status ${status}: ${body}`));
          });
        } else {
          req.on('end', () => {
            client.close();
            resolve();
          });
        }
      });

      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  private signES256JWT(teamId: string, keyId: string, privateKey: string): string {
    const header = { alg: 'ES256', kid: keyId };
    const payload = {
      iss: teamId,
      iat: Math.floor(Date.now() / 1000)
    };

    const base64Url = (obj: any) =>
      Buffer.from(JSON.stringify(obj))
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const signatureInput = `${base64Url(header)}.${base64Url(payload)}`;
    const sign = crypto.createSign('SHA256');
    sign.update(signatureInput);

    // APNs needs P1363 format (raw concatenated R and S values, 64 bytes)
    const signature = sign.sign(
      {
        key: privateKey,
        dsaEncoding: 'ieee-p1363'
      },
      'base64'
    )
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${signatureInput}.${signature}`;
  }
}
