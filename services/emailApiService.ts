// Email API service for backend communication

export interface TestEmailRequest {
  testEmail: string;
  emailConfig: {
    apiKey: string;
    domain: string;
    fromEmail: string;
    isEnabled: boolean;
  };
}

export interface InviteEmailRequest {
  userEmail: string;
  inviterName: string;
  tempPassword: string;
  loginUrl: string;
  companyName: string;
  emailConfig: {
    apiKey: string;
    domain: string;
    fromEmail: string;
    isEnabled: boolean;
  };
}

export interface EmailResponse {
  success: boolean;
  message: string;
  mailgunResponse?: any;
}

export interface PasswordResetRequest {
  email: string;
}

export const emailApiService = {
  // Test email configuration
  async testEmail(data: TestEmailRequest): Promise<EmailResponse> {
    try {
      console.log('📧 Testing email via API service');
      
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        return { success: false, message: 'Authentication required' };
      }

      const response = await fetch(`${baseUrl}/api/email/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          testEmail: data.testEmail,
          emailConfig: data.emailConfig
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          message: errorData.error || `HTTP ${response.status}`
        };
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message || 'Test email sent successfully',
        mailgunResponse: result.mailgunResponse
      };
    } catch (error: any) {
      console.error('Email API test error:', error);
      return {
        success: false,
        message: error.message || 'Failed to send test email'
      };
    }
  },

  // Send invitation email
  async sendInvitation(data: InviteEmailRequest): Promise<EmailResponse> {
    try {
      console.log('📧 Sending invitation via API service');
      
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        return { success: false, message: 'Authentication required' };
      }

      const response = await fetch(`${baseUrl}/api/email/send-invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userEmail: data.userEmail,
          inviterName: data.inviterName,
          tempPassword: data.tempPassword,
          loginUrl: data.loginUrl,
          companyName: data.companyName,
          emailConfig: data.emailConfig
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          message: errorData.error || `HTTP ${response.status}`
        };
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message || 'Invitation email sent successfully',
        mailgunResponse: result.mailgunResponse
      };
    } catch (error: any) {
      console.error('Email API invitation error:', error);
      return {
        success: false,
        message: error.message || 'Failed to send invitation email'
      };
    }
  },

  // Send password reset email
  async sendPasswordReset(data: PasswordResetRequest): Promise<EmailResponse> {
    try {
      console.log('📧 Sending password reset via API service');
      
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      const response = await fetch(`${baseUrl}/api/email/password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: data.email
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          message: errorData.error || `HTTP ${response.status}`
        };
      }

      const result = await response.json();
      return {
        success: true,
        message: result.message || 'Password reset email sent successfully',
        mailgunResponse: result.mailgunResponse
      };
    } catch (error: any) {
      console.error('Email API password reset error:', error);
      return {
        success: false,
        message: error.message || 'Failed to send password reset email'
      };
    }
  }
};