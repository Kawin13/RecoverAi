import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'

export type ConnectionStatus = 'LIVE' | 'RECONNECTING' | 'OFFLINE'

export interface RealtimeEvent {
  type: string
  data: any
  timestamp: string
}

interface RealtimeContextType {
  status: ConnectionStatus
  lastEvent: RealtimeEvent | null
  subscribe: (eventType: string, callback: (event: RealtimeEvent) => void) => () => void
}

const RealtimeContext = createContext<RealtimeContextType>({
  status: 'OFFLINE',
  lastEvent: null,
  subscribe: () => () => {}
})

const SSE_URL = import.meta.env.VITE_API_BASE_URL 
  ? `${import.meta.env.VITE_API_BASE_URL}/api/events/stream`
  : 'http://localhost:8000/api/events/stream'

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<ConnectionStatus>('OFFLINE')
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
  const listenersRef = useRef<Map<string, Set<(event: RealtimeEvent) => void>>>(new Map())
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      setStatus('RECONNECTING')
      const es = new EventSource(SSE_URL)
      eventSourceRef.current = es

      es.onopen = () => {
        setStatus('LIVE')
      }

      es.onmessage = (e) => {
        try {
          const parsed: RealtimeEvent = JSON.parse(e.data)
          setLastEvent(parsed)

          // Dispatch to specific event listeners
          const specific = listenersRef.current.get(parsed.type)
          if (specific) {
            specific.forEach(cb => cb(parsed))
          }

          // Dispatch to wildcard listeners
          const wildcards = listenersRef.current.get('*')
          if (wildcards) {
            wildcards.forEach(cb => cb(parsed))
          }
        } catch {
          // Heartbeat ping (: ping) or non-JSON comments
        }
      }

      es.onerror = () => {
        setStatus('RECONNECTING')
        es.close()
        // Exponential backoff or 3s retry
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => {
          connect()
        }, 3000)
      }
    } catch {
      setStatus('OFFLINE')
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      if (eventSourceRef.current) eventSourceRef.current.close()
    }
  }, [connect])

  const subscribe = useCallback((eventType: string, callback: (event: RealtimeEvent) => void) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set())
    }
    listenersRef.current.get(eventType)!.add(callback)

    return () => {
      const set = listenersRef.current.get(eventType)
      if (set) {
        set.delete(callback)
        if (set.size === 0) {
          listenersRef.current.delete(eventType)
        }
      }
    }
  }, [])

  return (
    <RealtimeContext.Provider value={{ status, lastEvent, subscribe }}>
      {children}
    </RealtimeContext.Provider>
  )
}

export const useRealtime = () => useContext(RealtimeContext)
