# 整改清单

## 文档说明

本文档基于一次完整的仓库审计整理而成，覆盖以下维度：

- 前端架构与页面状态流
- TypeScript 类型安全与错误边界
- Rust / Tauri 后端稳定性与安全性
- 导出 / PDF 链路
- 自动化测试与 Tauri 权限收敛

目标不是重复描述问题，而是把已经发现的风险转成可执行的整改动作，方便分阶段推进。

## 优先级定义

- **P0**：存在安全、数据损坏或明显正确性风险，应优先整改
- **P1**：显著影响维护成本、回归风险或错误定位效率
- **P2**：提升工程质量、测试覆盖和长期可维护性

## 执行顺序建议

建议按以下顺序推进：

1. 先处理 **后端写入安全 / PDF 路径与临时文件问题**
2. 再处理 **前端不可信数据解析边界**
3. 然后收口 **导出 / PDF 的平台适配层**
4. 最后拆分 **超大组件**、补齐 **测试与权限收敛**

---

## P0：安全性、数据完整性、正确性

### 1. 将简历存储改为原子写入

- [ ] 重构 `src-tauri/src/storage.rs` 的 `write_storage`
  - **整改动作**：改为“写临时文件 → fsync/flush → rename 替换正式文件”的流程
  - **涉及文件**：`src-tauri/src/storage.rs`
  - **验收标准**：中途异常不会留下半写入的 `resumes.json`

### 2. 为存储读改写流程增加并发保护

- [ ] 给 `create_resume` / `create_resume_from_data` / `update_resume` / `delete_resumes` 增加锁或串行化策略
  - **整改动作**：避免多个命令并发执行时发生“后写覆盖前写”
  - **涉及文件**：`src-tauri/src/storage.rs`
  - **验收标准**：并发调用不会导致已保存的简历内容丢失

### 3. 修复预览组件渲染时的原地排序副作用

- [ ] 去掉 `src/components/resume-preview.tsx` 中对输入数据的原地 `sort(...)`
  - **整改动作**：统一改为浅拷贝后排序，保持渲染纯函数特性
  - **涉及文件**：`src/components/resume-preview.tsx`
  - **验收标准**：打开预览/打印不会悄悄改变原始 `resumeData` 的顺序

### 4. 统一前端不可信数据的运行时校验

- [ ] 替换 URL / `sessionStorage` 边界上的 `JSON.parse(...) as ResumeData`
  - **整改动作**：在解析后走统一的运行时校验/标准化流程，而不是直接断言为 `ResumeData`
  - **涉及文件**：`src/routes/Print.tsx`、`src/routes/EditNew.tsx`、`src/components/print-content.tsx`
  - **验收标准**：损坏、过期或手工构造的数据不会直接进入编辑器/预览链路

---

## P1：边界收口、错误处理、维护成本

### 5. 收敛导出与 PDF 平台调用边界

- [ ] 把 `invoke('generate_pdf', ...)`、文件保存、导出分支逻辑从 UI 组件中抽离到统一适配层
  - **整改动作**：将 `src/components/export-button.tsx` 与 `src/components/pdf-viewer.tsx` 中的平台调用收口到 `lib/` 层
  - **涉及文件**：`src/components/export-button.tsx`、`src/components/pdf-viewer.tsx`、`src/lib/`
  - **验收标准**：导出与 PDF 逻辑不再分散在多个 UI 组件中，错误处理风格保持一致

### 6. 修复 PDF 临时文件命名与清理策略

- [ ] 让 `generate_pdf` 使用唯一临时文件名，并移除重复清理逻辑
  - **整改动作**：避免固定 `print.html` 路径造成并发冲突；统一 early return / success / failure 的清理路径
  - **涉及文件**：`src-tauri/src/pdf.rs`
  - **验收标准**：并发导出互不覆盖，异常中断不会留下多余 temp 文件

### 7. 让 PDF 失败错误可定位、可区分

- [ ] 细化 `generate_pdf` 的错误映射
  - **整改动作**：区分路径错误、Chrome 启动失败、导航失败、超时、打印失败、保存失败等场景
  - **涉及文件**：`src-tauri/src/pdf.rs`、前端 PDF 调用侧
  - **验收标准**：前端能拿到对用户和开发者都更有意义的错误信息，而不是统一的模糊失败

### 8. 改善路由层数据加载失败处理

- [ ] 为页面级数据加载补齐 `catch`、取消逻辑和可见错误状态
  - **整改动作**：修复 `EditResume`、`EditNew`、`ViewResume` 等页面在加载失败时可能一直 loading 或静默失败的问题
  - **涉及文件**：`src/routes/EditResume.tsx`、`src/routes/EditNew.tsx`、`src/routes/ViewResume.tsx`
  - **验收标准**：Tauri/存储异常会被明确呈现，页面不会卡死在加载态

### 9. 减少自动保存的“静默失败”

