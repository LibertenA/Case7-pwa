export type Category = 'Электрика' | 'Сантехника' | 'Климат' | 'Оборудование' | 'Помещение' | 'Другое'
export type Priority = 'Низкий' | 'Обычный' | 'Высокий' | 'Критический'
export type Status = 'В очереди' | 'Принята' | 'В работе' | 'Выполнена'

export interface ServiceRequest {
  id: string
  clientId: string
  title: string
  category: Category
  description: string
  priority: Priority
  location: string
  createdAt: string
  updatedAt: string
  status: Status
  syncState: 'synced' | 'pending' | 'failed'
  attachmentName?: string
  attachmentBlob?: Blob
  serverId?: string
  syncError?: string
}
