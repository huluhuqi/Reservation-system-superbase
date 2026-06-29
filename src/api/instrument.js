import { supabase } from '@/lib/supabase'

export const InstrumentAPI = {
  list: async (categoryId) => {
    let query = supabase.from('instrument').select('*')
    if (categoryId) query = query.eq('category_id', categoryId)
    const { data, error } = await query
    if (error) throw error
    return (data || []).map(item => ({
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
      location: payload.location
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
  }
}
