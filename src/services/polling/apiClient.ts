import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { IPollingConfig } from '../../models/pollingConfig';

export class ApiClient {
  /**
   * Make an HTTP request based on polling configuration
   */
  async makeRequest(config: IPollingConfig, additionalParams?: Record<string, any>): Promise<AxiosResponse> {
    const { api_config } = config;
    
    // Build the request configuration
    const requestConfig: AxiosRequestConfig = {
      method: api_config.method,
      url: this.buildUrl(api_config.endpoint, api_config.query_params, additionalParams),
      headers: { ...api_config.headers },
      timeout: 30000, // 30 second timeout
    };

    // Add authentication
    this.addAuthentication(requestConfig, api_config.auth);

    // Add body for POST requests
    if (api_config.method === 'POST' && api_config.body) {
      requestConfig.data = api_config.body;
    }

    // Add User-Agent
    if (!requestConfig.headers?.['User-Agent']) {
      requestConfig.headers!['User-Agent'] = 'Enterpret-Feedback-Ingestion/1.0';
    }

    try {
      const response = await axios(requestConfig);
      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Log the error details for debugging
        console.error('API Request failed:', {
          url: requestConfig.url,
          method: requestConfig.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
      }
      throw error;
    }
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(endpoint: string, queryParams?: Record<string, string>, additionalParams?: Record<string, any>): string {
    const url = new URL(endpoint);
    
    // Add configured query parameters
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    // Add additional parameters (for pagination, timestamps, etc.)
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Add authentication to request configuration
   */
  private addAuthentication(requestConfig: AxiosRequestConfig, auth?: IPollingConfig['api_config']['auth']): void {
    if (!auth) return;

    switch (auth.type) {
      case 'bearer':
        if (auth.token) {
          requestConfig.headers!['Authorization'] = `Bearer ${auth.token}`;
        }
        break;
      
      case 'basic':
        if (auth.username && auth.password) {
          const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
          requestConfig.headers!['Authorization'] = `Basic ${credentials}`;
        }
        break;
      
      case 'api_key':
        if (auth.api_key_header && auth.api_key_value) {
          requestConfig.headers![auth.api_key_header] = auth.api_key_value;
        }
        break;
    }
  }

  /**
   * Extract timestamp for incremental polling
   */
  extractTimestampFromResponse(response: AxiosResponse, timestampPath?: string): Date | null {
    if (!timestampPath) return null;

    try {
      // Simple dot notation path extraction
      const keys = timestampPath.split('.');
      let value: any = response.data;
      
      for (const key of keys) {
        if (value && typeof value === 'object') {
          value = value[key];
        } else {
          return null;
        }
      }

      if (value) {
        return new Date(value);
      }
    } catch (error) {
      console.error('Error extracting timestamp:', error);
    }
    
    return null;
  }
} 