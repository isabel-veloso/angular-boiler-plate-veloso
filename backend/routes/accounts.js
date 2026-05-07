const express         = require('express');
const Joi             = require('joi');
const router          = express.Router();
const accountService  = require('../services/account.service');
const authorize       = require('../middleware/authorize');
const validateRequest = require('../middleware/validate-request');

// ── Public routes (no login required) ────────────────────────────────────────
router.post('/authenticate',            schema({ email: Joi.string().email().required(), password: Joi.string().required() }), authenticate);
router.post('/refresh-token',           refreshToken);
router.post('/revoke-token',            authorize(), schema({ token: Joi.string().empty('') }), revokeToken);
router.post('/register',                schema({ title: Joi.string().required(), firstName: Joi.string().required(), lastName: Joi.string().required(), email: Joi.string().email().required(), password: Joi.string().min(6).required(), confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords do not match' }), acceptTerms: Joi.boolean().valid(true).required().messages({ 'any.only': 'Accept Ts & Cs is required' }) }), register);
router.post('/verify-email',            schema({ token: Joi.string().required() }), verifyEmail);
router.post('/forgot-password',         schema({ email: Joi.string().email().required() }), forgotPassword);
router.post('/validate-reset-token',    schema({ token: Joi.string().required() }), validateResetToken);
router.post('/reset-password',          schema({ token: Joi.string().required(), password: Joi.string().min(6).required(), confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords do not match' }) }), resetPassword);

// ── Admin only routes ─────────────────────────────────────────────────────────
router.get('/',     authorize('Admin'), getAll);
router.post('/',    authorize('Admin'), schema({ title: Joi.string().required(), firstName: Joi.string().required(), lastName: Joi.string().required(), email: Joi.string().email().required(), password: Joi.string().min(6).required(), confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({ 'any.only': 'Passwords do not match' }), role: Joi.string().valid('Admin', 'User').required() }), create);

// ── Authenticated routes (login required) ─────────────────────────────────────
router.get('/:id',    authorize(), getById);
router.put('/:id',    authorize(), updateSchema, update);
router.delete('/:id', authorize(), _delete);

module.exports = router;

// ── Helper: wraps a Joi object schema into validateRequest middleware ──────────
function schema(joiSchema) {
    return validateRequest(Joi.object(joiSchema));
}

// ── Controllers ───────────────────────────────────────────────────────────────

// Login — returns JWT token and sets refresh cookie
function authenticate(req, res, next) {
    accountService.authenticate({ email: req.body.email, password: req.body.password, ipAddress: req.ip }, res)
        .then(account => res.json(account))
        .catch(next);
}

// Issues a new JWT using the refresh token from the cookie
function refreshToken(req, res, next) {
    accountService.refreshToken({ token: req.cookies.refreshToken, ipAddress: req.ip }, res)
        .then(account => res.json(account))
        .catch(next);
}

// Logout — deletes the refresh token
function revokeToken(req, res, next) {
    const token = req.body.token || req.cookies.refreshToken;
    accountService.revokeToken({ token })
        .then(() => res.json({ message: 'Token revoked' }))
        .catch(next);
}

// Register — creates account and sends verification email
function register(req, res, next) {
    accountService.register(req.body)
        .then(() => res.json({ message: 'Registration successful, please check your email for verification instructions' }))
        .catch(next);
}

// Verify email — marks account as verified
function verifyEmail(req, res, next) {
    accountService.verifyEmail(req.body)
        .then(() => res.json({ message: 'Verification successful, you can now login' }))
        .catch(next);
}

// Forgot password — sends reset email
function forgotPassword(req, res, next) {
    accountService.forgotPassword(req.body)
        .then(() => res.json({ message: 'Please check your email for password reset instructions' }))
        .catch(next);
}

// Validate reset token — checks if token is valid before showing reset form
function validateResetToken(req, res, next) {
    accountService.validateResetToken(req.body)
        .then(() => res.json({ message: 'Token is valid' }))
        .catch(next);
}

// Reset password — saves the new password
function resetPassword(req, res, next) {
    accountService.resetPassword(req.body)
        .then(() => res.json({ message: 'Password reset successful, you can now login' }))
        .catch(next);
}

// Get all accounts (Admin only)
function getAll(req, res, next) {
    accountService.getAll()
        .then(accounts => res.json(accounts))
        .catch(next);
}

// Get account by ID — users can only get their own, admins can get any
function getById(req, res, next) {
    const id = parseInt(req.params.id, 10);
    if (req.auth.role !== 'Admin' && req.auth.id !== id) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    accountService.getById(id)
        .then(account => res.json(account))
        .catch(next);
}

// Create account (Admin only)
function create(req, res, next) {
    accountService.create(req.body)
        .then(account => res.json(account))
        .catch(next);
}

// Update schema — admins can also change role, regular users cannot
function updateSchema(req, res, next) {
    const fields = {
        title:           Joi.string().empty(''),
        firstName:       Joi.string().empty(''),
        lastName:        Joi.string().empty(''),
        email:           Joi.string().email().empty(''),
        password:        Joi.string().min(6).empty(''),
        confirmPassword: Joi.string().valid(Joi.ref('password')).empty('')
            .messages({ 'any.only': 'Passwords do not match' }),
    };
    if (req.auth.role === 'Admin') {
        fields.role = Joi.string().valid('Admin', 'User').empty('');
    }
    validateRequest(Joi.object(fields))(req, res, next);
}

// Update account — users can only update their own, admins can update any
function update(req, res, next) {
    const id = parseInt(req.params.id, 10);
    if (req.auth.role !== 'Admin' && req.auth.id !== id) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    accountService.update(id, req.body)
        .then(account => res.json(account))
        .catch(next);
}

// Delete account — users can only delete their own, admins can delete any
function _delete(req, res, next) {
    const id = parseInt(req.params.id, 10);
    if (req.auth.role !== 'Admin' && req.auth.id !== id) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    accountService.delete(id)
        .then(() => res.json({ message: 'Account deleted successfully' }))
        .catch(next);
}