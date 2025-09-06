// Email service for user invitations and password resets
// Note: This uses a third-party email API (like EmailJS, SendGrid, or similar)
// You'll need to configure your email provider credentials

export interface EmailConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
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
    return !!(this.config && this.config.isEnabled && this.config.serviceId && this.config.publicKey);
  }

  // Send user invitation email
  public async sendInvitationEmail(data: InviteEmailData): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: 'Email service not configured' };
    }

    try {
      // Using EmailJS as an example - you can replace with your preferred service
      const emailData = {
        to_email: data.userEmail,
        to_name: data.userEmail.split('@')[0], // Use email prefix as name
        from_name: data.inviterName,
        subject: `You've been invited to ${data.companyName || 'AI SEO Blog Writer'}`,
        message: this.generateInviteEmailBody(data),
        temp_password: data.tempPassword,
        login_url: data.loginUrl,
        company_name: data.companyName || 'AI SEO Blog Writer'
      };

      // This would be replaced with your actual email service API call
      // For example, with EmailJS:
      // await emailjs.send(this.config.serviceId, this.config.templateId, emailData, this.config.publicKey);
      
      // For now, we'll simulate the email sending
      console.log('📧 Invitation email would be sent:', emailData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return { success: true, message: 'Invitation email sent successfully' };
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
      const emailData = {
        to_email: data.userEmail,
        to_name: data.userName,
        subject: 'Password Reset Request',
        message: this.generatePasswordResetEmailBody(data),
        reset_url: data.resetUrl,
        reset_token: data.resetToken,
        company_name: data.companyName || 'AI SEO Blog Writer'
      };

      // This would be replaced with your actual email service API call
      console.log('📧 Password reset email would be sent:', emailData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
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
You've been invited to join ${data.companyName || 'AI SEO Blog Writer'}!

${data.inviterName} has created an account for you. Here are your login details:

Email: ${data.userEmail}
Temporary Password: ${data.tempPassword}

Please log in and change your password as soon as possible.

Login here: ${data.loginUrl}

Welcome to the team!
    `.trim();
  }

  private generatePasswordResetEmailBody(data: PasswordResetEmailData): string {
    return `
Hi ${data.userName},

You requested a password reset for your ${data.companyName || 'AI SEO Blog Writer'} account.

Click the link below to reset your password:
${data.resetUrl}

This link will expire in 24 hours for security reasons.

If you didn't request this reset, please ignore this email.

Best regards,
${data.companyName || 'AI SEO Blog Writer'} Team
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
  serviceId: '',
  templateId: '',
  publicKey: '',
  isEnabled: false
};