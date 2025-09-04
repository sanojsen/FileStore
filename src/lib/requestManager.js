// Production-optimized request manager to prevent duplicate requests
class RequestManager {
  constructor() {
    this.activeRequests = new Map();
    this.cache = new Map();
    this.CACHE_DURATION = process.env.NODE_ENV === 'production' ? 60000 : 30000; // 60s in prod, 30s in dev
    this.MAX_CACHE_SIZE = 100;
    this.requestController = new AbortController();
  }

  createKey(page, filter, sortBy) {
    return `files-${page}-${filter}-${sortBy}`;
  }

  async fetchFiles(page, filter, sortBy) {
    const key = this.createKey(page, filter, sortBy);
    
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    // Check if request is already in progress
    if (this.activeRequests.has(key)) {
      return this.activeRequests.get(key);
    }

    // Create new request
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '12',
      sortBy: sortBy
    });
    
    if (filter !== 'all') {
      params.append('type', filter);
    }

    const requestPromise = fetch(`/api/files?${params}`, {
      signal: this.requestController.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      }
    })
      .then(response => response.json().then(data => ({ response, data })))
      .then(({ response, data }) => {
        if (!response.ok) {
          // Log the full error for debugging
          if (process.env.NODE_ENV !== 'production') {
            console.error(`[RequestManager] API Error ${response.status}:`, data.error);
          }
          throw new Error(data.error || `Failed to fetch files (${response.status})`);
        }
        
        // Cache the result
        this.cache.set(key, {
          data: data,
          timestamp: Date.now()
        });
        
        // Clean old cache entries to prevent memory leaks
        if (this.cache.size > this.MAX_CACHE_SIZE) {
          const oldestKeys = Array.from(this.cache.keys()).slice(0, this.cache.size - this.MAX_CACHE_SIZE);
          oldestKeys.forEach(key => this.cache.delete(key));
        }
        
        return data;
      })
      .finally(() => {
        // Remove from active requests
        this.activeRequests.delete(key);
      });

    this.activeRequests.set(key, requestPromise);
    return requestPromise;
  }

  clearCache() {
    this.cache.clear();
    this.activeRequests.clear();
  }
}

// Global singleton instance
let requestManager;
if (typeof window !== 'undefined') {
  if (!window.__requestManager) {
    window.__requestManager = new RequestManager();
  }
  requestManager = window.__requestManager;
} else {
  requestManager = new RequestManager();
}

export default requestManager;
