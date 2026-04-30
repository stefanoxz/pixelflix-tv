import { useState, useEffect, useMemo } from 'react'
import { Stream, Category } from '../types/iptv'
import { fetchM3u, parseM3uToData } from '../services/iptv'

export const useIPTV = () => {
  const [streams, setStreams] = useState<Stream[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('last_list')
    if (saved) {
      try {
        const creds = JSON.parse(saved);
        if (creds && creds.username) loadList(creds);
      } catch (e) {}
    }
  }, [])

  const loadList = async (creds: any) => {
    if (!creds || !creds.server) {
      setError("Por favor, insira uma URL M3U válida.")
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const m3u = await fetchM3u(creds)
      const { streams: s, categories: c } = parseM3uToData(m3u)
      
      if (s.length === 0) {
        throw new Error("A lista foi carregada, mas nenhum canal foi encontrado.")
      }

      setStreams(s)
      setCategories([{ category_id: 'Todos', category_name: 'Todos' }, ...c])
      localStorage.setItem('last_list', JSON.stringify(creds))
      return true
    } catch (e: any) {
      const msg = e.message || "Erro ao conectar com o servidor IPTV."
      setError(msg)
      return false
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setStreams([])
    setCategories([])
    localStorage.removeItem('last_list')
  }

  return {
    streams,
    categories,
    loading,
    error,
    loadList,
    logout
  }
}
