<template>
  <Icon :icon="faCircleQuestion" :title="title" class="help-trigger text-k-primary" />
</template>

<script lang="ts" setup>
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons'
import { toRefs } from 'vue'

const props = defineProps<{ title: string }>()
const { title } = toRefs(props)
</script>
