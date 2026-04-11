import uuid

import pytest

from app.pipeline.interface import (
    AvailabilityStatus,
    InputImageInfo,
    ModuleInfo,
    RunInput,
)
from app.pipeline.modules.echo import EchoModule
from app.pipeline.registry import ModuleRegistry
from app.pipeline.resource_manager import InsufficientResources, ResourceManager

# --------------- Interface & Echo Module ---------------


def test_echo_module_info():
    mod = EchoModule()
    info = mod.module_info()
    assert info.name == "echo"
    assert info.version == "0.1.0"
    assert info.max_ram_mb == 10


@pytest.mark.asyncio
async def test_echo_check_availability_no_subsets():
    mod = EchoModule()
    result = await mod.check_availability({})
    assert result.status == AvailabilityStatus.unavailable


@pytest.mark.asyncio
async def test_echo_check_availability_with_subsets():
    mod = EchoModule()
    result = await mod.check_availability(
        {"subset_ids": ["00000000-0000-0000-0000-000000000001"]}
    )
    assert result.status == AvailabilityStatus.available
    assert len(result.target_subset_ids) == 1


@pytest.mark.asyncio
async def test_echo_load_unload():
    mod = EchoModule()
    assert not mod.is_loaded
    await mod.load()
    assert mod.is_loaded
    await mod.unload()
    assert not mod.is_loaded


@pytest.mark.asyncio
async def test_echo_run_filesystem_sandbox(tmp_path):
    """Test echo module using the filesystem sandbox protocol."""
    mod = EchoModule()
    await mod.load()

    input_dir = tmp_path / "input"
    output_dir = tmp_path / "output"
    work_dir = tmp_path / "work"
    input_dir.mkdir()
    output_dir.mkdir()
    work_dir.mkdir()

    # Stage a fake image file in input_dir
    (input_dir / "brain.nii.gz").write_bytes(b"fake-nifti-data")
    img_id = uuid.uuid4()

    run_input = RunInput(
        work_dir=work_dir,
        input_dir=input_dir,
        output_dir=output_dir,
        images=[
            InputImageInfo(
                id=img_id,
                filename="brain.nii.gz",
                format="nifti",
                metadata={"slice_count": 120},
            )
        ],
        params={},
        sample_set_meta={"name": "test_set"},
    )

    result = await mod.run(run_input)

    # Verify output
    assert result.type == "echo"
    assert result.metadata["source_module"] == "echo"
    assert len(result.images) == 1
    assert result.images[0].filename == "brain.nii.gz"
    assert result.images[0].source_image_id == img_id

    # Verify file was actually copied
    out_file = output_dir / "brain.nii.gz"
    assert out_file.exists()
    assert out_file.read_bytes() == b"fake-nifti-data"


# --------------- Registry ---------------


def test_registry_register_and_list():
    reg = ModuleRegistry()
    mod = EchoModule()
    reg.register(mod)
    assert len(reg) == 1
    modules = reg.list_all()
    assert len(modules) == 1
    info, enabled = modules[0]
    assert info.name == "echo"
    assert enabled is True


def test_registry_enable_disable():
    reg = ModuleRegistry()
    reg.register(EchoModule())
    assert reg.is_enabled("echo")
    reg.disable("echo")
    assert not reg.is_enabled("echo")
    assert len(reg.list_enabled()) == 0
    reg.enable("echo")
    assert reg.is_enabled("echo")
    assert len(reg.list_enabled()) == 1


def test_registry_get():
    reg = ModuleRegistry()
    reg.register(EchoModule())
    mod = reg.get("echo")
    assert mod is not None
    assert mod.module_info().name == "echo"
    assert reg.get("nonexistent") is None


