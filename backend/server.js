require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi    = require('swagger-ui-express');
const YAML         = require('yamljs');
const errorHandler = require('./middleware/error-handler');

const app = express();

// Load the swagger.yaml file
const swaggerDocument = YAML.load('./swagger.yaml');

// ── Core middleware ────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Allow requests from the Angular frontend
app.use(cors({
    origin:         process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials:    true,
    methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Swagger UI — accessible at http://localhost:4000/api-docs ─────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/accounts', require('./routes/accounts'));

// ── Global error handler (must be last) ────────────────────────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Backend listening on http://localhost:${PORT}`);
    console.log(`Swagger docs at http://localhost:${PORT}/api-docs`);
});