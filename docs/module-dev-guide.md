# MedSeg Cloud — 可插拔模块开发指南

本文档面向模块开发者，说明如何为 MedSeg Cloud 编写自定义处理模块。

---

## 1 · 架构概述

MedSeg Cloud 的处理管线采用 **文件系统沙箱** 协议：

- 宿主（Host）将输入图像文件暂存到临时目录
- 模块从输入目录读取文件、处理、将结果写入输出目录
- 宿主收集输出文件并保存到存储、创建数据库记录
- **模块无需访问数据库、存储或任何宿主内部 API**

```
宿主                                模块
 │                                    │
 ├─ 创建 work_dir / input_dir /       │
 │   output_dir 临时目录               │
 ├─ 下载图像到 input_dir               │
 ├─ 构造 RunInput ─────────────────>  │
 │                                    ├─ 读取 input_dir 中的文件
 │                                    ├─ 处理（推理/预处理等）
 │                                    ├─ 输出写入 output_dir
 │                                    ├─ 返回 RunOutput ──────>│
 ├─ 从 output_dir 收集文件             │
 ├─ 保存到对象存储                     │
 ├─ 创建 Subset + Image 数据库记录     │
 └─ 清理临时目录                       │
```

---

## 2 · 接口规范

所有模块必须继承 `PipelineModule` 抽象基类并实现以下方法：

```python
from app.pipeline.interface import (
    AvailabilityResult,
    AwarenessInput,
    ModuleInfo,
    PipelineModule,
    RunInput,
    RunOutput,
)

class MyModule(PipelineModule):
    def module_info(self) -> ModuleInfo: ...
    async def check_availability(self, awareness_input: AwarenessInput) -> AvailabilityResult: ...
    async def load(self) -> None: ...
    async def unload(self) -> None: ...
    async def run(self, run_input: RunInput) -> RunOutput: ...
```

### 2.1 `module_info()` — 模块元数据

返回模块的静态信息：

```python
def module_info(self) -> ModuleInfo:
    return ModuleInfo(
        name="my_segmenter",            # 全局唯一标识，用于 API 引用
        version="1.0.0",
        description="Brain MRI 分割模型",
        suggestion_priority=200,         # 建议优先级，越小越高（仅影响 UI 排序）
        max_ram_mb=512,                  # 声明所需最大 RAM（MB）
        max_vram_mb=4096,                # 声明所需最大 VRAM（MB）
        params_schema=None,              # 可选：运行参数 JSON Schema
    )
```

**`params_schema`**：如果模块需要用户指定运行参数，可通过 Pydantic 模型导出 JSON Schema：

```python
from pydantic import BaseModel, Field

class SegmentParams(BaseModel):
    threshold: float = Field(0.5, ge=0.0, le=1.0, description="分割阈值")
    model_variant: str = Field("default", description="模型变体")

# 在 module_info 中：
params_schema=SegmentParams.model_json_schema()
```

前端会根据此 Schema 动态渲染参数表单。

### 2.2 `check_availability()` — 可用性感知

系统在用户打开样本集时调用此方法，判断模块是否适用。

**输入（`AwarenessInput`）**：

```python
class AwarenessInput(BaseModel):
    sample_set_id: UUID
    sample_set_name: str
    subsets: list[SubsetInfo]    # 包含图像级元数据

class SubsetInfo(BaseModel):
    id: UUID
    name: str
    type: str                    # 子集类型（如 "raw", "normalized"）
    metadata: dict               # 子集级元数据
    images: list[SubsetImageSummary]

class SubsetImageSummary(BaseModel):
    id: UUID
    filename: str
    format: str                  # "nifti" / "dicom"
    metadata: dict               # 图像级元数据
```

**返回（`AvailabilityResult`）**：

```python
class AvailabilityResult(BaseModel):
    available_subset_ids: list[UUID] = []     # 可运行的子集
    recommended_subset_ids: list[UUID] = []   # 建议运行的子集
    reason: str | None = None                 # 可选说明
```

**规则**：

- **不可用**：两个列表均为空（模块不出现在 UI 中）
- **可用**：子集出现在 `available_subset_ids` 中
- **推荐**：子集出现在 `recommended_subset_ids` 中（通常指"尚未处理"的子集）
- 同一子集不应同时出现在两个列表中

**示例**：

