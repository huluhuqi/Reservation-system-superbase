import { supabase } from '@/lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dqitsleyoxzxdngdwdcq.supabase.co'

async function callAdminFunction(action, data) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('请先登录')
  }

  const url = `${SUPABASE_URL}/functions/v1/admin-users`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ action, ...data })
    })

    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || `操作失败 (${response.status})`)
    }
    return result
  } catch (e) {
    if (e.name === 'TypeError' && e.message.includes('Failed to fetch')) {
      throw new Error(
        '网络请求失败，请检查：\n' +
        '1. Edge Function 是否已在 Supabase Dashboard 中部署\n' +
        '2. 函数名是否为 admin-users\n' +
        '3. 网络连接是否正常\n' +
        `请求URL: ${url}`
      )
    }
    throw e
  }
}

export const AdminUsersAPI = {
  /**
   * 创建单个用户
   * @param {string} employeeNo - 工号
   * @param {string} username - 姓名
   * @param {string} password - 密码（默认123456）
   * @param {string} role - 角色（默认user）
   */
  createUser: async (employeeNo, username, password = '123456', role = 'user') => {
    return callAdminFunction('create', {
      employee_no: employeeNo,
      username: username,
      password: password,
      role: role
    })
  },

  /**
   * 批量创建用户
   * @param {Array} users - 用户列表 [{employee_no, username, password, role}]
   */
  batchCreateUsers: async (users) => {
    return callAdminFunction('batch_create', { users })
  },

  /**
   * 删除单个用户
   * @param {string} userId - 用户ID
   */
  deleteUser: async (userId) => {
    return callAdminFunction('delete', { user_id: userId })
  },

  /**
   * 批量删除用户
   * @param {Array} userIds - 用户ID列表
   */
  batchDeleteUsers: async (userIds) => {
    return callAdminFunction('batch_delete', { user_ids: userIds })
  }
}