import { useLayoutEffect, useRef, useState, memo } from 'react'
import { Icon } from '@iconify/react'
import DOMPurify from 'dompurify'
import type { ResumeData } from '@/types/resume'
import RichTextRenderer from './rich-text-renderer'

interface ResumePreviewProps {
  resumeData: ResumeData
  emptyStateMessage?: string
}

/**
 * 简历预览组件
 */
function ResumePreview({
  resumeData,
  emptyStateMessage = '暂无简历内容，请在左侧编辑区域添加模块',
}: ResumePreviewProps) {
  const sanitizeIcon = (html: string) =>
    DOMPurify.sanitize(html, {
      ADD_TAGS: [
        'path',
        'circle',
        'rect',
        'ellipse',
        'line',
        'polyline',
        'polygon',
        'g',
        'defs',
        'use',
      ],
      ADD_ATTR: [
        'd',
        'fill',
        'stroke',
        'stroke-width',
        'cx',
        'cy',
        'r',
        'x',
        'y',
        'width',
        'height',
        'viewBox',
        'points',
        'transform',
        'opacity',
        'fill-rule',
        'clip-rule',
        'id',
      ],
    })

  // eslint-disable-next-line no-control-regex
  const isAsciiOnly = (str: string | undefined) => !!str && /^[\x00-\x7F]+$/.test(str)
  const leftRef = useRef<HTMLDivElement | null>(null)
  const rightRef = useRef<HTMLDivElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const personalGridRef = useRef<HTMLDivElement | null>(null)
  const jobIntentionWrapRef = useRef<HTMLDivElement | null>(null)
  const jobIntentionBadgeRef = useRef<HTMLSpanElement | null>(null)
  const jobIntentionTextRef = useRef<HTMLSpanElement | null>(null)
  const [rightBoxHeight, setRightBoxHeight] = useState<number | undefined>(undefined)
  const [stretchRowGapPx, setStretchRowGapPx] = useState<number | undefined>(undefined)
  const [idPhotoHeight, setIdPhotoHeight] = useState<number | undefined>(undefined)
  const [jobIntentionScale, setJobIntentionScale] = useState<number>(1)
  const [jobIntentionFontScale, setJobIntentionFontScale] = useState<number>(1)

  // 等高策略：测量左侧真实高度，设置右侧容器高度；
  // 父容器使用 items-start，避免 items-stretch 与右侧固定高度形成“锁高”导致头像不随左侧收缩。
  // 格式化求职意向显示
  const formatJobIntention = () => {
    if (
      !resumeData.jobIntentionSection?.enabled ||
      !resumeData.jobIntentionSection?.items?.length
    ) {
      return null
    }

    const items = resumeData.jobIntentionSection.items
      .filter((item) => {
        // 过滤掉空值的项
        if (item.type === 'salary') {
          return item.salaryRange?.min !== undefined || item.salaryRange?.max !== undefined
        }
        return item.value && item.value.trim() !== ''
      })
      .sort((a, b) => a.order - b.order)
      .map((item) => `${item.label}：${item.value}`)
      .join(' ｜ ')

    return items || null
  }

  const jobIntentionText = formatJobIntention()
  const avatarType =
    resumeData.personalInfoSection?.avatarType === 'idPhoto' ? 'idPhoto' : 'default'
  const isIdPhoto = avatarType === 'idPhoto'
  const hasIdPhotoHeader = !!(resumeData.avatar && !resumeData.centerTitle && isIdPhoto)
  const personalInfo = (resumeData.personalInfoSection?.personalInfo || [])
    .slice()
    .sort((a, b) => a.order - b.order)
  const layoutMode = resumeData.personalInfoSection?.layout?.mode ?? 'grid'
  const itemsPerRow = resumeData.personalInfoSection?.layout?.itemsPerRow || 2
  const isInline = layoutMode === 'inline'
  const avatarShape = isIdPhoto
    ? 'square'
    : resumeData.personalInfoSection?.avatarShape === 'square'
      ? 'square'
      : 'circle'
  const avatarShapeClasses =
    avatarShape === 'square' ? 'rounded-none avatar-square' : 'rounded-full'
  const baseAvatarStyle = isIdPhoto ? undefined : { width: '5rem', height: '5rem' }
  const rightAvatarStyle = rightBoxHeight
    ? isIdPhoto
      ? undefined
      : { width: rightBoxHeight, height: rightBoxHeight }
    : baseAvatarStyle
  const headerAlignClass = resumeData.centerTitle
    ? 'flex-col items-center'
    : 'justify-between items-start'
  const shouldDistribute = hasIdPhotoHeader
  const shouldStretchPersonalInfo =
    shouldDistribute && !isInline && !jobIntentionText && personalInfo.length > 0
  const personalInfoRowCount =
    !isInline && personalInfo.length > 0 ? Math.ceil(personalInfo.length / itemsPerRow) : 0
  const isMultiRowPersonalInfo = !isInline && personalInfoRowCount > 1
  const shouldStyleJobIntention = !!jobIntentionText && isMultiRowPersonalInfo
  const effectiveStretchGap = shouldStretchPersonalInfo ? (stretchRowGapPx ?? 0) : 0
  const rowGapRem = 0.5
  const jobIntentionBadgeStyle = {
    backgroundColor: shouldStyleJobIntention ? '#F5F6F8' : undefined,
    padding: shouldStyleJobIntention ? '4px 8px' : undefined,
    borderRadius: shouldStyleJobIntention ? '4px' : undefined,
    display: 'block',
    width: '100%',
    boxSizing: 'border-box' as const,
  }
  const jobIntentionWrapStyle = jobIntentionText
    ? {
        width: '100%',
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
      }
    : undefined
  const jobIntentionTextStyle = jobIntentionText
    ? {
        transform: `scaleX(${jobIntentionScale})`,
        transformOrigin: `${resumeData.centerTitle ? 'center' : 'left'} center`,
        display: 'inline-block',
        fontSize: `${jobIntentionFontScale}em`,
      }
    : undefined

  useLayoutEffect(() => {
    if (!leftRef.current) return
    const el = leftRef.current
    const measure = () => {
      const rect = el.getBoundingClientRect()
      const h = Math.max(0, rect.height || el.scrollHeight || 0)
      setRightBoxHeight(h)

      if (
        !shouldStretchPersonalInfo ||
        !titleRef.current ||
        !personalGridRef.current ||
        personalInfoRowCount === 0
      ) {
        if (stretchRowGapPx !== undefined) {
          setStretchRowGapPx(undefined)
        }
        return
      }

      const avatarHeight = rightRef.current?.getBoundingClientRect().height || 0
      if (avatarHeight > 0) {
        if (idPhotoHeight === undefined || Math.abs(avatarHeight - idPhotoHeight) > 0.5) {
          setIdPhotoHeight(avatarHeight)
        }
      } else if (idPhotoHeight !== undefined) {
        setIdPhotoHeight(undefined)
      }
      const targetHeight = avatarHeight > 0 ? avatarHeight : h
      const titleHeight = titleRef.current.getBoundingClientRect().height || 0
      const gridRect = personalGridRef.current.getBoundingClientRect()
      const currentGap = stretchRowGapPx ?? 0
      const contentHeight = Math.max(0, gridRect.height - currentGap * personalInfoRowCount)
      const available = Math.max(0, targetHeight - titleHeight)
      const nextGap = Math.max(0, (available - contentHeight) / personalInfoRowCount)

      if (Number.isFinite(nextGap) && Math.abs(nextGap - currentGap) > 0.5) {
        setStretchRowGapPx(nextGap)
      }

      if (jobIntentionBadgeRef.current && jobIntentionTextRef.current) {
        const badgeWidth = jobIntentionBadgeRef.current.clientWidth || 0
        const computed = getComputedStyle(jobIntentionBadgeRef.current)
        const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0
        const paddingRight = Number.parseFloat(computed.paddingRight) || 0
        const wrapWidth = Math.max(0, badgeWidth - paddingLeft - paddingRight)
        const textWidth = jobIntentionTextRef.current.scrollWidth || 0
        if (wrapWidth > 0 && textWidth > 0) {
          const baseWidth = textWidth / Math.max(0.01, jobIntentionFontScale)
          const desiredScale = Math.min(1, wrapWidth / baseWidth)
          const minFontScale = 0.92
          let nextFontScale = 1
          let nextScaleX = 1

          if (desiredScale >= 1) {
            nextFontScale = 1
            nextScaleX = 1
          } else if (desiredScale >= minFontScale) {
            nextFontScale = desiredScale
            nextScaleX = 1
          } else {
            nextFontScale = minFontScale
            nextScaleX = Math.max(0.01, desiredScale / minFontScale)
          }

          if (Math.abs(nextFontScale - jobIntentionFontScale) > 0.01) {
            setJobIntentionFontScale(nextFontScale)
          }
          if (Math.abs(nextScaleX - jobIntentionScale) > 0.01) {
            setJobIntentionScale(nextScaleX)
          }
        }
      } else {
        if (jobIntentionScale !== 1) setJobIntentionScale(1)
        if (jobIntentionFontScale !== 1) setJobIntentionFontScale(1)
      }
    }
    // 初次 + 多轮调度，确保收缩场景也能捕获（如列数减少、模块隐藏）
    measure()
    const raf = requestAnimationFrame(measure)
    const t1 = setTimeout(measure, 0)
    const t2 = setTimeout(measure, 60)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined
    if (ro) {
      ro.observe(el)
      if (rightRef.current) ro.observe(rightRef.current)
    }
    const mo =
      typeof MutationObserver !== 'undefined'
        ? new MutationObserver(() => requestAnimationFrame(measure))
        : undefined
    if (mo)
      mo.observe(el, { subtree: true, childList: true, characterData: true, attributes: true })
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t1)
      clearTimeout(t2)
      if (ro) ro.disconnect()
      if (mo) mo.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [
    resumeData.centerTitle,
    resumeData.title,
    resumeData.personalInfoSection?.layout?.mode,
    resumeData.personalInfoSection?.layout?.itemsPerRow,
    resumeData.personalInfoSection?.personalInfo?.length,
    resumeData.jobIntentionSection?.enabled,
    resumeData.jobIntentionSection?.items?.length,
    shouldStretchPersonalInfo,
    personalInfoRowCount,
    stretchRowGapPx,
    idPhotoHeight,
    jobIntentionText,
    jobIntentionScale,
    jobIntentionFontScale,
  ])

  return (
    <div className="resume-preview resume-content">
      {/* 头部信息 */}
      <div className={`mb-6 flex ${headerAlignClass}`}>
        {/* 居中标题模式下，头像置于最上方并居中显示 */}
        {resumeData.centerTitle && resumeData.avatar && (
          <div className="mb-4">
            <img
              src={resumeData.avatar}
              alt="头像"
              className={`resume-avatar ${avatarShapeClasses} ${isIdPhoto ? 'is-id-photo' : ''} border-border mx-auto box-border border-2 object-cover`}
              style={baseAvatarStyle}
            />
          </div>
        )}

        <div
          ref={leftRef}
          className={`resume-header-left flex flex-1 flex-col ${shouldDistribute ? 'is-id-photo id-photo-distribute' : ''} ${resumeData.centerTitle ? 'w-full' : ''}`}
          style={
            shouldStretchPersonalInfo
              ? { justifyContent: 'flex-start', minHeight: idPhotoHeight }
              : undefined
          }
        >
          <h1
            ref={titleRef}
            className={`resume-title text-foreground text-2xl font-bold ${shouldStretchPersonalInfo ? 'mb-0' : 'mb-4'} ${resumeData.centerTitle ? 'text-center' : ''}`}
          >
            {resumeData.title || '简历标题'}
          </h1>

          {/* 求职意向 */}
          {jobIntentionText && (
            <div
              ref={jobIntentionWrapRef}
              className={`job-intention-line text-muted-foreground mb-3 text-sm ${resumeData.centerTitle ? 'text-center' : ''}`}
              style={jobIntentionWrapStyle}
            >
              <span ref={jobIntentionBadgeRef} style={jobIntentionBadgeStyle}>
                <span ref={jobIntentionTextRef} style={jobIntentionTextStyle}>
                  {jobIntentionText}
                </span>
              </span>
            </div>
          )}

          {/* 个人信息 */}
          {shouldDistribute ? (
            isInline ? (
              <div
                className="personal-info personal-info-row flex w-full items-center justify-between whitespace-nowrap"
                style={{ backgroundColor: '#F5F6F8', padding: '8px 12px', borderRadius: '4px' }}
              >
                {personalInfo.map((item) => (
                  <div
                    key={item.id}
                    className="personal-info-item flex shrink-0 items-center gap-0.5 whitespace-nowrap"
                  >
                    {item.icon && (
                      <svg
                        className="resume-icon h-[1em] w-[1em] shrink-0"
                        fill="black"
                        viewBox="0 0 24 24"
                        dangerouslySetInnerHTML={{ __html: sanitizeIcon(item.icon) }}
                      />
                    )}
                    {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                      <span className="text-muted-foreground shrink-0 text-sm leading-none">
                        {item.label}
                        {'：'}
                      </span>
                    )}
                    {item.value.type === 'link' && item.value.content ? (
                      <a
                        href={item.value.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-sm leading-none text-blue-600 hover:text-blue-800 hover:underline ${isAsciiOnly(item.value.title || item.value.content) ? 'font-latin' : ''}`}
                      >
                        {item.value.title || '点击访问'}
                      </a>
                    ) : (
                      <span
                        className={`text-foreground text-sm leading-none ${isAsciiOnly(item.value.content) ? 'font-latin' : ''}`}
                      >
                        {item.value.content || '未填写'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="personal-info-stretch-wrapper w-full"
                style={shouldStretchPersonalInfo ? { minHeight: 0 } : undefined}
              >
                <div
                  ref={personalGridRef}
                  className="personal-info-row personal-info-grid w-full whitespace-nowrap"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${itemsPerRow}, max-content)`,
                    justifyContent: 'space-between',
                    justifyItems: 'start',
                    alignItems: 'center',
                    columnGap: 0,
                    rowGap: shouldStretchPersonalInfo
                      ? `${effectiveStretchGap}px`
                      : `${rowGapRem}rem`,
                    alignContent: 'start',
                    paddingTop: shouldStretchPersonalInfo ? `${effectiveStretchGap}px` : undefined,
                    boxSizing: shouldStretchPersonalInfo ? 'border-box' : undefined,
                    width: '100%',
                  }}
                >
                  {personalInfo.map((item) => (
                    <div
                      key={item.id}
                      className="personal-info-item inline-flex items-center gap-0.5 whitespace-nowrap"
                    >
                      {item.icon && (
                        <svg
                          className="resume-icon h-[1em] w-[1em] flex-shrink-0"
                          fill="black"
                          viewBox="0 0 24 24"
                          dangerouslySetInnerHTML={{ __html: sanitizeIcon(item.icon) }}
                        />
                      )}
                      {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                        <span className="text-muted-foreground flex-shrink-0 text-sm leading-none">
                          {item.label}
                          {'：'}
                        </span>
                      )}
                      {item.value.type === 'link' && item.value.content ? (
                        <a
                          href={item.value.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-sm leading-none text-blue-600 hover:text-blue-800 hover:underline ${isAsciiOnly(item.value.title || item.value.content) ? 'font-latin' : ''}`}
                        >
                          {item.value.title || '点击访问'}
                        </a>
                      ) : (
                        <span
                          className={`text-foreground text-sm leading-none ${isAsciiOnly(item.value.content) ? 'font-latin' : ''}`}
                        >
                          {item.value.content || '未填写'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : isInline ? (
            <div
              className="personal-info flex w-full items-center justify-between whitespace-nowrap"
              style={{ backgroundColor: '#F5F6F8', padding: '8px 12px', borderRadius: '4px' }}
            >
              {personalInfo.map((item) => (
                <div
                  key={item.id}
                  className="personal-info-item flex shrink-0 items-center gap-0.5 whitespace-nowrap"
                >
                  {item.icon && (
                    <svg
                      className="resume-icon h-[1em] w-[1em] shrink-0"
                      fill="black"
                      viewBox="0 0 24 24"
                      dangerouslySetInnerHTML={{ __html: sanitizeIcon(item.icon) }}
                    />
                  )}
                  {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                    <span className="text-muted-foreground shrink-0 text-sm leading-none">
                      {item.label}
                      {'：'}
                    </span>
                  )}
                  {item.value.type === 'link' && item.value.content ? (
                    <a
                      href={item.value.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm leading-none text-blue-600 hover:text-blue-800 hover:underline ${isAsciiOnly(item.value.title || item.value.content) ? 'font-latin' : ''}`}
                    >
                      {item.value.title || '点击访问'}
                    </a>
                  ) : (
                    <span
                      className={`text-foreground text-sm leading-none ${isAsciiOnly(item.value.content) ? 'font-latin' : ''}`}
                    >
                      {item.value.content || '未填写'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            (() => {
              return (
                <div
                  className="personal-info personal-info-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${itemsPerRow}, max-content)`,
                    justifyContent: 'space-between',
                    justifyItems: 'start',
                    alignItems: 'center',
                    columnGap: 0,
                    rowGap: `${rowGapRem}rem`,
                    width: '100%',
                  }}
                >
                  {personalInfo.map((item) => (
                    <div
                      key={item.id}
                      className="personal-info-item inline-flex items-center gap-0.5 whitespace-nowrap"
                    >
                      {item.icon && (
                        <svg
                          className="resume-icon h-[1em] w-[1em] flex-shrink-0"
                          fill="black"
                          viewBox="0 0 24 24"
                          dangerouslySetInnerHTML={{ __html: sanitizeIcon(item.icon) }}
                        />
                      )}
                      {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                        <span className="text-muted-foreground flex-shrink-0 text-sm leading-none">
                          {item.label}
                          {'：'}
                        </span>
                      )}
                      {item.value.type === 'link' && item.value.content ? (
                        <a
                          href={item.value.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-sm leading-none text-blue-600 hover:text-blue-800 hover:underline ${isAsciiOnly(item.value.title || item.value.content) ? 'font-latin' : ''}`}
                        >
                          {item.value.title || '点击访问'}
                        </a>
                      ) : (
                        <span
                          className={`text-foreground text-sm leading-none ${isAsciiOnly(item.value.content) ? 'font-latin' : ''}`}
                        >
                          {item.value.content || '未填写'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()
          )}
        </div>

        {/* 头像：左右布局时放在右侧，并在父容器高度内垂直居中 */}
        {resumeData.avatar && !resumeData.centerTitle && (
          <div
            ref={rightRef}
            className={`resume-avatar-wrapper ml-6 flex shrink-0 items-start ${isIdPhoto ? 'is-id-photo' : ''}`}
          >
            <img
              src={resumeData.avatar}
              alt="头像"
              className={`resume-avatar ${avatarShapeClasses} ${isIdPhoto ? 'is-id-photo' : ''} border-border box-border border-2 object-cover`}
              style={rightAvatarStyle}
            />
          </div>
        )}
      </div>

      {/* 简历模块 */}
      <div className="space-y-6">
        {resumeData.modules
          .sort((a, b) => a.order - b.order)
          .map((module) => (
            <div key={module.id} className="resume-module">
              <div className="module-title text-foreground border-border mb-3 flex items-center gap-2 border-b pb-2 text-lg font-semibold">
                {module.icon && (
                  <svg
                    width={20}
                    height={20}
                    viewBox="0 0 24 24"
                    dangerouslySetInnerHTML={{ __html: sanitizeIcon(module.icon) }}
                  />
                )}
                {module.title}
              </div>

              <div className="space-y-[0.3em]">
                {/* 渲染行 */}
                {module.rows
                  .sort((a, b) => a.order - b.order)
                  .map((row) =>
                    row.type === 'tags' ? (
                      <div key={row.id} className="mb-1 flex flex-wrap items-center gap-1">
                        {(row.tags || []).slice(0, 20).map((tag, idx) => (
                          <span
                            key={`${row.id}-tag-${idx}`}
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

      {/* 空状态提示 */}
      {resumeData.modules.length === 0 && (
        <div className="text-muted-foreground no-print py-12 text-center">
          <Icon icon="mdi:file-document-outline" className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>{emptyStateMessage}</p>
        </div>
      )}
    </div>
  )
}

const MemoizedResumePreview = memo(ResumePreview)
MemoizedResumePreview.displayName = 'ResumePreview'

export default MemoizedResumePreview
