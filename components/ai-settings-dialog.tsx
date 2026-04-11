
import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Icon } from "@iconify/react"
import type { AIConfig } from "@/types/ai"
import { AI_PRESETS } from "@/types/ai"
import { getAIConfig, saveAIConfig } from "@/lib/ai-config"
import { aiTestConnection } from "@/lib/ai-service"
import { useToast } from "@/hooks/use-toast"

interface AISettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AISettingsDialog({ open, onOpenChange }: AISettingsDialogProps) {
  const { toast } = useToast()
  const [provider, setProvider] = useState("openai")
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const resetForm = useCallback(() => {
    setProvider("openai")
    setApiKey("")
    setModel(AI_PRESETS.openai.models[0])
    setBaseUrl(AI_PRESETS.openai.baseUrl)
    setShowApiKey(false)
  }, [])

  useEffect(() => {
    if (!open) return
    getAIConfig().then((config) => {
      if (config) {
        setProvider(config.provider)
        setApiKey(config.apiKey)
        setModel(config.model)
        setBaseUrl(config.baseUrl)
      } else {
        resetForm()
      }
    })
  }, [open, resetForm])

  const handleProviderChange = (value: string) => {
    setProvider(value)
    const preset = AI_PRESETS[value]
    if (preset) {
      setBaseUrl(preset.baseUrl)
      setModel(preset.models[0] ?? "")
    }
  }

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "保存失败",
        description: "请填写 API Key",
        variant: "destructive",
      })
      return
    }
    if (!model.trim()) {
      toast({
        title: "保存失败",
        description: "请填写模型名称",
        variant: "destructive",
      })
      return
    }
    if (!baseUrl.trim()) {
      toast({
        title: "保存失败",
        description: "请填写 API 地址",
        variant: "destructive",
      })
      return
    }

    const config: AIConfig = {
      provider,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
    }

    setSaving(true)
    try {
      await saveAIConfig(config)
      toast({ title: "AI 设置已保存" })
      onOpenChange(false)
    } catch {
      toast({
        title: "保存失败",
        description: "无法保存配置，请重试",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    if (!apiKey.trim() || !model.trim() || !baseUrl.trim()) {
      toast({
        title: "测试失败",
        description: "请先填写完整的配置信息",
        variant: "destructive",
      })
      return
    }

    setTesting(true)
    try {
      await saveAIConfig({
        provider,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        model: model.trim(),
      })
      await aiTestConnection()
      toast({ title: "连接成功", description: "AI 服务已就绪" })
    } catch (err) {
      const message = err instanceof Error ? err.message : "未知错误"
      toast({
        title: "连接失败",
        description: message,
        variant: "destructive",
      })
    } finally {
      setTesting(false)
    }
  }

  const currentPreset = AI_PRESETS[provider]
  const isCustom = provider === "custom"
  const presetModels = currentPreset?.models ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI 设置</DialogTitle>
          <DialogDescription>
            配置 AI 服务提供商和模型参数
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>服务商</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(AI_PRESETS).map(([key, preset]) => (
                  <SelectItem key={key} value={key}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-api-key">API Key</Label>
            <div className="relative">
              <Input
                id="ai-api-key"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
                tabIndex={-1}
              >
                <Icon
                  icon={showApiKey ? "lucide:eye-off" : "lucide:eye"}
                  className="size-4 text-muted-foreground"
                />
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-model">模型</Label>
            {presetModels.length > 0 ? (
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presetModels.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="ai-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="例如: gpt-4o-mini"
              />
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-base-url">API 地址</Label>
            <Input
              id="ai-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              readOnly={!isCustom}
              className={!isCustom ? "bg-muted cursor-not-allowed" : ""}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing || saving}
          >
            {testing && (
              <Icon icon="lucide:loader-2" className="size-4 animate-spin" />
            )}
            {testing ? "测试中..." : "测试连接"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={testing || saving}>
            {saving && (
              <Icon icon="lucide:loader-2" className="size-4 animate-spin" />
            )}
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
