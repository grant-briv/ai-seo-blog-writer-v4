// Email service for user invitations and password resets
// Note: This uses a third-party email API (like EmailJS, SendGrid, or similar)
// You'll need to configure your email provider credentials

export interface EmailConfig {
  apiKey: string;
  domain: string;
  fromEmail: string;
  isEnabled: boolean;
}

export interface InviteEmailData {
  userEmail: string;
  inviterName: string;
  tempPassword: string;
  loginUrl: string;
  companyName?: string;
}

export interface PasswordResetEmailData {
  userEmail: string;
  userName: string;
  resetToken: string;
  resetUrl: string;
  companyName?: string;
}

class EmailService {
  private config: EmailConfig | null = null;

  // Initialize with email service configuration
  public configure(config: EmailConfig) {
    this.config = config;
  }

  public isConfigured(): boolean {
    return !!(this.config && this.config.isEnabled && this.config.apiKey && this.config.domain && this.config.fromEmail);
  }

  // Send user invitation email via backend API
  public async sendInvitationEmail(data: InviteEmailData): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: 'Email service not configured' };
    }

    try {
      const { emailApiService } = await import('./emailApiService');
      
      const result = await emailApiService.sendInvitation({
        userEmail: data.userEmail,
        inviterName: data.inviterName,
        tempPassword: data.tempPassword,
        loginUrl: data.loginUrl,
        companyName: data.companyName,
        emailConfig: this.config!
      });

      return result;
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to send invitation email' 
      };
    }
  }

  // Send password reset email
  public async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: 'Email service not configured' };
    }

    try {
      // Prepare form data for Mailgun API
      const formData = new FormData();
      formData.append('from', `PLACE Support <${this.config!.fromEmail}>`);
      formData.append('to', data.userEmail);
      formData.append('subject', 'Password Reset Request');
      formData.append('text', this.generatePasswordResetEmailBody(data));
      formData.append('html', this.generatePasswordResetEmailHTML(data));

      // Make actual Mailgun API call
      const response = await fetch(`https://api.mailgun.net/v3/${this.config!.domain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${this.config!.apiKey}`)}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Mailgun API error:', response.status, response.statusText, errorText);
        console.error('Request details:', {
          domain: this.config!.domain,
          apiKeyPrefix: this.config!.apiKey.substring(0, 8) + '...',
          url: `https://api.mailgun.net/v3/${this.config!.domain}/messages`
        });
        return { 
          success: false, 
          message: `Mailgun API error: ${response.status} ${response.statusText} - ${errorText}` 
        };
      }

      const result = await response.json();
      console.log('📧 Mailgun password reset email sent successfully:', result);
      
      return { success: true, message: 'Password reset email sent successfully' };
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to send password reset email' 
      };
    }
  }

  private generateInviteEmailBody(data: InviteEmailData): string {
    return `
You've been invited to join ${data.companyName || 'PLACE'}!

${data.inviterName} has created an account for you. Here are your login details:

Email: ${data.userEmail}
Temporary Password: ${data.tempPassword}

Please log in and change your password as soon as possible.

Login here: ${data.loginUrl}

Welcome to the team!
    `.trim();
  }

  private generateInviteEmailHTML(data: InviteEmailData): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Montserrat', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #000; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .credentials { background: white; padding: 15px; border-left: 4px solid #59c4c4; margin: 20px 0; }
        .button { display: inline-block; background: #59c4c4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to ${data.companyName || 'PLACE'}</h1>
        </div>
        <div class="content">
            <p>Hi there!</p>
            <p>${data.inviterName} has invited you to join <strong>${data.companyName || 'PLACE'}</strong>.</p>
            
            <div class="credentials">
                <h3>Your Login Details:</h3>
                <p><strong>Email:</strong> ${data.userEmail}</p>
                <p><strong>Temporary Password:</strong> ${data.tempPassword}</p>
            </div>
            
            <p>Please log in and change your password as soon as possible for security.</p>
            
            <p style="text-align: center;">
                <a href="${data.loginUrl}" class="button">Login Now</a>
            </p>
            
            <p>Welcome to the team!</p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  private generatePasswordResetEmailBody(data: PasswordResetEmailData): string {
    return `
Hi ${data.userName},

You requested a password reset for your ${data.companyName || 'PLACE'} account.

Click the link below to reset your password:
${data.resetUrl}

This link will expire in 24 hours for security reasons.

If you didn't request this reset, please ignore this email.

Best regards,
${data.companyName || 'PLACE'} Team
    `.trim();
  }

  private generatePasswordResetEmailHTML(data: PasswordResetEmailData): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Montserrat', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #000; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; background: #59c4c4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Reset Request</h1>
        </div>
        <div class="content">
            <p>Hi ${data.userName},</p>
            <p>You requested a password reset for your <strong>${data.companyName || 'PLACE'}</strong> account.</p>
            
            <p style="text-align: center;">
                <a href="${data.resetUrl}" class="button">Reset My Password</a>
            </p>
            
            <div class="warning">
                <p><strong>⚠️ Security Notice:</strong> This link will expire in 24 hours for security reasons.</p>
            </div>
            
            <p>If you didn't request this reset, please ignore this email and your password will remain unchanged.</p>
            
            <p>Best regards,<br>${data.companyName || 'PLACE'} Team</p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  // Generate a secure reset token
  public generateResetToken(): string {
    return crypto.randomUUID() + '-' + Date.now();
  }

  // Generate a temporary password
  public generateTempPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Validate reset token (check if it's not expired)
  public isResetTokenValid(token: string): boolean {
    try {
      const parts = token.split('-');
      if (parts.length !== 6) return false; // UUID has 5 parts + timestamp
      
      const timestamp = parseInt(parts[5], 10);
      const now = Date.now();
      const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
      
      return hoursDiff < 24; // Token valid for 24 hours
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const emailService = new EmailService();

// Email configuration component data
export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  apiKey: '',
  domain: '',
  fromEmail: '',
  isEnabled: false
};