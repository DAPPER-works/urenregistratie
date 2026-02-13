import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabase'

// Helper functions
const formatDuration = (seconds) => {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const formatHours = (seconds) => {
  const hours = seconds / 3600
  return hours.toFixed(2).replace('.', ',')
}

const formatMoney = (amount) => {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

const getWeekNumber = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

const getWeekDates = (date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: monday, end: sunday }
}

// Confirmation Dialog Component
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '400px',
        width: '100%',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#e94560' }}>{title}</h3>
        <p style={{ margin: '0 0 24px 0', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Annuleren
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: '#e94560',
              border: 'none',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Verwijderen
          </button>
        </div>
      </div>
    </div>
  )
}

// Timer Reminder Dialog Component
const TimerReminderDialog = ({ isOpen, hours, onDismiss, onStop, timerDisplay }) => {
  if (!isOpen) return null
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '400px',
        width: '100%',
        border: '1px solid rgba(233,69,96,0.5)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏰</div>
        <h3 style={{ margin: '0 0 8px 0', color: '#e94560', fontSize: '20px' }}>
          Timer loopt al {hours} uur!
        </h3>
        <p style={{ 
          fontFamily: 'Courier New, monospace', 
          fontSize: '32px', 
          color: '#e94560',
          margin: '16px 0'
        }}>
          {timerDisplay}
        </p>
        <p style={{ margin: '0 0 24px 0', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
          Ben je nog steeds aan het werk? Of ben je vergeten de timer te stoppen?
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={onDismiss}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: 'rgba(255,255,255,0.7)',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Ik werk nog door
          </button>
          <button
            onClick={onStop}
            style={{
              background: '#00b894',
              border: 'none',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px'
            }}
          >
            Timer stoppen
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  // Auth state
  const [session, setSession] = useState(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  
  // App state
  const [users, setUsers] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  const [activeTimers, setActiveTimers] = useState({})
  const [userProfile, setUserProfile] = useState(null)
  
  // UI state
  const [view, setView] = useState('timer')
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [description, setDescription] = useState('')
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0])
  const [manualHours, setManualHours] = useState('')
  const [manualMinutes, setManualMinutes] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectClient, setNewProjectClient] = useState('')
  const [newProjectBudget, setNewProjectBudget] = useState('')
  const [newProjectRate, setNewProjectRate] = useState('')
  const [newProjectStart, setNewProjectStart] = useState('')
  const [newProjectEnd, setNewProjectEnd] = useState('')
  const [editingClient, setEditingClient] = useState(null)
  const [editingProject, setEditingProject] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [teamView, setTeamView] = useState(false)
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null })
  
  // Timer reminder state
  const [timerReminder, setTimerReminder] = useState({ isOpen: false, hours: 0 })
  const [lastPingTime, setLastPingTime] = useState(0)

  // Check session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load user profile
  const loadUserProfile = useCallback(async (userId) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (data) {
      setUserProfile(data)
    }
  }, [])

  // Load all data when session exists
  const loadAllData = useCallback(async () => {
    if (!session) return
    
    try {
      const [profilesRes, clientsRes, projectsRes, entriesRes, timersRes] = await Promise.all([
        supabase.from('user_profiles').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('time_entries').select('*'),
        supabase.from('active_timers').select('*')
      ])
      
      setUsers(profilesRes.data || [])
      setClients(clientsRes.data || [])
      setProjects(projectsRes.data || [])
      setTimeEntries(entriesRes.data || [])
      
      const timersObj = {}
      ;(timersRes.data || []).forEach(t => {
        timersObj[t.user_id] = t
      })
      setActiveTimers(timersObj)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }, [session])

  useEffect(() => {
    if (session) {
      loadAllData()
      loadUserProfile(session.user.id)
    }
  }, [session, loadAllData, loadUserProfile])

  // Auto-refresh
  useEffect(() => {
    if (!session) return
    const interval = setInterval(loadAllData, 30000)
    return () => clearInterval(interval)
  }, [session, loadAllData])

  // Timer tick
  useEffect(() => {
    let interval
    if (session && activeTimers[session.user.id]) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - activeTimers[session.user.id].start_time) / 1000)
        setTimerSeconds(elapsed)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [session, activeTimers])

  // Define myTimer early so it can be used in useEffects
  const myTimer = session ? activeTimers[session.user.id] : null

  // Update page title with timer
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (myTimer && timerSeconds > 0) {
      const project = projects.find(p => p.id === selectedProject)
      const projectName = project?.name || 'Timer'
      document.title = `⏱️ ${formatDuration(timerSeconds)} - ${projectName}`
    } else {
      document.title = 'Urenregistratie'
    }
  }, [timerSeconds, myTimer, selectedProject, projects])

  // Play ping sound every 30 minutes
  const playPing = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      const audioContext = new AudioContext()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.5)
    } catch (e) {
      console.log('Audio not supported')
    }
  }, [])

  // Timer reminders: ping every 30 min, popup after 2 hours
  useEffect(() => {
    if (!myTimer || timerSeconds === 0) {
      setLastPingTime(0)
      return
    }
    
    const minutes = Math.floor(timerSeconds / 60)
    const hours = timerSeconds / 3600
    
    // Ping every 30 minutes
    const pingInterval = Math.floor(minutes / 30)
    if (pingInterval > 0 && pingInterval !== lastPingTime) {
      playPing()
      setLastPingTime(pingInterval)
    }
    
    // Popup after 2 hours (and every hour after that)
    if (hours >= 2 && !timerReminder.isOpen) {
      const reminderHours = Math.floor(hours)
      if (reminderHours > (timerReminder.hours || 0)) {
        setTimerReminder({ isOpen: true, hours: reminderHours })
      }
    }
  }, [timerSeconds, myTimer, lastPingTime, playPing, timerReminder])

  useEffect(() => {
    if (session && activeTimers[session.user.id]) {
      const elapsed = Math.floor((Date.now() - activeTimers[session.user.id].start_time) / 1000)
      setTimerSeconds(elapsed)
      setSelectedClient(activeTimers[session.user.id].client_id || '')
      setSelectedProject(activeTimers[session.user.id].project_id || '')
      setDescription(activeTimers[session.user.id].description || '')
    } else {
      setTimerSeconds(0)
    }
  }, [session, activeTimers])

  // Magic Link login
  const handleMagicLink = async () => {
    setAuthError('')
    setAuthMessage('')
    setAuthLoading(true)
    
    if (!authEmail) {
      setAuthError('Vul je e-mailadres in')
      setAuthLoading(false)
      return
    }
    
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail,
      options: {
        emailRedirectTo: window.location.origin
      }
    })
    
    if (error) {
      if (error.message.includes('rate limit')) {
        setAuthError('Te veel aanvragen. Wacht een paar minuten en probeer opnieuw.')
      } else {
        setAuthError(error.message)
      }
    } else {
      setAuthMessage('✨ Check je inbox! We hebben een inloglink gestuurd naar ' + authEmail)
      setAuthEmail('')
    }
    
    setAuthLoading(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUserProfile(null)
    setView('timer')
    setTeamView(false)
  }

  // Timer functions

  const startTimer = async () => {
    if (!session) return
    setSaving(true)
    
    await supabase.from('active_timers').upsert({
      user_id: session.user.id,
      client_id: selectedClient || null,
      project_id: selectedProject || null,
      description: description,
      start_time: Date.now()
    })
    
    await loadAllData()
    setSaving(false)
  }

  const stopTimer = async () => {
    if (!session || !myTimer || timerSeconds < 60) return
    setSaving(true)
    
    await supabase.from('time_entries').insert({
      user_id: session.user.id,
      client_id: myTimer.client_id,
      project_id: myTimer.project_id,
      description: myTimer.description,
      seconds: timerSeconds,
      date: new Date(myTimer.start_time).toISOString().split('T')[0]
    })
    
    await supabase.from('active_timers').delete().eq('user_id', session.user.id)
    
    setTimerSeconds(0)
    setDescription('')
    setTimerReminder({ isOpen: false, hours: 0 })
    setLastPingTime(0)
    await loadAllData()
    setSaving(false)
  }

  const cancelTimer = async () => {
    if (!session) return
    setSaving(true)
    await supabase.from('active_timers').delete().eq('user_id', session.user.id)
    setTimerSeconds(0)
    setTimerReminder({ isOpen: false, hours: 0 })
    setLastPingTime(0)
    await loadAllData()
    setSaving(false)
  }

  const addManualEntry = async () => {
    if (!session) return
    const hours = parseFloat(manualHours) || 0
    const minutes = parseFloat(manualMinutes) || 0
    const totalSeconds = (hours * 3600) + (minutes * 60)
    if (totalSeconds < 60) return
    
    setSaving(true)
    await supabase.from('time_entries').insert({
      user_id: session.user.id,
      client_id: selectedClient || null,
      project_id: selectedProject || null,
      description: description,
      seconds: totalSeconds,
      date: manualDate
    })
    
    setManualHours('')
    setManualMinutes('')
    setDescription('')
    await loadAllData()
    setSaving(false)
  }

  const deleteEntry = async (id) => {
    setSaving(true)
    await supabase.from('time_entries').delete().eq('id', id)
    await loadAllData()
    setSaving(false)
  }

  // Client functions
  const addClient = async () => {
    if (!newClientName.trim()) return
    setSaving(true)
    await supabase.from('clients').insert({
      name: newClientName.trim()
    })
    setNewClientName('')
    await loadAllData()
    setSaving(false)
  }

  const updateClient = async (id, name) => {
    setSaving(true)
    await supabase.from('clients').update({ name }).eq('id', id)
    setEditingClient(null)
    await loadAllData()
    setSaving(false)
  }

  const confirmDeleteClient = (client) => {
    const projectCount = projects.filter(p => p.client_id === client.id).length
    const entryCount = timeEntries.filter(e => e.client_id === client.id).length
    setConfirmDialog({
      isOpen: true,
      title: 'Klant verwijderen?',
      message: `Weet je zeker dat je "${client.name}" wilt verwijderen?${projectCount > 0 ? ` Dit verwijdert ook ${projectCount} project(en).` : ''}${entryCount > 0 ? ` Er zijn ${entryCount} uurregistratie(s) gekoppeld.` : ''}`,
      onConfirm: async () => {
        setSaving(true)
        await supabase.from('clients').delete().eq('id', client.id)
        await loadAllData()
        setSaving(false)
        setConfirmDialog({ isOpen: false })
      }
    })
  }

  // Project functions
  const addProject = async () => {
    if (!newProjectName.trim() || !newProjectClient) return
    
    // Validate dates
    if (newProjectStart && newProjectEnd && newProjectEnd < newProjectStart) {
      alert('Einddatum kan niet voor startdatum liggen')
      return
    }
    
    setSaving(true)
    await supabase.from('projects').insert({
      name: newProjectName.trim(),
      client_id: newProjectClient,
      budget_hours: parseFloat(newProjectBudget) || 0,
      hourly_rate: parseFloat(newProjectRate) || 0,
      start_date: newProjectStart || null,
      end_date: newProjectEnd || null
    })
    setNewProjectName('')
    setNewProjectClient('')
    setNewProjectBudget('')
    setNewProjectRate('')
    setNewProjectStart('')
    setNewProjectEnd('')
    await loadAllData()
    setSaving(false)
  }

  const updateProject = async (id, data) => {
    // Validate dates
    if (data.start_date && data.end_date && data.end_date < data.start_date) {
      alert('Einddatum kan niet voor startdatum liggen')
      return
    }
    
    setSaving(true)
    await supabase.from('projects').update(data).eq('id', id)
    setEditingProject(null)
    await loadAllData()
    setSaving(false)
  }

  const confirmDeleteProject = (project) => {
    const entryCount = timeEntries.filter(e => e.project_id === project.id).length
    setConfirmDialog({
      isOpen: true,
      title: 'Project verwijderen?',
      message: `Weet je zeker dat je "${project.name}" wilt verwijderen?${entryCount > 0 ? ` Er zijn ${entryCount} uurregistratie(s) gekoppeld aan dit project.` : ''}`,
      onConfirm: async () => {
        setSaving(true)
        await supabase.from('projects').delete().eq('id', project.id)
        await loadAllData()
        setSaving(false)
        setConfirmDialog({ isOpen: false })
      }
    })
  }

  // User management functions
  const confirmDeleteUser = (user) => {
    if (user.id === session.user.id) {
      alert('Je kunt jezelf niet verwijderen')
      return
    }
    const entryCount = timeEntries.filter(e => e.user_id === user.id).length
    setConfirmDialog({
      isOpen: true,
      title: 'Gebruiker verwijderen?',
      message: `Weet je zeker dat je "${user.display_name}" wilt verwijderen?${entryCount > 0 ? ` Dit verwijdert ook ${entryCount} uurregistratie(s).` : ''}`,
      onConfirm: async () => {
        setSaving(true)
        // Delete user profile (entries will be orphaned but not deleted)
        await supabase.from('user_profiles').delete().eq('id', user.id)
        // Note: We can't delete from auth.users via client, only profile
        await loadAllData()
        setSaving(false)
        setConfirmDialog({ isOpen: false })
      }
    })
  }

  // Helper functions
  const getClientName = (id) => clients.find(c => c.id === id)?.name || 'Onbekend'
  const getProjectName = (id) => projects.find(p => p.id === id)?.name || 'Geen project'
  const getProject = (id) => projects.find(p => p.id === id)
  const getProjectRate = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    return project?.hourly_rate || 0
  }
  const getClientProjects = (clientId) => projects.filter(p => p.client_id === clientId)
  const getUserName = (id) => {
    const profile = users.find(u => u.id === id)
    return profile?.display_name || 'Onbekend'
  }

  // Calculate project hours used
  const getProjectHoursUsed = (projectId) => {
    const projectEntries = timeEntries.filter(e => e.project_id === projectId)
    return projectEntries.reduce((sum, e) => sum + e.seconds, 0) / 3600
  }

  const getProjectHoursRemaining = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    if (!project || !project.budget_hours) return null
    return project.budget_hours - getProjectHoursUsed(projectId)
  }

  const getProjectProgress = (projectId) => {
    const project = projects.find(p => p.id === projectId)
    if (!project || !project.budget_hours) return null
    const used = getProjectHoursUsed(projectId)
    return Math.min(100, (used / project.budget_hours) * 100)
  }

  const filteredProjects = selectedClient 
    ? projects.filter(p => p.client_id === selectedClient)
    : projects

  // Week calculations
  const currentWeekDate = new Date()
  currentWeekDate.setDate(currentWeekDate.getDate() + (weekOffset * 7))
  const { start: weekStart, end: weekEnd } = getWeekDates(currentWeekDate)
  const weekNumber = getWeekNumber(currentWeekDate)
  
  const weekEntries = timeEntries.filter(entry => {
    const entryDate = new Date(entry.date)
    const inWeek = entryDate >= weekStart && entryDate <= weekEnd
    if (teamView) return inWeek
    return inWeek && entry.user_id === session?.user?.id
  })

  const weekTotalSeconds = weekEntries.reduce((sum, e) => sum + e.seconds, 0)
  const weekTotalEarnings = weekEntries.reduce((sum, e) => {
    const rate = getProjectRate(e.project_id)
    return sum + (e.seconds / 3600 * rate)
  }, 0)

  const groupEntries = (entries) => {
    const grouped = {}
    entries.forEach(entry => {
      const key = teamView ? entry.user_id : entry.client_id
      if (!grouped[key]) grouped[key] = { seconds: 0, entries: [], earnings: 0 }
      grouped[key].seconds += entry.seconds
      grouped[key].earnings += (entry.seconds / 3600) * getProjectRate(entry.project_id)
      grouped[key].entries.push(entry)
    })
    return grouped
  }

  const entriesGrouped = groupEntries(weekEntries)

  const displayName = userProfile?.display_name || session?.user?.email?.split('@')[0] || 'Gebruiker'

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Laden...</p>
        <style jsx>{`
          .loading {
            min-height: 100vh;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: 'Segoe UI', sans-serif;
            gap: 16px;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(233, 69, 96, 0.2);
            border-top-color: #e94560;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          p { color: rgba(255,255,255,0.7); }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  // Login Screen with Magic Link
  if (!session) {
    return (
      <>
        <Head>
          <title>Urenregistratie - Inloggen</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="login-container">
          <div className="login-box">
            <h1>Urenregistratie</h1>
            <p className="subtitle">Team Edition ✨</p>
            
            <div className="form">
              <label>E-mailadres</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="naam@bedrijf.nl"
                onKeyPress={(e) => e.key === 'Enter' && handleMagicLink()}
              />
              
              {authError && <div className="error">{authError}</div>}
              {authMessage && <div className="success">{authMessage}</div>}
              
              <button 
                className="submit" 
                onClick={handleMagicLink}
                disabled={authLoading}
              >
                {authLoading ? 'Even geduld...' : '✉️ Stuur inloglink'}
              </button>
              
              <p className="hint">
                Je ontvangt een e-mail met een link waarmee je direct inlogt. Geen wachtwoord nodig!
              </p>
            </div>
          </div>
        </div>
        <style jsx>{`
          .login-container {
            min-height: 100vh;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Segoe UI', sans-serif;
            padding: 20px;
          }
          .login-box {
            background: rgba(255,255,255,0.05);
            border-radius: 24px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            border: 1px solid rgba(255,255,255,0.1);
          }
          h1 {
            font-size: 28px;
            background: linear-gradient(90deg, #e94560, #ff6b6b);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-align: center;
            margin: 0 0 8px 0;
          }
          .subtitle {
            color: rgba(255,255,255,0.5);
            text-align: center;
            margin: 0 0 32px 0;
          }
          .form {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          label {
            font-size: 12px;
            color: rgba(255,255,255,0.5);
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          input {
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            padding: 14px 16px;
            color: #fff;
            font-size: 16px;
            margin-top: -8px;
          }
          input:focus {
            outline: none;
            border-color: #e94560;
          }
          .error {
            background: rgba(255,100,100,0.1);
            border: 1px solid rgba(255,100,100,0.3);
            border-radius: 8px;
            padding: 12px;
            color: #ff6b6b;
            font-size: 14px;
            text-align: center;
          }
          .success {
            background: rgba(0,184,148,0.1);
            border: 1px solid rgba(0,184,148,0.3);
            border-radius: 8px;
            padding: 12px;
            color: #00b894;
            font-size: 14px;
            text-align: center;
          }
          .submit {
            background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
            border: none;
            color: white;
            padding: 14px 24px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 8px;
          }
          .submit:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }
          .hint {
            color: rgba(255,255,255,0.4);
            font-size: 13px;
            text-align: center;
            margin-top: 8px;
            line-height: 1.5;
          }
        `}</style>
      </>
    )
  }

  // Main App
  return (
    <>
      <Head>
        <title>Urenregistratie</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false })}
      />
      
      <TimerReminderDialog
        isOpen={timerReminder.isOpen}
        hours={timerReminder.hours}
        timerDisplay={formatDuration(timerSeconds)}
        onDismiss={() => setTimerReminder({ ...timerReminder, isOpen: false })}
        onStop={async () => {
          setTimerReminder({ isOpen: false, hours: 0 })
          await stopTimer()
        }}
      />
      
      <div className="app">
        <header>
          <div className="header-content">
            <div>
              <h1>Urenregistratie {saving && <span className="saving">opslaan...</span>}</h1>
              <p>Welkom, <strong>{displayName}</strong></p>
            </div>
            <div className="header-right">
              {myTimer && (
                <div className="active-timer">
                  <span className="dot"></span>
                  <span className="time">{formatDuration(timerSeconds)}</span>
                </div>
              )}
              <button onClick={handleSignOut} className="logout">Uitloggen</button>
            </div>
          </div>
        </header>

        <nav>
          <div className="nav-content">
            {[
              { id: 'timer', label: '⏱️ Timer' },
              { id: 'handmatig', label: '✏️ Handmatig' },
              { id: 'overzicht', label: '📊 Overzicht' },
              { id: 'projecten', label: '📁 Projecten' },
              { id: 'klanten', label: '👥 Klanten' },
              { id: 'team', label: '⚙️ Team' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={view === tab.id ? 'active' : ''}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        <main>
          {/* Timer View */}
          {view === 'timer' && (
            <div className="view-content">
              <div className="timer-display">
                <div className={`time ${myTimer ? 'active' : ''}`}>{formatDuration(timerSeconds)}</div>
                {!myTimer ? (
                  <button 
                    onClick={startTimer} 
                    disabled={!selectedClient}
                    className={`start-btn ${selectedClient ? '' : 'disabled'}`}
                  >
                    ▶ Start Timer
                  </button>
                ) : (
                  <div className="timer-actions">
                    <button onClick={stopTimer} className="stop-btn">✓ Opslaan</button>
                    <button onClick={cancelTimer} className="cancel-btn">✕ Annuleren</button>
                  </div>
                )}
              </div>

              <div className="card">
                <div className="field">
                  <label>Klant *</label>
                  <select
                    value={selectedClient}
                    onChange={(e) => { setSelectedClient(e.target.value); setSelectedProject(''); }}
                    disabled={!!myTimer}
                  >
                    <option value="">Selecteer klant...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Project</label>
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    disabled={!!myTimer || !selectedClient}
                  >
                    <option value="">Geen project</option>
                    {filteredProjects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.budget_hours ? `(${getProjectHoursRemaining(p.id)?.toFixed(1)}u over)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedProject && getProject(selectedProject) && (
                  <div className="project-info-card">
                    <div className="project-info-header">
                      <strong>{getProjectName(selectedProject)}</strong>
                      <span className="client-tag">{getClientName(selectedClient)}</span>
                    </div>
                    {getProject(selectedProject).budget_hours > 0 && (
                      <div className="budget-bar">
                        <div className="budget-labels">
                          <span>{getProjectHoursUsed(selectedProject).toFixed(1)}u gebruikt</span>
                          <span>{getProjectHoursRemaining(selectedProject)?.toFixed(1)}u over</span>
                        </div>
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ 
                              width: `${getProjectProgress(selectedProject)}%`,
                              background: getProjectProgress(selectedProject) > 90 ? '#e94560' : '#00b894'
                            }}
                          ></div>
                        </div>
                        <div className="budget-total">Budget: {getProject(selectedProject).budget_hours}u</div>
                      </div>
                    )}
                    {getProject(selectedProject).hourly_rate > 0 && (
                      <div className="rate-info">Tarief: {formatMoney(getProject(selectedProject).hourly_rate)}/uur</div>
                    )}
                  </div>
                )}
                
                <div className="field">
                  <label>Beschrijving</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!!myTimer}
                    placeholder="Waar werk je aan?"
                  />
                </div>
                {clients.length === 0 && (
                  <div className="no-clients">
                    <p>Nog geen klanten. Voeg eerst een klant toe!</p>
                    <button onClick={() => setView('klanten')}>+ Klant toevoegen</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual Entry View */}
          {view === 'handmatig' && (
            <div className="view-content">
              <div className="card">
                <h2>Uren handmatig invoeren</h2>
                <div className="form-grid">
                  <div className="field">
                    <label>Datum</label>
                    <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Tijd</label>
                    <div className="time-inputs">
                      <input type="number" value={manualHours} onChange={(e) => setManualHours(e.target.value)} placeholder="0" min="0" max="24" />
                      <span>u</span>
                      <input type="number" value={manualMinutes} onChange={(e) => setManualMinutes(e.target.value)} placeholder="0" min="0" max="59" />
                      <span>m</span>
                    </div>
                  </div>
                </div>
                <div className="field">
                  <label>Klant *</label>
                  <select value={selectedClient} onChange={(e) => { setSelectedClient(e.target.value); setSelectedProject(''); }}>
                    <option value="">Selecteer klant...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Project</label>
                  <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} disabled={!selectedClient}>
                    <option value="">Geen project</option>
                    {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Beschrijving</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Waar heb je aan gewerkt?" />
                </div>
                <button 
                  onClick={addManualEntry} 
                  disabled={!selectedClient || (!manualHours && !manualMinutes)}
                  className="primary-btn"
                >
                  + Toevoegen
                </button>
              </div>
            </div>
          )}

          {/* Overview View */}
          {view === 'overzicht' && (
            <div className="view-content">
              <div className="toggle-tabs">
                <button className={!teamView ? 'active' : ''} onClick={() => setTeamView(false)}>🧑 Mijn uren</button>
                <button className={teamView ? 'active' : ''} onClick={() => setTeamView(true)}>👥 Team</button>
              </div>

              <div className="week-nav">
                <button onClick={() => setWeekOffset(prev => prev - 1)}>←</button>
                <div>
                  <strong>Week {weekNumber}</strong>
                  <span>{weekStart.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - {weekEnd.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <button onClick={() => setWeekOffset(prev => prev + 1)} disabled={weekOffset >= 0}>→</button>
              </div>

              <div className="stats-grid">
                <div className="stat hours">
                  <span className="label">{teamView ? 'Team uren' : 'Mijn uren'}</span>
                  <span className="value">{formatHours(weekTotalSeconds)}</span>
                </div>
                <div className="stat money">
                  <span className="label">Omzet</span>
                  <span className="value">{formatMoney(weekTotalEarnings)}</span>
                </div>
              </div>

              {Object.keys(entriesGrouped).length > 0 ? (
                Object.entries(entriesGrouped).map(([groupId, groupData]) => (
                  <div key={groupId} className="entry-group">
                    <div className="group-header">
                      <div>
                        <strong>{teamView ? getUserName(groupId) : getClientName(groupId)}</strong>
                        <span>{formatHours(groupData.seconds)} uur · {formatMoney(groupData.earnings)}</span>
                      </div>
                    </div>
                    {groupData.entries.map(entry => (
                      <div key={entry.id} className="entry-row">
                        <div className="entry-info">
                          <div className="entry-meta">
                            <span className="date">{new Date(entry.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                            {teamView && <span className="tag client">{getClientName(entry.client_id)}</span>}
                            {entry.project_id && <span className="tag project">{getProjectName(entry.project_id)}</span>}
                          </div>
                          {entry.description && <p>{entry.description}</p>}
                        </div>
                        <div className="entry-actions">
                          <span className="hours">{formatHours(entry.seconds)}u</span>
                          {entry.user_id === session.user.id && (
                            <button onClick={() => deleteEntry(entry.id)} className="delete">×</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="empty">
                  <span>📭</span>
                  <p>{teamView ? 'Geen teamuren deze week' : 'Geen uren geregistreerd deze week'}</p>
                </div>
              )}
            </div>
          )}

          {/* Projects View */}
          {view === 'projecten' && (
            <div className="view-content">
              <div className="card">
                <h3>Nieuw project</h3>
                <div className="field">
                  <label>Klant *</label>
                  <select value={newProjectClient} onChange={(e) => setNewProjectClient(e.target.value)}>
                    <option value="">Selecteer klant...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Projectnaam *</label>
                  <input 
                    type="text" 
                    value={newProjectName} 
                    onChange={(e) => setNewProjectName(e.target.value)} 
                    placeholder="Naam van het project"
                  />
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label>Urenbudget</label>
                    <input 
                      type="number" 
                      value={newProjectBudget} 
                      onChange={(e) => setNewProjectBudget(e.target.value)} 
                      placeholder="Bijv. 40"
                      min="0"
                    />
                  </div>
                  <div className="field">
                    <label>Uurtarief (€)</label>
                    <input 
                      type="number" 
                      value={newProjectRate} 
                      onChange={(e) => setNewProjectRate(e.target.value)} 
                      placeholder="Bijv. 85"
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label>Startdatum</label>
                    <input 
                      type="date" 
                      value={newProjectStart} 
                      onChange={(e) => setNewProjectStart(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Einddatum</label>
                    <input 
                      type="date" 
                      value={newProjectEnd} 
                      onChange={(e) => setNewProjectEnd(e.target.value)}
                      min={newProjectStart}
                    />
                  </div>
                </div>
                <button 
                  onClick={addProject} 
                  disabled={!newProjectName.trim() || !newProjectClient}
                  className="primary-btn"
                >
                  + Project toevoegen
                </button>
              </div>

              {projects.length > 0 ? (
                <>
                  <h4 className="section-title">Alle projecten ({projects.length})</h4>
                  {projects.map(project => {
                    const hoursUsed = getProjectHoursUsed(project.id)
                    const hoursRemaining = getProjectHoursRemaining(project.id)
                    const progress = getProjectProgress(project.id)
                    
                    if (editingProject === project.id) {
                      return (
                        <div key={project.id} className="project-card editing">
                          <div className="edit-form">
                            <div className="field">
                              <label>Projectnaam</label>
                              <input type="text" defaultValue={project.name} id={`proj-name-${project.id}`} />
                            </div>
                            <div className="form-grid">
                              <div className="field">
                                <label>Urenbudget</label>
                                <input type="number" defaultValue={project.budget_hours} id={`proj-budget-${project.id}`} min="0" />
                              </div>
                              <div className="field">
                                <label>Uurtarief (€)</label>
                                <input type="number" defaultValue={project.hourly_rate} id={`proj-rate-${project.id}`} min="0" />
                              </div>
                            </div>
                            <div className="form-grid">
                              <div className="field">
                                <label>Startdatum</label>
                                <input type="date" defaultValue={project.start_date} id={`proj-start-${project.id}`} />
                              </div>
                              <div className="field">
                                <label>Einddatum</label>
                                <input type="date" defaultValue={project.end_date} id={`proj-end-${project.id}`} />
                              </div>
                            </div>
                            <div className="edit-actions">
                              <button onClick={() => {
                                updateProject(project.id, {
                                  name: document.getElementById(`proj-name-${project.id}`).value,
                                  budget_hours: parseFloat(document.getElementById(`proj-budget-${project.id}`).value) || 0,
                                  hourly_rate: parseFloat(document.getElementById(`proj-rate-${project.id}`).value) || 0,
                                  start_date: document.getElementById(`proj-start-${project.id}`).value || null,
                                  end_date: document.getElementById(`proj-end-${project.id}`).value || null
                                })
                              }} className="save">Opslaan</button>
                              <button onClick={() => setEditingProject(null)} className="cancel">Annuleren</button>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    
                    return (
                      <div key={project.id} className="project-card">
                        <div className="project-header">
                          <div>
                            <strong>{project.name}</strong>
                            <span className="client-badge">{getClientName(project.client_id)}</span>
                          </div>
                          <div className="project-actions">
                            <button onClick={() => setEditingProject(project.id)}>✎</button>
                            <button onClick={() => confirmDeleteProject(project)} className="delete">×</button>
                          </div>
                        </div>
                        
                        <div className="project-details">
                          {project.budget_hours > 0 && (
                            <div className="budget-section">
                              <div className="budget-bar">
                                <div className="budget-labels">
                                  <span>{hoursUsed.toFixed(1)}u gebruikt</span>
                                  <span style={{ color: hoursRemaining < 0 ? '#e94560' : '#00b894' }}>
                                    {hoursRemaining >= 0 ? `${hoursRemaining.toFixed(1)}u over` : `${Math.abs(hoursRemaining).toFixed(1)}u OVER BUDGET`}
                                  </span>
                                </div>
                                <div className="progress-bar">
                                  <div 
                                    className="progress-fill" 
                                    style={{ 
                                      width: `${Math.min(100, progress)}%`,
                                      background: progress > 90 ? '#e94560' : '#00b894'
                                    }}
                                  ></div>
                                </div>
                                <div className="budget-total">Budget: {project.budget_hours}u</div>
                              </div>
                            </div>
                          )}
                          
                          <div className="project-meta">
                            {project.hourly_rate > 0 && (
                              <span className="meta-item">💰 {formatMoney(project.hourly_rate)}/uur</span>
                            )}
                            {project.start_date && (
                              <span className="meta-item">📅 {new Date(project.start_date).toLocaleDateString('nl-NL')} - {project.end_date ? new Date(project.end_date).toLocaleDateString('nl-NL') : 'Geen einddatum'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              ) : (
                <div className="empty">
                  <span>📁</span>
                  <p>Nog geen projecten. Voeg hierboven een project toe!</p>
                </div>
              )}
            </div>
          )}

          {/* Clients View */}
          {view === 'klanten' && (
            <div className="view-content">
              <div className="card">
                <h3>Nieuwe klant</h3>
                <div className="inline-form">
                  <input 
                    type="text" 
                    value={newClientName} 
                    onChange={(e) => setNewClientName(e.target.value)} 
                    placeholder="Klantnaam"
                  />
                  <button onClick={addClient} disabled={!newClientName.trim()}>+</button>
                </div>
              </div>

              {clients.length > 0 ? (
                clients.map(client => {
                  const clientProjects = getClientProjects(client.id)
                  
                  return (
                    <div key={client.id} className="client-card">
                      {editingClient === client.id ? (
                        <div className="edit-form">
                          <input type="text" defaultValue={client.name} id={`client-name-${client.id}`} />
                          <div className="edit-actions">
                            <button onClick={() => {
                              updateClient(client.id, document.getElementById(`client-name-${client.id}`).value)
                            }} className="save">Opslaan</button>
                            <button onClick={() => setEditingClient(null)} className="cancel">Annuleren</button>
                          </div>
                        </div>
                      ) : (
                        <div className="client-info">
                          <div>
                            <strong>{client.name}</strong>
                            <span>{clientProjects.length} project(en)</span>
                          </div>
                          <div className="client-actions">
                            <button onClick={() => setEditingClient(client.id)}>✎</button>
                            <button onClick={() => confirmDeleteClient(client)} className="delete">×</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="empty">
                  <span>👥</span>
                  <p>Nog geen klanten toegevoegd</p>
                </div>
              )}
            </div>
          )}

          {/* Team Management View */}
          {view === 'team' && (
            <div className="view-content">
              <div className="card">
                <h3>Teamleden ({users.length})</h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '16px' }}>
                  Nieuwe teamleden kunnen inloggen door hun e-mailadres in te vullen op de loginpagina.
                </p>
              </div>

              {users.length > 0 ? (
                users.map(user => {
                  const userEntries = timeEntries.filter(e => e.user_id === user.id)
                  const userHours = userEntries.reduce((sum, e) => sum + e.seconds, 0) / 3600
                  const isCurrentUser = user.id === session.user.id
                  
                  return (
                    <div key={user.id} className="user-card">
                      <div className="user-info">
                        <div>
                          <strong>
                            {user.display_name}
                            {isCurrentUser && <span className="you-badge">Jij</span>}
                          </strong>
                          <span>{userHours.toFixed(1)} uur geregistreerd</span>
                        </div>
                        {!isCurrentUser && (
                          <div className="user-actions">
                            <button onClick={() => confirmDeleteUser(user)} className="delete">×</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="empty">
                  <span>👤</span>
                  <p>Nog geen teamleden</p>
                </div>
              )}
            </div>
          )}
        </main>

        <div className="sync-indicator">
          <span className="dot"></span>
          Gedeeld met team
        </div>
      </div>

      <style jsx>{`
        .app {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          font-family: 'Segoe UI', sans-serif;
          color: #eee;
        }
        
        header {
          background: rgba(0,0,0,0.3);
          padding: 12px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(10px);
        }
        .header-content {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        header h1 {
          font-size: 18px;
          background: linear-gradient(90deg, #e94560, #ff6b6b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
        }
        .saving {
          font-size: 10px;
          background: rgba(0, 184, 148, 0.3);
          color: #00b894;
          padding: 2px 8px;
          border-radius: 10px;
          -webkit-text-fill-color: #00b894;
          animation: pulse 1s infinite;
        }
        header p {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          margin: 4px 0 0 0;
        }
        header strong { color: #e94560; }
        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .active-timer {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(233, 69, 96, 0.2);
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
        }
        .active-timer .dot {
          width: 8px;
          height: 8px;
          background: #e94560;
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }
        .active-timer .time { font-family: 'Courier New', monospace; }
        .logout {
          background: rgba(255,255,255,0.1);
          border: none;
          color: rgba(255,255,255,0.7);
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
        }
        
        nav {
          background: rgba(0,0,0,0.2);
          padding: 0 20px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          overflow-x: auto;
        }
        .nav-content {
          max-width: 800px;
          margin: 0 auto;
          display: flex;
        }
        nav button {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.6);
          padding: 14px 16px;
          cursor: pointer;
          font-size: 14px;
          border-bottom: 2px solid transparent;
          white-space: nowrap;
        }
        nav button.active {
          color: #e94560;
          font-weight: 600;
          border-bottom-color: #e94560;
        }
        
        main {
          max-width: 800px;
          margin: 0 auto;
          padding: 24px 20px 100px;
        }
        
        .view-content {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        
        .timer-display {
          background: rgba(255,255,255,0.05);
          border-radius: 24px;
          padding: 40px 24px;
          text-align: center;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .timer-display .time {
          font-family: 'Courier New', monospace;
          font-size: clamp(48px, 15vw, 72px);
          font-weight: 500;
          margin-bottom: 32px;
        }
        .timer-display .time.active { color: #e94560; }
        .start-btn {
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          border: none;
          color: white;
          padding: 16px 48px;
          border-radius: 50px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 8px 30px rgba(233, 69, 96, 0.4);
        }
        .start-btn.disabled {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.3);
          cursor: not-allowed;
          box-shadow: none;
        }
        .timer-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
        }
        .stop-btn {
          background: linear-gradient(135deg, #00b894 0%, #00cec9 100%);
          border: none;
          color: white;
          padding: 16px 36px;
          border-radius: 50px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }
        .cancel-btn {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.7);
          padding: 16px 36px;
          border-radius: 50px;
          font-size: 16px;
          cursor: pointer;
        }
        
        .card {
          background: rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 20px;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .card h2, .card h3 {
          font-size: 16px;
          color: #e94560;
          margin: 0 0 16px 0;
        }
        
        .field {
          margin-bottom: 16px;
        }
        .field label {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 1px;
          display: block;
          margin-bottom: 6px;
        }
        .field input, .field select {
          width: 100%;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 12px 16px;
          color: #fff;
          font-size: 16px;
        }
        .field input:focus, .field select:focus {
          outline: none;
          border-color: #e94560;
        }
        .field input:disabled, .field select:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
        
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .time-inputs {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .time-inputs input {
          width: 60px;
          text-align: center;
        }
        .time-inputs span { color: rgba(255,255,255,0.5); }
        
        .primary-btn {
          width: 100%;
          background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
          border: none;
          color: white;
          padding: 14px 24px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }
        .primary-btn:disabled {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.3);
          cursor: not-allowed;
        }
        
        .project-info-card {
          background: rgba(0,184,148,0.1);
          border: 1px solid rgba(0,184,148,0.3);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .project-info-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .project-info-header strong {
          font-size: 16px;
        }
        .client-tag, .client-badge {
          font-size: 11px;
          background: rgba(100, 100, 255, 0.2);
          color: #a0a0ff;
          padding: 3px 10px;
          border-radius: 12px;
        }
        .budget-bar {
          margin-bottom: 8px;
        }
        .budget-labels {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 6px;
          color: rgba(255,255,255,0.7);
        }
        .progress-bar {
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s;
        }
        .budget-total {
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          margin-top: 4px;
        }
        .rate-info {
          font-size: 13px;
          color: rgba(255,255,255,0.6);
        }
        
        .no-clients {
          background: rgba(233, 69, 96, 0.1);
          border: 1px solid rgba(233, 69, 96, 0.3);
          border-radius: 10px;
          padding: 16px;
          text-align: center;
        }
        .no-clients p { color: rgba(255,255,255,0.7); margin: 0 0 12px 0; }
        .no-clients button {
          background: #e94560;
          border: none;
          color: white;
          padding: 10px 24px;
          border-radius: 8px;
          cursor: pointer;
        }
        
        .toggle-tabs {
          display: flex;
          gap: 8px;
          background: rgba(0,0,0,0.2);
          border-radius: 10px;
          padding: 4px;
        }
        .toggle-tabs button {
          flex: 1;
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.5);
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
        }
        .toggle-tabs button.active {
          background: #e94560;
          color: white;
        }
        
        .week-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 12px 16px;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .week-nav button {
          background: rgba(255,255,255,0.1);
          border: none;
          color: #fff;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 18px;
        }
        .week-nav button:disabled {
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.2);
          cursor: not-allowed;
        }
        .week-nav > div {
          text-align: center;
        }
        .week-nav strong { display: block; }
        .week-nav span { font-size: 13px; color: rgba(255,255,255,0.5); }
        
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .stat {
          border-radius: 16px;
          padding: 20px;
        }
        .stat.hours {
          background: linear-gradient(135deg, rgba(233, 69, 96, 0.2), rgba(255, 107, 107, 0.1));
          border: 1px solid rgba(233, 69, 96, 0.3);
        }
        .stat.money {
          background: linear-gradient(135deg, rgba(0, 184, 148, 0.2), rgba(0, 206, 201, 0.1));
          border: 1px solid rgba(0, 184, 148, 0.3);
        }
        .stat .label {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 1px;
          display: block;
          margin-bottom: 8px;
        }
        .stat .value {
          font-size: 28px;
          font-weight: 700;
        }
        .stat.hours .value { color: #e94560; }
        .stat.money .value { color: #00b894; }
        
        .entry-group {
          background: rgba(255,255,255,0.05);
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .group-header {
          padding: 16px 20px;
          background: rgba(0,0,0,0.2);
        }
        .group-header strong { display: block; font-size: 16px; }
        .group-header span { font-size: 13px; color: rgba(255,255,255,0.5); }
        
        .entry-row {
          padding: 12px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .entry-info { flex: 1; }
        .entry-meta {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 4px;
        }
        .entry-meta .date { font-size: 13px; color: rgba(255,255,255,0.5); }
        .entry-meta .tag {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .tag.client { background: rgba(100, 100, 255, 0.2); color: #a0a0ff; }
        .tag.project { background: rgba(233, 69, 96, 0.2); color: #e94560; }
        .entry-info p { font-size: 14px; color: rgba(255,255,255,0.8); margin: 0; }
        .entry-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .entry-actions .hours { font-family: 'Courier New', monospace; }
        .entry-actions .delete {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.3);
          cursor: pointer;
          font-size: 16px;
          padding: 4px 8px;
        }
        
        .empty {
          background: rgba(255,255,255,0.05);
          border-radius: 16px;
          padding: 40px 20px;
          text-align: center;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .empty span { font-size: 48px; display: block; margin-bottom: 16px; }
        .empty p { color: rgba(255,255,255,0.5); margin: 0; }
        
        .inline-form {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }
        .inline-form input, .inline-form select {
          flex: 1;
          min-width: 100px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 12px 16px;
          color: #fff;
          font-size: 15px;
        }
        .inline-form input:focus, .inline-form select:focus {
          outline: none;
          border-color: #e94560;
        }
        .inline-form button {
          background: #e94560;
          border: none;
          color: white;
          padding: 12px 24px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }
        .inline-form button:disabled {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.3);
          cursor: not-allowed;
        }
        
        .project-card {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 12px;
          overflow: hidden;
        }
        .project-card.editing {
          border-color: #e94560;
        }
        .project-header {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .project-header strong {
          font-size: 16px;
          display: block;
          margin-bottom: 4px;
        }
        .project-details {
          padding: 0 16px 16px 16px;
        }
        .budget-section {
          margin-bottom: 12px;
        }
        .project-meta {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .meta-item {
          font-size: 13px;
          color: rgba(255,255,255,0.6);
        }
        .project-actions {
          display: flex;
          gap: 8px;
        }
        .project-actions button {
          background: rgba(255,255,255,0.1);
          border: none;
          color: rgba(255,255,255,0.7);
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
        }
        .project-actions .delete {
          background: rgba(255,100,100,0.1);
          color: #ff6b6b;
        }
        
        .client-card {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 12px;
        }
        .client-info {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .client-info strong { display: block; font-size: 16px; margin-bottom: 4px; }
        .client-info span { font-size: 13px; color: rgba(255,255,255,0.5); }
        .client-actions {
          display: flex;
          gap: 8px;
        }
        .client-actions button {
          background: rgba(255,255,255,0.1);
          border: none;
          color: rgba(255,255,255,0.7);
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
        }
        .client-actions .delete {
          background: rgba(255,100,100,0.1);
          color: #ff6b6b;
        }
        
        .user-card {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 12px;
        }
        .user-info {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .user-info strong { display: block; font-size: 16px; margin-bottom: 4px; }
        .user-info span { font-size: 13px; color: rgba(255,255,255,0.5); }
        .you-badge {
          font-size: 10px;
          background: #e94560;
          color: white;
          padding: 2px 8px;
          border-radius: 10px;
          margin-left: 8px;
          font-weight: normal;
        }
        .user-actions {
          display: flex;
          gap: 8px;
        }
        .user-actions button {
          background: rgba(255,100,100,0.1);
          border: none;
          color: #ff6b6b;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
        }
        
        .edit-form {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .edit-form input {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 10px 14px;
          color: #fff;
          font-size: 15px;
        }
        .edit-form input:focus {
          outline: none;
          border-color: #e94560;
        }
        .edit-actions {
          display: flex;
          gap: 8px;
        }
        .edit-actions button {
          padding: 8px 16px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          font-size: 14px;
        }
        .edit-actions .save { background: #00b894; color: white; }
        .edit-actions .cancel { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
        
        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 12px 0;
        }
        
        .sync-indicator {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(10px);
          padding: 8px 14px;
          border-radius: 20px;
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .sync-indicator .dot {
          width: 6px;
          height: 6px;
          background: #00b894;
          border-radius: 50%;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @media (max-width: 600px) {
          .form-grid { grid-template-columns: 1fr; }
          .stats-grid { grid-template-columns: 1fr; }
          .header-content { flex-direction: column; align-items: flex-start; gap: 12px; }
          .header-right { width: 100%; justify-content: space-between; }
        }
      `}</style>
    </>
  )
}
