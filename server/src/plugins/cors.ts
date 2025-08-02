import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

async function corsPlugin(fastify: FastifyInstance) {
  // Enable CORS for all routes and methods with comprehensive configuration
  await fastify.register(cors, {
    // Allow requests from development and production origins
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Allow localhost for development
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
      
      // Allow your production domains here
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000'
      ];
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
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

export default fp(corsPlugin);