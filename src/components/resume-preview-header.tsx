import type { ReactNode, RefObject } from 'react'
import type { ResumeData } from '@/types/resume'

interface ResumePreviewHeaderProps {
  resumeData: ResumeData
  leftRef: RefObject<HTMLDivElement | null>
  rightRef: RefObject<HTMLDivElement | null>
  titleRef: RefObject<HTMLHeadingElement | null>
  personalGridRef: RefObject<HTMLDivElement | null>
  jobIntentionWrapRef: RefObject<HTMLDivElement | null>
  jobIntentionBadgeRef: RefObject<HTMLSpanElement | null>
  jobIntentionTextRef: RefObject<HTMLSpanElement | null>
  headerAlignClass: string
  shouldDistribute: boolean
  shouldStretchPersonalInfo: boolean
  idPhotoHeight: number | undefined
  jobIntentionText: string | null
  jobIntentionWrapStyle: React.CSSProperties | undefined
  jobIntentionBadgeStyle: React.CSSProperties
  jobIntentionTextStyle: React.CSSProperties | undefined
  personalInfo: ResumeData['personalInfoSection']['personalInfo']
  isInline: boolean
  itemsPerRow: number
  effectiveStretchGap: number
  rowGapRem: number
  renderStoredIcon: (icon?: string, className?: string) => ReactNode
  isAsciiOnly: (str: string | undefined) => boolean
  avatarShapeClasses: string
  isIdPhoto: boolean
  baseAvatarStyle: React.CSSProperties | undefined
  rightAvatarStyle: React.CSSProperties | undefined
}

export function ResumePreviewHeader({
  resumeData,
  leftRef,
  rightRef,
  titleRef,
  personalGridRef,
  jobIntentionWrapRef,
  jobIntentionBadgeRef,
  jobIntentionTextRef,
  headerAlignClass,
  shouldDistribute,
  shouldStretchPersonalInfo,
  idPhotoHeight,
  jobIntentionText,
  jobIntentionWrapStyle,
  jobIntentionBadgeStyle,
  jobIntentionTextStyle,
  personalInfo,
  isInline,
  itemsPerRow,
  effectiveStretchGap,
  rowGapRem,
  renderStoredIcon,
  isAsciiOnly,
  avatarShapeClasses,
  isIdPhoto,
  baseAvatarStyle,
  rightAvatarStyle,
}: ResumePreviewHeaderProps) {
  return (
    <div className={`mb-6 flex ${headerAlignClass}`}>
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
                  {renderStoredIcon(
                    item.icon,
                    'resume-icon text-foreground h-[1em] w-[1em] shrink-0',
                  )}
                  {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                    <span className="text-muted-foreground shrink-0 text-sm leading-none">
                      {item.label}：
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
                    {renderStoredIcon(
                      item.icon,
                      'resume-icon text-foreground h-[1em] w-[1em] flex-shrink-0',
                    )}
                    {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                      <span className="text-muted-foreground flex-shrink-0 text-sm leading-none">
                        {item.label}：
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
                {renderStoredIcon(
                  item.icon,
                  'resume-icon text-foreground h-[1em] w-[1em] shrink-0',
                )}
                {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                  <span className="text-muted-foreground shrink-0 text-sm leading-none">
                    {item.label}：
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
                {renderStoredIcon(
                  item.icon,
                  'resume-icon text-foreground h-[1em] w-[1em] flex-shrink-0',
                )}
                {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                  <span className="text-muted-foreground flex-shrink-0 text-sm leading-none">
                    {item.label}：
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
        )}
      </div>

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
  )
}