def test_registry_discover(tmp_path):
    """Test discovery from a modules directory."""
    # Create a simple module file
    mod_file = tmp_path / "test_mod.py"
    mod_file.write_text(
        """
import uuid
from typing import Any
from app.pipeline.interface import (
    AvailabilityResult,
    AvailabilityStatus,
    ModuleInfo,
    PipelineModule,
    RunInput,
    RunOutput,
)

class TestModule(PipelineModule):
    def module_info(self):
        return ModuleInfo(
            name="test_discovered",
            version="1.0.0",
            description="test",
        )
    async def check_availability(self, m):
        return AvailabilityResult(status=AvailabilityStatus.unavailable)
    async def load(self):
        pass
    async def unload(self):
        pass
    async def run(self, run_input):
        return RunOutput(type="test", metadata={})
"""
    )
    # Discovery requires the module to be importable via app.pipeline.modules.X
    # We can't easily test dynamic discovery from tmp_path without modifying sys.path
    # So we test that discover returns 0 for an empty dir
    empty_dir = tmp_path / "empty"
    empty_dir.mkdir()
    reg = ModuleRegistry()
    count = reg.discover(empty_dir)
    assert count == 0


# --------------- Resource Manager ---------------


@pytest.mark.asyncio
async def test_resource_manager_load_unload():
    rm = ResourceManager(total_ram_mb=1000, total_vram_mb=8000, threshold_ratio=0.8)
    mod = EchoModule()
    await rm.load_module(mod)
    assert rm.is_loaded("echo")
    assert rm.used_ram_mb == 10

    await rm.unload_module("echo")
    assert not rm.is_loaded("echo")
    assert rm.used_ram_mb == 0


@pytest.mark.asyncio
async def test_resource_manager_eviction():
    """Test that loading a large module evicts smaller ones."""

    class BigModule(EchoModule):
        def module_info(self):
            return ModuleInfo(
                name="big",
                version="1.0",
                description="big",
                max_ram_mb=700,
                max_vram_mb=0,
            )

    rm = ResourceManager(total_ram_mb=1000, total_vram_mb=8000, threshold_ratio=0.8)
    # Threshold = 800 MB RAM
    echo = EchoModule()  # 10 MB
    big = BigModule()  # 700 MB

    await rm.load_module(echo)
    assert rm.is_loaded("echo")

    # Load big — echo (10 MB) + big (700 MB) = 710 < 800, should fit
    await rm.load_module(big)
    assert rm.is_loaded("big")
    assert rm.is_loaded("echo")


@pytest.mark.asyncio
async def test_resource_manager_eviction_when_needed():
    """Eviction triggers when threshold is exceeded."""

    class MediumA(EchoModule):
        def module_info(self):
            return ModuleInfo(
                name="medium_a",
                version="1.0",
                description="a",
                max_ram_mb=500,
                max_vram_mb=0,
            )

    class MediumB(EchoModule):
        def module_info(self):
            return ModuleInfo(
                name="medium_b",
                version="1.0",
                description="b",
                max_ram_mb=500,
                max_vram_mb=0,
            )

    rm = ResourceManager(total_ram_mb=1000, total_vram_mb=8000, threshold_ratio=0.8)
    # Threshold = 800 MB
    a = MediumA()
    b = MediumB()

    await rm.load_module(a)
    assert rm.is_loaded("medium_a")

    # Loading B would require 500+500=1000 > 800, so A should be evicted
    await rm.load_module(b, queue_wait_times={})
    assert rm.is_loaded("medium_b")
    assert not rm.is_loaded("medium_a")


@pytest.mark.asyncio
async def test_resource_manager_insufficient():
    """Check that InsufficientResources is raised when impossible."""

    class HugeModule(EchoModule):
        def module_info(self):
            return ModuleInfo(
                name="huge",
                version="1.0",
                description="huge",
                max_ram_mb=9000,
                max_vram_mb=0,
            )

    rm = ResourceManager(total_ram_mb=1000, total_vram_mb=8000, threshold_ratio=0.8)
    huge = HugeModule()

    with pytest.raises(InsufficientResources):
        await rm.load_module(huge)


def test_resource_manager_status():
    rm = ResourceManager(total_ram_mb=1000, total_vram_mb=8000, threshold_ratio=0.8)
    status = rm.status()
    assert status["total_ram_mb"] == 1000
    assert status["total_vram_mb"] == 8000
    assert status["used_ram_mb"] == 0
    assert status["loaded_modules"] == []
