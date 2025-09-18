from pydantic import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+pymysql://root@127.0.0.1:3306/stockdb"
    SECRET_KEY: str = "CHANGE_THIS_SECRET"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60*24  # 1 day
    ALGORITHM: str = "HS256"

    class Config:
        env_file = ".env"

settings = Settings()
