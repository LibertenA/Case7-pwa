import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertCircle, ArrowDownToLine, Check, CheckCircle2, Clock3,
  Cloud, CloudOff, FileImage, Plus, RefreshCw, Send, ShieldCheck, Wifi, WifiOff, X, FlaskConical,
} from 'lucide-react'
import { getAllRequests, getPendingRequests, saveRequest } from './db'
import { postRequest } from './mockApi'
import type { Category, Priority, ServiceRequest, Status } from './types'

const categories: Category[] = ['Электрика', 'Сантехника', 'Климат', 'Оборудование', 'Помещение', 'Другое']
const priorities: Priority[] = ['Низкий', 'Обычный', 'Высокий', 'Критический']
const statuses: Status[] = ['В очереди', 'Принята', 'В работе', 'Выполнена']

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function App() {
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine)
  const [demoOffline, setDemoOffline] = useState(localStorage.getItem('service-requests-demo-offline') === 'true')
  const online = browserOnline && !demoOffline
  const syncLock = useRef(false)
  const [syncing, setSyncing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('Все')
  const [form, setForm] = useState(() => {
    const initial = { title: '', category: 'Оборудование' as Category, description: '', priority: 'Обычный' as Priority, location: '' }
    try { return { ...initial, ...JSON.parse(localStorage.getItem('service-request-form-draft') || '{}') } } catch { return initial }
  })
  const [file, setFile] = useState<File | null>(null)

  const refresh = useCallback(async () => {
    setRequests(await getAllRequests())
  }, [])

  const sync = useCallback(async () => {
    if (!navigator.onLine || demoOffline || syncLock.current) return
    syncLock.current = true
    setSyncing(true)
    let sent = 0
    let failed = 0
    try {
      const pending = await getPendingRequests()
      for (const item of pending) {
        try {
          await saveRequest({ ...item, syncState: 'pending', syncError: undefined })
          const result = await postRequest(item)
          await saveRequest({ ...item, syncState: 'synced', syncError: undefined, serverId: result.serverId, updatedAt: new Date().toISOString() })
          sent += 1
        } catch (error) {
          await saveRequest({ ...item, syncState: 'failed', syncError: error instanceof Error ? error.message : 'Не удалось отправить заявку' })
          failed += 1
          if (error instanceof Error && error.message.toLowerCase().includes('сервер')) setBrowserOnline(false)
        }
      }
      await refresh()
      if (pending.length) setNotice(failed ? `Отправлено: ${sent}. Ошибок: ${failed}. Заявки сохранены и доступны для повтора.` : `Синхронизация завершена. Отправлено заявок: ${sent}.`)
    } finally {
      syncLock.current = false
      setSyncing(false)
      await refresh()
    }
  }, [refresh, demoOffline])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => { localStorage.setItem('service-request-form-draft', JSON.stringify(form)) }, [form])
  useEffect(() => {
    const checkConnection = async () => {
      if (!navigator.onLine) { setBrowserOnline(false); return }
      try {
        const response = await fetch('/api/health', { method: 'HEAD', cache: 'no-store' })
        setBrowserOnline(response.ok)
        if (response.ok) void sync()
      } catch { setBrowserOnline(false) }
    }
    const onOnline = () => { setBrowserOnline(true); void checkConnection() }
    const onOffline = () => setBrowserOnline(false)
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_REQUESTS') void sync()
    }
    void checkConnection()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    navigator.serviceWorker?.addEventListener('message', onMessage)
    const promptHandler = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', promptHandler)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      navigator.serviceWorker?.removeEventListener('message', onMessage)
      window.removeEventListener('beforeinstallprompt', promptHandler)
    }
  }, [sync])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const pendingCount = requests.filter((item) => item.syncState !== 'synced').length
  const filtered = useMemo(() => filter === 'Все' ? requests : requests.filter((item) => item.status === filter), [requests, filter])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (file && file.size > 10 * 1024 * 1024) { setNotice('Размер файла не должен превышать 10 МБ'); return }
    const now = new Date().toISOString()
    const item: ServiceRequest = {
      id: uid(), clientId: uid(), ...form, createdAt: now, updatedAt: now,
      status: 'В очереди', syncState: 'pending',
      ...(file ? { attachmentName: file.name, attachmentBlob: file } : {}),
    }
    await saveRequest(item)
    await refresh()
    setShowForm(false)
    setForm({ title: '', category: 'Оборудование', description: '', priority: 'Обычный', location: '' })
    setFile(null)
    setNotice(online ? 'Заявка сохранена и поставлена в очередь синхронизации' : 'Заявка сохранена на устройстве. Отправим её, когда появится интернет')
    if (online) void sync()
    try {
      const registration = await navigator.serviceWorker?.ready
      if ('sync' in (registration || {})) await (registration as any).sync.register('sync-service-requests')
    } catch {  }
  }

  async function install() {
    if (!installPrompt) return
    await installPrompt.prompt()
    setInstallPrompt(null)
  }

  async function demoStatus(item: ServiceRequest) {
    const next = statuses[(statuses.indexOf(item.status) + 1) % statuses.length]
    await saveRequest({ ...item, status: next, updatedAt: new Date().toISOString() })
    await refresh()
  }

  function setDemoNetworkOffline(value: boolean) {
    localStorage.setItem('service-requests-demo-offline', String(value))
    setDemoOffline(value)
    setNotice(value ? 'Демо offline включён: новые заявки останутся в очереди.' : 'Демо offline выключен: запускается отправка очереди.')
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><Activity size={21} /></div>
          <div><strong>Сервисные заявки</strong><span>Обслуживание объектов</span></div>
        </div>
        <div className={`connection ${online ? 'is-online' : 'is-offline'}`}>
          {online ? <Wifi size={15} /> : <WifiOff size={15} />}
          <span>{online ? 'В сети' : 'Нет сети'}</span>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</div>
          <h1>Заявки на<br /><em>обслуживание</em></h1>
          <p>Сообщайте о неисправностях и отслеживайте ход работ — даже без интернета.</p>
          <button className="primary-btn" onClick={() => setShowForm(true)}><Plus size={18} /> Создать заявку</button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-ring ring-one" /><div className="art-ring ring-two" />
          <div className="art-card"><ShieldCheck size={36} /><span>Надёжно<br />сохранено</span><CheckCircle2 size={20} /></div>
          <div className="art-dot dot-one" /><div className="art-dot dot-two" />
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card"><span className="stat-icon"><Activity size={18} /></span><div><strong>{requests.length}</strong><span>Всего заявок</span></div></div>
        <div className="stat-card"><span className="stat-icon amber"><Clock3 size={18} /></span><div><strong>{requests.filter(x => x.status !== 'Выполнена').length}</strong><span>В процессе</span></div></div>
        <div className="stat-card"><span className="stat-icon green"><Cloud size={18} /></span><div><strong>{pendingCount}</strong><span>Ожидают отправки</span></div></div>
      </section>

      <section className="requests-section">
        <div className="section-heading">
          <div><div className="eyebrow">УПРАВЛЕНИЕ</div><h2>Ваши заявки</h2></div>
          <div className="section-actions">
            {installPrompt && <button className="install-btn" onClick={install}><ArrowDownToLine size={16} /> Установить</button>}
            <button className="sync-btn" onClick={() => void sync()} disabled={!online || syncing}>
              <RefreshCw size={15} className={syncing ? 'spin' : ''} /> {syncing ? 'Синхронизация' : 'Синхронизировать'}
            </button>
          </div>
        </div>

        <div className={`sync-banner ${pendingCount ? 'has-pending' : ''}`}>
          <div className={`sync-symbol ${pendingCount ? 'pending' : ''}`}>{online ? <Cloud size={18} /> : <CloudOff size={18} />}</div>
          <div className="sync-text"><strong>{pendingCount ? `${pendingCount} заявок ждут синхронизации` : 'Все данные синхронизированы'}</strong><span>{online ? 'Подключение активно. Новые заявки будут отправлены автоматически.' : 'Работа продолжается локально. Данные не потеряются после перезапуска.'}</span></div>
          {pendingCount > 0 && <span className="pending-pill">Ожидание</span>}
        </div>

        <div className="demo-network">
          <div className="demo-network-copy"><FlaskConical size={16} /><div><strong>Проверка offline-режима</strong><span>Включите режим, чтобы проверить сохранение очереди без отключения интернета.</span></div></div>
          <label className="switch-label"><input type="checkbox" checked={demoOffline} onChange={(event) => setDemoNetworkOffline(event.target.checked)} /><span className="switch-ui" /><b>{demoOffline ? 'Offline' : 'Online'}</b></label>
        </div>

        <div className="filter-row">
          <div className="filters">
            {['Все', ...statuses].map((value) => <button key={value} className={filter === value ? 'filter active' : 'filter'} onClick={() => setFilter(value)}>{value}</button>)}
          </div>
          <span className="request-count">{filtered.length} записей</span>
        </div>

        <div className="request-list">
          {filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"><FileImage size={25} /></div><strong>{requests.length === 0 ? 'Заявок пока нет' : 'Нет заявок по выбранному фильтру'}</strong><span>Создайте заявку — она появится здесь.</span><button onClick={() => setShowForm(true)}>Создать заявку</button></div>
          ) : filtered.map((item) => (
            <article className="request-card" key={item.id}>
              <div className="request-leading"><span className="category-icon"><Activity size={18} /></span></div>
              <div className="request-main">
                <div className="request-title-row"><h3>{item.title}</h3><span className={`priority priority-${item.priority}`}>{item.priority}</span></div>
                <p>{item.description}</p>
                <div className="request-meta"><span>{item.category}</span>{item.location && <><i /> <span>{item.location}</span></>}<i /><span>{new Date(item.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
                {item.attachmentName && <div className="attachment"><FileImage size={13} /> {item.attachmentName}</div>}
              </div>
              <div className="request-trailing">
                <span className={`status status-${item.status.replaceAll(' ', '-')}`}>{item.status}</span>
                <span className={`sync-state ${item.syncState}`}>{item.syncState === 'synced' ? <><Check size={12} /> Синхронизировано</> : item.syncState === 'failed' ? <><AlertCircle size={12} /> Ошибка отправки</> : <><Clock3 size={12} /> Не отправлено</>}</span>
                {item.syncError && <span className="sync-error">{item.syncError}</span>}
                <button className="demo-status" onClick={() => void demoStatus(item)} title="Демо: изменить статус">Изменить статус ↗</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer><span>Service Desk · PWA prototype</span><span>Данные хранятся на этом устройстве</span></footer>

      {notice && <div className="toast"><CheckCircle2 size={17} />{notice}<button onClick={() => setNotice('')}><X size={15} /></button></div>}

      {showForm && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false) }}>
        <section className="modal">
          <div className="modal-head"><div><div className="eyebrow">НОВАЯ ЗАПИСЬ</div><h2>Создать заявку</h2></div><button className="icon-btn" onClick={() => setShowForm(false)}><X size={20} /></button></div>
          <form onSubmit={submit}>
            <label>Краткое название<input required maxLength={90} placeholder="Например, не работает кондиционер" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
            <div className="form-two">
              <label>Категория<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as Category })}>{categories.map(x => <option key={x}>{x}</option>)}</select></label>
              <label>Приоритет<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })}>{priorities.map(x => <option key={x}>{x}</option>)}</select></label>
            </div>
            <label>Описание<textarea required rows={4} maxLength={1200} placeholder="Опишите проблему и необходимые детали..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
            <label>Местоположение<input maxLength={120} placeholder="Корпус, этаж, кабинет..." value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></label>
            <label className="file-label"><span>Фото или вложение</span><span className="file-drop"><FileImage size={18} /><span>{file ? file.name : 'Выберите файл (до 10 МБ)'}</span><input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] || null)} /></span></label>
            <div className="modal-note"><ShieldCheck size={16} /> Заявка сначала сохраняется на устройстве. Отправка произойдёт при наличии сети.</div>
            <button className="primary-btn submit-btn" type="submit"><Send size={17} /> Сохранить заявку</button>
          </form>
        </section>
      </div>}
    </main>
  )
}

export default App
