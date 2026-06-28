import { safePost } from './safeRequest.js'
import { adaptRequest } from '../utils/fieldAdapter.js'
import { getUserId, getUserRole } from './context.js'

const CATEGORY_TABLE = 'kg7500_categories'
const INSTRUMENT_TABLE = 'kg7500_instruments'
const APP_KEY = '4418E8F40E3E27D3EBFD592311539A89'

function normalizeRecord(record) {
  if (!record) return record
  const result = { ...record }
  if (result.id !== undefined && result._id === undefined) {
    result._id = String(result.id)
  }
  return result
}

async function getCategoryById(id) {
  if (!id) return null

  const payload = {
    s: 'App.Table.Get',
    app_key: APP_KEY,
    user_id: getUserId(),
    role: getUserRole(),
    model_name: CATEGORY_TABLE,
    id
  }

  const res = await safePost('/', payload, { skipRisk: true })
  return res.data ? normalizeRecord(res.data) : null
}

export const categoryApi = {
  async getCategories() {
    const payload = {
      s: 'App.Table.FreeQuery',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: CATEGORY_TABLE,
      logic: 'and',
      where: JSON.stringify([['id', '>', '0']]),
      page: 1,
      perpage: 100
    }

    const res = await safePost('/', payload, { skipRisk: true })
    const list = res.list || []
    return list.map(normalizeRecord)
  },

  async addCategory(data) {
    const safe = adaptRequest(data)

    const payload = {
      s: 'App.Table.Create',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: CATEGORY_TABLE,
      data: JSON.stringify(safe),
      __admin: true
    }

    const res = await safePost('/', payload)
    const newId = res.id
    if (newId) {
      return getCategoryById(newId)
    }
    return normalizeRecord(safe)
  },

  async updateCategory(id, data) {
    const safe = adaptRequest(data)

    const payload = {
      s: 'App.Table.Update',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: CATEGORY_TABLE,
      id,
      data: JSON.stringify(safe),
      __admin: true
    }

    const res = await safePost('/', payload)
    return getCategoryById(id)
  },

  async deleteCategory(id) {
    try {
      const instrumentsPayload = {
        s: 'App.Table.FreeQuery',
        app_key: APP_KEY,
        user_id: getUserId(),
        role: getUserRole(),
        model_name: INSTRUMENT_TABLE,
        logic: 'and',
        where: JSON.stringify([['category_id', '=', String(id)]]),
        page: 1,
        perpage: 500
      }

      const instrumentsRes = await safePost('/', instrumentsPayload, { skipRisk: true })
      const instruments = instrumentsRes.list || []
      for (const inst of instruments) {
        const deletePayload = {
          s: 'App.Table.Delete',
          app_key: APP_KEY,
          user_id: getUserId(),
          role: getUserRole(),
          model_name: INSTRUMENT_TABLE,
          id: inst.id,
          __admin: true
        }
        await safePost('/', deletePayload)
      }
    } catch (e) {
      console.warn('级联删除仪器失败', e)
    }

    const payload = {
      s: 'App.Table.Delete',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: CATEGORY_TABLE,
      id,
      __admin: true
    }

    await safePost('/', payload)
    return { success: true }
  },

  async getCategorySettings(category_id) {
    const payload = {
      s: 'App.Table.FreeQuery',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: 'kg7500_category_settings',
      logic: 'and',
      where: JSON.stringify([['category_id', '=', String(category_id)]]),
      page: 1,
      perpage: 1
    }

    const res = await safePost('/', payload, { skipRisk: true })
    const list = res.list || []
    return list.length > 0 ? normalizeRecord(list[0]) : null
  },

  async saveCategorySettings(category_id, settings) {
    const safe = adaptRequest(settings)
    const existing = await this.getCategorySettings(category_id)

    if (existing) {
      const payload = {
        s: 'App.Table.Update',
        app_key: APP_KEY,
        user_id: getUserId(),
        role: getUserRole(),
        model_name: 'kg7500_category_settings',
        id: existing.id,
        data: JSON.stringify(safe),
        __admin: true
      }
      await safePost('/', payload)
      return this.getCategorySettings(category_id)
    }

    const createData = { ...safe, category_id }
    const payload = {
      s: 'App.Table.Create',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: 'kg7500_category_settings',
      data: JSON.stringify(createData),
      __admin: true
    }

    const res = await safePost('/', payload)
    const newId = res.id
    if (newId) {
      return this.getCategorySettings(category_id)
    }
    return normalizeRecord(createData)
  },

  async createCategory(data) {
    return this.addCategory(data)
  }
}

export default categoryApi