- [ ] 重新设计 `use-auto-save` 的错误上报方式
  - **整改动作**：保留当前不打断编辑体验的思路，但不要完全吞掉底层异常；至少保留日志或统一错误分流
  - **涉及文件**：`src/hooks/use-auto-save.ts`
  - **验收标准**：保存失败既能被用户感知，也能被开发侧定位

### 10. 收紧核心富文本类型定义

- [ ] 替换 `JSONContent` 中宽松的 `any` 索引签名
  - **整改动作**：为常见 `attrs`、`content`、节点结构建立更窄的类型，减少编辑器/预览/导出链路中的“假类型安全”
  - **涉及文件**：`src/types/resume.ts`
  - **验收标准**：核心富文本对象不再依赖 `Record<string, any>` 与 `[key: string]: any`

### 11. 清理过时或含糊的存储契约

- [ ] 移除或重构遗留的本地存储常量和可疑恢复路径
  - **整改动作**：处理 `LOCAL_STORAGE_KEY` 等历史遗留表述，并确认 `print-content` 中 `sessionStorage.getItem('resumeData')` 是否仍然需要
  - **涉及文件**：`src/types/resume.ts`、`src/components/print-content.tsx`、相关调用处
  - **验收标准**：仓库中不再同时存在“桌面文件存储”和“旧 local/session storage 契约”混杂的表述

---

## P2：结构优化、测试覆盖、权限收敛

### 12. 拆分超大组件，压缩单文件职责

- [ ] 拆分大型页面/容器组件
  - **整改动作**：优先处理 `resume-builder.tsx`、`resume-preview.tsx`、`application-board.tsx`、`user-center.tsx`，把数据加载、派生状态、对话框控制、纯展示组件分离
  - **涉及文件**：`src/components/resume-builder.tsx`、`src/components/resume-preview.tsx`、`src/components/application-board.tsx`、`src/components/user-center.tsx`
  - **验收标准**：核心页面文件长度和职责下降，复用逻辑被抽出为 hooks / service / subcomponents

### 13. 缩小全局 Provider 的包裹范围

- [ ] 审视 `ColorPickerProvider` 和 `ToolbarProvider` 的作用域
  - **整改动作**：只在真正需要编辑器上下文的路由/页面挂载 provider，而不是全应用包裹
  - **涉及文件**：`src/App.tsx`
  - **验收标准**：非编辑页面不再承载无关的编辑器级全局状态

### 14. 为导出、存储、解析边界补充自动化测试

- [ ] 增加最小可用的前端和 Tauri 测试覆盖
  - **整改动作**：优先覆盖三类高风险路径：
    - 不可信 JSON 解析 / 标准化
    - 存储层写入与更新
    - PDF 导出主流程
  - **涉及范围**：前端测试目录、`src-tauri/` 测试、脚本配置
  - **验收标准**：仓库具备明确的 `test` 入口，关键主链路不再完全依赖手工回归

### 15. 收紧 Tauri capability 与命令暴露范围

- [ ] 按最小权限原则审视文件系统和命令能力
  - **整改动作**：复核 `src-tauri/capabilities/default.json` 的 fs/dialog 权限范围，并梳理 `src-tauri/src/lib.rs` 暴露命令面的必要性
  - **涉及文件**：`src-tauri/capabilities/default.json`、`src-tauri/src/lib.rs`
  - **验收标准**：权限声明与命令暴露更贴近实际使用面，不为未来多窗口/多 webview 埋隐患

### 16. 统一 JSON 文件持久化实现

- [ ] 抽取共享的本地 JSON 存储基础设施
  - **整改动作**：收敛 `storage.rs`、`applications.rs`、`ai_config.rs` 中重复的数据目录解析、JSON 读写、错误映射逻辑
  - **涉及文件**：`src-tauri/src/storage.rs`、`src-tauri/src/applications.rs`、`src-tauri/src/ai_config.rs`
  - **验收标准**：后续若要引入原子写、备份、版本迁移、锁或统一错误模型，只需改一处基础实现

---

## 适合先做的 Quick Wins

如果只安排一个短周期，建议先完成下面几项：

- [ ] 修复 `resume-preview.tsx` 的原地排序
- [ ] 修复 `pdf.rs` 的固定临时文件名与重复 `remove_file`
- [ ] 为 `EditResume` / `EditNew` / `ViewResume` 补齐加载失败处理
- [ ] 去掉 `pdf-viewer.tsx` 中的 `alert(...)`，统一为现有 toast 风格
- [ ] 清理 `LOCAL_STORAGE_KEY` 与不再可信的旧存储契约

## 适合中期推进的结构性改造

- [ ] 导出 / PDF 平台调用适配层统一
- [ ] 大型页面组件拆分
- [ ] 富文本类型系统收紧
- [ ] Rust 本地持久化基础设施抽象
- [ ] 自动化测试补齐

## 备注

- 本清单默认基于当前仓库状态整理，后续如果已完成部分整改，建议直接在本文档中勾选并补充变更说明。
- 如果要继续向下执行，最自然的下一步是把本清单拆成：**Quick Wins 实施计划** 和 **结构性重构计划** 两份更细的执行文档。
