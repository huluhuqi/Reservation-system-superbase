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
  },

  createUser: async (employeeNo, username, password = '123456', role = 'user') => {
    const { data, error } = await supabase
      .rpc('admin_create_user', {
        p_employee_no: employeeNo,
        p_username: username,
        p_password: password,
        p_role: role
      })
    if (error) throw error
    return data
  },

  batchCreateUsers: async (users) => {
    const { data, error } = await supabase
      .rpc('admin_batch_create_users', {
        p_users: users
      })
    if (error) throw error
    return data
  },

  deleteUser: async (userId) => {
    const { data, error } = await supabase
      .rpc('admin_delete_user', {
        p_user_id: userId
      })
    if (error) throw error
    return data
  },

  batchDeleteUsers: async (userIds) => {
    const { data, error } = await supabase
      .rpc('admin_batch_delete_users', {
        p_user_ids: userIds
      })
    if (error) throw error
    return data
  }
}
