import nodemailer from 'nodemailer';
import { config } from '../config/environment.js';
import logger from './logger.js';

/**
 * Email Service - Handles sending emails via SMTP
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter
   */
  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465, // true for 465, false for other ports
        auth: {
          user: config.smtp.user,
          pass: config.smtp.password,
        },
      });

      // Test connection
      this.transporter.verify((error, success) => {
        if (error) {
          logger.error('Email transporter verification failed:', error);
        } else {
          logger.info('Email transporter is ready to send messages');
        }
      });
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
    }
  }

  /**
   * Send OTP email for account verification
   */
  async sendVerificationOTP(email, otp, fullName = 'User') {
    try {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .otp-box { background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .otp-code { font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: 'Courier New', monospace; }
            .expiry { color: #e74c3c; font-weight: bold; margin-top: 10px; }
            .instructions { background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0; }
            .footer { text-align: center; font-size: 12px; color: #7f8c8d; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>BusDN - Account Verification</h1>
            </div>
            <div class="content">
              <p>Hello ${fullName},</p>
              <p>Welcome to BusDN! Please verify your account using the One-Time Password (OTP) below:</p>
              
              <div class="otp-box">
                <p>Your Verification Code:</p>
                <div class="otp-code">${otp}</div>
                <div class="expiry">⏱ Valid for 10 minutes</div>
              </div>

              <div class="instructions">
                <p><strong>Instructions:</strong></p>
                <ul>
                  <li>Copy the 6-digit code above</li>
                  <li>Enter it in the verification field</li>
                  <li>This code will expire in 10 minutes</li>
                  <li>Never share this code with anyone</li>
                </ul>
              </div>

              <p style="margin-top: 20px;">If you didn't request this verification, please ignore this email.</p>

              <div class="footer">
                <p>© 2024 BusDN - Premium Bus Booking Platform. All rights reserved.</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"${config.emailFrom.name || 'BusDN'}" <${config.smtp.user}>`,
        to: email,
        subject: 'BusDN Account Verification - Your OTP Code',
        html,
        text: `Your BusDN verification code is: ${otp}\nValid for 10 minutes. Do not share this code with anyone.`,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Verification OTP sent to ${email}:`, info.messageId);
      return true;
    } catch (error) {
      logger.error(`Failed to send verification OTP to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Send OTP email for password reset
   */
  async sendPasswordResetOTP(email, otp, fullName = 'User') {
    try {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .otp-box { background: white; border: 2px solid #f5576c; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .otp-code { font-size: 36px; font-weight: bold; color: #f5576c; letter-spacing: 5px; font-family: 'Courier New', monospace; }
            .expiry { color: #e74c3c; font-weight: bold; margin-top: 10px; }
            .instructions { background: white; padding: 15px; border-left: 4px solid #f5576c; margin: 20px 0; }
            .footer { text-align: center; font-size: 12px; color: #7f8c8d; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>BusDN - Password Reset</h1>
            </div>
            <div class="content">
              <p>Hello ${fullName},</p>
              
              <div class="warning">
                <p><strong>⚠️ Security Alert:</strong> A password reset was requested for your account.</p>
              </div>

              <p>If you requested to reset your password, please use the One-Time Password (OTP) below:</p>
              
              <div class="otp-box">
                <p>Your Reset Code:</p>
                <div class="otp-code">${otp}</div>
                <div class="expiry">⏱ Valid for 10 minutes</div>
              </div>

              <div class="instructions">
                <p><strong>What to do:</strong></p>
                <ul>
                  <li>Copy the 6-digit code above</li>
                  <li>Return to the password reset page</li>
                  <li>Enter the code and your new password</li>
                  <li>This code will expire in 10 minutes</li>
                </ul>
              </div>

              <div class="warning">
                <p><strong>Didn't request a password reset?</strong> Your account may be at risk. Please:</p>
                <ul>
                  <li>Ignore this email if you didn't make this request</li>
                  <li>Login and check your account security settings</li>
                  <li>Change your password immediately if you suspect unauthorized access</li>
                </ul>
              </div>

              <div class="footer">
                <p>© 2024 BusDN - Premium Bus Booking Platform. All rights reserved.</p>
                <p>This is an automated message. Please do not reply to this email.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"${config.emailFrom.name || 'BusDN'}" <${config.smtp.user}>`,
        to: email,
        subject: 'BusDN Password Reset - Your OTP Code',
        html,
        text: `Your BusDN password reset code is: ${otp}\nValid for 10 minutes. If you didn't request this, please ignore this email.`,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Password reset OTP sent to ${email}:`, info.messageId);
      return true;
    } catch (error) {
      logger.error(`Failed to send password reset OTP to ${email}:`, error);
      throw error;
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email, fullName = 'User') {
    try {
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
            .features { margin: 20px 0; }
            .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #667eea; }
            .feature-title { font-weight: bold; color: #667eea; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; font-size: 12px; color: #7f8c8d; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to BusDN! 🚌</h1>
            </div>
            <div class="content">
              <p>Hello ${fullName},</p>
              <p>Welcome to BusDN - Your Premium Bus Booking Platform! We're thrilled to have you on board.</p>

              <div class="features">
                <div class="feature">
                  <div class="feature-title">📍 Easy Route Planning</div>
                  <p>Find the best bus routes and schedules in seconds.</p>
                </div>
                <div class="feature">
                  <div class="feature-title">💳 Secure Booking</div>
                  <p>Book your tickets safely with multiple payment options.</p>
                </div>
                <div class="feature">
                  <div class="feature-title">🎟️ Monthly Pass</div>
                  <p>Save money with our flexible monthly pass plans.</p>
                </div>
              </div>

              <p>Your account is now active and ready to use. Start booking your next bus ride today!</p>

              <div class="footer">
                <p>© 2024 BusDN - Premium Bus Booking Platform. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"${config.emailFrom.name || 'BusDN'}" <${config.smtp.user}>`,
        to: email,
        subject: 'Welcome to BusDN - Your Account is Ready!',
        html,
        text: `Welcome to BusDN, ${fullName}! Your account is ready to use. Start booking bus tickets today!`,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Welcome email sent to ${email}:`, info.messageId);
      return true;
    } catch (error) {
      logger.error(`Failed to send welcome email to ${email}:`, error);
      throw error;
    }
  }
}

export default new EmailService();
