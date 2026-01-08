/**
 * Simple rate limiter to prevent hitting Facebook's API limits
 */

class RateLimiter {
  private queue: Array<() => void> = [];
  private processing = false;
  private lastCallTime = 0;
  private minDelay = 100; // Minimum 100ms between API calls

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const timeSinceLastCall = now - this.lastCallTime;
          
          if (timeSinceLastCall < this.minDelay) {
            await this.delay(this.minDelay - timeSinceLastCall);
          }
          
          this.lastCallTime = Date.now();
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    const fn = this.queue.shift();
    
    if (fn) {
      await fn();
    }

    this.processing = false;

    if (this.queue.length > 0) {
      this.processQueue();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  setMinDelay(ms: number) {
    this.minDelay = ms;
  }
}

export const rateLimiter = new RateLimiter();
