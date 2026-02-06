<template>
  <div class="demo">
    <!-- 测试组件名提示：输入 <n- 应该会提示所有 naive-ui 组件 -->
    <n-button type="primary" size="large">
      Click Me
    </n-button>

    <!-- 测试属性名提示：在 n-input 后按空格应该提示 type, size, placeholder 等属性 -->
    <n-input placeholder="Enter text" clearable />

    <!-- 测试属性值提示：在 type=" 后应该提示 primary, success, warning, error 等 -->
    <n-button type="">Button</n-button>

    <!-- 更多组件示例 -->
    <n-card title="Card Title" size="medium" hoverable>
      <n-space vertical>
        <n-select 
          :options="options" 
          placeholder="Select an option"
          filterable
        />
        
        <n-form 
          :model="formData" 
          label-placement="left"
          size="medium"
        >
          <!-- Form items here -->
        </n-form>
      </n-space>
    </n-card>

    <n-modal :show="showModal" preset="card" title="Modal Title">
      <p>Modal content</p>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const showModal = ref(false);
const options = ref([
  { label: 'Option 1', value: '1' },
  { label: 'Option 2', value: '2' }
]);
const formData = ref({});
</script>

<style scoped>
.demo {
  padding: 20px;
}
</style>
