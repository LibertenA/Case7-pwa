import type { ServiceRequest } from './types'

const DB_NAME = 'service-requests-db'
const DB_VERSION = 1
const STORE = 'requests'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
        store.createIndex('syncState', 'syncState')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Хранилище занято другой вкладкой'))
  })
}

export async function getAllRequests(): Promise<ServiceRequest[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).getAll()
    request.onsuccess = () => resolve((request.result as ServiceRequest[]).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    ))
    request.onerror = () => { db.close(); reject(request.error) }
    tx.oncomplete = () => db.close()
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function saveRequest(item: ServiceRequest): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(item)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error) }
  })
}

export async function getPendingRequests(): Promise<ServiceRequest[]> {
  return (await getAllRequests()).filter((item) => item.syncState !== 'synced')
}
