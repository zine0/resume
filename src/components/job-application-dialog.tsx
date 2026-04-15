import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ApplicationInput, ApplicationStatus } from '@/types/application'

interface ResumeOption {
  id: string
  title: string
}

interface JobApplicationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ApplicationInput) => Promise<void> | void
  submitting?: boolean
  initialValue?: ApplicationInput | null
  resumeOptions: ResumeOption[]
}

const EMPTY_FORM: ApplicationInput = {
  company: '',
  role: '',
  status: 'wishlist',
  jdText: '',
  appliedAt: '',
  source: '',
  contactName: '',
  contactChannel: '',
  lastContactAt: '',
  nextAction: '',
  blockedReason: '',
  result: '',
  interviewStage: '',
  interviewRound: '',
  url: '',
  notes: '',
}

const STATUS_OPTIONS: Array<{ value: ApplicationStatus; label: string }> = [
  { value: 'wishlist', label: '待投递' },
  { value: 'applied', label: '已投递' },
  { value: 'interview', label: '面试中' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: '未通过' },
]

export default function JobApplicationDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting = false,
  initialValue,
  resumeOptions,
}: JobApplicationDialogProps) {
  const [formValues, setFormValues] = useState<ApplicationInput>(EMPTY_FORM)

  useEffect(() => {
    if (!open) return
    setFormValues(initialValue ? { ...EMPTY_FORM, ...initialValue } : { ...EMPTY_FORM })
  }, [initialValue, open])

  const isEditing = Boolean(initialValue)
  const canSubmit = formValues.company.trim().length > 0 && formValues.role.trim().length > 0
  const handleSubmit = async () => {
    if (!canSubmit) return

    const isInterview = formValues.status === 'interview'

    const resumeTitle = formValues.resumeId
      ? resumeOptions.find((option) => option.id === formValues.resumeId)?.title
      : undefined

    await onSubmit({
      company: formValues.company.trim(),
      role: formValues.role.trim(),
      status: formValues.status,
      jdText: formValues.jdText?.trim() || undefined,
      resumeId: formValues.resumeId || undefined,
      resumeTitle,
      url: formValues.url?.trim() || undefined,
      appliedAt: formValues.appliedAt?.trim() || undefined,
      source: formValues.source?.trim() || undefined,
      contactName: formValues.contactName?.trim() || undefined,
      contactChannel: formValues.contactChannel?.trim() || undefined,
      lastContactAt: formValues.lastContactAt?.trim() || undefined,
      nextAction: formValues.nextAction?.trim() || undefined,
      blockedReason: formValues.blockedReason?.trim() || undefined,
      result: formValues.result?.trim() || undefined,
      interviewStage: isInterview ? formValues.interviewStage?.trim() || undefined : undefined,
      interviewRound: isInterview ? formValues.interviewRound?.trim() || undefined : undefined,
      notes: formValues.notes?.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pr-12 pb-4">
          <DialogTitle>{isEditing ? '编辑求职记录' : '新增求职记录'}</DialogTitle>
          <DialogDescription>
            记录目标岗位、关联简历、JD 重点和推进节奏，在看板里拖拽即可更新状态。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="job-company">公司名称</Label>
              <Input
                id="job-company"
                value={formValues.company}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, company: event.target.value }))
                }
                placeholder="例如：字节跳动"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-role">岗位名称</Label>
              <Input
                id="job-role"
                value={formValues.role}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, role: event.target.value }))
                }
                placeholder="例如：前端开发工程师"
              />
            </div>

            <div className="space-y-2">
              <Label>当前状态</Label>
              <Select
                value={formValues.status}
                onValueChange={(value) =>
                  setFormValues((prev) => ({ ...prev, status: value as ApplicationStatus }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择当前进度" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-applied-at">投递日期</Label>
              <Input
                id="job-applied-at"
                value={formValues.appliedAt || ''}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, appliedAt: event.target.value }))
                }
                placeholder="例如：2026-04-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-source">投递来源</Label>
              <Input
                id="job-source"
                value={formValues.source || ''}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, source: event.target.value }))
                }
                placeholder="例如：BOSS 直聘 / 内推 / 官网"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-next-action">下一步动作</Label>
              <Input
                id="job-next-action"
                value={formValues.nextAction || ''}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, nextAction: event.target.value }))
                }
                placeholder="例如：约一面 / 发跟进邮件"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-contact-name">联系人</Label>
              <Input
                id="job-contact-name"
                value={formValues.contactName || ''}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, contactName: event.target.value }))
                }
                placeholder="例如：招聘 HR / 内推同学"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-contact-channel">联系渠道</Label>
              <Input
                id="job-contact-channel"
                value={formValues.contactChannel || ''}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, contactChannel: event.target.value }))
                }
                placeholder="例如：邮箱 / 微信 / 电话"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-last-contact-at">最近联系时间</Label>
              <Input
                id="job-last-contact-at"
                value={formValues.lastContactAt || ''}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, lastContactAt: event.target.value }))
                }
                placeholder="例如：2026-04-15 / 昨天下午"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-result">当前结果</Label>
              <Input
                id="job-result"
                value={formValues.result || ''}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, result: event.target.value }))
                }
                placeholder="例如：待回复 / 已入人才库 / 已拒绝"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="job-blocked-reason">阻塞原因</Label>
              <Textarea
                id="job-blocked-reason"
                value={formValues.blockedReason || ''}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, blockedReason: event.target.value }))
                }
                placeholder="例如：HC 暂停、流程搁置，或等待关键反馈"
                className="min-h-[96px] resize-y"
              />
            </div>

            {formValues.status === 'interview' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="job-interview-stage">面试阶段</Label>
                  <Input
                    id="job-interview-stage"
                    value={formValues.interviewStage || ''}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, interviewStage: event.target.value }))
                    }
                    placeholder="例如：HR / 技术面 / 终面"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="job-interview-round">面试轮次</Label>
                  <Input
                    id="job-interview-round"
                    value={formValues.interviewRound || ''}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, interviewRound: event.target.value }))
                    }
                    placeholder="例如：第 1 轮 / Round 2"
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-2 md:col-span-2">
              <Label>关联简历</Label>
              <Select
                value={formValues.resumeId || 'none'}
                onValueChange={(value) =>
                  setFormValues((prev) => ({
                    ...prev,
                    resumeId: value === 'none' ? undefined : value,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="可选，关联本地简历" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">暂不关联</SelectItem>
                  {resumeOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-url">岗位链接</Label>
            <Input
              id="job-url"
              value={formValues.url || ''}
              onChange={(event) => setFormValues((prev) => ({ ...prev, url: event.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-jd-text">JD 摘要</Label>
            <Textarea
              id="job-jd-text"
              value={formValues.jdText || ''}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, jdText: event.target.value }))
              }
              placeholder="记录职位要求、关键词或面试重点"
              className="min-h-[120px] resize-y"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="job-notes">备注</Label>
            <Textarea
              id="job-notes"
              value={formValues.notes || ''}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, notes: event.target.value }))
              }
              placeholder="记录沟通要点或复盘结论"
              className="min-h-[120px] resize-y"
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || submitting}
            className="gap-2"
          >
            {submitting ? '保存中...' : isEditing ? '保存修改' : '创建记录'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
