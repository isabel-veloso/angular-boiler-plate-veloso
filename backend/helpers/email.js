const nodemailer = require('nodemailer');

// Creates a one-time Ethereal test account and returns a transporter
// Ethereal is a fake SMTP service — emails are caught and viewable at a URL
async function createTransporter() {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
        host:   'smtp.ethereal.email',
        port:   587,
        secure: false,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass,
        },
    });
}

// Sends a verification link to the user's email after registration
async function sendVerificationEmail(to, token) {
    const transporter = await createTransporter();
    const url = `${process.env.FRONTEND_URL}/account/verify-email?token=${token}`;
    const info = await transporter.sendMail({
        from:    '"No Reply" <noreply@example.com>',
        to,
        subject: 'Verify your email address',
        html: `
            <h4>Verification Email</h4>
            <p>Thanks for registering!</p>
            <p>Click the link below to verify your email:</p>
            <p><a href="${url}">${url}</a></p>
            <p>This link expires in 24 hours.</p>
        `,
    });
    // Logs the Ethereal URL where you can view the email
    console.log('Verification email URL: ' + nodemailer.getTestMessageUrl(info));
}

// Sends a password reset link when the user clicks Forgot Password
async function sendPasswordResetEmail(to, token) {
    const transporter = await createTransporter();
    const url = `${process.env.FRONTEND_URL}/account/reset-password?token=${token}`;
    const info = await transporter.sendMail({
        from:    '"No Reply" <noreply@example.com>',
        to,
        subject: 'Reset Password Email',
        html: `
            <h4>Reset Password Email</h4>
            <p>Click the link below to reset your password (valid for 1 day):</p>
            <p><a href="${url}">${url}</a></p>
        `,
    });
    // Logs the Ethereal URL where you can view the email
    console.log('Password reset email URL: ' + nodemailer.getTestMessageUrl(info));
}

// Sends a notice if someone tries to register with an already-existing email
async function sendAlreadyRegisteredEmail(to) {
    const transporter = await createTransporter();
    const info = await transporter.sendMail({
        from:    '"No Reply" <noreply@example.com>',
        to,
        subject: 'Email Already Registered',
        html: `
            <h4>Email Already Registered</h4>
            <p>Your email ${to} is already registered.</p>
            <p>Visit the <a href="${process.env.FRONTEND_URL}/account/forgot-password">
               forgot password</a> page if you forgot your password.</p>
        `,
    });
    // Logs the Ethereal URL where you can view the email
    console.log('Already registered email URL: ' + nodemailer.getTestMessageUrl(info));
}

// Export all functions so they can be used in account.service.js
module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendAlreadyRegisteredEmail
};