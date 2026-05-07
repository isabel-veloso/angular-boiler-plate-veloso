const bcrypt         = require('bcryptjs');
const jwt            = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db             = require('../config/database');
const emailHelper    = require('../helpers/email');

// ── Helpers ───────────────────────────────────────────────────────────────────

// Creates a custom error with a status code
function appError(status, message) {
    const e = new Error(message);
    e.status = status;
    return e;
}

// Returns only the safe fields to send back to the frontend
function basicDetails(account) {
    return {
        id:         account.id,
        title:      account.title,
        firstName:  account.firstName,
        lastName:   account.lastName,
        email:      account.email,
        role:       account.role,
        created:    account.created,
        updated:    account.updated,
        isVerified: !!account.isVerified,
    };
}

// Creates a signed JWT token for the account (expires in 15 mins)
function generateJwt(account) {
    return jwt.sign(
        { sub: account.id, id: account.id, role: account.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY || '15m' }
    );
}

// Creates a new refresh token object with an expiry date
function generateRefreshToken(accountId) {
    const days    = parseInt(process.env.REFRESH_TOKEN_EXPIRY_DAYS || '7', 10);
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return { token: uuidv4(), expires, accountId };
}

// Saves the refresh token as an httpOnly cookie in the browser
function setRefreshCookie(res, token, expires) {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        expires,
        sameSite: process.env.COOKIE_SAMESITE || 'lax',
        secure:   process.env.COOKIE_SECURE === 'true',
    });
}

// ── Service Methods ───────────────────────────────────────────────────────────

// Logs in a user — checks email/password, returns JWT + sets refresh cookie
async function authenticate({ email, password, ipAddress }, res) {
    const [rows] = await db.query('SELECT * FROM accounts WHERE email = ?', [email]);
    const account = rows[0];

    // Reject if email not found or password is wrong
    if (!account || !bcrypt.compareSync(password, account.passwordHash)) {
        throw appError(400, 'Email or password is incorrect');
    }
    // Reject if email not yet verified
    if (!account.isVerified) {
        throw appError(400, 'Please verify your email before logging in');
    }

    const jwtToken = generateJwt(account);
    const rt       = generateRefreshToken(account.id);

    // Save refresh token to database
    await db.query(
        'INSERT INTO refresh_tokens (accountId, token, expires, createdByIp) VALUES (?, ?, ?, ?)',
        [account.id, rt.token, rt.expires, ipAddress]
    );

    setRefreshCookie(res, rt.token, rt.expires);
    return { ...basicDetails(account), jwtToken };
}

// Issues a new JWT using the refresh token cookie
async function refreshToken({ token, ipAddress }, res) {
    if (!token) throw appError(401, 'Unauthorized');

    const [rows] = await db.query(
        'SELECT * FROM refresh_tokens WHERE token = ?', [token]
    );
    const rt = rows[0];
    if (!rt)                                throw appError(401, 'Unauthorized');
    if (new Date(rt.expires) < new Date()) throw appError(401, 'Unauthorized');

    // Delete old refresh token and create a new one (rotation)
    const newRt = generateRefreshToken(rt.accountId);
    await db.query('DELETE FROM refresh_tokens WHERE token = ?', [rt.token]);
    await db.query(
        'INSERT INTO refresh_tokens (accountId, token, expires, createdByIp) VALUES (?, ?, ?, ?)',
        [rt.accountId, newRt.token, newRt.expires, ipAddress]
    );

    const [accRows] = await db.query('SELECT * FROM accounts WHERE id = ?', [rt.accountId]);
    if (!accRows[0]) throw appError(401, 'Unauthorized');

    const jwtToken = generateJwt(accRows[0]);
    setRefreshCookie(res, newRt.token, newRt.expires);
    return { ...basicDetails(accRows[0]), jwtToken };
}

// Deletes the refresh token to log the user out
async function revokeToken({ token }) {
    if (!token) throw appError(400, 'Token is required');
    const [rows] = await db.query('SELECT id FROM refresh_tokens WHERE token = ?', [token]);
    if (!rows[0]) throw appError(400, 'Token not found');
    await db.query('DELETE FROM refresh_tokens WHERE token = ?', [token]);
}

