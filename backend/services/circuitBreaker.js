class CircuitBreaker {
  constructor({ failureThreshold = 5, resetTimeoutMs = 10000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureAt = 0;
  }

  isOpen() {
    if (this.state !== "OPEN") return false;
    if (Date.now() - this.lastFailureAt > this.resetTimeoutMs) {
      this.state = "HALF_OPEN";
      return false;
    }
    return true;
  }

  async execute(action, fallback) {
    if (this.isOpen()) {
      return fallback();
    }

    try {
      const result = await action();
      this.failureCount = 0;
      this.state = "CLOSED";
      return result;
    } catch (err) {
      this.failureCount += 1;
      this.lastFailureAt = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = "OPEN";
      }

      return fallback(err);
    }
  }

  status() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      resetTimeoutMs: this.resetTimeoutMs
    };
  }
}

module.exports = new CircuitBreaker();
