from pydantic import BaseSettings

class Settings(BaseSettings):
    # DATABASE_URL: str = "mysql+pymysql://root@127.0.0.1:3306/stockdb"
    DATABASE_URL = "mysql+pymysql://wdacfesn_haldiramDB:haldiramDB%401234@34.213.214.55:3306/wdacfesn_haldiramDB"
    SECRET_KEY: str = "CHANGE_THIS_SECRET"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60*24  # 1 day
    ALGORITHM: str = "HS256"

    class Config:
        env_file = ".env"

settings = Settings()
