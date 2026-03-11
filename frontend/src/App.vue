<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { Moon, Sun } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

const { isDark, toggleTheme } = useTheme()
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <nav class="border-b border-border bg-background">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-14 items-center">
          <RouterLink to="/forms" class="text-lg font-semibold text-foreground">
            FormBuilder
          </RouterLink>
          <div class="flex items-center gap-2">
            <RouterLink
              to="/forms"
              class="text-sm text-muted-foreground hover:text-foreground"
            >
              My Forms
            </RouterLink>
            <Button variant="ghost" size="icon" @click="toggleTheme">
              <Sun v-if="isDark" class="h-4 w-4" />
              <Moon v-else class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <RouterView />
    </main>
  </div>
</template>
