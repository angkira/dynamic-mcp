import cors from '@fastify/cors'
import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  // Get allowed origins from environment variables
  const envOriginsMulti = process.env.CORS_ORIGINS || '';
  const envOriginSingle = process.env.CORS_ORIGIN || '';
  const clientUrl = process.env.CLIENT_URL || '';

  const additionalOrigins: string[] = [envOriginsMulti, envOriginSingle, clientUrl]
    .flatMap(v => v.split(','))
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  // Default allowed origins for development and local production
  const defaultOrigins: string[] = [
    // Development Vite server
    'http://localhost:5173',
    'https://localhost:5173',
    // Local server
    'http://localhost:3000',
    'https://localhost:3000',
    // Production client (nginx / CF worker)
    'http://localhost:80',
    'https://localhost:443',
    'http://localhost',
    'https://localhost',
    // Loopback fallbacks
    'http://127.0.0.1:5173',
    'https://127.0.0.1:5173',
    'http://127.0.0.1:3000',
    'https://127.0.0.1:3000',
    'http://127.0.0.1:80',
    'https://127.0.0.1:443',
    'http://127.0.0.1',
    'https://127.0.0.1'
  ];

  // Combine default and additional origins
  const allowedOrigins: string[] = [...defaultOrigins, ...additionalOrigins];

  fastify.log.info('CORS allowed origins:', allowedOrigins);

  // Enable CORS for all routes and methods with comprehensive configuration
  await fastify.register(cors, {
    // Allow requests from development and production origins
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Allow localhost for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Log rejected origins for debugging
      fastify.log.warn(`CORS rejected origin: ${origin}`);

      // Reject other origins
      return callback(new Error('Not allowed by CORS'), false);
    },

    // Allow all HTTP methods
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],

    // Allow headers that are commonly used
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'X-File-Name',
      'X-API-Key'
    ],

    // Enable credentials
    credentials: true,

    // Cache preflight requests for 1 hour
    maxAge: 3600,

    // Expose headers that external APIs might need
    exposedHeaders: [
      'Content-Range',
      'X-Content-Range',
      'X-Total-Count'
    ],

    // Handle preflight requests properly
    preflightContinue: false,
    optionsSuccessStatus: 200
  });

}

export default fp(corsPlugin)