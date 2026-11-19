// frontend/src/composables/useUserManagement.js
import { ref } from 'vue';
import axios from 'axios';

export function useUserManagement(sendCurrentLog) {
  const usersList = ref([]);
  const showEditRoleDialog = ref(false);
  const showEditPwdDialog = ref(false);
  const showEditPermDialog = ref(false);
  const showAddUserDialog = ref(false);
  const targetUser = ref('');

  const editRoleForm = ref({ target_name: '', target_group: '', target_role: 'user' });
  const editPasswordForm = ref({ new_password: '' });
  const editPermForm = ref({ selected_modules: [] });
  const newUserForm = ref({ username: '', name: '', staff_group: '', role: 'user', password: '123456' });

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/get-users');
      if (res.data && res.data.users) {
        usersList.value = res.data.users;
      }
    } catch (e) {}
  };

  // 🌟 修改身份角色與所屬組別
  const handleUpdateRole = async (successCb) => {
    try {
      const res = await axios.post('/api/update-user', {
        username: targetUser.value,
        name: editRoleForm.value.target_name,
        staff_group: editRoleForm.value.target_group,
        role: editRoleForm.value.target_role
      });
      if (res.data && (res.data.status === 'success' || res.data.success)) {
        showEditRoleDialog.value = false;
        await fetchUsers();
        if (typeof sendCurrentLog === 'function') {
          sendCurrentLog('帳號管理', `更新使用者 [${targetUser.value}] 身份為 ${editRoleForm.value.target_role}（組別：${editRoleForm.value.target_group || '未設定'}）`);
        }
        if (typeof successCb === 'function') successCb('已成功更新帳號資料與組別！');
      } else {
        throw new Error(res.data?.detail || '更新失敗');
      }
    } catch (e) {
      if (typeof sendCurrentLog === 'function') {
        sendCurrentLog('帳號管理', `⚠️ 更新身份失敗: ${e.response?.data?.detail || e.message}`);
      }
      throw e;
    }
  };

  // 🌟 修改密碼
  const handleUpdatePassword = async (successCb) => {
    try {
      const res = await axios.post('/api/update-user-password', {
        username: targetUser.value,
        password: editPasswordForm.value.new_password
      });
      if (res.data && (res.data.status === 'success' || res.data.success)) {
        showEditPwdDialog.value = false;
        await fetchUsers();
        if (typeof sendCurrentLog === 'function') sendCurrentLog('帳號管理', `修改使用者 [${targetUser.value}] 密碼成功`);
        if (typeof successCb === 'function') successCb('密碼已成功變更！');
      }
    } catch (e) {
      if (typeof sendCurrentLog === 'function') sendCurrentLog('帳號管理', `⚠️ 修改密碼失敗: ${e.message}`);
      throw e;
    }
  };

  // 🌟 修改模組權限
  const handleUpdatePermissions = async (successCb) => {
    try {
      const selectedModules = editPermForm.value.selected_modules || [];
      const permStr = Array.isArray(selectedModules) ? selectedModules.join(',') : String(selectedModules);

      const res = await axios.post('/api/update-permissions', {
        username: targetUser.value,
        permissions: permStr,
        selected_modules: selectedModules
      });

      if (res.data && (res.data.status === 'success' || res.data.success)) {
        showEditPermDialog.value = false;
        await fetchUsers();
        
        if (typeof sendCurrentLog === 'function') {
          sendCurrentLog('帳號管理', `更新使用者 [${targetUser.value}] 模組權限為: ${permStr || '無'}`);
        }
        if (typeof successCb === 'function') successCb('模組權限已成功更新！');
      } else {
        throw new Error(res.data?.detail || '更新失敗');
      }
    } catch (e) {
      if (typeof sendCurrentLog === 'function') {
        sendCurrentLog('帳號管理', `⚠️ 更新權限失敗: ${e.response?.data?.detail || e.message}`);
      }
      throw e;
    }
  };

  // 🌟 新增使用者（含所屬組別）
  const handleAddUser = async (successCb) => {
    if (!newUserForm.value.username || !newUserForm.value.username.trim()) {
      throw new Error('請輸入登入帳號！');
    }

    const username = newUserForm.value.username.trim();
    const name = newUserForm.value.name?.trim() || username;
    const staff_group = newUserForm.value.staff_group?.trim() || '';
    const role = newUserForm.value.role || 'user';
    const password = newUserForm.value.password?.trim() || '123456';

    try {
      const res = await axios.post('/api/add-user', {
        username,
        name,
        staff_group,
        role,
        password
      });

      if (res.data && (res.data.status === 'success' || res.data.success)) {
        showAddUserDialog.value = false;
        
        if (typeof sendCurrentLog === 'function') {
          sendCurrentLog('帳號管理', `新增使用者 [${username}] 成功（組別：${staff_group || '未設定'}）`);
        }

        newUserForm.value = { username: '', name: '', staff_group: '', role: 'user', password: '123456' };
        await fetchUsers();

        if (typeof successCb === 'function') {
          successCb('🎉 新增帳號成功！');
        }
      } else {
        throw new Error(res.data?.detail || res.data?.message || '新增失敗');
      }
    } catch (e) {
      if (typeof sendCurrentLog === 'function') {
        sendCurrentLog('帳號管理', `⚠️ 新增帳號失敗: ${e.response?.data?.detail || e.message}`);
      }
      throw e;
    }
  };

  // 🌟 刪除使用者
  const deleteUser = async (username, successCb) => {
    try {
      const res = await axios.post('/api/delete-user', { username });
      if (res.data && (res.data.status === 'success' || res.data.success)) {
        await fetchUsers();
        if (typeof sendCurrentLog === 'function') sendCurrentLog('帳號管理', `刪除使用者 [${username}] 成功`);
        if (typeof successCb === 'function') successCb('帳號已刪除！');
      }
    } catch (e) {
      if (typeof sendCurrentLog === 'function') sendCurrentLog('帳號管理', `⚠️ 刪除帳號失敗: ${e.message}`);
      throw e;
    }
  };

  return {
    usersList,
    showEditRoleDialog,
    showEditPwdDialog,
    showEditPermDialog,
    showAddUserDialog,
    targetUser,
    editRoleForm,
    editPasswordForm,
    editPermForm,
    newUserForm,
    fetchUsers,
    handleUpdateRole,
    handleUpdatePassword,
    handleUpdatePermissions,
    handleAddUser,
    deleteUser
  };
}