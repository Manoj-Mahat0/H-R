import redis
import os



# Prefer REDIS_URL from env, else use your Redis Cloud credentials
REDIS_URL = os.getenv("REDIS_URL")
if REDIS_URL:
	redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
else:
	redis_client = redis.Redis(
		host='redis-12749.crce206.ap-south-1-1.ec2.redns.redis-cloud.com',
		port=12749,
		decode_responses=True,
		username="default",
		password="PMWx2c9d1W2Xg2XFHVq9eLnqquo9Ydq8",
	)

# Usage example:
# redis_client.set("foo", "bar")
# print(redis_client.get("foo"))
