const jwt = require('jsonwebtoken');

function authorize(roles = []) {
    if (typeof roles === 'string') roles = [roles];

    return [
        // 1. Check if the JWT token is valid
        (req, res, next) => {
            const header = req.headers['authorization'];
            const token  = header && header.startsWith('Bearer ') && header.slice(7);

            if (!token) return res.status(401).json({ message: 'Unauthorized' });

            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) return res.status(401).json({ message: 'Unauthorized' });
                req.auth = decoded; // saves { id, role } for use in routes
                next();
            });
        },

        // 2. Check if the user has the required role (e.g. Admin)
        (req, res, next) => {
            if (roles.length && !roles.includes(req.auth.role)) {
                return res.status(403).json({ message: 'Forbidden' });
            }
            next();
        },
    ];
}

module.exports = authorize;