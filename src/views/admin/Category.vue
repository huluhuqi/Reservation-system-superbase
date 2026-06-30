<script setup>
import { ref, onMounted } from 'vue'
import { CategoryAPI } from '@/api'
import { supabase } from '@/lib/supabase'

const loading = ref(false)
const operating = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const uploading = ref(false)

const categories = ref([])
const form = ref({
  category_name: '',
  category_icon: '',
  icon_type: 'emoji'
})
const editMode = ref(false)
const editingId = ref(null)

async function loadCategories() {
  loading.value = true
  try {
    categories.value = await CategoryAPI.list()
  } catch (e) {
    errorMessage.value = e.message || '加载类别失败'
  } finally {
    loading.value = false
  }
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    errorMessage.value = '请上传图片文件'
    return
  }

  uploading.value = true
  errorMessage.value = ''
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `category_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('category-icons')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('category-icons')
      .getPublicUrl(fileName)

    form.value.category_icon = publicUrl
    form.value.icon_type = 'image'
    successMessage.value = '图片上传成功'
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = '上传失败：' + (e.message || e)
  } finally {
    uploading.value = false
    event.target.value = ''
  }
}

function isImageUrl(url) {
  if (!url) return false
  return url.startsWith('http') && /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url)
}

async function addCategory() {
  const category_name = form.value.category_name.trim()
  if (!category_name) {
    errorMessage.value = '请输入类别名称'
    return
  }

  operating.value = true
  errorMessage.value = ''
  try {
    await CategoryAPI.create({
      category_name,
      category_icon: form.value.category_icon.trim()
    })
    form.value.category_name = ''
    form.value.category_icon = ''
    form.value.icon_type = 'emoji'
    successMessage.value = '新增类别成功'
    await loadCategories()
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = e.message || '新增失败'
  } finally {
    setTimeout(() => {
      operating.value = false
    }, 1200)
  }
}

function editCategory(item) {
  editingId.value = item.id
  form.value.category_name = item.category_name
  form.value.category_icon = item.category_icon || ''
  form.value.icon_type = isImageUrl(item.category_icon) ? 'image' : 'emoji'
  editMode.value = true
}

function cancelEdit() {
  editMode.value = false
  editingId.value = null
  form.value.category_name = ''
  form.value.category_icon = ''
  form.value.icon_type = 'emoji'
}

async function saveCategory() {
  const category_name = form.value.category_name.trim()
  if (!category_name) {
    errorMessage.value = '请输入类别名称'
    return
  }

  operating.value = true
  errorMessage.value = ''
  try {
    await CategoryAPI.update(editingId.value, {
      category_name,
      category_icon: form.value.category_icon.trim()
    })
    cancelEdit()
    successMessage.value = '修改类别成功'
    await loadCategories()
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = e.message || '修改失败'
  } finally {
    setTimeout(() => {
      operating.value = false
    }, 1200)
  }
}

async function deleteCategory(item) {
  const confirmed = window.confirm(
    `确定删除类别"${item.category_name}"吗？该类别下的所有仪器和预约记录也会被删除。`
  )
  if (!confirmed) return

  operating.value = true
  errorMessage.value = ''
  try {
    if (item.category_icon && isImageUrl(item.category_icon)) {
      try {
        const urlParts = item.category_icon.split('/category-icons/')
        if (urlParts.length === 2) {
          const fileName = decodeURIComponent(urlParts[1].split('?')[0])
          await supabase.storage
            .from('category-icons')
            .remove([fileName])
        }
      } catch (e) {
        console.warn('删除图片失败，继续删除类别:', e)
      }
    }

    await CategoryAPI.remove(item.id)
    successMessage.value = '删除类别成功'
    await loadCategories()
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = e.message || '删除失败'
  } finally {
    setTimeout(() => {
      operating.value = false
    }, 1200)
  }
}

onMounted(() => {
  loadCategories()
})
</script>

<template>
  <div class="admin-page">
    <div class="form-card">
      <h3>{{ editMode ? '编辑类别' : '新增类别' }}</h3>
      <div class="form-row">
        <div class="field-block">
          <label>类别名称</label>
          <input v-model="form.category_name" type="text" placeholder="例如：显微镜" @keydown.enter.prevent="editMode ? saveCategory() : addCategory()" />
        </div>
        <div class="field-block">
          <label>图标类型</label>
          <div class="icon-type-tabs">
            <button 
              type="button"
              class="tab-btn"
              :class="{ active: form.icon_type === 'emoji' }"
              @click="form.icon_type = 'emoji'"
            >
              Emoji
            </button>
            <button 
              type="button"
              class="tab-btn"
              :class="{ active: form.icon_type === 'image' }"
              @click="form.icon_type = 'image'"
            >
              上传图片
            </button>
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="field-block" v-if="form.icon_type === 'emoji'">
          <label>图标（选填）</label>
          <input v-model="form.category_icon" type="text" placeholder="例如：🔬" @keydown.enter.prevent="editMode ? saveCategory() : addCategory()" />
        </div>
        <div class="field-block" v-else>
          <label>上传图片</label>
          <div class="upload-area">
            <label class="upload-btn">
              <input 
                type="file" 
                accept="image/*" 
                @change="handleImageUpload"
                style="display: none;"
              />
              {{ uploading ? '上传中...' : '选择图片' }}
            </label>
            <div v-if="form.category_icon && isImageUrl(form.category_icon)" class="preview-img">
              <img :src="form.category_icon" alt="预览" />
            </div>
            <div v-else-if="form.category_icon" class="preview-text">
              当前图标：{{ form.category_icon }}
            </div>
          </div>
        </div>
      </div>

      <div class="form-actions" v-if="editMode">
        <button class="secondary-btn" type="button" @click="cancelEdit">取消</button>
        <button class="primary-btn" type="button" @click="saveCategory" :disabled="operating || uploading">
          {{ operating ? '处理中...' : '保存修改' }}
        </button>
      </div>
      <button v-else class="primary-btn" type="button" @click="addCategory" :disabled="operating || uploading">
        {{ operating ? '处理中...' : '新增类别' }}
      </button>
    </div>

    <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

    <div class="list-card">
      <div class="list-header">
        <h3>类别列表（{{ categories.length }} 个）</h3>
        <button class="secondary-btn" type="button" @click="loadCategories">刷新</button>
      </div>

      <div v-if="loading" class="loading-text">加载中...</div>
      <div v-else-if="categories.length === 0" class="empty-text">暂无类别</div>
      <div v-else class="category-list">
            <div v-for="item in categories" :key="item.id" class="category-item">
              <div class="category-info">
                <span v-if="isImageUrl(item.category_icon)" class="category-icon-img">
                  <img :src="item.category_icon" :alt="item.category_name" />
                </span>
                <span v-else class="category-icon">{{ item.category_icon || '📱' }}</span>
                <span class="category-name">{{ item.category_name }}</span>
              </div>
              <div class="category-actions">
                <button class="text-btn" type="button" @click="editCategory(item)" :disabled="operating">
                  编辑
                </button>
                <button class="text-btn danger" type="button" @click="deleteCategory(item)" :disabled="operating">
                  删除
                </button>
              </div>
            </div>
          </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-card,
.list-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.form-card h3,
.list-header h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2a44;
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.field-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-block label {
  font-size: 13px;
  color: #6b7a99;
}

.field-block input {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.field-block input:focus {
  border-color: #4a90e2;
}

.icon-type-tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  color: #6b7a99;
  transition: all 0.2s;
}

.tab-btn.active {
  border-color: #4a90e2;
  background: #e8f0fe;
  color: #4a90e2;
}

.upload-area {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.upload-btn {
  display: inline-block;
  padding: 8px 16px;
  background: #f0f4f9;
  color: #4a90e2;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.upload-btn:hover {
  background: #e8f0fe;
}

.preview-img {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.preview-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-text {
  font-size: 12px;
  color: #6b7a99;
}

.primary-btn {
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 24px;
  font-size: 14px;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: 12px;
}

.secondary-btn {
  background: #f0f4f9;
  color: #1f2a44;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.category-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  background: #f7f9fd;
  border-radius: 10px;
}

.category-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.category-actions {
  display: flex;
  gap: 8px;
}

.category-icon {
  font-size: 24px;
}

.category-icon-img {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
}

.category-icon-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.category-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2a44;
}

.text-btn {
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 6px;
}

.text-btn.danger {
  color: #e74c3c;
}

.text-btn.danger:hover {
  background: #fef0f0;
}

.text-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-text,
.empty-text {
  text-align: center;
  padding: 30px;
  color: #8a9ab5;
  font-size: 14px;
}

.notice {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
}

.notice.error { background: #fef0f0; color: #e74c3c; }
.notice.success { background: #f0f9f4; color: #27ae60; }
</style>
