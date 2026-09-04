import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { authFetch } from '../services/api'
import { ENV } from '../config/env'

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
  reconnect: () => void
}

const RealtimeContext = createContext<RealtimeContextType>({
  status: 'OFFLINE',
  lastEvent: null,
  subscribe: () => () => {},
  reconnect: () => {}
})

const SSE_URL = `${ENV.API_BASE_URL}/api/events/stream`
const TICKET_URL = `${ENV.API_BASE_URL}/api/events/stream-ticket`

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<ConnectionStatus>('OFFLINE')
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
  const listenersRef = useRef<Map<string, Set<(event: RealtimeEvent) => void>>>(new Map())
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    try {
      // 1. Verify authenticated Supabase session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setStatus('OFFLINE')
        return
      }

      setStatus('RECONNECTING')

      // 2. Obtain short-lived single-use stream ticket
      const ticketRes = await authFetch(TICKET_URL, { method: 'POST' })
      if (!ticketRes.ok) {
        throw new Error(`Failed to obtain stream ticket: HTTP ${ticketRes.status}`)
      }
      const ticketData = await ticketRes.json()
      const ticket = ticketData.ticket

      // 3. Connect to SSE stream using single-use ticket
      const streamUrl = `${SSE_URL}?ticket=${encodeURIComponent(ticket)}`
      const es = new EventSource(streamUrl)
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
        // Exponential backoff or 3s retry with fresh ticket
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => {
          connect()
        }, 3000)
      }
    } catch (err) {
      console.warn('[Realtime] SSE Connection error:', err)
      setStatus('OFFLINE')
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = setTimeout(() => {
        connect()
      }, 5000)
    }
  }, [])

  useEffect(() => {
    connect()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        connect()
      } else {
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }
        setStatus('OFFLINE')
      }
    })

    return () => {
      subscription.unsubscribe()
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
    <RealtimeContext.Provider value={{ status, lastEvent, subscribe, reconnect: connect }}>
      {children}
    </RealtimeContext.Provider>
  )
}

export const useRealtime = () => useContext(RealtimeContext)
