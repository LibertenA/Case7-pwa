import type { ServiceRequest } from './types'

const SERVER_KEY = 'service-requests-mock-server-v1'

type ServerRequest = Omit<ServiceRequest, 'attachmentBlob' | 'syncState'> & { syncState: 'synced' }

function readServer(): ServerRequest[] {
  try { return JSON.parse(localStorage.getItem(SERVER_KEY) || '[]') as ServerRequest[] }
  catch { return [] }
}
function writeServer(items: ServerRequest[]) {
  localStorage.setItem(SERVER_KEY, JSON.stringify(items))
}


export async function postRequest(item: ServiceRequest): Promise<{ serverId: string }> {
  await new Promise((resolve) => setTimeout(resolve, 250))
  if (!navigator.onLine) throw new Error('Браузер сообщает об отсутствии сети')
  let health: Response
  try { health = await fetch('/api/health', { method: 'HEAD', cache: 'no-store' }) }
  catch { throw new Error('Сервер недоступен. Заявка осталась в очереди') }
  if (!health.ok) throw new Error('Сервер не подтвердил доступность. Заявка осталась в очереди')
  const current = readServer()
  const existing = current.find((row) => row.clientId === item.clientId)
  if (existing) return { serverId: existing.serverId || existing.id }

  const serverId = `SRV-${Date.now().toString(36).toUpperCase()}`
  const { attachmentBlob: _blob, ...safeItem } = item
  const record: ServerRequest = { ...safeItem, id: serverId, serverId, syncState: 'synced' }
  current.unshift(record)
  writeServer(current)
  return { serverId }
}

export async function getServerRequests(): Promise<ServerRequest[]> {
  await new Promise((resolve) => setTimeout(resolve, 100))
  return readServer()
}
