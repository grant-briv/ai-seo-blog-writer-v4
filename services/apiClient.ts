import { User, AiWriterProfile, SavedBlogPost } from '../types';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface LoginResponse {
  success: boolean;
  user: User;
  token: string;
}

interface UserResponse {
  success: boolean;
  user: User;
}

interface UsersResponse {
  success: boolean;
  users: User[];
}

interface WriterProfileResponse {
  success: boolean;
  profile: AiWriterProfile;
}

interface WriterProfilesResponse {
  success: boolean;
  profiles: AiWriterProfile[];
}

interface UserSettingsResponse {
  success: boolean;
  settings: Record<string, string | null>;
}

interface UserSettingResponse {
  success: boolean;
  value: string | null;
}

interface SavedBlogResponse {
  success: boolean;
  blog: SavedBlogPost;
}

interface SavedBlogsResponse {
  success: boolean;
  blogs: SavedBlogPost[];
}

interface TopicSearchesResponse {
  success: boolean;
  searches: string[];
}

interface EncryptedApiKeyResponse {
  success: boolean;
  apiKey: {
    id: string;
    userId: string;
    keyName: string;
    encryptedValue: string;
    description: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

interface EncryptedApiKeysResponse {
  success: boolean;
  apiKeys: {
    id: string;
    userId: string;
    keyName: string;
    encryptedValue: string;
    description: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }[];
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    // In production, use the same origin (Railway serves both frontend and backend)
    // In development, use the environment variable or localhost
    if (import.meta.env.PROD) {
      // Production: backend is served from the same origin
      this.baseUrl = window.location.origin;
    } else {
      // Development: use environment variable or localhost
      this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    }
    
    console.log('🌐 API Client initialized with baseUrl:', this.baseUrl);
    
    // Load token from localStorage if available
    this.token = localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    console.log('🌐 API Request:', {
      method: config.method || 'GET',
      url,
      hasToken: !!this.token,
      body: config.body ? JSON.parse(config.body as string) : undefined
    });

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('🌐 API Response:', { url, success: true, data });
      return data;
    } catch (error) {
      console.error('🌐 API Error:', { url, error: error.message });
      throw error;
    }
  }

  // Authentication methods
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (response.success && response.token) {
      this.token = response.token;
      localStorage.setItem('auth_token', response.token);
      console.log('🔐 Login successful, token saved');
    }

