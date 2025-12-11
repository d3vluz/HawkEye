"""
Cache de imagens em memória.

Armazena imagens temporárias durante o processamento,
eliminando a necessidade de múltiplos uploads/downloads
para o bucket temporário do Supabase.
"""
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
import threading


@dataclass
class CachedImage:
    """Representa uma imagem cacheada com seus metadados."""
    filename: str
    sha256: str
    timestamp: str
    original: np.ndarray
    processed_areas: Optional[np.ndarray] = None
    processed_pins: Optional[np.ndarray] = None
    processed_boxes: Optional[np.ndarray] = None
    processed_shafts: Optional[np.ndarray] = None
    areas_count: int = 0
    pins_count: int = 0
    pin_boxes: list = field(default_factory=list)
    x_positions: list = field(default_factory=list)
    y_positions: list = field(default_factory=list)
    boxes_info: Dict[str, Any] = field(default_factory=dict)
    pin_classification: Dict[str, Any] = field(default_factory=dict)
    shaft_classification: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass 
class CachedBatch:
    """Representa um lote de imagens cacheadas."""
    timestamp: str
    images: Dict[str, CachedImage] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    
    @property
    def total_images(self) -> int:
        return len(self.images)
    
    @property
    def memory_estimate_mb(self) -> float:
        """Estimativa de memória usada pelo lote em MB."""
        total_bytes = 0
        for img in self.images.values():
            if img.original is not None:
                total_bytes += img.original.nbytes
            if img.processed_areas is not None:
                total_bytes += img.processed_areas.nbytes
            if img.processed_pins is not None:
                total_bytes += img.processed_pins.nbytes
            if img.processed_boxes is not None:
                total_bytes += img.processed_boxes.nbytes
            if img.processed_shafts is not None:
                total_bytes += img.processed_shafts.nbytes
        return total_bytes / (1024 * 1024)


class ImageCache:
    """
    Cache em memória para imagens durante processamento.
    
    Armazena lotes de imagens indexados por timestamp.
    Thread-safe para uso com múltiplas requisições.
    
    Uso:
        cache = ImageCache()
        
        # Adicionar imagem
        cache.add_image(timestamp, sha256, filename, image_array)
        
        # Recuperar imagem
        img = cache.get_image(timestamp, sha256)
        
        # Atualizar com resultados processados
        cache.update_processed(timestamp, sha256, "areas", processed_array)
        
        # Limpar lote após criar ou rejeitar
        cache.clear_batch(timestamp)
    """
    DEFAULT_TTL_HOURS = 1
    
    def __init__(self):
        self._batches: Dict[str, CachedBatch] = {}
        self._lock = threading.Lock()
    
    def create_batch(self, timestamp: str) -> CachedBatch:
        """Cria um novo lote vazio."""
        with self._lock:
            if timestamp not in self._batches:
                self._batches[timestamp] = CachedBatch(timestamp=timestamp)
            return self._batches[timestamp]
    
    def get_batch(self, timestamp: str) -> Optional[CachedBatch]:
        """Recupera um lote pelo timestamp."""
        with self._lock:
            return self._batches.get(timestamp)
    
    def add_image(
        self,
        timestamp: str,
        sha256: str,
        filename: str,
        image: np.ndarray
    ) -> CachedImage:
        """
        Adiciona uma imagem original ao cache.
        
        Args:
            timestamp: Timestamp do lote
            sha256: Hash da imagem
            filename: Nome do arquivo
            image: Array numpy da imagem (BGR)
        
        Returns:
            CachedImage criada
        """
        with self._lock:
            # Criar lote se não existir
            if timestamp not in self._batches:
                self._batches[timestamp] = CachedBatch(timestamp=timestamp)
            
            batch = self._batches[timestamp]
            
            # Criar ou atualizar imagem
            cached_img = CachedImage(
                filename=filename,
                sha256=sha256,
                timestamp=timestamp,
                original=image
            )
            batch.images[sha256] = cached_img
            
            return cached_img
    
    def get_image(self, timestamp: str, sha256: str) -> Optional[CachedImage]:
        """Recupera uma imagem do cache."""
        with self._lock:
            batch = self._batches.get(timestamp)
            if batch:
                return batch.images.get(sha256)
            return None
    
    def update_processed(
        self,
        timestamp: str,
        sha256: str,
        image_type: str,
        image: np.ndarray
    ) -> bool:
        """
        Atualiza uma imagem processada no cache.
        
        Args:
            timestamp: Timestamp do lote
            sha256: Hash da imagem original
            image_type: Tipo ("areas", "pins", "boxes", "shafts")
            image: Array numpy da imagem processada
        
        Returns:
            True se atualizado, False se não encontrado
        """
        with self._lock:
            batch = self._batches.get(timestamp)
            if not batch:
                return False
            
            cached_img = batch.images.get(sha256)
            if not cached_img:
                return False
            
            attr_name = f"processed_{image_type}"
            if hasattr(cached_img, attr_name):
                setattr(cached_img, attr_name, image)
                return True
            
            return False
    
    def update_metadata(
        self,
        timestamp: str,
        sha256: str,
        **kwargs
    ) -> bool:
        """
        Atualiza metadados de uma imagem (contagens, classificações, etc).
        
        Args:
            timestamp: Timestamp do lote
            sha256: Hash da imagem
            **kwargs: Campos a atualizar (areas_count, pins_count, etc)
        
        Returns:
            True se atualizado, False se não encontrado
        """
        with self._lock:
            batch = self._batches.get(timestamp)
            if not batch:
                return False
            
            cached_img = batch.images.get(sha256)
            if not cached_img:
                return False
            
            for key, value in kwargs.items():
                if hasattr(cached_img, key):
                    setattr(cached_img, key, value)
            
            return True
    
    def clear_batch(self, timestamp: str) -> bool:
        """
        Remove um lote do cache (após criar ou rejeitar).
        
        Args:
            timestamp: Timestamp do lote
        
        Returns:
            True se removido, False se não encontrado
        """
        with self._lock:
            if timestamp in self._batches:
                del self._batches[timestamp]
                return True
            return False
    
    def cleanup_expired(self, ttl_hours: float = None) -> int:
        """
        Remove lotes expirados do cache.
        
        Args:
            ttl_hours: Tempo de vida em horas (default: 1 hora)
        
        Returns:
            Número de lotes removidos
        """
        if ttl_hours is None:
            ttl_hours = self.DEFAULT_TTL_HOURS
        
        cutoff = datetime.now() - timedelta(hours=ttl_hours)
        removed = 0
        
        with self._lock:
            expired = [
                ts for ts, batch in self._batches.items()
                if batch.created_at < cutoff
            ]
            for ts in expired:
                del self._batches[ts]
                removed += 1
        
        return removed
    
    def get_stats(self) -> Dict[str, Any]:
        """Retorna estatísticas do cache."""
        with self._lock:
            total_batches = len(self._batches)
            total_images = sum(b.total_images for b in self._batches.values())
            total_memory_mb = sum(b.memory_estimate_mb for b in self._batches.values())
            
            return {
                "total_batches": total_batches,
                "total_images": total_images,
                "memory_mb": round(total_memory_mb, 2),
                "batches": {
                    ts: {
                        "images": batch.total_images,
                        "memory_mb": round(batch.memory_estimate_mb, 2),
                        "created_at": batch.created_at.isoformat()
                    }
                    for ts, batch in self._batches.items()
                }
            }

image_cache = ImageCache()


def get_image_cache() -> ImageCache:
    """Retorna a instância global do cache."""
    return image_cache