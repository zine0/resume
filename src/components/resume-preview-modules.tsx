import type { ReactNode } from 'react'
import RichTextRenderer from '@/components/rich-text-renderer'
import type { ResumeData } from '@/types/resume'

interface ResumePreviewModulesProps {
  modules: ResumeData['modules']
  renderStoredIcon: (icon?: string, className?: string) => ReactNode
}

export function ResumePreviewModules({ modules, renderStoredIcon }: ResumePreviewModulesProps) {
  return (
    <div className="space-y-6">
      {modules
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((module) => (
          <div key={module.id} className="resume-module">
            <div className="module-title text-foreground border-border mb-3 flex items-center gap-2 border-b pb-2 text-lg font-semibold">
              {renderStoredIcon(module.icon, 'text-foreground h-5 w-5 shrink-0')}
              {module.title}
            </div>

            <div className="space-y-[0.3em]">
              {module.rows
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((row) =>
                  row.type === 'tags' ? (
                    <div key={row.id} className="mb-1 flex flex-wrap items-center gap-1">
                      {(row.tags || []).slice(0, 20).map((tag) => (
                        <span
                          key={`${row.id}-tag-${tag}`}
                          className="inline-flex items-center rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div
                      key={row.id}
                      className="grid items-center gap-3"
                      style={{
                        gridTemplateColumns: `repeat(${row.columns}, 1fr)`,
                      }}
                    >
                      {row.elements.map((element) => (
                        <div key={element.id} className="text-foreground text-sm">
                          <RichTextRenderer content={element.content} />
                        </div>
                      ))}
                    </div>
                  ),
                )}
            </div>
          </div>
        ))}
    </div>
  )
}
