import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { users, userSettings } from '../../db/schema.ts';

const router = express.Router();

// Shared invitation handler for reuse
const sendInvitationHandler = async (req, res) => {
  const { userEmail, inviterName, tempPassword, loginUrl, companyName, emailConfig } = req.body;
  
  if (!emailConfig || !emailConfig.isEnabled) {
    return res.status(400).json({ error: 'Email service not configured' });
  }
  
  if (!emailConfig.apiKey || !emailConfig.domain || !emailConfig.fromEmail) {
    return res.status(400).json({ error: 'Missing email configuration' });
  }
  
  console.log('📧 Sending invitation email via backend');
  
  // Generate email content
  const textBody = `
You've been invited to join ${companyName || 'PLACE'}!

${inviterName} has created an account for you. Here are your login details:

Email: ${userEmail}
Temporary Password: ${tempPassword}

Please log in and change your password as soon as possible.

Login here: ${loginUrl}

Welcome to the team!
  `.trim();
  
  const htmlBody = `
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
            <h1>Welcome to ${companyName || 'PLACE'}</h1>
        </div>
        <div class="content">
            <p>Hi there!</p>
            <p>${inviterName} has invited you to join <strong>${companyName || 'PLACE'}</strong>.</p>
            
            <div class="credentials">
                <h3>Your Login Details:</h3>
                <p><strong>Email:</strong> ${userEmail}</p>
                <p><strong>Temporary Password:</strong> ${tempPassword}</p>
            </div>
            
            <p>Please log in and change your password as soon as possible for security.</p>
            
            <p style="text-align: center;">
                <a href="${loginUrl}" class="button">Login Now</a>
            </p>
            
            <p>Welcome to the team!</p>
        </div>
    </div>
</body>
</html>
  `.trim();
  
  // Prepare form data for Mailgun API
  const formData = new URLSearchParams();
  formData.append('from', `${inviterName} <${emailConfig.fromEmail}>`);
  formData.append('to', userEmail);
  formData.append('subject', `You've been invited to ${companyName || 'PLACE'}`);
  formData.append('text', textBody);
  formData.append('html', htmlBody);

  // Make Mailgun API call from backend
  const response = await fetch(`https://api.mailgun.net/v3/${emailConfig.domain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`api:${emailConfig.apiKey}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Mailgun API error:', response.status, response.statusText, errorText);
    return res.status(500).json({ 
      error: `Mailgun API error: ${response.status} ${response.statusText}`,
      details: errorText
    });
  }

  const result = await response.json();
  console.log('📧 Mailgun invitation email sent successfully:', result);
  
  return res.json({ success: true, message: 'Invitation email sent successfully', mailgunResponse: result });
};

// POST /api/email/send-invitation - Send invitation email
router.post('/send-invitation', authenticateToken, async (req, res) => {
  try {
    return await sendInvitationHandler(req, res);
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    res.status(500).json({ 
      error: 'Failed to send invitation email', 
      details: error.message 
    });
  }
});

// POST /api/email/test - Test email configuration
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const { testEmail, emailConfig } = req.body;
    
    if (!emailConfig || !emailConfig.isEnabled) {
      return res.status(400).json({ error: 'Email service not configured' });
    }
    
    if (!testEmail) {
      return res.status(400).json({ error: 'Test email address required' });
    }
    
    console.log('📧 Sending test email via backend');
    
    // Create test invitation data
    const testInvitationData = {
      userEmail: testEmail,
      inviterName: 'Test Admin',
      tempPassword: 'TestPass123',
      loginUrl: req.headers.origin || 'http://localhost:5173',
      companyName: 'PLACE (Test)',
      emailConfig
    };
    
    // Use the invitation sending logic
    req.body = testInvitationData;
    return await sendInvitationHandler(req, res);
    
  } catch (error) {
    console.error('Failed to send test email:', error);
    res.status(500).json({ 
      error: 'Failed to send test email', 
      details: error.message 
    });
  }
});

