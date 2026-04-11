import { invoke } from "@tauri-apps/api/core"
import type { AIConfig } from "@/types/ai"

export async function getAIConfig(): Promise<AIConfig | null> {
  try {
    return await invoke<AIConfig | null>("get_ai_config")
  } catch {
    return null
  }
}

export async function saveAIConfig(config: AIConfig): Promise<void> {
  await invoke("save_ai_config", { config })
}
