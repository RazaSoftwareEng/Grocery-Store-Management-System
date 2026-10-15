/**
 * Google Apps Script Web App Client
 * Handles real HTTP communication with the deployed Google Apps Script backend.
 */

export class AppsScriptService {
  constructor(endpointUrl) {
    this.endpointUrl = endpointUrl;
  }

  setEndpoint(url) {
    this.endpointUrl = url;
  }

  async testConnection(urlToTest) {
    const url = urlToTest || this.endpointUrl;
    if (!url) {
      return { success: false, error: 'No Google Apps Script Web App URL provided' };
    }

    try {
      const response = await fetch(`${url}?action=testConnection`, {
        method: 'GET',
        redirect: 'follow',
      });
      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      return {
        success: false,
        error: `Failed to connect to Google Apps Script: ${err.message}. Ensure "Who has access" is set to "Anyone" and script is deployed as Web App.`,
      };
    }
  }

  async get(action, params = {}) {
    if (!this.endpointUrl) throw new Error('Google Apps Script URL is not configured');

    const url = new URL(this.endpointUrl);
    url.searchParams.append('action', action);
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        url.searchParams.append(key, val);
      }
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Apps Script GET ${action} failed: ${response.status}`);
    }

    return await response.json();
  }

  async post(action, data = {}) {
    if (!this.endpointUrl) throw new Error('Google Apps Script URL is not configured');

    const payload = {
      action,
      data,
    };

    const response = await fetch(this.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Apps Script handles text/plain reliably without preflight CORS issues
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Apps Script POST ${action} failed: ${response.status}`);
    }

    return await response.json();
  }
}
