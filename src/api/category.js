import { supabase } from '@/lib/supabase'

export const CategoryAPI = {
  list: async () => {
    const { data, error } = await supabase
      .from('category')
      .select('*')
    if (error) {
      if (error.message && error.message.includes('sort_order')) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('category')
          .select('*')
        if (fallbackError) throw fallbackError
        return (fallbackData || []).map(item => ({
          ...item,
          category_name: item.name,
          category_icon: item.icon || ''
        }))
      }
      throw error
    }
    const sorted = (data || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    return sorted.map(item => ({
      ...item,
      category_name: item.name,
      category_icon: item.icon || ''
    }))
  },

  create: async (payload) => {
    const insertData = {
      name: payload.name || payload.category_name,
      icon: payload.icon || payload.category_icon,
      sort_order: payload.sort_order || 0
    }
    const { data, error } = await supabase
      .from('category')
      .insert(insertData)
      .select()
      .single()
    if (error) throw error
    return { ...data, category_name: data.name, category_icon: data.icon }
  },

  update: async (id, payload) => {
    const updateData = {}
    if (payload.name !== undefined) updateData.name = payload.name
    if (payload.category_name !== undefined) updateData.name = payload.category_name
    if (payload.icon !== undefined) updateData.icon = payload.icon
    if (payload.category_icon !== undefined) updateData.icon = payload.category_icon
    if (payload.sort_order !== undefined) updateData.sort_order = payload.sort_order

    const { data, error } = await supabase
      .from('category')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return { ...data, category_name: data.name, category_icon: data.icon }
  },

  remove: async (id) => {
    const { error } = await supabase.from('category').delete().eq('id', id)
    if (error) throw error
  },

  updateSortOrder: async (items) => {
    for (let i = 0; i < items.length; i++) {
      const { error } = await supabase
        .from('category')
        .update({ sort_order: i })
        .eq('id', items[i].id)
      if (error) throw error
    }
  },

  getSettings: async (id) => {
    const { data, error } = await supabase
      .from('category')
      .select('custom_slots')
      .eq('id', id)
      .single()
    if (error) throw error
    return data || { custom_slots: [] }
  },

  saveSettings: async (id, settings) => {
    const { data, error } = await supabase
      .from('category')
      .update({ custom_slots: settings.custom_slots || [] })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }
}
