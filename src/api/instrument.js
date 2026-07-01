import { supabase } from '@/lib/supabase'

export const InstrumentAPI = {
  list: async (categoryId) => {
    let query = supabase.from('instrument').select('*')
    if (categoryId) query = query.eq('category_id', categoryId)
    const { data, error } = await query
    if (error) {
      // 如果 sort_order 字段不存在，回退到无排序
      if (error.message && error.message.includes('sort_order')) {
        let fallbackQuery = supabase.from('instrument').select('*')
        if (categoryId) fallbackQuery = fallbackQuery.eq('category_id', categoryId)
        const { data: fallbackData, error: fallbackError } = await fallbackQuery
        if (fallbackError) throw fallbackError
        return (fallbackData || []).map(item => ({
          ...item,
          instrument_name: item.name
        }))
      }
      throw error
    }
    // 手动按 sort_order 排序，避免数据库字段不存在的问题
    const sorted = (data || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    return sorted.map(item => ({
      ...item,
      instrument_name: item.name
    }))
  },

  create: async (payload) => {
    const insertData = {
      name: payload.name || payload.instrument_name,
      category_id: payload.category_id,
      description: payload.description,
      status: payload.status || 'active',
      location: payload.location,
      sort_order: payload.sort_order || 0
    }
    const { data, error } = await supabase
      .from('instrument')
      .insert(insertData)
      .select()
      .single()
    if (error) throw error
    return { ...data, instrument_name: data.name }
  },

  update: async (id, payload) => {
    const updateData = {}
    if (payload.name !== undefined) updateData.name = payload.name
    if (payload.instrument_name !== undefined) updateData.name = payload.instrument_name
    if (payload.category_id !== undefined) updateData.category_id = payload.category_id
    if (payload.description !== undefined) updateData.description = payload.description
    if (payload.status !== undefined) updateData.status = payload.status
    if (payload.location !== undefined) updateData.location = payload.location
    if (payload.sort_order !== undefined) updateData.sort_order = payload.sort_order

    const { data, error } = await supabase
      .from('instrument')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return { ...data, instrument_name: data.name }
  },

  remove: async (id) => {
    const { error } = await supabase.from('instrument').delete().eq('id', id)
    if (error) throw error
  },

  updateSortOrder: async (items) => {
    for (let i = 0; i < items.length; i++) {
      const { error } = await supabase
        .from('instrument')
        .update({ sort_order: i })
        .eq('id', items[i].id)
      if (error) throw error
    }
  }
}