```python
async def check_availability(
    self, awareness_input: AwarenessInput
) -> AvailabilityResult:
    available = []
    recommended = []

    for subset in awareness_input.subsets:
        # 只处理 normalized 类型的子集
        if subset.type != "normalized":
            continue

        # 检查图像格式是否兼容
        has_nifti = any(img.format == "nifti" for img in subset.images)
        if not has_nifti:
            continue

        # 检查是否已有此模块的分割结果
        has_result = any(
            s.metadata.get("source_module") == "my_segmenter"
            and s.metadata.get("source_subset_id") == str(subset.id)
            for s in awareness_input.subsets
        )

        if has_result:
            available.append(subset.id)
        else:
            recommended.append(subset.id)

    return AvailabilityResult(
        available_subset_ids=available,
        recommended_subset_ids=recommended,
    )
```

### 2.3 `load()` / `unload()` — 模型生命周期

```python
async def load(self) -> None:
    """加载模型到 GPU/内存。"""
    self._model = load_my_model("weights.pth", device="cuda")
    self._loaded = True

async def unload(self) -> None:
    """释放 GPU/内存。"""
    del self._model
    torch.cuda.empty_cache()
    self._loaded = False

@property
def is_loaded(self) -> bool:
    """报告加载状态。"""
    return self._loaded
```

- `load()` 由调度器在任务执行前按需调用
- `unload()` 由资源管理器在需要释放资源时调用
- `is_loaded` 属性允许宿主查询模块状态
- `check_availability()` **不要求模块已加载**，即使模型未加载也需能判断可用性

### 2.4 `run()` — 执行处理

**输入（`RunInput`）**：

```python
class RunInput(BaseModel):
    work_dir: Path       # 临时工作目录（可读写，用于中间文件）
    input_dir: Path      # 输入图像目录（只读）
    output_dir: Path     # 输出目录（模块将结果写入此处）
    images: list[InputImageInfo]   # 输入图像描述
    params: dict         # 用户指定的运行参数
    sample_set_meta: dict          # 样本集上下文

class InputImageInfo(BaseModel):
    id: UUID
    filename: str        # 相对于 input_dir
    format: str          # "nifti" / "dicom"
    metadata: dict       # 图像级元数据
```

**返回（`RunOutput`）**：

```python
class RunOutput(BaseModel):
    type: str            # 输出子集类型（如 "segmentation"）
    metadata: dict       # 输出子集元数据
    images: list[OutputImageInfo]

class OutputImageInfo(BaseModel):
    filename: str        # 相对于 output_dir
    format: str
    metadata: dict
    source_image_id: UUID | None   # 关联输入图像（用于叠加显示）
```

**示例**：

```python
async def run(self, run_input: RunInput) -> RunOutput:
    output_images = []

    for img in run_input.images:
        # 读取输入
        input_path = run_input.input_dir / img.filename
        image_data = nib.load(str(input_path))

        # 推理
        mask = self._model.predict(image_data.get_fdata())

        # 写入输出
        output_filename = f"seg_{img.filename}"
        output_path = run_input.output_dir / output_filename
        nib.save(nib.Nifti1Image(mask, image_data.affine), str(output_path))

        output_images.append(OutputImageInfo(
            filename=output_filename,
            format="nifti",
            metadata={"label_count": int(mask.max())},
            source_image_id=img.id,
        ))

    return RunOutput(
        type="segmentation",
        metadata={
            "is_segmentation": True,        # 前端用此标志触发叠加显示
            "source_module": "my_segmenter",
            "model_version": "1.0.0",
        },
        images=output_images,
    )
```

**关键约束**：

- 只通过 `run_input.input_dir` 和 `run_input.output_dir` 进行文件 I/O
- `work_dir` 可用于中间文件（如模型推理的临时缓存）
- **不要**访问数据库、网络（除非模型需要下载权重）
- 输出图像的 `source_image_id` 用于建立输入/输出图像映射（分割叠加）

---

## 3 · 模块文件放置

将模块文件放在 `app/pipeline/modules/` 目录下：

```
app/pipeline/modules/
├── __init__.py
├── echo.py              # 示例模块
└── my_segmenter.py      # 你的模块
```

系统启动时自动扫描此目录，发现并注册所有 `PipelineModule` 子类。

**命名约定**：

- 文件名：`snake_case.py`
- 类名：`PascalCase`，继承 `PipelineModule`
- `module_info().name`：全局唯一标识符

---

## 4 · 资源声明

在 `module_info()` 中准确声明资源需求：

| 字段 | 说明 |
| --- | --- |
| `max_ram_mb` | 模块加载后占用的最大 RAM（MB） |
| `max_vram_mb` | 模块加载后占用的最大 GPU 显存（MB） |

