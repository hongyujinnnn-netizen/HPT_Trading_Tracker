/**
 * IndexedDB Image Store
 * Handles persistent local storage of chart screenshot images (blobs / base64)
 * to avoid exceeding localStorage origin quota limits.
 */

const DB_NAME = 'TradePulseGold_DB';
const DB_VERSION = 1;
const STORE_NAME = 'screenshots';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const imageStore = {
  /**
   * Save screenshot data URL or blob into IndexedDB
   * @param {string} id - Unique image ID
   * @param {string} dataUrl - Base64 or Blob data URL
   */
  async saveImage(id, dataUrl) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(dataUrl, id);
        req.onsuccess = () => resolve(id);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error('Failed to save image to IndexedDB:', err);
      return null;
    }
  },

  /**
   * Retrieve screenshot data URL by image ID
   * @param {string} id 
   * @returns {Promise<string|null>}
   */
  async getImage(id) {
    if (!id) return null;
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error('Failed to retrieve image from IndexedDB:', err);
      return null;
    }
  },

  /**
   * Delete screenshot by image ID
   * @param {string} id 
   */
  async deleteImage(id) {
    if (!id) return;
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error('Failed to delete image from IndexedDB:', err);
    }
  }
};
