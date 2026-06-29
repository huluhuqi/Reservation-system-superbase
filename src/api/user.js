import { supabase } from '@/lib/supabase'

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
  }
}