// Registers a new account and sends a verification email
async function register(params) {
    const [existing] = await db.query('SELECT id FROM accounts WHERE email = ?', [params.email]);

    if (existing[0]) {
        // Email already exists — send a notice but don't reveal it to the frontend
        emailHelper.sendAlreadyRegisteredEmail(params.email).catch(() => {});
        return;
    }

    // First account ever becomes Admin, the rest are Users
    const [count]      = await db.query('SELECT COUNT(*) AS n FROM accounts');
    const role         = count[0].n === 0 ? 'Admin' : 'User';
    const passwordHash = bcrypt.hashSync(params.password, 10);
    const verToken     = uuidv4(); // unique token for email verification

    await db.query(
        `INSERT INTO accounts
            (title, firstName, lastName, email, passwordHash, acceptTerms, role, verificationToken)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [params.title, params.firstName, params.lastName, params.email,
         passwordHash, params.acceptTerms ? 1 : 0, role, verToken]
    );

    await emailHelper.sendVerificationEmail(params.email, verToken);
}

// Marks account as verified when user clicks the email link
async function verifyEmail({ token }) {
    const [rows] = await db.query(
        'SELECT * FROM accounts WHERE verificationToken = ?', [token]
    );
    const account = rows[0];
    if (!account) throw appError(400, 'Verification failed');

    await db.query(
        `UPDATE accounts
         SET isVerified = 1, verified = NOW(), verificationToken = NULL
         WHERE id = ?`,
        [account.id]
    );
}

// Sends a password reset email if the email exists
async function forgotPassword({ email }) {
    const [rows] = await db.query('SELECT * FROM accounts WHERE email = ?', [email]);
    if (!rows[0]) return; // always succeed — don't reveal if email exists

    const resetToken   = uuidv4();
    const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.query(
        'UPDATE accounts SET resetToken = ?, resetTokenExpires = ? WHERE id = ?',
        [resetToken, resetExpires, rows[0].id]
    );

    await emailHelper.sendPasswordResetEmail(email, resetToken);
}

// Checks if the reset token is valid and not expired
async function validateResetToken({ token }) {
    const [rows] = await db.query('SELECT * FROM accounts WHERE resetToken = ?', [token]);
    const account = rows[0];
    if (!account)                                         throw appError(400, 'Invalid token');
    if (new Date(account.resetTokenExpires) < new Date()) throw appError(400, 'Invalid token');
    return account;
}

// Saves the new password after reset
async function resetPassword({ token, password }) {
    const account      = await validateResetToken({ token });
    const passwordHash = bcrypt.hashSync(password, 10);

    await db.query(
        `UPDATE accounts
         SET passwordHash = ?, passwordReset = NOW(),
             resetToken = NULL, resetTokenExpires = NULL
         WHERE id = ?`,
        [passwordHash, account.id]
    );
}

// Returns all accounts (Admin only)
async function getAll() {
    const [rows] = await db.query('SELECT * FROM accounts ORDER BY created DESC');
    return rows.map(basicDetails);
}

// Returns a single account by ID
async function getById(id) {
    const [rows] = await db.query('SELECT * FROM accounts WHERE id = ?', [id]);
    if (!rows[0]) throw appError(404, 'Account not found');
    return basicDetails(rows[0]);
}

// Creates a new account (Admin only)
async function create(params) {
    const [dup] = await db.query('SELECT id FROM accounts WHERE email = ?', [params.email]);
    if (dup[0]) throw appError(400, `Email ${params.email} is already registered`);

    const passwordHash = bcrypt.hashSync(params.password, 10);

    await db.query(
        `INSERT INTO accounts
            (title, firstName, lastName, email, passwordHash, role, isVerified, verified)
         VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
        [params.title, params.firstName, params.lastName,
         params.email, passwordHash, params.role]
    );

    const [newRows] = await db.query('SELECT * FROM accounts WHERE email = ?', [params.email]);
    return basicDetails(newRows[0]);
}

// Updates an existing account
async function update(id, params) {
    const [rows] = await db.query('SELECT * FROM accounts WHERE id = ?', [id]);
    if (!rows[0]) throw appError(404, 'Account not found');

    // Check if new email is already taken by someone else
    if (params.email && params.email !== rows[0].email) {
        const [dup] = await db.query('SELECT id FROM accounts WHERE email = ?', [params.email]);
        if (dup[0]) throw appError(400, 'Email is already registered');
    }

    const setClauses = [];
    const values     = [];

    // Only update fields that were actually sent
    for (const field of ['title', 'firstName', 'lastName', 'email', 'role']) {
        if (params[field] !== undefined) {
            setClauses.push(`\`${field}\` = ?`);
            values.push(params[field]);
        }
    }
    if (params.password) {
        setClauses.push('`passwordHash` = ?');
        values.push(bcrypt.hashSync(params.password, 10));
    }

    if (setClauses.length === 0) return basicDetails(rows[0]);

    values.push(id);
    await db.query(`UPDATE accounts SET ${setClauses.join(', ')} WHERE id = ?`, values);

    const [updated] = await db.query('SELECT * FROM accounts WHERE id = ?', [id]);
    return basicDetails(updated[0]);
}

// Deletes an account and its refresh tokens
async function deleteAccount(id) {
    const [rows] = await db.query('SELECT id FROM accounts WHERE id = ?', [id]);
    if (!rows[0]) throw appError(404, 'Account not found');
    // CASCADE in the DB automatically deletes refresh_tokens too
    await db.query('DELETE FROM accounts WHERE id = ?', [id]);
}

// Export all service functions
module.exports = {
    authenticate,
    refreshToken,
    revokeToken,
    register,
    verifyEmail,
    forgotPassword,
    validateResetToken,
    resetPassword,
    getAll,
    getById,
    create,
    update,
    delete: deleteAccount,
};