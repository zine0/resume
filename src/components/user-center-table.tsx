import { Fragment } from 'react'
import { Icon } from '@iconify/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import ExportButton from '@/components/export-button'
import { getResumeLineageHint, getResumeVariantLabel } from '@/lib/resume-lineage'
import type { ApplicationEntry } from '@/types/application'
import type { StoredResume } from '@/types/resume'

type SortKey = 'name' | 'createdAt' | 'updatedAt'
type SortDir = 'asc' | 'desc'

interface ResumeFamilyGroup {
  familyId: string
  items: StoredResume[]
}

interface UserCenterTableProps {
  itemsCount: number
  filteredSorted: StoredResume[]
  groupedFamilies: ResumeFamilyGroup[]
  familySizes: Map<string, number>
  selected: Set<string>
  visibleSelectedIds: string[]
  allVisibleSelected: boolean
  sortKey: SortKey
  sortDir: SortDir
  applicationsAvailable: boolean
  applicationsByResumeId: Map<string, ApplicationEntry[]>
  importing: boolean
  onToggleSelectAll: (checked: boolean) => void
  onToggleSelect: (id: string, checked: boolean) => void
  onSortChange: (field: SortKey, dir: SortDir) => void
  onCompareLatestTwo: (familyId: string) => void
  onEdit: (id: string) => void
  onView: (id: string) => void
  onOpenDetail: (id: string) => void
  onCompareWithLatest: (resume: StoredResume) => void
  onClone: (id: string) => void
  onDeleteOne: (id: string) => void
  onCreate: () => void
  onImport: () => void
  onNavigateBoard: () => void
  onOpenExample: () => void
  onOpenGitHub: () => void
  onClearKeyword: () => void
}

function SortArrows({
  field,
  sortKey,
  sortDir,
  onSortChange,
}: {
  field: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSortChange: (field: SortKey, dir: SortDir) => void
}) {
  const activeAsc = sortKey === field && sortDir === 'asc'
  const activeDesc = sortKey === field && sortDir === 'desc'

  return (
    <span className="ml-1 inline-flex flex-col items-center justify-center rounded border px-0.5 py-px text-[10px] leading-none">
      <Icon
        icon="mdi:triangle"
        className={`h-2.5 w-2.5 cursor-pointer ${activeAsc ? 'text-blue-500' : 'text-muted-foreground/50'}`}
        onClick={() => onSortChange(field, 'asc')}
      />
      <Icon
        icon="mdi:triangle-down"
        className={`h-2.5 w-2.5 cursor-pointer ${activeDesc ? 'text-blue-500' : 'text-muted-foreground/50'}`}
        onClick={() => onSortChange(field, 'desc')}
      />
    </span>
  )
}

