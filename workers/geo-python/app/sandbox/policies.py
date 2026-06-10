# GeoWork Python Worker - Sandbox Policies
# Defines sandbox execution policies

from typing import Dict, List, Optional
from dataclasses import dataclass, field, asdict


@dataclass
class SandboxPolicy:
    """Sandbox execution policy."""
    allowed_paths: List[str] = field(default_factory=list)
    blocked_cmds: List[str] = field(default_factory=lambda: ["rm", "sudo", "mkfs", "fdisk", "dd"])
    network_access: bool = False
    timeout: int = 300
    max_memory_mb: int = 512
    env_whitelist: List[str] = field(default_factory=lambda: ["PATH", "HOME", "LANG", "PYTHONPATH"])

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict) -> 'SandboxPolicy':
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})

    @classmethod
    def default(cls) -> 'SandboxPolicy':
        return cls()

    @classmethod
    def strict(cls) -> 'SandboxPolicy':
        """Strict policy: no network, no external commands."""
        return cls(
            allowed_paths=[],
            blocked_cmds=["rm", "sudo", "mkfs", "fdisk", "dd", "wget", "curl", "pip", "apt"],
            network_access=False,
            timeout=60,
            max_memory_mb=256,
        )

    @classmethod
    def permissive(cls) -> 'SandboxPolicy':
        """Permissive policy: allows more operations."""
        return cls(
            allowed_paths=[],
            blocked_cmds=["rm", "sudo", "mkfs", "fdisk", "dd"],
            network_access=True,
            timeout=600,
            max_memory_mb=1024,
        )
