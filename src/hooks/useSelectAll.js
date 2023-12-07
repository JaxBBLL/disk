import { ref, watch } from 'vue'

export default function (list) {
  const selectedItems = ref([])
  const selectAll = ref(false)
  const indeterminate = ref(false)

  const toggleAll = () => {
    if (selectAll.value) {
      selectedItems.value = [...list.value]
    } else {
      selectedItems.value = []
    }
  }

  watch(
    selectedItems,
    (newValue) => {
      selectAll.value = newValue.length && newValue.length === list.value.length
      indeterminate.value = newValue.length > 0 && newValue.length !== list.value.length
    },
    {
      deep: true
    }
  )

  return {
    selectedItems,
    selectAll,
    toggleAll,
    indeterminate
  }
}