    return response;
  }

  async register(userData: {
    username: string;
    password: string;
    email?: string;
    role?: string;
    assignedProfileIds?: string[];
  }): Promise<UserResponse> {
    return await this.request<UserResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async verifyToken(): Promise<UserResponse> {
    if (!this.token) {
      throw new Error('No token available');
    }

    return await this.request<UserResponse>('/api/auth/verify-token', {
      method: 'POST',
      body: JSON.stringify({ token: this.token }),
    });
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem('auth_token');
    console.log('🔐 Logged out, token removed');
  }

  // User management methods
  async getAllUsers(): Promise<UsersResponse> {
    return await this.request<UsersResponse>('/api/users');
  }

  async getUserById(userId: string): Promise<UserResponse> {
    return await this.request<UserResponse>(`/api/users/${userId}`);
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<UserResponse> {
    return await this.request<UserResponse>(`/api/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId: string): Promise<ApiResponse> {
    return await this.request<ApiResponse>(`/api/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async changePassword(
    userId: string, 
    currentPassword: string, 
    newPassword: string
  ): Promise<ApiResponse> {
    return await this.request<ApiResponse>(`/api/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async changePasswordAsAdmin(userId: string, newPassword: string): Promise<ApiResponse> {
    return await this.request<ApiResponse>(`/api/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    });
  }

  // Writer Profile methods
  async getAllWriterProfiles(): Promise<WriterProfilesResponse> {
    return await this.request<WriterProfilesResponse>('/api/writer-profiles', {
      method: 'GET',
    });
  }

  async getWriterProfileById(profileId: string): Promise<WriterProfileResponse> {
    return await this.request<WriterProfileResponse>(`/api/writer-profiles/${profileId}`, {
      method: 'GET',
    });
  }

  async createWriterProfile(profileData: any): Promise<WriterProfileResponse> {
    return await this.request<WriterProfileResponse>('/api/writer-profiles', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  }

  async updateWriterProfile(profileId: string, profileData: any): Promise<WriterProfileResponse> {
    return await this.request<WriterProfileResponse>(`/api/writer-profiles/${profileId}`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async deleteWriterProfile(profileId: string): Promise<ApiResponse> {
    return await this.request<ApiResponse>(`/api/writer-profiles/${profileId}`, {
      method: 'DELETE',
    });
  }

  // Helper methods
  isAuthenticated(): boolean {
    return !!this.token;
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  // User Settings methods
  async getUserSettings(): Promise<UserSettingsResponse> {
    return await this.request<UserSettingsResponse>('/api/user-settings', {
      method: 'GET',
    });
  }

  async getUserSetting(key: string): Promise<UserSettingResponse> {
    return await this.request<UserSettingResponse>(`/api/user-settings/${key}`, {
      method: 'GET',
    });
  }

  async setUserSetting(key: string, value: string | null): Promise<ApiResponse> {
    return await this.request<ApiResponse>(`/api/user-settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  async deleteUserSetting(key: string): Promise<ApiResponse> {
    return await this.request<ApiResponse>(`/api/user-settings/${key}`, {
      method: 'DELETE',
    });
  }

  // Saved Blog methods
  async getAllSavedBlogs(): Promise<SavedBlogsResponse> {
    return await this.request<SavedBlogsResponse>('/api/saved-blogs', {
      method: 'GET',
    });
  }

  async getSavedBlogById(blogId: string): Promise<SavedBlogResponse> {
    return await this.request<SavedBlogResponse>(`/api/saved-blogs/${blogId}`, {
      method: 'GET',
    });
  }

  async createSavedBlog(blogData: { blogTitle: string; appState: any }): Promise<SavedBlogResponse> {
    return await this.request<SavedBlogResponse>('/api/saved-blogs', {
      method: 'POST',
      body: JSON.stringify(blogData),
    });
  }

  async updateSavedBlog(blogId: string, blogData: { blogTitle: string; appState: any }): Promise<SavedBlogResponse> {
    return await this.request<SavedBlogResponse>(`/api/saved-blogs/${blogId}`, {
      method: 'PUT',
      body: JSON.stringify(blogData),
    });
  }

  async deleteSavedBlog(blogId: string): Promise<ApiResponse> {
    return await this.request<ApiResponse>(`/api/saved-blogs/${blogId}`, {
      method: 'DELETE',
    });
  }

  // Topic Searches methods
  async getSavedTopicSearches(): Promise<TopicSearchesResponse> {
    return await this.request<TopicSearchesResponse>('/api/topic-searches', {
      method: 'GET',
    });
  }

  async saveTopicSearch(searchQuery: string): Promise<ApiResponse> {
    return await this.request<ApiResponse>('/api/topic-searches', {
      method: 'POST',
      body: JSON.stringify({ searchQuery }),
    });
  }

  async deleteTopicSearch(searchQuery: string): Promise<ApiResponse> {
    return await this.request<ApiResponse>('/api/topic-searches', {
      method: 'DELETE',
      body: JSON.stringify({ searchQuery }),
    });
  }

  // Encrypted API Keys methods
  async getAllEncryptedApiKeys(): Promise<EncryptedApiKeysResponse> {
    return await this.request<EncryptedApiKeysResponse>('/api/encrypted-api-keys', {
      method: 'GET',
    });
  }

  async getEncryptedApiKey(keyName: string): Promise<EncryptedApiKeyResponse> {
    return await this.request<EncryptedApiKeyResponse>(`/api/encrypted-api-keys/${keyName}`, {
      method: 'GET',
    });
  }

  async createEncryptedApiKey(keyData: {
    keyName: string;
    encryptedValue: string;
    description: string;
    isActive?: boolean;
  }): Promise<EncryptedApiKeyResponse> {
    return await this.request<EncryptedApiKeyResponse>('/api/encrypted-api-keys', {
      method: 'POST',
      body: JSON.stringify(keyData),
    });
  }

  async updateEncryptedApiKey(keyName: string, keyData: {
    encryptedValue?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<EncryptedApiKeyResponse> {
    return await this.request<EncryptedApiKeyResponse>(`/api/encrypted-api-keys/${keyName}`, {
      method: 'PUT',
      body: JSON.stringify(keyData),
    });
  }

  async deleteEncryptedApiKey(keyName: string): Promise<ApiResponse> {
    return await this.request<ApiResponse>(`/api/encrypted-api-keys/${keyName}`, {
      method: 'DELETE',
    });
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    return await this.request<ApiResponse>('/health');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;