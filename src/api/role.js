import { supabase } from '@/lib/supabase'

function normalizeRole(role) {
  if (!role) return null
  return {
    id: role.id,
    role_name: role.role_name,
    role_description: role.role_description,
    can_booking_all: role.can_booking_all,
    created_at: role.created_at,
    updated_at: role.updated_at
  }
}

export const RoleAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data || []).map(normalizeRole)
  },

  getById: async (id) => {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return normalizeRole(data)
  },

  create: async (role) => {
    const { data, error } = await supabase
      .from('roles')
      .insert({
        role_name: role.role_name,
        role_description: role.role_description || '',
        can_booking_all: role.can_booking_all || false
      })
      .select()
      .single()
    if (error) throw error
    return normalizeRole(data)
  },

  update: async (id, role) => {
    const { data, error } = await supabase
      .from('roles')
      .update({
        role_name: role.role_name,
        role_description: role.role_description || '',
        can_booking_all: role.can_booking_all || false,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return normalizeRole(data)
  },

  remove: async (id) => {
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id)
    if (error) throw error
  },

  getCategories: async (roleId) => {
    const { data, error } = await supabase
      .from('role_categories')
      .select('category_id')
      .eq('role_id', roleId)
    if (error) throw error
    return (data || []).map(item => item.category_id)
  },

  setCategories: async (roleId, categoryIds) => {
    // 先删除原有关联
    const { error: deleteError } = await supabase
      .from('role_categories')
      .delete()
      .eq('role_id', roleId)
    if (deleteError) throw deleteError

    // 如果有新的类别，插入关联
    if (categoryIds && categoryIds.length > 0) {
      const inserts = categoryIds.map(catId => ({
        role_id: roleId,
        category_id: catId
      }))
      const { error: insertError } = await supabase
        .from('role_categories')
        .insert(inserts)
      if (insertError) throw insertError
    }
  },

  getRoleWithCategories: async (roleId) => {
    const role = await RoleAPI.getById(roleId)
    if (!role) return null

    const categoryIds = await RoleAPI.getCategories(roleId)
    return { ...role, category_ids: categoryIds }
  },

  getUserAccessibleCategories: async (userId) => {
    const { data: user, error } = await supabase
      .from('users')
      .select('role_id')
      .eq('id', userId)
      .single()
    if (error || !user?.role_id) return null

    const role = await RoleAPI.getRoleWithCategories(user.role_id)
    return role
  }
}
