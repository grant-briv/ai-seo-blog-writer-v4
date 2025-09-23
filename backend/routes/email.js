import express from 'express';
import { authenticateToken } from '../middleware/auth.js';

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


export default router;