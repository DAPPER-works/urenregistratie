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

const hashPassword = (password) => {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

export default function Home() {
  // Auth state
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [loginMode, setLoginMode] = useState('login')
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  
  // App state
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  const [activeTimers, setActiveTimers] = useState({})
  
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
  const [newClientRate, setNewClientRate] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectClient, setNewProjectClient] = useState('')
  const [editingClient, setEditingClient] = useState(null)
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [teamView, setTeamView] = useState(false)

  // Load all data
  const loadAllData = useCallback(async () => {
    try {
      const [usersRes, clientsRes, projectsRes, entriesRes, timersRes] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('time_entries').select('*'),
        supabase.from('active_timers').select('*')
      ])
      
      setUsers(usersRes.data || [])
      setClients(clientsRes.data || [])
      setProjects(projectsRes.data || [])
      setTimeEntries(entriesRes.data || [])
      
      // Convert timers array to object keyed by user_id
      const timersObj = {}
      ;(timersRes.data || []).forEach(t => {
        timersObj[t.user_id] = t
      })
      setActiveTimers(timersObj)
      
      // Check session
      const sessionUserId = localStorage.getItem('uren-session')
      if (sessionUserId && usersRes.data) {
        const user = usersRes.data.find(u => u.id === sessionUserId)
        if (user) setCurrentUser(user)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(loadAllData, 30000)
    return () => clearInterval(interval)
  }, [loadAllData])

  // Timer tick
  useEffect(() => {
    let interval
    if (currentUser && activeTimers[currentUser.id]) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - activeTimers[currentUser.id].start_time) / 1000)
        setTimerSeconds(elapsed)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [currentUser, activeTimers])

  useEffect(() => {
    if (currentUser && activeTimers[currentUser.id]) {
      const elapsed = Math.floor((Date.now() - activeTimers[currentUser.id].start_time) / 1000)
      setTimerSeconds(elapsed)
      setSelectedClient(activeTimers[currentUser.id].client_id || '')
      setSelectedProject(activeTimers[currentUser.id].project_id || '')
      setDescription(activeTimers[currentUser.id].description || '')
    } else {
      setTimerSeconds(0)
    }
  }, [currentUser, activeTimers])

  // Auth functions
  const handleRegister = async () => {
    setLoginError('')
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setLoginError('Vul gebruikersnaam en wachtwoord in')
      return
    }
    if (loginPassword.length < 4) {
      setLoginError('Wachtwoord moet minimaal 4 tekens zijn')
      return
    }
    
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .ilike('username', loginUsername)
      .single()
    
    if (existing) {
      setLoginError('Deze gebruikersnaam bestaat al')
      return
    }
    
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ username: loginUsername.trim(), password_hash: hashPassword(loginPassword) })
      .select()
      .single()
    
    if (error) {
      setLoginError('Er ging iets mis, probeer opnieuw')
      return
    }
    
    setCurrentUser(newUser)
    localStorage.setItem('uren-session', newUser.id)
    setLoginUsername('')
    setLoginPassword('')
    loadAllData()
  }

  const handleLogin = async () => {
    setLoginError('')
    
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .ilike('username', loginUsername)
      .eq('password_hash', hashPassword(loginPassword))
      .single()
    
    if (!user) {
      setLoginError('Onjuiste gebruikersnaam of wachtwoord')
      return
    }
    
    setCurrentUser(user)
    localStorage.setItem('uren-session', user.id)
    setLoginUsername('')
    setLoginPassword('')
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('uren-session')
    setView('timer')
    setTeamView(false)
  }

  // Timer functions
  const myTimer = currentUser ? activeTimers[currentUser.id] : null

  const startTimer = async () => {
    if (!currentUser) return
    setSaving(true)
    
    await supabase.from('active_timers').upsert({
      user_id: currentUser.id,
      client_id: selectedClient || null,
      project_id: selectedProject || null,
      description: description,
      start_time: Date.now()
    })
    
    await loadAllData()
    setSaving(false)
  }

  const stopTimer = async () => {
    if (!currentUser || !myTimer || timerSeconds < 60) return
    setSaving(true)
    
    await supabase.from('time_entries').insert({
      user_id: currentUser.id,
      client_id: myTimer.client_id,
      project_id: myTimer.project_id,
      description: myTimer.description,
      seconds: timerSeconds,
      date: new Date(myTimer.start_time).toISOString().split('T')[0]
    })
    
    await supabase.from('active_timers').delete().eq('user_id', currentUser.id)
    
    setTimerSeconds(0)
    setDescription('')
    await loadAllData()
    setSaving(false)
  }

  const cancelTimer = async () => {
    if (!currentUser) return
    setSaving(true)
    await supabase.from('active_timers').delete().eq('user_id', currentUser.id)
    setTimerSeconds(0)
    await loadAllData()
    setSaving(false)
  }

  const addManualEntry = async () => {
    if (!currentUser) return
    const hours = parseFloat(manualHours) || 0
    const minutes = parseFloat(manualMinutes) || 0
    const totalSeconds = (hours * 3600) + (minutes * 60)
    if (totalSeconds < 60) return
    
    setSaving(true)
    await supabase.from('time_entries').insert({
      user_id: currentUser.id,
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

  // Client/Project functions
  const addClient = async () => {
    if (!newClientName.trim()) return
    setSaving(true)
    await supabase.from('clients').insert({
      name: newClientName.trim(),
      hourly_rate: parseFloat(newClientRate) || 0
    })
    setNewClientName('')
    setNewClientRate('')
    await loadAllData()
    setSaving(false)
  }

  const updateClient = async (id, name, rate) => {
    setSaving(true)
    await supabase.from('clients').update({
      name,
      hourly_rate: parseFloat(rate) || 0
    }).eq('id', id)
    setEditingClient(null)
    await loadAllData()
    setSaving(false)
  }

  const deleteClient = async (id) => {
    setSaving(true)
    await supabase.from('clients').delete().eq('id', id)
    await loadAllData()
    setSaving(false)
  }

  const addProject = async () => {
    if (!newProjectName.trim() || !newProjectClient) return
    setSaving(true)
    await supabase.from('projects').insert({
      name: newProjectName.trim(),
      client_id: newProjectClient
    })
    setNewProjectName('')
    setNewProjectClient('')
    await loadAllData()
    setSaving(false)
  }

  const deleteProject = async (id) => {
    setSaving(true)
    await supabase.from('projects').delete().eq('id', id)
    await loadAllData()
    setSaving(false)
  }

  // Helper functions
  const getClientName = (id) => clients.find(c => c.id === id)?.name || 'Onbekend'
  const getProjectName = (id) => projects.find(p => p.id === id)?.name || 'Geen project'
  const getClientRate = (id) => clients.find(c => c.id === id)?.hourly_rate || 0
  const getClientProjects = (clientId) => projects.filter(p => p.client_id === clientId)
  const getUserName = (id) => users.find(u => u.id === id)?.username || 'Onbekend'

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
    return inWeek && entry.user_id === currentUser?.id
  })

  const weekTotalSeconds = weekEntries.reduce((sum, e) => sum + e.seconds, 0)
  const weekTotalEarnings = weekEntries.reduce((sum, e) => {
    const rate = getClientRate(e.client_id)
    return sum + (e.seconds / 3600 * rate)
  }, 0)

  const groupEntries = (entries) => {
    const grouped = {}
    entries.forEach(entry => {
      const key = teamView ? entry.user_id : entry.client_id
      if (!grouped[key]) grouped[key] = { seconds: 0, entries: [] }
      grouped[key].seconds += entry.seconds
      grouped[key].entries.push(entry)
    })
    return grouped
  }

  const entriesGrouped = groupEntries(weekEntries)

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

  // Login Screen
  if (!currentUser) {
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
            
            <div className="tabs">
              <button 
                className={loginMode === 'login' ? 'active' : ''} 
                onClick={() => { setLoginMode('login'); setLoginError(''); }}
              >
                Inloggen
              </button>
              <button 
                className={loginMode === 'register' ? 'active' : ''} 
                onClick={() => { setLoginMode('register'); setLoginError(''); }}
              >
                Registreren
              </button>
            </div>
            
            <div className="form">
              <label>Gebruikersnaam</label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Jouw naam"
                onKeyPress={(e) => e.key === 'Enter' && (loginMode === 'login' ? handleLogin() : handleRegister())}
              />
              
              <label>Wachtwoord</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                onKeyPress={(e) => e.key === 'Enter' && (loginMode === 'login' ? handleLogin() : handleRegister())}
              />
              
              {loginError && <div className="error">{loginError}</div>}
              
              <button className="submit" onClick={loginMode === 'login' ? handleLogin : handleRegister}>
                {loginMode === 'login' ? 'Inloggen' : 'Account aanmaken'}
              </button>
            </div>
            
            {users.length > 0 && (
              <p className="users-count">👥 {users.length} teamlid{users.length !== 1 ? 'en' : ''} geregistreerd</p>
            )}
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
          .tabs {
            display: flex;
            gap: 8px;
            background: rgba(0,0,0,0.2);
            border-radius: 10px;
            padding: 4px;
            margin-bottom: 24px;
          }
          .tabs button {
            flex: 1;
            background: transparent;
            border: none;
            color: rgba(255,255,255,0.5);
            padding: 10px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
          }
          .tabs button.active {
            background: #e94560;
            color: white;
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
          .users-count {
            color: rgba(255,255,255,0.4);
            font-size: 12px;
            text-align: center;
            margin-top: 24px;
            padding-top: 24px;
            border-top: 1px solid rgba(255,255,255,0.1);
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
      <div className="app">
        <header>
          <div className="header-content">
            <div>
              <h1>Urenregistratie {saving && <span className="saving">opslaan...</span>}</h1>
              <p>Welkom, <strong>{currentUser.username}</strong></p>
            </div>
            <div className="header-right">
              {myTimer && (
                <div className="active-timer">
                  <span className="dot"></span>
                  <span className="time">{formatDuration(timerSeconds)}</span>
                </div>
              )}
              <button onClick={handleLogout} className="logout">Uitloggen</button>
            </div>
          </div>
        </header>

        <nav>
          <div className="nav-content">
            {[
              { id: 'timer', label: '⏱️ Timer' },
              { id: 'handmatig', label: '✏️ Handmatig' },
              { id: 'overzicht', label: '📊 Overzicht' },
              { id: 'klanten', label: '👥 Klanten' }
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
                    {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
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
                        <span>{formatHours(groupData.seconds)} uur{!teamView && ` · ${formatMoney(groupData.seconds / 3600 * getClientRate(groupId))}`}</span>
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
                          {entry.user_id === currentUser.id && (
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

          {/* Clients View */}
          {view === 'klanten' && (
            <div className="view-content">
              <div className="card">
                <h3>Nieuwe klant (gedeeld met team)</h3>
                <div className="inline-form">
                  <input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="Klantnaam" />
                  <input type="number" value={newClientRate} onChange={(e) => setNewClientRate(e.target.value)} placeholder="€/uur" />
                  <button onClick={addClient} disabled={!newClientName.trim()}>+</button>
                </div>
              </div>

              {clients.length > 0 ? (
                clients.map(client => (
                  <div key={client.id} className="client-card">
                    {editingClient === client.id ? (
                      <div className="edit-form">
                        <input type="text" defaultValue={client.name} id={`name-${client.id}`} />
                        <input type="number" defaultValue={client.hourly_rate} id={`rate-${client.id}`} placeholder="Uurtarief" />
                        <div className="edit-actions">
                          <button onClick={() => {
                            updateClient(client.id, document.getElementById(`name-${client.id}`).value, document.getElementById(`rate-${client.id}`).value)
                          }} className="save">Opslaan</button>
                          <button onClick={() => setEditingClient(null)} className="cancel">Annuleren</button>
                        </div>
                      </div>
                    ) : (
                      <div className="client-info">
                        <div>
                          <strong>{client.name}</strong>
                          <span>{formatMoney(client.hourly_rate)}/uur · {getClientProjects(client.id).length} project(en)</span>
                        </div>
                        <div className="client-actions">
                          <button onClick={() => setEditingClient(client.id)}>✎</button>
                          <button onClick={() => deleteClient(client.id)} className="delete">×</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty">
                  <span>👥</span>
                  <p>Nog geen klanten toegevoegd</p>
                </div>
              )}

              {clients.length > 0 && (
                <div className="card">
                  <h3>Nieuw project</h3>
                  <div className="inline-form">
                    <select value={newProjectClient} onChange={(e) => setNewProjectClient(e.target.value)}>
                      <option value="">Klant...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Projectnaam" />
                    <button onClick={addProject} disabled={!newProjectName.trim() || !newProjectClient}>+</button>
                  </div>
                </div>
              )}

              {projects.length > 0 && (
                <>
                  <h4 className="section-title">Projecten</h4>
                  {projects.map(project => (
                    <div key={project.id} className="project-card">
                      <div>
                        <strong>{project.name}</strong>
                        <span>{getClientName(project.client_id)}</span>
                      </div>
                      <button onClick={() => deleteProject(project.id)} className="delete">×</button>
                    </div>
                  ))}
                </>
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
        
        .client-card, .project-card {
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 12px;
        }
        .client-info, .project-card {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .client-info strong, .project-card strong { display: block; font-size: 16px; margin-bottom: 4px; }
        .client-info span, .project-card span { font-size: 13px; color: rgba(255,255,255,0.5); }
        .client-actions {
          display: flex;
          gap: 8px;
        }
        .client-actions button, .project-card button {
          background: rgba(255,255,255,0.1);
          border: none;
          color: rgba(255,255,255,0.7);
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
        }
        .client-actions .delete, .project-card .delete {
          background: rgba(255,100,100,0.1);
          color: #ff6b6b;
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
          margin: 24px 0 12px 0;
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