export function UserCenterTable({
  itemsCount,
  filteredSorted,
  groupedFamilies,
  familySizes,
  selected,
  visibleSelectedIds,
  allVisibleSelected,
  sortKey,
  sortDir,
  applicationsAvailable,
  applicationsByResumeId,
  importing,
  onToggleSelectAll,
  onToggleSelect,
  onSortChange,
  onCompareLatestTwo,
  onEdit,
  onView,
  onOpenDetail,
  onCompareWithLatest,
  onClone,
  onDeleteOne,
  onCreate,
  onImport,
  onNavigateBoard,
  onOpenExample,
  onOpenGitHub,
  onClearKeyword,
}: UserCenterTableProps) {
  return (
    <div className="space-y-3 p-4">
      {filteredSorted.length > 0 && (
        <div className="flex items-center gap-3 px-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border"
            checked={allVisibleSelected}
            onChange={(e) => onToggleSelectAll(e.target.checked)}
          />
          <span className="text-muted-foreground text-sm">
            当前结果中已选 {visibleSelectedIds.length} 项
          </span>
        </div>
      )}

      {filteredSorted.length === 0 ? (
        <div className="py-16">
          <div className="bg-muted/30 mx-auto max-w-xl rounded-xl border p-10 text-center shadow-sm">
            <div className="bg-primary/10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full">
              <Icon icon="mdi:file-document-edit" className="text-primary h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold">
              {itemsCount === 0 ? '暂无简历' : '未找到匹配的简历'}
            </h3>
            <div className="mt-2 inline-flex flex-col items-stretch">
              <p className="text-muted-foreground text-sm">
                {itemsCount === 0
                  ? '点击“创建简历”开始，或从 JSON 文件导入已有数据并继续编辑'
                  : '请尝试调整搜索关键词，或清空筛选后查看全部简历'}
              </p>
              <div className="mt-6 flex items-center justify-between">
                {itemsCount === 0 ? (
                  <>
                    <Button onClick={onCreate} className="shrink-0 gap-2">
                      <Icon icon="mdi:plus" className="h-4 w-4" /> 创建简历
                    </Button>
                    <Button
                      variant="outline"
                      className="shrink-0 gap-2"
                      onClick={onImport}
                      disabled={importing}
                    >
                      <Icon icon="mdi:import" className="h-4 w-4" /> 导入
                    </Button>
                    <Button variant="outline" className="shrink-0 gap-2" onClick={onNavigateBoard}>
                      <Icon icon="mdi:view-kanban-outline" className="h-4 w-4" /> 求职看板
                    </Button>
                    <Button variant="outline" className="shrink-0 gap-2" onClick={onOpenExample}>
                      <Icon icon="mdi:lightbulb-on" className="h-4 w-4" /> 示例
                    </Button>
                    <Button variant="outline" className="shrink-0 gap-2" onClick={onOpenGitHub}>
                      <Icon icon="mdi:github" className="h-4 w-4" /> GitHub
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" className="shrink-0 gap-2" onClick={onClearKeyword}>
                      <Icon icon="mdi:close-circle-outline" className="h-4 w-4" /> 清空搜索
                    </Button>
                    <Button variant="outline" className="shrink-0 gap-2" onClick={onNavigateBoard}>
                      <Icon icon="mdi:view-kanban-outline" className="h-4 w-4" /> 求职看板
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead className="text-center">编号</TableHead>
              <TableHead className="text-center">头像</TableHead>
              <TableHead>
                <div className="flex items-center justify-start">
                  名称{' '}
                  <SortArrows
                    field="name"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSortChange={onSortChange}
                  />
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center">
                  创建时间
                  <SortArrows
                    field="createdAt"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSortChange={onSortChange}
                  />
                </div>
              </TableHead>
              <TableHead className="text-center">
                <div className="flex items-center justify-center">
                  更新时间
                  <SortArrows
                    field="updatedAt"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSortChange={onSortChange}
                  />
                </div>
              </TableHead>
              <TableHead className="w-[360px] text-center">
                <div className="flex items-center justify-center">操作</div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedFamilies.map((group) => (
              <Fragment key={group.familyId}>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableCell colSpan={7} className="py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                        <Badge variant="secondary" className="rounded-full px-2.5 py-0.5">
                          家族
                        </Badge>
                        <div className="flex min-w-0 items-center gap-1.5 text-sm">
                          <span className="text-muted-foreground">家族 ID</span>
                          <span className="font-semibold tracking-tight">
                            {group.familyId.slice(0, 8)}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-muted-foreground bg-background/70 rounded-full border-dashed px-2.5 py-0.5 font-normal"
                        >
                          {(() => {
                            const totalCount = familySizes.get(group.familyId) ?? group.items.length
                            return totalCount === group.items.length
                              ? `共 ${totalCount} 份简历`
                              : `显示 ${group.items.length} / 共 ${totalCount} 份简历`
                          })()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-background/80 h-8 gap-1.5 rounded-full px-3 text-xs shadow-none"
                          onClick={() => onCompareLatestTwo(group.familyId)}
                          disabled={(familySizes.get(group.familyId) ?? group.items.length) < 2}
                        >
                          <Icon icon="mdi:compare-horizontal" className="h-4 w-4" /> 对比最近两版
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
                {group.items.map((it) => (
                  <TableRow key={it.id} className="group/row">
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border"
                        checked={selected.has(it.id)}
                        onChange={(e) => onToggleSelect(it.id, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-center text-xs">
                      {it.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="bg-muted ring-border/60 group-hover/row:bg-background mx-auto flex h-10 w-10 items-center justify-center overflow-hidden rounded-full shadow-xs ring-1 transition-all duration-200 group-hover/row:shadow-sm">
                        <img
                          src={it.resumeData.avatar || '/not-set.png'}
                          alt={it.resumeData.title}
                          className="h-full w-full object-cover"
                          onError={(ev) => {
                            ;(ev.currentTarget as HTMLImageElement).src = '/default-avatar.jpg'
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1.5 py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tracking-tight">
                            {it.resumeData.title || '未命名'}
                          </span>
                          <Badge variant="outline" className="bg-background/70 text-[11px]">
                            {getResumeVariantLabel(it.lineage.variantKind)}
                          </Badge>
                        </div>
                        {getResumeLineageHint(it.lineage) ? (
                          <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs leading-5">
                            <Icon icon="mdi:source-branch" className="h-3.5 w-3.5" />
                            <p>{getResumeLineageHint(it.lineage)}</p>
                          </div>
                        ) : null}
                        {(applicationsByResumeId.get(it.id)?.length ?? 0) > 0 ||
                        it.lineage.sourceApplicationId ||
                        !applicationsAvailable ? (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs leading-5">
                            {!applicationsAvailable ? (
                              <Badge variant="outline" className="bg-background/70 text-[11px]">
                                求职记录暂未加载
                              </Badge>
                            ) : null}
                            {(applicationsByResumeId.get(it.id)?.length ?? 0) > 0 ? (
                              <Badge variant="outline" className="bg-background/70 text-[11px]">
                                <Icon icon="mdi:briefcase-outline" className="h-3 w-3" />
                                关联投递 {applicationsByResumeId.get(it.id)?.length}
                              </Badge>
                            ) : null}
                            {it.lineage.sourceApplicationId ? (
                              <Badge variant="secondary" className="text-[11px]">
                                来源岗位
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {new Date(it.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {new Date(it.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="w-[360px] text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-1.5 rounded-full px-3 text-xs shadow-none"
                          onClick={() => onEdit(it.id)}
                        >
                          <Icon icon="mdi:pencil" className="h-4 w-4" /> 编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 rounded-full px-3 text-xs"
                          onClick={() => onView(it.id)}
                        >
                          <Icon icon="mdi:eye" className="h-4 w-4" /> 查看
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground gap-1.5 rounded-full px-3 text-xs"
                            >
                              更多
                              <Icon icon="mdi:chevron-down" className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => onOpenDetail(it.id)}>
                              <Icon icon="mdi:dock-window" className="h-4 w-4" />
                              详情
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onCompareWithLatest(it)}>
                              <Icon icon="mdi:compare-horizontal" className="h-4 w-4" />
                              对比
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <ExportButton resumeData={it.resumeData} renderMode="submenu" />
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onClone(it.id)}>
                              <Icon icon="mdi:content-copy" className="h-4 w-4" />
                              克隆
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => onDeleteOne(it.id)}
                            >
                              <Icon icon="mdi:delete" className="h-4 w-4" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
