<script setup lang="ts">
import { RouterView } from 'vue-router'

import { updateRequired } from '@/core/api/app-update'
import { device } from '@/core/device'
import UpdateRequiredView from '@/app/views/UpdateRequiredView.vue'
</script>

<template>
  <!-- App Android desactualizada (426): nada más funciona hasta actualizarla (spec 013, HU-5). -->
  <UpdateRequiredView v-if="updateRequired" :min-version="updateRequired" :current-version="device().appVersion" />
  <RouterView v-else />
</template>
