import { safePost } from './safeRequest.js'
import { adaptRequest } from '../utils/fieldAdapter.js'
import { getUserId, getUserRole } from './context.js'

const TABLE = 'kg7500_settings'
const APP_KEY = '4418E8F40E3E27D3EBFD592311539A89'

function normalizeRecord(record) {
  if (!record) return record
  const result = { ...record }
  if (result.id !== undefined && result._id === undefined) {
    result._id = String(result.id)
  }
  return result
}

function denormalizeData(data) {
  const cleaned = { ...data }
  delete cleaned._id
  delete cleaned.id
  delete cleaned.add_time
  delete cleaned.update_time
  delete cleaned.uuid
  delete cleaned.ext_data
  return cleaned
}

export const userApi = {
  async getSettings(options = {}) {
    const payload = {
      s: 'App.Table.FreeFindOne',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: TABLE,
      logic: 'and',
      where: JSON.stringify([['id', '>', '0']])
    }

    const res = await safePost('/', payload, { skipRisk: true })
    return res.data ? normalizeRecord(res.data) : null
  },

  async saveSettings(settings) {
    const safe = adaptRequest(settings)
    const existing = await this.getSettings()

    if (existing) {
      const updateData = denormalizeData(safe)
      const payload = {
        s: 'App.Table.Update',
        app_key: APP_KEY,
        user_id: getUserId(),
        role: getUserRole(),
        model_name: TABLE,
        id: existing.id,
        data: JSON.stringify(updateData),
        __admin: true
      }
      await safePost('/', payload)
      return this.getSettings()
    } else {
      const createData = denormalizeData(safe)
      const payload = {
        s: 'App.Table.Create',
        app_key: APP_KEY,
        user_id: getUserId(),
        role: getUserRole(),
        model_name: TABLE,
        data: JSON.stringify(createData)
      }
      const res = await safePost('/', payload, { skipRisk: true })
      if (res.id) {
        return this.getSettings()
      }
      return normalizeRecord(safe)
    }
  },

  async getRegisteredUsers() {
    const settings = await this.getSettings()
    return settings?.user_list || []
  },

  async addUser(user) {
    const safe = adaptRequest(user)
    const settings = await this.getSettings()
    const users = settings?.user_list || []
    users.push(safe)
    return this.saveSettings({ ...settings, user_list: users })
  },

  async deleteUser(user_name, employee_no) {
    const settings = await this.getSettings()
    const users = (settings?.user_list || []).filter(
      u => !(u.user_name === user_name && u.employee_no === employee_no)
    )
    return this.saveSettings({ ...settings, user_list: users, __admin: true })
  },

  async batchAddUsers(newUsers) {
    const safe = adaptRequest(newUsers)
    const settings = await this.getSettings()
    const users = settings?.user_list || []
    return this.saveSettings({ ...settings, user_list: [...users, ...safe], __admin: true })
  },

  async batchDeleteUsers(userKeys) {
    const settings = await this.getSettings()
    const keySet = new Set(userKeys)
    const users = (settings?.user_list || []).filter(
      u => !keySet.has(`${u.user_name}-${u.employee_no}`)
    )
    return this.saveSettings({ ...settings, user_list: users })
  },

  async verifyAdminPassword(password) {
    const settings = await this.getSettings()
    return settings?.admin_password === password
  },

  async changeAdminPassword(newPassword) {
    const settings = await this.getSettings()
    return this.saveSettings({ ...settings, admin_password: newPassword, __admin: true })
  }
}

export default userApi
