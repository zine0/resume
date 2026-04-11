
import React, { useState } from "react";
import type { ResumeData } from "@/types/resume";
import ResumePreview from "@/components/resume-preview";

export default function PrintContent({ initialData, autoPrint = false }: { initialData?: ResumeData | null; autoPrint?: boolean }) {
  // 避免在 effect 中同步 setState：使用惰性初始化从 sessionStorage 恢复
  const [resumeData] = useState<ResumeData | null>(() => {
    if (initialData) return initialData;
    if (typeof window !== "undefined") {
      try {
        const s = sessionStorage.getItem("resumeData");
        if (s) return JSON.parse(s) as ResumeData;
      } catch { }
    }
    return null;
  });

  // Auto print once when requested and data is ready
  React.useEffect(() => {
    let done = false;
    const run = async () => {
      if (!autoPrint || !resumeData || done) return;
      done = true;
      try {
        const anyDoc = document as unknown as { fonts?: { ready?: Promise<unknown> } };
        if (anyDoc.fonts?.ready) await anyDoc.fonts.ready;
      } catch { }
      // small delay to ensure layout settles
      setTimeout(() => {
        try { window.print(); } catch { }
      }, 30);
    };
    run();
    return () => { done = true; };
  }, [autoPrint, resumeData]);

  return (
    <div className="pdf-preview-mode">
      {resumeData ? (
        <ResumePreview resumeData={resumeData} />
      ) : (
        <div className="resume-content p-8">
          <h1 className="text-xl font-bold mb-4">无法加载简历数据</h1>
          <p className="text-muted-foreground">请通过后端生成接口或附带 data 参数访问本页面。</p>
        </div>
      )}
    </div>
  );
}
