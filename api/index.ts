import app from '../server.js';

// Global error handler for Vercel
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Vercel Function Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

export default app;