// Password reset email handler
const sendPasswordResetHandler = async (req, res) => {
  const { userEmail, resetLink, companyName, emailConfig } = req.body;
  
  if (!emailConfig || !emailConfig.isEnabled) {
    return res.status(400).json({ error: 'Email service not configured' });
  }
  
  if (!emailConfig.apiKey || !emailConfig.domain || !emailConfig.fromEmail) {
    return res.status(400).json({ error: 'Missing email configuration' });
  }
  
  console.log('📧 Sending password reset email via backend');
  
  // Generate email content
  const textBody = `
Password Reset Request for ${companyName || 'PLACE'}

You have requested a password reset for your account.

If you did not request this reset, please ignore this email and your password will remain unchanged.

To reset your password, click the link below:
${resetLink}

This link will expire in 1 hour for security reasons.

If you have any questions, please contact your system administrator.

Best regards,
${companyName || 'PLACE'} Team
  `.trim();
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Montserrat', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #000; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .reset-box { background: white; padding: 20px; border-left: 4px solid #59c4c4; margin: 20px 0; border-radius: 5px; }
        .button { display: inline-block; background: #59c4c4; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
        .warning { background: #fef3cd; border: 1px solid #fecaca; color: #92400e; padding: 12px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Reset Request</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>You have requested a password reset for your <strong>${companyName || 'PLACE'}</strong> account.</p>
            
            <div class="reset-box">
                <h3>Reset Your Password</h3>
                <p>Click the button below to reset your password:</p>
                <p style="text-align: center; margin: 20px 0;">
                    <a href="${resetLink}" class="button">Reset Password</a>
                </p>
                <p style="font-size: 12px; color: #666;">
                    Or copy and paste this link in your browser:<br>
                    <a href="${resetLink}" style="color: #59c4c4; word-break: break-all;">${resetLink}</a>
                </p>
            </div>
            
            <div class="warning">
                <p><strong>Important:</strong></p>
                <ul style="margin: 5px 0; padding-left: 20px;">
                    <li>This link will expire in 1 hour for security</li>
                    <li>If you didn't request this reset, ignore this email</li>
                    <li>Your password will remain unchanged if you don't click the link</li>
                </ul>
            </div>
            
            <p>If you have any questions, please contact your system administrator.</p>
            <p>Best regards,<br><strong>${companyName || 'PLACE'} Team</strong></p>
        </div>
    </div>
</body>
</html>
  `.trim();
  
  // Prepare form data for Mailgun API
  const formData = new URLSearchParams();
  formData.append('from', `${companyName || 'PLACE'} <${emailConfig.fromEmail}>`);
  formData.append('to', userEmail);
  formData.append('subject', `Password Reset Request - ${companyName || 'PLACE'}`);
  formData.append('text', textBody);
  formData.append('html', htmlBody);

  // Make Mailgun API call from backend
  const response = await fetch(`https://api.mailgun.net/v3/${emailConfig.domain}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`api:${emailConfig.apiKey}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Mailgun API error:', response.status, response.statusText, errorText);
    return res.status(500).json({ 
      error: `Mailgun API error: ${response.status} ${response.statusText}`,
      details: errorText
    });
  }

  const result = await response.json();
  console.log('📧 Mailgun password reset email sent successfully:', result);
  
  return res.json({ success: true, message: 'Password reset email sent successfully', mailgunResponse: result });
};

// POST /api/email/password-reset - Send password reset email
router.post('/password-reset', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    
    console.log('🔍 Starting password reset for email:', email);
    
    // Check if database is available
    if (!req.app.locals.db) {
      console.error('❌ Database not available in app.locals');
      return res.status(500).json({ error: 'Database not available' });
    }
    
    if (!req.app.locals.schema) {
      console.error('❌ Database schema not available in app.locals');
      return res.status(500).json({ error: 'Database schema not available' });
    }
    
    console.log('✅ Database and schema available, proceeding...');
    
    // Get email configuration from admin user settings
    // Find admin user first
    let adminUsers;
    try {
      adminUsers = await req.app.locals.db.select().from(users).where(eq(users.role, 'admin'));
      console.log('👥 Found', adminUsers.length, 'admin users');
    } catch (error) {
      console.error('❌ Error fetching admin users:', error);
      return res.status(500).json({ error: 'Database error while fetching admin configuration' });
    }
    
    if (adminUsers.length === 0) {
      console.error('❌ No admin user found for email configuration');
      return res.status(500).json({ error: 'No admin user found to configure email service' });
    }
    
    const adminUser = adminUsers[0]; // Use first admin user
    console.log('👤 Using admin user:', adminUser.username, 'for email config');
    
    // Get email settings for admin user
    let emailSettings;
    try {
      emailSettings = await req.app.locals.db.select().from(userSettings)
        .where(eq(userSettings.userId, adminUser.id));
      console.log('⚙️ Found', emailSettings.length, 'email settings for admin');
    } catch (error) {
      console.error('❌ Error fetching email settings:', error);
      return res.status(500).json({ error: 'Database error while fetching email configuration' });
    }
    
    const settingsMap = {};
    emailSettings.forEach(setting => {
      settingsMap[setting.key] = setting.value;
    });
    
    const emailConfig = {
      apiKey: settingsMap.emailApiKey,
      domain: settingsMap.emailDomain,
      fromEmail: settingsMap.emailFromEmail,
      isEnabled: settingsMap.emailIsEnabled === 'true'
    };
    
    console.log('📧 Email config status:', {
      hasApiKey: !!emailConfig.apiKey,
      hasDomain: !!emailConfig.domain,
      hasFromEmail: !!emailConfig.fromEmail,
      isEnabled: emailConfig.isEnabled
    });
    
    if (!emailConfig.isEnabled || !emailConfig.apiKey || !emailConfig.domain || !emailConfig.fromEmail) {
      console.error('❌ Email service not properly configured');
      return res.status(400).json({ error: 'Email service not configured. Please contact your administrator.' });
    }
    
    // Check if user exists
    const userList = await req.app.locals.db.select().from(users).where(eq(users.email, email));
    
    if (userList.length === 0) {
      // Don't reveal if user exists or not for security
      return res.json({ success: true, message: 'If an account with that email exists, a password reset link has been sent.' });
    }
    
    const user = userList[0];
    
    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 3600000); // 1 hour from now
    
    // Store reset token in database 
    await req.app.locals.db.update(users)
      .set({ 
        resetToken: resetToken,
        resetTokenExpiry: resetExpiry 
      })
      .where(eq(users.id, user.id));
    
    // Create reset link
    const resetLink = `${req.headers.origin || 'https://seoblog.placetools.ai'}/reset-password?token=${resetToken}`;
    
    // Send email
    const resetEmailData = {
      userEmail: email,
      resetLink: resetLink,
      companyName: 'PLACE',
      emailConfig: emailConfig
    };
    
    req.body = resetEmailData;
    return await sendPasswordResetHandler(req, res);
    
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    res.status(500).json({ 
      error: 'Failed to send password reset email', 
      details: error.message 
    });
  }
});

export default router;