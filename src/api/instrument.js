import { safePost } from './safeRequest.js'
import { adaptRequest } from '../utils/fieldAdapter.js'
import { getUserId, getUserRole } from './context.js'

const TABLE = 'kg7500_instruments'
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

export const instrumentApi = {
  async getInstruments(params = {}) {
    const safe = adaptRequest(params)

    const conditions = []
    if (safe.category_id) {
      conditions.push(['category_id', '=', String(safe.category_id)])
    }
    if (safe.keyword) {
      conditions.push(['name', 'like', `%${safe.keyword}%`])
    }

    const whereClause = conditions.length > 0 ? conditions : [['id', '>', '0']]

    const payload = {
      s: 'App.Table.FreeQuery',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: TABLE,
      logic: 'and',
      where: JSON.stringify(whereClause),
      page: safe.page || 1,
      perpage: safe.perpage || 500
    }

    const res = await safePost('/', payload, { skipRisk: true })
    const list = res.list || []
    return list.map(normalizeRecord)
  },

  async getInstrumentById(id) {
    if (!id) return null

    const payload = {
      s: 'App.Table.Get',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: TABLE,
      id
    }

    const res = await safePost('/', payload, { skipRisk: true })
    return res.data ? normalizeRecord(res.data) : null
  },

  async addInstrument(data) {
    const safe = adaptRequest(data)
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
    const newId = res.id

    if (newId) {
      return await this.getInstrumentById(newId)
    }
    return normalizeRecord(safe)
  },

  async updateInstrument(id, data) {
    const safe = adaptRequest(data)
    const updateData = denormalizeData(safe)

    const payload = {
      s: 'App.Table.Update',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: TABLE,
      id,
      data: JSON.stringify(updateData)
    }

    await safePost('/', payload, { skipRisk: true })
    return await this.getInstrumentById(id)
  },

  async deleteInstrument(id) {
    const payload = {
      s: 'App.Table.Delete',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: TABLE,
      id
    }

    await safePost('/', payload, { skipRisk: true })
    return { success: true }
  },

  async createInstrument(data) {
    return this.addInstrument(data)
  }
}

export default instrumentApi
