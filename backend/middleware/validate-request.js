const Joi = require('joi');

function validateRequest(schema) {
    return (req, res, next) => {

        // abortEarly: false means collect ALL errors, not just the first one
        const { error } = schema.validate(req.body, { abortEarly: false });

        if (error) {
            // Join all error messages into one string e.g. "Email is required, Password is too short"
            const msg = error.details.map(d => d.message).join(', ');
            return res.status(400).json({ message: msg });
        }

        // Validation passed — move on to the next middleware or controller
        next();
    };
}

module.exports = validateRequest;