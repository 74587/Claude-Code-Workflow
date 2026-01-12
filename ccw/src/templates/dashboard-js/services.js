// ========================================
// Services Module
// ========================================
// 核心服务类：缓存管理、事件管理、预加载服务

// ========== CacheManager ==========
/**
 * 基于 sessionStorage 的缓存管理器
 * 支持 TTL 过期机制
 */
class CacheManager {
  /**
   * 创建缓存管理器实例
   * @param {string} prefix - 缓存键前缀
   * @param {Storage} storage - 存储对象（默认 sessionStorage）
   */
  constructor(prefix = 'ccw.cache.', storage = sessionStorage) {
    this.prefix = prefix;
    this.storage = storage;
  }

  /**
   * 获取缓存数据
   * @param {string} key - 缓存键
   * @returns {*} 缓存数据，过期或不存在返回 null
   */
  get(key) {
    try {
      const fullKey = this.prefix + key;
      const raw = this.storage.getItem(fullKey);
      if (!raw) return null;

      const cached = JSON.parse(raw);
      // 检查是否过期
      if (cached.timestamp && Date.now() > cached.timestamp) {
        this.storage.removeItem(fullKey);
        return null;
      }

      return cached.data;
    } catch (e) {
      console.error('[CacheManager] 获取缓存失败:', e);
      return null;
    }
  }

  /**
   * 设置缓存数据
   * @param {string} key - 缓存键
   * @param {*} data - 要缓存的数据
   * @param {number} ttl - 过期时间（毫秒），默认 3 分钟
   */
  set(key, data, ttl = 180000) {
    try {
      const fullKey = this.prefix + key;
      const cached = {
        data: data,
        timestamp: Date.now() + ttl
      };
      this.storage.setItem(fullKey, JSON.stringify(cached));
    } catch (e) {
      console.error('[CacheManager] 设置缓存失败:', e);
    }
  }

  /**
   * 检查缓存是否有效
   * @param {string} key - 缓存键
   * @returns {boolean} 缓存是否存在且未过期
   */
  isValid(key) {
    try {
      const fullKey = this.prefix + key;
      const raw = this.storage.getItem(fullKey);
      if (!raw) return false;

      const cached = JSON.parse(raw);
      if (cached.timestamp && Date.now() > cached.timestamp) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 使单个缓存失效
   * @param {string} key - 缓存键
   */
  invalidate(key) {
    try {
      const fullKey = this.prefix + key;
      this.storage.removeItem(fullKey);
    } catch (e) {
      console.error('[CacheManager] 使缓存失效失败:', e);
    }
  }

  /**
   * 清除所有带前缀的缓存
   */
  invalidateAll() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => this.storage.removeItem(key));
    } catch (e) {
      console.error('[CacheManager] 清除所有缓存失败:', e);
    }
  }
}


// ========== EventManager ==========
/**
 * 简单的发布/订阅事件管理器
 */
class EventManager {
  /**
   * 创建事件管理器实例
   */
  constructor() {
    this.events = {};
  }

  /**
   * 订阅事件
   * @param {string} eventName - 事件名称
   * @param {Function} fn - 回调函数
   */
  on(eventName, fn) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(fn);
  }

  /**
   * 取消订阅事件
   * @param {string} eventName - 事件名称
   * @param {Function} fn - 要移除的回调函数
   */
  off(eventName, fn) {
    if (!this.events[eventName]) return;
    this.events[eventName] = this.events[eventName].filter(f => f !== fn);
  }

  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {*} data - 传递给回调的数据
   */
  emit(eventName, data) {
    if (!this.events[eventName]) return;
    this.events[eventName].forEach(fn => {
      try {
        fn(data);
      } catch (e) {
        console.error('[EventManager] 事件回调执行失败:', eventName, e);
      }
    });
  }
}


// ========== PreloadService ==========
/**
 * 预加载服务
 * 管理数据源注册和预加载，防止重复请求
 */
class PreloadService {
  /**
   * 创建预加载服务实例
   * @param {CacheManager} cacheManager - 缓存管理器实例
   * @param {EventManager} eventManager - 事件管理器实例
   */
  constructor(cacheManager, eventManager) {
    this.cacheManager = cacheManager;
    this.eventManager = eventManager;
    // 已注册的数据源
    this.sources = new Map();
    // 进行中的请求 Promise，防止重复请求
    this.inFlight = new Map();
  }

  /**
   * 注册数据源
   * @param {string} key - 数据源标识
   * @param {Function} fetchFn - 获取数据的异步函数
   * @param {Object} options - 配置选项
   * @param {boolean} options.isHighPriority - 是否高优先级（初始预加载）
   * @param {number} options.ttl - 缓存 TTL（毫秒）
   */
  register(key, fetchFn, options = {}) {
    this.sources.set(key, {
      fetchFn: fetchFn,
      isHighPriority: options.isHighPriority || false,
      ttl: options.ttl || 180000
    });
  }

  /**
   * 预加载指定数据源
   * @param {string} key - 数据源标识
   * @param {Object} options - 预加载选项
   * @param {boolean} options.force - 是否强制刷新（忽略缓存）
   * @returns {Promise<*>} 预加载的数据
   */
  async preload(key, options = {}) {
    const source = this.sources.get(key);
    if (!source) {
      console.warn('[PreloadService] 未找到数据源:', key);
      return null;
    }

    // 检查缓存（非强制刷新时）
    if (!options.force && this.cacheManager.isValid(key)) {
      return this.cacheManager.get(key);
    }

    // 检查是否有进行中的请求
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    // 创建新请求
    const requestPromise = this._doFetch(key, source);
    this.inFlight.set(key, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // 请求完成后移除
      this.inFlight.delete(key);
    }
  }

  /**
   * 执行实际的数据获取
   * @private
   */
  async _doFetch(key, source) {
    try {
      const data = await source.fetchFn();
      // 存入缓存
      this.cacheManager.set(key, data, source.ttl);
      // 发出更新事件
      this.eventManager.emit('data:updated:' + key, data);
      this.eventManager.emit('data:updated', { key: key, data: data });
      return data;
    } catch (e) {
      console.error('[PreloadService] 预加载失败:', key, e);
      // 发出错误事件
      this.eventManager.emit('data:error:' + key, e);
      throw e;
    }
  }

  /**
   * 运行所有高优先级预加载
   * @returns {Promise<void>}
   */
  async runInitialPreload() {
    const highPriorityKeys = [];
    this.sources.forEach((source, key) => {
      if (source.isHighPriority) {
        highPriorityKeys.push(key);
      }
    });

    // 并行执行所有高优先级预加载
    await Promise.allSettled(
      highPriorityKeys.map(key => this.preload(key))
    );
  }
}


// ========== 导出到 window ==========
window.CacheManager = CacheManager;
window.EventManager = EventManager;
window.PreloadService = PreloadService;
