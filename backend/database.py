from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, HTTPException
# Fix bcrypt 4.x compat with passlib - suppress passlib's logger warning
import warnings
import logging
warnings.filterwarnings("ignore", message=".*bcrypt.*__about__.*")
logging.getLogger("passlib.handlers.bcrypt").setLevel(logging.ERROR)
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'ssc_track')
client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=15000, connectTimeoutMS=15000)
db = client[db_name]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 10080

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    from models import User
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    # First check users collection
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        # For cashier PIN login - check employees collection and create virtual user
        employee = await db.employees.find_one({"id": user_id}, {"_id": 0})
        if employee:
            # Generate a valid placeholder email if not provided
            emp_email = employee.get("email", "") or f"cashier.{employee['id'][:8]}@example.com"
            user = {
                "id": employee["id"],
                "email": emp_email,
                "name": employee.get("name", "Cashier"),
                "role": "cashier",
                "branch_id": employee.get("branch_id"),
                "permissions": ["cashier", "pos", "sales"],
                "created_at": employee.get("created_at", datetime.now(timezone.utc).isoformat())
            }
        else:
            raise HTTPException(status_code=401, detail="User not found")
    return User(**user)
