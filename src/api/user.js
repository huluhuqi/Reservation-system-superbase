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

  createUserWithRole: async (employeeNo, username, password = '123456', roleId = null) => {
    // 先用rpc创建用户
    const result = await UserAPI.createUser(employeeNo, username, password, 'user')
    
    // 如果指定了role_id，更新用户的role_id
    if (roleId) {
      // 获取刚创建的用户
      const { data: users, error: findError } = await supabase
        .from('users')
        .select('id')
        .eq('employee_no', employeeNo)
        .single()
      
      if (!findError && users) {
        await supabase
          .from('users')
          .update({ role_id: roleId })
          .eq('id', users.id)
      }
    }
    return result
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
  },

  updateUser: async (userId, updates) => {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  batchUpdateRole: async (userIds, roleId) => {
    const { data, error } = await supabase
      .from('users')
      .update({ role_id: roleId || null })
      .in('id', userIds)
      .select()
    if (error) throw error
    return data
  }
}
