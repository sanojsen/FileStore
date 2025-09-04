// Production logging utility
class Logger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  info(message, ...args) {
    if (!this.isProduction) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message, ...args) {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message, error, ...args) {
    console.error(`[ERROR] ${message}`, error, ...args);
    
    // In production, you might want to send errors to a monitoring service
    if (this.isProduction && typeof window !== 'undefined') {
      // Example: Send to monitoring service
      this.sendToMonitoring(message, error, ...args);
    }
  }

  debug(message, ...args) {
    if (!this.isProduction) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  sendToMonitoring(message, error, ...args) {
    // Implement your monitoring service here (e.g., Sentry, LogRocket, etc.)
    // For now, we'll just structure the error for potential future use
    const errorData = {
      message,
      error: error?.message || error,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
      additionalData: args
    };

    // You can replace this with your actual monitoring service
    console.error('Production Error:', errorData);
  }
}

// Global logger instance
const logger = new Logger();

export default logger;