系统根据这些声明进行资源调度：

- 加载前检查可用资源是否充足
- 资源不足时，按优先级卸载其他模块
- 声明不准确会导致 OOM 或资源浪费

---

## 5 · 完整示例：EchoModule

以下为内置的 `EchoModule`，是最简单的完整实现：

```python
import shutil

from app.pipeline.interface import (
    AvailabilityResult,
    AwarenessInput,
    ModuleInfo,
    OutputImageInfo,
    PipelineModule,
    RunInput,
    RunOutput,
)


class EchoModule(PipelineModule):
    def __init__(self) -> None:
        self._loaded = False

    def module_info(self) -> ModuleInfo:
        return ModuleInfo(
            name="echo",
            version="0.1.0",
            description="Echo module — copies input to output",
            suggestion_priority=999,
            max_ram_mb=10,
            max_vram_mb=0,
        )

    async def check_availability(
        self, awareness_input: AwarenessInput
    ) -> AvailabilityResult:
        if not awareness_input.subsets:
            return AvailabilityResult(reason="No subsets available")
        return AvailabilityResult(
            available_subset_ids=[s.id for s in awareness_input.subsets],
        )

    async def load(self) -> None:
        self._loaded = True

    async def unload(self) -> None:
        self._loaded = False

    async def run(self, run_input: RunInput) -> RunOutput:
        output_images = []
        for img in run_input.images:
            src = run_input.input_dir / img.filename
            dst = run_input.output_dir / img.filename
            if src.exists():
                shutil.copy2(src, dst)
            output_images.append(
                OutputImageInfo(
                    filename=img.filename,
                    format=img.format,
                    metadata=img.metadata,
                    source_image_id=img.id,
                )
            )
        return RunOutput(
            type="echo",
            metadata={"source_module": "echo", "params": run_input.params},
            images=output_images,
        )

    @property
    def is_loaded(self) -> bool:
        return self._loaded
```

---

## 6 · 调试与测试

### 6.1 单元测试

```python
import uuid
import pytest
from app.pipeline.interface import AwarenessInput, SubsetInfo, RunInput, InputImageInfo
from my_module import MyModule

@pytest.mark.asyncio
async def test_availability():
    mod = MyModule()
    result = await mod.check_availability(AwarenessInput(
        sample_set_id=uuid.uuid4(),
        sample_set_name="test",
        subsets=[SubsetInfo(id=uuid.uuid4(), name="raw", type="raw")],
    ))
    # 根据模块逻辑验证结果
    assert result.available_subset_ids or result.recommended_subset_ids

@pytest.mark.asyncio
async def test_run(tmp_path):
    mod = MyModule()
    await mod.load()

    input_dir = tmp_path / "input"
    output_dir = tmp_path / "output"
    work_dir = tmp_path / "work"
    for d in [input_dir, output_dir, work_dir]:
        d.mkdir()

    # 准备测试数据
    (input_dir / "test.nii.gz").write_bytes(b"fake-data")

    result = await mod.run(RunInput(
        work_dir=work_dir,
        input_dir=input_dir,
        output_dir=output_dir,
        images=[InputImageInfo(
            id=uuid.uuid4(),
            filename="test.nii.gz",
            format="nifti",
        )],
    ))

    assert result.type  # 验证输出类型
    assert len(result.images) > 0
    # 验证输出文件存在
    for img in result.images:
        assert (output_dir / img.filename).exists()
```

### 6.2 运行测试

```bash
uv run pytest tests/ -v
```

---

## 7 · 清单

开发新模块时，确认以下各项：

- [ ] 继承 `PipelineModule`，实现所有抽象方法
- [ ] `module_info().name` 全局唯一
- [ ] 资源声明（`max_ram_mb` / `max_vram_mb`）准确
- [ ] `check_availability()` 不依赖模型加载状态
- [ ] `check_availability()` 利用图像级元数据（格式等）判断可用性
- [ ] `run()` 仅通过 `input_dir` / `output_dir` 进行文件 I/O
- [ ] `run()` 返回的 `OutputImageInfo` 正确填写 `source_image_id`
- [ ] 分割结果的 `metadata` 包含 `is_segmentation: True`
- [ ] `load()` / `unload()` 正确管理模型生命周期
- [ ] `is_loaded` 属性准确反映状态
- [ ] 编写单元测试覆盖 availability 和 run 逻辑
- [ ] 文件放在 `app/pipeline/modules/` 目录下
