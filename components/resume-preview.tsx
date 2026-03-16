/* eslint-disable @next/next/no-img-element */
"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { Icon } from "@iconify/react"
import type { ResumeData } from "@/types/resume"
import RichTextRenderer from "./rich-text-renderer"

interface ResumePreviewProps {
  resumeData: ResumeData
}

/**
 * 简历预览组件
 */
export default function ResumePreview({ resumeData }: ResumePreviewProps) {
  const isAsciiOnly = (str: string | undefined) => !!str && /^[\x00-\x7F]+$/.test(str);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const personalGridRef = useRef<HTMLDivElement | null>(null);
  const [rightBoxHeight, setRightBoxHeight] = useState<number | undefined>(undefined);
  const [stretchRowGapPx, setStretchRowGapPx] = useState<number | undefined>(undefined);
  const [idPhotoHeight, setIdPhotoHeight] = useState<number | undefined>(undefined);

  // 等高策略：测量左侧真实高度，设置右侧容器高度；
  // 父容器使用 items-start，避免 items-stretch 与右侧固定高度形成“锁高”导致头像不随左侧收缩。
  // 格式化求职意向显示
  const formatJobIntention = () => {
    if (!resumeData.jobIntentionSection?.enabled || !resumeData.jobIntentionSection?.items?.length) {
      return null;
    }

    const items = resumeData.jobIntentionSection.items
      .filter(item => {
        // 过滤掉空值的项
        if (item.type === 'salary') {
          return item.salaryRange?.min !== undefined || item.salaryRange?.max !== undefined;
        }
        return item.value && item.value.trim() !== '';
      })
      .sort((a, b) => a.order - b.order)
      .map(item => `${item.label}：${item.value}`)
      .join(' ｜ ');

    return items || null;
  };

  const jobIntentionText = formatJobIntention();
  const avatarType = resumeData.personalInfoSection?.avatarType === "idPhoto" ? "idPhoto" : "default";
  const isIdPhoto = avatarType === "idPhoto";
  const hasIdPhotoHeader = !!(resumeData.avatar && !resumeData.centerTitle && isIdPhoto);
  const personalInfo = (resumeData.personalInfoSection?.personalInfo || [])
    .slice()
    .sort((a, b) => a.order - b.order);
  const layoutMode = resumeData.personalInfoSection?.layout?.mode ?? "grid";
  const itemsPerRow = resumeData.personalInfoSection?.layout?.itemsPerRow || 2;
  const isInline = layoutMode === "inline";
  const avatarShape = isIdPhoto ? "square" : (resumeData.personalInfoSection?.avatarShape === "square" ? "square" : "circle");
  const avatarShapeClasses =
    avatarShape === "square" ? "rounded-none avatar-square" : "rounded-full";
  const baseAvatarStyle = isIdPhoto ? undefined : { width: "5rem", height: "5rem" };
  const rightAvatarStyle = rightBoxHeight
    ? (isIdPhoto ? undefined : { width: rightBoxHeight, height: rightBoxHeight })
    : baseAvatarStyle;
  const headerAlignClass = resumeData.centerTitle
    ? 'flex-col items-center'
    : 'justify-between items-start';
  const shouldDistribute = hasIdPhotoHeader;
  const shouldStretchPersonalInfo =
    shouldDistribute &&
    !isInline &&
    !jobIntentionText &&
    personalInfo.length > 0;
  const personalInfoRowCount = !isInline && personalInfo.length > 0
    ? Math.ceil(personalInfo.length / itemsPerRow)
    : 0;
  const effectiveStretchGap = shouldStretchPersonalInfo
    ? (stretchRowGapPx ?? 0)
    : 0;
  const rowGapRem = 0.5;

  useLayoutEffect(() => {
    if (!leftRef.current) return;
    const el = leftRef.current;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const h = Math.max(0, rect.height || el.scrollHeight || 0);
      setRightBoxHeight(h);

      if (!shouldStretchPersonalInfo || !titleRef.current || !personalGridRef.current || personalInfoRowCount === 0) {
        if (stretchRowGapPx !== undefined) {
          setStretchRowGapPx(undefined);
        }
        return;
      }

      const avatarHeight = rightRef.current?.getBoundingClientRect().height || 0;
      if (avatarHeight > 0) {
        if (idPhotoHeight === undefined || Math.abs(avatarHeight - idPhotoHeight) > 0.5) {
          setIdPhotoHeight(avatarHeight);
        }
      } else if (idPhotoHeight !== undefined) {
        setIdPhotoHeight(undefined);
      }
      const targetHeight = avatarHeight > 0 ? avatarHeight : h;
      const titleHeight = titleRef.current.getBoundingClientRect().height || 0;
      const gridRect = personalGridRef.current.getBoundingClientRect();
      const currentGap = stretchRowGapPx ?? 0;
      const contentHeight = Math.max(0, gridRect.height - currentGap * personalInfoRowCount);
      const available = Math.max(0, targetHeight - titleHeight);
      const nextGap = Math.max(0, (available - contentHeight) / personalInfoRowCount);

      if (Number.isFinite(nextGap) && Math.abs(nextGap - currentGap) > 0.5) {
        setStretchRowGapPx(nextGap);
      }
    };
    // 初次 + 多轮调度，确保收缩场景也能捕获（如列数减少、模块隐藏）
    measure();
    const raf = requestAnimationFrame(measure);
    const t1 = setTimeout(measure, 0);
    const t2 = setTimeout(measure, 60);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined;
    if (ro) {
      ro.observe(el);
      if (rightRef.current) ro.observe(rightRef.current);
    }
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => requestAnimationFrame(measure)) : undefined;
    if (mo) mo.observe(el, { subtree: true, childList: true, characterData: true, attributes: true });
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      window.removeEventListener('resize', measure);
    };
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
  ]);

  return (
    <div className="resume-preview resume-content">
      {/* 头部信息 */}
      <div className={`flex mb-6 ${headerAlignClass}`}>
        {/* 居中标题模式下，头像置于最上方并居中显示 */}
        {resumeData.centerTitle && resumeData.avatar && (
          <div className="mb-4">
            <img
              src={resumeData.avatar}
              alt="头像"
              className={`resume-avatar ${avatarShapeClasses} ${isIdPhoto ? "is-id-photo" : ""} object-cover border-2 border-border box-border mx-auto`}
              style={baseAvatarStyle}
            />
          </div>
        )}

        <div
          ref={leftRef}
          className={`flex-1 flex flex-col resume-header-left ${shouldDistribute ? "is-id-photo id-photo-distribute" : ""} ${resumeData.centerTitle ? 'w-full' : ''}`}
          style={shouldStretchPersonalInfo ? { justifyContent: 'flex-start', minHeight: idPhotoHeight } : undefined}
        >
          <h1
            ref={titleRef}
            className={`resume-title text-2xl font-bold text-foreground ${shouldStretchPersonalInfo ? 'mb-0' : 'mb-4'} ${resumeData.centerTitle ? 'text-center' : ''}`}
          >
            {resumeData.title || "简历标题"}
          </h1>

          {/* 求职意向 */}
          {jobIntentionText && (
            <div className={`job-intention-line text-sm text-muted-foreground mb-3 ${resumeData.centerTitle ? 'text-center' : ''}`}>
              {jobIntentionText}
            </div>
          )}

          {/* 个人信息 */}
          {shouldDistribute ? (
            isInline ? (
              <div
                className="personal-info personal-info-row flex items-center justify-between w-full whitespace-nowrap"
                style={{ backgroundColor: '#F5F6F8', padding: '8px 12px', borderRadius: '4px' }}
              >
                {personalInfo.map((item) => (
                  <div
                    key={item.id}
                    className="personal-info-item flex items-center gap-0.5 shrink-0 whitespace-nowrap"
                  >
                    {item.icon && (
                      <svg
                        className="resume-icon w-[1em] h-[1em] shrink-0"
                        fill="black"
                        viewBox="0 0 24 24"
                        dangerouslySetInnerHTML={{ __html: item.icon }}
                      />
                    )}
                    {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                      <span className="text-sm leading-none text-muted-foreground shrink-0">{item.label}{'：'}</span>
                    )}
                    {item.value.type === "link" && item.value.content ? (
                      <a
                        href={item.value.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`text-sm leading-none text-blue-600 hover:text-blue-800 hover:underline ${isAsciiOnly(item.value.title || item.value.content) ? 'font-latin' : ''}`}
                      >
                        {item.value.title || "点击访问"}
                      </a>
                    ) : (
                      <span className={`text-sm leading-none text-foreground ${isAsciiOnly(item.value.content) ? 'font-latin' : ''}`}>{item.value.content || "未填写"}</span>
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
                    rowGap: shouldStretchPersonalInfo ? `${effectiveStretchGap}px` : `${rowGapRem}rem`,
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
                          className="resume-icon w-[1em] h-[1em] flex-shrink-0"
                          fill="black"
                          viewBox="0 0 24 24"
                          dangerouslySetInnerHTML={{ __html: item.icon }}
                        />
                      )}
                      {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                        <span className="text-sm leading-none text-muted-foreground flex-shrink-0">{item.label}{'：'}</span>
                      )}
                      {item.value.type === "link" && item.value.content ? (
                        <a
                          href={item.value.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-sm leading-none text-blue-600 hover:text-blue-800 hover:underline ${isAsciiOnly(item.value.title || item.value.content) ? 'font-latin' : ''}`}
                        >
                          {item.value.title || "点击访问"}
                        </a>
                      ) : (
                        <span className={`text-sm leading-none text-foreground ${isAsciiOnly(item.value.content) ? 'font-latin' : ''}`}>{item.value.content || "未填写"}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : isInline ? (
            <div
              className="personal-info flex items-center justify-between w-full whitespace-nowrap"
              style={{ backgroundColor: '#F5F6F8', padding: '8px 12px', borderRadius: '4px' }}
            >
              {personalInfo.map((item) => (
                <div
                  key={item.id}
                  className="personal-info-item flex items-center gap-0.5 shrink-0 whitespace-nowrap"
                >
                  {item.icon && (
                    <svg
                      className="resume-icon w-[1em] h-[1em] shrink-0"
                      fill="black"
                      viewBox="0 0 24 24"
                      dangerouslySetInnerHTML={{ __html: item.icon }}
                    />
                  )}
                  {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                    <span className="text-sm leading-none text-muted-foreground shrink-0">{item.label}{'：'}</span>
                  )}
                  {item.value.type === "link" && item.value.content ? (
                    <a
                      href={item.value.content}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm leading-none text-blue-600 hover:text-blue-800 hover:underline ${isAsciiOnly(item.value.title || item.value.content) ? 'font-latin' : ''}`}
                    >
                      {item.value.title || "点击访问"}
                    </a>
                  ) : (
                    <span className={`text-sm leading-none text-foreground ${isAsciiOnly(item.value.content) ? 'font-latin' : ''}`}>{item.value.content || "未填写"}</span>
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
                    width: '100%'
                  }}
                >
                  {personalInfo.map((item) => (
                    <div
                      key={item.id}
                      className="personal-info-item inline-flex items-center gap-0.5 whitespace-nowrap"
                    >
                      {item.icon && (
                        <svg
                          className="resume-icon w-[1em] h-[1em] flex-shrink-0"
                          fill="black"
                          viewBox="0 0 24 24"
                          dangerouslySetInnerHTML={{ __html: item.icon }}
                        />
                      )}
                      {resumeData.personalInfoSection?.showPersonalInfoLabels !== false && (
                        <span className="text-sm leading-none text-muted-foreground flex-shrink-0">{item.label}{'：'}</span>
                      )}
                      {item.value.type === "link" && item.value.content ? (
                        <a
                          href={item.value.content}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-sm leading-none text-blue-600 hover:text-blue-800 hover:underline ${isAsciiOnly(item.value.title || item.value.content) ? 'font-latin' : ''}`}
                        >
                          {item.value.title || "点击访问"}
                        </a>
                      ) : (
                        <span className={`text-sm leading-none text-foreground ${isAsciiOnly(item.value.content) ? 'font-latin' : ''}`}>{item.value.content || "未填写"}</span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>

        {/* 头像：左右布局时放在右侧，并在父容器高度内垂直居中 */}
        {resumeData.avatar && !resumeData.centerTitle && (
          <div
            ref={rightRef}
            className={`ml-6 flex items-start shrink-0 resume-avatar-wrapper ${isIdPhoto ? "is-id-photo" : ""}`}
          >
            <img
              src={resumeData.avatar}
              alt="头像"
              className={`resume-avatar ${avatarShapeClasses} ${isIdPhoto ? "is-id-photo" : ""} object-cover border-2 border-border box-border`}
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
              <div className="module-title text-lg font-semibold text-foreground border-b border-border pb-2 mb-3 flex items-center gap-2">
                {module.icon && (
                  <svg
                    width={20}
                    height={20}
                    viewBox="0 0 24 24"
                    dangerouslySetInnerHTML={{ __html: module.icon }}
                  />
                )}
                {module.title}
              </div>

              <div className="space-y-[0.3em]">
                {/* 渲染行 */}
                {module.rows
                  .sort((a, b) => a.order - b.order)
                  .map((row) => (
                    row.type === 'tags' ? (
                      <div key={row.id} className="flex flex-wrap gap-1 items-center mb-1">
                        {(row.tags || []).slice(0, 20).map((tag, idx) => (
                          <span key={`${row.id}-tag-${idx}`} className="inline-flex items-center border border-gray-300 rounded-full px-2 py-0.5 text-xs text-gray-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div
                        key={row.id}
                        className="grid gap-3 items-center"
                        style={{
                          gridTemplateColumns: `repeat(${row.columns}, 1fr)`,
                        }}
                      >
                        {row.elements.map((element) => (
                          <div
                            key={element.id}
                            className="text-sm text-foreground"
                          >
                            <RichTextRenderer content={element.content} />
                          </div>
                        ))}
                      </div>
                    )
                  ))}
              </div>
            </div>
          ))}
      </div>

      {/* 空状态提示 */}
      {resumeData.modules.length === 0 && (
        <div className="text-center py-12 text-muted-foreground no-print">
          <Icon
            icon="mdi:file-document-outline"
            className="w-12 h-12 mx-auto mb-4 opacity-50"
          />
          <p>暂无简历内容，请在左侧编辑区域添加模块</p>
        </div>
      )}
    </div>
  );
}
