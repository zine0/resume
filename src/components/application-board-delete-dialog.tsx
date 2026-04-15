import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ApplicationEntry } from '@/types/application'

interface ApplicationBoardDeleteDialogProps {
  target: ApplicationEntry | null
  deleting: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ApplicationBoardDeleteDialog({
  target,
  deleting,
  onOpenChange,
  onConfirm,
}: ApplicationBoardDeleteDialogProps) {
  return (
    <AlertDialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除这条求职记录？</AlertDialogTitle>
          <AlertDialogDescription>
            {target
              ? `将删除「${target.company} · ${target.role}」，该操作无法撤销。`
              : '该操作无法撤销。'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={deleting}>
            {deleting ? '删除中...' : '删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
