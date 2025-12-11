"""
Configurações centralizadas da aplicação.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Configurações do HawkEye Backend."""
    
    # App
    APP_TITLE: str = "HawkEye Backend API"
    APP_VERSION: str = "2.3.1"
    
    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    SUPABASE_BUCKET_TEMP: str = "pipeline-temp"
    SUPABASE_BUCKET_PERMANENT: str = "pipeline-permanent"
    
    # Processamento
    BORDER_MASK_PATH: str = "mascaraDaBorda.png"
    
    # Validação de arquivos
    VALID_IMAGE_TYPES: list = [
        "image/jpeg",
        "image/png", 
        "image/webp",
        "image/jpg"
    ]
    
    def validate(self) -> None:
        """Valida se as configurações obrigatórias estão definidas."""
        if not self.SUPABASE_URL or not self.SUPABASE_KEY:
            raise RuntimeError(
                "Variáveis SUPABASE_URL e SUPABASE_KEY devem estar definidas"
            )


settings = Settings()