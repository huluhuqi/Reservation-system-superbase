import { supabase } from '@/lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dqitsleyoxzxdngdwdcq.supabase.co'

async function callEdgeFunction(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('未登录')
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ action, ...payload })
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || '请求失败')
  }
  return data
}

export const UserAPI = {
  getSettings: async () => {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
      .single()
    if (error) throw error
    return data
  },

  saveSettings: async (settings) => {
    const { data, error } = await supabase
      .from('settings')
      .update(settings)
      .eq('id', 1)
      .select()
      .single()
    if (error) throw error
    return data
  },

  getProfile: async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    if (error) throw error
    return data
  },

  listUsers: async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },

  changeAdminPassword: async (newPassword) => {
    const { data, error } = await supabase
      .from('settings')
      .update({ admin_password: newPassword })
      .eq('id', 1)
      .select()
      .single()
    if (error) throw error
    return data
  },

  createUser: async (employeeNo, username, password = '123456', role = 'user') => {
    const result = await callEdgeFunction('create', {
      employee_no: employeeNo,
      username: username,
      password: password,
      role: role
    })
    return result.user || result
  },

  batchCreateUsers: async (users) => {
    const result = await callEdgeFunction('batch_create', { users })
    return result
  },

  deleteUser: async (userId) => {
    const result = await callEdgeFunction('delete', { user_id: userId })
    return result.success
  },

  batchDeleteUsers: async (userIds) => {
    const result = await callEdgeFunction('batch_delete', { user_ids: userIds })
    return result
  }
}
