import { Request, Response, NextFunction } from 'express';

// 404 Not Found handler for unmatched API routes
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({
    success: false,
    message: `Resource not found on endpoint: ${req.method} ${req.originalUrl}`,
  });
};

// Global error handler
export const globalErrorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error('[VED SERVER ERROR]', err);

  const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 400 : err.statusCode || err.status || (err.name === 'ValidationError' || err.name === 'CastError' ? 400 : 500);
  const message = err.code === 'LIMIT_FILE_SIZE' ? 'Provide an image file no larger than 3 MB.' : statusCode >= 500 && process.env.NODE_ENV === 'production'
    ? 'An internal server error occurred while processing your request.'
    : err.message || 'An internal server error occurred while processing your request.';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};
