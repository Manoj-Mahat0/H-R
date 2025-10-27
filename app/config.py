from pydantic import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "mysql+pymysql://root@127.0.0.1:3306/stockdb"
    # DATABASE_URL = "mysql+pymysql://wdacfesn_haldiramDB:haldiramDB%401234@34.213.214.55:3306/wdacfesn_haldiramDB"
    SECRET_KEY: str = "CHANGE_THIS_SECRET"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60*24  # 1 day
    ALGORITHM: str = "HS256"
    ATTENDANCE_FIXED_LAT: float | None = None   # set in .env for fixed location
    ATTENDANCE_FIXED_LNG: float | None = None
    ATTENDANCE_RADIUS_METERS: int = 100         # allowed radius in meters (default 100)
    TIMEZONE: str = "Asia/Kolkata"

    class Config:
        env_file = ".env"

settings = Settings()
